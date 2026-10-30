# Read-only scientific sidecar. No model fitting, experiment assignment or operational writes.
source("R/learning_orchestrator.R")
source("R/analytical_portability.R")
source("R/descriptive_analysis.R")
source("lab/prospective_scorecard.R")
source("lab/individual_calibration.R")

scientific_target_matrix <- function() {
  list(
    DELAYED_ITEM_RETRIEVAL = list(
      target_id = "DELAYED_ITEM_RETRIEVAL",
      target_name = "Delayed Item Retrieval (Active Spaced Practice)",
      instrument_required = "Spaced active retrieval probe without hints or answer disclosure",
      unit_of_analysis = "item retrieval",
      preparation_event = "DEFINITION_REGISTERED with min_retention_seconds > 0 and prior learning contact",
      frozen_forecast = "FORECAST_COMMITTED with training_cutoff <= data_cutoff <= occurred_at < outcome",
      future_outcome = "OUTCOME_OBSERVED binary response in {0, 1} strictly after retention window",
      scoring_criterion = "DEFINITIVE_ANSWER_KEY or INDEPENDENT_BLINDED_RUBRIC; EQUAL_WEIGHT_BINARY_V1 or FIXED_SUCCESS_CRITERION_V1",
      provenance = "Homogeneous audit origin (REAL_STUDY with authorized custody or SYNTHETIC_FIXTURE); canonical payload SHA-256",
      evidence_of_independence = "Item-specific retention interval; template sharing cannot fabricate item retention lag",
      assistance = "Strictly NONE; answer_exposed strictly FALSE; any hint or exposure disqualifies",
      prior_exposure = "At least one prior contact before data cutoff; zero intervening contacts between forecast and outcome",
      temporal_window = "retention_lag_seconds >= min_retention_seconds; delay_seconds in [min_delay_seconds, max_delay_seconds]",
      eligibility = "lag >= min_retention, window valid, assistance==NONE, answer_exposed==FALSE, no intervening contact",
      exclusion_reasons = c("DELAYED_RETRIEVAL_INTERVAL_NOT_ESTABLISHED", "INTERVENING_ITEM_CONTACT", "ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT", "OUTCOME_OUTSIDE_PREDECLARED_HORIZON", "SCORING_RULE_MISMATCH", "RETENTION_INTERVAL_NOT_DEFINED"),
      scientific_limitations = "Delayed retrieval demonstrates item-level trace access, not conceptual mastery, transfer or lifetime retention",
      evaluation_capacity = "SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED"
    ),
    NOVEL_ITEM_CORRECTNESS = list(
      target_id = "NOVEL_ITEM_CORRECTNESS",
      target_name = "Novel Item Correctness (First Observed Presentation)",
      instrument_required = "First observed question presentation in designated exam or unexposed practice session",
      unit_of_analysis = "first observed item response",
      preparation_event = "DEFINITION_REGISTERED; optional representative exam blueprint with predeclared equal weight",
      frozen_forecast = "FORECAST_COMMITTED strictly before question presentation or attempt",
      future_outcome = "OUTCOME_OBSERVED binary response in {0, 1}",
      scoring_criterion = "DEFINITIVE_ANSWER_KEY or INDEPENDENT_BLINDED_RUBRIC",
      provenance = "Append-only verified single student event stream with payload hashes",
      evidence_of_independence = "Zero historical contacts with unit_id and zero historical contacts with template_id",
      assistance = "Strictly NONE; answer_exposed strictly FALSE",
      prior_exposure = "Zero previous contacts (learning, prompt, or outcome) with item or template",
      temporal_window = "delay_seconds in [min_delay_seconds, max_delay_seconds]",
      eligibility = "No prior item or template contact; registered before outcome; assistance NONE; answer unexposed",
      exclusion_reasons = c("PRIOR_ITEM_OR_TEMPLATE_EXPOSURE", "ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT", "OUTCOME_OUTSIDE_PREDECLARED_HORIZON"),
      scientific_limitations = "First observed attempt within study platform does not prove lifetime semantic novelty; does not measure retention or transfer",
      evaluation_capacity = "SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED"
    ),
    APPLICATION_SUCCESS = list(
      target_id = "APPLICATION_SUCCESS",
      target_name = "Independent Application Problem Success",
      instrument_required = "Independent application instrument requiring operational execution of rules on concrete case",
      unit_of_analysis = "independent application problem",
      preparation_event = "DEFINITION_REGISTERED with classification=INDEPENDENT_APPLICATION, classification_status=CONFIRMED, independent_instrument=TRUE",
      frozen_forecast = "FORECAST_COMMITTED before application attempt",
      future_outcome = "OUTCOME_OBSERVED binary response in {0, 1}",
      scoring_criterion = "DEFINITIVE_ANSWER_KEY or INDEPENDENT_BLINDED_RUBRIC",
      provenance = "Single student verified event ledger with canonical payload hashes",
      evidence_of_independence = "Audited classification INDEPENDENT_APPLICATION; verified independent template_id != UNKNOWN",
      assistance = "Strictly NONE; answer_exposed strictly FALSE",
      prior_exposure = "Zero prior exposure to this application unit or its application template",
      temporal_window = "delay_seconds in [min_delay_seconds, max_delay_seconds]",
      eligibility = "Confirmed independent application classification, known unexposed template, no assistance",
      exclusion_reasons = c("INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED", "TEMPLATE_INDEPENDENCE_UNKNOWN", "PRIOR_ITEM_OR_TEMPLATE_EXPOSURE", "ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT"),
      scientific_limitations = "Success in a single concrete application case does not guarantee transfer across diverse non-isomorphic contexts",
      evaluation_capacity = "SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED"
    ),
    TRANSFER_SUCCESS = list(
      target_id = "TRANSFER_SUCCESS",
      target_name = "Independent Conceptual Transfer Success",
      instrument_required = "Independent transfer instrument with varied superficial structure and deep conceptual equivalence",
      unit_of_analysis = "independent transfer instrument",
      preparation_event = "DEFINITION_REGISTERED with classification=INDEPENDENT_TRANSFER, classification_status=CONFIRMED, independent_instrument=TRUE",
      frozen_forecast = "FORECAST_COMMITTED before transfer attempt",
      future_outcome = "OUTCOME_OBSERVED binary response in {0, 1}",
      scoring_criterion = "DEFINITIVE_ANSWER_KEY or INDEPENDENT_BLINDED_RUBRIC",
      provenance = "Append-only verified single student event stream with payload hashes",
      evidence_of_independence = "Substantive structural independence: differing template_id from previously practiced items; confirmed transfer classification",
      assistance = "Strictly NONE; answer_exposed strictly FALSE",
      prior_exposure = "Zero prior exposure to transfer item or transfer template; question identity change alone is rejected",
      temporal_window = "delay_seconds in [min_delay_seconds, max_delay_seconds]",
      eligibility = "Confirmed independent transfer classification, distinct template, zero prior template contact, assistance NONE",
      exclusion_reasons = c("INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED", "TEMPLATE_INDEPENDENCE_UNKNOWN", "PRIOR_ITEM_OR_TEMPLATE_EXPOSURE", "ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT"),
      scientific_limitations = "Does not establish spontaneous unprompted transfer in high-stakes concurso examination contexts",
      evaluation_capacity = "SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED"
    ),
    ACTIVITY_DURATION_SECONDS = list(
      target_id = "ACTIVITY_DURATION_SECONDS",
      target_name = "Activity Active Duration Telemetry",
      instrument_required = "Telemetrically instrumented study activity with active interaction clock and pause detection",
      unit_of_analysis = "completed activity",
      preparation_event = "DEFINITION_REGISTERED with scoring_source=ACTIVE_TIME_TELEMETRY",
      frozen_forecast = "FORECAST_COMMITTED in non-negative seconds strictly before execution started_at",
      future_outcome = "OUTCOME_OBSERVED with value == active_seconds and linked execution_id",
      scoring_criterion = "ACTIVE_TIME_TELEMETRY with value matching execution active_seconds",
      provenance = "Operational telemetry recorded in append-only events",
      evidence_of_independence = "Execution clock validation: started_at <= ended_at <= et[event], active_seconds <= ended_at - started_at",
      assistance = "Strictly NONE; answer_exposed strictly FALSE",
      prior_exposure = "Prior completed authorized executions of same definition establish prefix mean/median baselines",
      temporal_window = "Forecast committed before execution started_at; duration observed after execution ended_at",
      eligibility = "Completed authorized execution; active_seconds finite and non-negative; clock consistent with outcome",
      exclusion_reasons = c("NO_COMPLETED_AUTHORIZED_EXECUTION", "ACTIVE_DURATION_NOT_ESTABLISHED", "DURATION_EXECUTION_DISAGREEMENT", "EXECUTION_UNIT_OR_SCOPE_MISMATCH", "FORECAST_AFTER_EXECUTION_STARTED", "FORECAST_EXECUTED_POLICY_MISMATCH"),
      scientific_limitations = "Active duration measures interaction time, not cognitive depth, attention quality, or learning rate",
      evaluation_capacity = "SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED"
    ),
    POST_INTERVENTION_SUCCESS = list(
      target_id = "POST_INTERVENTION_SUCCESS",
      target_name = "Post-Intervention Assessment Outcome",
      instrument_required = "Independent post-assessment administered following an authorized completed learning activity",
      unit_of_analysis = "independent post-intervention assessment",
      preparation_event = "DEFINITION_REGISTERED with classification=INDEPENDENT_POST_ASSESSMENT and post-execution delay window",
      frozen_forecast = "FORECAST_COMMITTED before outcome, associated with specific executed policy version",
      future_outcome = "OUTCOME_OBSERVED binary response in {0, 1} strictly following execution completion",
      scoring_criterion = "DEFINITIVE_ANSWER_KEY or INDEPENDENT_BLINDED_RUBRIC",
      provenance = "Followup link binding execution_id, outcome_id, and optional pre_outcome_id",
      evidence_of_independence = "Independent post-assessment classification; optional pre-measure strictly before activity started_at",
      assistance = "Strictly NONE; answer_exposed strictly FALSE",
      prior_exposure = "Zero prior exposure to post-assessment item or template",
      temporal_window = "Outcome occurred strictly after ended_at; post-lag = occurred_at - ended_at in [min_delay, max_delay]",
      eligibility = "Execution completed and authorized; post-lag within window; policy version matches; zero assistance",
      exclusion_reasons = c("NO_COMPLETED_AUTHORIZED_EXECUTION", "POST_ASSESSMENT_OUTSIDE_REGISTERED_WINDOW", "FOLLOWUP_BEFORE_EXECUTION_COMPLETED", "FOLLOWUP_SCOPE_OR_EXECUTION_MISMATCH", "FOLLOWUP_OUTSIDE_REGISTERED_WINDOW", "ACTIVITY_NOT_FULLY_EXECUTED_AS_AUTHORIZED_POLICY", "INCOMPARABLE_OR_LATE_PRE_MEASURE"),
      scientific_limitations = "Measures post-intervention descriptive outcome and pre/post change, NOT causal treatment effect or counterfactual uplift",
      evaluation_capacity = "SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED"
    )
  )
}

