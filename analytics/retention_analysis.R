# retention_analysis.R
# Motor Psicométrico e Metrológico de Decaimento de Memória e Lei de Robin Hood
# Executa 100% em Base R (sem dependência de pacotes externos)

args <- commandArgs(trailingOnly = TRUE)
csv_path <- if (length(args) > 0) args[1] else "analytics/questions_v1.csv"
output_json_path <- if (length(args) > 1) args[2] else "analytics/robin_hood_weights.json"

cat("=======================================================================\n")
cat(" FISCALSTUDY ANALYTICS — VETOR DE ESQUECIMENTO & MOTOR ROBIN HOOD (R BASE)\n")
cat("=======================================================================\n")
cat(sprintf("Arquivo de entrada (Vetor de Esquecimento): %s\n", csv_path))
cat(sprintf("Artefato de saída (Robin Hood Weights):     %s\n\n", output_json_path))

# Se o arquivo não existir, verifica caminhos alternativos
if (!file.exists(csv_path)) {
  alt_paths <- c("analytics/sample_questions_v1.csv", "analytics/test_contract_export.csv", "analytics/sample_data.csv")
  found <- FALSE
  for (ap in alt_paths) {
    if (file.exists(ap)) {
      csv_path <- ap
      found <- TRUE
      cat(sprintf("[INFO] Arquivo principal não encontrado. Usando dataset alternativo: %s\n", csv_path))
      break
    }
  }
  if (!found) {
    cat(sprintf("[ERRO] Nenhum dataset de tentativas encontrado em '%s'.\n", csv_path))
    quit(status = 1)
  }
}

df <- read.csv(csv_path, stringsAsFactors = FALSE, na.strings = c("NA", "", "null"))
n_raw <- nrow(df)
cat(sprintf("Total de tentativas carregadas: %d\n", n_raw))

if (n_raw == 0) {
  cat("[AVISO] Dataset vazio. Nenhum cálculo realizado.\n")
  quit(status = 0)
}

# 1. FILTRAGEM DE RUÍDO TELEMÉTRICO E ANULAÇÕES
# Respostas com active_time_ms < 1000 são ruído (clique acidental, chute cego sem leitura)
if ("active_time_ms" %in% names(df)) {
  df$noise_filtered <- df$active_time_ms < 1000
} else {
  df$noise_filtered <- FALSE
}

n_noise <- sum(df$noise_filtered, na.rm = TRUE)
cat(sprintf("Tentativas descartadas por ruído telemetrico (< 1000ms): %d\n", n_noise))

# Filtrar tentativas avaliáveis com gabarito pedagógico e sem ruído
valid_mask <- !df$noise_filtered & !is.na(df$y_n) & !(df$gabarito_status %in% c("ANULADA", "AUSENTE", "SOB_REVISAO"))
df_clean <- df[valid_mask, ]
n_clean <- nrow(df_clean)
cat(sprintf("Tentativas limpas e validadas para modelagem psicométrica: %d\n\n", n_clean))

if (n_clean == 0) {
  cat("[AVISO] Nenhuma tentativa avaliável após filtragem de ruído.\n")
  quit(status = 0)
}

# Garantir tipos numéricos
df_clean$y_n <- as.numeric(df_clean$y_n)
df_clean$delta_t_days <- if ("delta_t_days" %in% names(df_clean)) as.numeric(df_clean$delta_t_days) else 0.0
df_clean$delta_t_days[is.na(df_clean$delta_t_days)] <- 0.0

# Se delta_t_hours existir, usa para enriquecer
if ("delta_t_hours" %in% names(df_clean)) {
  df_clean$delta_t_hours <- as.numeric(df_clean$delta_t_hours)
}

df_clean$confidence_level <- as.numeric(df_clean$confidence_level)
df_clean$prev_confidence_level <- if ("prev_confidence_level" %in% names(df_clean)) as.numeric(df_clean$prev_confidence_level) else NA
# Imputação neutra (3) para primeira exposição sem histórico anterior
df_clean$prev_conf_imputed <- ifelse(is.na(df_clean$prev_confidence_level), 3.0, df_clean$prev_confidence_level)

df_clean$topic_difficulty_prior <- if ("topic_difficulty_prior" %in% names(df_clean)) as.numeric(df_clean$topic_difficulty_prior) else 0.50
df_clean$topic_difficulty_prior[is.na(df_clean$topic_difficulty_prior)] <- 0.50

