# R/evaluate_operational.R
# Script de AvaliaÃ§Ã£o AnalÃ­tica de ExportaÃ§Ã£o Operacional Real
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

suppressPackageStartupMessages({
  source("R/validation.R")
  source("R/descriptive_analysis.R")
  source("R/retention_analysis.R")
  source("R/learning_profile.R")
  source("R/analytical_signals.R")
  source("R/adapter.R")
  source("R/baselines.R")
})

run_operational_evaluation <- function(export_path = "data/raw/operational_export_v1.csv",
                                       output_json = "output/metrics/operational_data_evaluation_v1.json") {
  cat("========================================================================\n")
  cat("       FISCALSTUDY ANALYTICS â AVALIACAO DE DADOS E CONTRATOS           \n")
  cat("========================================================================\n\n")
  
  if (!file.exists(export_path)) {
    cat(sprintf("Arquivo operacional '%s' nao encontrado.\n", export_path))
    cat("Status: INSUFFICIENT_EVIDENCE (Nenhum dado operacional disponivel).\n")
    return(invisible(NULL))
  }
  
  cat(sprintf("[1/5] Carregando arquivo de exportacao: %s\n", export_path))
  raw_df <- utils::read.csv(export_path, stringsAsFactors = FALSE)
  
  # 1. ValidaÃ§Ã£o Estrutural da ExportaÃ§Ã£o
  cat("\n[2/5] Validando integridade do contrato estrutural...\n")
  val_op <- validate_operational_export(raw_df)
  cat(sprintf("  - Total de registros: %d | Erros bloqueantes: %d | Avisos: %d\n",
              val_op$summary$total_rows, val_op$summary$blocking_errors, val_op$summary$warnings))
  
  if (!val_op$is_valid) {
    stop("Exportacao invalida estruturalmente. Abortando avaliacao.")
  }
  
  # 2. AdaptaÃ§Ã£o dos Dados com Auditoria Estrita de ProcedÃªncia
  cat("\n[3/5] Auditando procedencia e adaptando esquema operacional...\n")
  manifest_obj <- NULL
  cand_manifest <- file.path(dirname(export_path), "export_manifest.json")
  if (file.exists(cand_manifest)) {
    if (requireNamespace("jsonlite", quietly = TRUE)) {
      manifest_obj <- tryCatch(jsonlite::fromJSON(cand_manifest, simplifyVector = FALSE), error = function(e) NULL)
      if (!is.null(manifest_obj)) {
        cat(sprintf("  - Manifesto detectado:         %s\n", cand_manifest))
      }
    }
  }
  decl_prov <- if (!is.null(manifest_obj) && !is.null(manifest_obj$declared_origin) && manifest_obj$declared_origin == "REAL_STUDY") "PROVEN_OPERATIONAL" else NULL
  adapted <- adapt_operational_attempts(raw_df, declared_provenance = decl_prov, file_path = export_path, manifest = manifest_obj)
  attempts <- adapted$evaluable_attempts_df
  catalog <- adapted$questions_df
  meta <- adapted$metadata
  
  cat(sprintf("  - Procedencia detectada:       %s\n", meta$data_provenance))
  cat(sprintf("  - E dado de estudante real?:   %s\n", if (isTRUE(meta$is_real_student_data)) "SIM (AUTENTICADO)" else "NAO (AMOSTRA/DEMO)"))
  cat(sprintf("  - Veredito da auditoria:       %s\n", meta$provenance_verdict))
  if (!meta$is_real_student_data) {
    cat("  >>> [BLOQUEIO EPISTEMICO]: Amostra identificada como dados de exemplo/demonstracao.\n")
    cat("  >>> [SALVAGUARDA]: PROIBIDO apresentar estas metricas como aprendizado real do estudante.\n")
  }
  
  cat(sprintf("  - Tentativas totais:           %d\n", meta$total_attempts))
  cat(sprintf("  - Tentativas avaliaveis:       %d\n", meta$evaluable_attempts))
  cat(sprintf("  - Tentativas nao-avaliaveis:   %d (segregadas do denominador)\n", meta$non_evaluable_attempts))
  cat(sprintf("  - Questoes anuladas:           %d\n", meta$annulled_count))
  cat(sprintf("  - Pontuacao oficial concurso:  %d pontos (%d acertos + %d anuladas)\n",
              meta$concurso_official_score, meta$pedagogical_correct, meta$annulled_count))
  
  # 3. MÃ©tricas Descritivas e de CalibraÃ§Ã£o
  cat("\n[4/5] Executando analise estatistica e calibracao...\n")
  perf_overall <- calculate_performance_overall(attempts)
  perf_disc <- calculate_performance_by_discipline(attempts, catalog)
  time_res <- calculate_time_metrics(attempts)
  conf_res <- calculate_confidence_metrics(attempts)
  
  # Baselines
  base_hist <- calculate_baseline_historical_mean(attempts)
  base_disc <- calculate_baseline_topic_mean(attempts, catalog)
  base_ma <- calculate_baseline_moving_average(attempts, window_size = 5L)
  
  # ComparaÃ§Ã£o de calibraÃ§Ã£o subjetiva contra baseline histÃ³rico
  y_true <- as.numeric(attempts$is_correct == TRUE)
  y_pred_user <- conf_res$accuracy_by_level$expected_probability[attempts$confidence_level]
  y_pred_base <- base_hist$predict(attempts)
  model_comp <- evaluate_model_vs_baseline(y_true, y_pred_user, y_pred_base)
  
  # Auditoria de Modelos AvanÃ§ados
  bkt_audit <- assess_advanced_model_viability("BKT", n_attempts = meta$evaluable_attempts, n_items = nrow(catalog), n_students = 1L)
  irt_audit <- assess_advanced_model_viability("IRT", n_attempts = meta$evaluable_attempts, n_items = nrow(catalog), n_students = 1L)
  ret_audit <- assess_advanced_model_viability("SPACED_RETENTION", n_attempts = meta$evaluable_attempts, n_items = nrow(catalog), n_students = 1L)
  
  # 4. ConsolidaÃ§Ã£o do Pacote Estruturado
  cat("\n[5/5] Consolidando relatorio estruturado...\n")
  
  student_learning_status <- if (isTRUE(meta$is_real_student_data)) "EVALUATED" else "PENDING_AUTHENTICATED_OPERATIONAL_DATA"
  evidence_status <- if (!isTRUE(meta$is_real_student_data)) {
    paste0("UNVERIFIED_DATA_PROVENANCE (", meta$data_provenance, ")")
  } else if (meta$evaluable_attempts < 30) {
    "INSUFFICIENT_EVIDENCE_FOR_ADVANCED_MODELS"
  } else {
    "SUFFICIENT_DESCRIPTIVE_EVIDENCE"
  }
  
  result_package <- list(
    evaluation_version = "1.1.0",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    evaluation_type = if (isTRUE(meta$is_real_student_data)) "OPERATIONAL_REAL_EVALUATION" else "SAMPLE_CONTRACT_EVALUATION",
    data_provenance = meta$data_provenance,
    is_real_student_data = meta$is_real_student_data,
    student_learning_status = student_learning_status,
    provenance_audit_verdict = meta$provenance_verdict,
    provenance_reasons = meta$provenance_reasons,
    provenance_warnings = meta$provenance_warnings,
    operational_source_file = export_path,
    evidence_status = evidence_status,
    data_summary = meta,
    performance_pedagogical = list(
      overall_accuracy = perf_overall$accuracy,
      accuracy_ci_lower = perf_overall$accuracy_ci_lower,
      accuracy_ci_upper = perf_overall$accuracy_ci_upper,
      effective_denominator = perf_overall$denominator_text,
      by_discipline = perf_disc
    ),
    active_time = list(
      n_valid_times = time_res$n_valid_times,
      median_sec = time_res$median_sec,
      mean_sec = time_res$mean_sec,
      sd_sec = time_res$sd_sec,
      iqr_sec = time_res$iqr_sec,
      min_sec = time_res$min_sec,
      max_sec = time_res$max_sec,
      outliers_detected = time_res$outliers_detected
    ),
    metrological_calibration = list(
      n_observations = conf_res$n_observations,
      brier_score = conf_res$brier_score,
      ece = conf_res$ece,
      prob_mapping_used = conf_res$prob_mapping_used,
      conversion_hypothesis = conf_res$conversion_hypothesis,
      overconfidence_count = conf_res$overconfidence_count,
      overconfidence_rate = conf_res$overconfidence_rate_in_level5,
      underconfidence_count = conf_res$underconfidence_count,
      underconfidence_rate = conf_res$underconfidence_rate_in_low_conf,
      accuracy_by_confidence_level = conf_res$accuracy_by_level,
      methodological_cautions = conf_res$methodological_cautions
    ),
    simple_baselines = list(
      historical_mean = list(
        predicted_prob = base_hist$predicted_prob,
        ci_lower = base_hist$ci_lower,
        ci_upper = base_hist$ci_upper
      ),
      smoothed_topic_means = base_disc$topic_table,
      moving_average_recency = list(
        window_size = base_ma$window_size,
        current_estimate = base_ma$current_estimate,
        rolling_series = base_ma$rolling_series
      ),
      calibration_vs_historical_baseline = model_comp
    ),
    advanced_models_prerequisites_audit = list(
      bkt = bkt_audit,
      irt = irt_audit,
      spaced_retention = ret_audit
    ),
    methodological_cautions = c(
      meta$methodological_cautions,
      if (!isTRUE(meta$is_real_student_data)) "BLOQUEIO EPISTEMICO: Amostra demonstrativa de contrato. PROIBIDO atribuir como perfil pessoal do estudante." else NULL,
      sprintf("Amostra observada N = %d < 30: diagnosticos estritamente descritivos.", meta$evaluable_attempts),
      "Nao imputar causalidade pedagogica nem treinar parametros latentes sem dados suficientes."
    )
  )
  result_package$methodological_cautions <- result_package$methodological_cautions[!sapply(result_package$methodological_cautions, is.null)]
  
  dir.create(dirname(output_json), showWarnings = FALSE, recursive = TRUE)
  if (requireNamespace("jsonlite", quietly = TRUE)) {
    writeLines(jsonlite::toJSON(result_package, pretty = TRUE, auto_unbox = TRUE), con = output_json, useBytes = TRUE)
    cat(sprintf("Relatorio estruturado salvo em: %s\n", output_json))
  }
  
  cat("\n========================================================================\n")
  cat("                    RESULTADO DA AVALIACAO                              \n")
  cat("========================================================================\n")
  cat(sprintf("Procedencia dos Dados:  %s (%s)\n",
              meta$data_provenance, if (isTRUE(meta$is_real_student_data)) "DADOS REAIS AUTENTICADOS" else "AMOSTRA / DEMO (NAO E ESTUDANTE REAL)"))
  cat(sprintf("Status de Aprendizado:  %s\n", student_learning_status))
  cat(sprintf("Status Amostral:        %s\n", evidence_status))
  cat(sprintf("Acuracia da Amostra:    %.2f%% [IC 95%% Wilson: %.1f%% - %.1f%%]\n",
              perf_overall$accuracy * 100, perf_overall$accuracy_ci_lower * 100, perf_overall$accuracy_ci_upper * 100))
  cat(sprintf("Denominador Efetivo:    %s\n", perf_overall$denominator_text))
  cat(sprintf("Pontuacao Concurso:     %d pontos\n", meta$concurso_official_score))
  cat(sprintf("Tempo Mediano Ativo:    %.1f segundos (Med: %.1fs | Max: %.1fs)\n",
              time_res$median_sec, time_res$mean_sec, time_res$max_sec))
  cat(sprintf("Indice Brier:           %.4f (sob hipotese parametrica {1:0.20..5:0.95})\n", conf_res$brier_score))
  cat(sprintf("Erro Calibracao ECE:    %.4f (com vies amostral positivo para N < 30)\n", conf_res$ece))
  cat(sprintf("Superconfianca (Conf 5):%d erro(s) em questoes respondidas com confianca 5 (%.1f%%)\n",
              conf_res$overconfidence_count, conf_res$overconfidence_rate_in_level5 * 100))
  cat(sprintf("Baseline Historico:     p_base = %.4f | Brier Skill Score = %+.4f\n",
              base_hist$predicted_prob, model_comp$brier_skill_score))
  cat("Modelos Avancados:      NENHUM VIAVEL (BKT: Requer N>=30 por habilidade; IRT: N=1 inviavel sem parÃ¢metros fixos da banca)\n")
  cat("========================================================================\n")
  
  invisible(result_package)
}

if (!interactive()) {
  args <- commandArgs(trailingOnly = TRUE)
  in_file <- if (length(args) > 0) args[1] else "data/raw/operational_export_v1.csv"
  out_file <- if (length(args) > 1) args[2] else "output/metrics/operational_data_evaluation_v1.json"
  run_operational_evaluation(in_file, out_file)
}
