# Synthetic recall lab only: evaluates the EXISTING R FSRS audit.
configured_lib <- Sys.getenv("FISCALSTUDY_R_LIBS", "")
if (nzchar(configured_lib) && dir.exists(configured_lib)) .libPaths(c(configured_lib, .libPaths()))
if (!requireNamespace("jsonlite", quietly=TRUE)) stop("jsonlite unavailable")
source("R/descriptive_analysis.R", encoding="UTF-8")
source("R/baselines.R", encoding="UTF-8")
source("R/provenance.R", encoding="UTF-8")
source("R/retrieval_diagnostics.R", encoding="UTF-8")
args <- commandArgs(trailingOnly=TRUE)
if (length(args)!=3L) stop("Expected observations.csv target.json snapshot.json")
allowed <- paste0(normalizePath("tests/fixtures/learner_lab", winslash="/", mustWork=TRUE), "/")
for (path in args) {
  resolved <- if (file.exists(path)) normalizePath(path,winslash="/",mustWork=TRUE) else
    paste0(normalizePath(dirname(path),winslash="/",mustWork=TRUE),"/",basename(path))
  if (!startsWith(tolower(resolved),tolower(allowed))) stop("Paths outside synthetic fixtures")
}
if (file.exists(args[2])) stop("Refusing to overwrite R memory audit")
input <- utils::read.csv(args[1],colClasses="character",na.strings="",stringsAsFactors=FALSE)
manifest <- jsonlite::fromJSON(args[3])
fields <- c("event_id","student_id","question_id","occurred_at","origin_type",
  "gabarito_status","is_correct","fsrs_model_version","fsrs_prediction_timestamp",
  "fsrs_evidence_status","fsrs_retrievability_pre_update",
  "fsrs_stability_pre_update","fsrs_difficulty_pre_update")
if (!identical(names(input),fields)) stop("Forbidden/missing memory column")
if (!identical(manifest$contract_version,"memory_lab_events_v1") ||
    !identical(manifest$source_kind,"SYNTHETIC_BENCHMARK") ||
    !identical(manifest$input_sha256,compute_file_sha256(args[1])) ||
    nrow(input)!=manifest$row_count || nrow(input)==0L) stop("Invalid memory snapshot")
for (field in c("event_id","student_id","question_id")) {
  if (any(is.na(input[[field]]) | !nzchar(trimws(input[[field]])))) stop("Missing memory identity")
}
if (anyDuplicated(input$event_id)) stop("Duplicate memory event")
if (any(!input$origin_type %in% "SYNTHETIC_BENCHMARK") ||
    any(!input$is_correct %in% c("true","false")) ||
    any(!input$gabarito_status %in% "DEFINITIVO")) stop("Invalid recall source/outcome")
event_time <- parse_evidence_timestamp(input$occurred_at)
prediction_time <- parse_evidence_timestamp(input$fsrs_prediction_timestamp)
if (any(is.na(event_time) | is.na(prediction_time) | prediction_time>event_time)) stop("Invalid prediction time")
aggregate <- calculate_retrieval_surprise(input)
students <- lapply(sort(unique(input$student_id)),function(id)
  calculate_retrieval_surprise(input[input$student_id==id,,drop=FALSE]))
names(students) <- sort(unique(input$student_id))
if (!identical(aggregate$can_apply,FALSE)) stop("R diagnostic gained unexpected authority")
result <- list(contract_version="memory_lab_results_v1",source_kind="SYNTHETIC_BENCHMARK",
  input_sha256=manifest$input_sha256,r_version=R.version.string,
  aggregate=aggregate,students=students,can_apply=FALSE,can_schedule=FALSE,
  causal_diagnosis="NOT_SUPPORTED",personal_validation="NOT_EXECUTED")
writeLines(jsonlite::toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null",digits=16),args[2])
