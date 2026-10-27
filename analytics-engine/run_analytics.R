# Resolve an explicitly configured library first; sandbox LOCALAPPDATA may differ.
configured_lib <- Sys.getenv("FISCALSTUDY_R_LIBS", "")
r_ver_short <- paste(R.version$major, strsplit(R.version$minor, "\\.")[[1]][1], sep=".")
user_lib <- file.path(Sys.getenv("USERPROFILE"), "AppData", "Local", "R", "win-library", r_ver_short)
local_app_data_lib <- file.path(Sys.getenv("LOCALAPPDATA"), "R", "win-library", r_ver_short)
for (lib in c(configured_lib, user_lib, local_app_data_lib)) if (nzchar(lib) && dir.exists(lib)) .libPaths(c(lib, .libPaths()))
has_sha256 <- requireNamespace("digest", quietly = TRUE) || (requireNamespace("tools", quietly = TRUE) && exists("sha256sum", envir = asNamespace("tools")))
if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Required package unavailable: jsonlite. Configure FISCALSTUDY_R_LIBS; no outputs were published.")
if (!has_sha256) stop("No cryptographic SHA-256 provider available (neither digest nor tools::sha256sum). Configure FISCALSTUDY_R_LIBS; no outputs were published.")
output_root <- Sys.getenv("FISCALSTUDY_ANALYTICS_OUTPUT", "output")

# run_analytics.R
# Pipeline Principal de Execução Analítica
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

# source(file, encoding=...) transcodes through the native locale, which can
# truncate UTF-8 modules under LC_ALL=C. Parse declared UTF-8 text directly.
source_utf8 <- function(path) {
  contents <- withCallingHandlers(readLines(path,warn=FALSE,encoding="UTF-8"),
    warning=function(w) stop("Invalid UTF-8 R module: ",conditionMessage(w),call.=FALSE))
  if (any(!validUTF8(contents))) stop("R module is not valid UTF-8: ",path)
  expressions <- parse(text=contents,encoding="UTF-8",keep.source=FALSE)
  for (expression in expressions) eval(expression,envir=.GlobalEnv)
  invisible(NULL)
}

suppressPackageStartupMessages({
  source_utf8("R/validation.R")
  source_utf8("R/descriptive_analysis.R")
  source_utf8("R/retention_analysis.R")
  source_utf8("R/retrieval_diagnostics.R")
  source_utf8("R/visualization.R")
  source_utf8("R/export_results.R")
  source_utf8("R/learning_profile.R")
  source_utf8("R/analytical_signals.R")
  source_utf8("R/intervention_analysis.R")
  source_utf8("R/recommendation_evaluation.R")
  source_utf8("R/adapter.R")
  source_utf8("R/baselines.R")
  if (file.exists("R/provenance.R")) source_utf8("R/provenance.R")
})

