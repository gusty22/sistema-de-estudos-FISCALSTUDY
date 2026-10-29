source("R/pedagogical_decision.R")

pd_candidates <- data.frame(candidate_id = c("new", "diagnose"), activity_type = c("LEARN_NEW", "DIAGNOSE_CONCEPT"),
  scope_id = c("tax", "tax"), contest_id = "fiscal", estimated_minutes = c(20, 10), material_available = TRUE,
  in_syllabus = TRUE, prerequisites_status = "SATISFIED", risk = "LOW_REVERSIBLE", inventory_verified = TRUE,
  curriculum_source_id = "edital-v1", stringsAsFactors = FALSE)
pd_snapshot <- list(student_id = "new-student", run_id = "new-run", cutoff = "2026-10-28T12:00:00Z")
pd_initial <- initial_inventory_recommendation(pd_snapshot, list(contest_id = "fiscal", available_minutes = 30), pd_candidates)
assert_equal(pd_initial$candidate_id, "diagnose", "No-history policy prefers reversible diagnostic from verified inventory")
assert_false(pd_initial$personal_inference, "Initial policy does not fabricate personalization")
pd_unverified <- pd_candidates; pd_unverified$inventory_verified <- FALSE
assert_true(is.null(initial_inventory_recommendation(pd_snapshot, list(contest_id = "fiscal", available_minutes = 30), pd_unverified)), "Unverified inventory cannot authorize initial proposal")
pd_needs <- derive_pedagogical_needs(NULL, pd_candidates, FALSE)
assert_true(all(vapply(pd_needs, function(x) x$uncertainty == "PERSONAL_KNOWLEDGE_UNKNOWN", logical(1))), "Curricular opportunity keeps learner knowledge unknown")
assert_true(all(vapply(pd_needs, function(x) x$diagnostic_status == "OBSERVED_NOT_DIAGNOSTIC", logical(1))), "Need contract does not convert inventory into diagnosis")
pd_ledger <- audit_decision_lifecycle(data.frame(recommendation_id = c("ignored", "sub", "stop", "partial", "done"),
  recommendation_status = "PROPOSED_NOT_APPLIED", authorization_status = c("AUTHORIZED", "AUTHORIZED", "AUTHORIZED", "AUTHORIZED", "AUTHORIZED"),
  execution_status = c("IGNORED", "SUBSTITUTED", "INTERRUPTED", "PARTIAL", "COMPLETED"), stringsAsFactors = FALSE))
assert_true(all(pd_ledger$outcome_credit_status[1:4] == "NOT_ATTRIBUTABLE_NOT_FULLY_EXECUTED"), "Ignored, substituted, interrupted and partial recommendations receive no outcome credit")
assert_equal(pd_ledger$outcome_credit_status[5], "ELIGIBLE_FOR_INDEPENDENT_FOLLOWUP", "Only authorized completed activity can await later independent evaluation")
assert_true(all(pd_ledger$causal_status == "NOT_ESTABLISHED"), "Prospective ledger never infers causal effect")

source("R/evidence_specialists.R")
pd_relations <- function(n) data.frame(question_id = paste0("q", seq_len(n)), concept_id = "c", relation_version = "1", source_id = "curation",
  classification_status = "CONFIRMED", valid_from = "2026-01-01T00:00:00Z", valid_to = "2026-01-02T00:00:00Z", recorded_at = "2026-01-01T00:00:00Z", stringsAsFactors = FALSE)
for (n in c(5000L, 20000L)) {
  rel <- pd_relations(n)
  checked <- validate_concept_relations(rel, "2026-10-28T12:00:00Z")
  assert_equal(sum(checked$eligible), n, sprintf("Relation sweep preserves %d valid independent edges", n))
}
pd_overlap <- pd_relations(2L); pd_overlap$question_id <- "q1"; pd_overlap$valid_to[2] <- "2026-01-03T00:00:00Z"
assert_true(inherits(try(validate_concept_relations(pd_overlap, "2026-10-28T12:00:00Z"), silent = TRUE), "try-error"), "Relation sweep preserves overlap rejection semantics")

