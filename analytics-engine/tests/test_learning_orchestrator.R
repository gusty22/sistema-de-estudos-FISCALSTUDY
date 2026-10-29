source("R/learning_orchestrator.R")

# Synthetic inputs exclusively exercise contracts, not learning efficacy.
lo_snapshot <- list(student_id = "fixture-student", run_id = "fixture-run", cutoff = "2026-10-28T12:00:00Z",
  evidence = data.frame(event_id = c("e2", "e1"), occurred_at = c("2026-10-28T11:00:00Z", "2026-10-27T11:00:00Z"), origin = "SYNTHETIC_FIXTURE"))
lo_context <- list(contest_id = "fiscal", available_minutes = 30)
lo_specialist <- build_specialist_result("memory", "Item memory", "ITEM_MEMORY", "fixture-student", "item-1", lo_snapshot$cutoff,
  c("e1", "e2"), result = list(due = TRUE), model_version = "FSRS6_PRE_UPDATE_V1", validation_status = "OPERATIONAL_VALIDATED", source_ids = "fixture-source", run_id = "fixture-run")
lo_diagnostic <- lo_specialist; lo_diagnostic$specialist_id <- "knowledge"; lo_diagnostic$target <- "KNOWLEDGE_OBSERVATIONS"
lo_registry <- list(list(specialist_id = "knowledge", model_version = "FSRS6_PRE_UPDATE_V1", target = "KNOWLEDGE_OBSERVATIONS", unit = "NOT_APPLICABLE", horizon = "NOT_APPLICABLE", validation_status = "OPERATIONAL_VALIDATED", epistemic_type = "OBSERVATION", can_propose = TRUE), list(specialist_id = "memory", model_version = "FSRS6_PRE_UPDATE_V1", target = "ITEM_MEMORY", unit = "NOT_APPLICABLE", horizon = "NOT_APPLICABLE", validation_status = "OPERATIONAL_VALIDATED", epistemic_type = "OBSERVATION", can_propose = TRUE))
lo_candidates <- data.frame(candidate_id = c("review", "diagnostic"), activity_type = c("REVIEW_ITEM", "DIAGNOSE_CONCEPT"),
  scope_id = "item-1", contest_id = "fiscal", priority = c("MAINTENANCE_DUE", "DIAGNOSTIC_GAP"), estimated_minutes = c(15, 5),
  material_available = TRUE, in_syllabus = TRUE, prerequisites_status = "SATISFIED", risk = "LOW_REVERSIBLE", support_specialist_id = c("memory", "knowledge"))
lo_run <- function(snapshot = lo_snapshot, context = lo_context, specialists = list(lo_specialist, lo_diagnostic), candidates = lo_candidates, registry = lo_registry)
  orchestrate_learning(snapshot, context, specialists, candidates, registry)
