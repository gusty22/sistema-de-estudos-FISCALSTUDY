# Experimental sidecar evaluator. No scheduling, FSRS fitting or database writes.
source("R/descriptive_analysis.R")
source("lab/individual_calibration.R")
source("lab/prospective_scorecard.R")

evaluate_prospective <- function(path, require_current_capture=FALSE) {
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
  recorded <- lapply(rows,function(e)scalar_time(e$recorded_at))
  names(rows) <- names(payload) <- names(times) <- names(recorded) <- ids
  if (any(vapply(ids,function(key) recorded[[key]]<times[[key]],logical(1))))
    stop("Recording precedes occurrence")
  if (length(recorded)>1L && any(diff(vapply(recorded,as.numeric,numeric(1)))<0))
    stop("Append chronology regressed")
  answer_ids <- ids[vapply(rows,function(e)identical(e$event_type,"ANSWER_SUBMITTED"),logical(1))]
  attempts <- vapply(answer_ids,function(key) {
    a <- rows[[key]]; n <- payload[[key]]
    # Legacy unforecasted history may lack attempt UUIDs. Keep it in denominators,
    # never invent identity or grant current-capture eligibility to it.
    if (!is.null(n$helpDeclarationProvided) &&
        (!uuid(n$attemptId) || !identical(key,paste0("attempt:",n$attemptId)) ||
         !identical(n$questionId,a$aggregate_id))) stop("Invalid answer identity")
    for (field in c("usedHelp","helpDeclarationProvided","answerExposed","answer_exposed"))
      if (!is.null(n[[field]]) && (!is.logical(n[[field]]) || length(n[[field]])!=1L || is.na(n[[field]])))
        stop("Malformed answer Boolean")
    if (uuid(n$attemptId)) n$attemptId else NA_character_
  },character(1))
  if (anyDuplicated(attempts[!is.na(attempts)])) stop("Duplicate physical attempt")
  eligible <- function(n, strict=FALSE) (!strict ||
    (identical(n$helpDeclarationProvided,TRUE) && identical(n$helpType,"NENHUM"))) &&
    !isTRUE(n$answerExposed) && !isTRUE(n$answer_exposed) && identical(n$origin,"REAL_STUDY") &&
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
    strict <- identical(f$captureVersion,"ordinary-question-capture-v2")
    if (strict && !identical(f$policyVersion,"OBSERVATIONAL_NO_PLANNING_CHANGE_V1"))
      stop("Invalid observational policy version")
    created <- scalar_time(f$createdAt); cutoff_at <- scalar_time(f$dataCutoffAt)
    if (!identical(f$createdAt,e$occurred_at) || cutoff_at>created ||
        length(f$snapshotRowid)!=1L || !is.finite(f$snapshotRowid) || f$snapshotRowid<0 ||
        f$snapshotRowid!=floor(f$snapshotRowid) || f$snapshotRowid>=e$snapshot_rowid)
      stop("Forecast temporal cutoff invalid")
    # Independently reconstruct exactly the allowable prefix, never use later outcomes.
    expected <- ids[vapply(ids,function(key) {
      r <- rows[[key]]
      identical(r$event_type,"ANSWER_SUBMITTED") && r$snapshot_rowid<=f$snapshotRowid &&
        times[[key]]<cutoff_at && recorded[[key]]<=cutoff_at && eligible(payload[[key]],strict)
    },logical(1))]
    evidence <- as.character(unlist(f$evidenceEventIds,use.names=FALSE))
    if (anyDuplicated(evidence) || !setequal(expected,evidence)) stop("Future/missing/ineligible forecast evidence")
    # Temporal reference uses exactly the same eligible frozen prefix.
    # Presentation order is irrelevant; equal times use append-only rowid.
    recent_ids <- expected[order(vapply(expected,function(key)
      as.numeric(times[[key]]),numeric(1)),vapply(expected,function(key)
      rows[[key]]$snapshot_rowid,numeric(1)))]
    recent_probability <- prospective_recent20(vapply(recent_ids,function(key)
      as.integer(isTRUE(payload[[key]]$isCorrect)),integer(1)))
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
        times[[attempt_key]]<=created || times[[attempt_key]]<=recorded[[id]] ||
        recorded[[id]]<created || recorded[[attempt_key]]<times[[attempt_key]] || !identical(a$aggregate_id,f$questionId) ||
        !identical(a$session_id,f$sessionId) || !identical(y$attemptId,f$attemptId) ||
        !identical(y$questionId,f$questionId) || !identical(y$prospectivePredictionId,f$predictionId) ||
        (!is.null(y$studentId) && !identical(y$studentId,input$studentId)))
      stop("Attempt association or precommit ordering invalid")
    if (isTRUE(require_current_capture) && !strict) {
      exclusions[[id]] <- "LEGACY_CAPTURE_UNAUDITED_NOT_PERSONAL_EVIDENCE"; next
    }
    if (!identical(f$origin,"REAL_STUDY") || !eligible(y,strict)) {
      exclusions[[id]] <- if (isTRUE(y$answerExposed) || isTRUE(y$answer_exposed)) "KNOWN_ANSWER_EXPOSURE" else
        if (strict && !identical(y$helpDeclarationProvided,TRUE)) "MISSING_HELP_DECLARATION" else
        if (identical(y$usedHelp,TRUE)) "DECLARED_HELP" else
        if (strict && identical(y$usedHelp,FALSE) && !identical(y$helpType,"NENHUM")) "CONTRADICTORY_OR_UNKNOWN_HELP_TYPE" else
        "INELIGIBLE_OR_UNKNOWN_ORIGIN_HELP_OR_ANSWER_KEY"
      next
    }
    scored[[id]] <- list(prediction_id=f$predictionId,attempt_id=f$attemptId,
      question_id=f$questionId,session_id=f$sessionId,p=f$probability,y=as.integer(y$isCorrect),
      recent20_probability=recent_probability,
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
    source_authentication="NOT_AUTHENTICATED_BY_THIS_HASH_ONLY_EVALUATOR",
    source_kind=input$sourceKind,target="QUESTION_CORRECTNESS_WITHOUT_DECLARED_HELP",
    model="PERSONAL_BETA11_PREFIX_V1",metrics=metric(y,p),
    scientific_scorecard=prospective_scorecard(scored),
    strong_reference=list(model="ONLINE_PERSONAL_BETA11_SAME_PREFIX",n=length(y),
      status="IDENTICAL_TO_CURRENT_BASELINE_NOT_AN_INDEPENDENT_COMPETITOR",
      brier_skill_score=if(length(y))0 else NULL),
    protocol_version="personal-prospective-pilot-v1",calibration_bins=bins,
    response_delay_metrics_NOT_memory_retention_horizons=horizons,
    attempt_count=sum(vapply(rows,function(e)identical(e$event_type,"ANSWER_SUBMITTED"),logical(1))),
    unforecasted_attempt_count=sum(vapply(ids,function(key) {
      identical(rows[[key]]$event_type,"ANSWER_SUBMITTED") &&
        !paste0("prediction:",payload[[key]]$attemptId) %in% forecasts
    },logical(1))),
    unidentified_legacy_attempt_count=sum(is.na(attempts)),
    capture_versions=unique(vapply(forecasts,function(id)
      if(is.null(payload[[id]]$captureVersion)) "LEGACY_UNKNOWN" else payload[[id]]$captureVersion,character(1))),
    forecast_count=length(forecasts),scored_count=length(scored),excluded_count=length(exclusions),
    coverage=if(length(forecasts))length(scored)/length(forecasts) else NULL,
    unique_questions=length(unique(vapply(scored,function(r)r$question_id,character(1)))),
    unique_sessions=length(unique(vapply(scored,function(r)r$session_id,character(1)))),
    independent_units="NOT_ESTABLISHED_QUESTIONS_AND_SESSIONS_ARE_COUNTS_ONLY",
    exclusions=exclusions,predictions=scored,
    uncertainty="Wilson intervals describe observed bin rates only; model-parameter and dependence uncertainty not estimated",
    high_probability_errors=sum(p>=0.8 & y==0),
    capture_limitations=list(assistance="DECLARED_ONLY_UNOBSERVED_HELP_NOT_DETECTABLE",
      answer_exposure="NO_COMPLETE_OPERATIONAL_REVEAL_LOG",
      prior_exposure="RECORDED_ATTEMPTS_AND_PRESENTATION_RECEIPTS_NOT_ALL_CONTACTS",
      active_time="CLIENT_REPORTED_NOT_INDEPENDENT_DURATION_TARGET",
      difficulty="NOT_SNAPSHOTTED_IN_THIS_FORECAST",
      identity="SINGLE_LOCAL_USER_SOURCE_KEY_AND_INSTALLATION_SCOPE"),
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
