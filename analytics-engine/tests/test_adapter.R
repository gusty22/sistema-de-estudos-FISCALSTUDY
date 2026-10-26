# tests/test_adapter.R
# Testes Unitários do Adaptador de Contratos Operacionais
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

source("R/adapter.R", local = FALSE)

# 1. Testes de Validação do Arquivo Operacional
val_null <- validate_operational_export(NULL)
assert_false(val_null$is_valid, "validate_operational_export rejeita NULL")
assert_equal(val_null$summary$blocking_errors, 1L, "NULL gera 1 erro bloqueante")

val_empty <- validate_operational_export(data.frame())
assert_false(val_empty$is_valid, "validate_operational_export rejeita dataframe vazio")

# Dataset sem colunas essenciais
bad_cols_df <- data.frame(outro_campo = 1:5)
val_bad_cols <- validate_operational_export(bad_cols_df)
assert_false(val_bad_cols$is_valid, "Rejeita dataset sem colunas obrigatorias da exportacao")
assert_equal(val_bad_cols$issues$rule_code[1], "MISSING_REQUIRED_COLUMNS", "Identificou MISSING_REQUIRED_COLUMNS")

# Dataset com confiança fora de [1, 5]
invalid_conf_df <- data.frame(
  question_id = "1",
  selected_option = "A",
  is_correct = TRUE,
  gabarito_status = "DEFINITIVO",
  confidence_level = 6, # Inválido
  active_time_ms = 15000,
  stringsAsFactors = FALSE
)
val_bad_conf <- validate_operational_export(invalid_conf_df)
assert_false(val_bad_conf$is_valid, "Rejeita confianca fora do dominio [1, 5]")
assert_true("INVALID_CONFIDENCE_RANGE" %in% val_bad_conf$issues$rule_code, "Identificou INVALID_CONFIDENCE_RANGE")

# Dataset com tempo ativo negativo
neg_time_df <- data.frame(
  question_id = "1",
  selected_option = "A",
  is_correct = TRUE,
  gabarito_status = "DEFINITIVO",
  confidence_level = 4,
  active_time_ms = -500, # Inválido
  stringsAsFactors = FALSE
)
val_neg_time <- validate_operational_export(neg_time_df)
assert_false(val_neg_time$is_valid, "Rejeita tempo ativo negativo")
assert_true("NEGATIVE_ACTIVE_TIME" %in% val_neg_time$issues$rule_code, "Identificou NEGATIVE_ACTIVE_TIME")

# 2. Testes de Adaptação sobre Exportação Operacional Real Copiada
op_file <- "data/raw/operational_export_v1.csv"
if (file.exists(op_file)) {
  op_raw <- utils::read.csv(op_file, stringsAsFactors = FALSE)
  val_real <- validate_operational_export(op_raw)
  assert_true(val_real$is_valid, "Exportacao operacional real e estruturalmente valida")
  assert_equal(val_real$summary$blocking_errors, 0L, "Zero erros bloqueantes na exportacao real")
  
  adapted <- adapt_operational_attempts(op_raw)
  assert_equal(adapted$metadata$total_attempts, 20L, "Processou exatamente 20 registros operacionais")
  assert_equal(adapted$metadata$evaluable_attempts, 19L, "Identificou 19 tentativas avaliaveis com gabarito")
  assert_equal(adapted$metadata$non_evaluable_attempts, 1L, "Segregou 1 tentativa nao-aveliavel (q14 gabarito ausente)")
  assert_equal(adapted$metadata$pedagogical_correct, 13L, "Contabilizou 13 acertos pedagogicos")
  assert_equal(adapted$metadata$concurso_official_score, 13L, "Pontuacao de concurso calculada corretamente")
  assert_false(adapted$metadata$temporal_data_present, "Reconhece ausencia de dados temporais sem injetar datas ficticias")
  
  # Verificar normalização de colunas
  att_df <- adapted$attempts_df
  assert_true("disciplina" %in% names(att_df), "Traduziu discipline para disciplina")
  assert_true("banca" %in% names(att_df), "Traduziu board para banca")
  assert_true("ano" %in% names(att_df), "Traduziu year para ano")
  assert_true(all(is.na(att_df$occurred_at)), "Preservou occurred_at como NA transparente")
  
  # Verificar catálogo extraído
  cat_df <- adapted$questions_df
  assert_equal(nrow(cat_df), 20L, "Extraiu catalogo com 20 questoes unicas")
  assert_true("question_id" %in% names(cat_df), "question_id presente no catalogo")
  assert_true("disciplina" %in% names(cat_df), "disciplina presente no catalogo")
}