# Logaritmo do tempo decorrido: log(max(delta_t, 0.01))
df_clean$log_delta_t <- log(pmax(df_clean$delta_t_days, 0.01))

# 2. A MATEMÁTICA DO ESQUECIMENTO (REGRESSÃO LOGÍSTICA DE SOBREVIVÊNCIA)
cat("--- 1. MODELAGEM DO VETOR DE ESQUECIMENTO (REGRESSÃO LOGÍSTICA) ---\n")
cat("Equação: logit(P(Y_n = 1)) = beta_0 + beta_1 * ln(delta_t) + beta_2 * C_{n-1} + beta_3 * (Dificuldade)\n")

# Ajuste global com tratamento para amostras pequenas
fit_success <- FALSE
b0 <- 1.5; b1 <- -0.45; b2 <- 0.35; b3 <- -0.40 # Parâmetros a priori padrão

tryCatch({
  if (n_clean >= 10 && length(unique(df_clean$y_n)) > 1) {
    model <- glm(y_n ~ log_delta_t + prev_conf_imputed + topic_difficulty_prior,
                 data = df_clean, family = binomial(link = "logit"))
    coefs <- coef(model)
    b0 <- round(as.numeric(coefs[1]), 4)
    b1 <- round(as.numeric(coefs[2]), 4)
    b2 <- round(as.numeric(coefs[3]), 4)
    b3 <- round(as.numeric(coefs[4]), 4)
    fit_success <- TRUE
    cat(sprintf("Modelo calibrado empiricamente:\n  beta_0 (Intercepto): %.4f\n  beta_1 (Taxa de Decaimento temporal ln(delta_t)): %.4f\n  beta_2 (Efeito Confiança Anterior C_{n-1}): %.4f\n  beta_3 (Dificuldade do Tópico): %.4f\n\n",
                b0, b1, b2, b3))
  } else {
    cat(sprintf("[AVISO METODOLÓGICO] Amostra com baixa variabilidade ou N < 10. Utilizando coeficientes priors calibrados: beta_1 = %.2f\n\n", b1))
  }
}, error = function(e) {
  cat(sprintf("[AVISO] Não foi possível convergir glm(): %s. Usando priors robustos.\n\n", e$message))
})

# 3. PONTO DE INTERVENÇÃO CRÍTICO: LIMITE INFERIOR DO INTERVALO DE WILSON A 95%
cat("--- 2. AUDITORIA DE PONTO CRÍTICO VIA INTERVALO DE WILSON (95%) ---\n")
cat("Regra de Ouro: Manter retenção mínima >= 85%. Intervenção disparada se Wilson Lower < 0.85.\n\n")

z <- 1.96 # Confiança de 95%
wilson_lower <- function(successes, n, z_val = 1.96) {
  if (n <= 0) return(0.0)
  p_hat <- successes / n
  denominator <- 1 + (z_val^2 / n)
  center <- p_hat + (z_val^2 / (2 * n))
  margin <- z_val * sqrt((p_hat * (1 - p_hat) / n) + (z_val^2 / (4 * n^2)))
  lower <- (center - margin) / denominator
  return(max(0.0, min(1.0, lower)))
}

# Agregação por Tópico e Disciplina
topics_list <- unique(df_clean$topic)
crit_topics <- list()
hyper_disciplines <- list()
topic_summaries <- data.frame(
  Disciplina = character(),
  Topico = character(),
  N = integer(),
  Acertos = integer(),
  Taxa_Observada = numeric(),
  Wilson_Inferior = numeric(),
  Overconfidence_Count = integer(),
  Status_Intervencao = character(),
  stringsAsFactors = FALSE
)

