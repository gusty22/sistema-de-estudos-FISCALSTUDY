# R/visualization.R
# Módulo de Visualizações Estatísticas em Base R
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Gera Gráfico de Evolução Temporal de Acurácia com Intervalos de Incerteza
#' @param temporal_df data.frame resultante de calculate_temporal_evolution
#' @param output_path Caminho opcional do arquivo PNG para salvar
plot_accuracy_evolution <- function(temporal_df, output_path = NULL) {
  if (is.null(temporal_df) || nrow(temporal_df) == 0) {
    message("Sem dados para plot_accuracy_evolution.")
    return(invisible(NULL))
  }
  
  if (!is.null(output_path)) {
    dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
    grDevices::png(output_path, width = 900, height = 550, res = 120)
    on.exit(grDevices::dev.off())
  }
  
  graphics::par(mar = c(4.5, 4.5, 3.5, 1.5), family = "sans")
  
  x <- temporal_df$session_order
  y <- temporal_df$accuracy * 100
  y_low <- temporal_df$ci_lower * 100
  y_high <- temporal_df$ci_upper * 100
  
  graphics::plot(
    x, y,
    type = "b", pch = 19, col = "#1E40AF", lwd = 2,
    ylim = c(0, 100),
    xlab = "Sessão de Estudo (Ordem Cronológica)",
    ylab = "Taxa de Acerto (%)",
    main = "Evolução do Desempenho por Sessão",
    xaxt = "n"
  )
  graphics::grid(nx = NA, ny = NULL, col = "#E2E8F0", lty = 1)
  graphics::axis(1, at = x, labels = paste0("S", x))
  
  # Adicionar barras de erro (Wilson 95% CI)
  for (i in seq_along(x)) {
    if (!is.na(y_low[i]) && !is.na(y_high[i])) {
      graphics::arrows(x[i], y_low[i], x[i], y_high[i], angle = 90, code = 3, length = 0.05, col = "#64748B", lwd = 1.2)
    }
    # Anotação com denominador
    lbl <- sprintf("%d/%d", temporal_df$n_correct[i], temporal_df$n_attempts[i])
    graphics::text(x[i], min(98, y[i] + 6), labels = lbl, cex = 0.75, col = "#334155")
  }
  
  # Linha de referência mediana global
  med_y <- stats::median(y, na.rm = TRUE)
  graphics::abline(h = med_y, col = "#94A3B8", lty = 2, lwd = 1)
  
  graphics::mtext(
    text = "Nota: Barras verticais indicam Intervalo de Confiança Wilson (95%). Rótulos indicam k/n.",
    side = 1, line = 3.2, cex = 0.7, col = "#64748B", adj = 0
  )
  
  invisible(NULL)
}

#' Gera Gráfico de Distribuição dos Tempos de Resolução
#' @param attempts_df data.frame com coluna active_time_ms
#' @param output_path Caminho opcional do arquivo PNG para salvar
plot_response_time_distribution <- function(attempts_df, output_path = NULL) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || !"active_time_ms" %in% names(attempts_df)) {
    message("Sem dados para plot_response_time_distribution.")
    return(invisible(NULL))
  }
  
  raw_times <- suppressWarnings(as.numeric(attempts_df$active_time_ms))
  times_sec <- raw_times[is.finite(raw_times) & raw_times >= 0] / 1000.0
  n <- length(times_sec)
  if (n == 0) return(invisible(NULL))
  
  if (!is.null(output_path)) {
    dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
    grDevices::png(output_path, width = 900, height = 550, res = 120)
    on.exit(grDevices::dev.off())
  }
  
  graphics::par(mfrow = c(1, 2), mar = c(4.5, 4.5, 3.5, 1.5), family = "sans")
  
  # Painel 1: Histograma com densidade
  med_t <- stats::median(times_sec)
  mean_t <- mean(times_sec)
  
  h <- graphics::hist(
    times_sec,
    breaks = if (n < 2L || length(unique(times_sec)) < 2L) 1L else "FD",
    col = "#DBEAFE",
    border = "#3B82F6",
    main = "Histograma de Tempos",
    xlab = "Tempo Ativo (segundos)",
    ylab = "Frequência Absoluta"
  )
  graphics::abline(v = med_t, col = "#DC2626", lwd = 2, lty = 1)
  graphics::abline(v = mean_t, col = "#059669", lwd = 2, lty = 2)
  graphics::legend(
    "topright",
    legend = c(sprintf("Mediana: %.1fs", med_t), sprintf("Média: %.1fs", mean_t)),
    col = c("#DC2626", "#059669"),
    lty = c(1, 2),
    lwd = 2,
    bty = "n",
    cex = 0.8
  )
  
  # Painel 2: Boxplot com indicação de quartis e extremos
  graphics::boxplot(
    times_sec,
    col = "#EFF6FF",
    border = "#1E40AF",
    pch = 21,
    bg = "#FCA5A5",
    main = "Diagrama de Caixa (Boxplot)",
    ylab = "Tempo Ativo (segundos)"
  )
  
  q <- stats::quantile(times_sec, probs = c(0.25, 0.5, 0.75))
  iqr_val <- q[3] - q[1]
  high_fence <- q[3] + 1.5 * iqr_val
  n_outliers <- sum(times_sec > high_fence)
  
  graphics::mtext(
    text = sprintf("N = %d resoluções válidas | %d extremos identificados (> %.1fs)", n, n_outliers, high_fence),
    side = 1, line = 2.5, cex = 0.75, col = "#475569"
  )
  
  invisible(NULL)
}

