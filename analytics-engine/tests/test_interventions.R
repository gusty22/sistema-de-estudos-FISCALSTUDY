# tests/test_interventions.R
# Testes Unitários de Intervenções Pedagógicas e Avaliação de Recomendações
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

source("R/intervention_analysis.R", local = FALSE)
source("R/recommendation_evaluation.R", local = FALSE)

# 1. Testes de Validação com Entradas Nulas e Vazias
val_null <- validate_interventions_dataset(NULL)
assert_false(val_null$is_valid, "validate_interventions_dataset rejeita NULL")
assert_equal(val_null$summary$blocking_errors, 1L, "NULL gera 1 erro bloqueante")

val_empty <- validate_interventions_dataset(data.frame())
assert_false(val_empty$is_valid, "validate_interventions_dataset rejeita dataframe vazio")

# 2. Teste de Colunas Obrigatórias Ausentes
incomplete_df <- data.frame(intervention_id = "int-1", session_id = "s-1")
val_incomp <- validate_interventions_dataset(incomplete_df)
assert_false(val_incomp$is_valid, "Rejeita dataframe sem colunas obrigatorias")
assert_true(any(val_incomp$issues$rule_code == "MISSING_REQUIRED_COLUMNS"), "Identificou MISSING_REQUIRED_COLUMNS")

# 3. Teste com Fixture Sintética Válida
valid_int <- utils::read.csv("tests/fixtures/valid_interventions.csv", stringsAsFactors = FALSE)
val_valid <- validate_interventions_dataset(valid_int)
assert_true(val_valid$is_valid, "Fixture valid_interventions.csv e considerada valida")
assert_equal(val_valid$summary$blocking_errors, 0L, "Zero erros bloqueantes nas intervencoes validas")
assert_equal(val_valid$summary$total_rows, 3L, "Processou exatamente 3 intervencoes validas")

# 4. Teste com Fixture Sintética Inválida
invalid_int <- utils::read.csv("tests/fixtures/invalid_interventions.csv", stringsAsFactors = FALSE)
val_invalid <- validate_interventions_dataset(invalid_int)
assert_false(val_invalid$is_valid, "Fixture invalid_interventions.csv e rejeitada")
assert_true(val_invalid$summary$blocking_errors >= 5L, "Detectou multiplos erros bloqueantes na fixture invalida")

rules_found <- val_invalid$issues$rule_code
assert_true("DUPLICATE_INTERVENTION_ID" %in% rules_found, "Detectou intervencao com ID duplicado")
assert_true("NEGATIVE_OR_NA_TIME" %in% rules_found, "Detectou tempo de intervencao negativo")
assert_true("INVALID_DATE_FORMAT" %in% rules_found, "Detectou timestamp invalido")
assert_true("INVALID_ACTIVITY_DOMAIN" %in% rules_found, "Detectou atividade fora do dominio permitido")
assert_true("INVALID_POST_OUTCOME" %in% rules_found, "Detectou desfecho posterior invalido")
assert_true(val_invalid$has_warnings, "Detectou warnings na fixture invalida")
assert_true("SUSPICIOUSLY_SHORT_TIME" %in% rules_found, "Detectou tempo suspeitosamente curto (< 5s) como warning")

# 5. Teste de Avaliação de Recomendações com Amostra Insuficiente
eval_insuf <- evaluate_intervention_recommendations(valid_int, min_eval_sample = 5L)
assert_equal(eval_insuf$evaluation_status, "INSUFFICIENT_EVIDENCE", "Amostra com N < 5 retorna explicitamente INSUFFICIENT_EVIDENCE")
assert_equal(eval_insuf$total_interventions, 3L, "Total de 3 intervencoes identificado")
assert_equal(eval_insuf$evaluated_count, 1L, "Apenas 1 intervencao possui desfecho avaliado (demais pendentes)")
assert_true(length(eval_insuf$methodological_cautions) >= 3, "Advertencias metodologicas retornadas explicitamente")

# 6. Teste de Avaliação de Recomendações com Amostra Suficiente Sintética
expanded_int <- data.frame(
  intervention_id = paste0("int-exp-", 1:8),
  session_id = rep("sess-1", 8),
  occurred_at = rep("2026-10-10T12:00:00Z", 8),
  observed_problem = rep("SIG_OVERCONFIDENCE_ERROR", 8),
  recommended_activity = c(rep("REVIEW_COMMENTED_SOLUTION", 4), rep("CONTRASTIVE_ANALYSIS", 4)),
  justification = rep("Justificativa de teste", 8),
  method_used = c(rep("ELABORATIVE_FEEDBACK", 4), rep("ACTIVE_RECALL", 4)),
  consulted_material = rep("item:q001", 8),
  time_spent_ms = rep(120000, 8),
  immediate_outcome = rep("CORRECT", 8),
  post_assessment_event_id = paste0("evt-post-", 1:8),
  post_assessment_type = c("SAME_QUESTION", "SAME_QUESTION", "SAME_TOPIC_NEW_QUESTION", "SAME_TOPIC_NEW_QUESTION",
                          "SAME_QUESTION", "SAME_QUESTION", "SAME_TOPIC_NEW_QUESTION", "SAME_TOPIC_NEW_QUESTION"),
  post_assessment_lag_hours = rep(24.0, 8),
  post_outcome = c("CORRECT", "CORRECT", "INCORRECT", "CORRECT",
                  "CORRECT", "CORRECT", "CORRECT", "CORRECT"),
  stringsAsFactors = FALSE
)

eval_sufficient <- evaluate_intervention_recommendations(expanded_int, min_eval_sample = 5L)
assert_equal(eval_sufficient$evaluation_status, "EVALUATION_COMPLETED", "Com N=8 status e EVALUATION_COMPLETED")
assert_equal(eval_sufficient$evaluated_count, 8L, "8 intervencoes avaliadas")
assert_true(nrow(eval_sufficient$activity_evaluation) == 2L, "Avaliou 2 atividades distintas")
assert_true(nrow(eval_sufficient$method_evaluation) == 2L, "Avaliou 2 metodos distintos")

# Testar separação obrigatória entre mesma questão e questão nova
rec_type <- eval_sufficient$recovery_rate_by_type
assert_equal(rec_type$same_question$n, 4L, "4 avaliacoes foram em SAME_QUESTION")
assert_equal(rec_type$same_question$k, 4L, "4 acertos em SAME_QUESTION (100%)")
assert_equal(rec_type$same_question$rate, 1.0, "Taxa em mesma questao e 1.0")

assert_equal(rec_type$novel_question$n, 4L, "4 avaliacoes foram em SAME_TOPIC_NEW_QUESTION")
assert_equal(rec_type$novel_question$k, 3L, "3 acertos em SAME_TOPIC_NEW_QUESTION (75%)")
assert_equal(rec_type$novel_question$rate, 0.75, "Taxa em questoes novas e 0.75")
assert_true(rec_type$novel_question$ci_lower > 0, "IC lower para questoes novas e valido")
assert_true(rec_type$novel_question$ci_upper <= 1.0, "IC upper para questoes novas e valido")

# Verificar preservação de advertências contra causalidade automática
has_causality_warning <- any(grepl("causalidade", eval_sufficient$methodological_cautions, ignore.case = TRUE))
assert_true(has_causality_warning, "Advertencia expressa contra atribuicao automatica de causalidade preservada")
