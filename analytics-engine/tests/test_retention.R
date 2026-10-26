# tests/test_retention.R
# Testes Unitários de Retenção e Recuperação Ativa

empty_ret <- calculate_retention_metrics(data.frame())
assert_equal(empty_ret$n_total_attempts, 0, "Retencao sobre dataframe vazio retorna 0 tentativas")

evt_df <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
q_df <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
attempts_df <- evt_df[evt_df$event_type == "ANSWER_SUBMITTED", ]

classified <- classify_attempt_history(attempts_df, q_df)

# Na fixture valid_events:
# Sessão 1 (2026-10-10): q001, q002, q003, q004, q005, q006, q007, q008 (8 iniciais)
# Sessão 2 (2026-10-11, 28h depois): q002 (rep 2), q005 (rep 2), q007 (rep 2), q010 (inicial)
# Total de tentativas: 12. Iniciais: 9. Repetidas: 3 (q002, q005, q007).
assert_equal(nrow(classified), 12, "Classificou todas as 12 tentativas")
assert_equal(sum(classified$is_initial_attempt == TRUE), 9, "Identificou 9 tentativas iniciais")
assert_equal(sum(classified$is_initial_attempt == FALSE), 3, "Identificou 3 repeticoes da mesma questao")

# Verificar cálculo de lag para repetidas
rep_rows <- classified[classified$is_initial_attempt == FALSE, ]
assert_true(all(rep_rows$lag_hours_since_prev_attempt > 20), "Intervalo de atraso (lag) calculado corretamente (~28 horas)")

# Verificar métricas de retenção
ret_res <- calculate_retention_metrics(classified)
assert_equal(ret_res$n_repeated_attempts, 3, "Total de 3 repeticoes processadas nas metricas")

# Verificar Matriz de Transição
# q002: Erro na sessao 1 -> Acerto na sessao 2 (Prev_Error -> Curr_Correct)
# q005: Erro na sessao 1 -> Acerto na sessao 2 (Prev_Error -> Curr_Correct)
# q007: Erro na sessao 1 -> Acerto na sessao 2 (Prev_Error -> Curr_Correct)
# Logo, transições observadas: Prev_Error -> Curr_Correct = 3
trans_mat <- ret_res$transition_matrix
assert_equal(trans_mat["Prev_Error", "Curr_Correct"], 3, "Matriz de transicao registrou 3 recuperacoes (Erro -> Acerto)")
assert_equal(trans_mat["Prev_Correct", "Curr_Error"], 0, "Zero esquecimentos observados na amostra (Acerto -> Erro)")

# Cuidados metodológicos explicitados
assert_true(length(ret_res$methodological_cautions) >= 3, "Preserva advertencias metodologicas explicitas")

# Exploratory models must never fabricate coefficients, deadlines or priorities.
empty_decay <- fit_empirical_decay_model(data.frame())
assert_equal(empty_decay$status, "INSUFFICIENT_EVIDENCE", "No observations means insufficient evidence")
assert_true(all(is.na(unlist(empty_decay$coefficients))), "No arbitrary coefficients for an empty history")
assert_true(!empty_decay$can_schedule && !empty_decay$is_validated, "No fitted exploration authorizes scheduling")
decay_model <- fit_empirical_decay_model(classified)
assert_equal(decay_model$status, "INSUFFICIENT_EVIDENCE", "Three repeat observations cannot establish a forgetting model")
assert_true(all(is.na(unlist(decay_model$coefficients))), "Small samples do not receive invented priors")

# A controlled, nonseparated association with a positive slope remains positive.
# Current confidence must not leak into a claim about prior memory.
interval_fixture <- data.frame(lag_hours_since_prev_attempt = rep(c(24, 48, 96, 192), each = 10),
  is_correct = unlist(lapply(c(2, 4, 6, 8), function(k) c(rep(TRUE, k), rep(FALSE, 10 - k)))),
  confidence_level = rep(1:5, 8), disciplina = "Arbitrary discipline", stringsAsFactors = FALSE)
exploratory <- fit_empirical_decay_model(interval_fixture)
assert_equal(exploratory$status, "EXPLORATORY_FIT", "Finite identifiable logistic association is retained as exploratory")
assert_true(exploratory$coefficients$beta_1_decay > 0, "Observed positive slope is not clipped into theoretical forgetting")
assert_true(is.na(exploratory$coefficients$beta_2_confidence), "Current confidence is not a prior-memory predictor")
changed_confidence <- interval_fixture
changed_confidence$confidence_level <- rev(changed_confidence$confidence_level)
assert_equal(fit_empirical_decay_model(changed_confidence)$coefficients, exploratory$coefficients, "Changing current confidence cannot change memory coefficients")
constant_interval <- interval_fixture
constant_interval$lag_hours_since_prev_attempt <- 24
assert_equal(fit_empirical_decay_model(constant_interval)$status, "UNIDENTIFIABLE_MODEL", "Identical intervals cannot identify a time slope")
separated <- interval_fixture
separated$is_correct <- separated$lag_hours_since_prev_attempt >= 96
separated_fit <- fit_empirical_decay_model(separated)
assert_equal(separated_fit$status, "FIT_FAILED", "Numerical separation must not be reported as a viable calibrated model")
assert_true(all(is.na(unlist(separated_fit$coefficients))), "Failed estimation does not fall back to synthetic coefficients")
assert_true(is.na(exploratory$discipline_decay_rates[[1]]$retention_half_life_days), "A logistic association does not establish a personal half life")

