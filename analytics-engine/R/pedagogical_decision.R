# Additive, observation-only contracts for pedagogical needs and decision audit.
# They deliberately do not update FSRS, calendars, mastery or external imports.

pedagogical_need_types <- function() c("INITIAL_LEARNING", "DIAGNOSTIC", "MEMORY_MAINTENANCE",
  "OBSERVED_CONCEPTUAL_GAP", "APPLICATION_DIFFICULTY", "TRANSFER_ASSESSMENT",
  "EXAM_EXECUTION_ERROR", "UNDETERMINED")

new_pedagogical_need <- function(type = "UNDETERMINED", scope_id, provenance, evidence_ids = character(),
                                 limitations = "Evidence is insufficient to establish a diagnosis.",
                                 uncertainty = "NOT_ESTABLISHED", activities = character()) {
  if (!type %in% pedagogical_need_types() || !is.character(scope_id) || length(scope_id) != 1L || !nzchar(scope_id)) stop("INVALID_PEDAGOGICAL_NEED")
  list(schema_version = "1.0.0", need_type = type, scope_id = scope_id,
       provenance = provenance, evidence_ids = sort(unique(evidence_ids)), limitations = limitations,
       uncertainty = uncertainty, potentially_appropriate_activities = sort(unique(activities)),
       diagnostic_status = if (type == "UNDETERMINED") "UNKNOWN" else "OBSERVED_NOT_DIAGNOSTIC")
}

derive_pedagogical_needs <- function(profile, candidates = data.frame(), personal_verified = FALSE) {
  out <- list()
  # Inventory is enough to identify an initial-learning opportunity, never a
  # personal deficit. This supports a conservative first contact with no history.
  if (is.data.frame(candidates) && nrow(candidates) && all(c("scope_id", "activity_type", "in_syllabus", "material_available") %in% names(candidates))) {
    eligible <- candidates[which(candidates$in_syllabus %in% TRUE & candidates$material_available %in% TRUE), , drop = FALSE]
    for (scope in sort(unique(as.character(eligible$scope_id)))) {
      rows <- eligible[as.character(eligible$scope_id) == scope, , drop = FALSE]
      if (any(rows$activity_type == "LEARN_NEW")) out[[length(out) + 1L]] <- new_pedagogical_need("INITIAL_LEARNING", scope,
        "VERIFIED_CURRICULUM_AND_ACTIVITY_INVENTORY", limitations = "No personal history: novelty is curricular, not inferred from learner knowledge.",
        uncertainty = "PERSONAL_KNOWLEDGE_UNKNOWN", activities = "LEARN_NEW")
      if (any(rows$activity_type == "DIAGNOSE_CONCEPT")) out[[length(out) + 1L]] <- new_pedagogical_need("DIAGNOSTIC", scope,
        "VERIFIED_CURRICULUM_AND_ACTIVITY_INVENTORY", limitations = "No personal history: diagnostic need is an information-gathering option, not a gap claim.",
        uncertainty = "PERSONAL_KNOWLEDGE_UNKNOWN", activities = "DIAGNOSE_CONCEPT")
    }
  }
  if (is.list(profile) && isTRUE(personal_verified)) {
    execution <- profile$execution$observations
    if (is.data.frame(execution) && nrow(execution)) for (i in which(execution$category != "UNDETERMINED")) out[[length(out) + 1L]] <- new_pedagogical_need("EXAM_EXECUTION_ERROR", execution$event_id[i],
      paste0("DESCRIPTIVE_EXECUTION:", execution$source_id[i]), execution$event_id[i],
      "Observed execution category does not establish psychological cause.", "NOT_ESTABLISHED", "DIAGNOSE_CONCEPT")
  }
  if (!length(out)) out <- list(new_pedagogical_need("UNDETERMINED", "UNKNOWN_SCOPE", "NO_SUFFICIENT_EVIDENCE"))
  out
}

