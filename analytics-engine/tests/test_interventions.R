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
assert_equal(eval_insuf$declared_evaluated_count, 1L, "Uma intervencao declara desfecho posterior")
assert_equal(eval_insuf$evaluated_count, 0L, "Sem evento correspondente nao ha desfecho verificado")
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

post_fixture <- data.frame(
  event_id = expanded_int$post_assessment_event_id,
  event_type = rep("ANSWER_SUBMITTED", 8),
  question_id = paste0("synthetic-question-", 1:8),
  occurred_at = rep("2026-10-11T12:00:00Z", 8),
  is_correct = expanded_int$post_outcome == "CORRECT",
  gabarito_status = rep("DEFINITIVO", 8), origin_type = rep("AUTOMATED_TEST", 8),
  stringsAsFactors = FALSE
)
eval_sufficient <- evaluate_intervention_recommendations(expanded_int, post_fixture, min_eval_sample = 5L)
assert_equal(eval_sufficient$evaluation_status, "OBSERVATIONAL_EVALUATION_COMPLETED", "Oito eventos vinculados permitem apenas resumo observacional")
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


# Adversarial event-link tests: all records are synthetic regression fixtures.
assert_false(eval_sufficient$can_apply, "Followup summary never authorizes a planner action")
assert_false(eval_sufficient$is_validated, "Linked outcomes do not establish empirical efficacy")
assert_equal(eval_sufficient$transfer_status, "NOT_ESTABLISHED", "Declared new-item label does not prove transfer")
assert_equal(eval_sufficient$assessment_type_status, "DECLARED_NOT_INDEPENDENTLY_VERIFIED",
             "Assessment type retains its unverified declaration status")
assert_true(all(eval_sufficient$followup_audit$link_status == "VERIFIED_EVENT_LINK"),
            "Every counted outcome points to an unambiguous later answer event")
bad_post <- post_fixture
bad_post$occurred_at[1] <- expanded_int$occurred_at[1]
before_eval <- evaluate_intervention_recommendations(expanded_int, bad_post)
assert_equal(before_eval$evaluated_count, 7L, "Simultaneous outcome is not a proven subsequent assessment")
assert_equal(before_eval$followup_audit$link_status[1], "ASSESSMENT_NOT_STRICTLY_AFTER",
             "Temporal violation has an explicit reason")
bad_post <- post_fixture
bad_post$is_correct[1] <- FALSE
mismatch <- evaluate_intervention_recommendations(expanded_int, bad_post)
assert_equal(mismatch$evaluated_count, 7L, "Declared success cannot override an actual incorrect answer")
assert_equal(mismatch$followup_audit$link_status[1], "DECLARED_OUTCOME_DISAGREES_WITH_EVENT",
             "Contradictory event outcome is identified")
duplicate_post <- rbind(post_fixture, post_fixture[1, ])
assert_equal(evaluate_intervention_recommendations(expanded_int, duplicate_post)$evaluated_count, 7L,
             "Duplicated event identity cannot inflate followup evidence")
shared <- expanded_int
shared$post_assessment_event_id[2] <- shared$post_assessment_event_id[1]
shared_result <- evaluate_intervention_recommendations(shared, post_fixture)
assert_equal(shared_result$evaluated_count, 6L, "One followup reused by two interventions is not counted twice")
assert_true(all(shared_result$followup_audit$link_status[1:2] == "ASSESSMENT_REUSED_ACROSS_INTERVENTIONS"),
            "All ambiguous shared links are rejected rather than choosing an arbitrary owner")
bad_post <- post_fixture
bad_post$gabarito_status[1] <- "ANULADA"
assert_equal(evaluate_intervention_recommendations(expanded_int, bad_post)$evaluated_count, 7L,
             "Annulled event cannot evaluate an intervention")
bad_post <- post_fixture
bad_post$occurred_at[1] <- "2026-10-11 12:00:00"
assert_equal(evaluate_intervention_recommendations(expanded_int, bad_post)$evaluated_count, 7L,
             "Naive timestamp is not silently converted to UTC")
bad_post <- post_fixture
bad_post$event_type[1] <- "QUESTION_PRESENTED"
assert_equal(evaluate_intervention_recommendations(expanded_int, bad_post)$evaluated_count, 7L,
             "Presentation event is not an evaluated response")
wrong_lag <- expanded_int
wrong_lag$post_assessment_lag_hours <- 777
lag_result <- evaluate_intervention_recommendations(wrong_lag, post_fixture)
assert_equal(lag_result$followup_audit$observed_lag_hours, rep(24, 8),
             "Observed lag derives from actual recorded timestamps")
assert_equal(lag_result$followup_audit$declared_lag_hours, rep(777, 8),
             "Original declared lag remains auditable")
bad_id <- expanded_int
bad_id$intervention_id[2] <- bad_id$intervention_id[1]
assert_equal(evaluate_intervention_recommendations(bad_id, post_fixture)$evaluation_status,
             "INVALID_INTERVENTION_DATA", "Duplicate intervention IDs fail validation")
assert_equal(evaluate_intervention_recommendations(NULL)$evaluation_status, "NO_DATA",
             "Empty intervention input remains a no-data state")
