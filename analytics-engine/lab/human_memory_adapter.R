# Read-only external human benchmark. No operational state or decision authority.
configured <- Sys.getenv("FISCALSTUDY_R_LIBS","")
if(nzchar(configured) && dir.exists(configured)) .libPaths(c(configured,.libPaths()))
load_module <- function(path) {
  lines <- readLines(path,encoding="UTF-8",warn=FALSE)
  if(any(!validUTF8(lines))) stop("Invalid module encoding")
  eval(parse(text=lines,encoding="UTF-8",keep.source=FALSE),envir=.GlobalEnv)
}
if(!requireNamespace("jsonlite",quietly=TRUE)) stop("jsonlite unavailable")
load_module("R/descriptive_analysis.R")
load_module("R/provenance.R")
load_module("lab/individual_calibration.R")
args <- commandArgs(trailingOnly=TRUE)
if(length(args)!=3L) stop("Expected observations.csv result.json snapshot.json")
allowed <- paste0(normalizePath("lab/runs",winslash="/",mustWork=TRUE),"/")
for(path in args) {
  full <- if(file.exists(path)) normalizePath(path,winslash="/",mustWork=TRUE) else
    paste0(normalizePath(dirname(path),winslash="/",mustWork=TRUE),"/",basename(path))
  if(!startsWith(tolower(full),tolower(allowed))) stop("External run confinement violation")
}
if(file.exists(args[2])) stop("Refusing existing result")
manifest <- jsonlite::fromJSON(args[3])
if(!identical(manifest$contract_version,"public_memory_v1") ||
   !identical(manifest$origin_type,"PUBLIC_HUMAN_DATASET") ||
   !identical(manifest$can_apply,FALSE) || !identical(manifest$can_schedule,FALSE) ||
   !identical(manifest$input_sha256,compute_file_sha256(args[1]))) stop("Invalid external snapshot")
d <- read.csv(args[1],colClasses="character",na.strings="",stringsAsFactors=FALSE)
expected <- c("event_id","student_id","question_id","occurred_at","is_correct",
  "predicted_probability","elapsed_days","rating","origin_type","fsrs_model_version")
if(!identical(names(d),expected) || nrow(d)!=manifest$row_count || !nrow(d)) stop("Invalid external schema")
for(field in c("event_id","student_id","question_id"))
  if(anyNA(d[[field]]) || any(!nzchar(trimws(d[[field]])))) stop("Missing identity")
if(anyDuplicated(d$event_id) || any(!d$origin_type %in% "PUBLIC_HUMAN_DATASET") ||
   any(!d$is_correct %in% c("0","1")) || any(!d$rating %in% as.character(1:4)) ||
   length(unique(d$fsrs_model_version))!=1L || anyNA(d$fsrs_model_version)) stop("Invalid external evidence")
d$t <- parse_evidence_timestamp(d$occurred_at)
d$p <- suppressWarnings(as.numeric(d$predicted_probability))
d$elapsed <- suppressWarnings(as.numeric(d$elapsed_days))
d$y <- as.integer(d$is_correct)
if(anyNA(d$t) || any(is.na(d$p) & !is.na(d$predicted_probability)) ||
   any(!is.na(d$p) & (!is.finite(d$p) | d$p<0 | d$p>1)) ||
   any(!is.na(d$p) & (!is.finite(d$elapsed) | d$elapsed<0)) ||
   any(d$y!=as.integer(as.integer(d$rating)>1))) stop("Invalid probability/time/target")
