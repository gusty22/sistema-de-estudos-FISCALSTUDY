# R/export_results.R
# Módulo de Exportação Estruturada de Resultados Analíticos
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Constrói Registro Individual de Métrica com Metadados e Qualidade
#' @param metric_name Nome padronizado da métrica
#' @param definition Definição formal
#' @param value Valor pontual (numérico ou textual)
#' @param ci_lower Limite inferior de confiança (opcional)
#' @param ci_upper Limite superior de confiança (opcional)
#' @param n_observations Quantidade de observações
#' @param period_start Timestamp inicial
#' @param period_end Timestamp final
#' @param method_version Versão do algoritmo
#' @param limitations Vetor de limitações metodológicas
#' @param quality_flags Vetor de flags de integridade
#' @return Lista representando o registro estruturado
build_metric_record <- function(metric_name, definition, value,
                                ci_lower = NA_real_, ci_upper = NA_real_,
                                n_observations = 0L,
                                period_start = NA_character_, period_end = NA_character_,
                                method_version = "v1.0.0",
                                limitations = character(0),
                                quality_flags = character(0),
                                q25 = NA_real_, q75 = NA_real_) {
  list(
    metric_name = as.character(metric_name),
    definition = as.character(definition),
    value = value,
    ci_lower = if (!is.na(ci_lower)) round(as.numeric(ci_lower), 4) else NULL,
    ci_upper = if (!is.na(ci_upper)) round(as.numeric(ci_upper), 4) else NULL,
    q25 = if (!is.na(q25)) as.numeric(q25) else NULL,
    q75 = if (!is.na(q75)) as.numeric(q75) else NULL,
    n_observations = as.integer(n_observations),
    period_start = as.character(period_start),
    period_end = as.character(period_end),
    method_version = as.character(method_version),
    limitations = as.list(limitations),
    quality_flags = as.list(quality_flags)
  )
}

#' Consolida Pacote de Métricas Analíticas
#' @param overall_res Resultado de calculate_performance_overall
#' @param time_res Resultado de calculate_time_metrics
#' @param conf_res Resultado de calculate_confidence_metrics
#' @param retention_res Resultado de calculate_retention_metrics
#' @param validation_res Resultado de validate_events_dataset
#' @param period_start Timestamp de início
#' @param period_end Timestamp de término
#' @return Lista consolidada de métricas prontas para serialização
consolidate_analytics_metrics <- function(overall_res, time_res, conf_res, retention_res,
                                          validation_res, period_start, period_end) {
  
  quality_flags <- c()
  if (validation_res$is_valid) {
    quality_flags <- c(quality_flags, "VALID_DATA", "NO_BLOCKING_ERRORS")
  } else {
    quality_flags <- c(quality_flags, "HAS_BLOCKING_ERRORS")
  }
  if (validation_res$has_warnings) {
    quality_flags <- c(quality_flags, paste0("WARNINGS_COUNT_", validation_res$summary$warnings))
  }
  
  metrics <- list()
  
  # 1. Acurácia Global
  acc_lims <- c("Denominador observado obrigatorio")
  if (overall_res$n_attempts < 30) {
    acc_lims <- c(acc_lims, "Amostra pequena (N < 30); interpretar intervalo com cautela")
  }
  metrics[[length(metrics) + 1]] <- build_metric_record(
    metric_name = "overall_accuracy",
    definition = "Taxa de acertos em relacao ao total de tentativas validas.",
    value = overall_res$accuracy,
    ci_lower = overall_res$accuracy_ci_lower,
    ci_upper = overall_res$accuracy_ci_upper,
    n_observations = overall_res$n_attempts,
    period_start = period_start,
    period_end = period_end,
    method_version = "v1.0.0-wilson_score",
    limitations = acc_lims,
    quality_flags = quality_flags
  )
  
  # 2. Tempo Mediano de Resolução
  time_lims <- c("Tempo de tela em milissegundos; não mede atenção ou carga cognitiva")
  if (time_res$outliers_detected > 0) {
    time_lims <- c(time_lims, sprintf("%d valores extremos identificados (Tukey 1.5x IQR)", time_res$outliers_detected))
  }
  metrics[[length(metrics) + 1]] <- build_metric_record(
    metric_name = "median_active_time_seconds",
    definition = "Mediana do tempo de tela ativo gasto por questao, em segundos.",
    value = time_res$median_sec,
    q25 = time_res$q25_sec,
    q75 = time_res$q75_sec,
    n_observations = time_res$n_valid_times,
    period_start = period_start,
    period_end = period_end,
    method_version = "v1.0.0-nonparametric_median_iqr",
    limitations = time_lims,
    quality_flags = quality_flags
  )
  
  # 3. Brier Score de Calibração
  metrics[[length(metrics) + 1]] <- build_metric_record(
    metric_name = "calibration_brier_score",
    definition = "Indice de Brier ponderado mapeando confianca 1-5 para probabilidade 0.20-1.00.",
    value = conf_res$brier_score,
    n_observations = conf_res$n_observations,
    period_start = period_start,
    period_end = period_end,
    method_version = "v1.0.0-discrete_brier",
    limitations = c("Assume mapeamento linear da escala discreta de 5 opcoes"),
    quality_flags = quality_flags
  )
  
  # 4. Expected Calibration Error (ECE)
  metrics[[length(metrics) + 1]] <- build_metric_record(
    metric_name = "expected_calibration_error_ece",
    definition = "Diferenca media ponderada absoluta entre acuracia observada e confianca declarada em 5 faixas.",
    value = conf_res$ece,
    n_observations = conf_res$n_observations,
    period_start = period_start,
    period_end = period_end,
    method_version = "v1.0.0-5bin_ece",
    limitations = c("Discretizado em 5 bins correspondentes a cada nivel de confianca"),
    quality_flags = quality_flags
  )
  
  # 5. Taxa de Superconfiança (Erros com Confiança 5)
  metrics[[length(metrics) + 1]] <- build_metric_record(
    metric_name = "overconfidence_rate_level5",
    definition = "Proporcao de erros em tentativas respondidas com confianca maxima (nivel 5).",
    value = conf_res$overconfidence_rate_in_level5,
    n_observations = conf_res$n_observations,
    period_start = period_start,
    period_end = period_end,
    method_version = "v1.0.0-level5_error_rate",
    limitations = c("Foco em detectar ilusoes graves de competencia"),
    quality_flags = quality_flags
  )
  
  # 6. Retenção em Repetições
  metrics[[length(metrics) + 1]] <- build_metric_record(
    metric_name = "repeated_items_observed_count",
    definition = "Quantidade de tentativas repetidas da mesma questao registradas.",
    value = retention_res$n_repeated_attempts,
    n_observations = retention_res$n_total_attempts,
    period_start = period_start,
    period_end = period_end,
    method_version = "v1.0.0-exact_item_repetition",
    limitations = retention_res$methodological_cautions,
    quality_flags = quality_flags
  )
  
  list(
    contract_version = "1.0.0",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    metrics_count = length(metrics),
    metrics = metrics
  )
}