main <- function() {
  cat("========================================================================\n")
  cat("                 FISCALSTUDY ANALYTICS — PIPELINE EM R                 \n")
  cat("========================================================================\n\n")
  
  args <- commandArgs(trailingOnly = TRUE)
  events_path <- "data/raw/events_v1.csv"
  questions_path <- "data/raw/questions_v1.csv"
  interventions_path <- "data/raw/interventions_v1.csv"
  is_demo <- FALSE
  is_operational_adapted <- FALSE
  data_prov_type <- "UNVERIFIED_SOURCE"
  is_real_data <- FALSE
  provenance_audit <- NULL
  run_id <- Sys.getenv("FISCALSTUDY_RUN_ID", "")
  if (!nzchar(run_id)) run_id <- paste0("manual-", format(Sys.time(), "%Y%m%dT%H%M%OS6", tz = "UTC"), "-", Sys.getpid())
  envelope <- function(value, status = NULL, can_apply = FALSE) {
    value$run_id <- run_id
    value$data_provenance <- data_prov_type
    value$is_real_student_data <- isTRUE(is_real_data)
    value$can_apply <- isTRUE(can_apply)
    value$provenance_audit <- provenance_audit
    value$validation_scope <- if (is_operational_adapted) adapted$metadata$validation_scope else "CANONICAL_EVENT_AND_QUESTION_SCHEMA"
    if (is_operational_adapted) value$catalog_source_verified <- adapted$metadata$catalog_source_verified
    if (!is.null(status)) value$status <- status
    value
  }
  
  # Processamento de argumentos de linha de comando
  if (length(args) == 1 && file.exists(args[1])) {
    # Suporte a arquivo único de exportação operacional
    test_hdr <- read_utf8_csv(args[1], nrows = 1, stringsAsFactors = FALSE)
    if ("gabarito_status" %in% names(test_hdr)) {
      cat(sprintf(">>> Detectada exportacao operacional do FiscalStudy: %s\n", args[1]))
      cat(">>> Auditando procedencia e adaptando esquema via R/adapter.R...\n")
      op_raw <- read_utf8_csv(args[1], stringsAsFactors = FALSE)
      manifest_path <- Sys.getenv("FISCALSTUDY_EXPORT_MANIFEST", "")
      explicit_manifest <- nzchar(manifest_path)
      if (!explicit_manifest) manifest_path <- file.path(dirname(args[1]), "export_manifest.json")
      export_manifest <- NULL
      declared_origin <- NULL
      if (file.exists(manifest_path)) {
        export_manifest <- tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = FALSE),
          error = function(e) stop("Export manifest is not valid JSON: ", conditionMessage(e)))
        if (!is.list(export_manifest) || is.null(names(export_manifest))) stop("Export manifest must be a JSON object")
        declared_origin <- export_manifest$declared_origin
        # REAL_STUDY is a claim to audit, not a substitute for checksum verification.
        if (identical(declared_origin, "REAL_STUDY")) declared_origin <- "PROVEN_OPERATIONAL"
      } else if (explicit_manifest) stop("Configured export manifest does not exist")
      adapted <- adapt_operational_attempts(op_raw, declared_provenance = declared_origin,
        file_path = args[1], manifest = export_manifest)
      events_df <- adapted$attempts_df
      questions_df <- adapted$questions_df
      interventions_df <- NULL
      is_operational_adapted <- TRUE
      data_prov_type <- adapted$metadata$data_provenance
      is_real_data <- adapted$metadata$is_real_student_data
      provenance_audit <- list(verdict = adapted$metadata$provenance_verdict,
        reasons = adapted$metadata$provenance_reasons, warnings = adapted$metadata$provenance_warnings)
      cat(sprintf(">>> [AUDITORIA DE PROCEDENCIA]: Classificado como: %s (%s)\n",
                  data_prov_type, adapted$metadata$provenance_verdict))
      if (!is_real_data) {
        cat(">>> [BLOQUEIO EPISTEMICO]: VEDADO apresentar estas metricas como aprendizado real do estudante.\n\n")
      }
    } else {
      events_path <- args[1]
    }
  } else if (length(args) >= 2) {
    events_path <- args[1]
    questions_path <- args[2]
    if (length(args) >= 3) interventions_path <- args[3]
  } else if (!file.exists(events_path) || !file.exists(questions_path)) {
    if (Sys.getenv("FISCALSTUDY_ALLOW_DEMO", "false") != "true") stop("Operational inputs missing; explicit demo opt-in required")
    # Fallback seguro para fixtures controladas com aviso explícito
    events_path <- "tests/fixtures/valid_events.csv"
    questions_path <- "tests/fixtures/valid_questions.csv"
    interventions_path <- "tests/fixtures/valid_interventions.csv"
    is_demo <- TRUE
  }
  
  if (!is_operational_adapted) {
    if (is_demo) {
      cat(">>> [AVISO CIENTIFICO]: Arquivos operacionais em data/raw/ nao encontrados.\n")
      cat(">>> Executando pipeline com FIXTURES SINTETICAS CONTROLADAS de teste.\n")
      cat(">>> Os resultados abaixo sao meramente demonstrativos e NAO representam\n")
      cat(">>> o aprendizado ou historico real do estudante.\n\n")
    }
    
    cat(sprintf("[1/6] Carregando arquivos de dados:\n  - Eventos:      %s\n  - Questoes:     %s\n", events_path, questions_path))
    if (file.exists(interventions_path)) {
      cat(sprintf("  - Intervencoes: %s\n", interventions_path))
    }
    
    if (!file.exists(events_path) || !file.exists(questions_path)) {
      stop("Arquivos de entrada nao encontrados. Abortando pipeline.")
    }
    
    events_df <- read_utf8_csv(events_path, stringsAsFactors = FALSE)
    questions_df <- read_utf8_csv(questions_path, stringsAsFactors = FALSE)
    interventions_df <- if (file.exists(interventions_path)) read_utf8_csv(interventions_path, stringsAsFactors = FALSE) else NULL
    
    # Anexar metadados de procedência
    prov_evt <- if (is_demo) {
      list(provenance_type = "SYNTHETIC_FIXTURE", is_proven_operational = FALSE, is_real_student_data = FALSE,
           can_generate_student_profile = FALSE, audit_verdict = "FIXTURE_SINTETICA_CONTROLADA",
           reasons = c("Fixture sintetica de teste."), warnings = c("Nao representa estudante real."))
    } else {
      verify_data_provenance(events_df, file_path = events_path)
    }
    attr(events_df, "provenance_info") <- prov_evt
    data_prov_type <- prov_evt$provenance_type
    is_real_data <- prov_evt$is_real_student_data
    provenance_audit <- list(verdict = prov_evt$audit_verdict, reasons = prov_evt$reasons, warnings = prov_evt$warnings)
  }
  
  # 2. Validação e Integridade
  cat("\n[2/6] Executando validacao de esquemas e integridade referencial...\n")
  if (is_operational_adapted) {
    # Use the actual structural audit performed by the adapter, including gaps.
    val_q <- adapted$questions_validation
    val_evt <- adapted$validation
    val_evt$summary$attempt_events <- nrow(events_df)
    val_int <- NULL
  } else {
    val_q <- validate_questions_dataset(questions_df)
    val_evt <- validate_events_dataset(events_df, questions_df)
    val_int <- if (!is.null(interventions_df)) validate_interventions_dataset(interventions_df) else NULL
  }
  
  cat(sprintf("  - Catalogo de Questoes: %d questoes | %d erros bloqueantes | %d avisos\n",
              val_q$summary$total_rows, val_q$summary$blocking_errors, val_q$summary$warnings))
  cat(sprintf("  - Eventos de Estudo:    %d eventos  | %d erros bloqueantes | %d avisos\n",
              val_evt$summary$total_rows, val_evt$summary$blocking_errors, val_evt$summary$warnings))
  if (!is.null(val_int)) {
    cat(sprintf("  - Intervencoes:         %d registros| %d erros bloqueantes | %d avisos\n",
                val_int$summary$total_rows, val_int$summary$blocking_errors, val_int$summary$warnings))
  }
  
  if (!val_q$is_valid || !val_evt$is_valid) {
    cat("\n>>> [ERRO BLOQUEANTE DETECTADO]: Os dados violam o contrato de integridade.\n")
    issues_combined <- rbind(val_q$issues, val_evt$issues)
    blocking_issues <- issues_combined[issues_combined$severity == "BLOCKING_ERROR", ]
    for (i in seq_len(nrow(blocking_issues))) {
      cat(sprintf("    * [%s] Coluna: %s | Linha(s): %s | %s\n",
                  blocking_issues$rule_code[i], blocking_issues$column_name[i],
                  blocking_issues$row_index[i], blocking_issues$message[i]))
    }
    stop("Execucao interrompida para proteger consumidores a jusante.")
  }
  
  # Filtrar apenas tentativas de resposta com gabarito preenchido
  raw_attempts_df <- events_df[events_df$event_type == "ANSWER_SUBMITTED", , drop = FALSE]
  attr(raw_attempts_df, "provenance_info") <- attr(events_df, "provenance_info")
  selection <- select_evaluable_attempts(raw_attempts_df, questions_df)
  attempts_df <- selection$attempts_df
  if (nrow(attempts_df) == 0) {
    cat("\n>>> [COLD START]: Nenhuma tentativa com resultado avaliavel disponivel para inferencia.\n")
    cat(">>> Sem evidencias avaliaveis: nenhuma redistribuicao ou curva de memoria sera inferida.\n")
    
    dir.create(file.path(output_root, "metrics"), showWarnings = FALSE, recursive = TRUE)
    dir.create(file.path(output_root, "figures"), showWarnings = FALSE, recursive = TRUE)
    
    cold_signals <- list(
      signals_count = 1L,
      signals = list(
        list(
          signal_id = "SIG_COLD_START_INSUFFICIENT_EVIDENCE",
          signal_type = "INSUFFICIENT_EVIDENCE",
          description = "Volume amostral insuficiente (0 tentativas registradas). Sistema em modo Cold Start.",
          evidence_summary = "N = 0 tentativas. Nenhum ajuste analitico de pesos foi aplicado.",
          n_observations = 0L,
          period_start = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
          period_end = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
          applied_criterion = "n_attempts == 0",
          is_heuristic = TRUE,
          limitations = list("Aguardando primeiras resolucoes reais de questoes para calibrar modelos de retencao."),
          method_version = "v1.0.0-cold_start"
        )
      )
    )
    
    cold_weights <- list(
      generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      algorithm = "ROBIN_HOOD_ADAPTIVE_CYCLE_V1",
      target_retention_threshold = 0.85,
      disciplines_count = 0L,
      weights = structure(list(), names=character(0)),
      recommendations = list(
        time_theft_donors = list(),
        priority_recipients = list(),
        summary_instruction = "Sem evidencia analitica; o backend mantem suas regras de planejamento existentes."
      ),
      methodological_caution = "Mapa de pesos vazio. Ausencia de dados nao autoriza estimar prioridade ou retention target."
    )
    
    cold_signals <- envelope(cold_signals, "NO_DATA")
    cold_weights <- envelope(cold_weights, "INSUFFICIENT_EVIDENCE")
    if (requireNamespace("jsonlite", quietly = TRUE)) {
      writeLines(jsonlite::toJSON(cold_signals, pretty = TRUE, auto_unbox = TRUE), con = file.path(output_root, "metrics/analytical_signals_v1.json"), useBytes = TRUE)
      writeLines(jsonlite::toJSON(cold_weights, pretty = TRUE, auto_unbox = TRUE), con = file.path(output_root, "metrics/robin_hood_weights.json"), useBytes = TRUE)
    }
    
    cold_retrieval <- calculate_retrieval_surprise(raw_attempts_df)
    cold_retrieval <- envelope(cold_retrieval, cold_retrieval$status, can_apply = FALSE)
    writeLines(jsonlite::toJSON(cold_retrieval, pretty = TRUE, auto_unbox = TRUE), con = file.path(output_root, "metrics/retrieval_surprise_v1.json"), useBytes = TRUE)
    cold_baseline_backtest <- evaluate_baselines_temporally(raw_attempts_df)
    cold_baseline_backtest <- envelope(cold_baseline_backtest, cold_baseline_backtest$status, can_apply = FALSE)
    writeLines(jsonlite::toJSON(cold_baseline_backtest, pretty = TRUE, auto_unbox = TRUE),
               con = file.path(output_root, "metrics/temporal_baseline_backtest_v1.json"), useBytes = TRUE)
    empty_summary <- list(status=if (nrow(raw_attempts_df) == 0) "COLD_START" else "NO_EVALUABLE_EVIDENCE", observed_attempt_count=nrow(raw_attempts_df), n_observations=0L, data_provenance=data_prov_type, is_real_student_data=FALSE, metrics=list(), run_id=run_id, can_apply=FALSE)
    empty_summary <- envelope(empty_summary)
    writeLines(jsonlite::toJSON(empty_summary, pretty=TRUE, auto_unbox=TRUE), con=file.path(output_root,"metrics/metrics_summary_v1.json"), useBytes=TRUE)
    utils::write.csv(data.frame(metric_name="attempt_count", value=0, n_observations=0L), file.path(output_root,"metrics/metrics_summary_v1.csv"), row.names=FALSE)
    writeLines(jsonlite::toJSON(envelope(list(n_observations=0L, observed_attempt_count=nrow(raw_attempts_df), can_generate_student_profile=FALSE), if (nrow(raw_attempts_df) == 0) "NO_DATA" else "NO_EVALUABLE_EVIDENCE"),pretty=TRUE,auto_unbox=TRUE),con=file.path(output_root,"metrics/learning_profile_v1.json"),useBytes=TRUE)
    writeLines(jsonlite::toJSON(envelope(list(evaluation_status="NO_DATA", total_interventions=0L, evaluated_count=0L), "NO_DATA"),pretty=TRUE,auto_unbox=TRUE),con=file.path(output_root,"metrics/intervention_evaluation_v1.json"),useBytes=TRUE)

    cat(">>> Artefatos de Cold Start gravados com sucesso em output/metrics/\n")
    cat("========================================================================\n")
    cat("Pipeline analitico concluido com sucesso sob Cold Start!\n")
    return(invisible(NULL))
  }
  
  # 3. Análise Descritiva, Temporal e Calibração
  cat("\n[3/6] Calculando metricas descritivas, incerteza e calibracao...\n")
  perf_overall <- calculate_performance_overall(attempts_df)
  perf_disc <- calculate_performance_by_discipline(attempts_df, questions_df)
  perf_topic <- calculate_performance_by_topic(attempts_df, questions_df)
  time_metrics <- calculate_time_metrics(attempts_df)
  conf_metrics <- calculate_confidence_metrics(attempts_df)
  temporal_attempts <- attempts_df[!is.na(attempts_df$session_id) & nzchar(trimws(attempts_df$session_id)) & !is.na(attempts_df$occurred_at) & nzchar(trimws(attempts_df$occurred_at)), , drop = FALSE]
  temp_evolution <- calculate_temporal_evolution(temporal_attempts)
  
  period_comp <- NULL
  if (nrow(temp_evolution) >= 2) {
    s1_id <- temp_evolution$session_id[1]
    s2_id <- temp_evolution$session_id[nrow(temp_evolution)]
    s1_sub <- temporal_attempts[temporal_attempts$session_id == s1_id, , drop = FALSE]
    s2_sub <- temporal_attempts[temporal_attempts$session_id == s2_id, , drop = FALSE]
    p1_range <- range(s1_sub$occurred_at, na.rm = TRUE)
    p2_range <- range(s2_sub$occurred_at, na.rm = TRUE)
    period_comp <- compare_performance_periods(
      attempts_df,
      period1_range = p1_range,
      period2_range = p2_range,
      period1_label = paste0("Sessão ", s1_id),
      period2_label = paste0("Sessão ", s2_id)
    )
  }
  
  # 4. Perfil Multidimensional e Sinais Analíticos
  cat("\n[4/6] Construindo perfil de aprendizagem multidimensional e detectando sinais...\n")
  learning_profile <- build_learning_profile(raw_attempts_df, questions_df, validation_result = val_evt)
  analytical_signals <- detect_analytical_signals(learning_profile, attempts_df, questions_df)
  retrieval_diagnostics <- calculate_retrieval_surprise(attempts_df)
  temporal_baseline_backtest <- evaluate_baselines_temporally(attempts_df)
  
  # Avaliação de recomendações/intervenções se disponível
  eval_recs <- NULL
  if (!is.null(interventions_df) && !is.null(val_int) && val_int$is_valid) {
    eval_recs <- evaluate_intervention_recommendations(interventions_df, attempts_df, questions_df, min_eval_sample = 5L)
  }
  
  # 5. Geração de Gráficos em Base R
  cat("\n[5/6] Gerando graficos estatisticos em Base R (PNG)...\n")
  dir.create(file.path(output_root, "figures"), showWarnings = FALSE, recursive = TRUE)
  dir.create(file.path(output_root, "metrics"), showWarnings = FALSE, recursive = TRUE)
  
  fig_acc <- file.path(output_root, "figures/accuracy_evolution.png")
  fig_time <- file.path(output_root, "figures/response_time_distribution.png")
  fig_calib <- file.path(output_root, "figures/calibration_curve.png")
  fig_disc <- file.path(output_root, "figures/discipline_comparison.png")
  fig_evidence <- file.path(output_root, "figures/evidence_volume_landscape.png")
  
  plot_accuracy_evolution(temp_evolution, output_path = fig_acc)
  plot_response_time_distribution(attempts_df, output_path = fig_time)
  plot_calibration_curve(conf_metrics, output_path = fig_calib)
  plot_discipline_comparison(perf_disc, output_path = fig_disc)
  plot_evidence_volume(perf_disc, output_path = fig_evidence)
  
  cat("  - Salvo:", fig_acc, "\n")
  cat("  - Salvo:", fig_time, "\n")
  cat("  - Salvo:", fig_calib, "\n")
  cat("  - Salvo:", fig_disc, "\n")
  cat("  - Salvo:", fig_evidence, "\n")
  
  # 6. Consolidação e Exportação de Métricas Estruturadas
  cat("\n[6/6] Serializando pacotes estruturados (JSON / CSV)...\n")
  valid_times <- events_df$occurred_at[!is.na(events_df$occurred_at) & trimws(events_df$occurred_at) != ""]
  period_start <- if (length(valid_times) > 0) min(valid_times) else NA_character_
  period_end   <- if (length(valid_times) > 0) max(valid_times) else NA_character_
  
  classified_attempts <- classify_attempt_history(attempts_df, questions_df)
  retention_metrics <- calculate_retention_metrics(classified_attempts)
  decay_model <- fit_empirical_decay_model(classified_attempts)
  robin_hood_weights <- calculate_robin_hood_weights(learning_profile, decay_model, analytical_signals)
  
  consolidated_pkg <- consolidate_analytics_metrics(
    overall_res = perf_overall,
    time_res = time_metrics,
    conf_res = conf_metrics,
    retention_res = retention_metrics,
    validation_res = val_evt,
    period_start = period_start,
    period_end = period_end
  )
  
  consolidated_pkg$observed_attempt_count <- nrow(raw_attempts_df)
  consolidated_pkg$evaluable_attempt_count <- nrow(attempts_df)
  consolidated_pkg <- envelope(consolidated_pkg, "OBSERVATIONAL_ANALYSIS")
  learning_profile <- envelope(learning_profile, "OBSERVATIONAL_ANALYSIS")
  analytical_signals <- envelope(analytical_signals, "HEURISTIC_SIGNALS")
  retrieval_diagnostics <- envelope(retrieval_diagnostics, retrieval_diagnostics$status, can_apply = FALSE)
  temporal_baseline_backtest <- envelope(temporal_baseline_backtest, temporal_baseline_backtest$status, can_apply = FALSE)
  robin_hood_weights <- envelope(robin_hood_weights, can_apply = FALSE)
  if (is.null(eval_recs)) eval_recs <- list(evaluation_status = "NO_DATA", total_interventions = 0L, evaluated_count = 0L)
  eval_recs <- envelope(eval_recs, "OBSERVATIONAL_ANALYSIS")

  json_out <- file.path(output_root, "metrics/metrics_summary_v1.json")
  csv_out <- file.path(output_root, "metrics/metrics_summary_v1.csv")
  export_metrics_package(consolidated_pkg, json_out, csv_out)
  
  # Exportar Perfil, Sinais e Pesos Robin Hood
  profile_out <- file.path(output_root, "metrics/learning_profile_v1.json")
  signals_out <- file.path(output_root, "metrics/analytical_signals_v1.json")
  robin_hood_out <- file.path(output_root, "metrics/robin_hood_weights.json")
  if (requireNamespace("jsonlite", quietly = TRUE)) {
    writeLines(jsonlite::toJSON(learning_profile, pretty = TRUE, auto_unbox = TRUE), con = profile_out, useBytes = TRUE)
    writeLines(jsonlite::toJSON(analytical_signals, pretty = TRUE, auto_unbox = TRUE), con = signals_out, useBytes = TRUE)
    writeLines(jsonlite::toJSON(robin_hood_weights, pretty = TRUE, auto_unbox = TRUE), con = robin_hood_out, useBytes = TRUE)
    writeLines(jsonlite::toJSON(retrieval_diagnostics, pretty = TRUE, auto_unbox = TRUE), con = file.path(output_root, "metrics/retrieval_surprise_v1.json"), useBytes = TRUE)
    writeLines(jsonlite::toJSON(temporal_baseline_backtest, pretty = TRUE, auto_unbox = TRUE),
               con = file.path(output_root, "metrics/temporal_baseline_backtest_v1.json"), useBytes = TRUE)
    if (!is.null(eval_recs)) {
      writeLines(jsonlite::toJSON(eval_recs, pretty = TRUE, auto_unbox = TRUE), con = file.path(output_root, "metrics/intervention_evaluation_v1.json"), useBytes = TRUE)
    }
  }
  
  cat("\n========================================================================\n")
  cat("                   RESUMO ESTATISTICO CONSOLIDADO                       \n")
  cat("========================================================================\n")
  cat(sprintf("Procedencia dos Dados:  %s (%s)\n", data_prov_type, if (is_real_data) "ORIGEM PESSOAL DECLARADA, AUDITORIA DE INTEGRIDADE APROVADA" else "ORIGEM NAO VERIFICADA OU FIXTURE (NAO E PERFIL PESSOAL)"))
  cat(sprintf("Status de Aprendizado:  %s\n", if (is_real_data) "OBSERVACOES ANALISADAS; EFICACIA NAO DEMONSTRADA" else "PENDING_AUTHENTICATED_OPERATIONAL_DATA"))
  cat(sprintf("Motor Adaptativo R-Hood:%s (Meta: %.0f%%)\n", robin_hood_weights$algorithm, robin_hood_weights$target_retention_threshold * 100))
  cat(sprintf("Decisao de Alocacao:    %s\n", robin_hood_weights$recommendations$summary_instruction))
  cat(sprintf("Acuracia Global:        %.1f%% [IC 95%% Wilson: %.1f%% - %.1f%%]\n",
              perf_overall$accuracy * 100, perf_overall$accuracy_ci_lower * 100, perf_overall$accuracy_ci_upper * 100))
  cat(sprintf("Denominador Efetivo:    %s\n", perf_overall$denominator_text))
  cat(sprintf("Tempo Ativo Mediano:    %.1f segundos (IQR: %.1fs | %d extremos Tukey)\n",
              time_metrics$median_sec, time_metrics$iqr_sec, time_metrics$outliers_detected))
  cat(sprintf("Indice de Brier:        %.4f (escala discreta mapeada 0.20 a 1.00)\n",
              conf_metrics$brier_score))
  cat(sprintf("Erro de Calibracao ECE: %.4f (ponderado por volume nos 5 bins)\n",
              conf_metrics$ece))
  cat(sprintf("Superconfianca Nivel 5: %d erro(s) em questoes com confianca 5 (%.1f%%)\n",
              conf_metrics$overconfidence_count, conf_metrics$overconfidence_rate_in_level5 * 100))
  cat(sprintf("Repeticoes Observadas:  %d tentativas repetidas da mesma questao\n",
              retention_metrics$n_repeated_attempts))
  cat(sprintf("Sinais Detectados:      %d sinal(is) analitico(s) identificado(s)\n",
              analytical_signals$signals_count))
  for (s in analytical_signals$signals) {
    cat(sprintf("  * [%s] (%s): %s\n", s$signal_id, s$signal_type, s$evidence_summary))
  }
  if (!is.null(eval_recs)) {
    cat(sprintf("Avaliacao Intervencoes: Status: %s (%d de %d avaliadas)\n",
                eval_recs$evaluation_status, eval_recs$evaluated_count, eval_recs$total_interventions))
  }
  if (!is.null(period_comp)) {
    cat(sprintf("Comparacao Periodos:    %s (%.1f%%) vs %s (%.1f%%) -> Delta = %+.1f%% (p = %.4f)\n",
                period_comp$period1$label, period_comp$period1$accuracy * 100,
                period_comp$period2$label, period_comp$period2$accuracy * 100,
                period_comp$delta_accuracy * 100, period_comp$p_value))
    if (period_comp$sample_disparity_flag) {
      cat("                        [AVISO]: Disparidade ou amostra reduzida detectada; cautela na comparacao.\n")
    }
  }
  cat(sprintf("Artefatos Estruturados: %s, %s, %s, %s, %s\n", json_out, csv_out, profile_out, signals_out, robin_hood_out))
  cat("========================================================================\n")
  cat("Pipeline analitico concluido com sucesso!\n")
}

if (!interactive()) {
  main()
}