# Trace preservation: these are synthetic contract fixtures, not personal evidence.
trace_df <- data.frame(
  event_id = c("attempt-real-101", "attempt-real-102"),
  session_id = c("session-1", "session-2"),
  occurred_at = c("2026-10-10T10:00:00.125Z", "2026-10-12T10:00:00Z"),
  origin_type = c("AUTOMATED_TEST", "UNKNOWN"),
  question_id = c("trace-1", "trace-1"), selected_option = c("A", "B"),
  is_correct = c(TRUE, FALSE), gabarito_status = c("DEFINITIVO", "DEFINITIVO"),
  confidence_level = c(5, NA), active_time_ms = c(15000, 18000),
  fsrs_retrievability_pre_update = c(0.91, 0.42),
  fsrs_model_version = c("FSRS-6.0-default-core-no-fuzz", "FSRS-6.0-default-core-no-fuzz"),
  fsrs_prediction_timestamp = c("2026-10-10T09:59:00Z", "2026-10-12T09:59:00Z"),
  fsrs_evidence_status = c("UNCALIBRATED_ITEM_ESTIMATE", "UNCALIBRATED_ITEM_ESTIMATE"),
  stringsAsFactors = FALSE
)
traced <- adapt_operational_attempts(trace_df, declared_provenance = "SYNTHETIC_FIXTURE")
for (field in c("event_id", "session_id", "occurred_at", "origin_type", "fsrs_retrievability_pre_update", "fsrs_prediction_timestamp", "fsrs_model_version", "fsrs_evidence_status")) {
  assert_equal(traced$attempts_df[[field]], trace_df[[field]], paste("Preserves observed trace:", field))
}
assert_equal(traced$attempts_df$fsrs_retrievability_pre_update, c(0.91, 0.42), "Preserves FSRS pre-update probability without recomputation")
assert_equal(traced$attempts_df$fsrs_model_version, rep("FSRS-6.0-default-core-no-fuzz", 2), "Preserves the recorded FSRS implementation version")
assert_equal(traced$attempts_df$fsrs_prediction_timestamp, c("2026-10-10T09:59:00Z", "2026-10-12T09:59:00Z"), "Preserves the FSRS prediction timestamp")
assert_equal(traced$attempts_df$fsrs_evidence_status, rep("UNCALIBRATED_ITEM_ESTIMATE", 2), "Preserves the estimate calibration status")
assert_true(traced$metadata$temporal_data_present, "Existing timestamps are recognized")
assert_true(traced$metadata$temporal_data_complete, "Complete timestamps retain complete coverage")
assert_equal(traced$metadata$temporal_observations, 2L, "Temporal denominator is explicit")
assert_true(traced$metadata$identity_data_complete, "Existing event and session identities are complete")
assert_false(traced$metadata$is_real_student_data, "Trace presence does not convert fixtures to personal study")
assert_true(all(is.na(traced$questions_df$enunciado)), "Adapter does not fabricate question source text")
assert_true("CONFIDENCE_ABSENT" %in% traced$validation$issues$rule_code, "Missing confidence remains an explicit gap")

legacy_df <- trace_df[, setdiff(names(trace_df), c("event_id", "session_id", "occurred_at", "origin_type", "fsrs_retrievability_pre_update", "fsrs_prediction_timestamp", "fsrs_model_version", "fsrs_evidence_status"))]
legacy <- adapt_operational_attempts(legacy_df)
for (field in c("event_id", "session_id", "occurred_at", "origin_type", "fsrs_retrievability_pre_update", "fsrs_prediction_timestamp", "fsrs_model_version", "fsrs_evidence_status")) {
  assert_true(all(is.na(legacy$attempts_df[[field]])), paste("Legacy omission remains unknown:", field))
}
assert_true(all(is.na(legacy$attempts_df$fsrs_retrievability_pre_update)), "Legacy exports do not acquire fabricated FSRS estimates")
assert_false(legacy$metadata$temporal_data_present, "Legacy exports do not acquire synthetic timestamps")
assert_false(legacy$metadata$identity_data_complete, "Legacy exports do not acquire synthetic identity")
assert_false(legacy$metadata$can_generate_student_profile, "Missing origin cannot establish a personal profile")

partial_df <- trace_df
partial_df$occurred_at[2] <- NA_character_
partial <- adapt_operational_attempts(partial_df)
assert_true(partial$metadata$temporal_data_present, "Partial time coverage is present")
assert_false(partial$metadata$temporal_data_complete, "Partial time coverage is not complete")
assert_equal(partial$metadata$temporal_observations, 1L, "Partial temporal denominator is explicit")

bad_trace <- trace_df
bad_trace$occurred_at[2] <- "not-a-date"
assert_false(validate_operational_export(bad_trace)$is_valid, "Malformed observed timestamps block adaptation")
bad_trace <- trace_df
bad_trace$event_id[2] <- bad_trace$event_id[1]
assert_false(validate_operational_export(bad_trace)$is_valid, "Duplicate known attempt identities cannot duplicate evidence")

missing_key <- trace_df
missing_key$gabarito_status[1] <- NA_character_
assert_true(is.na(adapt_operational_attempts(missing_key)$attempts_df$is_correct[1]), "Missing answer-key status is not silently definitive")
