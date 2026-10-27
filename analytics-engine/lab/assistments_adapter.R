# Ordinal human question-performance baseline experiment. No invented timestamps/FSRS.
configured <- Sys.getenv("FISCALSTUDY_R_LIBS","")
if(nzchar(configured) && dir.exists(configured)) .libPaths(c(configured,.libPaths()))
source_trusted <- function(path) eval(parse(text=readLines(path,encoding="UTF-8",warn=FALSE),
  encoding="UTF-8",keep.source=FALSE),envir=.GlobalEnv)
source_trusted("R/descriptive_analysis.R");source_trusted("R/baselines.R");source_trusted("R/provenance.R")
if(!requireNamespace("jsonlite",quietly=TRUE)) stop("jsonlite unavailable")
args <- commandArgs(trailingOnly=TRUE)
if(length(args)!=3) stop("Expected events.json results.json snapshot.json")
allowed <- paste0(normalizePath("lab/runs",winslash="/",mustWork=TRUE),"/")
for(path in args) {
 full <- if(file.exists(path)) normalizePath(path,winslash="/",mustWork=TRUE) else
   paste0(normalizePath(dirname(path),winslash="/",mustWork=TRUE),"/",basename(path))
 if(!startsWith(tolower(full),tolower(allowed))) stop("ASSISTments path confinement")
}
if(file.exists(args[2])) stop("Refusing existing result")
snapshot <- jsonlite::fromJSON(args[3])
if(!identical(snapshot$contract_version,"assistments_ordered_v1") ||
   !identical(snapshot$input_sha256,compute_file_sha256(args[1])) ||
   !identical(snapshot$can_apply,FALSE)) stop("Invalid ASSISTments snapshot")
d <- jsonlite::fromJSON(args[1])
required <- c("event_id","student_id","question_id","event_order","skill_key","is_correct",
  "chronology","origin_type")
if(!setequal(names(d),required) || nrow(d)!=snapshot$row_count || !nrow(d)) stop("Invalid schema")
if(anyDuplicated(d$event_id) || any(!d$is_correct %in% c(0L,1L)) ||
   any(!d$origin_type %in% "PUBLIC_HUMAN_DATASET") ||
   any(!d$chronology %in% "ORDINAL_ORDER_ID_ONLY") ||
   anyNA(d$event_order) || any(d$event_order!=floor(d$event_order))) stop("Invalid ordered evidence")
result <- list()
for(id in sort(unique(d$student_id))) {
 own <- d[d$student_id==id,,drop=FALSE]
 own <- own[order(own$event_order,own$event_id),,drop=FALSE]
 if(anyDuplicated(own$event_order)) stop("Ambiguous within-student ordering")
 if(nrow(own)<=10) next
 for(i in seq.int(11L,nrow(own))) {
   history <- own[seq_len(i-1L),,drop=FALSE];target <- own[i,,drop=FALSE]
   attempts <- data.frame(question_id=history$event_id,is_correct=as.logical(history$is_correct))
   # Event join keys preserve classification AT the historical event. Actual item IDs remain in output.
   catalogue <- data.frame(question_id=history$event_id,disciplina="MATHEMATICS",assunto=history$skill_key)
   global <- calculate_baseline_historical_mean(attempts)$predicted_prob
   topic <- calculate_baseline_topic_mean(attempts,catalogue)$predict("MATHEMATICS",target$skill_key)
   moving <- mean(tail(history$is_correct,5L))
   for(name in c("PERSONAL_HISTORICAL","SMOOTHED_SKILL_SET","MOVING_5")) {
     p <- switch(name,PERSONAL_HISTORICAL=global,SMOOTHED_SKILL_SET=topic,MOVING_5=moving)
     result[[length(result)+1L]] <- data.frame(event_id=target$event_id,student_id=id,
       question_id=target$question_id,event_order=target$event_order,observed_correct=target$is_correct,
       model_name=name,predicted_probability=p,
       novelty=if(target$question_id %in% history$question_id) "REPEATED_ITEM" else "FIRST_OBSERVED_ITEM")
   }
 }
}
out <- if(length(result)) do.call(rbind,result) else data.frame()
writeLines(jsonlite::toJSON(list(origin_type="PUBLIC_HUMAN_DATASET",
 target="FIRST_ATTEMPT_CORRECT_OR_HELP_FAILURE",predictions=out,
 time_horizon="NOT_AVAILABLE",memory_validation="NOT_APPLICABLE",personal_validation="NOT_EXECUTED",
 r_version=R.version.string,can_apply=FALSE,can_schedule=FALSE),auto_unbox=TRUE,pretty=TRUE,na="null",digits=16),args[2])
