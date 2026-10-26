# Regression tests for the FSRS/outcome audit. All rows below are synthetic fixtures.
source("R/retrieval_diagnostics.R", local = FALSE)

empty_memory_audit <- calculate_retrieval_surprise(data.frame())
assert_equal(empty_memory_audit$status, "NO_DATA", "FSRS audit has an explicit empty-data state")
assert_false(empty_memory_audit$can_apply, "An empty FSRS audit cannot trigger an action")

missing_memory_inputs <- calculate_retrieval_surprise(data.frame(is_correct = TRUE))
assert_equal(missing_memory_inputs$status, "MODEL_INPUTS_MISSING", "Legacy exports do not fabricate a memory estimate")
assert_true("fsrs_retrievability_pre_update" %in% unlist(missing_memory_inputs$missing_fields),
            "Missing FSRS probability is identified by field name")

memory_fixture <- data.frame(
  event_id = paste0("memory-event-", 1:7),
  question_id = paste0("memory-question-", 1:7),
  disciplina = c("Dir A", "Dir B", "Dir A", "Dir A", "Dir B", "Dir A", "Dir A"),
  assunto = rep("Introdução", 7),
  is_correct = c(FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE),
  gabarito_status = c("DEFINITIVO", "DEFINITIVO", "DEFINITIVO", "ANULADA",
                      "DEFINITIVO", "DEFINITIVO", "DEFINITIVO"),
  fsrs_retrievability_pre_update = c(0.50, 0.80, 0.40, 0.20, 0.79, 0.99, NA_real_),
  fsrs_model_version = rep("FSRS-6.0-default-core-no-fuzz", 7),
  fsrs_prediction_timestamp = c(
    "2026-10-01T09:59:00Z", "2026-10-01T10:59:00Z", "2026-10-01T11:59:00Z",
    "2026-10-01T12:59:00Z", "2026-10-01T13:59:00Z", "2026-10-01T15:01:00Z",
    "2026-10-01T15:59:00Z"),
  fsrs_evidence_status = rep("UNCALIBRATED_ITEM_ESTIMATE", 7),
  occurred_at = c(
    "2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z", "2026-10-01T12:00:00Z",
    "2026-10-01T13:00:00Z", "2026-10-01T14:00:00Z", "2026-10-01T15:00:00Z",
    "2026-10-01T16:00:00Z"),
  stringsAsFactors = FALSE
)
memory_audit <- calculate_retrieval_surprise(memory_fixture)
assert_equal(memory_audit$input_attempt_count, 7L, "FSRS audit preserves its observed input count")
assert_equal(memory_audit$evaluable_attempt_count, 6L, "Annulled attempts are excluded before memory-outcome comparison")
assert_equal(memory_audit$valid_preupdate_snapshot_count, 4L, "Only valid, versioned, pre-update snapshots are scored")
assert_equal(memory_audit$per_attempt$classification[1], "ERROR_WITH_LOW_PREDICTED_RETRIEVAL",
             "A low-retrievability error is consistent with expected forgetting, not a cause diagnosis")
assert_equal(memory_audit$per_attempt$classification[2], "ERROR_WITH_HIGH_PREDICTED_RETRIEVAL",
             "A high-retrievability error is flagged for investigation")
assert_equal(memory_audit$per_attempt$classification[3], "SUCCESS_WITH_LOW_PREDICTED_RETRIEVAL",
             "A correct answer despite low predicted retrieval is visible as a model discrepancy")
assert_equal(memory_audit$per_attempt$classification[4], "ERROR_WITH_INTERMEDIATE_PREDICTION",
             "Intermediate predicted retrieval is not forced into expected or unexpected bins")
assert_equal(memory_audit$per_attempt$snapshot_status[5], "FSRS_STATE_NOT_PROVEN_PREUPDATE",
             "A state snapshot later than the event timestamp is rejected")
