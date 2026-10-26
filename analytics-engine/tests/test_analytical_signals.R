# tests/test_analytical_signals.R
# Testes Unitários do Módulo de Sinais Analíticos
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

source("R/learning_profile.R", local = FALSE)
source("R/analytical_signals.R", local = FALSE)

# 1. Teste de Sinal com Perfil Nulo ou Vazio
signals_null <- detect_analytical_signals(NULL)
assert_equal(signals_null$signals_count, 1L, "Perfil nulo gera exatamente 1 sinal")
assert_equal(signals_null$signals[[1]]$signal_id, "SIG_NO_VALID_DATA", "Sinal gerado e SIG_NO_VALID_DATA")
assert_false(signals_null$signals[[1]]$is_heuristic, "SIG_NO_VALID_DATA nao e heuristico")

# 2. Teste com Fixture Sintética Válida
valid_events <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
valid_questions <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
val_evt <- validate_events_dataset(valid_events, valid_questions)

profile_valid <- build_learning_profile(
  valid_events[valid_events$event_type == "ANSWER_SUBMITTED", ],
  valid_questions,
  validation_result = val_evt
)

signals_res <- detect_analytical_signals(profile_valid, valid_events, valid_questions)
assert_true(signals_res$signals_count > 0, "Detectou sinais analiticos na fixture valida")

# Verificar estrutura de todos os sinais gerados
req_fields <- c("signal_id", "signal_type", "description", "evidence_summary",
                "n_observations", "period_start", "period_end", "applied_criterion",
                "is_heuristic", "limitations", "method_version")

for (s in signals_res$signals) {
  missing_f <- setdiff(req_fields, names(s))
  assert_true(length(missing_f) == 0, sprintf("Sinal %s satisfaz contrato de campos obrigatorios", s$signal_id))
  assert_true(length(s$limitations) > 0, sprintf("Sinal %s possui limitacoes metodologicas explicitas", s$signal_id))
}

# 3. Teste do Sinal de Superconfiança (evt-04 errou q004 com conf 5)
sig_ids <- vapply(signals_res$signals, function(x) x$signal_id, character(1))
assert_true("SIG_OVERCONFIDENCE_ERROR" %in% sig_ids, "Detectou sinal SIG_OVERCONFIDENCE_ERROR")
overconf_sig <- signals_res$signals[[which(sig_ids == "SIG_OVERCONFIDENCE_ERROR")]]
assert_equal(overconf_sig$signal_type, "HIGH_CONFIDENCE_ERROR", "Tipo do sinal e HIGH_CONFIDENCE_ERROR")
assert_false(overconf_sig$is_heuristic, "Superconfianca e definicao metrologica exata, nao heuristica arbitraria")

# 4. Teste do Sinal de Evidência Insuficiente em Tópicos
has_low_evid <- any(grepl("^SIG_INSUFFICIENT_EVIDENCE_", sig_ids))
assert_true(has_low_evid, "Detectou sinal de evidencia insuficiente em topicos com N < 10")

# 5. Teste de Detecção de Erros Recorrentes Sintéticos
recurrent_events <- valid_events
# Forçar uma questão q002 errada mais uma vez
recurrent_events <- rbind(recurrent_events, data.frame(
  event_id = "evt-rec-01",
  event_type = "ANSWER_SUBMITTED",
  session_id = "sess-2",
  question_id = "q002",
  occurred_at = "2026-10-11T16:00:00Z",
  selected_option = "D",
  is_correct = FALSE, # segundo erro na mesma questão
  confidence_level = 3,
  active_time_ms = 40000,
  stringsAsFactors = FALSE
))
rec_profile <- build_learning_profile(recurrent_events[recurrent_events$event_type == "ANSWER_SUBMITTED", ], valid_questions)
rec_signals <- detect_analytical_signals(rec_profile, recurrent_events, valid_questions)
rec_sig_ids <- vapply(rec_signals$signals, function(x) x$signal_id, character(1))

assert_true("SIG_RECURRENT_ERROR_Q_q002" %in% rec_sig_ids, "Detectou erro recorrente na questao q002")
q002_sig <- rec_signals$signals[[which(rec_sig_ids == "SIG_RECURRENT_ERROR_Q_q002")]]
assert_equal(q002_sig$signal_type, "RECURRENT_ERROR", "Tipo do sinal de erro e RECURRENT_ERROR")
assert_true(q002_sig$is_heuristic, "Identificado como heuristico provisorio")

# 6. Teste de Detecção de Tempos Sub-segundo Sintéticos
subsec_events <- valid_events
subsec_events <- rbind(subsec_events, data.frame(
  event_id = "evt-sub-01",
  event_type = "ANSWER_SUBMITTED",
  session_id = "sess-2",
  question_id = "q008",
  occurred_at = "2026-10-11T16:10:00Z",
  selected_option = "B",
  is_correct = TRUE,
  confidence_level = 1,
  active_time_ms = 500, # 500ms
  stringsAsFactors = FALSE
))
sub_profile <- build_learning_profile(subsec_events[subsec_events$event_type == "ANSWER_SUBMITTED", ], valid_questions)
sub_signals <- detect_analytical_signals(sub_profile, subsec_events, valid_questions)
sub_sig_ids <- vapply(sub_signals$signals, function(x) x$signal_id, character(1))

assert_true("SIG_TIME_ANOMALY_SUB_SECOND" %in% sub_sig_ids, "Detectou anomalia de tempo sub-segundo")

# 7. Teste de Configurabilidade Provisória
custom_signals <- detect_analytical_signals(
  rec_profile, recurrent_events, valid_questions,
  config = list(min_recurrent_errors = 5L) # limiar elevado para não disparar com 2
)
custom_sig_ids <- vapply(custom_signals$signals, function(x) x$signal_id, character(1))
assert_false("SIG_RECURRENT_ERROR_Q_q002" %in% custom_sig_ids, "Configuracao customizada de limiar respeitada")