lo_error <- function(expr) tryCatch({force(expr); FALSE}, error = function(e) TRUE)
lo_codes <- function(x) unlist(lapply(x$rejected_candidates, function(z) z$codes))
lo_result <- lo_run()
assert_equal(lo_result$proposal$candidate_id, "review", "Configured maintenance priority selects review")
assert_equal(lo_result$baseline_comparison$candidate_id, "diagnostic", "Independent shortest-admissible baseline preserved")
assert_false(lo_result$baseline_comparison$agrees_with_proposal, "Policy disagreement does not establish gain")
assert_equal(lo_result$baseline_comparison$benefit_difference, "NOT_ESTABLISHED", "No fabricated benefit estimate")
assert_false(lo_result$proposal$can_apply, "Proposal never applies automatically")
assert_false(lo_result$proposal$can_schedule, "No second scheduler")
assert_equal(lo_result$evidence_state, "SYNTHETIC_ONLY", "Synthetic fixture never becomes personal learning")
assert_false(lo_result$proposal$personal_inference, "Fixture produces no personal inference")
assert_equal(lo_result, lo_run(), "Same explicit inputs reproduce complete result")
assert_equal(lo_result, lo_run(candidates = lo_candidates[2:1, ]), "Candidate permutation does not alter result")
lo_reordered <- lo_snapshot; lo_reordered$evidence <- lo_reordered$evidence[2:1, ]
assert_equal(lo_result, lo_run(snapshot = lo_reordered), "Out-of-order events resolved without rewriting history")
assert_equal(lo_snapshot$evidence$event_id, c("e2", "e1"), "Input event order preserved")
assert_equal(lo_run(registry = list())$proposal$status, "ABSTAIN", "Self-declared validated specialist grants no authority")
lo_empty <- lo_snapshot; lo_empty$evidence <- lo_empty$evidence[FALSE, ]
assert_equal(lo_run(snapshot = lo_empty)$proposal$status, "ABSTAIN", "No attempts causes explicit abstention")
assert_equal(lo_run(snapshot = lo_empty)$evidence_state, "NO_DATA", "No data distinct from zero mastery")
lo_cold_inventory <- lo_candidates[2, ]
lo_cold_inventory$candidate_id <- "cold-diagnostic"
lo_cold_inventory$estimated_minutes <- 10
lo_cold_inventory$inventory_verified <- TRUE
lo_cold_inventory$curriculum_source_id <- "edital-verified-v1"
lo_cold <- lo_run(snapshot = lo_empty, candidates = lo_cold_inventory)
assert_equal(lo_cold$proposal$candidate_id, "cold-diagnostic", "No-history policy may propose a verified, reversible curriculum diagnostic")
assert_false(lo_cold$proposal$personal_inference, "Cold-start recommendation never claims personal diagnosis")
assert_true(any(vapply(lo_cold$pedagogical_needs, function(x) x$uncertainty == "PERSONAL_KNOWLEDGE_UNKNOWN", logical(1))), "Cold-start need retains unknown personal knowledge")
lo_bad <- lo_snapshot; lo_bad$evidence$origin[1] <- "REAL_STUDY"
assert_true("MIXED_ORIGIN" %in% lo_codes(lo_run(snapshot = lo_bad)), "Mixed real/artificial origins block candidates")
lo_bad <- lo_snapshot; lo_bad$evidence$origin <- "REAL_STUDY"
assert_true("UNVERIFIED_OPERATIONAL_SOURCE" %in% lo_codes(lo_run(snapshot = lo_bad)), "Declared real origin requires audit")
lo_bad$provenance <- list(is_proven_operational = TRUE, is_real_student_data = TRUE, can_generate_student_profile = TRUE)
assert_true(lo_run(snapshot = lo_bad)$personal_source_verified, "Three explicit provenance audit gates recognized")
lo_bad <- lo_snapshot; lo_bad$evidence$occurred_at[1] <- NA_character_
assert_true("INVALID_EVENT_TIMESTAMP" %in% lo_codes(lo_run(snapshot = lo_bad)), "Missing timestamp blocks all proposals")
lo_bad <- lo_snapshot; lo_bad$evidence$occurred_at[1] <- "2026-10-29T11:00:00Z"
assert_true("FUTURE_EVENT" %in% lo_codes(lo_run(snapshot = lo_bad)), "Future event blocks use of snapshot")
lo_bad <- lo_snapshot; lo_bad$evidence <- rbind(lo_bad$evidence, lo_bad$evidence[1, ])
assert_true("DUPLICATE_EVENT_ID" %in% lo_codes(lo_run(snapshot = lo_bad)), "Duplicate identity fails closed")
lo_bad <- lo_snapshot; lo_bad$evidence$origin[1] <- "UNKNOWN"
assert_true("UNKNOWN_EVENT_ORIGIN" %in% lo_codes(lo_run(snapshot = lo_bad)), "Unknown origin rejected")
lo_bad <- lo_specialist; lo_bad$validation_status <- "EXPERIMENTAL"; lo_bad$capabilities$can_apply <- TRUE; lo_bad$capabilities$can_schedule <- TRUE; lo_bad$decision_eligible <- TRUE
lo_experimental <- lo_run(specialists = list(lo_bad))
assert_equal(lo_experimental$proposal$status, "ABSTAIN", "Experimental result never promotes itself")
assert_false(lo_experimental$specialists[[1]]$capabilities$can_apply, "Forged apply capability overwritten")
assert_false(lo_experimental$specialists[[1]]$capabilities$can_schedule, "Forged scheduling capability overwritten")
lo_bad <- lo_specialist; lo_bad$model_version <- "UNKNOWN"
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Unknown model version cannot support proposal")
lo_bad <- lo_specialist; lo_bad$validation_status <- "UNAVAILABLE"
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Unavailable model safely abstains")
assert_equal(lo_run(specialists = list(list()))$proposal$status, "ABSTAIN", "Malformed external result safely abstains")
lo_bad <- lo_specialist; lo_bad$evidence_ids <- "future-unknown"
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Unknown specialist evidence rejected")
lo_bad <- lo_specialist; lo_bad$cutoff <- "2026-10-29T00:00:00Z"
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Future specialist result rejected")
lo_bad <- lo_specialist; lo_bad$source_ids <- character()
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Unverified specialist source rejected")
for (bad_number in c(NA_real_, NaN, Inf, -Inf)) {
  lo_bad <- lo_specialist; lo_bad$result <- list(probability = bad_number)
  assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Invalid numeric specialist result blocked")
}
lo_bad <- lo_candidates; lo_bad$estimated_minutes <- 31
assert_true("TIME_BUDGET_EXCEEDED" %in% lo_codes(lo_run(candidates = lo_bad)), "Time budget admission precedes priority")
lo_bad <- lo_candidates; lo_bad$material_available <- FALSE
assert_true("MATERIAL_UNAVAILABLE" %in% lo_codes(lo_run(candidates = lo_bad)), "Unavailable materials reject candidate")
lo_bad <- lo_candidates; lo_bad$prerequisites_status <- "UNKNOWN"
assert_true("PREREQUISITES_NOT_ESTABLISHED" %in% lo_codes(lo_run(candidates = lo_bad)), "Unknown prerequisites not invented")
lo_bad <- lo_candidates; lo_bad$in_syllabus <- NA
assert_true("SYLLABUS_NOT_CONFIRMED" %in% lo_codes(lo_run(candidates = lo_bad)), "Unknown syllabus membership rejected")
lo_bad <- lo_candidates; lo_bad$contest_id <- "other"
assert_true("CONTEST_MISMATCH" %in% lo_codes(lo_run(candidates = lo_bad)), "Different contest not admissible")
lo_bad <- lo_candidates; lo_bad$risk <- "HIGH"
assert_true("CONFIRMATION_REQUIRED" %in% lo_codes(lo_run(candidates = lo_bad)), "High-impact candidate requires confirmation")
lo_bad <- lo_candidates; lo_bad$scope_id <- "concept-other"
assert_true("SUPPORT_SCOPE_MISMATCH" %in% lo_codes(lo_run(candidates = lo_bad)), "Item memory cannot silently propagate to other concepts")
lo_other <- lo_specialist; lo_other$specialist_id <- "other"; lo_other$result <- list(due = FALSE)
lo_conflict_registry <- c(lo_registry, list(list(specialist_id = "other", model_version = "FSRS6_PRE_UPDATE_V1", target = "ITEM_MEMORY", unit = "NOT_APPLICABLE", horizon = "NOT_APPLICABLE", validation_status = "OPERATIONAL_VALIDATED", epistemic_type = "OBSERVATION", can_propose = TRUE)))
lo_conflict <- lo_run(specialists = list(lo_specialist, lo_other), registry = lo_conflict_registry)
assert_equal(lo_conflict$conflicts[[1]]$resolution, "UNRESOLVED_ABSTAIN", "Equally authorized contradiction remains explicit")
assert_equal(lo_conflict$proposal$status, "ABSTAIN", "Unresolved contradiction blocks supported candidate")
assert_equal(lo_conflict, lo_run(specialists = list(lo_other, lo_specialist), registry = lo_conflict_registry), "Specialist ordering preserves conflict replay")
lo_other$validation_status <- "EXPERIMENTAL"
lo_conflict <- lo_run(specialists = list(lo_specialist, lo_other), registry = lo_conflict_registry)
assert_equal(lo_conflict$conflicts[[1]]$resolution, "RETAIN_AUTHORIZED_REFERENCE", "Experimental confidence cannot overrule authorized reference")
assert_equal(lo_conflict$proposal$candidate_id, "review", "Authorized memory reference retained")
lo_no_due <- lo_specialist; lo_no_due$result$due <- FALSE
assert_true("NO_OPERATIONAL_DUE_EVIDENCE" %in% lo_codes(lo_run(specialists = list(lo_no_due))), "No invented due review")
assert_equal(lo_run(candidates = lo_candidates[FALSE, ])$proposal$status, "ABSTAIN", "No inventory produces no fabricated activity")
lo_bad <- lo_candidates; lo_bad$candidate_id <- "duplicate"
assert_true(lo_error(lo_run(candidates = lo_bad)), "Duplicate candidate identities rejected")
lo_bad_context <- lo_context; lo_bad_context$available_minutes <- NaN
assert_true(lo_error(lo_run(context = lo_bad_context)), "Nonfinite available time rejected")
lo_bad_snapshot <- lo_snapshot; lo_bad_snapshot$cutoff <- "unknown"
assert_true(lo_error(lo_run(snapshot = lo_bad_snapshot)), "Missing snapshot cutoff rejected")
lo_serialized <- jsonlite::toJSON(lo_result, auto_unbox = TRUE, null = "null", digits = NA)
lo_roundtrip <- jsonlite::fromJSON(lo_serialized, simplifyVector = FALSE)
assert_equal(lo_roundtrip$proposal$candidate_id, lo_result$proposal$candidate_id, "Portable JSON preserves preferred candidate")
assert_false(lo_roundtrip$proposal$can_apply, "Portable JSON preserves authority denial")
assert_equal(lo_roundtrip$evaluation_record$observed_outcome, "PENDING", "Decision evaluation waits for observed future outcome")
lo_bad <- lo_specialist; lo_bad$cutoff <- "2026-10-27T12:00:00Z"
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Specialist cannot cite evidence after its own cutoff")
lo_bad <- lo_specialist; lo_bad$result <- list(numerator = 3L, denominator = 2L)
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Inconsistent observed denominator blocks claims")
lo_bad <- lo_specialist; lo_bad$result <- list(due = NA)
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Logical missing result cannot masquerade as known output")
lo_personal <- lo_snapshot
lo_personal$evidence$origin <- "REAL_STUDY"
lo_personal$evidence$question_id <- c("q1", "q2")
lo_personal$evidence$is_correct <- c(TRUE, FALSE)
lo_personal$provenance <- list(is_proven_operational = TRUE, is_real_student_data = TRUE, can_generate_student_profile = TRUE)
lo_inventory <- lo_candidates
lo_inventory$candidate_id <- c("learn", "diagnose")
lo_inventory$activity_type <- c("LEARN_NEW", "DIAGNOSE_CONCEPT")
lo_inventory$priority <- c("NEW_CONTENT", "DIAGNOSTIC_GAP")
lo_inventory$support_specialist_id <- "BUILTIN_INVENTORY_POLICY"
lo_auto <- lo_run(snapshot = lo_personal, specialists = list(), candidates = lo_inventory, registry = list())
assert_equal(lo_auto$proposal$candidate_id, "diagnose", "Built-in inventory policy produces low-risk diagnostic proposal")
assert_equal(lo_auto$learner_evidence_profile$status, "OBSERVATIONAL_ONLY", "Orchestrator automatically executes descriptive specialists")
assert_equal(length(lo_auto$specialists), 8L, "Six descriptive specialists plus two configured inventory proposals")
assert_false(lo_auto$proposal$can_apply, "Built-in diagnostic remains unapplied")
lo_review <- lo_inventory[1, ]; lo_review$activity_type <- "REVIEW_ITEM"; lo_review$priority <- "MAINTENANCE_DUE"
assert_equal(lo_run(snapshot = lo_personal, specialists = list(), candidates = lo_review, registry = list())$proposal$status, "ABSTAIN", "Built-in inventory rule cannot invent FSRS due review")
lo_synthetic <- lo_personal; lo_synthetic$evidence$origin <- "SYNTHETIC_FIXTURE"
assert_equal(lo_run(snapshot = lo_synthetic, specialists = list(), candidates = lo_inventory, registry = list())$proposal$status, "ABSTAIN", "Synthetic events cannot authorize built-in personal proposal")
lo_memory_only <- lo_candidates[2, ]; lo_memory_only$support_specialist_id <- "memory"
assert_true("SUPPORT_TARGET_INCOMPATIBLE" %in% lo_codes(lo_run(candidates = lo_memory_only)), "Memory result cannot substitute conceptual diagnostic evidence")