#' Gera Curva de Calibração Metrológica (Confiança vs Acurácia)
#' @param confidence_metrics Lista resultante de calculate_confidence_metrics
#' @param output_path Caminho opcional do arquivo PNG para salvar
plot_calibration_curve <- function(confidence_metrics, output_path = NULL) {
  if (is.null(confidence_metrics) || confidence_metrics$n_observations == 0) {
    message("Sem dados para plot_calibration_curve.")
    return(invisible(NULL))
  }
  
  acc_df <- confidence_metrics$accuracy_by_level
  if (is.null(acc_df) || nrow(acc_df) == 0) return(invisible(NULL))
  
  if (!is.null(output_path)) {
    dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
    grDevices::png(output_path, width = 900, height = 550, res = 120)
    on.exit(grDevices::dev.off())
  }
  
  graphics::par(mar = c(4.5, 4.5, 3.5, 1.5), family = "sans")
  
  # X: Probabilidade esperada (0.20 a 1.00)
  # Y: Acurácia observada (0.00 a 1.00)
  x <- acc_df$expected_probability
  y <- acc_df$accuracy
  y_low <- acc_df$ci_lower
  y_high <- acc_df$ci_upper
  
  graphics::plot(
    x, y,
    type = "p", pch = 19, col = "#2563EB", cex = 1.5,
    xlim = c(0.1, 1.05), ylim = c(0, 1.05),
    xlab = "Probabilidade Declarada (Nível de Confiança 1 a 5)",
    ylab = "Acurácia Observada (Proporção de Acerto)",
    main = "Diagrama de Confiabilidade e Calibração",
    xaxt = "n", yaxt = "n"
  )
  graphics::grid(nx = NULL, ny = NULL, col = "#F1F5F9", lty = 1)
  
  # Diagonal de Calibração Perfeita (y = x)
  graphics::abline(a = 0, b = 1, col = "#94A3B8", lty = 2, lwd = 1.5)
  
  graphics::axis(1, at = x, labels = paste0("Nível ", acc_df$confidence_level, "\n(", x, ")"))
  graphics::axis(2, at = seq(0, 1, 0.2), labels = paste0(seq(0, 100, 20), "%"))
  
  # Linha conectando pontos observados
  valid_pts <- which(!is.na(y))
  if (length(valid_pts) > 1) {
    graphics::lines(x[valid_pts], y[valid_pts], col = "#2563EB", lwd = 2)
  }
  
  # Barras de erro
  for (i in seq_along(x)) {
    if (!is.na(y_low[i]) && !is.na(y_high[i])) {
      graphics::arrows(x[i], y_low[i], x[i], y_high[i], angle = 90, code = 3, length = 0.05, col = "#64748B")
    }
    if (!is.na(y[i])) {
      lbl <- sprintf("%s\n(n=%d)", acc_df$denominator_text[i], acc_df$n_attempts[i])
      graphics::text(x[i], min(1.02, y[i] + 0.08), labels = lbl, cex = 0.72, col = "#1E293B")
    }
  }
  
  # Inscrição de métricas de calibração
  legend_text <- c(
    "Calibração Perfeita (y = x)",
    "Observado com IC 95% Wilson",
    sprintf("Brier Score: %.4f", confidence_metrics$brier_score),
    sprintf("ECE (Erro de Calibração): %.4f", confidence_metrics$ece)
  )
  graphics::legend(
    "topleft",
    legend = legend_text,
    col = c("#94A3B8", "#2563EB", NA, NA),
    pch = c(NA, 19, NA, NA),
    lty = c(2, 1, NA, NA),
    bty = "n",
    cex = 0.8
  )
  
  invisible(NULL)
}