scientific_prediction_targets <- function() {
  ids <- c("DELAYED_ITEM_RETRIEVAL", "NOVEL_ITEM_CORRECTNESS", "APPLICATION_SUCCESS",
    "TRANSFER_SUCCESS", "ACTIVITY_DURATION_SECONDS", "POST_INTERVENTION_SUCCESS")
  units <- c("item retrieval", "first observed item response", "independent application problem",
    "independent transfer instrument", "completed activity", "independent post-intervention assessment")
  matrix_specs <- scientific_target_matrix()
  setNames(lapply(seq_along(ids), function(i) {
    id <- ids[i]
    m <- matrix_specs[[id]]
    list(target_id=id, unit_of_analysis=units[i],
      value_type=if(i==5) "SECONDS" else "BINARY_PREDECLARED_CRITERION",
      horizon="EXPLICIT_PRECOMMITTED_DEFINITION_WINDOW_SECONDS",
      baseline=if(i==5) c("PREFIX_MEAN_SECONDS", "PREFIX_MEDIAN_SECONDS") else
        c("PREFIX_BETA11", "PREFIX_RECENT20_BETA11"),
      metrics=if(i==5) c("MAE", "RMSE", "SIGNED_ERROR") else
        c("BRIER", "LOG_LOSS", "CALIBRATION_BINS", "OBSERVED_RATE_WILSON"),
      instrument_required=m$instrument_required,
      preparation_event=m$preparation_event,
      frozen_forecast=m$frozen_forecast,
      future_outcome=m$future_outcome,
      scoring_criterion=m$scoring_criterion,
      provenance=m$provenance,
      evidence_of_independence=m$evidence_of_independence,
      assistance_rule=m$assistance,
      prior_exposure_rule=m$prior_exposure,
      temporal_window=m$temporal_window,
      eligibility_predicates=m$eligibility,
      exclusion_reasons=m$exclusion_reasons,
      scientific_limitations=m$scientific_limitations,
      evaluation_capacity=m$evaluation_capacity,
      technical_status="IMPLEMENTED_EXPERIMENTAL", personal_validation="NOT_ESTABLISHED",
      causal_effect="NOT_ESTABLISHED")
  }), ids)
}