for (bad_probability in c(-0.01, 1.2)) {
  lo_bad <- lo_specialist; lo_bad$result <- list(probability = bad_probability)
  assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Out-of-range probability fails closed")
}
for (field in c("unit", "horizon", "epistemic_type")) {
  lo_bad <- lo_specialist; lo_bad[[field]] <- "OTHER"
  assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Changed specialist semantics cannot inherit registry authority")
}
lo_alias_conflict <- lo_personal
lo_alias_conflict$evidence$origin <- "SYNTHETIC_FIXTURE"
lo_alias_conflict$evidence$origin_type <- "REAL_STUDY"
lo_alias_result <- lo_run(snapshot = lo_alias_conflict, specialists = list(), candidates = lo_inventory, registry = list())
assert_true("CONFLICTING_ORIGIN_ALIASES" %in% lo_alias_result$integrity_codes, "Conflicting origin aliases block orchestration")
assert_true(is.null(lo_alias_result$learner_evidence_profile), "Conflicting origins cannot produce personal profile")
assert_equal(lo_auto, lo_run(snapshot = lo_personal, specialists = list(), candidates = lo_inventory[2:1, ], registry = list()), "Built-in candidate inventory permutation is deterministic")
lo_bad <- lo_specialist; lo_bad$result <- 1
assert_equal(lo_run(specialists = list(lo_bad))$proposal$status, "ABSTAIN", "Scalar malformed specialist result fails closed without runtime error")
