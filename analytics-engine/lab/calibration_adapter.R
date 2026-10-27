# Experimental adapter: observable files only, no truth path or latent fields.
configured <- Sys.getenv("FISCALSTUDY_R_LIBS","")
if (nzchar(configured) && dir.exists(configured)) .libPaths(c(configured,.libPaths()))
if (!requireNamespace("jsonlite",quietly=TRUE)) stop("jsonlite unavailable")
source_lab <- function(path) {
  text <- readLines(path,encoding="UTF-8",warn=FALSE)
  if (any(!validUTF8(text))) stop("Invalid module UTF-8")
  eval(parse(text=text,encoding="UTF-8",keep.source=FALSE),envir=.GlobalEnv)
}
source_lab("R/descriptive_analysis.R")
source_lab("R/provenance.R")
source_lab("lab/individual_calibration.R")
args <- commandArgs(trailingOnly=TRUE)
if (length(args)!=4L) stop("Expected memory.csv probes.csv result.json snapshot.json")
root <- paste0(normalizePath("tests/fixtures/learner_lab",winslash="/",mustWork=TRUE),"/")
for (path in args) {
  resolved <- if(file.exists(path)) normalizePath(path,winslash="/",mustWork=TRUE) else
    paste0(normalizePath(dirname(path),winslash="/",mustWork=TRUE),"/",basename(path))
  if (!startsWith(tolower(resolved),tolower(root))) stop("Paths outside synthetic fixtures")
}
if (file.exists(args[3])) stop("Refusing to overwrite calibration result")
snapshot <- jsonlite::fromJSON(args[4])
if (!identical(snapshot$contract_version,"calibration_lab_v1") ||
    !identical(snapshot$source_kind,"SYNTHETIC_BENCHMARK") ||
    !identical(snapshot$can_apply,FALSE) || !identical(snapshot$can_schedule,FALSE) ||
    !identical(snapshot$memory_sha256,compute_file_sha256(args[1])) ||
    !identical(snapshot$probes_sha256,compute_file_sha256(args[2]))) stop("Invalid calibration snapshot")
memory <- read.csv(args[1],colClasses="character",na.strings="",stringsAsFactors=FALSE)
probes <- read.csv(args[2],colClasses="character",na.strings="",stringsAsFactors=FALSE)
memory_fields <- c("event_id","student_id","question_id","occurred_at","origin_type",
  "gabarito_status","is_correct","fsrs_model_version","fsrs_prediction_timestamp",
  "fsrs_evidence_status","fsrs_retrievability_pre_update","fsrs_stability_pre_update","fsrs_difficulty_pre_update")
probe_fields <- c("event_id","student_id","question_id","occurred_at","origin_type","is_correct","phase","item_index")
if (!identical(names(memory),memory_fields) || !identical(names(probes),probe_fields) ||
    nrow(memory)!=snapshot$memory_rows || nrow(probes)!=snapshot$probe_rows ||
    !nrow(memory) || !nrow(probes)) stop("Invalid calibration schema/count")
for (data in list(memory,probes)) {
  if (any(!data$origin_type %in% "SYNTHETIC_BENCHMARK") ||
      anyNA(data$student_id) || anyNA(data$event_id) || anyNA(data$question_id) ||
      any(!nzchar(trimws(data$student_id))) || any(!nzchar(trimws(data$event_id))) ||
      any(!nzchar(trimws(data$question_id))) || anyDuplicated(data$event_id)) stop("Invalid synthetic identity/source")
}
if (length(unique(memory$fsrs_model_version))!=1L || anyNA(memory$fsrs_model_version) ||
    any(!nzchar(trimws(memory$fsrs_model_version)))) stop("Mixed/missing FSRS versions")
observed <- parse_evidence_timestamp(memory$occurred_at)
predicted <- parse_evidence_timestamp(memory$fsrs_prediction_timestamp)
if (anyNA(observed) || anyNA(predicted) || any(predicted>observed) ||
    any(!memory$gabarito_status %in% "DEFINITIVO") ||
    any(!memory$fsrs_evidence_status %in% c("UNCALIBRATED_ITEM_ESTIMATE","COLD_START_NO_PREVIOUS_REVIEW")))
  stop("Invalid memory evidence")
result <- list(contract_version="calibration_results_v1",source_kind="SYNTHETIC_BENCHMARK",
  input_hashes=list(memory=snapshot$memory_sha256,probes=snapshot$probes_sha256),
  calibration=evaluate_individual_calibration(memory),
  identifiability=summarize_identifiability_probes(probes),
  r_version=R.version.string,can_apply=FALSE,can_schedule=FALSE)
writeLines(jsonlite::toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null",digits=16),args[3])
