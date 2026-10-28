# Experimental correctness models, not memory or conceptual-mastery estimators.
# Observed event_order is ordinal only; no elapsed-time interpretation.
source("lab/prospective_scorecard.R")
contextual_prequential <- function(events, warmup=10L) {
  required <- c("event_id","student_id","question_id","event_order","skill_key","is_correct")
  if (!is.data.frame(events) || !all(required %in% names(events))) stop("Missing prequential fields")
  if (length(warmup)!=1L || is.na(warmup) || warmup<0 || warmup!=floor(warmup)) stop("Invalid warmup")
  d <- events
  for (field in c("event_id","student_id","question_id"))
    if (anyNA(d[[field]]) || any(!nzchar(trimws(as.character(d[[field]]))))) stop("Missing identity")
  if (anyDuplicated(d$event_id)) stop("Duplicate event")
  if (anyNA(d$event_order) || !is.numeric(d$event_order) ||
      any(!is.finite(d$event_order) | d$event_order<0 | d$event_order!=floor(d$event_order)))
    stop("Invalid ordinal chronology")
  d$event_order <- as.numeric(d$event_order)
  if (!"eligible" %in% names(d)) d$eligible <- TRUE
  if (!is.logical(d$eligible) || anyNA(d$eligible)) stop("Explicit eligibility required")
  d <- d[d$eligible,,drop=FALSE]
  if (!is.numeric(d$is_correct) || anyNA(d$is_correct) || any(!d$is_correct %in% c(0,1))) stop("Invalid binary target")
  if (anyDuplicated(paste(d$student_id,d$event_order,sep=":"))) stop("Ambiguous student chronology")
  if (!nrow(d)) return(data.frame())
  # No catalogue join: skill_key is the annotation transported WITH this event.
  d$skill_key <- as.character(d$skill_key)
  d$skill_key[is.na(d$skill_key) | !nzchar(trimws(d$skill_key)) | d$skill_key=="UNCLASSIFIED"] <- NA_character_
  d <- d[order(d$student_id,d$event_order,d$event_id,method="radix"),,drop=FALSE]
  rows <- list()
  for (student in sort(unique(d$student_id))) {
    own <- d[d$student_id==student,,drop=FALSE]
    history <- numeric(); skills <- new.env(parent=emptyenv()); items <- new.env(parent=emptyenv())
    # Fixed before outcomes; deliberately no test-selected hyperparameters.
    weights <- rep(0,5); rate <- 0.05; ridge <- 0.01
    cutoff <- NA_real_
    for (i in seq_len(nrow(own))) {
      e <- own[i,,drop=FALSE]; n <- length(history)
      beta <- (sum(history)+1)/(n+2)
      recent <- tail(history,20L); temporal <- (sum(recent)+1)/(length(recent)+2)
      key <- e$skill_key
      sh <- if (!is.na(key) && exists(key,skills,inherits=FALSE)) get(key,skills) else numeric()
      topic <- (sum(sh)+20*beta)/(length(sh)+20)
      count <- if(exists(e$question_id,items,inherits=FALSE)) get(e$question_id,items) else 0L
      # All features are prefix-only, bounded and available to every competitor.
      x <- c(1,2*beta-1,2*temporal-1,2*topic-1,min(log1p(count)/log(21),1))
      logistic <- plogis(sum(weights*x))
      probs <- c(PERSONAL_BETA11_PREFIX_V1=beta,RECENT20_BETA11_V1=temporal,
        CONTENT_SHRINK20_V1=topic,CONTEXT_ONLINE_RIDGE_V1=logistic)
      if (n>=warmup) {
        for (name in names(probs)) rows[[length(rows)+1L]] <- data.frame(
          event_id=e$event_id,student_id=student,question_id=e$question_id,
          event_order=e$event_order,skill_key=key,observed_correct=e$is_correct,
          model_name=name,predicted_probability=unname(probs[name]),
          training_observations=n,cutoff_order=cutoff,
          evaluation_partition=if(i>floor(0.8*nrow(own))) "FINAL_TEMPORAL" else "DEVELOPMENT_EXPOSED",
          novelty=if(count) "REPEATED_ITEM" else "FIRST_OBSERVED_ITEM",
          evidence_kind="RETROSPECTIVE_PREQUENTIAL_RECONSTRUCTION",
          parameter_state=if(name=="CONTEXT_ONLINE_RIDGE_V1") paste(format(weights,digits=17),collapse=",") else "PREFIX_COUNTS_RECONSTRUCTIBLE",
          model_state=if(n<20) "LOW_HISTORY_CONSERVATIVE_ESTIMATE" else "EXPERIMENTAL_NOT_VALIDATED",
          stringsAsFactors=FALSE)
      }
      # Outcome revealed only HERE, after all predictions; current row is never passed to a fitter.
      weights <- weights-rate*((logistic-e$is_correct)*x+ridge*weights)
      history <- c(history,e$is_correct)
      if(!is.na(key)) assign(key,c(sh,e$is_correct),skills)
      assign(e$question_id,count+1L,items)
      cutoff <- e$event_order
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind,rows); rownames(out) <- NULL
  out
}

contextual_scores <- function(rows) {
  if (!nrow(rows)) return(list(status="INSUFFICIENT_EVIDENCE",n=0L))
  y <- rows$observed_correct; p <- rows$predicted_probability
  if (anyNA(y) || any(!y %in% c(0,1)) || any(!is.finite(p)|p<0|p>1)) stop("Invalid scoring data")
  z <- pmin(1-1e-15,pmax(1e-15,p))
  bins <- lapply(0:9,function(k) {
    ix <- which(p>=k/10 & (p<(k+1)/10 | (k==9 & p<=1)))
    list(lower=k/10,n=length(ix),mean_prediction=if(length(ix))mean(p[ix]) else NULL,
      observed_rate=if(length(ix))mean(y[ix]) else NULL)
  })
  calibration <- list(status="INSUFFICIENT_EVIDENCE",intercept=NULL,slope=NULL)
  if (length(unique(y))==2L && length(unique(p))>1L) {
    warnings <- character()
    fit <- tryCatch(withCallingHandlers(glm(y~qlogis(z),family=binomial()),
      warning=function(w){warnings <<- c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)NULL)
    if(!is.null(fit) && isTRUE(fit$converged) && !length(warnings) && all(is.finite(coef(fit))))
      calibration <- list(status="DESCRIPTIVE_NOT_VALIDATED",intercept=unname(coef(fit)[1]),slope=unname(coef(fit)[2]))
  }
  positive <- sum(y); negative <- length(y)-positive
  list(status="DESCRIPTIVE_NOT_VALIDATED",n=length(y),brier=mean((p-y)^2),
    log_loss=mean(-(y*log(z)+(1-y)*log1p(-z))),bias=mean(p-y),
    calibration_in_the_large_definition="Mean predicted probability minus observed frequency",
    calibration=calibration,reliability=bins,
    roc_auc=prospective_discrimination(y,p)$roc_auc,
    average_precision_error=prospective_discrimination(y,p)$average_precision_error,
    high_confidence=list(threshold=0.8,n=sum(p>=0.8),errors=sum(p>=0.8 & y==0)),
    unique_items=length(unique(rows$question_id)),students=length(unique(rows$student_id)),
    independent_units="NOT_IDENTIFIED_BY_ITEM_COUNTS",
    abstentions=0L,coverage=1)
}

contextual_report <- function(predictions, seed=1907L, replicates=2000L) {
  if(!nrow(predictions)) return(list(status="INSUFFICIENT_EVIDENCE",can_apply=FALSE,can_schedule=FALSE))
  d <- predictions[predictions$evaluation_partition=="FINAL_TEMPORAL",,drop=FALSE]
  models <- unique(d$model_name); baseline <- "PERSONAL_BETA11_PREFIX_V1"
  if(!baseline %in% models) stop("Missing reference")
  score <- lapply(models,function(m) contextual_scores(d[d$model_name==m,,drop=FALSE]));names(score)<-models
  comparisons <- list()
  reference <- d[d$model_name==baseline,,drop=FALSE]
  # Preserve caller RNG: reproducible cluster resampling without hidden global side effects.
  existed <- exists(".Random.seed",envir=.GlobalEnv,inherits=FALSE)
  if(existed) saved <- get(".Random.seed",envir=.GlobalEnv)
  on.exit(if(existed) assign(".Random.seed",saved,envir=.GlobalEnv) else if(exists(".Random.seed",envir=.GlobalEnv,inherits=FALSE)) rm(".Random.seed",envir=.GlobalEnv))
  set.seed(seed)
  for(m in setdiff(models,baseline)) for(ref in unique(c(baseline,
      if(m=="CONTEXT_ONLINE_RIDGE_V1") c("CONTENT_SHRINK20_V1","RECENT20_BETA11_V1") else character()))) {
    reference <- d[d$model_name==ref,,drop=FALSE]
    own <- d[d$model_name==m,,drop=FALSE]
    akey<-paste(own$student_id,own$event_id,sep=":");bkey<-paste(reference$student_id,reference$event_id,sep=":")
    if(anyDuplicated(akey)||anyDuplicated(bkey)||!setequal(akey,bkey)) stop("Unpaired coverage")
    own<-own[match(bkey,akey),,drop=FALSE]
    if(!identical(own$observed_correct,reference$observed_correct)) stop("Conflicting paired outcome")
    a<-own$predicted_probability;b<-reference$predicted_probability;y<-own$observed_correct
    loss<-function(p) -(y*log(pmax(p,1e-15))+(1-y)*log(pmax(1-p,1e-15)))
    db<-(a-y)^2-(b-y)^2;dl<-loss(a)-loss(b)
    per<-aggregate(cbind(brier=db,log_loss=dl),list(student_id=own$student_id),mean)
    intervals<-NULL
    if(nrow(per)>=2L) {
      boot<-replicate(replicates,{ix<-sample.int(nrow(per),nrow(per),replace=TRUE);colMeans(per[ix,c("brier","log_loss"),drop=FALSE])})
      intervals<-lapply(seq_len(2),function(j)unname(quantile(boot[j,],c(.025,.975))))
      names(intervals)<-c("brier","log_loss")
    }
    comparisons[[paste(m,"vs",ref,sep="__")]]<-list(model=m,reference=ref,paired_events=length(y),paired_students=nrow(per),
      mean_brier_difference=mean(db),mean_log_loss_difference=mean(dl),
      brier_skill_score=if(mean((b-y)^2)>0)1-mean((a-y)^2)/mean((b-y)^2) else NULL,
      equal_student_mean_brier_difference=mean(per$brier),
      equal_student_mean_log_loss_difference=mean(per$log_loss),
      harmed_students=per[per$brier>0,,drop=FALSE],student_differences=per,
      student_cluster_bootstrap_95=intervals,
      inference="Conditional descriptive cluster bootstrap; selected students not population-representative; single-student temporal uncertainty NOT_ESTIMATED",
      verdict="INCONCLUSIVE",can_apply=FALSE)
  }
  list(contract_version="contextual-prequential-v1",target="ASSISTMENTS_FIRST_ATTEMPT_CORRECT_HELP_FAILURE",
    evidence_kind="RETROSPECTIVE_PREQUENTIAL_RECONSTRUCTION",partition="FINAL_TEMPORAL",
    metrics=score,comparisons=comparisons,
    novelty=lapply(split(d,d$novelty),function(g) lapply(split(g,g$model_name),contextual_scores)),
    content=lapply(split(d,d$skill_key),function(g) lapply(split(g,g$model_name),contextual_scores)),
    content_note="Descriptive strata; no item difficulty calibration, semantic-transfer inference or subgroup superiority",
    protocol="contextual-v1-fixed-before-execution",bootstrap_seed=seed,bootstrap_replicates=replicates,
    time_horizons="NOT_AVAILABLE_ORDINAL_DATA",personal_validation="NOT_ESTABLISHED",
    semantic_novelty="NOT_ESTABLISHED",can_apply=FALSE,can_schedule=FALSE)
}
