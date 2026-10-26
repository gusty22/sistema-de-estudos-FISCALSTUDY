# Cross-module contract regression fixtures: synthetic data, not personal evidence.
# Sources are loaded by test_runner.R; no database or external service is used.
qa_export <- data.frame(
  event_id = c("qa-event-1", "qa-event-2", "qa-event-3", "qa-event-4"),
  session_id = c("qa-session-1", "qa-session-2", "qa-session-3", "qa-session-4"),
  occurred_at = c("2026-01-01T10:00:00Z", "2026-01-03T10:00:00Z", "2026-01-04T10:00:00Z", "2026-01-05T10:00:00Z"),
  origin_type = rep("AUTOMATED_TEST", 4),
  question_id = c("qa-a", "qa-a", "qa-b", "qa-annulled"),
  selected_option = c("A", "B", "A", "A"),
  is_correct = c(TRUE, FALSE, TRUE, TRUE),
  gabarito_status = c("DEFINITIVO", "DEFINITIVO", "DEFINITIVO", "ANULADA"),
  confidence_level = c(4, 5, 3, 5), active_time_ms = c(30000, 40000, 50000, 35000),
  discipline = c("Disciplina A", "Disciplina A", "Disciplina B", "Disciplina A"),
  assunto = rep("Introducao", 4), board = rep("Fixture", 4), year = rep(2026L, 4),
  stringsAsFactors = FALSE
)
qa_adapted <- adapt_operational_attempts(qa_export)
assert_equal(qa_adapted$attempts_df$event_id, qa_export$event_id,
             "Contract: operational event identity survives adaptation")
assert_equal(qa_adapted$attempts_df$session_id, qa_export$session_id,
             "Contract: operational session identity survives adaptation")
assert_equal(qa_adapted$attempts_df$occurred_at, qa_export$occurred_at,
             "Contract: real timestamp fields survive adaptation unchanged")
assert_equal(qa_adapted$attempts_df$origin_type, qa_export$origin_type,
             "Contract: automated origin cannot be rewritten as personal study")
assert_true(qa_adapted$metadata$temporal_data_present,
            "Contract: supplied valid timestamps are recognized")
qa_profile <- build_learning_profile(qa_adapted$attempts_df, qa_adapted$questions_df)
assert_equal(qa_profile$data_quality$valid_attempts, 3L,
             "Contract: annulled response never contributes to performance profile")
assert_false(qa_profile$is_real_student_profile,
             "Contract: adapted test history never becomes a personal profile")
assert_equal(qa_profile$transfer_exposure$transfer_status, "NOT_ESTABLISHED",
             "Contract: repeated-item performance does not establish transfer")

qa_graded <- qa_adapted$attempts_df[!is.na(qa_adapted$attempts_df$is_correct), , drop = FALSE]
qa_history <- classify_attempt_history(qa_graded, qa_adapted$questions_df)
assert_equal(nrow(qa_history), 3L,
             "Contract: joining question metadata preserves observation cardinality")
assert_true(all(c("disciplina", "assunto") %in% names(qa_history)),
            "Contract: metadata enrichment keeps canonical topic columns")
assert_false(any(grepl("[.][xy]$", names(qa_history))),
             "Contract: metadata enrichment does not create ambiguous suffixed fields")
qa_b <- qa_history[qa_history$question_id == "qa-b", , drop = FALSE]
assert_equal(qa_b$epistemic_transfer_category, "INITIAL_EXPOSURE",
             "Contract: same topic label in another discipline is not prior exposure")

qa_model <- fit_empirical_decay_model(qa_history)
assert_true(all(is.na(unlist(qa_model$coefficients))),
            "Contract: one observed repeat cannot create fitted forgetting coefficients")
qa_weights <- calculate_robin_hood_weights(qa_profile, qa_model)
assert_equal(length(qa_weights$weights), 0L,
             "Contract: insufficient memory evidence cannot override study allocations")
assert_false(qa_weights$can_apply,
             "Contract: unvalidated analytic weights are explicitly non-executable")
assert_equal(length(qa_weights$critical_topics), 0L,
             "Contract: no fabricated emergency intervention is exported")
qa_json <- jsonlite::toJSON(qa_weights, auto_unbox = TRUE, na = "null", null = "null")
qa_roundtrip <- jsonlite::fromJSON(qa_json, simplifyVector = FALSE)
assert_equal(qa_roundtrip$disciplines_count, 0L,
             "Contract: JSON retains zero executable discipline weights")
assert_false(qa_roundtrip$can_apply,
             "Contract: JSON retains non-executable state")

qa_unknown <- qa_adapted$attempts_df
qa_unknown$origin_type <- c("REAL_STUDY", "REAL_STUDY", "UNKNOWN", "REAL_STUDY")
attr(qa_unknown, "provenance_info") <- list(
  provenance_type = "PROVEN_OPERATIONAL", is_proven_operational = TRUE,
  is_real_student_data = TRUE, can_generate_student_profile = TRUE,
  audit_verdict = "TEST_STALE_ATTRIBUTE", reasons = character(), warnings = character()
)
qa_unknown_profile <- build_learning_profile(qa_unknown, qa_adapted$questions_df)
assert_false(qa_unknown_profile$is_real_student_profile,
             "Contract: stale provenance attribute cannot launder unknown origins")
qa_empty <- build_learning_profile(qa_adapted$attempts_df[FALSE, , drop = FALSE], qa_adapted$questions_df)
assert_equal(qa_empty$data_quality$valid_attempts, 0L,
             "Contract: empty history has zero observations")
assert_false(qa_empty$is_real_student_profile,
             "Contract: empty history is not evidence of personal learning")
assert_equal(nrow(qa_empty$mastery_by_discipline), 0L,
             "Contract: empty history does not invent zero-percent discipline mastery")
