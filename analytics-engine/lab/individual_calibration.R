# Laboratory-only probability calibration. Never a forgetting equation or scheduler.
cal_clip <- function(p) pmin(1 - 1e-6, pmax(1e-6, p))
cal_loss <- function(y, p) mean(-(y * log(pmax(p,1e-15)) + (1-y) * log(pmax(1-p,1e-15))))
cal_shift <- function(p, shift) plogis(qlogis(cal_clip(p)) + shift)
fit_shift <- function(p, y, center=0, penalty=1) {
  if (!length(y)) return(center)
  if (length(p)!=length(y) || any(!is.finite(p) | p<0 | p>1) ||
      any(!y %in% c(0,1)) || !is.finite(penalty) || penalty<=0) stop("Invalid calibration fit")
  optimize(function(a) sum(-(y*log(cal_clip(cal_shift(p,a))) +
    (1-y)*log1p(-cal_clip(cal_shift(p,a))))) + penalty*(a-center)^2/2,
    interval=c(-12,12), tol=1e-10)$minimum
}
cal_metrics <- function(y,p) list(n=length(y),brier=mean((y-p)^2),
  log_loss=cal_loss(y,p),mean_prediction=mean(p),observed_rate=mean(y))

evaluate_individual_calibration <- function(data) {
  required <- c("event_id","student_id","question_id","occurred_at","is_correct",
    "fsrs_retrievability_pre_update","fsrs_evidence_status")
  if (!all(required %in% names(data))) stop("Missing calibration observations")
  data <- data[data$fsrs_evidence_status=="UNCALIBRATED_ITEM_ESTIMATE",,drop=FALSE]
  if (!nrow(data)) return(list(status="INSUFFICIENT_EVIDENCE",predictions=list(),can_apply=FALSE))
  data$t <- parse_evidence_timestamp(data$occurred_at)
  data$p <- suppressWarnings(as.numeric(data$fsrs_retrievability_pre_update))
  data$y <- as.integer(data$is_correct=="true")
  if (anyNA(data$t) || any(!is.finite(data$p) | data$p<0 | data$p>1) ||
      any(!data$is_correct %in% c("true","false")) || anyDuplicated(data$event_id))
    stop("Invalid calibration data")
  data <- data[order(data$t,data$event_id),,drop=FALSE]
  # Split timestamp batches WITHIN student; never split equal-time observations.
  data$split <- NA_character_
  for (id in unique(data$student_id)) {
    idx <- which(data$student_id==id)
    rank <- match(data$t[idx],sort(unique(data$t[idx])))
    if (max(rank)<6L) next
    data$split[idx] <- ifelse(rank<=3,"TRAIN",ifelse(rank==4,"VALIDATION","TEST"))
  }
  usable <- !is.na(data$split)
  excluded <- sort(unique(data$student_id[!usable]))
  data <- data[usable,,drop=FALSE]
  if (!nrow(data)) return(list(status="INSUFFICIENT_EVIDENCE",predictions=list(),
    excluded_students=excluded,can_apply=FALSE))
  train <- data[data$split=="TRAIN",,drop=FALSE]
  validation <- data[data$split=="VALIDATION",,drop=FALSE]
  test <- data[data$split=="TEST",,drop=FALSE]
  if (max(train$t)>=min(validation$t) || max(validation$t)>=min(test$t))
    stop("Global calibration requires non-overlapping absolute time windows")
  global <- fit_shift(train$p,train$y)
  lambdas <- c(1,4,16) # Registered experimental shrinkage strengths, not cognitive properties.
  fits <- lapply(lambdas,function(lambda) {
    vapply(sort(unique(train$student_id)),function(id) {
      rows <- train[train$student_id==id,,drop=FALSE]
      fit_shift(rows$p,rows$y,center=global,penalty=lambda)
    },numeric(1))
  })
  validation_loss <- vapply(fits,function(fit)
    cal_loss(validation$y,cal_shift(validation$p,fit[validation$student_id])),numeric(1))
  selected <- which.min(validation_loss) # Fixed order resolves ties. No test labels used.
  shifts <- fits[[selected]]
  frozen_mean <- (sum(train$y)+1)/(nrow(train)+2)
  models <- list(FSRS_OFFICIAL=test$p,
    GLOBAL_SHIFT=cal_shift(test$p,global),
    INDIVIDUAL_SHRUNK_SHIFT=cal_shift(test$p,shifts[test$student_id]),
    TRAIN_BETA11=rep(frozen_mean,nrow(test)))
  predictions <- do.call(rbind,lapply(names(models),function(name) data.frame(
    event_id=test$event_id,student_id=test$student_id,model_name=name,
    predicted_probability=as.numeric(models[[name]]),observed_correct=test$y,
    stringsAsFactors=FALSE)))
  students <- lapply(sort(unique(train$student_id)),function(id) {
    tr <- train[train$student_id==id,,drop=FALSE]
    va <- validation[validation$student_id==id,,drop=FALSE]
    te <- test[test$student_id==id,,drop=FALSE]
    list(student_id=id,n_train=nrow(tr),n_validation=nrow(va),n_test=nrow(te),
      n_train_items=length(unique(tr$question_id)),shift=unname(shifts[id]),
      shift_uncertainty="NOT_ESTIMATED",latent_retention_parameter="NOT_IDENTIFIED")
  })
  list(status="EXPLORATORY_TEMPORAL_HOLDOUT",version="individual-calibration-lab-1",
    split=list(train_max=as.character(max(train$t)),validation_max=as.character(max(validation$t)),
      test_min=as.character(min(test$t))),
    global_shift=global,selected_penalty=lambdas[selected],
    selection=vapply(validation_loss,identity,numeric(1)),
    students=students,excluded_students=excluded,predictions=predictions,
    metrics=lapply(models,function(p) cal_metrics(test$y,p)),
    clipping="1e-6 numerical guard; no missing predictions imputed",
    can_apply=FALSE,can_schedule=FALSE,personal_validation="NOT_EXECUTED")
}