#' Exporta Pacote de Métricas para JSON e CSV
#' @param consolidated_package Objeto retornado por consolidate_analytics_metrics
#' @param json_output_path Caminho do arquivo JSON
#' @param csv_output_path Caminho do arquivo CSV
export_metrics_package <- function(consolidated_package, json_output_path, csv_output_path) {
  # 1. Exportação JSON (usando jsonlite se disponível ou serializador nativo)
  dir.create(dirname(json_output_path), showWarnings = FALSE, recursive = TRUE)
  dir.create(dirname(csv_output_path), showWarnings = FALSE, recursive = TRUE)
  
  if (requireNamespace("jsonlite", quietly = TRUE)) {
    json_str <- jsonlite::toJSON(consolidated_package, pretty = TRUE, auto_unbox = TRUE)
    writeLines(json_str, con = json_output_path, useBytes = TRUE)
  }
  
  # 2. Exportação CSV tabular
  metrics_list <- consolidated_package$metrics
  csv_rows <- lapply(metrics_list, function(m) {
    data.frame(
      metric_name = m$metric_name,
      definition = m$definition,
      value = as.character(m$value),
      ci_lower = if (!is.null(m$ci_lower)) as.character(m$ci_lower) else "",
      ci_upper = if (!is.null(m$ci_upper)) as.character(m$ci_upper) else "",
      q25 = if (!is.null(m$q25)) as.character(m$q25) else "",
      q75 = if (!is.null(m$q75)) as.character(m$q75) else "",
      n_observations = m$n_observations,
      period_start = m$period_start,
      period_end = m$period_end,
      method_version = m$method_version,
      limitations = paste(unlist(m$limitations), collapse = "; "),
      quality_flags = paste(unlist(m$quality_flags), collapse = "; "),
      stringsAsFactors = FALSE
    )
  })
  
  csv_df <- do.call(rbind, csv_rows)
  # write.table translates marked strings through LC_CTYPE before writing.
  # Serialize a local UTF-8 byte copy to a binary connection; retain standard
  # CSV quoting/numeric/NA rules without changing the process locale.
  encoded_csv <- csv_df
  for (column in names(encoded_csv)[vapply(encoded_csv,is.character,logical(1))]) {
    values <- enc2utf8(encoded_csv[[column]])
    if (any(!is.na(values) & !validUTF8(values))) stop("Metric text is not valid UTF-8")
    Encoding(values) <- "unknown"
    encoded_csv[[column]] <- values
  }
  connection <- file(csv_output_path,open="wb")
  on.exit(close(connection),add=TRUE)
  utils::write.csv(encoded_csv, file=connection, row.names=FALSE)
  
  invisible(list(json = json_output_path, csv = csv_output_path))
}
