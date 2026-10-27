# Laboratory-only extension; reuses the existing moving-average implementation.
# No memory equation, learner trait, production scheduler or new fitted parameter.
append_temporal_moving_average <- function(result, attempts_df, window_size = 5L) {
  if (nrow(result$predictions) == 0L) return(result)
  template <- result$predictions[result$predictions$model_name == "GLOBAL_HISTORICAL_MEAN", , drop = FALSE]
  input_time <- parse_evidence_timestamp(attempts_df$occurred_at)
  output_time <- input_time[match(template$event_id, attempts_df$event_id)]
  outcome <- tolower(as.character(attempts_df$is_correct)) %in% c("true", "1")
  for (i in seq_len(nrow(template))) {
    previous <- which(input_time < output_time[i])
    previous <- previous[order(as.numeric(input_time[previous]), attempts_df$event_id[previous])]
    past <- attempts_df[previous, , drop = FALSE]
    past$is_correct <- outcome[previous]
    model <- calculate_baseline_moving_average(past, window_size = window_size)
    template$predicted_probability[i] <- model$current_estimate
    template$prediction_basis[i] <- "PREVIOUS_FIVE_ELIGIBLE_OBSERVATIONS"
    template$topic_training_observations[i] <- 0L
  }
  template$model_name <- "MOVING_AVERAGE_5"
  if (any(!is.finite(template$predicted_probability))) stop("Moving-average baseline failed")
  result$predictions <- rbind(result$predictions, template)
  result$prediction_count <- nrow(result$predictions)
  result
}