#' Gera Comparação de Desempenho entre Disciplinas
#' @param discipline_df data.frame resultante de calculate_performance_by_discipline
#' @param output_path Caminho opcional do arquivo PNG para salvar
plot_discipline_comparison <- function(discipline_df, output_path = NULL) {
  if (is.null(discipline_df) || nrow(discipline_df) == 0) {
    message("Sem dados para plot_discipline_comparison.")
    return(invisible(NULL))
  }
  
  # Ordenar por taxa de acerto decrescente
  df <- discipline_df[order(discipline_df$accuracy, decreasing = TRUE), ]
  
  if (!is.null(output_path)) {
    dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
    grDevices::png(output_path, width = 900, height = max(400, nrow(df) * 45), res = 120)
    on.exit(grDevices::dev.off())
  }
  
  graphics::par(mar = c(4.5, 12, 3.5, 3), family = "sans")
  
  y_pos <- graphics::barplot(
    df$accuracy * 100,
    horiz = TRUE,
    names.arg = df$disciplina,
    las = 1,
    col = "#93C5FD",
    border = "#1D4ED8",
    xlim = c(0, 110),
    xlab = "Taxa de Acerto (%)",
    main = "Desempenho por Disciplina",
    cex.names = 0.8
  )
  graphics::grid(nx = NULL, ny = NA, col = "#E2E8F0", lty = 1)
  
  # Adicionar rótulos de denominadores e barras de erro
  for (i in seq_len(nrow(df))) {
    acc_pct <- df$accuracy[i] * 100
    ci_l <- df$ci_lower[i] * 100
    ci_u <- df$ci_upper[i] * 100
    
    if (!is.na(ci_l) && !is.na(ci_u)) {
      graphics::arrows(ci_l, y_pos[i], ci_u, y_pos[i], angle = 90, code = 3, length = 0.04, col = "#334155")
    }
    
    lbl <- sprintf("%s (N=%d)", df$denominator_text[i], df$n_attempts[i])
    graphics::text(min(108, max(acc_pct + 4, ci_u + 2)), y_pos[i], labels = lbl, cex = 0.72, col = "#0F172A", adj = 0)
  }
  
  invisible(NULL)
}

#' Gera Gráfico de Volume de Evidências e Incerteza Amostral por Disciplina
#' @param discipline_df data.frame resultante de calculate_performance_by_discipline
#' @param output_path Caminho opcional do arquivo PNG para salvar
plot_evidence_volume <- function(discipline_df, output_path = NULL) {
  if (is.null(discipline_df) || nrow(discipline_df) == 0) {
    message("Sem dados para plot_evidence_volume.")
    return(invisible(NULL))
  }
  
  df <- discipline_df[order(discipline_df$n_attempts, decreasing = TRUE), ]
  n_items <- nrow(df)
  
  if (!is.null(output_path)) {
    dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
    grDevices::png(output_path, width = 950, height = max(450, n_items * 55), res = 120)
    on.exit(grDevices::dev.off())
  }
  
  graphics::par(mar = c(4.5, 12, 3.8, 4), family = "sans")
  
  # Cores de robustez amostral baseadas no volume N
  bar_cols <- ifelse(df$n_attempts >= 30, "#10B981",
              ifelse(df$n_attempts >= 10, "#F59E0B", "#EF4444"))
  
  max_n <- max(df$n_attempts, na.rm = TRUE)
  x_limit <- max(12, max_n * 1.35)
  
  y_pos <- graphics::barplot(
    df$n_attempts,
    horiz = TRUE,
    names.arg = df$disciplina,
    las = 1,
    col = bar_cols,
    border = "#1E293B",
    xlim = c(0, x_limit),
    xlab = "Volume de Tentativas Observadas (N)",
    main = "Volume de Evidências e Robustez Amostral por Disciplina",
    cex.names = 0.8
  )
  graphics::grid(nx = NULL, ny = NA, col = "#F1F5F9", lty = 1)
  
  # Linhas verticais de limiares estatísticos (N=10 e N=30)
  graphics::abline(v = 10, col = "#F59E0B", lty = 3, lwd = 1.2)
  graphics::abline(v = 30, col = "#10B981", lty = 3, lwd = 1.2)
  
  # Adicionar anotações em cada barra
  for (i in seq_len(n_items)) {
    n_val <- df$n_attempts[i]
    k_val <- df$n_correct[i]
    acc_pct <- df$accuracy[i] * 100
    ci_span <- if (!is.na(df$ci_upper[i]) && !is.na(df$ci_lower[i])) {
      round((df$ci_upper[i] - df$ci_lower[i]) * 100, 1)
    } else {
      NA_real_
    }
    
    ci_text <- if (!is.na(ci_span)) sprintf("span IC: %.1f%%", ci_span) else "IC indefinido"
    lbl <- sprintf("N = %d (%d/%d acertos, %.1f%% | %s)", n_val, k_val, n_val, acc_pct, ci_text)
    
    graphics::text(n_val + 0.3, y_pos[i], labels = lbl, cex = 0.70, col = "#0F172A", adj = 0)
  }
  
  # Legenda explicativa de zonas de incerteza
  graphics::legend(
    "topright",
    legend = c("Robusto (N >= 30)", "Preliminar (10 <= N < 30)", "Amostra Baixa (N < 10)"),
    fill = c("#10B981", "#F59E0B", "#EF4444"),
    bty = "n",
    cex = 0.75
  )
  
  graphics::mtext(
    text = "Nota: Disciplinas com N < 10 possuem amplitude de incerteza excessiva para inferência causal ou automação pedagógica.",
    side = 1, line = 3.2, cex = 0.7, col = "#64748B", adj = 0
  )
  
  invisible(NULL)
}