d <- d[order(d$t,d$event_id),,drop=FALSE]
mature <- d[!is.na(d$p),,drop=FALSE]
predictions <- list();students <- list()
set.seed(417) # Item-cluster uncertainty, independent of outcomes and model selection.
for(id in sort(unique(d$student_id))) {
  own <- mature[mature$student_id==id,,drop=FALSE]
  batches <- sort(unique(own$t))
  if(length(batches)<10L) {
    students[[length(students)+1L]] <- list(student_id=id,status="INSUFFICIENT_TIMESTAMP_BATCHES",can_apply=FALSE)
    next
  }
  a <- floor(length(batches)*.6);b <- floor(length(batches)*.8)
  train <- own[own$t<=batches[a],,drop=FALSE]
  validation <- own[own$t>batches[a] & own$t<=batches[b],,drop=FALSE]
  test <- own[own$t>batches[b],,drop=FALSE]
  cutoff <- max(train$t)
  # Leave this student's identity OUT of the global calibration fit, and no future donor events.
  donors <- mature[mature$student_id!=id & mature$t<cutoff,,drop=FALSE]
  available <- nrow(train)>=30L && length(unique(train$question_id))>=20L &&
    nrow(validation)>0L && nrow(test)>0L && nrow(donors)>=30L
  if(available) {
    global <- fit_shift(donors$p,donors$y)
    strengths <- c(1,4,16)
    fits <- vapply(strengths,function(lambda) fit_shift(train$p,train$y,global,lambda),numeric(1))
    losses <- vapply(fits,function(shift) cal_loss(validation$y,cal_shift(validation$p,shift)),numeric(1))
    chosen <- which.min(losses);individual <- fits[chosen]
    items <- sort(unique(train$question_id))
    boot <- replicate(100L,{
      selected <- sample(items,length(items),replace=TRUE)
      rows <- unlist(lapply(selected,function(item) which(train$question_id==item)),use.names=FALSE)
      fit_shift(train$p[rows],train$y[rows],global,strengths[chosen])
    })
    ci <- unname(quantile(boot,c(.025,.975),type=7))
    uncertainty <- list(method="100 item-cluster bootstrap conditional on global fit and selected penalty",
      shift_interval=ci,coverage="NOT_EMPIRICALLY_VALIDATED",does_not_include="Global fit/selection and between-item dependence uncertainty")
  } else {
    global <- individual <- NA_real_;uncertainty <- list(status="NOT_ESTIMATED")
  }
  students[[length(students)+1L]] <- list(student_id=id,
    status=if(available) "EXPLORATORY_CALIBRATION_AVAILABLE" else "CALIBRATION_ABSTAINED",
    n_train=nrow(train),n_train_items=length(unique(train$question_id)),n_validation=nrow(validation),
    n_test=nrow(test),n_prior_donor_events=nrow(donors),training_max=as.character(cutoff),
    validation_max=as.character(max(validation$t)),test_min=as.character(min(test$t)),
    donor_identity_overlap=FALSE,donor_future_overlap=FALSE,
    selected_penalty=if(available) strengths[chosen] else NA_real_,
    global_shift=global,individual_shift=individual,uncertainty=uncertainty,
    threshold_note="30 events/20 items are registered experimental eligibility rules, not evidence of sufficiency",
    can_apply=FALSE)
  # Online baseline updates only AFTER every prediction in an equal-time batch.
  history <- d[d$student_id==id & d$t<min(test$t),,drop=FALSE]
  k <- sum(history$y);n <- nrow(history)
  remaining <- d[d$student_id==id & d$t>=min(test$t),,drop=FALSE]
  for(moment in sort(unique(remaining$t))) {
    observed <- remaining[remaining$t==moment,,drop=FALSE]
    target <- test[test$t==moment,,drop=FALSE]
    if(nrow(target)) {
      models <- list(FSRS_DEFAULT=target$p,PERSONAL_ONLINE_BETA11=rep((k+1)/(n+2),nrow(target)))
      if(available) {
        models$GLOBAL_CALIBRATION <- cal_shift(target$p,global)
        models$INDIVIDUAL_CALIBRATION <- cal_shift(target$p,individual)
      }
      for(name in names(models))
        predictions[[length(predictions)+1L]] <- data.frame(event_id=target$event_id,
          student_id=id,question_id=target$question_id,occurred_at=target$occurred_at,
          elapsed_days=target$elapsed,observed_correct=target$y,model_name=name,
          predicted_probability=as.numeric(models[[name]]),stringsAsFactors=FALSE)
    }
    k <- k+sum(observed$y);n <- n+nrow(observed)
  }
}
out <- if(length(predictions)) do.call(rbind,predictions) else data.frame()
scores <- if(nrow(out)) lapply(split(out,out$model_name),function(rows)
  cal_metrics(rows$observed_correct,rows$predicted_probability)) else list()
result <- list(contract_version="public_memory_results_v1",origin_type="PUBLIC_HUMAN_DATASET",
  input_sha256=manifest$input_sha256,n_input=nrow(d),n_cold=nrow(d)-nrow(mature),
  students=students,predictions=out,scores=scores,r_version=R.version.string,
  target="SELF_REPORTED_RECALL",conceptual_knowledge="NOT_IDENTIFIED",
  global_generalization="Leave-one-student-out calibration transfer, with prior own FSRS history; NOT zero-shot",
  personal_validation="NOT_EXECUTED",can_apply=FALSE,can_schedule=FALSE)
writeLines(jsonlite::toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null",digits=16),args[2])
