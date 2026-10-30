# Only called after authentication of host-produced bytes by run_core_shadow.R.
# Authentication proves local host custody, not honest human study or model validity.
core_shadow_source_files <- function() c('run_core_shadow.R','R/core_shadow_adapter.R','R/learning_orchestrator.R',
  'R/evidence_specialists.R','R/pedagogical_decision.R','R/provenance.R','R/learning_profile.R','R/analytical_portability.R',
  'R/descriptive_analysis.R','lab/decision_scientific_evaluation.R','lab/prospective_scorecard.R','lab/individual_calibration.R')
core_shadow_rows <- function(rows, empty=data.frame()) {
  if (!length(rows)) return(empty)
  fields <- names(rows[[1L]])
  if (!all(vapply(rows,function(r) is.list(r) && identical(names(r),fields),logical(1)))) stop('INCONSISTENT_ROWS')
  do.call(rbind,lapply(rows,function(r) as.data.frame(lapply(r,function(x) if(is.null(x)) NA else x),stringsAsFactors=FALSE)))
}

core_shadow_decision <- function(request) {
  expected <- c('schema_version','student_id','cutoff','evidence_cutoff','fixture_installation','evidence_omissions','snapshot_rowid','context','candidates','events','memory','limitations','run_id','source_id','producer_version','engine_sources','java_runtime')
  if (!is.list(request) || !setequal(names(request),expected) || anyDuplicated(names(request)) ||
      !identical(request$schema_version,'core-learning-shadow-v1') || !identical(request$producer_version,'CORE_SHADOW_READ_V1') ||
      !.lo_text(request$source_id) || !.lo_text(request$java_runtime) || !identical(request$student_id,'LOCAL_SINGLE_USER') ||
      !.lo_text(request$run_id) || !is.finite(.lo_time(request$cutoff)) || !is.finite(.lo_time(request$evidence_cutoff)) ||
      .lo_time(request$evidence_cutoff)>.lo_time(request$cutoff) || !is.logical(request$fixture_installation) ||
      length(request$fixture_installation)!=1L || is.na(request$fixture_installation)) stop('INVALID_HOST_REQUEST')
  events <- core_shadow_rows(request$events,data.frame(event_id=character(),occurred_at=character(),origin=character(),question_id=character(),is_correct=logical()))
  candidates <- core_shadow_rows(request$candidates)
  if (nrow(events)) {
    if (any(events$student_id != request$student_id) || any(events$contest_id != request$context$contest_id) ||
        anyDuplicated(events$event_id) || any(!is.finite(vapply(events$occurred_at,.lo_time,numeric(1)))) ||
        any(vapply(events$occurred_at,.lo_time,numeric(1)) > .lo_time(request$evidence_cutoff))) stop('INVALID_EVENT_SCOPE_TIME_OR_ID')
  }
  if (nrow(candidates) && (anyDuplicated(candidates$candidate_id) || any(candidates$contest_id != request$context$contest_id) ||
      any(!candidates$activity_type %in% c('DIAGNOSE_CONCEPT','REVIEW_ITEM')) ||
      !'inventory_observed_at' %in% names(candidates) || any(candidates$inventory_observed_at != request$cutoff))) stop('INVALID_HOST_INVENTORY')
  snapshot <- list(student_id=request$student_id,run_id=request$run_id,cutoff=request$cutoff,evidence=events)
  snapshot$host_source <- list(source_id=request$source_id,producer_version=request$producer_version,
    snapshot_rowid=request$snapshot_rowid,engine_sources=request$engine_sources,evidence_cutoff=request$evidence_cutoff,
    fixture_installation=request$fixture_installation,evidence_omissions=request$evidence_omissions,java_runtime=request$java_runtime,
    runtime=list(r_version=as.character(getRversion()),jsonlite_version=as.character(utils::packageVersion('jsonlite')),
      digest_version=as.character(utils::packageVersion('digest'))),
    custody='AUTHENTICATED_LOCAL_CHILD_PROTOCOL_NOT_PERSONAL_ORIGIN_PROOF')
  # Keep personal provenance unknown: host custody cannot prove human-origin data.
  profile <- build_evidence_specialists(events,request$cutoff)
  snapshot$learner_evidence_profile <- profile
  specialists <- evidence_specialist_results(profile,request$student_id,request$run_id)
  registry <- list()
  # The authenticated host supplies facts, never imported specialist envelopes.
  for (row in request$candidates) if (identical(row$activity_type,'DIAGNOSE_CONCEPT')) {
    registry[[length(registry)+1L]] <- c(row[c('inventory_id','inventory_version','curriculum_source_id','scope_id','contest_id',
      'activity_type','material_available','in_syllabus','prerequisites_status','estimated_minutes','risk')],
      list(target='CURRICULUM_INVENTORY',validation_status='CONFIGURED_POLICY',can_propose=TRUE,
        valid_from=request$cutoff,valid_until=request$cutoff))
  }
  qids <- vapply(request$memory,function(m) m$question_id,character(1))
  if (anyDuplicated(qids)) stop('DUPLICATE_MEMORY_ID')
  for (m in request$memory) {
    if (!identical(m$model_version,'FSRS-6.0-default-core-no-fuzz') ||
        !is.finite(.lo_time(m$last_reviewed_at)) || !is.finite(.lo_time(m$due_at)) ||
        .lo_time(m$last_reviewed_at) > .lo_time(request$cutoff) || .lo_time(m$due_at) > .lo_time(request$cutoff) ||
        !.lo_number(m$retrievability) || m$retrievability < 0 || m$retrievability > 1 ||
        !is.logical(m$memory_risk) || length(m$memory_risk)!=1L || !identical(m$memory_risk,m$retrievability<=0.9)) stop('INVALID_FSRS_SNAPSHOT')
    use <- which(events$question_id == m$question_id & events$occurred_at == m$last_reviewed_at)
    if (!length(use)) next # No fabricated event to fill an absent memory lineage.
    source <- paste0('core:learning_memory_state:',m$question_id)
    if (!'source_id' %in% names(events)) {
      events$source_id <- ''; events$scope_id <- ''; events$evidence_type <- ''; events$evidence_version <- ''; events$valid_until <- ''
    }
    events$source_id[use] <- source; events$scope_id[use] <- m$question_id
    events$evidence_type[use] <- 'MEMORY_MAINTENANCE'; events$evidence_version[use] <- m$model_version
    events$valid_until[use] <- request$cutoff
    id <- paste0('FSRS_HOST_',m$question_id)
    specialists[[length(specialists)+1L]] <- build_specialist_result(id,'Read canonical FSRS due state; no topic mastery or transfer inference',
      'ITEM_MEMORY',request$student_id,m$question_id,request$cutoff,events$event_id[use],
      result=list(due=TRUE,memory_risk=m$memory_risk,retrievability=m$retrievability,need_type='MEMORY_MAINTENANCE'), model_version=m$model_version,
      validation_status='OPERATIONAL_VALIDATED',source_ids=source,run_id=request$run_id,
      limitations='Canonical engine state only; predictive calibration NOT_ESTABLISHED')
    registry[[length(registry)+1L]] <- list(specialist_id=id,model_version=m$model_version,target='ITEM_MEMORY',
      unit='NOT_APPLICABLE',horizon='NOT_APPLICABLE',validation_status='OPERATIONAL_VALIDATED',epistemic_type='OBSERVATION',can_propose=TRUE,
      scope_id=m$question_id,source_ids=source,evidence_types='MEMORY_MAINTENANCE',evidence_versions=m$model_version,
      valid_from=m$last_reviewed_at,valid_until=request$cutoff)
  }
  snapshot$evidence <- events
  inputs <- list(snapshot=snapshot,context=request$context,specialists=specialists,candidates=candidates,authority_registry=registry)
  record <- scientific_policy_record(paste0('decision:',request$run_id),inputs)
  replay <- .se_replay_policy(record)
  # Lab registry contains the shadow decision only. No execution, forecast, outcome,
  # propensity or counterfactual is invented to satisfy a scientific schema.
  # Real custody/registry chronology is not established in this round. Synthetic
  # records may exercise the full lab; real records remain pending outside it.
  lab_input <- NULL; lab_report <- NULL
  if (isTRUE(request$fixture_installation)) {
    if (any(!events$origin %in% c('SYNTHETIC_FIXTURE','AUTOMATED_TEST','SYNTHETIC_BENCHMARK'))) stop('CONTAMINATED_SYNTHETIC_INSTALLATION')
    registry_event <- data.frame(event_id=record$decision_id,student_id=request$student_id,occurred_at=request$cutoff,
      recorded_at=request$cutoff,origin='SYNTHETIC_FIXTURE',source_id='core-shadow',evidence_version='core-learning-shadow-v1',
      event_type='DECISION_COMMITTED',append_order=1,payload_sha256=.se_hash(record),session_id='SHADOW_NO_EXECUTION')
    lab_input <- list(schema_version='scientific-decision-evaluation-v1',evaluation_cutoff=request$cutoff,
      events=registry_event,decisions=list(record))
    lab_report <- evaluate_scientific_decisions(lab_input)
  }
  list(schema_version='core-learning-shadow-result-v1',run_id=request$run_id,mode='OBSERVATION_ONLY',can_apply=FALSE,can_schedule=FALSE,
    host_source=snapshot$host_source,
    result=record$result,scientific_record=record,scientific_input=lab_input,scientific_report=lab_report,
    replay_verified=identical(.se_hash(replay),.se_hash(record$result)),
    evaluation_pending=list(status='PENDING',missing=c('AUTHORIZED_EXECUTION','FUTURE_OUTCOME','PRECOMMITTED_TARGET_AND_FORECAST'),
      causal_effect='NOT_ESTABLISHED',personal_validation='NOT_ESTABLISHED'),host_limitations=request$limitations)
}