summarize_identifiability_probes <- function(data) {
  required <- c("event_id","student_id","occurred_at","is_correct","phase","item_index")
  if (!all(required %in% names(data)) || anyDuplicated(data$event_id)) stop("Invalid probe schema/identity")
  if (anyNA(parse_evidence_timestamp(data$occurred_at)) ||
      any(!data$is_correct %in% c("true","false")) ||
      any(!data$phase %in% c("IMMEDIATE","DELAYED"))) stop("Invalid probe outcome/time")
  raw_index <- suppressWarnings(as.numeric(data$item_index))
  if (any(!is.finite(raw_index) | raw_index!=floor(raw_index))) stop("Invalid probe index")
  data$item_index <- as.integer(raw_index)
  for (id in unique(data$student_id)) {
    group <- data[data$student_id==id,,drop=FALSE]
    if (length(unique(group$question_id))!=sum(group$phase=="IMMEDIATE")) stop("Inconsistent probe question identity")
    for (item in unique(group$question_id)) {
      item_rows <- group[group$question_id==item,,drop=FALSE]
      if (nrow(item_rows)!=2L || !setequal(item_rows$phase,c("IMMEDIATE","DELAYED")) ||
          length(unique(item_rows$item_index))!=1L) stop("Invalid probe pair")
      times <- parse_evidence_timestamp(item_rows$occurred_at)
      if (times[item_rows$phase=="IMMEDIATE"]>=times[item_rows$phase=="DELAYED"]) stop("Invalid probe chronology")
    }
  }
  if (anyNA(data$item_index) || any(data$item_index<1)) stop("Invalid probe index")
  points <- c(2L,8L,32L,64L)
  rows <- list()
  for (id in sort(unique(data$student_id))) for (phase in c("IMMEDIATE","DELAYED")) {
    group <- data[data$student_id==id & data$phase==phase,,drop=FALSE]
    group <- group[order(group$item_index),,drop=FALSE]
    if (anyDuplicated(group$item_index)) stop("Duplicate probe item")
    for (n in points[points<=nrow(group)]) {
      k <- sum(group$is_correct[seq_len(n)]=="true")
      ci <- calculate_wilson_ci(k,n)
      rows[[length(rows)+1L]] <- data.frame(student_id=id,phase=phase,n=n,k=k,
        rate=k/n,lower=unname(ci['lower']),upper=unname(ci['upper']),stringsAsFactors=FALSE)
    }
  }
  list(status="OBSERVED_RECALL_DIFFERENCES_ONLY",estimates=if(length(rows)) do.call(rbind,rows) else list(),
    knowledge_vs_forgetting="NOT_IDENTIFIED",half_life="NOT_ESTIMATED",
    interval_assumption="Conditionally independent synthetic items; not human repeated-trial intervals",
    can_apply=FALSE,can_schedule=FALSE)
}