projection_a <- project_critical_intervention_point(exploratory, "Auditoria", 50, 48, 2)
projection_b <- project_critical_intervention_point(exploratory, "Direito Constitucional", 50, 48, 2)
assert_equal(projection_a$urgency_status, "FSRS_REQUIRED", "A valid FSRS state is required instead of a deadline from a subject name")
assert_true(is.na(projection_a$critical_intervention_day) && is.na(projection_b$critical_intervention_day), "Discipline names do not invent future intervention dates")
assert_true(is.na(projection_a$projected_wilson_lower_at_critical), "Wilson interval is not calculated over expected future successes")
assert_equal(projection_a$observed_accuracy, 48 / 50, "Observed accuracy retains its actual denominator")
assert_equal(projection_a$observed_accuracy_ci_lower, projection_b$observed_accuracy_ci_lower, "Equivalent evidence has equivalent observed uncertainty regardless of discipline name")
assert_true(!projection_a$can_schedule && length(projection_a$projected_curve) == 0, "Exploratory model cannot create an executable forgetting curve")
no_observations <- project_critical_intervention_point(exploratory, "Unknown", 0, 0)
assert_true(is.na(no_observations$observed_accuracy), "Zero denominator is unknown rather than zero proficiency")
assert_true(is.na(project_critical_intervention_point(exploratory, "Unknown")$n_observations), "Omitted sample size is not silently imputed")

val_res <- list(is_valid = TRUE, has_warnings = FALSE, summary = list(warnings = 0))
mock_profile <- build_learning_profile(attempts_df, q_df, val_res)
rh_weights <- calculate_robin_hood_weights(mock_profile, exploratory,
  list(signals = list(list(signal_type = "OVERCONFIDENCE_MISCONCEPTION"))))
assert_equal(rh_weights$algorithm, "ROBIN_HOOD_ADAPTIVE_CYCLE_V1", "Java-compatible algorithm envelope retained")
assert_true(!rh_weights$can_apply && rh_weights$disciplines_count == 0, "Unvalidated weights cannot override the actual study plan")
assert_equal(length(rh_weights$weights), 0, "No invented allocation percentages or study minutes")
assert_true(length(rh_weights$critical_topics) == 0 && length(rh_weights$hyper_consolidated_disciplines) == 0, "A global confidence signal does not assign deficits or donors to all disciplines")
assert_true(is.na(rh_weights$parameters$current_lag_days) && is.na(rh_weights$parameters$available_minutes), "Missing elapsed days and budget stay missing")
assert_true(length(rh_weights$recommendations$time_theft_donors) == 0, "No donor time is fabricated")

# Cardinality and topic identity are prerequisites for evidence aggregation.
join_attempts <- data.frame(question_id = c("a", "b", "c"), occurred_at = c("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z"),
  is_correct = c(TRUE, FALSE, TRUE), disciplina = c("Law", "Math", "Law"), assunto = "Introduction", stringsAsFactors = FALSE)
join_metadata <- data.frame(question_id = c("a", "b", "c"), disciplina = c("Law", "Math", "Law"), assunto = "Introduction", stringsAsFactors = FALSE)
join_result <- classify_attempt_history(join_attempts, rbind(join_metadata, join_metadata[1, ]))
assert_equal(nrow(join_result), 3, "Identical duplicate catalog metadata cannot multiply attempt rows")
assert_true(!any(grepl("\\.x$|\\.y$", names(join_result))), "Input metadata is preserved without merge suffixes")
assert_equal(join_result$attempt_type[2], "INITIAL_ATTEMPT", "Same topic label in another discipline is not prior topic exposure")
assert_equal(join_result$attempt_type[3], "NEW_QUESTION_SAME_TOPIC", "Different question in the same discipline/topic is recognized as such")
assert_equal(classify_attempt_history(join_attempts)$disciplina, join_attempts$disciplina, "Missing catalog preserves observed topic metadata")
conflicting_metadata <- rbind(join_metadata, transform(join_metadata[1, ], assunto = "Conflicting"))
conflict_error <- tryCatch({classify_attempt_history(join_attempts, conflicting_metadata); FALSE}, error = function(e) TRUE)
assert_true(conflict_error, "Conflicting duplicate question identity is rejected explicitly")
assert_true(all(ret_res$retention_by_interval$denominator_text[ret_res$retention_by_interval$n_repetitions == 0] == "0/0 (NO_DATA)"), "Empty interval is not displayed as zero retention")

assert_equal(ret_res$exposure_basis, "RECORDED_ATTEMPTS_ONLY", "Exposure labels refer to logged attempts, not a complete lifetime history")
assert_true(all(classified$exposure_basis == "RECORDED_ATTEMPTS_ONLY"), "First recorded attempt does not claim no earlier unrecorded exposure")
