# tests/test_validation.R
# Testes Unitários de Validação e Integridade

# 1. Testes de Entradas Vazias e Nulas
null_q_res <- validate_questions_dataset(NULL)
assert_false(null_q_res$is_valid, "validate_questions_dataset rejeita entrada NULL")
assert_equal(null_q_res$summary$blocking_errors, 1, "NULL em questoes gera 1 erro bloqueante")

empty_q_res <- validate_questions_dataset(data.frame())
assert_false(empty_q_res$is_valid, "validate_questions_dataset rejeita dataframe vazio")

null_evt_res <- validate_events_dataset(NULL)
assert_false(null_evt_res$is_valid, "validate_events_dataset rejeita entrada NULL")

empty_evt_res <- validate_events_dataset(data.frame())
assert_false(empty_evt_res$is_valid, "validate_events_dataset rejeita dataframe vazio")

# 2. Testes de Colunas Obrigatórias Faltantes
incomplete_q <- data.frame(enunciado = "Teste", stringsAsFactors = FALSE)
inc_q_res <- validate_questions_dataset(incomplete_q)
assert_false(inc_q_res$is_valid, "Rejeita catalogo de questoes sem question_id e disciplina")

incomplete_evt <- data.frame(event_id = "e1", event_type = "STUDY_SESSION_STARTED", stringsAsFactors = FALSE)
inc_evt_res <- validate_events_dataset(incomplete_evt)
assert_false(inc_evt_res$is_valid, "Rejeita eventos sem session_id e occurred_at")

# 3. Teste com Fixture de Questões Válida
q_fixture <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
valid_q_res <- validate_questions_dataset(q_fixture)
assert_true(valid_q_res$is_valid, "Fixture valid_questions.csv e considerada valida")
assert_equal(valid_q_res$summary$blocking_errors, 0, "Zero erros bloqueantes no catalogo valido")

# 4. Teste com Fixture de Eventos Válida
evt_fixture <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
valid_evt_res <- validate_events_dataset(evt_fixture, q_fixture)
assert_true(valid_evt_res$is_valid, "Fixture valid_events.csv e considerada valida")
assert_equal(valid_evt_res$summary$blocking_errors, 0, "Zero erros bloqueantes nos eventos validos")
assert_equal(valid_evt_res$summary$attempt_events, 12, "Detectou exatamente 12 tentativas de resposta na fixture valida")

# 5. Teste com Fixture de Eventos Inválida (Edge Cases)
inv_fixture <- utils::read.csv("tests/fixtures/invalid_events.csv", stringsAsFactors = FALSE)
inv_res <- validate_events_dataset(inv_fixture, q_fixture)
assert_false(inv_res$is_valid, "Fixture invalid_events.csv e corretamente rejeitada com is_valid == FALSE")
assert_true(inv_res$summary$blocking_errors >= 4, "Detectou múltiplos erros bloqueantes na fixture invalida")

# 6. Testes Específicos de Regras de Integridade
rule_codes <- inv_res$issues$rule_code
assert_true("INVALID_DATE_FORMAT" %in% rule_codes, "Detectou data invalida (DATA_INVALIDA_2026)")
assert_true("INVALID_CONFIDENCE_RANGE" %in% rule_codes, "Detectou nivel de confianca fora da escala (6)")
assert_true("NEGATIVE_ACTIVE_TIME" %in% rule_codes, "Detectou tempo ativo negativo (-4500)")
assert_true("DUPLICATE_EVENT_ID" %in% rule_codes, "Detectou identificador de evento duplicado (inv-02)")
assert_true("MISSING_QUESTION_ID_IN_ATTEMPT" %in% rule_codes, "Detectou tentativa sem question_id")
assert_true("SUSPICIOUS_SUB_SECOND_TIME" %in% rule_codes, "Detectou tempo sub-segundo como warning (500ms)")
assert_true("ATTEMPT_ON_ANNULLED_QUESTION" %in% rule_codes, "Detectou tentativa em questao anulada (q009)")
assert_true("UNKNOWN_QUESTION_REFERENCE" %in% rule_codes, "Detectou referencia a questao nao cadastrada (q999)")

# 7. Testes de Regras Adicionadas (Gabarito, Procedência, Inversão Cronológica, Divergência Lógica)
# 7.1 Gabarito com valor inválido
bad_q <- data.frame(
  question_id = "q_bad",
  enunciado = "Texto",
  disciplina = "Direito",
  correct_option = "X",
  stringsAsFactors = FALSE
)
bad_q_res <- validate_questions_dataset(bad_q)
assert_true("INVALID_CORRECT_OPTION_VALUE" %in% bad_q_res$issues$rule_code, "Detectou gabarito com opcao invalida (X)")

# 7.2 Ano anômalo de procedência
bad_year_q <- data.frame(
  question_id = "q_yr",
  enunciado = "Texto",
  disciplina = "Direito",
  ano = 1950,
  stringsAsFactors = FALSE
)
bad_year_res <- validate_questions_dataset(bad_year_q)
assert_true("ANOMALOUS_PROVENANCE_YEAR" %in% bad_year_res$issues$rule_code, "Detectou ano anomalamente antigo (1950)")

# 7.3 Alternativa selecionada inválida
bad_opt_evt <- data.frame(
  event_id = "e_opt",
  event_type = "ANSWER_SUBMITTED",
  session_id = "s1",
  question_id = "q001",
  occurred_at = "2026-10-12T10:00:00Z",
  selected_option = "Z",
  is_correct = TRUE,
  stringsAsFactors = FALSE
)
bad_opt_res <- validate_events_dataset(bad_opt_evt)
assert_true("INVALID_SELECTED_OPTION" %in% bad_opt_res$issues$rule_code, "Detectou alternativa selecionada fora de A-E (Z)")

# 7.4 Inversão cronológica de sessão
inverted_sess_evt <- data.frame(
  event_id = c("e_s", "e_e"),
  event_type = c("STUDY_SESSION_STARTED", "STUDY_SESSION_ENDED"),
  session_id = c("s_inv", "s_inv"),
  occurred_at = c("2026-10-12T15:00:00Z", "2026-10-12T14:00:00Z"),
  stringsAsFactors = FALSE
)
inv_sess_res <- validate_events_dataset(inverted_sess_evt)
assert_false(inv_sess_res$is_valid, "Rejeita sessao com encerramento anterior ao inicio")
assert_true("SESSION_CHRONOLOGY_INCONSISTENCY" %in% inv_sess_res$issues$rule_code, "Identificou SESSION_CHRONOLOGY_INCONSISTENCY")

# 7.5 Divergência lógica entre resposta e gabarito
mismatch_evt <- data.frame(
  event_id = "e_mismatch",
  event_type = "ANSWER_SUBMITTED",
  session_id = "s1",
  question_id = "q001",
  occurred_at = "2026-10-12T10:00:00Z",
  selected_option = "A",
  is_correct = FALSE, # q001 tem correct_option == 'A', logo is_correct FALSE e inconsistente!
  stringsAsFactors = FALSE
)
mismatch_res <- validate_events_dataset(mismatch_evt, q_fixture)
assert_true("INCONSISTENT_ANSWER_EVALUATION" %in% mismatch_res$issues$rule_code, "Detectou divergencia entre gabarito e is_correct")

