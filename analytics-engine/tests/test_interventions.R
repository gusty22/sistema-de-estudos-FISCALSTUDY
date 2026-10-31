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

# ------------------------------------------------------------------------------
# Testes Determinísticos de Integração no Pipeline Analítico (Extensão 1.1.0)
# ------------------------------------------------------------------------------

run_pipeline_eval <- function(args_list, run_id = "test-eval-run") {
  tmp_out <- tempfile("eval-out-")
  dir.create(tmp_out, recursive = TRUE, showWarnings = FALSE)
  log_file <- tempfile(fileext = ".log")
  keys <- c("FISCALSTUDY_ANALYTICS_OUTPUT", "FISCALSTUDY_RUN_ID", "FISCALSTUDY_ALLOW_DEMO")
  old <- Sys.getenv(keys, unset = NA_character_)
  on.exit({
    for (i in seq_along(keys)) {
      if (is.na(old[i])) Sys.unsetenv(keys[i]) else do.call(Sys.setenv, setNames(list(old[i]), keys[i]))
    }
    unlink(tmp_out, recursive = TRUE)
    unlink(log_file)
  }, add = TRUE)
  Sys.setenv(FISCALSTUDY_ANALYTICS_OUTPUT = tmp_out, FISCALSTUDY_RUN_ID = run_id, FISCALSTUDY_ALLOW_DEMO = "true")
  rscript <- file.path(R.home("bin"), if (.Platform$OS.type == "windows") "Rscript.exe" else "Rscript")
  exit <- system2(rscript, c("run_analytics.R", args_list), stdout = log_file, stderr = log_file)
  eval_json_path <- file.path(tmp_out, "metrics/intervention_evaluation_v1.json")
  json_data <- if (file.exists(eval_json_path)) {
    jsonlite::fromJSON(eval_json_path, simplifyVector = FALSE)
  } else {
    NULL
  }
  log_content <- if (file.exists(log_file)) readLines(log_file, warn = FALSE) else character(0)
  list(exit = exit, json = json_data, log = log_content)
}

required_v1_1_fields <- c(
  "evaluation_version", "evaluation_status", "status", "total_interventions",
  "completed_interventions", "pending_evaluation_count", "evaluated_count",
  "declared_evaluated_count", "unverified_followup_count", "is_validated",
  "can_apply", "can_schedule", "transfer_status", "assessment_type_status",
  "intervention_origin_status", "inference_scope", "followup_audit",
  "activity_evaluation", "method_evaluation", "recovery_rate_by_type",
  "methodological_cautions"
)

# 1. Cold Start sem intervenções
res_cold <- run_pipeline_eval(c("tests/fixtures/test_zero_rows.csv"), run_id = "cold-start-eval")
assert_equal(res_cold$exit, 0L, "Pipeline executa com sucesso sob Cold Start")
cold_json <- res_cold$json
assert_true(!is.null(cold_json), "intervention_evaluation_v1.json gerado no Cold Start")
assert_equal(cold_json$evaluation_status, "NO_DATA", "Cold Start evaluation_status e NO_DATA")
assert_equal(cold_json$status, "NO_DATA", "Cold Start status e NO_DATA")
assert_equal(cold_json$evaluation_version, "1.1.0", "Cold Start possui evaluation_version 1.1.0")
assert_false(cold_json$is_validated, "Cold Start is_validated e FALSE")
assert_false(cold_json$can_apply, "Cold Start can_apply e FALSE")
assert_false(cold_json$can_schedule, "Cold Start can_schedule e FALSE")
assert_equal(cold_json$transfer_status, "NOT_ESTABLISHED", "Cold Start transfer_status e NOT_ESTABLISHED")
assert_true(all(required_v1_1_fields %in% names(cold_json)), "Cold Start contem todos os campos da Extensao 1.1.0")

# 2. Fluxo normal sem intervenções (incluindo entrada operacional adaptada de 1 argumento CSV)
res_op <- run_pipeline_eval(c("tests/fixtures/test_cold_start.csv"), run_id = "op-eval-no-int")
assert_equal(res_op$exit, 0L, "Pipeline executa com sucesso para entrada operacional adaptada")
op_json <- res_op$json
assert_true(!is.null(op_json), "intervention_evaluation_v1.json gerado para entrada operacional")
assert_equal(op_json$evaluation_status, "NO_DATA", "Fluxo normal sem intervencoes retorna evaluation_status NO_DATA")
assert_equal(op_json$status, "NO_DATA", "Fluxo normal sem intervencoes retorna status NO_DATA")
assert_equal(op_json$evaluation_version, "1.1.0", "Fluxo normal sem intervencoes possui evaluation_version 1.1.0")
assert_false(op_json$is_validated, "Fluxo normal sem intervencoes is_validated e FALSE")
assert_false(op_json$can_apply, "Fluxo normal sem intervencoes can_apply e FALSE")
assert_false(op_json$can_schedule, "Fluxo normal sem intervencoes can_schedule e FALSE")
assert_equal(op_json$transfer_status, "NOT_ESTABLISHED", "Fluxo normal sem intervencoes transfer_status e NOT_ESTABLISHED")
assert_true(all(required_v1_1_fields %in% names(op_json)), "Fluxo normal sem intervencoes contem todos os campos 1.1.0")

