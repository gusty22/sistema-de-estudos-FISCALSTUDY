# A pure experimental baseline; caller supplies only the validated frozen prefix.
prospective_recent20 <- function(outcomes) {
  if (anyNA(outcomes) || any(!outcomes %in% c(0,1))) stop("Invalid prefix outcomes")
  recent <- tail(outcomes,20L)
  (sum(recent)+1)/(length(recent)+2)
}

# Read-only descriptive scoring; no fitted parameters, scheduling or superiority test.
prospective_discrimination <- function(y,p) {
  if (length(y)!=length(p) || anyNA(y) || any(!y %in% c(0,1)) ||
      any(!is.finite(p) | p<0 | p>1)) stop("Invalid scorecard observations")
  positives <- sum(y==1); negatives <- sum(y==0)
  if (!positives || !negatives) return(list(status="INSUFFICIENT_EVIDENCE",
    roc_auc=NULL,average_precision_error=NULL,reason="Both outcomes required"))
  auc <- (sum(rank(p,ties.method="average")[y==1])-positives*(positives+1)/2)/
    (positives*negatives)
  # Group equal scores before computing stepwise AP: row order must not break ties.
  error_score <- 1-p; error <- 1-y
  thresholds <- sort(unique(error_score),decreasing=TRUE)
  tp <- 0; seen <- 0; ap <- 0
  for (threshold in thresholds) {
    index <- which(error_score==threshold)
    added <- sum(error[index]); tp <- tp+added; seen <- seen+length(index)
    ap <- ap + (added/negatives)*(tp/seen)
  }
  list(status="DESCRIPTIVE_NOT_VALIDATED",roc_auc=auc,
    average_precision_error=ap,error_prevalence=negatives/length(y),
    ties="Grouped score thresholds; ROC midranks")
}

prospective_scorecard <- function(scored) {
  get <- function(name) vapply(scored,function(r)r[[name]],numeric(1))
  y <- get("y"); p <- get("p"); reference <- get("recent20_probability")
  discrimination <- prospective_discrimination(y,p)
  if (!length(y)) return(list(version="prospective-scorecard-v1",
    status="INSUFFICIENT_EVIDENCE",n=0L,discrimination=discrimination,
    can_apply=FALSE,can_schedule=FALSE))
  if (length(reference)!=length(y) || any(!is.finite(reference) |
      reference<=0 | reference>=1)) stop("Invalid frozen temporal reference")
  brier <- (p-y)^2; ref_brier <- (reference-y)^2
  loss <- -(y*log(pmax(p,1e-15))+(1-y)*log(pmax(1-p,1e-15)))
  ref_loss <- -(y*log(reference)+(1-y)*log1p(-reference))
  list(version="prospective-scorecard-v1",status="DESCRIPTIVE_NOT_VALIDATED",
    n=length(y),discrimination=discrimination,
    temporal_reference=list(model="RECENT_20_ELIGIBLE_BETA11_V1",
      rule="Last at most 20 eligible outcomes strictly before each frozen cutoff",
      window_selection="Fixed before evaluation; not tuned on outcomes",
      brier=mean(ref_brier),log_loss=mean(ref_loss),
      same_event_count=length(y),
      identical_prediction_count=sum(abs(p-reference)<1e-12),
      brier_skill_score=if(mean(ref_brier)>0)1-mean(brier)/mean(ref_brier) else NULL),
    paired_comparison=list(direction="Negative model-minus-reference favors current model",
      mean_brier_difference=mean(brier-ref_brier),
      mean_log_loss_difference=mean(loss-ref_loss),
      worse_events=sum(brier>ref_brier),better_events=sum(brier<ref_brier),
      tied_events=sum(brier==ref_brier),
      inference_status="INSUFFICIENT_EVIDENCE_FOR_DEPENDENCE_AWARE_SUPERIORITY",
      confidence_interval=NULL),
    high_confidence=list(threshold=0.8,
      predicted_success_count=sum(p>=0.8),unexpected_errors=sum(p>=0.8 & y==0),
      predicted_error_count=sum(p<=0.2),unexpected_successes=sum(p<=0.2 & y==1)),
    uncertainty="No independent-unit or parameter CI inferred from repeated attempts",
    personal_validation="NOT_ESTABLISHED",can_apply=FALSE,can_schedule=FALSE)
}
