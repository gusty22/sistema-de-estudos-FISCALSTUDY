# Conservative, descriptive specialists. No canonical mastery or scheduling writes.
if (!exists("select_evaluable_attempts", mode = "function")) source("R/learning_profile.R")

.evsp_column <- function(x, name, default = NA_character_) {
  if (name %in% names(x)) x[[name]] else rep(default, nrow(x))
}
.evsp_time <- function(x) {
  x <- as.character(x)
  valid <- !is.na(x) & grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$", x)
  out <- rep(as.POSIXct(NA, tz = "UTC"), length(x))
  out[valid] <- as.POSIXct(x[valid], format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC")
  out
}

# Relations are historical assertions, not propagated knowledge. Unknown validity or
# proposed classifications never become confirmed concept evidence.
validate_concept_relations <- function(relations, cutoff) {
  if (is.null(relations)) relations <- data.frame()
  if (!is.data.frame(relations)) stop("concept_relations must be a data.frame")
  cutoff_time <- .evsp_time(cutoff)
  if (length(cutoff_time) != 1L || is.na(cutoff_time)) stop("Invalid UTC cutoff")
  required <- c("question_id", "concept_id", "relation_version", "source_id",
                "classification_status", "valid_from", "recorded_at")
  if (nrow(relations) && !all(required %in% names(relations))) stop("Incomplete concept relation contract")
  if (!nrow(relations)) return(list(relations = relations, eligible = logical(), issues = character()))
  if (any(vapply(relations[required], function(x) any(is.na(x) | !nzchar(trimws(as.character(x)))), logical(1))))
    stop("Missing concept relation identity/provenance")
  begin <- .evsp_time(relations$valid_from)
  recorded <- .evsp_time(relations$recorded_at)
  end_text <- .evsp_column(relations, "valid_to")
  end <- .evsp_time(end_text)
  open <- is.na(end_text) | !nzchar(as.character(end_text))
  valid <- !is.na(begin) & !is.na(recorded) & (open | (!is.na(end) & end > begin)) &
    begin <= cutoff_time & recorded <= cutoff_time
  status <- as.character(relations$classification_status)
  if (any(!status %in% c("CONFIRMED", "AI_PROPOSED"))) stop("Unknown classification status")
  key <- paste(relations$question_id, relations$concept_id, relations$relation_version, sep = "\r")
  if (anyDuplicated(key)) stop("Duplicate concept relation identity/version")
  # Overlapping confirmed versions for the same edge are contradictory.
  for (i in seq_len(nrow(relations))) for (j in seq_len(nrow(relations))) {
    if (j <= i || !valid[i] || !valid[j] || status[i] != "CONFIRMED" || status[j] != "CONFIRMED") next
    if (relations$question_id[i] == relations$question_id[j] && relations$concept_id[i] == relations$concept_id[j]) {
      ei <- if (open[i]) Inf else as.numeric(end[i]); ej <- if (open[j]) Inf else as.numeric(end[j])
      if (max(as.numeric(begin[i]), as.numeric(begin[j])) < min(ei, ej))
        stop("Overlapping confirmed concept relation versions")
    }
  }
  list(relations = relations, eligible = valid & status == "CONFIRMED",
       issues = unique(c(if (any(!valid)) "RELATION_TEMPORAL_VALIDITY_UNVERIFIED",
                         if (any(status == "AI_PROPOSED")) "AI_PROPOSED_CLASSIFICATION")))
}

build_evidence_specialists <- function(attempts_df, cutoff, concept_relations = NULL,
                                       questions_df = NULL, provenance_audit = NULL) {
  if (is.null(attempts_df)) attempts_df <- data.frame()
  if (!is.data.frame(attempts_df)) stop("attempts_df must be a data.frame")
  cutoff_time <- .evsp_time(cutoff)
  if (length(cutoff_time) != 1L || is.na(cutoff_time)) stop("Invalid UTC cutoff")
  relations <- validate_concept_relations(concept_relations, cutoff)
  if (all(c("origin", "origin_type") %in% names(attempts_df)) && any(
    is.na(attempts_df$origin) | is.na(attempts_df$origin_type) |
    as.character(attempts_df$origin) != as.character(attempts_df$origin_type))) stop("CONFLICTING_ORIGIN_ALIASES")
  n <- nrow(attempts_df)
  id <- as.character(.evsp_column(attempts_df, "event_id"))
  qid <- as.character(.evsp_column(attempts_df, "question_id"))
  instant <- .evsp_time(.evsp_column(attempts_df, "occurred_at"))
  origin <- as.character(.evsp_column(attempts_df, "origin_type"))
  if (!"origin_type" %in% names(attempts_df)) origin <- as.character(.evsp_column(attempts_df, "origin"))
  selected <- select_evaluable_attempts(attempts_df, questions_df)
  duplicate <- duplicated(id) | duplicated(id, fromLast = TRUE)
  missing_id <- is.na(id) | !nzchar(trimws(id))
  missing_question <- is.na(qid) | !nzchar(trimws(qid))
  temporal <- !is.na(instant) & instant <= cutoff_time
  observed <- selected$evaluable_mask & temporal & !missing_id & !duplicate & !missing_question
  if (is.null(provenance_audit)) provenance_audit <- attr(attempts_df, "provenance_info")
  audited <- is.list(provenance_audit) && isTRUE(provenance_audit$is_proven_operational) &&
    isTRUE(provenance_audit$is_real_student_data) && isTRUE(provenance_audit$can_generate_student_profile)
  personal_origin <- !is.na(origin) & origin == "REAL_STUDY"
  # Whole-snapshot purity is intentional: filtering does not launder mixed provenance.
  personal <- n > 0L && audited && all(personal_origin)
  eligible <- observed & personal
  assistance <- as.character(.evsp_column(attempts_df, "assistance_status"))
  exposure <- as.character(.evsp_column(attempts_df, "answer_exposed"))
  independent <- eligible & assistance == "NONE" & toupper(exposure) %in% c("FALSE", "0")
  independent[is.na(independent)] <- FALSE
  outcome <- toupper(as.character(.evsp_column(attempts_df, "is_correct"))) %in% c("TRUE", "1")
  reason <- vapply(seq_len(n), function(i) paste(c(
    if (missing_id[i]) "MISSING_EVENT_ID", if (duplicate[i]) "DUPLICATE_EVENT_ID",
    if (missing_question[i]) "MISSING_QUESTION_ID", if (is.na(instant[i])) "MISSING_OR_INVALID_TIMESTAMP",
    if (!is.na(instant[i]) && instant[i] > cutoff_time) "FUTURE_EVENT",
    if (!selected$evaluable_mask[i]) "NON_EVALUABLE_OUTCOME",
    if (!personal_origin[i]) "NON_PERSONAL_ORIGIN", if (!audited) "UNVERIFIED_SOURCE",
    if (!personal && n > 0L) "SNAPSHOT_NOT_PERSONAL",
    if (eligible[i] && !independent[i]) "INDEPENDENT_RETRIEVAL_NOT_ESTABLISHED"), collapse = "|"), character(1))
  registry <- data.frame(event_id = id, question_id = qid,
    occurred_at = as.character(.evsp_column(attempts_df, "occurred_at")), origin = origin,
    observed_eligible = observed, personal_eligible = eligible, independent_eligible = independent,
    blocking_codes = reason, stringsAsFactors = FALSE)
  registry <- registry[order(is.na(instant), instant, id, qid, origin, reason,
                             observed, eligible, independent, na.last = TRUE), , drop = FALSE]
  rownames(registry) <- NULL
  chronological <- order(instant, id, na.last = TRUE)
  repeated <- rep(FALSE, n)
  seen <- character()
  for (i in chronological[eligible[chronological]]) {
    repeated[i] <- qid[i] %in% seen
    seen <- c(seen, qid[i])
  }
  relation_rows <- relations$relations
  concept_observations <- data.frame(event_id = character(), concept_id = character(),
    relation_version = character(), n_item_concepts = integer(), inference_status = character(), stringsAsFactors = FALSE)
  if (nrow(relation_rows)) for (i in which(eligible)) {
    begin <- .evsp_time(relation_rows$valid_from)
    recorded <- .evsp_time(relation_rows$recorded_at)
    end_text <- .evsp_column(relation_rows, "valid_to")
    end <- .evsp_time(end_text)
    active <- relations$eligible & relation_rows$question_id == qid[i] & begin <= instant[i] & recorded <= instant[i] &
      (is.na(end_text) | !nzchar(as.character(end_text)) | (!is.na(end) & instant[i] < end))
    active[is.na(active)] <- FALSE
    rows <- relation_rows[active, , drop = FALSE]
    if (nrow(rows)) concept_observations <- rbind(concept_observations, data.frame(
      event_id = rep(id[i], nrow(rows)), concept_id = rows$concept_id,
      relation_version = rows$relation_version, n_item_concepts = rep(nrow(rows), nrow(rows)),
      inference_status = rep(if (nrow(rows) > 1L) "COMPOSITE_ITEM_NOT_ATTRIBUTABLE" else "ITEM_ASSOCIATION_ONLY", nrow(rows)), stringsAsFactors = FALSE))
  }
  if (nrow(concept_observations)) {
    concept_observations <- concept_observations[order(concept_observations$event_id, concept_observations$concept_id), , drop = FALSE]
    rownames(concept_observations) <- NULL
  }
  dimension <- as.character(.evsp_column(attempts_df, "assessment_dimension"))
  verification <- as.character(.evsp_column(attempts_df, "assessment_verification"))
  verified <- !is.na(verification) & verification == "VERIFIED"
  dimension_summary <- function(target, mask) {
    use <- mask & !is.na(dimension) & dimension == target & verified
    list(status = if (any(use)) "OBSERVED_TASK_PERFORMANCE" else "NOT_ESTABLISHED",
      event_ids = sort(id[use]), n_observations = as.integer(sum(use)), n_correct = as.integer(sum(outcome[use])),
      mastery_status = "NOT_ESTABLISHED", probability = NA_real_)
  }
  task_relation <- as.character(.evsp_column(attempts_df, "task_relation"))
  transfer_mask <- independent & !repeated & !is.na(task_relation) & task_relation == "INDEPENDENT_CONTEXT_VERIFIED"
  confidence <- suppressWarnings(as.numeric(as.character(.evsp_column(attempts_df, "confidence_level"))))
  meta_mask <- independent & is.finite(confidence) & confidence %in% 1:5
  meta <- lapply(1:5, function(level) {
    use <- meta_mask & confidence == level
    data.frame(confidence_level = level, n_observations = as.integer(sum(use)), n_correct = as.integer(sum(outcome[use])))
  })
  taxonomy <- c("KNOWLEDGE_ABSENT", "RETRIEVAL_FAILURE", "CONCEPTUAL_CONFUSION", "APPLICATION_ERROR",
                "INTERPRETATION_ERROR", "CALCULATION_OR_PROCEDURE", "SELECTION_OR_TRANSCRIPTION",
                "UNDETERMINED", "UNVERIFIED_REPORT")
  reported <- as.character(.evsp_column(attempts_df, "error_category"))
  kind <- as.character(.evsp_column(attempts_df, "error_evidence_kind"))
  source <- as.character(.evsp_column(attempts_df, "error_source_id"))
  execution <- data.frame(event_id = character(), category = character(), reported_category = character(), evidence_kind = character(),
                          source_id = character(), causal_status = character(), stringsAsFactors = FALSE)
  for (i in which(eligible & !outcome)) {
    known_source <- !is.na(source[i]) && nzchar(trimws(source[i]))
    verified_error <- known_source && !is.na(kind[i]) && kind[i] %in% c("DIRECT_OBSERVATION", "VERIFIED_EXTERNAL_ASSESSMENT")
    category <- if (!is.na(reported[i]) && reported[i] %in% taxonomy && verified_error) reported[i] else
      if (!is.na(reported[i]) && nzchar(reported[i])) "UNVERIFIED_REPORT" else "UNDETERMINED"
    execution <- rbind(execution, data.frame(event_id = id[i], category = category, reported_category = reported[i],
      evidence_kind = if (!is.na(kind[i])) kind[i] else "UNKNOWN", source_id = source[i],
      causal_status = "NOT_ESTABLISHED", stringsAsFactors = FALSE))
  }
  if (nrow(execution)) { execution <- execution[order(execution$event_id), , drop = FALSE]; rownames(execution) <- NULL }
  list(contract_version = "1.0.0", specialist_id = "DESCRIPTIVE_EVIDENCE_DIMENSIONS_V1",
    policy_version = "EVIDENCE_DIMENSIONS_V1", cutoff = cutoff,
    status = if (!n) "NO_DATA" else if (!personal) "UNVERIFIED_SOURCE" else if (!any(eligible)) "INSUFFICIENT_EVIDENCE" else "OBSERVATIONAL_ONLY",
    is_real_student_profile = personal && any(eligible), evidence_registry = registry,
    capabilities = list(can_describe = any(observed), can_predict = FALSE, can_propose = FALSE, can_apply = FALSE, can_schedule = FALSE),
    knowledge = list(comprehension = dimension_summary("COMPREHENSION", independent),
      concept_observations = concept_observations, mastery_status = "NOT_ESTABLISHED",
      relation_issues = relations$issues, n_unclassified = as.integer(sum(eligible & !id %in% concept_observations$event_id))),
    application = dimension_summary("APPLICATION", independent),
    transfer = dimension_summary("TRANSFER", transfer_mask),
    memory = list(authority = "FSRS", n_repeated_item_attempts = as.integer(sum(eligible & repeated)),
      exposure_basis = "RECORDED_ATTEMPTS_ONLY", retention_status = "NOT_ESTABLISHED", can_schedule = FALSE),
    metacognition = list(status = if (any(meta_mask)) "ORDINAL_OBSERVATIONS_ONLY" else "NO_DATA",
      by_confidence = do.call(rbind, meta), n_observations = as.integer(sum(meta_mask)),
      high_confidence_errors = as.integer(sum(meta_mask & confidence >= 4 & !outcome, na.rm = TRUE)),
      probability_calibration_status = "NOT_ESTABLISHED"),
    execution = list(taxonomy = taxonomy, observations = execution, psychological_cause_status = "NOT_ESTABLISHED"),
    limitations = c("Observed task correctness does not establish conceptual mastery or cause of error.",
      "First recorded item is not proof of absolute novelty; item repetition is not transfer.",
      "Verified labels are supplied assertions; provenance audit does not establish truth.",
      "No probability of mastery, intervention effect, approval or retention is estimated."))
}

# Additive bridge to the common orchestrator envelope. Unknown numerical quantities
# become explicit states in transport, never fabricated zeroes or probabilities.
evidence_specialist_results <- function(profile, student_id, run_id) {
  if (!exists("build_specialist_result", mode = "function")) stop("Common specialist contract unavailable")
  if (!is.list(profile) || !identical(profile$contract_version, "1.0.0")) stop("Unknown evidence profile contract")
  portable <- function(x) {
    if (is.data.frame(x)) return(lapply(seq_len(nrow(x)), function(i) portable(as.list(x[i, , drop = FALSE]))))
    if (is.list(x)) return(lapply(x, portable))
    if (is.numeric(x) && any(!is.finite(x))) {
      if (length(x) == 1L) return("NOT_ESTABLISHED")
      return(lapply(x, portable))
    }
    if (is.character(x) && anyNA(x)) { x[is.na(x)] <- "UNKNOWN"; return(x) }
    x
  }
  registry <- profile$evidence_registry
  ids <- sort(unique(registry$event_id[registry$personal_eligible]))
  components <- c("knowledge", "application", "transfer", "memory", "metacognition", "execution")
  targets <- c("KNOWLEDGE_OBSERVATIONS", "APPLICATION_OBSERVATIONS", "TRANSFER_OBSERVATIONS",
               "ITEM_MEMORY_CONTEXT", "ORDINAL_METACOGNITION", "EXECUTION_OBSERVATIONS")
  lapply(seq_along(components), function(i) build_specialist_result(
    specialist_id = paste0("DESCRIPTIVE_", toupper(components[i]), "_V1"),
    responsibility = paste("Describe recorded", components[i], "evidence without latent mastery or causal inference"),
    target = targets[i], student_id = student_id, scope_id = student_id, cutoff = profile$cutoff,
    evidence_ids = ids, result = list(status = profile$status, observations = portable(profile[[components[i]]])),
    model_version = "DESCRIPTIVE_EVIDENCE_DIMENSIONS_V1", validation_status = "CONFIGURED_POLICY",
    epistemic_type = "OBSERVATION", unit = "OBSERVED_COUNTS_AND_EXPLICIT_STATES",
    limitations = profile$limitations, source_ids = paste0("event:", ids), run_id = run_id))
}
