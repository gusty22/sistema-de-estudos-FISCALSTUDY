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
        "UNVERIFIED_CURRICULAR_OPPORTUNITY", limitations = "No personal history: novelty is curricular, not inferred from learner knowledge.",
        uncertainty = "PERSONAL_KNOWLEDGE_UNKNOWN", activities = "LEARN_NEW")
      if (any(rows$activity_type == "DIAGNOSE_CONCEPT")) out[[length(out) + 1L]] <- new_pedagogical_need("DIAGNOSTIC", scope,
        "UNVERIFIED_CURRICULAR_OPPORTUNITY", limitations = "No personal history: diagnostic need is an information-gathering option, not a gap claim.",
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
# Canonical identities bind the trace to all inputs, including rejected candidates.
# Hashes establish identity, never authority. Registry arguments are trusted host
# configuration; the CLI never imports them from a request document.
.pd_canonical <- function(x) {
  if (is.data.frame(x)) {
    x <- x[, sort(names(x), method = "radix"), drop = FALSE]
    rows <- lapply(seq_len(nrow(x)), function(i) .pd_canonical(as.list(x[i, , drop = FALSE])))
    keys <- vapply(rows, function(r) as.character(jsonlite::toJSON(r, auto_unbox = TRUE, null = "null", na = "null", digits = 16)), character(1))
    return(rows[order(keys, method = "radix")])
  }
  if (is.list(x)) {
    if (!is.null(names(x))) x <- x[order(names(x), method = "radix")]
    return(lapply(x, .pd_canonical))
  }
  x
}
.pd_identity <- function(snapshot, candidates, context) {
  if (!exists("compute_file_sha256", mode = "function")) source("R/provenance.R")
  path <- tempfile(); on.exit(unlink(path), add = TRUE)
  value <- jsonlite::toJSON(.pd_canonical(list(snapshot = snapshot, candidates = candidates, context = context)),
    auto_unbox = TRUE, null = "null", na = "null", digits = 16)
  writeBin(charToRaw(enc2utf8(as.character(value))), path)
  hash <- compute_file_sha256(path)
  if (is.na(hash)) stop("DECISION_IDENTITY_UNAVAILABLE")
  hash
}

# Standalone policies have no authority to admit activities. A gate from the
# original orchestrator is mandatory, and must match the exact input identity.
admissible_contextual_candidates <- function(candidates, context, gate = NULL, snapshot = NULL) {
  if (!is.data.frame(candidates)) stop("INVALID_CANDIDATES")
  if (is.null(gate)) return(candidates[FALSE, , drop = FALSE])
  if (!inherits(gate, "orchestrator_admission")) stop("UNTRUSTED_ADMISSION_GATE")
  if (!identical(gate$input_id, .pd_identity(snapshot, candidates, context))) stop("DECISION_INPUT_MISMATCH")
  candidates[match(gate$admitted_ids, candidates$candidate_id), , drop = FALSE]
}

.pd_inventory_authority <- function(row, snapshot, registry) {
  matching <- Filter(function(a) {
    is.list(a) && identical(a$target, "CURRICULUM_INVENTORY") &&
      identical(a$validation_status, "CONFIGURED_POLICY") && isTRUE(a$can_propose) &&
      all(vapply(c("inventory_id", "inventory_version", "curriculum_source_id", "scope_id", "contest_id"),
        function(k) .lo_text(row[[k]]) && identical(a[[k]], row[[k]]), logical(1))) &&
      is.finite(.lo_time(a$valid_from)) && is.finite(.lo_time(a$valid_until)) &&
      .lo_time(a$valid_from) <= .lo_time(snapshot$cutoff) && .lo_time(a$valid_until) >= .lo_time(snapshot$cutoff)
  }, registry)
  # Ambiguous or contradictory active versions cannot establish inventory facts.
  length(matching) == 1L && all(vapply(c("activity_type", "material_available", "in_syllabus", "prerequisites_status", "estimated_minutes", "risk"),
    function(k) !is.null(row[[k]]) && identical(matching[[1L]][[k]], row[[k]]), logical(1)))
}

# A claim is usable only if an authorized, validated specialist supplies it and
# every referenced event has matching source, scope, type, version and validity.
# *_verified input columns are intentionally never used here.
.pd_bindings <- function(snapshot, candidates, checked, admitted_ids, registry) {
  out <- list(); failures <- list(); events <- snapshot$evidence
  req <- c("event_id", "source_id", "scope_id", "evidence_type", "evidence_version", "occurred_at", "valid_until")
  if (!is.data.frame(events) || !all(req %in% names(events))) {
    attr(out, "rejections") <- lapply(admitted_ids, function(id) list(candidate_id = id, codes = "MISSING_CONTEXTUAL_EVIDENCE_SCHEMA"))
    return(out)
  }
  for (id in admitted_ids) {
    reject <- function(code) { failures[[id]] <<- list(candidate_id = id, codes = sort(unique(code), method = "radix")) }
    row <- as.list(candidates[match(id, candidates$candidate_id), , drop = FALSE])
    support <- Filter(function(s) identical(s$specialist_id, row$support_specialist_id) &&
      isTRUE(s$decision_eligible) && identical(s$run_id, snapshot$run_id), checked)
    if (length(support) != 1L) { reject("NO_SAME_RUN_AUTHORIZED_SUPPORT"); next }
    s <- support[[1]]; need <- s$result$need_type
    allowed <- switch(s$target, ITEM_MEMORY = "MEMORY_MAINTENANCE",
      KNOWLEDGE_OBSERVATIONS = c("OBSERVED_CONCEPTUAL_GAP", "EXAM_EXECUTION_ERROR"),
      APPLICATION_OBSERVATIONS = "TRANSFER_ASSESSMENT", character())
    if (!.lo_text(need) || !need %in% allowed) { reject("NO_CONFIRMED_PEDAGOGICAL_NEED"); next }
    authority <- Filter(function(a) is.list(a) && identical(a$specialist_id, s$specialist_id) &&
      identical(a$model_version, s$model_version) && identical(a$target, s$target) && isTRUE(a$can_propose) &&
      identical(a$scope_id, row$scope_id) && is.character(a$source_ids) && !anyNA(a$source_ids) &&
      all(s$source_ids %in% a$source_ids) && is.character(a$evidence_versions) && length(a$evidence_versions) > 0L && !anyNA(a$evidence_versions) && all(nzchar(trimws(a$evidence_versions))) && is.character(a$evidence_types) && need %in% a$evidence_types &&
      is.finite(.lo_time(a$valid_from)) && is.finite(.lo_time(a$valid_until)) &&
      .lo_time(a$valid_from) <= .lo_time(s$cutoff) && .lo_time(a$valid_until) >= .lo_time(snapshot$cutoff), registry)
    if (!length(authority)) { reject("MISSING_SOURCE_SCOPE_TYPE_VERSION_TEMPORAL_AUTHORIZATION"); next }
    if (need == "MEMORY_MAINTENANCE" && (!isTRUE(s$result$due) || !isTRUE(s$result$memory_risk))) { reject("DUE_OR_MEMORY_RISK_NOT_CONFIRMED"); next }
    ev <- events[match(s$evidence_ids, events$event_id), , drop = FALSE]
    if (!nrow(ev) || anyNA(ev[req]) ||
        !all(vapply(ev[c("source_id", "scope_id", "evidence_type", "evidence_version")], is.character, logical(1)))) { reject("MALFORMED_EVIDENCE_REFERENCE"); next }
    issues <- unlist(lapply(seq_len(nrow(ev)), function(i) c(
      if (!.lo_text(ev$source_id[i]) || !ev$source_id[i] %in% s$source_ids) "EVIDENCE_SOURCE_MISMATCH",
      if (!identical(ev$scope_id[i], row$scope_id)) "EVIDENCE_SCOPE_MISMATCH",
      if (!identical(ev$evidence_type[i], need)) "EVIDENCE_TYPE_MISMATCH",
      if (!.lo_text(ev$evidence_version[i]) || !ev$evidence_version[i] %in% unlist(lapply(authority, function(a) a$evidence_versions), use.names = FALSE)) "EVIDENCE_VERSION_MISMATCH",
      if (!is.finite(.lo_time(ev$occurred_at[i]))) "INVALID_EVIDENCE_TIME"
      else if (.lo_time(ev$occurred_at[i]) > .lo_time(s$cutoff)) "FUTURE_EVIDENCE",
      if (!is.finite(.lo_time(ev$valid_until[i]))) "UNKNOWN_EVIDENCE_VALIDITY"
      else if (.lo_time(ev$valid_until[i]) < .lo_time(snapshot$cutoff)) "EXPIRED_EVIDENCE")), use.names = FALSE)
    if (length(issues)) { reject(issues); next }
    refs <- lapply(order(ev$event_id, method = "radix"), function(i) list(evidence_id = ev$event_id[i], event_id = ev$event_id[i],
      source_id = ev$source_id[i], scope_id = ev$scope_id[i], evidence_type = ev$evidence_type[i],
      evidence_version = ev$evidence_version[i], occurred_at = ev$occurred_at[i], valid_until = ev$valid_until[i],
      specialist_id = s$specialist_id, specialist_version = s$specialist_version,
      model_version = s$model_version, validation_status = s$validation_status, specialist_cutoff = s$cutoff,
      authorization = "HOST_AUTHORITY_REGISTRY", origin = ev$origin[i]))
    out[[id]] <- list(need_type = need, evidence = refs)
  }
  attr(out, "rejections") <- unname(failures)
  out
}

choose_contextual_policy <- function(candidates, context, policy = c("EVIDENCE_CONTEXTUAL_V1", "SHORTEST_ADMISSIBLE_V1", "CURRICULAR_CONSERVATIVE_V1"), gate = NULL, snapshot = NULL) {
  policy <- match.arg(policy)
  admitted <- admissible_contextual_candidates(candidates, context, gate, snapshot)
  rank <- integer(nrow(admitted)); rules <- character(nrow(admitted)); selectable <- rep(TRUE, nrow(admitted)); decisive <- list()
  for (i in seq_len(nrow(admitted))) {
    id <- admitted$candidate_id[i]; activity <- admitted$activity_type[i]
    binding <- gate$bindings[[id]]; need <- binding$need_type
    rank[i] <- 5L; rules[i] <- "UNKNOWN_PERSONAL_STATE_CONSERVATIVE_DIAGNOSTIC"
    if (activity == "LEARN_NEW") { rank[i] <- 4L; rules[i] <- "ADMISSIBLE_CURRICULAR_OPPORTUNITY" }
    if (policy == "EVIDENCE_CONTEXTUAL_V1" && !is.null(need)) {
      if (need == "MEMORY_MAINTENANCE" && activity == "REVIEW_ITEM") {rank[i] <- 1L; rules[i] <- "VERIFIED_DUE_AND_MEMORY_RISK"}
      if (need %in% c("OBSERVED_CONCEPTUAL_GAP", "EXAM_EXECUTION_ERROR") && activity == "DIAGNOSE_CONCEPT") {rank[i] <- 2L; rules[i] <- paste0("VERIFIED_", need)}
      if (need == "TRANSFER_ASSESSMENT" && activity == "DEEPEN_APPLICATION") {rank[i] <- 3L; rules[i] <- "VERIFIED_TRANSFER_ASSESSMENT"}
    }
    if (policy == "EVIDENCE_CONTEXTUAL_V1" && rank[i] == 5L && !activity %in% c("LEARN_NEW", "DIAGNOSE_CONCEPT")) {
      selectable[i] <- FALSE; rules[i] <- "INSUFFICIENT_CONTEXTUAL_EVIDENCE"
    }
    if (policy == "SHORTEST_ADMISSIBLE_V1") {rank[i] <- 1L; rules[i] <- "SHORTEST_ADMISSIBLE"}
    if (policy == "CURRICULAR_CONSERVATIVE_V1") {rank[i] <- if (activity == "LEARN_NEW") 1L else 2L; rules[i] <- "CURRICULAR_CONSERVATIVE"}
  }
  ordering <- order(rank, admitted$estimated_minutes, admitted$candidate_id, method = "radix")
  selectable_order <- ordering[selectable[ordering]]
  selected <- if (length(selectable_order)) selectable_order[1L] else integer()
  chosen <- if (length(selected)) admitted$candidate_id[selected] else NULL
  if (length(selected) && policy == "EVIDENCE_CONTEXTUAL_V1" && !is.null(gate$bindings[[chosen]])) decisive <- gate$bindings[[chosen]]$evidence
  list(candidate_id = chosen, status = if (is.null(chosen)) "ABSTAIN" else "PROPOSED_NOT_APPLIED", policy_version = policy,
    rationale = if (is.null(chosen)) "NO_ADMISSIBLE_ACTIVITY" else rules[selected],
    executed_rules = data.frame(candidate_id = as.character(admitted$candidate_id), rank = rank, rule = rules, selectable = selectable),
    tie_break = c("rule_rank_ascending", "estimated_minutes_ascending", "candidate_id_UTF8_radix"),
    ranked_candidates = as.character(admitted$candidate_id[ordering]), determining_evidence = decisive,
    input_id = if (is.null(gate)) NULL else gate$input_id,
    evaluated_candidates = as.character(admitted$candidate_id),
    expected_gain = "NOT_ESTABLISHED", validation_status = "EXPERIMENTAL", can_apply = FALSE, can_schedule = FALSE)
}

compare_contextual_policies <- function(candidates, context, gate = NULL, snapshot = NULL) {
  versions <- c("EVIDENCE_CONTEXTUAL_V1", "SHORTEST_ADMISSIBLE_V1", "CURRICULAR_CONSERVATIVE_V1")
  choices <- lapply(versions, function(p) choose_contextual_policy(candidates, context, p, gate, snapshot)); names(choices) <- versions
  list(contract_version = "1.1.0", input_id = .pd_identity(snapshot, candidates, context), choices = choices,
    admitted_ids = if (is.null(gate)) character() else gate$admitted_ids,
    divergence = length(unique(vapply(choices, function(x) if (is.null(x$candidate_id)) "ABSTAIN" else x$candidate_id, character(1)))) > 1L,
    inference = "CONFIGURED_POLICY_COMPARISON_NOT_PEDAGOGICAL_SUPERIORITY")
}

decision_trace <- function(snapshot, candidates, context, policy_comparison, gate = NULL) {
  identity <- .pd_identity(snapshot, candidates, context)
  if (!identical(identity, policy_comparison$input_id) || is.null(gate) || !identical(identity, gate$input_id)) stop("DECISION_INPUT_MISMATCH")
  # Reject altered comparisons too. Executed rule records are kept by the policy.
  replay <- compare_contextual_policies(candidates, context, gate, snapshot)
  if (!identical(.pd_identity(replay, NULL, NULL), .pd_identity(policy_comparison, NULL, NULL))) stop("DECISION_COMPARISON_MISMATCH")
  refs <- unlist(lapply(gate$bindings, function(b) b$evidence), recursive = FALSE, use.names = FALSE)
  list(schema_version = "1.1.0", trace_type = "PEDAGOGICAL_DECISION_TRACE_V1", input_id = identity,
    snapshot = list(run_id = snapshot$run_id, cutoff = snapshot$cutoff, student_id = snapshot$student_id),
    policy_versions = names(policy_comparison$choices),
    eligible_evidence = sort(unique(vapply(refs, function(e) e$evidence_id, character(1))), method = "radix"),
    evidence_references = refs,
    insufficient_evidence = setdiff(gate$admitted_ids, names(gate$bindings)),
    candidates = sort(as.character(candidates$candidate_id), method = "radix"),
    admitted_candidates = gate$admitted_ids,
    rejected_candidates = vapply(gate$rejections, function(r) r$candidate_id, character(1)),
    rejection_details = gate$rejections,
    admission_reasons = gate$inclusion_reasons,
    untrusted_declarations_ignored = c("evidence_verified", "fsrs_due_verified", "memory_risk_verified", "inventory_verified", "evidence_need_type", "review_capacity_verified"),
    contextual_evidence_rejections = attr(gate$bindings, "rejections"),
    unknown_states = list(review_capacity = "NOT_ESTABLISHED"),
    inclusion_rule = "ORIGINAL_ORCHESTRATOR_VALIDATOR_OR_AUTHORIZED_COLD_CURRICULUM",
    verified_constraints = list(time_minutes = context$available_minutes, contest_id = context$contest_id),
    comparison = policy_comparison, limitations = c("Executed configured rules do not establish efficacy.",
      "Unknown evidence remains unknown; review capacity declarations grant no priority."))
}

initial_inventory_recommendation <- function(snapshot, context, candidates, authority_registry = list()) {
  if (!is.data.frame(candidates) || !nrow(candidates)) return(NULL)
  req <- c("candidate_id", "activity_type", "scope_id", "contest_id", "estimated_minutes", "material_available", "in_syllabus", "prerequisites_status", "risk")
  if (!all(req %in% names(candidates))) return(NULL)
  valid <- vapply(seq_len(nrow(candidates)), function(i) {
    row <- as.list(candidates[i, , drop = FALSE])
    .pd_inventory_authority(row, snapshot, authority_registry) && identical(row$contest_id, context$contest_id) &&
      row$activity_type %in% c("LEARN_NEW", "DIAGNOSE_CONCEPT") && isTRUE(row$in_syllabus) && isTRUE(row$material_available) &&
      row$prerequisites_status %in% c("SATISFIED", "NOT_APPLICABLE") && identical(row$risk, "LOW_REVERSIBLE") &&
      .lo_number(row$estimated_minutes) && row$estimated_minutes > 0 && row$estimated_minutes <= context$available_minutes
  }, logical(1))
  eligible <- candidates[valid, , drop = FALSE]
  if (!nrow(eligible)) return(NULL)
  selected <- eligible[order(eligible$activity_type != "DIAGNOSE_CONCEPT", eligible$estimated_minutes, eligible$candidate_id, method = "radix"), , drop = FALSE][1L, ]
  list(candidate_id = selected$candidate_id, status = "PROPOSED_NOT_APPLIED", basis = "CURRICULUM_INVENTORY_INITIAL_POLICY_V1",
       personal_inference = FALSE, can_apply = FALSE, can_schedule = FALSE,
       limitations = "Curricular opportunity; personal knowledge remains unknown.")
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
