source("R/evidence_specialists.R")
evsp_cutoff <- "2026-10-28T12:00:00Z"
evsp_audit <- list(is_proven_operational = TRUE, is_real_student_data = TRUE, can_generate_student_profile = TRUE)
evsp_fixture <- data.frame(event_id = c("a", "b", "c"), question_id = c("q1", "q2", "q1"),
  occurred_at = c("2026-10-01T10:00:00Z", "2026-10-02T10:00:00Z", "2026-10-03T10:00:00Z"),
  origin_type = "REAL_STUDY", is_correct = c(TRUE, FALSE, TRUE), assistance_status = "NONE",
  answer_exposed = FALSE, confidence_level = c(2, 5, 4), stringsAsFactors = FALSE)
evsp_relations <- data.frame(question_id = c("q1", "q2", "q2"), concept_id = c("c1", "c1", "c2"),
  relation_version = "1", source_id = "curation-1", classification_status = "CONFIRMED",
  valid_from = "2026-09-01T00:00:00Z", recorded_at = "2026-09-01T00:00:00Z", stringsAsFactors = FALSE)
evsp_build <- function(x = evsp_fixture, r = evsp_relations) build_evidence_specialists(
  x, evsp_cutoff, r, provenance_audit = evsp_audit)
evsp_result <- evsp_build()
assert_equal(evsp_result$status, "OBSERVATIONAL_ONLY", "Evidence specialists preserve observational status")
assert_false(evsp_result$capabilities$can_apply, "Descriptive specialist cannot apply")
assert_false(evsp_result$capabilities$can_schedule, "Descriptive specialist cannot schedule")
assert_false(evsp_result$capabilities$can_predict, "Descriptive specialist invents no probabilities")
assert_equal(evsp_result$knowledge$mastery_status, "NOT_ESTABLISHED", "Correct item is not conceptual mastery")
assert_equal(evsp_result$application$status, "NOT_ESTABLISHED", "Objective outcome alone is not verified application instrument")
assert_equal(evsp_result$transfer$status, "NOT_ESTABLISHED", "Repeated correct answer does not demonstrate transfer")
assert_equal(evsp_result$memory$n_repeated_item_attempts, 1L, "Repeated item is counted separately from transfer")
assert_equal(evsp_result$metacognition$high_confidence_errors, 1L, "High confidence errors remain ordinal counts")
assert_equal(sum(evsp_result$metacognition$by_confidence$n_observations), 3L, "Confidence denominators reconcile")
assert_equal(evsp_result$execution$observations$category, "UNDETERMINED", "High confidence never invents error cause")
assert_equal(sum(evsp_result$knowledge$concept_observations$inference_status == "COMPOSITE_ITEM_NOT_ATTRIBUTABLE"),
             2L, "Composite item records relations without distributing outcome")
