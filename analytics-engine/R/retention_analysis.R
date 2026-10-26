# R/retention_analysis.R
# Observed retrieval history and explicitly exploratory retention modelling.
# FSRS remains the memory scheduling authority.

classify_attempt_history <- function(attempts_df, questions_df = NULL) {
  required <- c("question_id", "occurred_at", "is_correct")
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || !all(required %in% names(attempts_df))) return(data.frame())
  df <- attempts_df
  valid_id <- !is.na(df$question_id) & nzchar(trimws(as.character(df$question_id)))
  df <- df[valid_id, , drop = FALSE]
  if (nrow(df) == 0) return(data.frame())
  df$parsed_time <- suppressWarnings(as.POSIXct(df$occurred_at, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
  missing_time <- is.na(df$parsed_time)
  if (any(missing_time)) df$parsed_time[missing_time] <- suppressWarnings(as.POSIXct(df$occurred_at[missing_time], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
  df <- df[!is.na(df$parsed_time), , drop = FALSE]
  if (nrow(df) == 0) return(data.frame())

  topic_fields <- c("disciplina", "assunto")
  df <- join_question_metadata(df, questions_df, fields = topic_fields)
  for (field in topic_fields) if (!field %in% names(df)) df[[field]] <- NA_character_
  df <- df[order(df$parsed_time, seq_len(nrow(df))), , drop = FALSE]
  df$attempt_sequence <- 1L
  df$is_initial_attempt <- TRUE
  df$lag_hours_since_prev_attempt <- NA_real_
  df$prev_outcome <- NA
  df$attempt_type <- "INITIAL_ATTEMPT"
  df$epistemic_transfer_category <- "INITIAL_EXPOSURE"
  df$exposure_basis <- "RECORDED_ATTEMPTS_ONLY"
  seen_questions <- list()
  seen_topics <- character(0)
  for (i in seq_len(nrow(df))) {
    qid <- as.character(df$question_id[i])
    current_time <- df$parsed_time[i]
    if (qid %in% names(seen_questions)) {
      previous <- seen_questions[[qid]]
      lag_hours <- as.numeric(difftime(current_time, previous$last_time, units = "hours"))
      df$attempt_sequence[i] <- previous$count + 1L
      df$is_initial_attempt[i] <- FALSE
      df$lag_hours_since_prev_attempt[i] <- lag_hours
      df$prev_outcome[i] <- previous$last_is_correct
      df$attempt_type[i] <- "SAME_QUESTION_REPEAT"
      df$epistemic_transfer_category[i] <- if (lag_hours < 24) "FAMILIAR_ITEM_RECOGNITION" else "SPACED_RETRIEVAL_PRACTICE"
    } else {
      discipline <- as.character(df$disciplina[i])
      topic <- as.character(df$assunto[i])
      has_topic <- !is.na(discipline) && nzchar(trimws(discipline)) && !is.na(topic) && nzchar(trimws(topic))
      # Length-prefixed key prevents collisions and cross-discipline attribution.
      key <- if (has_topic) paste0(nchar(discipline), ":", discipline, nchar(topic), ":", topic) else NA_character_
      if (!is.na(key) && key %in% seen_topics) {
        df$attempt_type[i] <- "NEW_QUESTION_SAME_TOPIC"
        df$epistemic_transfer_category[i] <- "SAME_TOPIC_NEW_ITEM"
      }
      if (!is.na(key)) seen_topics <- unique(c(seen_topics, key))
    }
    seen_questions[[qid]] <- list(count = df$attempt_sequence[i], last_time = current_time, last_is_correct = df$is_correct[i])
  }
  df
}

#' Calcula Métricas Empíricas de Retenção por Faixa de Intervalo Temporal
#' @param classified_df data.frame resultante de classify_attempt_history
#' @return Lista com métricas de retenção, matriz de transição e notas metodológicas
calculate_retention_metrics <- function(classified_df) {
  if (is.null(classified_df) || nrow(classified_df) == 0) {
    return(list(
      exposure_basis = "RECORDED_ATTEMPTS_ONLY",
      n_total_attempts = 0,
      n_initial_attempts = 0,
      n_repeated_attempts = 0,
      item_repetition_accuracy = NA_real_,
      retention_by_interval = data.frame(),
      transition_matrix = matrix(0, 2, 2),
      epistemic_breakdown = list(
        familiar_recognition_count = 0L,
        spaced_retrieval_count = 0L,
        same_topic_new_item_count = 0L
      ),
      methodological_cautions = c("Sem dados disponíveis.")
    ))
  }
  
  n_total <- nrow(classified_df)
  initial_attempts <- classified_df[classified_df$is_initial_attempt == TRUE, ]
  repeated_attempts <- classified_df[classified_df$is_initial_attempt == FALSE & !is.na(classified_df$is_correct), ]
  
  n_init <- nrow(initial_attempts)
  n_rep <- nrow(repeated_attempts)
  k_rep <- sum(repeated_attempts$is_correct == TRUE)
  rep_acc <- if (n_rep > 0) round(k_rep / n_rep, 4) else NA_real_
  
  # Contagens epistêmicas detalhadas
  cat_col <- if ("epistemic_transfer_category" %in% names(classified_df)) classified_df$epistemic_transfer_category else character(0)
  n_familiar <- sum(cat_col == "FAMILIAR_ITEM_RECOGNITION")
  n_spaced <- sum(cat_col == "SPACED_RETRIEVAL_PRACTICE")
  n_topic_new <- sum(cat_col == "SAME_TOPIC_NEW_ITEM")
  
  # Definição das faixas de intervalo para repetições
  # 1. Imediato / Mesma Sessão (< 1h)
  # 2. Curto Prazo (1h a 24h)
  # 3. Médio Prazo (1 a 7 dias)
  # 4. Longo Prazo (> 7 dias)
  interval_bins <- list(
    c(label = "Imediato (< 1h)", min = 0, max = 1),
    c(label = "1h a 24h", min = 1, max = 24),
    c(label = "1 a 7 dias", min = 24, max = 168),
    c(label = "> 7 dias", min = 168, max = Inf)
  )
  
  retention_rows <- lapply(interval_bins, function(bin) {
    b_min <- as.numeric(bin["min"])
    b_max <- as.numeric(bin["max"])
    lbl <- as.character(bin["label"])
    
    sub <- repeated_attempts[
      !is.na(repeated_attempts$lag_hours_since_prev_attempt) &
      repeated_attempts$lag_hours_since_prev_attempt >= b_min &
      repeated_attempts$lag_hours_since_prev_attempt < b_max,
    ]
    
    n_b <- nrow(sub)
    k_b <- sum(sub$is_correct == TRUE)
    acc_b <- if (n_b > 0) k_b / n_b else NA_real_
    
    ci <- calculate_wilson_ci(k_b, n_b, 0.95)
    
    data.frame(
      interval_label = lbl,
      n_repetitions = n_b,
      n_correct = k_b,
      retention_rate = round(acc_b, 4),
      ci_lower = ci["lower"],
      ci_upper = ci["upper"],
      denominator_text = if (n_b > 0) sprintf("%d/%d (%.1f%%)", k_b, n_b, acc_b * 100) else "0/0 (NO_DATA)",
      stringsAsFactors = FALSE
    )
  })
  
  retention_df <- do.call(rbind, retention_rows)
  
  # Matriz de Transição de Desempenho (Tentativa k -> Tentativa k+1)
  trans_counts <- matrix(0, nrow = 2, ncol = 2,
                         dimnames = list(
                           Previous = c("Prev_Error", "Prev_Correct"),
                           Current = c("Curr_Error", "Curr_Correct")
                         ))
  
  if (n_rep > 0) {
    valid_trans <- repeated_attempts[!is.na(repeated_attempts$prev_outcome), ]
    for (row_i in seq_len(nrow(valid_trans))) {
      p_idx <- if (valid_trans$prev_outcome[row_i] == TRUE) 2 else 1
      c_idx <- if (valid_trans$is_correct[row_i] == TRUE) 2 else 1
      trans_counts[p_idx, c_idx] <- trans_counts[p_idx, c_idx] + 1
    }
  }
  
  list(
    exposure_basis = "RECORDED_ATTEMPTS_ONLY",
    n_total_attempts = n_total,
    n_initial_attempts = n_init,
    n_repeated_attempts = n_rep,
    item_repetition_accuracy = rep_acc,
    retention_by_interval = retention_df,
    transition_matrix = trans_counts,
    epistemic_breakdown = list(
      familiar_recognition_count = n_familiar,
      spaced_retrieval_count = n_spaced,
      same_topic_new_item_count = n_topic_new
    ),
    methodological_cautions = c(
      "Initial/novel means first recorded attempt only; unrecorded prior exposure is unknown.",
      "Repeated-item accuracy describes recorded item outcomes, not demonstrated conceptual transfer.",
      "The <24h category is an operational interval band; it may involve recognition or retrieval and does not identify a cognitive mechanism.",
      "Spaced repeats and new-item evaluations provide different evidence; duration alone does not prove durable retention or comprehension.",
      "Interval summaries are descriptive observed proportions with denominators, not prescribed universal review intervals.",
      "Transfer assessment requires a defined assessment design and reliable topic taxonomy; a novel item or a new discipline alone does not establish transfer."
    )
  )
}

# Exploratory association: repeated-item correctness versus the observed interval.
# It is not a calibrated personal forgetting curve or an FSRS replacement.
fit_empirical_decay_model <- function(classified_df, min_observations = 10L) {
  if (length(min_observations) != 1 || is.na(min_observations) || !is.finite(min_observations) || min_observations < 2) stop("min_observations must be a finite scalar >= 2")
  empty_coefficients <- list(beta_0_intercept = NA_real_, beta_1_decay = NA_real_, beta_2_confidence = NA_real_)
  valid <- data.frame()
  required <- c("is_correct", "lag_hours_since_prev_attempt")
  if (!is.null(classified_df) && nrow(classified_df) > 0 && all(required %in% names(classified_df))) {
    keep <- !is.na(classified_df$is_correct) & is.finite(classified_df$lag_hours_since_prev_attempt) & classified_df$lag_hours_since_prev_attempt > 0
    valid <- classified_df[keep, , drop = FALSE]
  }
  fit_sample <- function(data) {
    n <- nrow(data)
    k <- if (n > 0) sum(data$is_correct == TRUE) else 0L
    unavailable <- function(status, reason) list(status = status, coefficients = empty_coefficients, n_observations = n, n_correct = k, reason = reason)
    if (n == 0) return(unavailable("INSUFFICIENT_EVIDENCE", "No evaluable repetitions with a positive observed interval."))
    if (n < min_observations || min(k, n - k) < 2) return(unavailable("INSUFFICIENT_EVIDENCE", "Too few repetitions or outcome variation for an exploratory fit."))
    x <- log(data$lag_hours_since_prev_attempt / 24)
    if (length(unique(x)) < 2) return(unavailable("UNIDENTIFIABLE_MODEL", "Observed intervals do not vary."))
    warnings <- character(0)
    fit <- tryCatch(withCallingHandlers(stats::glm(y ~ x, data = data.frame(y = as.integer(data$is_correct == TRUE), x = x), family = stats::binomial()), warning = function(w) {warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning")}), error = function(e) NULL)
    if (is.null(fit) || !isTRUE(fit$converged) || fit$rank < 2 || length(warnings) > 0) return(unavailable("FIT_FAILED", "Fit failed, was rank deficient, or reported convergence/separation warnings."))
    coefficient <- stats::coef(fit)
    standard_error <- sqrt(diag(stats::vcov(fit)))
    if (any(!is.finite(coefficient)) || any(!is.finite(standard_error)) || any(stats::fitted(fit) < sqrt(.Machine$double.eps) | stats::fitted(fit) > 1 - sqrt(.Machine$double.eps))) return(unavailable("FIT_FAILED", "Finite identifiable coefficients and nonsaturated fitted probabilities are required."))
    list(status = "EXPLORATORY_FIT", coefficients = list(beta_0_intercept = unname(coefficient[1]), beta_1_decay = unname(coefficient[2]), beta_2_confidence = NA_real_), n_observations = n, n_correct = k, reason = "In-sample association only; no temporal holdout calibration or causal interpretation.")
  }
  fitted <- fit_sample(valid)
  discipline_rates <- list()
  discipline_col <- if ("disciplina" %in% names(valid)) "disciplina" else if ("discipline" %in% names(valid)) "discipline" else NULL
  if (!is.null(discipline_col)) {
    disciplines <- sort(unique(as.character(valid[[discipline_col]])))
    disciplines <- disciplines[!is.na(disciplines) & nzchar(trimws(disciplines))]
    for (discipline in disciplines) {
      sample <- valid[!is.na(valid[[discipline_col]]) & valid[[discipline_col]] == discipline, , drop = FALSE]
      result <- fit_sample(sample)
      discipline_rates[[discipline]] <- list(status = result$status, n_observations = result$n_observations, n_correct = result$n_correct,
        observed_accuracy = result$n_correct / result$n_observations, decay_rate_beta1 = result$coefficients$beta_1_decay,
        retention_half_life_days = NA_real_, shrinkage_weight = NA_real_, methodological_caution = result$reason)
    }
  }
  list(status = fitted$status, glm_status = if (fitted$status == "EXPLORATORY_FIT") "EMPIRICAL_MLE_CONVERGED_UNVALIDATED" else "NOT_ESTIMATED",
    n_observations = fitted$n_observations, n_correct = fitted$n_correct, coefficients = fitted$coefficients,
    discipline_decay_rates = discipline_rates, model_version = "exploratory_interval_logistic_v2", is_validated = FALSE, can_schedule = FALSE,
    predictors = "log(observed_interval_days)", excluded_predictors = "current_response_confidence",
    methodological_caution = paste(fitted$reason, "Confidence on the current answer is not prior memory evidence. FSRS remains the scheduling authority."))
}

# Compatibility envelope: observed accuracy is estimable; future intervention dates
# cannot be inferred from the unvalidated exploratory association above.
project_critical_intervention_point <- function(decay_model, discipline_name,
                                                n_attempts = NA_integer_, n_correct = NA_integer_,
                                                current_lag_days = NA_real_, target_retention = 0.85,
                                                confidence_prior = NA_real_, max_days = 30L) {
  observed_valid <- length(n_attempts) == 1 && length(n_correct) == 1 && !is.na(n_attempts) && !is.na(n_correct) && is.finite(n_attempts) && is.finite(n_correct) && n_attempts >= 0 && n_correct >= 0 && n_correct <= n_attempts && n_attempts == floor(n_attempts) && n_correct == floor(n_correct)
  n <- if (observed_valid) as.integer(n_attempts) else NA_integer_
  k <- if (observed_valid) as.integer(n_correct) else NA_integer_
  ci <- if (observed_valid && n > 0) calculate_wilson_ci(k, n, 0.95) else c(lower = NA_real_, upper = NA_real_)
  list(discipline = discipline_name, n_observations = n, n_correct = k,
    observed_accuracy = if (observed_valid && n > 0) k / n else NA_real_,
    observed_accuracy_ci_lower = unname(ci["lower"]), observed_accuracy_ci_upper = unname(ci["upper"]),
    decay_rate_beta1 = NA_real_, current_lag_days = current_lag_days,
    critical_intervention_day = NA_integer_, days_until_critical = NA_real_, urgency_status = "FSRS_REQUIRED",
    target_retention = target_retention, projected_wilson_lower_at_critical = NA_real_, projected_curve = list(),
    projection_status = "UNVALIDATED_MODEL", can_schedule = FALSE,
    methodological_caution = "No future forgetting deadline or Wilson interval on predicted successes is inferred. Observed accuracy intervals describe recorded outcomes only. A validated FSRS item state is required for memory scheduling; one error does not identify its cause.")
}

# Keep the Java-compatible envelope but publish no executable weights before a
# validated memory/planning contract exists. Missing budgets or lags are not filled.
calculate_robin_hood_weights <- function(learning_profile, decay_model,
                                         analytical_signals = NULL, target_retention = 0.85) {
  list(contract_version = "1.1.0", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    source_model = "exploratory_interval_logistic_v2", algorithm = "ROBIN_HOOD_ADAPTIVE_CYCLE_V1",
    target_retention_threshold = target_retention, disciplines_count = 0L, weights = list(),
    status = "UNVALIDATED_MEMORY_MODEL", can_apply = FALSE, can_schedule = FALSE,
    recommendations = list(time_theft_donors = character(0), priority_recipients = character(0), summary_instruction = "Do not change time allocation from this unvalidated model. Use the configured study plan and validated FSRS item schedule."),
    critical_topics = list(), hyper_consolidated_disciplines = list(),
    redistribution_plan = NULL,
    parameters = list(memory_authority = "FSRS", current_lag_days = NA_real_, available_minutes = NA_real_, model_status = if (!is.null(decay_model$status)) decay_model$status else "NO_DATA"),
    methodological_caution = "No elapsed time, study budget, concept deficit, donor discipline or causal diagnosis was imputed. Empty weights must not override backend configuration.")
}