same_instant_fixture <- memory_fixture[1, , drop = FALSE]
same_instant_fixture$fsrs_prediction_timestamp <- same_instant_fixture$occurred_at
same_instant_audit <- calculate_retrieval_surprise(same_instant_fixture)
assert_equal(same_instant_audit$valid_preupdate_snapshot_count, 1L,
             "Equal timestamp precision is accepted when pre-update capture precedes event persistence")
assert_equal(memory_audit$per_attempt$snapshot_status[6], "RETRIEVABILITY_MISSING_OR_OUT_OF_RANGE",
             "Missing predictions stay missing rather than becoming zero")
assert_equal(length(memory_audit$investigation_queue), 1L,
             "Only high-predicted-retrieval errors enter the investigation queue")
assert_equal(memory_audit$investigation_queue[[1]]$status, "INVESTIGATE_CAUSE_WITH_STUDENT",
             "The output requests investigation instead of asserting a cause")
assert_equal(length(memory_audit$by_topic), 2L,
             "Topic summaries distinguish identical labels across disciplines")
assert_equal(memory_audit$prediction_metrics$by_fsrs_model_version[["FSRS-6.0-default-core-no-fuzz"]]$n_observations,
             4L, "Prediction scores are grouped by the declared FSRS version")
assert_false(memory_audit$is_validated, "Observed FSRS prediction scores are not labeled validated")
assert_false(memory_audit$can_apply, "Pedagogical analysis never changes FSRS scheduling")

cold_memory_fixture <- memory_fixture[1, , drop = FALSE]
cold_memory_fixture$fsrs_evidence_status <- "COLD_START"
cold_audit <- calculate_retrieval_surprise(cold_memory_fixture)
assert_equal(cold_audit$per_attempt$snapshot_status[1], "FSRS_EVIDENCE_STATUS_NOT_ELIGIBLE",
             "Cold start is explicitly labeled as an ineligible memory state")
assert_equal(cold_audit$valid_preupdate_snapshot_count, 0L,
             "FSRS cold-start state is not treated as a probability prediction")

bad_thresholds <- tryCatch({
  calculate_retrieval_surprise(memory_fixture, low_retrievability_threshold = 0.8,
                               high_retrievability_threshold = 0.5)
  FALSE
}, error = function(e) TRUE)
assert_true(bad_thresholds, "Invalid triage thresholds fail explicitly")


# Integrity and temporal evidence regressions, independent of FSRS equations.
duplicate_memory <- rbind(memory_fixture, memory_fixture[2, , drop = FALSE])
duplicate_audit <- calculate_retrieval_surprise(duplicate_memory)
assert_equal(duplicate_audit$valid_preupdate_snapshot_count, 3L,
             "All duplicate event identities are excluded from FSRS scores")
assert_equal(length(duplicate_audit$investigation_queue), 0L,
             "Duplicate high-error event cannot create duplicate investigations")
unknown_identity <- memory_fixture
unknown_identity$event_id[2] <- NA_character_
assert_equal(calculate_retrieval_surprise(unknown_identity)$valid_preupdate_snapshot_count, 3L,
             "Missing event identity cannot establish auditable evidence")
naive_memory <- memory_fixture
naive_memory$fsrs_prediction_timestamp[2] <- "2026-10-01 10:59:00"
assert_equal(calculate_retrieval_surprise(naive_memory)$valid_preupdate_snapshot_count, 3L,
             "Timezone-free snapshot is not proven to precede the answer")
offset_memory <- memory_fixture[2, , drop = FALSE]
offset_memory$fsrs_prediction_timestamp <- "2026-10-01T07:59:00-03:00"
assert_equal(calculate_retrieval_surprise(offset_memory)$valid_preupdate_snapshot_count, 1L,
             "FSRS diagnostic accepts explicit equivalent timezone offsets")
assert_equal(calculate_retrieval_surprise(offset_memory)$by_topic[[1]]$error_rate_among_high_predictions, 1,
             "High-prediction error rate uses high-prediction denominator")
assert_false(calculate_retrieval_surprise(offset_memory)$can_apply, "Integrity fixes do not grant decision authority")