assert_false("n_correct" %in% names(evsp_result$knowledge$concept_observations), "Concept association has no arbitrary fraction of success")
assert_true(identical(evsp_build(evsp_fixture[3:1, ]), evsp_result), "Out of order rows yield deterministic specialist output")
assert_true(identical(evsp_build(), evsp_result), "Identical inputs replay exactly")
assert_equal(build_evidence_specialists(NULL, evsp_cutoff)$status, "NO_DATA", "No attempts remains NO_DATA")
assert_equal(build_evidence_specialists(evsp_fixture, evsp_cutoff)$status, "UNVERIFIED_SOURCE", "Missing provenance audit blocks personal claims")
evsp_bad <- evsp_fixture; evsp_bad$origin_type <- "AUTOMATED_TEST"
assert_equal(evsp_build(evsp_bad)$status, "UNVERIFIED_SOURCE", "Synthetic origin never becomes personal evidence")
evsp_bad <- evsp_fixture; evsp_bad$origin_type[2] <- "DEMO"
assert_false(evsp_build(evsp_bad)$is_real_student_profile, "Mixed provenance does not launder personal profile")
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$personal_eligible), 0L, "Mixed snapshot conservatively blocks personal inference")
evsp_bad <- evsp_fixture; evsp_bad$occurred_at[2] <- NA_character_
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$personal_eligible), 2L, "Timestamp missing excluded explicitly")
assert_true(any(grepl("MISSING_OR_INVALID_TIMESTAMP", evsp_build(evsp_bad)$evidence_registry$blocking_codes)), "Missing timestamp reason remains auditable")
evsp_bad <- evsp_fixture; evsp_bad$occurred_at[2] <- "2027-01-01T00:00:00Z"
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$personal_eligible), 2L, "Future evidence cannot contribute")
evsp_bad <- evsp_fixture; evsp_bad$event_id[2] <- "a"
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$personal_eligible), 1L, "All duplicated identities are blocked including contradictory records")
evsp_bad$is_correct[2] <- NA
assert_true(identical(evsp_build(evsp_bad), evsp_build(evsp_bad[3:1, ])), "Contradictory duplicate rows remain canonical under permutation")
evsp_bad <- evsp_fixture; evsp_bad$is_annulled <- c(FALSE, TRUE, FALSE)
assert_equal(evsp_build(evsp_bad)$metacognition$high_confidence_errors, 0L, "Annulled item excluded from ordinal errors")
evsp_bad <- evsp_fixture; evsp_bad$assistance_status[1] <- "HINT"
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$independent_eligible), 2L, "Hint is not independent recovery")
evsp_bad <- evsp_fixture; evsp_bad$answer_exposed[1] <- TRUE
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$independent_eligible), 2L, "Correct after exposure is not independent recovery")
evsp_bad <- evsp_fixture; evsp_bad$answer_exposed <- NULL
assert_equal(sum(evsp_build(evsp_bad)$evidence_registry$independent_eligible), 0L, "Unknown exposure is not silently treated as no exposure")
evsp_bad <- evsp_fixture; evsp_bad$confidence_level <- c(NA, Inf, 2.5)
assert_equal(evsp_build(evsp_bad)$metacognition$n_observations, 0L, "NA infinity and nonordinal confidence are not observations")
assert_equal(evsp_build(evsp_fixture, NULL)$knowledge$n_unclassified, 3L, "Unclassified outcomes stay at item level")
evsp_bad_rel <- evsp_relations; evsp_bad_rel$classification_status <- "AI_PROPOSED"
assert_equal(nrow(evsp_build(r = evsp_bad_rel)$knowledge$concept_observations), 0L, "AI proposed relation never confirmed implicitly")
evsp_bad_rel <- evsp_relations; evsp_bad_rel$valid_from <- "2026-10-02T11:00:00Z"
assert_equal(nrow(evsp_build(r = evsp_bad_rel)$knowledge$concept_observations), 1L, "Later classification cannot retroactively classify older outcomes")
evsp_bad_rel <- evsp_relations; evsp_bad_rel$recorded_at <- "2026-10-02T11:00:00Z"
assert_equal(nrow(evsp_build(r = evsp_bad_rel)$knowledge$concept_observations), 1L, "Backdated relation unavailable at outcome cannot leak historical classification")
evsp_bad_rel <- evsp_relations; evsp_bad_rel$valid_from <- "2027-10-01T00:00:00Z"
assert_equal(nrow(evsp_build(r = evsp_bad_rel)$knowledge$concept_observations), 0L, "Future relation excluded")
evsp_bad_rel <- evsp_relations; evsp_bad_rel$source_id <- NA_character_
assert_true(inherits(try(evsp_build(r = evsp_bad_rel), silent = TRUE), "try-error"), "Missing relation provenance fails explicitly")
assert_true(inherits(try(evsp_build(r = rbind(evsp_relations, evsp_relations[1, ])), silent = TRUE), "try-error"), "Duplicate relation identity fails explicitly")
evsp_overlap <- rbind(evsp_relations, evsp_relations[1, ]); evsp_overlap$relation_version[4] <- "2"
assert_true(inherits(try(evsp_build(r = evsp_overlap), silent = TRUE), "try-error"), "Overlapping confirmed versions rejected")
evsp_instrument <- evsp_fixture; evsp_instrument$assessment_dimension <- c("COMPREHENSION", "APPLICATION", "TRANSFER")
evsp_instrument$assessment_verification <- "VERIFIED"; evsp_instrument$task_relation <- "INDEPENDENT_CONTEXT_VERIFIED"
assert_equal(evsp_build(evsp_instrument)$knowledge$comprehension$n_observations, 1L, "Verified independent explanation counted as observed task")
assert_equal(evsp_build(evsp_instrument)$application$n_observations, 1L, "Verified application retains explicit target")
assert_equal(evsp_build(evsp_instrument)$transfer$n_observations, 0L, "Repeated item excluded from transfer instrument despite novelty assertion")
evsp_instrument$question_id[3] <- "q3"
assert_equal(evsp_build(evsp_instrument)$transfer$n_observations, 1L, "Verified independent context recorded without claiming mastery")
assert_true(is.na(evsp_build(evsp_instrument)$transfer$probability), "Observed transfer task does not manufacture latent probability")
evsp_bad <- evsp_fixture; evsp_bad$error_category <- c(NA, "SELECTION_OR_TRANSCRIPTION", NA)
evsp_bad$error_evidence_kind <- "SELF_REPORT"; evsp_bad$error_source_id <- "student-report-1"
assert_equal(evsp_build(evsp_bad)$execution$observations$category, "UNVERIFIED_REPORT", "Self report not promoted to verified execution cause")
assert_equal(evsp_build(evsp_bad)$execution$observations$reported_category, "SELECTION_OR_TRANSCRIPTION", "Original self reported category is preserved for investigation")
evsp_bad$error_evidence_kind <- "DIRECT_OBSERVATION"
assert_equal(evsp_build(evsp_bad)$execution$observations$category, "SELECTION_OR_TRANSCRIPTION", "Sourced observed transcription error distinct from knowledge deficit")
assert_equal(evsp_build(evsp_bad)$execution$observations$causal_status, "NOT_ESTABLISHED", "Taxonomy still cannot prove a psychological cause")
evsp_bad$fsrs_retrievability_pre_update <- .99
assert_equal(evsp_build(evsp_bad)$execution$observations$category, "SELECTION_OR_TRANSCRIPTION", "FSRS probability does not override sourced error observation")
assert_true(identical(evsp_fixture$event_id, c("a", "b", "c")), "Specialists preserve original history")
source("R/learning_orchestrator.R")
evsp_common <- evidence_specialist_results(evsp_result, "student-1", "run-1")
assert_equal(length(evsp_common), 6L, "Six responsibilities bridge to common contracts")
evsp_checked <- lapply(evsp_common, validate_specialist_result, student_id = "student-1",
  cutoff = evsp_cutoff, evidence_ids = evsp_fixture$event_id)
assert_true(all(vapply(evsp_checked, function(x) x$capabilities$can_describe, logical(1))), "Common contract accepts descriptive dimensions without numeric NA")
assert_true(all(vapply(evsp_checked, function(x) !x$capabilities$can_propose && !x$capabilities$can_apply && !x$capabilities$can_schedule, logical(1))), "Descriptive bridge never self authorizes policy")
assert_equal(evsp_common[[2]]$result$observations$probability, "NOT_ESTABLISHED", "Unknown probability portable as explicit state")