# 3. Intervenções inválidas (tests/fixtures/invalid_interventions.csv) no pipeline run_analytics.R
res_invalid <- run_pipeline_eval(
  c("tests/fixtures/valid_events.csv", "tests/fixtures/valid_questions.csv", "tests/fixtures/invalid_interventions.csv"),
  run_id = "invalid-eval-run"
)
assert_equal(res_invalid$exit, 0L, "Pipeline executa com fixture de intervencoes invalidas")
inv_json <- res_invalid$json
assert_true(!is.null(inv_json), "intervention_evaluation_v1.json gerado com intervencoes invalidas")
assert_equal(inv_json$evaluation_status, "INVALID_INTERVENTION_DATA", "Intervencoes invalidas preservam evaluation_status INVALID_INTERVENTION_DATA")
assert_equal(inv_json$status, "INVALID_INTERVENTION_DATA", "Intervencoes invalidas status coincide com evaluation_status")
assert_true(length(inv_json$validation_issues) > 0L, "validation_issues preservado e nao vazio para dados invalidos")
assert_false(inv_json$is_validated, "Intervencoes invalidas is_validated e FALSE")
assert_false(inv_json$can_apply, "Intervencoes invalidas can_apply e FALSE")
assert_false(inv_json$can_schedule, "Intervencoes invalidas can_schedule e FALSE")
assert_equal(inv_json$transfer_status, "NOT_ESTABLISHED", "Intervencoes invalidas transfer_status e NOT_ESTABLISHED")
assert_equal(inv_json$evaluation_version, "1.1.0", "Intervencoes invalidas mantem evaluation_version 1.1.0")

# 4. Intervenções válidas sem eventos posteriores verificáveis
# Cenário 4a: Eventos sem correspondência para o post_assessment_event_id declarado
evt_valid_raw <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
evt_no_followup <- evt_valid_raw[evt_valid_raw$event_id != "evt-12", ]
tmp_dir_no_followup <- tempfile("no-followup-")
dir.create(tmp_dir_no_followup, recursive = TRUE, showWarnings = FALSE)
evt_no_followup_csv <- file.path(tmp_dir_no_followup, "events_no_followup.csv")
utils::write.csv(evt_no_followup, evt_no_followup_csv, row.names = FALSE)

res_no_post <- run_pipeline_eval(
  c(evt_no_followup_csv, "tests/fixtures/valid_questions.csv", "tests/fixtures/valid_interventions.csv"),
  run_id = "no-followup-eval-run"
)
assert_equal(res_no_post$exit, 0L, "Pipeline executa sem eventos posteriores correspondentes")
no_post_json <- res_no_post$json
assert_true(!is.null(no_post_json), "intervention_evaluation_v1.json gerado sem eventos correspondentes")
assert_equal(no_post_json$evaluation_status, "INSUFFICIENT_EVIDENCE", "Sem eventos verificaveis evaluation_status e INSUFFICIENT_EVIDENCE")
assert_equal(no_post_json$status, "INSUFFICIENT_EVIDENCE", "Sem eventos verificaveis status e INSUFFICIENT_EVIDENCE")
assert_equal(no_post_json$declared_evaluated_count, 1L, "declared_evaluated_count e 1L")
assert_equal(no_post_json$evaluated_count, 0L, "evaluated_count e 0L pois nenhum evento foi verificado")
assert_equal(no_post_json$unverified_followup_count, 1L, "unverified_followup_count e 1L")
unlink(tmp_dir_no_followup, recursive = TRUE)

# Cenário 4b: valid_interventions.csv + valid_events.csv oficiais (amostra < 5)
res_valid_fixtures <- run_pipeline_eval(
  c("tests/fixtures/valid_events.csv", "tests/fixtures/valid_questions.csv", "tests/fixtures/valid_interventions.csv"),
  run_id = "valid-fixtures-eval-run"
)
assert_equal(res_valid_fixtures$exit, 0L, "Pipeline executa com fixtures validas oficiais")
vf_json <- res_valid_fixtures$json
assert_true(!is.null(vf_json), "intervention_evaluation_v1.json gerado para fixtures validas")
assert_equal(vf_json$evaluation_status, "INSUFFICIENT_EVIDENCE", "valid_interventions + valid_events retorna INSUFFICIENT_EVIDENCE")
assert_equal(vf_json$status, "INSUFFICIENT_EVIDENCE", "status coincide com INSUFFICIENT_EVIDENCE")
assert_equal(vf_json$total_interventions, 3L, "total_interventions e 3L")
assert_equal(vf_json$declared_evaluated_count, 1L, "declared_evaluated_count e 1L")
assert_equal(vf_json$evaluated_count, 1L, "evaluated_count e 1L para evento vinculado evt-12")
assert_equal(vf_json$unverified_followup_count, 0L, "unverified_followup_count e 0L para evento vinculado")

