# Laboratory adapter to the actual FiscalStudy baseline implementation.
# No simulator, latent file, scheduler, database or Java authority is loaded.
configured_lib <- Sys.getenv("FISCALSTUDY_R_LIBS", "")
if (nzchar(configured_lib) && dir.exists(configured_lib)) .libPaths(c(configured_lib, .libPaths()))
if (!requireNamespace("jsonlite", quietly = TRUE)) stop("jsonlite unavailable; configure existing FISCALSTUDY_R_LIBS. No package was installed.")
source("R/descriptive_analysis.R")
source("R/baselines.R")
source("R/provenance.R")
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3L) stop("Expected observations.csv predictions.csv input-manifest.json")
contract <- jsonlite::fromJSON("lab/event_contract.json")
input <- utils::read.csv(args[1], colClasses = "character", na.strings = "", stringsAsFactors = FALSE)
manifest <- jsonlite::fromJSON(args[3])
if (!identical(names(input), contract$columns)) stop("Schema mismatch or forbidden input field")
if (!identical(manifest$source_kind, "SYNTHETIC_BENCHMARK") ||
    !identical(manifest$contract_version, contract$contract_version)) stop("Unapproved experiment source")
hash <- compute_file_sha256(args[1])
if (is.na(hash) || !identical(hash, manifest$input_sha256) ||
    nrow(input) != manifest$row_count) stop("Input snapshot checksum/count mismatch")
if (nrow(input) == 0L) stop("Empty experiment: no predictions are fabricated")
for (field in c("student_id", "event_id", "session_id", "question_id", "skill_id")) {
  if (any(is.na(input[[field]]) | !nzchar(trimws(input[[field]])))) stop("Missing identity")
}
if (anyDuplicated(input$event_id)) stop("Duplicate event identity")
if (any(is.na(parse_evidence_timestamp(input$occurred_at)))) stop("Invalid or timezone-free timestamp")
if (any(!input$origin_type %in% "SYNTHETIC_BENCHMARK")) stop("Non-synthetic input prohibited")
if (any(!is.na(input$is_correct) & !tolower(input$is_correct) %in% c("true","false"))) stop("Invalid outcome")
if (any(!input$used_help %in% c("true","false")) ||
    any(!input$session_complete %in% c("true","false"))) stop("Ambiguous response conditions")
for (field in c("attempt_number","prior_exposures","elapsed_hours","active_time_ms","confidence_level")) {
  value <- suppressWarnings(as.numeric(input[[field]]))
  known <- !is.na(input[[field]])
  if (any(known & (!is.finite(value) | value < 0))) stop("Invalid numeric observation")
  if (field %in% c("attempt_number","prior_exposures","confidence_level") &&
      any(known & value != floor(value))) stop("Invalid integer observation")
}
if (any(is.na(input$attempt_number)) || any(as.numeric(input$attempt_number) < 1)) stop("Missing attempt number")
if (any(is.na(input$prior_exposures)) ||
    any(as.numeric(input$attempt_number) != as.numeric(input$prior_exposures) + 1)) stop("Inconsistent recorded attempt sequence")
for (session in unique(input$session_id)) {
  if (length(unique(input$student_id[input$session_id == session])) != 1L) stop("Session identity has multiple owners")
}
eligible <- input$gabarito_status %in% "DEFINITIVO" & !is.na(input$is_correct) &
  input$used_help %in% "false" & input$session_complete %in% "true"
predictions <- list()
statuses <- list()
for (student in sort(unique(input$student_id))) {
  selected <- input[input$student_id == student & eligible, , drop = FALSE]
  # Reuses the actual production R baseline helper, without passing latent states.
  result <- evaluate_baselines_temporally(selected, initial_training_observations = 10L)
  statuses[[student]] <- list(status = result$status, observed = sum(input$student_id == student),
    eligible = nrow(selected), excluded = sum(input$student_id == student & !eligible),
    prediction_count = result$prediction_count, is_validated = FALSE, can_apply = FALSE)
  if (nrow(result$predictions) > 0L) {
    rows <- result$predictions
    rows$student_id <- student
    predictions[[length(predictions) + 1L]] <- rows
  }
}
if (length(predictions) == 0L) {
  rows <- data.frame(event_id=character(),question_id=character(),occurred_at=character(),
    model_name=character(),predicted_probability=numeric(),observed_correct=integer(),
    training_observations=integer(),topic_training_observations=integer(),
    item_exposure=character(),prediction_basis=character(),student_id=character())
} else rows <- do.call(rbind, predictions)
utils::write.csv(rows, args[2], row.names = FALSE, na = "")
writeLines(jsonlite::toJSON(list(contract_version=contract$contract_version,
  source_kind="SYNTHETIC_BENCHMARK", engine="REAL_R_BASELINES", input_sha256=hash,
  r_version=R.version.string, jsonlite_version=as.character(utils::packageVersion("jsonlite")),
  students=statuses, can_apply=FALSE, can_schedule=FALSE,
  target="GRADED_OBJECTIVE_UNASSISTED_RESPONSE",
  memory_parameter_estimation="NOT_SUPPORTED_BY_CURRENT_BASELINES"),
  auto_unbox=TRUE, pretty=TRUE), paste0(args[2], ".status.json"))