.se_specs <- list(
  events=c(event_id="character",student_id="character",occurred_at="character",recorded_at="character",
    origin="character",source_id="character",evidence_version="character",event_type="character",
    append_order="numeric",payload_sha256="character",session_id="character"),
  definitions=c(definition_id="character",target_id="character",scope_id="character",version="character",
    instrument_id="character",scoring_rule_id="character",success_criterion="character",scoring_source="character",min_delay_seconds="numeric",max_delay_seconds="numeric",
    min_retention_seconds="numeric",classification="character",classification_status="character",
    difficulty="character",independent_instrument="logical",representative_exam="logical",blueprint_id="character",blueprint_unit_ids="list"),
  forecasts=c(forecast_id="character",definition_id="character",unit_id="character",template_id="character",
    model_version="character",model_state_id="character",policy_version="character",data_cutoff_at="character",
    training_cutoff_at="character",predicted_value="numeric",forecast_status="character",evidence_ids="list"),
  outcomes=c(outcome_id="character",attempt_id="character",forecast_id="character",definition_id="character",unit_id="character",
    template_id="character",value="numeric",assistance="character",answer_exposed="logical",
    scoring_rule_id="character",execution_id="character",active_seconds="numeric"),
  exposures=c(exposure_id="character",unit_id="character",template_id="character",scope_id="character",kind="character",forecast_id="character"),
  executions=c(execution_id="character",decision_id="character",run_id="character",decision_input_id="character",
    policy_version="character",candidate_id="character",unit_id="character",scope_id="character",
    authorization="character",status="character",started_at="character",ended_at="character",active_seconds="numeric"),
  followups=c(followup_id="character",execution_id="character",outcome_id="character",pre_outcome_id="character"),
  curriculum=c(catalogue_id="character",scope_id="character",version="character",source_id="character",recorded_at="character",in_syllabus="logical")
)
.se_text <- function(x) is.character(x) && length(x)==1L && !is.na(x) && nzchar(trimws(x))
.se_time <- function(x) .lo_time(x)
.se_table <- function(x, spec) {
  if (is.null(x)) x <- list()
  if (!is.data.frame(x)) {
    if (!is.list(x) || !all(vapply(x,is.list,logical(1)))) stop("INVALID_SCIENTIFIC_TABLE")
    rows <- x
    x <- as.data.frame(setNames(lapply(spec, function(type) switch(type,
      character=character(length(rows)),numeric=numeric(length(rows)),logical=logical(length(rows)),list=I(vector("list",length(rows))))),names(spec)))
    for (key in names(spec)) for (i in seq_along(rows)) {
      value <- rows[[i]][[key]]
      if (spec[[key]]=="list") { x[[key]][[i]] <- if(is.null(value)) character() else value; next }
      if (is.null(value)) value <- switch(spec[[key]],character=NA_character_,numeric=NA_real_,logical=NA)
      if (length(value)!=1L || !(switch(spec[[key]],character=is.character(value),numeric=is.numeric(value),logical=is.logical(value))))
        stop(paste0("INVALID_FIELD_TYPE_",key))
      x[[key]][i] <- value
    }
  }
  for (key in names(spec)) {
    if (!key %in% names(x)) x[[key]] <- switch(spec[[key]],character=rep(NA_character_,nrow(x)),numeric=rep(NA_real_,nrow(x)),logical=rep(NA,nrow(x)),list=I(rep(list(character()),nrow(x))))
    if (!nrow(x)) next
    valid <- switch(spec[[key]],character=is.character(x[[key]]),numeric=is.numeric(x[[key]]),logical=is.logical(x[[key]]),list=is.list(x[[key]]))
    if (!valid) stop(paste0("INVALID_FIELD_TYPE_",key))
  }
  x[,names(spec),drop=FALSE]
}
.se_records <- function(x, empty=data.frame()) {
  if(is.data.frame(x)) return(x)
  if(!length(x)) return(empty)
  fields <- unique(unlist(lapply(x,names),use.names=FALSE))
  out <- do.call(rbind,lapply(x,function(row) as.data.frame(setNames(lapply(fields,function(k) {
    value <- row[[k]]; if(is.null(value)) NA else value
  }),fields),stringsAsFactors=FALSE)))
  rownames(out) <- NULL; out
}
.se_vector <- function(x) {
  if(is.list(x)) {
    if(!all(vapply(x,function(v)is.character(v)&&length(v)==1L&&!is.na(v),logical(1)))) stop("INVALID_EVIDENCE_REFERENCE_VECTOR")
    x <- as.character(unlist(x,use.names=FALSE))
  }
  if(is.null(x)) x <- character()
  if(!is.character(x)||anyNA(x)||anyDuplicated(x)||any(!nzchar(x))) stop("INVALID_EVIDENCE_REFERENCES")
  x
}
.se_rows <- function(x) lapply(seq_len(nrow(x)),function(i)as.list(x[i,,drop=FALSE]))
.se_hash <- function(x) .pd_identity(x,NULL,NULL)
.se_ratio <- function(values) {
  n <- length(values)
  if(!n) return(list(status="NOT_ESTABLISHED",n=0L,k=0L,value=NULL,interval=NULL))
  k <- sum(values)
  list(status="DESCRIPTIVE_ONLY",n=n,k=k,value=k/n,
    interval=as.list(calculate_wilson_ci(k,n)),independence="NOT_ESTABLISHED")
}

# This is analytical replay of the ORIGINAL validator, not imported decision authority.
scientific_policy_record <- function(decision_id, inputs) {
  result<-do.call(orchestrate_learning,inputs)
  record<-.pd_canonical(list(decision_id=decision_id,inputs=inputs,result=result))
  for(key in c("orchestrator_evidence_id","trusted_source_authorized")) {
    value<-attr(inputs$snapshot$provenance,key)
    if(!is.null(value)) attr(record$inputs$snapshot$provenance,key)<-value
  }
  record
}
.se_replay_policy <- function(record) {
  inputs <- record$inputs
  inputs$candidates <- .se_records(inputs$candidates)
  inputs$snapshot$evidence <- .se_records(inputs$snapshot$evidence,
    data.frame(event_id=character(),occurred_at=character(),origin=character()))
  if(!is.null(inputs$snapshot$concept_relations)) inputs$snapshot$concept_relations <- .se_records(inputs$snapshot$concept_relations)
  if(is.null(inputs$specialists)) inputs$specialists <- list()
  inputs$specialists <- lapply(inputs$specialists,function(s) {
    for(k in c("evidence_ids","source_ids","limitations")) s[[k]] <- .se_vector(s[[k]])
    s
  })
  if(is.null(inputs$authority_registry)) inputs$authority_registry <- list()
  inputs$authority_registry <- lapply(inputs$authority_registry,function(a) {
    for(k in intersect(c("source_ids","evidence_types","evidence_versions"),names(a))) a[[k]] <- .se_vector(a[[k]])
    a
  })
  # R attributes carrying custody do not survive JSON. A real-data host must
  # re-audit its inputs; this evaluator never recreates trust from a document.
  replay <- do.call(orchestrate_learning,inputs)
  if(!identical(.se_hash(replay),.se_hash(record$result))) stop("POLICY_STATE_OR_COMPARISON_REPLAY_MISMATCH")
  replay
}