conservative_decision_policy <- function() list(version = "conservative-decision-v2", status = "CONFIGURED_POLICY",
  rules = c("FSRS_DUE_ONLY_WITH_VERIFIED_MEMORY_EVIDENCE", "VERIFY_SYLLABUS_MATERIAL_PREREQUISITES_TIME",
    "PREFER_DIAGNOSTIC_WHEN_PERSONAL_KNOWLEDGE_UNKNOWN", "ALLOW_NEW_CONTENT_ONLY_FROM_VERIFIED_INVENTORY",
    "DO_NOT_CLAIM_EXPECTED_GAIN_OR_CAUSAL_EFFECT"), can_apply = FALSE, can_schedule = FALSE)

initial_inventory_recommendation <- function(snapshot, context, candidates) {
  if (!is.data.frame(candidates) || !nrow(candidates)) return(NULL)
  req <- c("candidate_id", "activity_type", "scope_id", "contest_id", "estimated_minutes", "material_available", "in_syllabus", "prerequisites_status", "risk", "inventory_verified", "curriculum_source_id")
  if (!all(req %in% names(candidates))) return(NULL)
  eligible <- candidates[candidates$contest_id == context$contest_id & candidates$activity_type %in% c("DIAGNOSE_CONCEPT", "LEARN_NEW") &
    candidates$in_syllabus %in% TRUE & candidates$material_available %in% TRUE & candidates$prerequisites_status %in% c("SATISFIED", "NOT_APPLICABLE") &
    candidates$risk == "LOW_REVERSIBLE" & candidates$inventory_verified %in% TRUE & !is.na(candidates$curriculum_source_id) & nzchar(candidates$curriculum_source_id) &
    is.finite(candidates$estimated_minutes) & candidates$estimated_minutes > 0 & candidates$estimated_minutes <= context$available_minutes, , drop = FALSE]
  if (!nrow(eligible)) return(NULL)
  rank <- ifelse(eligible$activity_type == "DIAGNOSE_CONCEPT", 1L, 2L)
  selected <- eligible[order(rank, eligible$estimated_minutes, eligible$candidate_id), , drop = FALSE][1L, ]
  list(candidate_id = selected$candidate_id, status = "PROPOSED_NOT_APPLIED", basis = "CURRICULUM_INVENTORY_INITIAL_POLICY_V1",
       personal_inference = FALSE, can_apply = FALSE, can_schedule = FALSE,
       limitations = "No personal history: recommendation is a reversible curriculum/inventory action, not personalization.")
}

new_decision_ledger <- function(run_id, proposal = NULL) list(schema_version = "1.0.0", run_id = run_id,
  candidate_activities = "RECORDED_SEPARATELY", recommendation = proposal, decision_authorization = "NOT_AUTHORIZED",
  execution = "NOT_RECORDED", execution_conditions = "NOT_RECORDED", immediate_result = "NOT_RECORDED",
  independent_later_evaluation = "PENDING", observed_outcome = "PENDING", inference_limitations = c("Unexecuted recommendation receives no outcome credit.", "Temporal association is not causal evidence."))

audit_decision_lifecycle <- function(records) {
  required <- c("recommendation_id", "recommendation_status", "authorization_status", "execution_status")
  if (!is.data.frame(records) || !all(required %in% names(records))) stop("INVALID_DECISION_LIFECYCLE")
  outcome <- rep("PENDING", nrow(records))
  ignored <- records$execution_status %in% c("IGNORED", "SUBSTITUTED", "INTERRUPTED", "PARTIAL")
  outcome[ignored] <- "NOT_ATTRIBUTABLE_NOT_FULLY_EXECUTED"
  fully_executed <- records$execution_status == "COMPLETED" & records$authorization_status == "AUTHORIZED"
  outcome[fully_executed] <- "ELIGIBLE_FOR_INDEPENDENT_FOLLOWUP"
  data.frame(recommendation_id = records$recommendation_id, execution_status = records$execution_status,
    outcome_credit_status = outcome, causal_status = "NOT_ESTABLISHED", stringsAsFactors = FALSE)
}
