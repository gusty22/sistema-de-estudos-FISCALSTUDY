# R/retrieval_diagnostics.R
# Pre-update FSRS outcome audit. This module never schedules or diagnoses a cause.
# FSRS remains the sole authority for memory state and review scheduling.

parse_fsrs_evidence_time <- function(x) {
  x <- as.character(x)
  parsed <- suppressWarnings(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
  missing <- is.na(parsed)
  if (any(missing)) {
    parsed[missing] <- suppressWarnings(as.POSIXct(x[missing], format = "%Y-%m-%d %H:%M:%OS", tz = "UTC"))
  }
  parsed
}

calculate_retrieval_surprise <- function(attempts_df = NULL,
                                         low_retrievability_threshold = 0.50,
                                         high_retrievability_threshold = 0.80,
                                         minimum_observations_for_descriptive_review = 30L) {
  if (length(low_retrievability_threshold) != 1L ||
      length(high_retrievability_threshold) != 1L ||
      is.na(low_retrievability_threshold) || is.na(high_retrievability_threshold) ||
      !is.finite(low_retrievability_threshold) || !is.finite(high_retrievability_threshold) ||
      low_retrievability_threshold < 0 || high_retrievability_threshold > 1 ||
      low_retrievability_threshold >= high_retrievability_threshold) {
    stop("Retrievability thresholds must satisfy 0 <= low < high <= 1.")
  }
  if (length(minimum_observations_for_descriptive_review) != 1L ||
      is.na(minimum_observations_for_descriptive_review) ||
      !is.finite(minimum_observations_for_descriptive_review) ||
      minimum_observations_for_descriptive_review < 1) {
    stop("minimum_observations_for_descriptive_review must be a positive finite scalar.")
  }

  policy <- list(
    policy_version = "fsrs_outcome_audit_v1",
    low_retrievability_threshold = as.numeric(low_retrievability_threshold),
    high_retrievability_threshold = as.numeric(high_retrievability_threshold),
    minimum_observations_for_descriptive_review = as.integer(minimum_observations_for_descriptive_review),
    thresholds_are_triage_rules_not_significance_tests = TRUE
  )
  cautions <- c(
    "An error with low pre-update retrievability is consistent with the FSRS estimate; it does not prove why the student forgot.",
    "An error with high pre-update retrievability is an investigation candidate, not proof of conceptual difficulty or FSRS failure.",
    "Question ambiguity, changed item difficulty, content classification, guessing, interruption, and grading remain alternative explanations.",
    "The pre-update FSRS state is sampled during answer submission, before the outcome updates that state; it is not a measurement taken before the student first saw the question.",
    "This analysis does not update FSRS state, change review dates, diagnose personality, or select an intervention.",
    "Threshold bands are configurable operational triage rules; their values are not validated decision boundaries."
  )

  empty_attempts <- data.frame(
    event_id = character(0), question_id = character(0),
    fsrs_model_version = character(0), fsrs_evidence_status = character(0),
    fsrs_retrievability_pre_update = numeric(0),
    classification = character(0), snapshot_status = character(0),
    stringsAsFactors = FALSE
  )
  if (is.null(attempts_df) || nrow(attempts_df) == 0L) {
    return(list(
      status = "NO_DATA", analysis_version = "1.0.0",
      input_attempt_count = 0L, evaluable_attempt_count = 0L,
      valid_preupdate_snapshot_count = 0L, excluded_snapshot_count = 0L,
      classification_counts = list(), prediction_metrics = list(status = "NOT_CALCULATED"),
      per_attempt = empty_attempts, investigation_queue = list(),
      policy = policy, methodological_cautions = cautions,
      is_validated = FALSE, can_apply = FALSE
    ))
  }

  required <- c("is_correct", "gabarito_status", "fsrs_retrievability_pre_update",
                "fsrs_prediction_timestamp", "fsrs_model_version", "fsrs_evidence_status", "occurred_at")
  missing_fields <- setdiff(required, names(attempts_df))
  if (length(missing_fields) > 0L) {
    return(list(
      status = "MODEL_INPUTS_MISSING", analysis_version = "1.0.0",
      input_attempt_count = as.integer(nrow(attempts_df)),
      evaluable_attempt_count = NA_integer_, valid_preupdate_snapshot_count = 0L,
      excluded_snapshot_count = as.integer(nrow(attempts_df)),
      missing_fields = as.list(missing_fields),
      classification_counts = list(MODEL_INPUTS_MISSING = as.integer(nrow(attempts_df))),
      prediction_metrics = list(status = "NOT_CALCULATED"),
      per_attempt = empty_attempts, investigation_queue = list(),
      policy = policy, methodological_cautions = cautions,
      is_validated = FALSE, can_apply = FALSE
    ))
  }

  selection <- if (exists("select_evaluable_attempts", mode = "function")) {
    select_evaluable_attempts(attempts_df)
  } else {
    raw <- toupper(trimws(as.character(attempts_df$is_correct)))
    keep <- raw %in% c("TRUE", "FALSE", "1", "0") &
      !toupper(trimws(as.character(attempts_df$gabarito_status))) %in% c("ANULADA", "AUSENTE", "SOB_REVISAO")
    selected <- attempts_df[keep, , drop = FALSE]
    selected$is_correct <- raw[keep] %in% c("TRUE", "1")
    list(attempts_df = selected, original_count = nrow(attempts_df))
  }
  evaluable <- selection$attempts_df
  n <- nrow(evaluable)
  if (n == 0L) {
    return(list(
      status = "NO_EVALUABLE_ATTEMPTS", analysis_version = "1.0.0",
      input_attempt_count = as.integer(nrow(attempts_df)), evaluable_attempt_count = 0L,
      valid_preupdate_snapshot_count = 0L, excluded_snapshot_count = as.integer(nrow(attempts_df)),
      classification_counts = list(NOT_EVALUABLE = as.integer(nrow(attempts_df))),
      prediction_metrics = list(status = "NOT_CALCULATED"),
      per_attempt = empty_attempts, investigation_queue = list(),
      policy = policy, methodological_cautions = cautions,
      is_validated = FALSE, can_apply = FALSE
    ))
  }

  raw_p <- suppressWarnings(as.numeric(evaluable$fsrs_retrievability_pre_update))
  state_time <- parse_fsrs_evidence_time(evaluable$fsrs_prediction_timestamp)
  answer_time <- parse_fsrs_evidence_time(evaluable$occurred_at)
  model_version <- trimws(as.character(evaluable$fsrs_model_version))
  model_version[is.na(model_version)] <- ""
  evidence_status <- trimws(as.character(evaluable$fsrs_evidence_status))
  evidence_status[is.na(evidence_status)] <- ""
  outcome <- as.logical(evaluable$is_correct)
  p_valid <- is.finite(raw_p) & raw_p >= 0 & raw_p <= 1
  time_valid <- !is.na(state_time) & !is.na(answer_time) & state_time <= answer_time
  version_valid <- nzchar(model_version)
  evidence_valid <- evidence_status %in% "UNCALIBRATED_ITEM_ESTIMATE"

  snapshot_status <- rep("VALID_PREUPDATE_SNAPSHOT", n)
  snapshot_status[!p_valid] <- "RETRIEVABILITY_MISSING_OR_OUT_OF_RANGE"
  snapshot_status[p_valid & !time_valid] <- "FSRS_STATE_NOT_PROVEN_PREUPDATE"
  snapshot_status[p_valid & time_valid & !version_valid] <- "FSRS_MODEL_VERSION_MISSING"
  snapshot_status[p_valid & time_valid & version_valid & !evidence_valid] <- "FSRS_EVIDENCE_STATUS_NOT_ELIGIBLE"
  valid_snapshot <- p_valid & time_valid & version_valid & evidence_valid
  classification <- ifelse(!is.na(outcome), "MEMORY_ESTIMATE_UNAVAILABLE", "NOT_EVALUABLE")
  classification[valid_snapshot & outcome] <- "RETRIEVAL_SUCCESS"
  classification[valid_snapshot & outcome & raw_p <= low_retrievability_threshold] <- "SUCCESS_WITH_LOW_PREDICTED_RETRIEVAL"
  classification[valid_snapshot & !outcome & raw_p <= low_retrievability_threshold] <- "ERROR_WITH_LOW_PREDICTED_RETRIEVAL"
  classification[valid_snapshot & !outcome & raw_p > low_retrievability_threshold & raw_p < high_retrievability_threshold] <- "ERROR_WITH_INTERMEDIATE_PREDICTION"
  classification[valid_snapshot & !outcome & raw_p >= high_retrievability_threshold] <- "ERROR_WITH_HIGH_PREDICTED_RETRIEVAL"

  model_rows <- data.frame(
    model_version = model_version[valid_snapshot],
    predicted_retrievability = raw_p[valid_snapshot],
    observed_retrieval = as.integer(outcome[valid_snapshot]),
    stringsAsFactors = FALSE
  )
  score_by_version <- list()
  if (nrow(model_rows) > 0L) {
    for (version in sort(unique(model_rows$model_version))) {
      rows <- model_rows[model_rows$model_version == version, , drop = FALSE]
      clipped <- pmin(pmax(rows$predicted_retrievability, 1e-15), 1 - 1e-15)
      score_by_version[[version]] <- list(
        n_observations = as.integer(nrow(rows)),
        mean_predicted_retrievability = mean(rows$predicted_retrievability),
        observed_retrieval_rate = mean(rows$observed_retrieval),
        brier_score = mean((rows$observed_retrieval - rows$predicted_retrievability)^2),
        log_loss = mean(-ifelse(rows$observed_retrieval == 1L, log(clipped), log1p(-clipped))),
        evidence_status = if (nrow(rows) >= minimum_observations_for_descriptive_review) "DESCRIPTIVE_SAMPLE_ONLY" else "INSUFFICIENT_EVIDENCE"
      )
    }
  }

  event_id <- if ("event_id" %in% names(evaluable)) as.character(evaluable$event_id) else rep(NA_character_, n)
  question_id <- if ("question_id" %in% names(evaluable)) as.character(evaluable$question_id) else rep(NA_character_, n)
  discipline <- if ("disciplina" %in% names(evaluable)) as.character(evaluable$disciplina) else if ("discipline" %in% names(evaluable)) as.character(evaluable$discipline) else rep(NA_character_, n)
  topic <- if ("assunto" %in% names(evaluable)) as.character(evaluable$assunto) else rep(NA_character_, n)
  per_attempt <- data.frame(
    event_id = event_id,
    question_id = question_id,
    disciplina = discipline,
    assunto = topic,
    observed_correct = outcome,
    fsrs_model_version = model_version,
    fsrs_retrievability_pre_update = raw_p,
    snapshot_status = snapshot_status,
    classification = classification,
    stringsAsFactors = FALSE
  )
  investigation_rows <- which(classification == "ERROR_WITH_HIGH_PREDICTED_RETRIEVAL")
  investigation_queue <- lapply(investigation_rows, function(i) list(
    event_id = event_id[i],
    question_id = question_id[i],
    discipline = discipline[i],
    topic = topic[i],
    predicted_retrievability = raw_p[i],
    fsrs_model_version = model_version[i],
    status = "INVESTIGATE_CAUSE_WITH_STUDENT",
    possible_review_targets = list("CONCEPT_CONFUSION", "ITEM_INTERPRETATION",
                                   "ITEM_OR_KEY_QUALITY", "CONTEXT_OR_INTERRUPTION", "UNKNOWN"),
    conclusion = "Cause is unresolved; this signal only prioritizes a follow-up question."
  ))

  by_topic <- list()
  topic_valid <- valid_snapshot & !is.na(discipline) & nzchar(trimws(discipline)) & !is.na(topic) & nzchar(trimws(topic))
  if (any(topic_valid)) {
    topic_key <- paste0(nchar(discipline[topic_valid]), ":", discipline[topic_valid],
                        nchar(topic[topic_valid]), ":", topic[topic_valid])
    for (key in unique(topic_key)) {
      idx <- which(topic_valid)[topic_key == key]
      group_class <- classification[idx]
      n_group <- length(idx)
      label_discipline <- discipline[idx[1]]
      label_topic <- topic[idx[1]]
      high_errors <- sum(group_class == "ERROR_WITH_HIGH_PREDICTED_RETRIEVAL")
      low_errors <- sum(group_class == "ERROR_WITH_LOW_PREDICTED_RETRIEVAL")
      by_topic[[key]] <- list(
        discipline = label_discipline,
        topic = label_topic,
        n_valid_preupdate_snapshots = as.integer(n_group),
        high_predicted_retrieval_errors = as.integer(high_errors),
        low_predicted_retrieval_errors = as.integer(low_errors),
        high_predicted_error_rate = high_errors / n_group,
        support_status = if (n_group >= 5L) "OBSERVED_PATTERN_REVIEW" else "LOW_SUPPORT",
        interpretation = "Observed memory-prediction/outcome discrepancy; not topic mastery or a diagnosed cause."
      )
    }
  }
  counts <- as.list(table(factor(classification, levels = unique(classification))))
  names(counts) <- unique(classification)
  valid_n <- sum(valid_snapshot)
  overall_status <- if (valid_n == 0L) "NO_VALID_PREUPDATE_SNAPSHOTS" else if (valid_n < minimum_observations_for_descriptive_review) "INSUFFICIENT_EVIDENCE" else "DESCRIPTIVE_UNVALIDATED"
  list(
    status = overall_status,
    analysis_version = "1.0.0",
    input_attempt_count = as.integer(nrow(attempts_df)),
    evaluable_attempt_count = as.integer(n),
    valid_preupdate_snapshot_count = as.integer(valid_n),
    excluded_snapshot_count = as.integer(n - valid_n),
    classification_counts = counts,
    prediction_metrics = list(
      by_fsrs_model_version = score_by_version,
      metrics_are_descriptive_not_validated = TRUE,
      repeated_attempts_may_not_be_independent = TRUE
    ),
    per_attempt = per_attempt,
    by_topic = by_topic,
    investigation_queue = investigation_queue,
    policy = policy,
    methodological_cautions = cautions,
    is_validated = FALSE,
    can_apply = FALSE
  )
}
