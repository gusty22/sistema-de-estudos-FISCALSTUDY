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

# Contextual policies are explicit configured rules, not fitted weights or claims
# of learning benefit. Candidate evidence_need_type must be recorded evidence or
# the literal UNKNOWN; it is never inferred from accuracy alone.
admissible_contextual_candidates <- function(candidates, context) {
  req <- c("candidate_id", "activity_type", "scope_id", "contest_id", "estimated_minutes", "material_available", "in_syllabus", "prerequisites_status", "risk", "evidence_need_type", "evidence_verified")
  if (!is.data.frame(candidates) || !all(req %in% names(candidates))) return(candidates[FALSE, , drop = FALSE])
  candidates[candidates$contest_id == context$contest_id & candidates$material_available %in% TRUE & candidates$in_syllabus %in% TRUE &
    candidates$prerequisites_status %in% c("SATISFIED", "NOT_APPLICABLE") & candidates$risk == "LOW_REVERSIBLE" &
    is.finite(candidates$estimated_minutes) & candidates$estimated_minutes > 0 & candidates$estimated_minutes <= context$available_minutes, , drop = FALSE]
}

decision_trace <- function(snapshot, candidates, context, policy_comparison) {
  eligible <- admissible_contextual_candidates(candidates, context)
  rejected <- if (is.data.frame(candidates)) setdiff(as.character(candidates$candidate_id), as.character(eligible$candidate_id)) else character()
  list(schema_version = "1.0.0", trace_type = "PEDAGOGICAL_DECISION_TRACE_V1",
    snapshot = list(run_id = snapshot$run_id, cutoff = snapshot$cutoff, student_id = snapshot$student_id),
    policy_versions = names(policy_comparison$choices), eligible_evidence = as.character(eligible$candidate_id[eligible$evidence_verified %in% TRUE]),
    insufficient_evidence = as.character(eligible$candidate_id[eligible$evidence_verified %in% TRUE == FALSE]),
    candidates = as.character(candidates$candidate_id), rejected_candidates = rejected,
    verified_constraints = list(time_minutes = context$available_minutes, contest_id = context$contest_id),
    comparison = policy_comparison, limitations = c("Trace records executed rules, not post-hoc reasons.", "No policy efficacy or causal claim."))
}

choose_contextual_policy <- function(candidates, context, policy = c("EVIDENCE_CONTEXTUAL_V1", "SHORTEST_ADMISSIBLE_V1", "CURRICULAR_CONSERVATIVE_V1")) {
  policy <- match.arg(policy); admitted <- admissible_contextual_candidates(candidates, context)
  empty <- list(candidate_id = NULL, status = "ABSTAIN", policy_version = policy, rationale = "NO_ADMISSIBLE_ACTIVITY", expected_gain = "NOT_ESTABLISHED")
  if (!nrow(admitted)) return(empty)
  # FSRS due remains protected, but it is not absolute when a bounded review
  # capacity is declared: the contextual policy reserves one curricular option.
  rank <- switch(policy,
    SHORTEST_ADMISSIBLE_V1 = rep(1L, nrow(admitted)),
    CURRICULAR_CONSERVATIVE_V1 = ifelse(admitted$activity_type == "LEARN_NEW", 1L, 2L),
    EVIDENCE_CONTEXTUAL_V1 = ifelse(admitted$evidence_verified %in% TRUE & admitted$evidence_need_type == "MEMORY_MAINTENANCE" & admitted$activity_type == "REVIEW_ITEM" & admitted$fsrs_due_verified %in% TRUE & admitted$memory_risk_verified %in% TRUE, 1L,
      ifelse(admitted$evidence_verified %in% TRUE & admitted$evidence_need_type %in% c("OBSERVED_CONCEPTUAL_GAP", "EXAM_EXECUTION_ERROR") & admitted$activity_type == "DIAGNOSE_CONCEPT", 2L,
      ifelse(admitted$evidence_verified %in% TRUE & admitted$evidence_need_type == "TRANSFER_ASSESSMENT" & admitted$activity_type == "DEEPEN_APPLICATION", 3L,
      ifelse(admitted$activity_type == "LEARN_NEW", 4L, 5L)))) )
  if (policy == "EVIDENCE_CONTEXTUAL_V1" && isTRUE(context$review_capacity_exceeded) && isTRUE(context$review_capacity_verified) && any(admitted$activity_type == "LEARN_NEW"))
    rank[admitted$activity_type == "LEARN_NEW"] <- pmin(rank[admitted$activity_type == "LEARN_NEW"], 2L)
  selected <- admitted[order(rank, admitted$estimated_minutes, admitted$candidate_id), , drop = FALSE][1L, ]
  list(candidate_id = selected$candidate_id, status = "PROPOSED_NOT_APPLIED", policy_version = policy,
    rationale = paste0("CONFIGURED_RULE:", selected$evidence_need_type), expected_gain = "NOT_ESTABLISHED",
    can_apply = FALSE, can_schedule = FALSE)
}

compare_contextual_policies <- function(candidates, context) {
  names <- c("EVIDENCE_CONTEXTUAL_V1", "SHORTEST_ADMISSIBLE_V1", "CURRICULAR_CONSERVATIVE_V1")
  choices <- lapply(names, function(p) choose_contextual_policy(candidates, context, p)); names(choices) <- names
  list(contract_version = "1.0.0", choices = choices,
    divergence = length(unique(vapply(choices, function(x) ifelse(is.null(x$candidate_id), "ABSTAIN", x$candidate_id), character(1)))) > 1L,
    inference = "CONFIGURED_POLICY_COMPARISON_NOT_PEDAGOGICAL_SUPERIORITY")
}

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
