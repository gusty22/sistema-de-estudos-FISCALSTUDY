# New human cohort only. Observed chronology is separate from the derived model coordinate.
source("lab/human_memory_adapter.R") # Pure analyzer; source() does not execute its CLI.
args <- commandArgs(trailingOnly=TRUE)
if(length(args)!=3L) stop("Expected clock.csv result.json snapshot.json")
allowed <- paste0(normalizePath("lab/runs",winslash="/",mustWork=TRUE),"/")
for(path in args) {
 full <- if(file.exists(path)) normalizePath(path,winslash="/",mustWork=TRUE) else
   paste0(normalizePath(dirname(path),winslash="/",mustWork=TRUE),"/",basename(path))
 if(!startsWith(tolower(full),tolower(allowed))) stop("Clock experiment path violation")
}
if(file.exists(args[2])) stop("Refusing existing clock result")
manifest <- jsonlite::fromJSON(args[3])
if(!identical(manifest$contract_version,"recorded_day_memory_v1") ||
   !identical(manifest$origin_type,"PUBLIC_HUMAN_DATASET") ||
   !identical(manifest$can_apply,FALSE) || !identical(manifest$can_schedule,FALSE) ||
   !identical(manifest$input_sha256,compute_file_sha256(args[1]))) stop("Invalid clock snapshot")
d <- read.csv(args[1],colClasses="character",na.strings="",stringsAsFactors=FALSE)
normal <- c("event_id","student_id","question_id","occurred_at","is_correct",
 "predicted_probability","elapsed_days","rating","origin_type","fsrs_model_version")
expected <- c(normal,"source_event_index","source_interval_days","model_elapsed_days",
 "prediction_status","clock_basis","model_clock_coordinate")
if(!identical(names(d),expected) || nrow(d)!=manifest$row_count || !nrow(d)) stop("Invalid clock schema/count")
if(length(unique(d$clock_basis))!=1L || !unique(d$clock_basis) %in% c("UTC_WHOLE_24H","SOURCE_RECORDED_DAYS"))
 stop("Mixed/unknown clocks")
basis <- unique(d$clock_basis)
if(!identical(manifest$clock_basis,basis)) stop("Snapshot clock arm mismatch")
i <- suppressWarnings(as.numeric(d$source_event_index))
delta <- suppressWarnings(as.numeric(d$source_interval_days))
model <- suppressWarnings(as.numeric(d$model_elapsed_days))
actual <- suppressWarnings(as.numeric(d$elapsed_days))
coordinate <- parse_evidence_timestamp(d$model_clock_coordinate)
if(anyNA(coordinate) || any(!is.finite(i) | i<1 | i!=floor(i)) ||
 any(!is.finite(delta) | delta<0 | delta!=floor(delta))) stop("Invalid clock metadata")
status <- ifelse(i==1,"COLD_START",ifelse(delta>=1,"ELIGIBLE","OUTSIDE_LONG_TERM_DOMAIN"))
if(any(d$prediction_status!=status) || anyNA(d$prediction_status)) stop("Invalid scoring eligibility")
eligible <- status=="ELIGIBLE"
repeat_rows <- i>1
if(any(eligible & is.na(d$predicted_probability)) ||
   any(!eligible & !is.na(d$predicted_probability)) ||
   any(repeat_rows & (!is.finite(model) | model<0 | !is.finite(actual) | actual<0)))
 stop("Invalid clock probability/domain")
if(basis=="SOURCE_RECORDED_DAYS" && any(repeat_rows & model!=delta)) stop("Source clock mismatch")
if(basis=="UTC_WHOLE_24H" && any(repeat_rows & model!=floor(actual))) stop("UTC clock mismatch")
# Coordinate differences are checked per card; they are NEVER interpreted as event instants.
for(id in unique(paste(d$student_id,d$question_id,sep=":"))) {
 group <- which(paste(d$student_id,d$question_id,sep=":")==id)
 group <- group[order(i[group])]
 if(!identical(as.integer(i[group]),seq_along(group))) stop("Missing/duplicate source prefix")
 if(length(group)>1L) {
   steps <- as.numeric(diff(coordinate[group]),units="days")
   if(any(floor(steps)!=model[group[-1L]])) stop("Inconsistent model coordinate")
 }
}
result <- analyze_public_memory(d[,normal,drop=FALSE],input_sha256=manifest$input_sha256)
result$contract_version <- "recorded_day_results_v1"
result$reference_time_basis <- basis
result$n_unscored <- sum(!eligible)
result$n_cold <- sum(status=="COLD_START")
result$n_outside_registered_domain <- sum(status=="OUTSIDE_LONG_TERM_DOMAIN")
result$clock_transport <- if(basis=="SOURCE_RECORDED_DAYS") "MATCHES_RECORDED_INTERVALS_ONLY" else "UTC_24H_CONTROL"
result$model_coordinate_validity <- "DERIVED_NOT_AN_OBSERVED_TIMESTAMP"
result$original_timezone <- "NOT_RECOVERED"
result$personal_validation <- "NOT_EXECUTED"
result$can_apply <- FALSE;result$can_schedule <- FALSE
writeLines(jsonlite::toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null",digits=16),args[2])