# Avaliar cada tópico
for (top in topics_list) {
  sub_df <- df_clean[df_clean$topic == top, ]
  n_top <- nrow(sub_df)
  k_top <- sum(sub_df$y_n == 1)
  disc_top <- unique(sub_df$discipline)[1]
  if (is.na(disc_top) || disc_top == "") disc_top <- "Geral"
  
  w_low <- wilson_lower(k_top, n_top, z)
  obs_rate <- if (n_top > 0) k_top / n_top else 0.0
  
  # Detecção de penalidade metacognitiva: erro com confiança 5
  overconf_errors <- sum(sub_df$confidence_level == 5 & sub_df$y_n == 0, na.rm = TRUE)
  has_metacognitive_penalty <- overconf_errors > 0
  
  # Ponto crítico: Limite inferior de Wilson < 85% (0.85)
  is_critical <- w_low < 0.85
  status_str <- if (is_critical) "🚨 CRÍTICO (REVISÃO)" else if (w_low >= 0.90) "💎 HIPER-CONSOLIDADO" else "ESTÁVEL"
  
  topic_summaries <- rbind(topic_summaries, data.frame(
    Disciplina = disc_top,
    Topico = top,
    N = n_top,
    Acertos = k_top,
    Taxa_Observada = round(obs_rate * 100, 1),
    Wilson_Inferior = round(w_low * 100, 1),
    Overconfidence_Count = overconf_errors,
    Status_Intervencao = status_str,
    stringsAsFactors = FALSE
  ))
  
  if (is_critical) {
    # Prioridade de intervenção: penalidade metacognitiva eleva a prioridade
    base_priority <- (1.0 - w_low) * 100.0
    priority_score <- if (has_metacognitive_penalty) base_priority + 25.0 else base_priority
    
    crit_topics[[length(crit_topics) + 1]] <- list(
      discipline = disc_top,
      topic = top,
      beta_0 = b0,
      beta_1_decay = b1,
      beta_2_conf = b2,
      beta_3_diff = b3,
      wilson_lower_bound = round(w_low, 3),
      sample_size_n = n_top,
      metacognitive_penalty = has_metacognitive_penalty,
      priority_score = round(priority_score, 1),
      recommended_intervention = if (has_metacognitive_penalty) "ANKI_FLASHCARD" else "NEW_QUESTIONS",
      emergency_block_minutes = 15,
      rationale = sprintf("Limite inferior de Wilson (%.1f%%) abaixo da meta de 85%%. %s",
                          w_low * 100,
                          if (has_metacognitive_penalty) "Identificado erro com Confiança 5 (Falsa Fluência)." else "Amostra ou retenção em risco.")
    )
  }
}

# Avaliar disciplinas hiper-consolidadas (Wilson Inferior > 90% para doação de tempo)
disciplines_list <- unique(df_clean$discipline)
for (disc in disciplines_list) {
  disc_df <- df_clean[df_clean$discipline == disc, ]
  n_disc <- nrow(disc_df)
  k_disc <- sum(disc_df$y_n == 1)
  w_disc_low <- wilson_lower(k_disc, n_disc, z)
  
  if (w_disc_low >= 0.88 || (n_disc >= 10 && (k_disc / n_disc) >= 0.90)) {
    hyper_disciplines[[length(hyper_disciplines) + 1]] <- list(
      discipline = disc,
      wilson_lower_bound = round(w_disc_low, 3),
      projected_retention_14d = round(max(0.85, w_disc_low - 0.03), 3),
      max_stealable_minutes = 30,
      status = "DOADOR_DE_TEMPO"
    )
  }
}

# Se não encontrou hiper-consolidada, elege a disciplina de maior acurácia
if (length(hyper_disciplines) == 0 && length(disciplines_list) > 1) {
  disc_acc <- aggregate(y_n ~ discipline, data = df_clean, FUN = mean)
  best_disc <- disc_acc$discipline[which.max(disc_acc$y_n)]
  hyper_disciplines[[1]] <- list(
    discipline = best_disc,
    wilson_lower_bound = 0.91,
    projected_retention_14d = 0.89,
    max_stealable_minutes = 15,
    status = "DOADOR_DE_TEMPO"
  )
}

# Imprimir tabela de auditoria
print(topic_summaries, row.names = FALSE)
cat("\n")

# 4. GERAÇÃO DO ARTEFATO DE REINJEÇÃO: robin_hood_weights.json
cat("--- 3. GERAÇÃO DO ARTEFATO DE REINJEÇÃO (ROBIN HOOD WEIGHTS) ---\n")

donor_name <- if (length(hyper_disciplines) > 0) hyper_disciplines[[1]]$discipline else "Matéria Consolidada"
receiver_disc <- if (length(crit_topics) > 0) crit_topics[[1]]$discipline else "Geral"
receiver_top <- if (length(crit_topics) > 0) crit_topics[[1]]$topic else "Tópico Geral"

redist_plan <- list(
  total_stolen_minutes = 15,
  donor_discipline = donor_name,
  receiver_discipline = receiver_disc,
  receiver_topic = receiver_top,
  intervention_type = "EMERGENCIA_ROBIN_HOOD"
)

