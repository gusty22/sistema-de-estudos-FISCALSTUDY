# Experimental sidecar evaluator. No scheduling, FSRS fitting or database writes.
source("R/descriptive_analysis.R")
source("lab/individual_calibration.R")

evaluate_prospective <- function(path) {
  envelope <- jsonlite::fromJSON(path, simplifyVector=FALSE)
  contract <- "prospective-question-v1"
  if (!identical(envelope$contractVersion,contract) || !identical(envelope$can_apply,FALSE) ||
      !identical(envelope$can_schedule,FALSE) || !is.character(envelope$inputJson) ||
      !identical(digest::digest(enc2utf8(envelope$inputJson),algo="sha256",serialize=FALSE),envelope$inputSha256))
    stop("Invalid prospective manifest or SHA-256")
  input <- jsonlite::fromJSON(envelope$inputJson,simplifyVector=FALSE)
  if (!identical(input$contractVersion,contract) || !identical(input$studentId,"LOCAL_SINGLE_USER") ||
      input$snapshotRowid != envelope$snapshotRowid) stop("Snapshot identity mismatch")
  rows <- input$events
  scalar_time <- function(value) {
    if (!is.character(value) || length(value)!=1L) stop("Missing explicit timestamp")
    parsed <- parse_evidence_timestamp(value)
    if (length(parsed)!=1L || is.na(parsed)) stop("Invalid/ambiguous timestamp")
    parsed
  }
  uuid <- function(value) is.character(value) && length(value)==1L &&
    grepl("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",value)
  ids <- vapply(rows,function(e)e$event_id,character(1))
  ord <- vapply(rows,function(e)e$snapshot_rowid,numeric(1))
  if (anyDuplicated(ids) || anyDuplicated(ord) || any(!is.finite(ord) | ord<1 |
      ord!=floor(ord) | ord>input$snapshotRowid)) stop("Duplicate/invalid event identity or rowid")
  rows <- rows[order(ord)]
  ids <- vapply(rows,function(e)e$event_id,character(1))
  payload <- lapply(rows,function(e)jsonlite::fromJSON(e$payload_json,simplifyVector=FALSE))
  times <- lapply(rows,function(e)scalar_time(e$occurred_at))
  names(rows) <- names(payload) <- names(times) <- ids
  eligible <- function(n) identical(n$origin,"REAL_STUDY") &&
    is.logical(n$isCorrect) && length(n$isCorrect)==1L &&
    identical(n$gabaritoStatus,"DEFINITIVO") && identical(n$usedHelp,FALSE)
  forecasts <- ids[vapply(rows,function(e)identical(e$event_type,"PREDICTION_COMMITTED"),logical(1))]
  scored <- list(); exclusions <- list(); prediction_ids <- character()
  for (id in forecasts) {
    e <- rows[[id]]; f <- payload[[id]]
    if (!identical(f$contractVersion,contract) || !uuid(f$predictionId) || !uuid(f$attemptId) ||
        !identical(f$studentId,input$studentId) || !identical(id,paste0("prediction:",f$attemptId)) ||
        !identical(f$questionId,e$aggregate_id) || !identical(f$sessionId,e$session_id) ||
        !identical(f$target,"QUESTION_CORRECTNESS_WITHOUT_DECLARED_HELP") ||
        !identical(f$modelVersion,"PERSONAL_BETA11_PREFIX_V1") ||
        !identical(f$evaluationHorizon,"FIRST_SUBMISSION_OF_RESERVED_ATTEMPT_IN_SESSION") ||
        !identical(f$can_apply,FALSE) || !identical(f$can_schedule,FALSE)) stop("Invalid forecast identity/authority")
    prediction_ids <- c(prediction_ids,f$predictionId)
    created <- scalar_time(f$createdAt); cutoff_at <- scalar_time(f$dataCutoffAt)
    if (!identical(f$createdAt,e$occurred_at) || cutoff_at>created ||
        length(f$snapshotRowid)!=1L || !is.finite(f$snapshotRowid) || f$snapshotRowid<0 ||
        f$snapshotRowid!=floor(f$snapshotRowid) || f$snapshotRowid>=e$snapshot_rowid)
      stop("Forecast temporal cutoff invalid")
    # Independently reconstruct exactly the allowable prefix, never use later outcomes.
    expected <- ids[vapply(ids,function(key) {
      r <- rows[[key]]
      identical(r$event_type,"ANSWER_SUBMITTED") && r$snapshot_rowid<=f$snapshotRowid &&
        times[[key]]<cutoff_at && eligible(payload[[key]])
    },logical(1))]
    evidence <- as.character(unlist(f$evidenceEventIds,use.names=FALSE))
    if (anyDuplicated(evidence) || !setequal(expected,evidence)) stop("Future/missing/ineligible forecast evidence")
    n <- length(expected)
    k <- sum(vapply(expected,function(key)isTRUE(payload[[key]]$isCorrect),logical(1)))
    if (!identical(as.numeric(f$nEvidence),as.numeric(n)) || f$nCorrect!=k ||
        !is.numeric(f$probability) || length(f$probability)!=1L || !is.finite(f$probability) ||
        abs(f$probability-(k+1)/(n+2))>1e-12 || !identical(f$referenceProbability,0.5))
      stop("Forecast probability does not match frozen prefix")
    attempt_key <- paste0("attempt:",f$attemptId)
    if (!attempt_key %in% ids) { exclusions[[id]] <- "PENDING_OUTCOME"; next }
    a <- rows[[attempt_key]]; y <- payload[[attempt_key]]
    if (!identical(a$event_type,"ANSWER_SUBMITTED") || a$snapshot_rowid<=e$snapshot_rowid ||
        times[[attempt_key]]<created || !identical(a$aggregate_id,f$questionId) ||
        !identical(a$session_id,f$sessionId) || !identical(y$attemptId,f$attemptId) ||
        !identical(y$questionId,f$questionId) || !identical(y$prospectivePredictionId,f$predictionId))
      stop("Attempt association or precommit ordering invalid")
    if (!identical(f$origin,"REAL_STUDY") || !eligible(y)) {
      exclusions[[id]] <- "INELIGIBLE_OR_UNKNOWN_ORIGIN_HELP_OR_ANSWER_KEY"; next
    }
    scored[[id]] <- list(prediction_id=f$predictionId,attempt_id=f$attemptId,
      question_id=f$questionId,session_id=f$sessionId,p=f$probability,y=as.integer(y$isCorrect),
      response_delay_seconds=as.numeric(difftime(times[[attempt_key]],created,units="secs")),
      novelty_status=f$noveltyStatus,confidence_capture="UNVERIFIED_NOT_SCORED",
      retained_evidence_fields=names(y))
  }
  if (anyDuplicated(prediction_ids)) stop("Duplicate prediction UUID")
  y <- vapply(scored,function(r)r$y,numeric(1)); p <- vapply(scored,function(r)r$p,numeric(1))
  metric <- function(y,p) {
    if (!length(y)) return(list(status="INSUFFICIENT_EVIDENCE",n=0L))
    out <- cal_metrics(y,p)
    reference <- cal_metrics(y,rep(0.5,length(y)))
    out$brier_skill_score <- 1-out$brier/reference$brier
    out$reference <- reference;out$bias <- mean(p-y)
    out
  }
  bins <- list()
  for (bin in 0:9) {
    index <- which(p>=bin/10 & (p<(bin+1)/10 | (bin==9 & p<=1)))
    if (length(index)) bins[[as.character(bin)]] <- list(n=length(index),
      mean_prediction=mean(p[index]),observed_rate=mean(y[index]),
      observed_rate_wilson=calculate_wilson_ci(sum(y[index]),length(index)))
  }
  delay <- vapply(scored,function(r)r$response_delay_seconds,numeric(1))
  groups <- cut(delay,c(-Inf,60,600,Inf),labels=c("LE_60S","60_TO_600S","GT_600S"))
  horizons <- lapply(levels(groups),function(g)metric(y[groups==g],p[groups==g]))
  names(horizons) <- levels(groups)
  list(contract_version="prospective-evaluation-v1",input_sha256=envelope$inputSha256,
    source_kind=input$sourceKind,target="QUESTION_CORRECTNESS_WITHOUT_DECLARED_HELP",
    model="PERSONAL_BETA11_PREFIX_V1",metrics=metric(y,p),calibration_bins=bins,
    response_delay_metrics_NOT_memory_retention_horizons=horizons,
    forecast_count=length(forecasts),scored_count=length(scored),excluded_count=length(exclusions),
    coverage=if(length(forecasts))length(scored)/length(forecasts) else NULL,
    unique_questions=length(unique(vapply(scored,function(r)r$question_id,character(1)))),
    unique_sessions=length(unique(vapply(scored,function(r)r$session_id,character(1)))),
    independent_units="NOT_ESTABLISHED_QUESTIONS_AND_SESSIONS_ARE_COUNTS_ONLY",
    exclusions=exclusions,predictions=scored,
    uncertainty="Wilson intervals describe observed bin rates only; model-parameter and dependence uncertainty not estimated",
    high_probability_errors=sum(p>=0.8 & y==0),
    personal_validation="NOT_ESTABLISHED",causal_effect="NOT_EVALUATED",
    limitations=c("Not an FSRS recall evaluation","No conceptual mastery inference",
      "No individual superiority claim","No fixed delayed-retention test",
      "Confidence timing unverified; historical unknown help excluded"),
    can_apply=FALSE,can_schedule=FALSE)
}

if (sys.nframe()==0L) {
  args <- commandArgs(trailingOnly=TRUE)
  if (length(args)!=2L || file.exists(args[2])) stop("Usage: new input-envelope.json NEW-output.json")
  result <- evaluate_prospective(args[1])
  writeLines(jsonlite::toJSON(result,auto_unbox=TRUE,pretty=TRUE,na="null",null="null",digits=16),args[2])
  cat("Prospective sidecar evaluation: ",result$scored_count," scored, ",result$excluded_count," excluded; can_apply=false\n",sep="")
}
