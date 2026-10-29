# Local, observation-only learning orchestration. No database or scheduler access.
# Policy order is configured operational preference, never learned expected gain.

.lo_text <- function(x) is.character(x) && length(x) == 1L && !is.na(x) && nzchar(trimws(x))
.lo_number <- function(x) is.numeric(x) && length(x) == 1L && !is.na(x) && is.finite(x)
.lo_time <- function(x) {
  if (!.lo_text(x) || !grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$", x)) return(NA_real_)
  suppressWarnings(as.numeric(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC")))
}
.lo_finite <- function(x) {
  if (is.numeric(x)) return(all(is.finite(x)))
  if (is.atomic(x) && anyNA(x)) return(FALSE)
  if (is.list(x)) return(all(vapply(x, .lo_finite, logical(1))))
  TRUE
}
.lo_probability_bounds <- function(x) {
  if (!is.list(x)) return(TRUE)
  fields <- names(x)
  if (is.null(fields)) fields <- rep("", length(x))
  all(vapply(seq_along(x), function(i) {
    value <- x[[i]]
    probability_field <- grepl("probability|retrievability", fields[i], ignore.case = TRUE) || identical(fields[i], "p")
    (!probability_field || !is.numeric(value) || all(is.finite(value) & value >= 0 & value <= 1)) && .lo_probability_bounds(value)
  }, logical(1)))
}
.lo_false_capabilities <- function() list(can_describe = FALSE, can_predict = FALSE,
  can_propose = FALSE, can_apply = FALSE, can_schedule = FALSE)
if (!exists("derive_pedagogical_needs", mode = "function")) source("R/pedagogical_decision.R")

# Trusted ingress audit. The binding is an in-process attribute, not a JSON
# field: serialized declarations must be re-audited against actual source bytes.
audit_learning_provenance <- function(events, file_path, manifest = NULL, declared_provenance = NULL) {
  if (!exists("verify_data_provenance", mode = "function")) source("R/provenance.R")
  audit <- verify_data_provenance(events, declared_provenance = declared_provenance,
    file_path = file_path, manifest = manifest)
  attr(audit, "orchestrator_evidence_id") <- .pd_identity(events, NULL, NULL)
  audit
}

# Common additive envelope. Explicit missing/unknown states are data, not zero.
build_specialist_result <- function(specialist_id, responsibility, target, student_id,
                                    scope_id, cutoff, evidence_ids = character(),
                                    result = list(status = "NO_DATA"),
                                    model_version = "UNKNOWN", validation_status = "MODEL_NOT_VALIDATED",
                                    epistemic_type = "OBSERVATION", horizon = "NOT_APPLICABLE",
                                    unit = "NOT_APPLICABLE", uncertainty = "NOT_ESTABLISHED",
                                    limitations = "No personal or causal validity established.",
                                    source_ids = character(), run_id = "UNSPECIFIED") {
  list(schema_version = "1.0.0", specialist_id = specialist_id, specialist_version = "1.0.0",
       responsibility = responsibility, target = target, student_id = student_id,
       scope_id = scope_id, horizon = horizon, evidence_ids = sort(unique(evidence_ids)),
       source_ids = sort(unique(source_ids)), cutoff = cutoff, result = result,
       unit = unit, interpretation = "Target-specific result; incompatible units are not pooled.",
       uncertainty = uncertainty, limitations = limitations,
       validation_status = validation_status, epistemic_type = epistemic_type,
       model_version = model_version, policy_version = "conservative-learning-v1",
       run_id = run_id, decision_eligible = FALSE, blocking_codes = character(),
       capabilities = .lo_false_capabilities())
}

# Caller-supplied capabilities are never trusted. Authority is recomputed.
validate_specialist_result <- function(x, student_id, cutoff, evidence_ids, authority_registry = list(), evidence_times = NULL) {
  codes <- character()
  required <- c("schema_version", "specialist_id", "specialist_version", "responsibility", "target",
                "student_id", "scope_id", "horizon", "cutoff", "unit", "interpretation", "uncertainty",
                "validation_status", "epistemic_type", "model_version", "policy_version", "run_id")
  if (!is.list(x)) x <- list()
  for (field in required) if (!.lo_text(x[[field]])) codes <- c(codes, paste0("MISSING_OR_INVALID_", toupper(field)))
  if (!identical(x$schema_version, "1.0.0")) codes <- c(codes, "UNSUPPORTED_SPECIALIST_SCHEMA")
  for (key in c("due", "memory_risk", "review_capacity_exceeded")) {
    value <- if (is.list(x$result)) x$result[[key]] else NULL
    if (!is.null(value) && (!is.logical(value) || length(value) != 1L || is.na(value))) codes <- c(codes, paste0("INVALID_RESULT_BOOLEAN_", toupper(key)))
  }
  if (!is.list(x$result) || !.lo_finite(x$result) || !.lo_probability_bounds(x$result)) codes <- c(codes, "INVALID_RESULT")
  if (is.list(x$result) && all(c("numerator", "denominator") %in% names(x$result))) {
    k <- x$result$numerator; n <- x$result$denominator
    if (!.lo_number(k) || !.lo_number(n) || k < 0 || n < 0 || k > n || k != floor(k) || n != floor(n)) codes <- c(codes, "INCONSISTENT_DENOMINATOR")
  }
  if (!is.null(evidence_times) && is.character(x$evidence_ids) && is.finite(.lo_time(x$cutoff))) {
    times <- evidence_times[x$evidence_ids]
    if (any(times > .lo_time(x$cutoff), na.rm = TRUE)) codes <- c(codes, "EVIDENCE_AFTER_SPECIALIST_CUTOFF")
  }
  if (!is.character(x$evidence_ids) || anyNA(x$evidence_ids) || anyDuplicated(x$evidence_ids)) codes <- c(codes, "INVALID_EVIDENCE_IDS")
  else if (length(setdiff(x$evidence_ids, evidence_ids))) codes <- c(codes, "UNKNOWN_EVIDENCE_ID")
  if (!is.character(x$source_ids) || anyNA(x$source_ids) || length(x$source_ids) == 0L || any(!nzchar(x$source_ids))) codes <- c(codes, "UNVERIFIED_SOURCE")
  if (!is.character(x$limitations) || !length(x$limitations) || anyNA(x$limitations)) codes <- c(codes, "MISSING_LIMITATIONS")
  if (!identical(x$student_id, student_id)) codes <- c(codes, "STUDENT_MISMATCH")
  if (!is.finite(.lo_time(x$cutoff)) || !is.finite(.lo_time(cutoff)) || .lo_time(x$cutoff) > .lo_time(cutoff)) codes <- c(codes, "INVALID_OR_FUTURE_SPECIALIST_CUTOFF")
  if (is.null(x$model_version) || x$model_version %in% c("UNKNOWN", "NOT_ESTABLISHED", "")) codes <- c(codes, "UNKNOWN_MODEL_VERSION")
  if (!.lo_text(x$epistemic_type) || !x$epistemic_type %in% c("OBSERVATION", "SELF_REPORT", "EXTERNAL_ASSESSMENT", "ESTIMATE", "HYPOTHESIS", "PREDICTION", "RECOMMENDATION")) codes <- c(codes, "INVALID_EPISTEMIC_TYPE")
  if (!.lo_text(x$validation_status) || !x$validation_status %in% c("OPERATIONAL_VALIDATED", "CONFIGURED_POLICY", "EXPERIMENTAL", "MODEL_NOT_VALIDATED", "UNAVAILABLE")) codes <- c(codes, "UNKNOWN_VALIDATION_STATUS")
  if (identical(x$validation_status, "UNAVAILABLE")) codes <- c(codes, "SPECIALIST_UNAVAILABLE")
  # Source verification and non-empty evidence are prerequisites even for descriptive claims.
  valid <- !length(codes)
  has_evidence <- length(x$evidence_ids) > 0L
  capabilities <- .lo_false_capabilities()
  capabilities$can_describe <- valid && has_evidence
  capabilities$can_predict <- valid && has_evidence && identical(x$epistemic_type, "PREDICTION") &&
    x$validation_status %in% c("OPERATIONAL_VALIDATED", "EXPERIMENTAL")
  registered <- any(vapply(authority_registry, function(a) is.list(a) &&
    identical(a$specialist_id, x$specialist_id) && identical(a$model_version, x$model_version) &&
    identical(a$target, x$target) && identical(a$unit, x$unit) && identical(a$horizon, x$horizon) &&
    identical(a$validation_status, x$validation_status) && identical(a$epistemic_type, x$epistemic_type) &&
    isTRUE(a$can_propose), logical(1)))
  capabilities$can_propose <- registered && valid && has_evidence &&
    x$validation_status %in% c("OPERATIONAL_VALIDATED", "CONFIGURED_POLICY") &&
    x$epistemic_type %in% c("OBSERVATION", "ESTIMATE", "PREDICTION", "RECOMMENDATION")
  if (valid && !has_evidence) codes <- c(codes, "INSUFFICIENT_EVIDENCE")
  if (valid && x$validation_status %in% c("EXPERIMENTAL", "MODEL_NOT_VALIDATED")) codes <- c(codes, "NO_DECISION_AUTHORITY")
  if (!registered) codes <- c(codes, "NOT_IN_AUTHORITY_REGISTRY")
  x$capabilities <- capabilities
  x$decision_eligible <- capabilities$can_propose
  x$blocking_codes <- sort(unique(codes))
  x
}

conservative_learning_policy <- function() list(
  version = "conservative-learning-v1", status = "CONFIGURED_POLICY",
  priority_order = c("MAINTENANCE_DUE", "DIAGNOSTIC_GAP", "NEW_CONTENT", "DEEPEN"),
  tie_break = c("estimated_minutes_ascending", "candidate_id_lexical"),
  baseline = "SHORTEST_ADMISSIBLE_V1", expected_gain = "NOT_ESTABLISHED",
  can_apply = FALSE, can_schedule = FALSE)

# snapshot evidence is an immutable registry, not an instruction channel.
# Candidacy requires available inventory; no material, due date or prerequisite is invented.
orchestrate_learning <- function(snapshot, context, specialists = list(), candidates = data.frame(), authority_registry = list()) {
  if (!is.list(snapshot) || !.lo_text(snapshot$student_id) || !.lo_text(snapshot$run_id) ||
      !is.finite(.lo_time(snapshot$cutoff))) stop("INVALID_SNAPSHOT_IDENTITY_OR_CUTOFF")
  if (!is.list(context) || !.lo_text(context$contest_id) || !.lo_number(context$available_minutes) || context$available_minutes < 0) stop("INVALID_CONTEXT")
  if (!is.list(specialists) || !is.data.frame(candidates)) stop("INVALID_ORCHESTRATOR_INPUT")
  policy <- conservative_learning_policy()
  for (key in c("review_capacity_exceeded", "review_capacity_verified")) {
    value <- context[[key]]
    if (!is.null(value) && (!is.logical(value) || length(value) != 1L)) stop("INVALID_CONTEXT_BOOLEAN")
  }
  evidence <- snapshot$evidence
  integrity <- character()
  ids <- character()
  if (!is.data.frame(evidence) || !all(c("event_id", "occurred_at", "origin") %in% names(evidence))) {
    integrity <- "MISSING_EVIDENCE_REGISTRY"
  } else {
    if (nrow(evidence) && (!is.character(evidence$event_id) || anyNA(evidence$event_id) || any(!nzchar(evidence$event_id)))) integrity <- c(integrity, "INVALID_EVENT_ID")
    if (anyDuplicated(evidence$event_id)) integrity <- c(integrity, "DUPLICATE_EVENT_ID")
    ts <- vapply(as.list(evidence$occurred_at), .lo_time, numeric(1))
    if (any(!is.finite(ts))) integrity <- c(integrity, "INVALID_EVENT_TIMESTAMP")
    if (any(ts > .lo_time(snapshot$cutoff), na.rm = TRUE)) integrity <- c(integrity, "FUTURE_EVENT")
    if (nrow(evidence) && (!is.character(evidence$origin) || anyNA(evidence$origin) || any(!evidence$origin %in% c("REAL_STUDY", "SYNTHETIC_FIXTURE", "AUTOMATED_TEST", "SYNTHETIC_BENCHMARK")))) integrity <- c(integrity, "UNKNOWN_EVENT_ORIGIN")
    if ("origin_type" %in% names(evidence) && any(is.na(evidence$origin_type) | is.na(evidence$origin) | as.character(evidence$origin_type) != as.character(evidence$origin))) integrity <- c(integrity, "CONFLICTING_ORIGIN_ALIASES")
    ids <- if (nrow(evidence)) sort(unique(evidence$event_id)) else character()
  }
  evidence_state <- if (length(integrity)) "BLOCKED" else if (!length(ids)) "NO_DATA" else if (all(evidence$origin == "REAL_STUDY")) "PERSONAL_DECLARED_SOURCE" else if (any(evidence$origin == "REAL_STUDY")) "MIXED_ORIGIN" else "SYNTHETIC_ONLY"
  if (evidence_state == "MIXED_ORIGIN") integrity <- c(integrity, "MIXED_ORIGIN")
  # A declared origin is not an operational provenance audit.
  proven <- is.list(snapshot$provenance) && all(vapply(c("is_proven_operational", "is_real_student_data", "can_generate_student_profile"), function(k) isTRUE(snapshot$provenance[[k]]), logical(1)))
  audited_binding <- is.list(snapshot$provenance) &&
    identical(attr(snapshot$provenance, "orchestrator_evidence_id"), .pd_identity(evidence, NULL, NULL))
  # Byte integrity plus a production declaration does not authenticate a source.
  # Independent custody is attested only by the trusted in-process host adapter;
  # neither this marker nor R attributes are accepted from CLI JSON documents.
  source_authorized <- isTRUE(attr(snapshot$provenance, "trusted_source_authorized"))
  personal_verified <- identical(evidence_state, "PERSONAL_DECLARED_SOURCE") && proven && audited_binding && source_authorized
  # Built-in descriptive analysis runs locally; imported results gain no authority.
  if (!personal_verified) snapshot$learner_evidence_profile <- NULL
  automatic_specialists <- length(specialists) == 0L
  if (automatic_specialists && !length(integrity) && is.data.frame(evidence) && all(c("question_id", "is_correct") %in% names(evidence))) {
    if (!exists("build_evidence_specialists", mode = "function")) source("R/evidence_specialists.R")
    profile <- build_evidence_specialists(evidence, snapshot$cutoff, snapshot$concept_relations,
      provenance_audit = if (personal_verified) snapshot$provenance else list())
    snapshot$learner_evidence_profile <- profile
    specialists <- evidence_specialist_results(profile, snapshot$student_id, snapshot$run_id)
    # Inventory/uncertainty rule: no claim of topic weakness or learned gain.
    eligible_ids <- profile$evidence_registry$event_id[profile$evidence_registry$personal_eligible]
    minimal_inventory <- c("candidate_id", "scope_id", "activity_type", "support_specialist_id", "priority")
    if (personal_verified && !length(integrity) && length(eligible_ids) && nrow(candidates) && all(minimal_inventory %in% names(candidates))) {
      for (i in seq_len(nrow(candidates))) {
        use_builtin <- is.character(candidates$support_specialist_id) && !is.na(candidates$support_specialist_id[i]) &&
          candidates$support_specialist_id[i] %in% c("", "BUILTIN_INVENTORY_POLICY")
        supported <- identical(candidates$activity_type[i], "DIAGNOSE_CONCEPT") && identical(candidates$priority[i], "DIAGNOSTIC_GAP") ||
          identical(candidates$activity_type[i], "LEARN_NEW") && identical(candidates$priority[i], "NEW_CONTENT")
        if (!use_builtin || !supported || !.lo_text(candidates$candidate_id[i]) || !.lo_text(candidates$scope_id[i])) next
        specialist_id <- paste0("INVENTORY_POLICY_", candidates$candidate_id[i])
        specialists[[length(specialists) + 1L]] <- build_specialist_result(specialist_id,
          "Low-risk inventory proposal; no inferred mastery, weakness or intervention gain",
          "AVAILABLE_ACTIVITY_UNCERTAINTY_POLICY", snapshot$student_id, candidates$scope_id[i], snapshot$cutoff,
          eligible_ids, result = list(status = "CONFIGURED_INVENTORY_RULE", gap_status = "NOT_ESTABLISHED", expected_gain = "NOT_ESTABLISHED"),
          model_version = "INVENTORY_UNCERTAINTY_RULE_V1", validation_status = "CONFIGURED_POLICY",
          source_ids = c(paste0("event:", eligible_ids), paste0("inventory:", candidates$candidate_id[i])), run_id = snapshot$run_id)
        authority_registry[[length(authority_registry) + 1L]] <- list(specialist_id = specialist_id,
          model_version = "INVENTORY_UNCERTAINTY_RULE_V1", target = "AVAILABLE_ACTIVITY_UNCERTAINTY_POLICY",
          unit = "NOT_APPLICABLE", horizon = "NOT_APPLICABLE", validation_status = "CONFIGURED_POLICY", epistemic_type = "OBSERVATION", can_propose = TRUE)
        candidates$support_specialist_id[i] <- specialist_id
      }
    }
  }
  if (length(authority_registry)) authority_registry <- authority_registry[order(vapply(authority_registry,
    function(x) if (is.list(x) && .lo_text(x$specialist_id)) x$specialist_id else "", character(1)))]
  evidence_times <- if (is.data.frame(evidence) && all(c("event_id", "occurred_at") %in% names(evidence)))
    stats::setNames(vapply(as.list(evidence$occurred_at), .lo_time, numeric(1)), evidence$event_id) else NULL
  checked <- lapply(specialists, validate_specialist_result, student_id = snapshot$student_id,
                    cutoff = snapshot$cutoff, evidence_ids = ids, authority_registry = authority_registry, evidence_times = evidence_times)
  checked <- lapply(checked, function(s) {
    if (!identical(s$run_id, snapshot$run_id)) {
      s$decision_eligible <- FALSE; s$capabilities <- .lo_false_capabilities()
      s$blocking_codes <- sort(unique(c(s$blocking_codes, "SPECIALIST_RUN_MISMATCH")))
    }
    s
  })
  specialist_ids <- vapply(checked, function(x) if (.lo_text(x$specialist_id)) x$specialist_id else "INVALID", character(1))
  if (anyDuplicated(specialist_ids)) integrity <- c(integrity, "DUPLICATE_SPECIALIST_ID")
  checked <- checked[order(specialist_ids)]
  # Compare only identical targets, scope, horizon, unit and cutoff. Never average predictions.
  conflicts <- list()
  if (length(checked) > 1L) for (i in seq_len(length(checked) - 1L)) for (j in seq.int(i + 1L, length(checked))) {
    a <- checked[[i]]; b <- checked[[j]]
    keys <- c("target", "scope_id", "horizon", "unit", "cutoff")
    comparable <- all(vapply(keys, function(k) identical(a[[k]], b[[k]]), logical(1)))
    if (comparable && isTRUE(a$capabilities$can_describe) && isTRUE(b$capabilities$can_describe) && !identical(a$result, b$result)) {
      operational <- c(isTRUE(a$decision_eligible), isTRUE(b$decision_eligible))
      conflicts[[length(conflicts) + 1L]] <- list(specialist_ids = sort(c(a$specialist_id, b$specialist_id)),
        target = a$target, scope_id = a$scope_id, resolution = if (sum(operational) == 1L) "RETAIN_AUTHORIZED_REFERENCE" else "UNRESOLVED_ABSTAIN",
        pooled_result = "NOT_APPLICABLE")
    }
  }
  rejections <- list(); admitted <- list(); inclusions <- list()
  required <- c("candidate_id", "activity_type", "scope_id", "contest_id", "priority", "estimated_minutes", "material_available", "in_syllabus", "prerequisites_status", "risk", "support_specialist_id")
  if (nrow(candidates) && !all(required %in% names(candidates))) stop("INVALID_CANDIDATE_SCHEMA")
  if (nrow(candidates) && (!is.character(candidates$candidate_id) || anyNA(candidates$candidate_id) || any(!nzchar(candidates$candidate_id)) || anyDuplicated(candidates$candidate_id))) stop("INVALID_OR_DUPLICATE_CANDIDATE_ID")
  for (idx in seq_len(nrow(candidates))) {
    row <- as.list(candidates[idx, , drop = FALSE]); codes <- integrity; cold_admission <- FALSE
    for (key in intersect(c("material_available", "in_syllabus", "evidence_verified", "fsrs_due_verified", "memory_risk_verified", "inventory_verified"), names(row))) {
      if (!is.logical(row[[key]]) || length(row[[key]]) != 1L) codes <- c(codes, paste0("INVALID_BOOLEAN_", toupper(key)))
    }
    if (!is.null(row$evidence_need_type) && (!.lo_text(row$evidence_need_type) ||
        !row$evidence_need_type %in% c("UNKNOWN", pedagogical_need_types()))) codes <- c(codes, "INVALID_EVIDENCE_NEED_TYPE")
    if (!.lo_text(row$activity_type) || !row$activity_type %in% c("REVIEW_ITEM", "DIAGNOSE_CONCEPT", "LEARN_NEW", "DEEPEN_APPLICATION")) codes <- c(codes, "INVALID_ACTIVITY")
    if (!.lo_text(row$scope_id)) codes <- c(codes, "UNKNOWN_SCOPE")
    if (!identical(row$contest_id, context$contest_id)) codes <- c(codes, "CONTEST_MISMATCH")
    if (!isTRUE(row$in_syllabus)) codes <- c(codes, "SYLLABUS_NOT_CONFIRMED")
    if (!isTRUE(row$material_available)) codes <- c(codes, "MATERIAL_UNAVAILABLE")
    if (!.lo_number(row$estimated_minutes) || row$estimated_minutes <= 0) codes <- c(codes, "INVALID_TIME_COST")
    else if (row$estimated_minutes > context$available_minutes) codes <- c(codes, "TIME_BUDGET_EXCEEDED")
    if (!identical(row$prerequisites_status, "SATISFIED") && !identical(row$prerequisites_status, "NOT_APPLICABLE")) codes <- c(codes, "PREREQUISITES_NOT_ESTABLISHED")
    if (!identical(row$risk, "LOW_REVERSIBLE")) codes <- c(codes, "CONFIRMATION_REQUIRED")
    if (!.lo_text(row$priority) || !row$priority %in% policy$priority_order) codes <- c(codes, "INVALID_POLICY_PRIORITY")
    # Maintenance must originate from an authorized FSRS/operational memory source.
    supporting <- if (.lo_text(row$support_specialist_id)) Filter(function(s) identical(s$specialist_id, row$support_specialist_id), checked) else list()
    if (length(supporting) != 1L || !isTRUE(supporting[[1]]$decision_eligible)) codes <- c(codes, "NO_AUTHORIZED_SUPPORT")
    else {
      support <- supporting[[1]]
      if (!identical(support$scope_id, row$scope_id)) codes <- c(codes, "SUPPORT_SCOPE_MISMATCH")
      allowed_targets <- switch(row$activity_type, REVIEW_ITEM = "ITEM_MEMORY",
        DIAGNOSE_CONCEPT = c("KNOWLEDGE_OBSERVATIONS", "AVAILABLE_ACTIVITY_UNCERTAINTY_POLICY"),
        LEARN_NEW = c("KNOWLEDGE_OBSERVATIONS", "AVAILABLE_ACTIVITY_UNCERTAINTY_POLICY"),
        DEEPEN_APPLICATION = "APPLICATION_OBSERVATIONS", character())
      if (!support$target %in% allowed_targets) codes <- c(codes, "SUPPORT_TARGET_INCOMPATIBLE")
      if (identical(row$activity_type, "REVIEW_ITEM") && !identical(support$target, "ITEM_MEMORY")) codes <- c(codes, "MEMORY_AUTHORITY_REQUIRED")
      if (identical(row$priority, "MAINTENANCE_DUE") && (!identical(row$activity_type, "REVIEW_ITEM") || !isTRUE(support$result$due))) codes <- c(codes, "NO_OPERATIONAL_DUE_EVIDENCE")
      unresolved <- any(vapply(conflicts, function(c) identical(c$resolution, "UNRESOLVED_ABSTAIN") && row$support_specialist_id %in% c$specialist_ids, logical(1)))
      if (unresolved) codes <- c(codes, "UNRESOLVED_SPECIALIST_CONFLICT")
    }
    if (!personal_verified && identical(evidence_state, "PERSONAL_DECLARED_SOURCE")) codes <- c(codes, "UNVERIFIED_OPERATIONAL_SOURCE")
    if (!length(ids)) codes <- c(codes, "INSUFFICIENT_EVIDENCE")
    # Cold-start curriculum authority is host configuration, never an input flag.
    # It only replaces the missing personal-history/support gates, preserving all
    # original material, time, scope, risk, priority and integrity checks.
    if (!length(ids) && !length(integrity) && row$activity_type %in% c("LEARN_NEW", "DIAGNOSE_CONCEPT") &&
        .pd_inventory_authority(row, snapshot, authority_registry)) {
      codes <- setdiff(codes, c("INSUFFICIENT_EVIDENCE", "NO_AUTHORIZED_SUPPORT")); cold_admission <- TRUE
    }
    if (length(codes)) rejections[[length(rejections) + 1L]] <- list(candidate_id = row$candidate_id, codes = sort(unique(codes)))
    else {
      admitted[[length(admitted) + 1L]] <- row
      inclusions[[row$candidate_id]] <- list(candidate_id = row$candidate_id,
        codes = c("ORIGINAL_CONSTRAINTS_SATISFIED", if (cold_admission) "AUTHORIZED_COLD_CURRICULUM" else "AUTHORIZED_SUPPORT_SCOPE_AND_TARGET"))
    }
  }
  if (length(admitted)) admitted <- admitted[order(vapply(admitted, function(x) match(x$priority, policy$priority_order), integer(1)), vapply(admitted, function(x) x$estimated_minutes, numeric(1)), vapply(admitted, function(x) x$candidate_id, character(1)))]
  if (length(rejections)) rejections <- rejections[order(vapply(rejections, function(x) x$candidate_id, character(1)))]
  # All policies receive exactly the candidates admitted above. Optional input
  # flags never participate in contextual evidence verification.
  admitted_ids <- sort(vapply(admitted, function(x) x$candidate_id, character(1)), method = "radix")
  decision_snapshot <- snapshot
  decision_snapshot$source_verification <- list(personal_verified = personal_verified,
    audited_binding = audited_binding, source_authorized = source_authorized, evidence_state = evidence_state, integrity_codes = sort(unique(integrity)))
  decision_snapshot$validated_specialists <- checked
  decision_snapshot$authority_registry <- authority_registry
  gate <- list(input_id = .pd_identity(decision_snapshot, candidates, context), admitted_ids = admitted_ids,
    bindings = .pd_bindings(snapshot, candidates, checked, admitted_ids, authority_registry), rejections = rejections,
    inclusion_reasons = unname(inclusions[admitted_ids]))
  class(gate) <- "orchestrator_admission"
  if (!length(ids)) for (id in admitted_ids) {
    row <- as.list(candidates[match(id, candidates$candidate_id), , drop = FALSE])
    if (.pd_inventory_authority(row, snapshot, authority_registry)) {
      authority <- Filter(function(a) .pd_inventory_authority(row, snapshot, list(a)), authority_registry)[[1L]]
      ref <- list(valid_from = authority$valid_from, valid_until = authority$valid_until, evidence_id = row$inventory_id, inventory_id = row$inventory_id,
        source_id = row$curriculum_source_id, scope_id = row$scope_id, evidence_version = row$inventory_version,
        evidence_type = "CURRICULUM_INVENTORY", authorization = "HOST_AUTHORITY_REGISTRY", personal_evidence = FALSE)
      gate$bindings[[id]] <- list(need_type = if (row$activity_type == "LEARN_NEW") "INITIAL_LEARNING" else "DIAGNOSTIC", evidence = list(ref))
    }
  }
  attr(gate$bindings, "rejections") <- Filter(function(r) !r$candidate_id %in% names(gate$bindings), attr(gate$bindings, "rejections"))
  # Only admitted curriculum can describe an opportunity. Verified personal needs
  # are derived from the same bindings used by the executed contextual policy.
  needs <- list()
  for (id in names(gate$bindings)) {
    binding <- gate$bindings[[id]]
    refs <- binding$evidence
    needs[[length(needs) + 1L]] <- new_pedagogical_need(binding$need_type,
      candidates$scope_id[match(id, candidates$candidate_id)], if (binding$need_type %in% c("INITIAL_LEARNING", "DIAGNOSTIC")) "AUTHORIZED_CURRICULUM_INVENTORY" else "VALIDATED_AUTHORIZED_SPECIALIST",
      vapply(refs, function(e) e$evidence_id, character(1)),
      limitations = "Observed evidence supports a configured rule, not an established diagnosis or causal benefit.",
      uncertainty = if (binding$need_type %in% c("INITIAL_LEARNING", "DIAGNOSTIC")) "PERSONAL_KNOWLEDGE_UNKNOWN" else "NOT_ESTABLISHED",
      activities = candidates$activity_type[match(id, candidates$candidate_id)])
    needs[[length(needs)]]$evidence_references <- refs
  }
  if (!length(needs)) needs <- list(new_pedagogical_need("UNDETERMINED", "UNKNOWN_SCOPE", "NO_CONFIRMED_CONTEXTUAL_EVIDENCE"))
  comparison <- compare_contextual_policies(candidates, context, gate, decision_snapshot)
  proposal <- comparison$choices$EVIDENCE_CONTEXTUAL_V1
  proposal$basis <- "EVIDENCE_CONTEXTUAL_V1_EXPERIMENTAL"
  proposal$personal_inference <- personal_verified && length(proposal$determining_evidence) > 0L
  preferred <- proposal$candidate_id
  baseline <- comparison$choices$SHORTEST_ADMISSIBLE_V1$candidate_id
  trace <- decision_trace(decision_snapshot, candidates, context, comparison, gate)
  list(schema_version = "1.0.0", run_id = snapshot$run_id, student_id = snapshot$student_id,
       cutoff = snapshot$cutoff, mode = "OBSERVATION_ONLY",
       policy = list(version = "EVIDENCE_CONTEXTUAL_V1", status = "EXPERIMENTAL", can_apply = FALSE, can_schedule = FALSE),
       admission_policy = policy,
       decision_policy = list(version = "EVIDENCE_CONTEXTUAL_V1", status = "EXPERIMENTAL", can_apply = FALSE, can_schedule = FALSE),
       pedagogical_needs = needs, policy_comparison = comparison, decision_trace = trace,
       decision_inputs = list(snapshot = .pd_canonical(decision_snapshot), candidates = .pd_canonical(candidates), context = context),
       context_used = list(contest_id = context$contest_id, available_minutes = context$available_minutes),
       authority_registry = authority_registry,
       evidence_state = evidence_state, personal_source_verified = personal_verified,
       integrity_codes = sort(unique(integrity)), evidence_ids = ids,
       learner_evidence_profile = snapshot$learner_evidence_profile,
       specialists = checked, conflicts = conflicts, admissible_candidates = admitted,
       rejected_candidates = rejections, proposal = proposal,
       baseline_comparison = list(policy = policy$baseline, candidate_id = baseline,
         agrees_with_proposal = if (is.null(preferred)) NULL else identical(preferred, baseline),
         benefit_difference = "NOT_ESTABLISHED"),
       uncertainty = list(expected_learning_gain = "NOT_ESTABLISHED", approval_probability = "NOT_APPLICABLE"),
       evaluation_record = new_decision_ledger(snapshot$run_id, proposal),
       limitations = c("Software correctness is not pedagogical validation.", "Candidate priority is configured, not learned.", "No operational schedule or memory state is modified."))
}