# Same verified catalogue, distinct recorded need labels: no accuracy or mastery
# probabilities are supplied. These are controlled contract scenarios only.
pd_contextual <- data.frame(candidate_id = c("review", "diagnose", "transfer", "new"),
  activity_type = c("REVIEW_ITEM", "DIAGNOSE_CONCEPT", "DEEPEN_APPLICATION", "LEARN_NEW"), scope_id = c("item", "concept", "concept", "new-topic"),
  contest_id = "fiscal", estimated_minutes = c(10, 8, 12, 15), material_available = TRUE, in_syllabus = TRUE,
  prerequisites_status = "SATISFIED", risk = "LOW_REVERSIBLE", evidence_need_type = "UNKNOWN", evidence_verified = TRUE,
  fsrs_due_verified = c(TRUE, FALSE, FALSE, FALSE), memory_risk_verified = c(TRUE, FALSE, FALSE, FALSE), stringsAsFactors = FALSE)
pd_pick <- function(need, minutes = 30, reviews = FALSE) { x <- pd_contextual; x$evidence_need_type[match(need, x$candidate_id)] <- switch(need, review="MEMORY_MAINTENANCE", diagnose="OBSERVED_CONCEPTUAL_GAP", transfer="TRANSFER_ASSESSMENT", new="INITIAL_LEARNING"); choose_contextual_policy(x, list(contest_id="fiscal", available_minutes=minutes, review_capacity_exceeded=reviews, review_capacity_verified=reviews)) }
assert_equal(pd_pick("new")$candidate_id, "new", "No-history curricular opportunity can advance only verified new content")
assert_equal(pd_pick("review")$candidate_id, "review", "Recorded due-memory need selects protected review")
assert_equal(pd_pick("diagnose")$candidate_id, "diagnose", "Observed conceptual evidence selects diagnostic alternative")
assert_equal(pd_pick("transfer")$candidate_id, "transfer", "Unestablished transfer selects assessment/application alternative")
pd_execution <- pd_contextual; pd_execution$evidence_need_type[2] <- "EXAM_EXECUTION_ERROR"
assert_equal(choose_contextual_policy(pd_execution, list(contest_id="fiscal", available_minutes=30))$candidate_id, "diagnose", "Recorded execution error is investigated without claiming cause")
assert_equal(pd_pick("review", minutes=9)$candidate_id, "diagnose", "Time limit removes unaffordable review and retains admissible conservative alternative")
pd_volume <- pd_contextual; pd_volume$evidence_need_type[1] <- "MEMORY_MAINTENANCE"; pd_volume$evidence_need_type[4] <- "INITIAL_LEARNING"
pd_compare <- compare_contextual_policies(pd_volume, list(contest_id="fiscal", available_minutes=30, review_capacity_exceeded=TRUE, review_capacity_verified=TRUE))
assert_true(pd_compare$divergence, "Policy comparison records divergence under excessive review volume")
assert_equal(pd_compare$inference, "CONFIGURED_POLICY_COMPARISON_NOT_PEDAGOGICAL_SUPERIORITY", "Synthetic comparison claims no superiority")
pd_unverified <- pd_contextual; pd_unverified$evidence_need_type[2] <- "OBSERVED_CONCEPTUAL_GAP"; pd_unverified$evidence_verified[2] <- FALSE
assert_equal(choose_contextual_policy(pd_unverified, list(contest_id="fiscal", available_minutes=30))$candidate_id, "new", "Unverified gap cannot justify diagnostic priority")
pd_trace <- decision_trace(list(run_id="trace-run", cutoff="2026-10-28T12:00:00Z", student_id="fixture"), pd_contextual, list(contest_id="fiscal", available_minutes=30), pd_compare)
assert_equal(pd_trace$trace_type, "PEDAGOGICAL_DECISION_TRACE_V1", "Decision trace is versioned")
assert_true(identical(pd_trace, decision_trace(list(run_id="trace-run", cutoff="2026-10-28T12:00:00Z", student_id="fixture"), pd_contextual, list(contest_id="fiscal", available_minutes=30), pd_compare)), "Decision trace is deterministic")