# All tables refer to an append-only registry. Payload hashes bind metadata and
# outcomes to that registry; hashes alone never authenticate the source.
evaluate_scientific_decisions <- function(input, source_audit=NULL) {
  if(!is.list(input)||!identical(input$schema_version,"scientific-decision-evaluation-v1") ||
     !is.finite(.se_time(input$evaluation_cutoff))) stop("INVALID_SCIENTIFIC_ENVELOPE")
  cutoff <- .se_time(input$evaluation_cutoff)
  raw_registry <- .se_records(input$events)
  tables <- setNames(lapply(names(.se_specs),function(k).se_table(input[[k]],.se_specs[[k]])),names(.se_specs))
  e <- tables$events; d <- tables$definitions; f <- tables$forecasts; o <- tables$outcomes
  z <- tables$exposures; ex <- tables$executions; fu <- tables$followups; curriculum <- tables$curriculum
  if(anyDuplicated(e$event_id)||anyDuplicated(e$append_order)||anyNA(e$append_order)||
     any(!is.finite(e$append_order)|e$append_order<1|e$append_order!=floor(e$append_order))) stop("INVALID_EVENT_ORDER_OR_ID")
  for(key in c("event_id","student_id","origin","source_id","evidence_version","event_type"))
    if(anyNA(e[[key]])||any(!nzchar(trimws(e[[key]])))) stop("MISSING_EVENT_PROVENANCE")
  et <- vapply(e$occurred_at,.se_time,numeric(1)); rt <- vapply(e$recorded_at,.se_time,numeric(1))
  if(any(!is.finite(et))||any(!is.finite(rt))||any(rt<et)) stop("INVALID_EVENT_TIME")
  if("origin_type" %in% names(raw_registry) && (anyNA(raw_registry$origin_type)||!identical(as.character(raw_registry$origin_type),as.character(e$origin)))) stop("CONFLICTING_SCIENTIFIC_ORIGIN_ALIASES")
  if(any(e$evidence_version %in% c("UNKNOWN","NOT_ESTABLISHED"))) stop("UNKNOWN_SOURCE_EVIDENCE_VERSION")
  if(any(!e$origin %in% c("REAL_STUDY","SYNTHETIC_FIXTURE","SYNTHETIC_BENCHMARK","AUTOMATED_TEST")) || length(unique(e$origin))>1L) stop("MIXED_OR_UNKNOWN_SCIENTIFIC_ORIGIN")
  if(length(unique(e$student_id))>1L) stop("SCIENTIFIC_SINGLE_STUDENT_SCOPE_REQUIRED")
  if(nrow(e)>1L && any(diff(rt[order(e$append_order)])<0)) stop("RECORDED_ORDER_CONTRADICTION")
  # Table presentation order cannot change chronology, tie handling or artifacts.
  e <- e[order(e$append_order),,drop=FALSE]; rownames(e)<-NULL
  et <- vapply(e$occurred_at,.se_time,numeric(1)); rt <- vapply(e$recorded_at,.se_time,numeric(1))
  row_event <- function(id,type=NULL) {
    ix <- match(id,e$event_id)
    if(length(ix)!=1L||is.na(ix)||(!is.null(type)&&!identical(e$event_type[ix],type))) stop("UNKNOWN_OR_WRONG_EVENT_REFERENCE")
    ix
  }
  bind <- function(table,id_key,type) {
    if(anyNA(table[[id_key]])||anyDuplicated(table[[id_key]])) stop("DUPLICATE_OR_MISSING_RECORD_ID")
    for(row in .se_rows(table)) {
      ix <- row_event(row[[id_key]],type)
      if(!identical(e$payload_sha256[ix],.se_hash(row))) stop("SCIENTIFIC_PAYLOAD_HASH_MISMATCH")
    }
  }
  for(args in list(list(d,"definition_id","DEFINITION_REGISTERED"),list(f,"forecast_id","FORECAST_COMMITTED"),
    list(o,"outcome_id","OUTCOME_OBSERVED"),list(z,"exposure_id","EXPOSURE_OBSERVED"),
    list(ex,"execution_id","EXECUTION_RECORDED"),list(fu,"followup_id","FOLLOWUP_LINKED"),list(curriculum,"catalogue_id","CURRICULUM_REGISTERED"))) do.call(bind,args)
  known_types <- c("DEFINITION_REGISTERED","FORECAST_COMMITTED","OUTCOME_OBSERVED","EXPOSURE_OBSERVED","EXECUTION_RECORDED","FOLLOWUP_LINKED","DECISION_COMMITTED","CURRICULUM_REGISTERED")
  if(any(!e$event_type %in% known_types)) stop("UNKNOWN_SCIENTIFIC_EVENT_TYPE")
  all_refs <- c(d$definition_id,f$forecast_id,o$outcome_id,z$exposure_id,ex$execution_id,fu$followup_id,curriculum$catalogue_id,
    vapply(input$decisions,function(r)r$decision_id,character(1)))
  if(anyDuplicated(all_refs)||!setequal(all_refs,e$event_id)) stop("UNBOUND_OR_MULTIPLY_BOUND_SCIENTIFIC_EVENT")
  targets <- scientific_prediction_targets()
  for(row in .se_rows(d)) {
    if(row$version %in% c("UNKNOWN","NOT_ESTABLISHED")) stop("UNKNOWN_DEFINITION_VERSION")
    if(!row$target_id %in% names(targets)||!all(vapply(row[c("definition_id","scope_id","version","instrument_id","scoring_rule_id","classification","classification_status","difficulty")],.se_text,logical(1)))) stop("INVALID_TARGET_DEFINITION")
    if(any(!is.finite(c(row$min_delay_seconds,row$max_delay_seconds,row$min_retention_seconds)))||row$min_delay_seconds<0||row$max_delay_seconds<row$min_delay_seconds||row$min_retention_seconds<0) stop("INVALID_TARGET_WINDOW")
    if(row$target_id=="DELAYED_ITEM_RETRIEVAL" && row$min_retention_seconds<=0) stop("RETENTION_INTERVAL_NOT_DEFINED")
  }
  def_for <- function(id) { ix<-match(id,d$definition_id);if(is.na(ix))stop("UNKNOWN_TARGET_DEFINITION");as.list(d[ix,,drop=FALSE]) }
  available <- function(ix,at) et[ix]<=at && rt[ix]<=at
  same_student <- function(a,b) identical(e$student_id[a],e$student_id[b])
  full_execution <- function(id,student,outcome_at,asof) {
    ix <- match(id,ex$execution_id)
    if(is.na(ix)) return(FALSE)
    r <- as.list(ex[ix,,drop=FALSE]); ei <- row_event(id)
    identical(e$student_id[ei],student) && identical(r$status,"COMPLETED") && identical(r$authorization,"AUTHORIZED") &&
      is.finite(.se_time(r$ended_at)) && .se_time(r$ended_at)<=outcome_at && available(ei,asof)
  }
  contacts <- function(student,unit,template,at,asof,after=-Inf,ignore_prompt_forecast=NULL) {
    zi <- if(nrow(z)) match(z$exposure_id,e$event_id) else integer()
    oi <- if(nrow(o)) match(o$outcome_id,e$event_id) else integer()
    zz <- which(e$student_id[zi]==student & et[zi]<at & et[zi]>=after & rt[zi]<=asof &
      (z$unit_id==unit | (!is.na(template)&nzchar(template)&z$template_id==template)) &
      !(z$kind=="ASSESSMENT_PROMPT" & !is.na(z$forecast_id) & z$forecast_id %in% ignore_prompt_forecast))
    oo <- which(e$student_id[oi]==student & et[oi]<at & et[oi]>=after & rt[oi]<=asof &
      (o$unit_id==unit | (!is.na(template)&nzchar(template)&o$template_id==template)))
    c(zi[zz],oi[oo])
  }
  outcome_issues <- function(row,definition,asof,forecast=NULL) {
    ix <- row_event(row$outcome_id); student <- e$student_id[ix]; codes <- character()
    if(!available(ix,asof)) codes<-c(codes,"OUTCOME_NOT_YET_AVAILABLE")
    if(!is.finite(row$value)) codes<-c(codes,"OUTCOME_MISSING_OR_NONFINITE")
    if(!identical(row$assistance,"NONE")||!identical(row$answer_exposed,FALSE)) codes<-c(codes,"ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT")
    if(!identical(row$scoring_rule_id,definition$scoring_rule_id)) codes<-c(codes,"SCORING_RULE_MISMATCH")
    di <- row_event(definition$definition_id)
    boundary <- if(is.null(forecast)) et[ix] else .se_time(forecast$data_cutoff_at)
    if(!available(di,boundary)) codes<-c(codes,"DEFINITION_NOT_AVAILABLE_AT_CUTOFF")
    target <- definition$target_id
    if(!.se_text(definition$success_criterion)||!definition$scoring_source %in% c("DEFINITIVE_ANSWER_KEY","INDEPENDENT_BLINDED_RUBRIC","ACTIVE_TIME_TELEMETRY")) codes<-c(codes,"SCORING_CRITERION_NOT_ESTABLISHED")
    if(target!="ACTIVITY_DURATION_SECONDS" && !definition$scoring_source %in% c("DEFINITIVE_ANSWER_KEY","INDEPENDENT_BLINDED_RUBRIC")) codes<-c(codes,"INDEPENDENT_SCORING_NOT_ESTABLISHED")
    if(target!="ACTIVITY_DURATION_SECONDS" && is.finite(row$value) && !row$value %in% c(0,1)) codes<-c(codes,"BINARY_CRITERION_REQUIRED")
    if(target %in% c("APPLICATION_SUCCESS","TRANSFER_SUCCESS","POST_INTERVENTION_SUCCESS")) {
      expected <- switch(target,APPLICATION_SUCCESS="INDEPENDENT_APPLICATION",TRANSFER_SUCCESS="INDEPENDENT_TRANSFER",POST_INTERVENTION_SUCCESS="INDEPENDENT_POST_ASSESSMENT")
      if(!identical(definition$classification,expected)||!identical(definition$classification_status,"CONFIRMED")||!isTRUE(definition$independent_instrument)) codes<-c(codes,"INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED")
    }
    prior_at <- if(is.null(forecast)) et[ix] else et[row_event(forecast$forecast_id)]
    prior <- contacts(student,row$unit_id,row$template_id,prior_at,asof)
    if(target %in% c("NOVEL_ITEM_CORRECTNESS","APPLICATION_SUCCESS","TRANSFER_SUCCESS","POST_INTERVENTION_SUCCESS") && length(prior)) codes<-c(codes,"PRIOR_ITEM_OR_TEMPLATE_EXPOSURE")
    if(target=="DELAYED_ITEM_RETRIEVAL") {
      # Only item-specific contacts establish an interval; shared templates do not.
      prior <- contacts(student,row$unit_id,NA_character_,prior_at,asof)
      lag <- if(length(prior)) et[ix]-max(et[prior]) else NA_real_
      if(!is.finite(lag)||lag<definition$min_retention_seconds) codes<-c(codes,"DELAYED_RETRIEVAL_INTERVAL_NOT_ESTABLISHED")
      if(!is.null(forecast) && length(contacts(student,row$unit_id,NA_character_,et[ix],asof,after=prior_at,ignore_prompt_forecast=forecast$forecast_id))) codes<-c(codes,"INTERVENING_ITEM_CONTACT")
    }
    if(target %in% c("ACTIVITY_DURATION_SECONDS","POST_INTERVENTION_SUCCESS")) {
      if(!full_execution(row$execution_id,student,et[ix],asof)) codes<-c(codes,"NO_COMPLETED_AUTHORIZED_EXECUTION")
      if(target=="ACTIVITY_DURATION_SECONDS" && (!is.finite(row$active_seconds)||row$active_seconds<0||row$value!=row$active_seconds)) codes<-c(codes,"ACTIVE_DURATION_NOT_ESTABLISHED")
    }
    if(target %in% c("ACTIVITY_DURATION_SECONDS","POST_INTERVENTION_SUCCESS")) {
      k<-match(row$execution_id,ex$execution_id)
      if(!is.na(k) && ((target=="ACTIVITY_DURATION_SECONDS"&&!identical(ex$unit_id[k],row$unit_id))||!identical(ex$scope_id[k],definition$scope_id))) codes<-c(codes,"EXECUTION_UNIT_OR_SCOPE_MISMATCH")
      if(target=="ACTIVITY_DURATION_SECONDS" && !is.na(k) && (!is.finite(ex$active_seconds[k])||!is.finite(row$active_seconds)||ex$active_seconds[k]!=row$active_seconds)) codes<-c(codes,"DURATION_EXECUTION_DISAGREEMENT")
    }
    if(target=="POST_INTERVENTION_SUCCESS") {
      k<-match(row$execution_id,ex$execution_id)
      if(!is.na(k)) {
        lag<-et[ix]-.se_time(ex$ended_at[k])
        if(!is.finite(lag)||lag<definition$min_delay_seconds||lag>definition$max_delay_seconds) codes<-c(codes,"POST_ASSESSMENT_OUTSIDE_REGISTERED_WINDOW")
      }
    }
    if(target %in% c("APPLICATION_SUCCESS","TRANSFER_SUCCESS","POST_INTERVENTION_SUCCESS") && (!.se_text(row$template_id)||row$template_id=="UNKNOWN")) codes<-c(codes,"TEMPLATE_INDEPENDENCE_UNKNOWN")
    unique(codes)
  }
  for(row in .se_rows(z)) if(!.se_text(row$unit_id)||!row$kind %in% c("LEARNING","ANSWER_REVEAL","ASSESSMENT_PROMPT","UNKNOWN")) stop("INVALID_EXPOSURE_IDENTITY_OR_KIND")
  for(row in .se_rows(o)) { if(!.se_text(row$unit_id)||!.se_text(row$attempt_id)) stop("MISSING_OUTCOME_UNIT_OR_ATTEMPT"); def_for(row$definition_id) }
  if(anyDuplicated(paste(e$student_id[match(o$outcome_id,e$event_id)],o$attempt_id,sep="::"))) stop("DUPLICATE_ASSESSMENT_ATTEMPT")
  # Validate execution clocks even for partial/ignored actions; missing time stays unknown.
  for(row in .se_rows(ex)) {
    ix <- row_event(row$execution_id); begin <- .se_time(row$started_at); end <- .se_time(row$ended_at)
    if(!row$status %in% c("COMPLETED","PARTIAL","INTERRUPTED","IGNORED","SUBSTITUTED")||!row$authorization %in% c("AUTHORIZED","NOT_AUTHORIZED")) stop("INVALID_EXECUTION_STATUS")
    if(!is.finite(begin)||!is.finite(end)||begin>end||end>et[ix]) stop("INVALID_EXECUTION_CLOCK")
    if(row$status=="IGNORED" && is.finite(row$active_seconds) && row$active_seconds!=0) stop("IGNORED_ACTIVITY_HAS_EXECUTION_TIME")
    if(!is.na(row$active_seconds)&&(!is.finite(row$active_seconds)||row$active_seconds<0||row$active_seconds>end-begin)) stop("INVALID_ACTIVE_TIME")
  }
  scored <- list(); audits <- list(); baseline_rows <- list()
  if(nrow(f)) f<-f[order(e$append_order[match(f$forecast_id,e$event_id)]),,drop=FALSE]
  if(nrow(ex)) ex<-ex[order(e$append_order[match(ex$execution_id,e$event_id)]),,drop=FALSE]
  if(nrow(fu)) fu<-fu[order(e$append_order[match(fu$followup_id,e$event_id)]),,drop=FALSE]
  for(row in .se_rows(f)) {
    ix<-row_event(row$forecast_id); definition<-def_for(row$definition_id); dc<-.se_time(row$data_cutoff_at); tc<-.se_time(row$training_cutoff_at)
    if(!all(vapply(row[c("unit_id","model_version","model_state_id","policy_version")],.se_text,logical(1)))||row$model_version %in% c("UNKNOWN","NOT_ESTABLISHED")||row$policy_version %in% c("UNKNOWN","NOT_ESTABLISHED")) stop("FORECAST_VERSION_NOT_IDENTIFIED")
    if(!is.finite(dc)||!is.finite(tc)||tc>dc||dc>et[ix]) stop("FORECAST_TRAINING_OR_DATA_LEAKAGE")
    evidence <- .se_vector(row$evidence_ids[[1L]])
    for(id in evidence) {
      j<-row_event(id)
      if(!same_student(ix,j)||et[j]>=dc||rt[j]>dc||!e$event_type[j] %in% c("OUTCOME_OBSERVED","EXPOSURE_OBSERVED")) stop("FORECAST_EVIDENCE_LEAKAGE")
    }
    if(!row$forecast_status %in% c("PREDICTED","ABSTAIN")) stop("INVALID_FORECAST_STATUS")
    if(row$forecast_status=="PREDICTED" && (!is.finite(row$predicted_value)||row$predicted_value<0||
      (definition$target_id!="ACTIVITY_DURATION_SECONDS"&&row$predicted_value>1))) stop("INVALID_PREDICTION_VALUE")
    codes <- if(!available(ix,cutoff)) "FORECAST_NOT_YET_AVAILABLE" else if(row$forecast_status=="ABSTAIN") "MODEL_ABSTAINED" else character()
    oi<-which(!is.na(o$forecast_id)&o$forecast_id==row$forecast_id)
    if(length(oi)>1L) stop("MULTIPLE_OUTCOMES_FOR_RESERVED_FORECAST")
    if(!length(oi)) codes<-c(codes,"PENDING_OUTCOME")
    if(length(oi)) {
      out<-as.list(o[oi,,drop=FALSE]); j<-row_event(out$outcome_id)
      if(!same_student(ix,j)||!identical(out$definition_id,row$definition_id)||!identical(out$unit_id,row$unit_id)||!identical(out$template_id,row$template_id)) stop("FORECAST_OUTCOME_IDENTITY_MISMATCH")
      if(et[j]<=rt[ix]||e$append_order[j]<=e$append_order[ix]) stop("FORECAST_NOT_COMMITTED_BEFORE_OUTCOME")
      delay<-et[j]-et[ix]
      if(delay<definition$min_delay_seconds||delay>definition$max_delay_seconds) codes<-c(codes,"OUTCOME_OUTSIDE_PREDECLARED_HORIZON")
      codes<-c(codes,outcome_issues(out,definition,cutoff,row))
      if(definition$target_id %in% c("ACTIVITY_DURATION_SECONDS","POST_INTERVENTION_SUCCESS")) {
        exec_i<-match(out$execution_id,ex$execution_id)
        if(!is.na(exec_i)&&.se_time(ex$started_at[exec_i])<rt[ix]) codes<-c(codes,"FORECAST_AFTER_EXECUTION_STARTED")
        if(!is.na(exec_i)&&!identical(row$policy_version,ex$policy_version[exec_i])) codes<-c(codes,"FORECAST_EXECUTED_POLICY_MISMATCH")
      }
    }
    # Reconstruct references from the same available target definition, never later labels.
    prefix <- integer()
    for(k in which(o$definition_id==row$definition_id)) {
      j<-row_event(o$outcome_id[k])
      if(same_student(ix,j)&&et[j]<dc&&rt[j]<=dc && !length(outcome_issues(as.list(o[k,,drop=FALSE]),definition,dc))) prefix<-c(prefix,k)
    }
    if(length(prefix)) prefix<-prefix[order(et[match(o$outcome_id[prefix],e$event_id)],e$append_order[match(o$outcome_id[prefix],e$event_id)])]
    history<-o$value[prefix]
    baseline <- if(definition$target_id=="ACTIVITY_DURATION_SECONDS")
      c(PREFIX_MEAN_SECONDS=if(length(history))mean(history) else NA_real_,PREFIX_MEDIAN_SECONDS=if(length(history))median(history) else NA_real_) else
      c(PREFIX_BETA11=(sum(history)+1)/(length(history)+2),PREFIX_RECENT20_BETA11=prospective_recent20(history))
    baseline_rows[[row$forecast_id]] <- list(forecast_id=row$forecast_id,definition_id=row$definition_id,
      history_outcome_ids=as.character(o$outcome_id[prefix]),n=length(history),predictions=as.list(baseline))
    audits[[row$forecast_id]] <- list(forecast_id=row$forecast_id,definition_id=row$definition_id,
      status=if(length(codes))"NOT_SCORED" else "SCORED",codes=sort(unique(codes)),
      model_version=row$model_version,policy_version=row$policy_version)
    if(!length(codes)) j<-row_event(out$outcome_id)
    if(!length(codes)) scored[[row$forecast_id]] <- list(forecast_id=row$forecast_id,outcome_id=out$outcome_id,
      student_id=e$student_id[ix],session_id=e$session_id[j],unit_id=row$unit_id,definition_id=row$definition_id,
      target_id=definition$target_id,model_version=row$model_version,policy_version=row$policy_version,
      p=row$predicted_value,y=out$value,delay_seconds=delay,
      retention_lag_seconds=if(definition$target_id=="DELAYED_ITEM_RETRIEVAL") {
        prior<-contacts(e$student_id[ix],row$unit_id,NA_character_,et[ix],cutoff)
        et[j]-max(et[prior])
      } else NULL,difficulty=definition$difficulty,
      classification=definition$classification,baseline=baseline)
  }
  # Replay every policy against exactly the original snapshot and admissible set.
  policy_states <- list(); policies <- c("EVIDENCE_CONTEXTUAL_V1","SHORTEST_ADMISSIBLE_V1","CURRICULAR_CONSERVATIVE_V1")
  for(record in input$decisions) {
    ix<-row_event(record$decision_id,"DECISION_COMMITTED")
    if(!identical(e$payload_sha256[ix],.se_hash(record))) stop("DECISION_PAYLOAD_HASH_MISMATCH")
    result<-.se_replay_policy(record)
    if(identical(e$origin[ix],"REAL_STUDY") && result$evidence_state %in% c("SYNTHETIC_ONLY","MIXED_ORIGIN")) stop("SYNTHETIC_DECISION_IN_REAL_REGISTRY")
    if(!identical(e$student_id[ix],result$student_id)||et[ix]<.se_time(result$cutoff)) stop("DECISION_REGISTRY_IDENTITY_MISMATCH")
    if(!available(ix,cutoff)) next
    policy_states[[record$decision_id]]<-result
  }
  execution_links<-list()
  for(row in .se_rows(ex)) {
    ix<-row_event(row$execution_id)
    if(!available(ix,cutoff)) next
    state<-policy_states[[row$decision_id]]
    linked<-!is.null(state)
    if(.se_text(row$decision_id)&&!linked) stop("EXECUTION_WITHOUT_AVAILABLE_DECISION")
    if(linked) {
      if(!identical(row$run_id,state$run_id)||!identical(row$decision_input_id,state$decision_trace$input_id)||
         !identical(e$student_id[ix],state$student_id)||.se_time(row$started_at)<rt[row_event(row$decision_id)]||e$append_order[ix]<=e$append_order[row_event(row$decision_id)]) stop("EXECUTION_DECISION_IDENTITY_OR_TIME_MISMATCH")
      if(!row$policy_version %in% c(policies,"EXTERNAL_SUBSTITUTION")) stop("UNKNOWN_EXECUTED_POLICY")
      if(row$policy_version %in% policies && !identical(row$candidate_id,state$policy_comparison$choices[[row$policy_version]]$candidate_id)) stop("EXECUTED_POLICY_DID_NOT_CHOOSE_ACTIVITY")
      admitted<-vapply(state$admissible_candidates,function(r)r$candidate_id,character(1))
      candidate<-Filter(function(r)identical(r$candidate_id,row$candidate_id),state$admissible_candidates)
      if(row$policy_version %in% policies && (!row$candidate_id %in% admitted || !identical(candidate[[1L]]$scope_id,row$scope_id))) stop("EXECUTED_CANDIDATE_NOT_ORIGINALLY_ADMITTED")
    }
    chosen<-if(linked)Filter(function(r)identical(r$candidate_id,row$candidate_id),state$admissible_candidates) else list()
    budget<-if(linked)state$context_used$available_minutes*60 else NA_real_
    estimate<-if(length(chosen)==1L)chosen[[1L]]$estimated_minutes*60 else NA_real_
    execution_links[[row$execution_id]]<-list(execution_id=row$execution_id,decision_id=row$decision_id,
      executed_policy=row$policy_version,candidate_id=row$candidate_id,status=row$status,
      eligible_for_outcome=linked&&row$status=="COMPLETED"&&row$authorization=="AUTHORIZED"&&row$policy_version %in% policies,
      active_seconds=if(is.finite(row$active_seconds))row$active_seconds else NULL,
      opportunity_cost=list(status="NOT_ESTABLISHED",reason="Foregone learning outcomes are not observed",
        observed_budget_fraction=if(is.finite(row$active_seconds)&&is.finite(budget)&&budget>0)row$active_seconds/budget else NULL,
        chosen_estimated_seconds=if(is.finite(estimate))estimate else NULL,
        observed_minus_estimated_seconds=if(is.finite(row$active_seconds)&&is.finite(estimate))row$active_seconds-estimate else NULL,
        alternative_estimates=if(linked)lapply(Filter(function(r)!identical(r$candidate_id,row$candidate_id),state$admissible_candidates),
          function(r)list(candidate_id=r$candidate_id,estimated_seconds=r$estimated_minutes*60,actual_foregone_outcome="NOT_ESTABLISHED")) else list(),
        alternatives=if(linked)setdiff(vapply(state$admissible_candidates,function(r)r$candidate_id,character(1)),row$candidate_id) else character()))
  }
  followup_rows<-list()
  for(row in .se_rows(fu)) {
    ix<-row_event(row$followup_id); ei<-match(row$execution_id,ex$execution_id); oi<-match(row$outcome_id,o$outcome_id)
    if(is.na(ei)||is.na(oi)) stop("UNKNOWN_FOLLOWUP_EXECUTION_OR_OUTCOME")
    if(!available(ix,cutoff)) next
    er<-as.list(ex[ei,,drop=FALSE]); out<-as.list(o[oi,,drop=FALSE]); ji<-row_event(out$outcome_id)
    if(!same_student(ix,ji)||!same_student(ix,row_event(er$execution_id)) || et[ix]<et[ji] || rt[ix]<rt[ji] || e$append_order[ix]<=e$append_order[ji]) stop("FOLLOWUP_IDENTITY_OR_RECORDING_MISMATCH")
    definition<-def_for(out$definition_id); link<-execution_links[[er$execution_id]]
    issues<-outcome_issues(out,definition,cutoff)
    if(is.null(link)||!isTRUE(link$eligible_for_outcome)) issues<-c(issues,"ACTIVITY_NOT_FULLY_EXECUTED_AS_AUTHORIZED_POLICY")
    if(et[ji]<=.se_time(er$ended_at)) issues<-c(issues,"FOLLOWUP_BEFORE_EXECUTION_COMPLETED")
    if(!identical(definition$scope_id,er$scope_id)||!identical(out$execution_id,er$execution_id)) issues<-c(issues,"FOLLOWUP_SCOPE_OR_EXECUTION_MISMATCH")
    post_lag<-et[ji]-.se_time(er$ended_at)
    if(post_lag<definition$min_delay_seconds||post_lag>definition$max_delay_seconds) issues<-c(issues,"FOLLOWUP_OUTSIDE_REGISTERED_WINDOW")
    pre_delta<-NULL; pre_codes<-character()
    if(.se_text(row$pre_outcome_id)) {
      pi<-match(row$pre_outcome_id,o$outcome_id)
      if(is.na(pi)) stop("UNKNOWN_PRE_INTERVENTION_OUTCOME")
      pre<-as.list(o[pi,,drop=FALSE]); pe<-row_event(pre$outcome_id)
      pre_codes<-outcome_issues(pre,def_for(pre$definition_id),cutoff)
      if(!identical(pre$definition_id,out$definition_id)||!same_student(pe,ji)||rt[pe]>=.se_time(er$started_at)) pre_codes<-c(pre_codes,"INCOMPARABLE_OR_LATE_PRE_MEASURE")
      if(!length(issues)&&!length(pre_codes)) pre_delta<-out$value-pre$value
    } else pre_codes<-"NO_COMPARABLE_PRE_MEASURE"
    followup_rows[[row$followup_id]]<-list(followup_id=row$followup_id,execution_id=row$execution_id,
      decision_id=er$decision_id,policy_version=er$policy_version,target_id=definition$target_id,
      definition_id=out$definition_id,outcome_id=out$outcome_id,student_id=e$student_id[ix],
      status=if(length(issues))"NOT_ATTRIBUTABLE" else "OBSERVATIONAL_ASSOCIATION_ONLY",
      codes=sort(unique(issues)),observed_value=if(!length(issues))out$value else NULL,
      pre_post_change=pre_delta,pre_measure_codes=sort(unique(pre_codes)),causal_effect="NOT_ESTABLISHED")
  }
  credited<-vapply(followup_rows,function(r)if(r$status=="OBSERVATIONAL_ASSOCIATION_ONLY")r$outcome_id else "",character(1))
  credited<-credited[nzchar(credited)]
  if(anyDuplicated(credited)) stop("DUPLICATE_ATTRIBUTION_OF_OUTCOME")
  # Report each target definition/model separately: horizons and rubrics are never pooled.
  groups<-split(scored,vapply(scored,function(r)paste(r$definition_id,r$model_version,r$policy_version,sep="::"),character(1)))
  prediction_metrics<-lapply(groups,function(rows) {
    target<-rows[[1L]]$target_id; y<-vapply(rows,function(r)r$y,numeric(1)); p<-vapply(rows,function(r)r$p,numeric(1))
    metrics<-scientific_prediction_metrics(y,p,target)
    comparisons<-list()
    for(name in names(rows[[1L]]$baseline)) {
      b<-vapply(rows,function(r)unname(r$baseline[name]),numeric(1)); paired<-which(is.finite(b))
      comparisons[[name]]<-if(!length(paired))list(status="NOT_ESTABLISHED",paired_n=0L) else {
        loss<-function(a)if(target=="ACTIVITY_DURATION_SECONDS")abs(a-y[paired]) else (a-y[paired])^2
        list(status="PAIRED_DESCRIPTIVE_ONLY",paired_n=length(paired),
          forecast_ids=vapply(rows[paired],function(r)r$forecast_id,character(1)),
          model_on_paired=scientific_prediction_metrics(y[paired],p[paired],target),
          baseline_on_paired=scientific_prediction_metrics(y[paired],b[paired],target),
          mean_loss_difference=mean(loss(p[paired])-loss(b[paired])),
          superiority="NOT_ESTABLISHED",dependence_aware_interval=NULL)
      }
    }
    list(target_id=target,definition_id=rows[[1L]]$definition_id,model_version=rows[[1L]]$model_version,
      policy_version=rows[[1L]]$policy_version,metrics=metrics,baselines=comparisons,
      unique_items=length(unique(vapply(rows,function(r)r$unit_id,character(1)))),
      sessions=length(unique(Filter(.se_text,vapply(rows,function(r)r$session_id,character(1))))),
      independent_units="NOT_ESTABLISHED",difficulty_strata=lapply(split(rows,vapply(rows,function(r)r$difficulty,character(1))),
        function(s)scientific_prediction_metrics(vapply(s,function(r)r$y,numeric(1)),vapply(s,function(r)r$p,numeric(1)),target)))
  })
  # Personal interpretation requires the EXISTING trusted-host source audit, bound
  # to the registry, which in turn binds every payload. The CLI never imports it.
  identity_input<-input
  for(key in names(.se_specs))identity_input[[key]]<-tables[[key]]
  identity_input$events<-raw_registry
  real_verified<-nrow(e)>0L && all(e$origin=="REAL_STUDY") && is.list(source_audit) &&
    all(vapply(c("is_proven_operational","is_real_student_data","can_generate_student_profile"),function(k)isTRUE(source_audit[[k]]),logical(1))) &&
    isTRUE(attr(source_audit,"trusted_source_authorized")) && identical(attr(source_audit,"orchestrator_evidence_id"),.pd_identity(raw_registry,NULL,NULL))
  per_policy<-setNames(lapply(policies,function(p) {
    observed<-Filter(function(r)identical(r$policy_version,p)&&r$status=="OBSERVATIONAL_ASSOCIATION_ONLY",followup_rows)
    by_definition<-lapply(split(observed,vapply(observed,function(r)r$definition_id,character(1))),function(rows) {
      values<-vapply(rows,function(r)r$observed_value,numeric(1))
      paired<-Filter(function(r)!is.null(r$pre_post_change),rows)
      list(observed=if(rows[[1L]]$target_id=="ACTIVITY_DURATION_SECONDS")list(n=length(values),mean_seconds=mean(values)) else .se_ratio(values),
        paired_n=length(paired),mean_pre_post_change=if(length(paired))mean(vapply(paired,function(r)r$pre_post_change,numeric(1))) else NULL,
        association="OBSERVATIONAL_PRE_POST_ONLY",causal_effect="NOT_ESTABLISHED",dependence_aware_interval=NULL)
    })
    list(decision_count=length(policy_states),by_definition=by_definition,executions=sum(vapply(execution_links,function(r)isTRUE(r$eligible_for_outcome)&&r$executed_policy==p,logical(1))),
      observed_followups=length(observed),outcomes=observed,
      predictive_quality="EVALUATED_SEPARATELY_BY_TARGET_AND_MODEL",
      unexecuted_outcomes="NOT_OBSERVED_NO_COUNTERFACTUAL_CREDIT",
      association=if(length(observed))"OBSERVATIONAL_ONLY" else "NOT_ESTABLISHED",causal_effect="NOT_ESTABLISHED")
  }),policies)
  curriculum_ok<-nrow(curriculum)>0L && !anyDuplicated(curriculum$scope_id) && all(vapply(curriculum$scope_id,.se_text,logical(1))) &&
    all(vapply(curriculum$recorded_at,function(t)is.finite(.se_time(t))&&.se_time(t)<=cutoff,logical(1))) &&
    !anyNA(curriculum$in_syllabus) && all(vapply(curriculum$version,.se_text,logical(1))) && all(vapply(curriculum$source_id,.se_text,logical(1))) &&
    all(curriculum$recorded_at==e$recorded_at[match(curriculum$catalogue_id,e$event_id)])
  outcome_audits<-setNames(lapply(.se_rows(o),function(row)list(outcome_id=row$outcome_id,
    codes=sort(outcome_issues(row,def_for(row$definition_id),cutoff)))),o$outcome_id)
  eligible_outcomes<-Filter(function(row)!length(outcome_audits[[row$outcome_id]]$codes),.se_rows(o))
  learning<-setNames(lapply(names(targets),function(target) {
    rows<-Filter(function(r)identical(def_for(r$definition_id)$target_id,target),eligible_outcomes)
    list(status=if(length(rows))"DESCRIPTIVE_OBSERVATIONS_ONLY" else "NOT_ESTABLISHED",n=length(rows),
      by_definition=lapply(split(rows,vapply(rows,function(r)r$definition_id,character(1))),function(r) {
        values<-vapply(r,function(x)x$value,numeric(1))
        if(target=="ACTIVITY_DURATION_SECONDS")list(n=length(values),mean_seconds=mean(values)) else .se_ratio(values)
      }))
  }),names(targets))
  complete<-Filter(function(r)identical(r$status,"COMPLETED")&&identical(r$authorization,"AUTHORIZED")&&available(row_event(r$execution_id),cutoff),.se_rows(ex))
  visited<-unique(vapply(complete,function(r)r$scope_id,character(1)))
  observed_ex<-Filter(function(r)available(row_event(r$execution_id),cutoff),.se_rows(ex))
  seconds<-vapply(observed_ex,function(r)r$active_seconds,numeric(1))
  relevant_scopes<-if(curriculum_ok)curriculum$scope_id[curriculum$in_syllabus] else character()
  maintenance<-Filter(function(r)def_for(r$definition_id)$target_id=="DELAYED_ITEM_RETRIEVAL" && def_for(r$definition_id)$scope_id %in% relevant_scopes,eligible_outcomes)
  exams<-Filter(function(r) {
    def<-def_for(r$definition_id)
    isTRUE(def$representative_exam)&&def$classification_status=="CONFIRMED"&&.se_text(def$blueprint_id)&&def$target_id!="ACTIVITY_DURATION_SECONDS"
  },eligible_outcomes)
  exam_groups<-split(exams,vapply(exams,function(r)paste(r$definition_id,e$session_id[row_event(r$outcome_id)],sep="::"),character(1)))
  exam_results<-lapply(exam_groups,function(rows) {
    definition<-def_for(rows[[1L]]$definition_id); blueprint<-.se_vector(definition$blueprint_unit_ids[[1L]])
    units<-vapply(rows,function(r)r$unit_id,character(1)); session<-e$session_id[row_event(rows[[1L]]$outcome_id)]
    if(!length(blueprint)||anyDuplicated(units)||!setequal(units,blueprint)||!.se_text(session)||
       definition$scoring_rule_id!="EQUAL_WEIGHT_BINARY_V1") return(list(status="NOT_ESTABLISHED",observed_n=length(rows),reason="Complete predeclared equal-weight blueprint required"))
    c(list(instrument_id=definition$instrument_id,blueprint_id=definition$blueprint_id,session_id=session),.se_ratio(vapply(rows,function(r)r$value,numeric(1))))
  })
  source_state<-if(real_verified)"AUDITED_REAL_REGISTRY" else if(nrow(e)&&all(e$origin!="REAL_STUDY"))"SYNTHETIC_CONTRACT_ONLY" else "UNVERIFIED_OR_NO_DATA"
  list(schema_version="scientific-decision-evaluation-v1",input_id=.se_hash(identity_input),evaluation_cutoff=input$evaluation_cutoff,
    source_state=source_state,personal_validation="NOT_ESTABLISHED",causal_effect="NOT_ESTABLISHED",
    targets=lapply(names(targets),function(target) {
      n<-sum(vapply(scored,function(r)r$target_id==target,logical(1)))
      c(targets[[target]],list(scored_n=n,audited_real_scored_n=if(real_verified)n else 0L,
        predictive_scoring_availability=if(real_verified&&n>0L)"AUDITED_REAL_DESCRIPTIVE_SCORING_AVAILABLE" else "NOT_ESTABLISHED",
        real_evidence_sufficiency="NOT_ESTABLISHED"))
    }),forecast_count=nrow(f),scored_count=length(scored),unscored_count=nrow(f)-length(scored),
    audits=audits,outcome_count=nrow(o),outcome_audits=outcome_audits,scored=scored,prefix_baselines=baseline_rows,prediction_metrics=prediction_metrics,
    policy_comparison=list(states=lapply(policy_states,function(s)list(run_id=s$run_id,input_id=s$decision_trace$input_id,
      admissible_ids=s$policy_comparison$admitted_ids,choices=s$policy_comparison$choices,divergence=s$policy_comparison$divergence)),
      policies=per_policy,executions=execution_links,followups=followup_rows,
      inference_levels=c("DECISION_COMPARISON","PREDICTIVE_SCORING","OBSERVATIONAL_ASSOCIATION","CAUSAL_EFFECT_NOT_ESTABLISHED")),
    learning_metrics=learning,
    efficiency=list(active_time=list(status=if(length(seconds)&&all(is.finite(seconds)))"OBSERVED_SUM" else "NOT_ESTABLISHED",
      measured_executions=sum(is.finite(seconds)),missing_executions=sum(!is.finite(seconds)),
      known_subtotal_seconds=sum(seconds[is.finite(seconds)]),total_seconds=if(length(seconds)&&all(is.finite(seconds)))sum(seconds) else NULL),
      registered_curriculum_coverage=if(curriculum_ok&&length(relevant_scopes))list(status="OBSERVED_ACTIVITY_COVERAGE_NOT_MASTERY",
        n=length(relevant_scopes),k=length(intersect(visited,relevant_scopes)),value=length(intersect(visited,relevant_scopes))/length(relevant_scopes)) else list(status="NOT_ESTABLISHED"),
      relevant_knowledge_maintenance=if(curriculum_ok).se_ratio(vapply(maintenance,function(r)r$value,numeric(1))) else list(status="NOT_ESTABLISHED"),
      representative_exam=list(status=if(length(exam_results)&&all(vapply(exam_results,function(r)r$status=="DESCRIPTIVE_ONLY",logical(1))))"REGISTERED_BLUEPRINT_ASSESSMENT_ONLY" else "NOT_ESTABLISHED",by_assessment=exam_results),
      opportunity_cost=list(status="NOT_ESTABLISHED",reason="Unperformed alternatives have no observed learning outcomes")),
    limitations=c("Registry integrity and timing are conditional on source custody, not authenticated by JSON hashes",
      "First observed item is not proof of lifetime or semantic novelty",
      "Recorded no-help and instrument classifications are eligibility assertions conditional on source custody", "Recorded active seconds are not inferred from wall-clock time",
      "Intervals describe binomial rates, not dependence-aware model or policy uncertainty",
      "No global intelligence/mastery score, no causal effect or policy superiority inferred",
      "No personal experiment started; all models remain experimental"),can_apply=FALSE,can_schedule=FALSE)
}