# 5. Intervenções com acompanhamentos posteriores verificáveis (amostra suficiente N >= 5)
tmp_dir_suff <- tempfile("suff-eval-")
dir.create(tmp_dir_suff, recursive = TRUE, showWarnings = FALSE)
suff_int_csv <- file.path(tmp_dir_suff, "interventions.csv")
suff_evt_csv <- file.path(tmp_dir_suff, "events.csv")

# Utiliza expanded_int (8 intervenções) e post_fixture com questões válidas do catálogo oficial
utils::write.csv(expanded_int, suff_int_csv, row.names = FALSE)

suff_events_df <- data.frame(
  event_id = expanded_int$post_assessment_event_id,
  event_type = rep("ANSWER_SUBMITTED", 8),
  session_id = rep("sess-post-1", 8),
  question_id = paste0("q00", 1:8),
  occurred_at = rep("2026-10-11T12:00:00Z", 8),
  selected_option = rep("A", 8),
  is_correct = expanded_int$post_outcome == "CORRECT",
  confidence_level = rep(4L, 8),
  active_time_ms = rep(30000L, 8),
  stringsAsFactors = FALSE
)
utils::write.csv(suff_events_df, suff_evt_csv, row.names = FALSE)

res_suff <- run_pipeline_eval(c(suff_evt_csv, "tests/fixtures/valid_questions.csv", suff_int_csv), run_id = "suff-eval-run")
assert_equal(res_suff$exit, 0L, "Pipeline executa com amostra suficiente de intervencoes verificadas")
suff_json <- res_suff$json
assert_true(!is.null(suff_json), "intervention_evaluation_v1.json gerado para amostra suficiente")
assert_equal(suff_json$evaluation_status, "OBSERVATIONAL_EVALUATION_COMPLETED",
             "Amostra N >= 5 verificada produz OBSERVATIONAL_EVALUATION_COMPLETED")
assert_equal(suff_json$status, "OBSERVATIONAL_EVALUATION_COMPLETED",
             "status e OBSERVATIONAL_EVALUATION_COMPLETED")
assert_false(suff_json$is_validated, "is_validated permanece FALSE sob avaliacao observacional")
assert_false(suff_json$can_apply, "can_apply permanece FALSE")
assert_false(suff_json$can_schedule, "can_schedule permanece FALSE")
assert_equal(suff_json$transfer_status, "NOT_ESTABLISHED", "transfer_status permanece NOT_ESTABLISHED")
assert_equal(suff_json$assessment_type_status, "DECLARED_NOT_INDEPENDENTLY_VERIFIED",
             "assessment_type_status e DECLARED_NOT_INDEPENDENTLY_VERIFIED")
assert_equal(suff_json$evaluated_count, 8L, "evaluated_count e 8L")
unlink(tmp_dir_suff, recursive = TRUE)

# 6. Conformidade do artefato versionado output/metrics/intervention_evaluation_v1.json
disk_artifact_path <- "output/metrics/intervention_evaluation_v1.json"
assert_true(file.exists(disk_artifact_path), "Artefato output/metrics/intervention_evaluation_v1.json existe em disco")
disk_artifact <- jsonlite::fromJSON(disk_artifact_path, simplifyVector = FALSE)
assert_equal(disk_artifact$evaluation_version, "1.1.0", "Artefato em disco tem evaluation_version 1.1.0")
assert_equal(disk_artifact$status, disk_artifact$evaluation_status, "Artefato em disco status coincide com evaluation_status")
assert_false(disk_artifact$is_real_student_data, "Artefato em disco is_real_student_data e FALSE")
assert_false(disk_artifact$can_apply, "Artefato em disco can_apply e FALSE")
assert_false(disk_artifact$can_schedule, "Artefato em disco can_schedule e FALSE")
assert_equal(disk_artifact$transfer_status, "NOT_ESTABLISHED", "Artefato em disco transfer_status e NOT_ESTABLISHED")
assert_true(all(required_v1_1_fields %in% names(disk_artifact)), "Artefato em disco contem todos os campos da Extensao 1.1.0")
assert_false(any(c("fsrs_state", "next_review_at", "scheduled_at") %in% names(disk_artifact)),
             "Avaliacao de intervencoes nao emite nem altera estado de agendamento FSRS")