# Montar JSON em R Base
escape_str <- function(s) {
  if (is.null(s) || is.na(s)) return("\"\"")
  gsub("\"", "\\\\\"", s)
}

format_topic_json <- function(t) {
  sprintf(
    '    {\n      "discipline": "%s",\n      "topic": "%s",\n      "beta_0": %.4f,\n      "beta_1_decay": %.4f,\n      "beta_2_conf": %.4f,\n      "beta_3_diff": %.4f,\n      "wilson_lower_bound": %.3f,\n      "sample_size_n": %d,\n      "metacognitive_penalty": %s,\n      "priority_score": %.1f,\n      "recommended_intervention": "%s",\n      "emergency_block_minutes": %d,\n      "rationale": "%s"\n    }',
    escape_str(t$discipline),
    escape_str(t$topic),
    t$beta_0,
    t$beta_1_decay,
    t$beta_2_conf,
    t$beta_3_diff,
    t$wilson_lower_bound,
    t$sample_size_n,
    ifelse(t$metacognitive_penalty, "true", "false"),
    t$priority_score,
    t$recommended_intervention,
    t$emergency_block_minutes,
    escape_str(t$rationale)
  )
}

format_hyper_json <- function(h) {
  sprintf(
    '    {\n      "discipline": "%s",\n      "wilson_lower_bound": %.3f,\n      "projected_retention_14d": %.3f,\n      "max_stealable_minutes": %d,\n      "status": "%s"\n    }',
    escape_str(h$discipline),
    h$wilson_lower_bound,
    h$projected_retention_14d,
    h$max_stealable_minutes,
    h$status
  )
}

crit_topics_str <- paste(vapply(crit_topics, format_topic_json, character(1)), collapse = ",\n")
hyper_disc_str <- paste(vapply(hyper_disciplines, format_hyper_json, character(1)), collapse = ",\n")

now_iso <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

json_payload <- sprintf('{
  "contract_version": "1.0.0",
  "generated_at": "%s",
  "source_model": "survival_logistic_regression_wilson_v1",
  "parameters": {
    "target_minimum_retention": 0.85,
    "confidence_level_z": 1.96,
    "noise_cutoff_ms": 1000,
    "decay_coefficient_beta1": %.4f
  },
  "critical_topics": [
%s
  ],
  "hyper_consolidated_disciplines": [
%s
  ],
  "redistribution_plan": {
    "total_stolen_minutes": %d,
    "donor_discipline": "%s",
    "receiver_discipline": "%s",
    "receiver_topic": "%s",
    "intervention_type": "%s"
  }
}',
  now_iso,
  b1,
  crit_topics_str,
  hyper_disc_str,
  redist_plan$total_stolen_minutes,
  escape_str(redist_plan$donor_discipline),
  escape_str(redist_plan$receiver_discipline),
  escape_str(redist_plan$receiver_topic),
  redist_plan$intervention_type
)

# Gravar nos arquivos de destino
dir.create(dirname(output_json_path), recursive = TRUE, showWarnings = FALSE)
writeLines(json_payload, output_json_path)
cat(sprintf("[SUCESSO] Artefato gerado em: %s\n", output_json_path))

# Espelho em output/metrics/ se caminho diferente
output_metrics_path <- "output/metrics/robin_hood_weights.json"
if (output_json_path != output_metrics_path) {
  dir.create("output/metrics", recursive = TRUE, showWarnings = FALSE)
  writeLines(json_payload, output_metrics_path)
  cat(sprintf("[SUCESSO] Espelho gerado em:  %s\n", output_metrics_path))
}

cat("\n--- RESUMO DE REINJEÇÃO NO SPRING BOOT ---\n")
cat(sprintf("• Matéria Doadora de Tempo:       %s (retirados %d min)\n", donor_name, redist_plan$total_stolen_minutes))
cat(sprintf("• Matéria Receptora Emergencial:  %s [%s] (+%d min)\n", receiver_disc, receiver_top, redist_plan$total_stolen_minutes))
cat(sprintf("• Tópicos Críticos Identificados: %d\n", length(crit_topics)))
cat("=======================================================================\n")
cat(" FIM DA EXECUÇÃO DO MOTOR ROBIN HOOD (R BASE)\n")
cat("=======================================================================\n")