scientific_prediction_metrics <- function(y,p,target) {
  if(!length(y)) return(list(status="NOT_ESTABLISHED",n=0L))
  if(length(y)!=length(p)||any(!is.finite(y))||any(!is.finite(p))) stop("INVALID_SCIENTIFIC_METRICS")
  if(target=="ACTIVITY_DURATION_SECONDS") return(list(status="DESCRIPTIVE_ONLY",n=length(y),
    mae_seconds=mean(abs(p-y)),rmse_seconds=sqrt(mean((p-y)^2)),signed_error_seconds=mean(p-y)))
  if(any(!y %in% c(0,1))||any(p<0|p>1)) stop("INVALID_BINARY_SCIENTIFIC_METRICS")
  bins<-lapply(0:9,function(k) {
    ix<-which(p>=k/10 & (p<(k+1)/10 | (k==9 & p<=1)))
    c(list(lower=k/10,mean_prediction=if(length(ix))mean(p[ix]) else NULL),.se_ratio(y[ix]))
  })
  discrimination<-prospective_discrimination(y,p)
  if(identical(discrimination$status,"INSUFFICIENT_EVIDENCE"))discrimination$status<-"NOT_ESTABLISHED"
  c(list(status="DESCRIPTIVE_ONLY"),cal_metrics(y,p),list(observed=.se_ratio(y),calibration=bins,
    discrimination=discrimination,parameter_uncertainty="NOT_ESTABLISHED",
    dependence_aware_interval=NULL))
}
