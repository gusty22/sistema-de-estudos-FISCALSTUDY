# SYNTHETIC_FIXTURE ONLY. No personal observations or policy-benefit evidence.
source("tests/fixtures/contextual_gate/scenarios.R")
scientific_fixture <- function() {
  origin <- as.POSIXct("2026-10-26T12:00:00Z",format="%Y-%m-%dT%H:%M:%SZ",tz="UTC")
  stamp <- function(seconds) format(origin+seconds,"%Y-%m-%dT%H:%M:%SZ",tz="UTC")
  student <- "SYNTHETIC-gate-student"
  input <- list(schema_version="scientific-decision-evaluation-v1",evaluation_cutoff=stamp(4*86400),
    fixture_notice="SYNTHETIC_CONTRACT_TEST_ONLY",decisions=list())
  for(k in names(.se_specs)) input[[k]] <- .se_table(NULL,.se_specs[[k]])
  register <- function(table,row,seconds,type,id_key,session="fixture-session") {
    # Fill explicit nullable columns before hashing the transport record.
    frame <- .se_table(list(row),.se_specs[[table]])
    input[[table]] <<- rbind(input[[table]],frame)
    id <- frame[[id_key]][1L]
    ev <- data.frame(event_id=id,student_id=student,occurred_at=stamp(seconds),recorded_at=stamp(seconds),
      origin="SYNTHETIC_FIXTURE",source_id="fixture-ledger",evidence_version="fixture-science-1",
      event_type=type,append_order=0,payload_sha256=.se_hash(.se_rows(frame)[[1L]]),session_id=session)
    input$events <<- rbind(input$events,ev)
  }
  targets <- names(scientific_prediction_targets())
  for(i in seq_along(targets)) {
    type <- targets[i]
    classification <- switch(type,APPLICATION_SUCCESS="INDEPENDENT_APPLICATION",TRANSFER_SUCCESS="INDEPENDENT_TRANSFER",
      POST_INTERVENTION_SUCCESS="INDEPENDENT_POST_ASSESSMENT","RECORDED_ITEM")
    register("definitions",list(definition_id=paste0("def-",i),target_id=type,scope_id=if(i==1)"tax" else "curriculum",
      version="fixture-definition-1",instrument_id=paste0("instrument-",i),
      scoring_rule_id=if(i==2)"EQUAL_WEIGHT_BINARY_V1" else "FIXED_SUCCESS_CRITERION_V1",
      success_criterion="Fixed definitive criterion registered before all forecasts",
      scoring_source=if(i==5)"ACTIVE_TIME_TELEMETRY" else "DEFINITIVE_ANSWER_KEY",
      min_delay_seconds=0,max_delay_seconds=4*86400,min_retention_seconds=if(i==1)86400 else 0,
      classification=classification,classification_status="CONFIRMED",difficulty=if(i==4)"UNKNOWN" else "UNCALIBRATED_RECORDED",
      independent_instrument=TRUE,representative_exam=i==2,blueprint_id=if(i==2)"fixture-blueprint" else NA_character_,
      blueprint_unit_ids=if(i==2)"item-2" else character()),-200+i,"DEFINITION_REGISTERED","definition_id")
  }
  for(i in 1:2)register("curriculum",list(catalogue_id=paste0("catalogue-",i),scope_id=c("tax","curriculum")[i],
    version="catalogue-1",source_id="fixture-edital",recorded_at=stamp(-100+i),in_syllabus=TRUE),-100+i,"CURRICULUM_REGISTERED","catalogue_id")
  for(unit in c("item-1","historic-retention")) register("exposures",list(exposure_id=paste0("exposure-",unit),
    unit_id=unit,template_id=paste0("template-",unit),scope_id="tax",kind="LEARNING",forecast_id=NA_character_),0,"EXPOSURE_OBSERVED","exposure_id")
  register("executions",list(execution_id="historic-execution",decision_id="",run_id="",decision_input_id="",
    policy_version="NOT_ATTACHED",candidate_id="historic-activity",unit_id="historic-activity",scope_id="curriculum",
    authorization="AUTHORIZED",status="COMPLETED",started_at=stamp(100),ended_at=stamp(300),active_seconds=100),301,"EXECUTION_RECORDED","execution_id")
  outcome <- function(id,forecast,definition,unit,value,seconds,execution="",active=NA_real_,session="fixture-session") {
    register("outcomes",list(outcome_id=id,attempt_id=paste0("attempt-",id),forecast_id=forecast,definition_id=definition,unit_id=unit,
      template_id=paste0("template-",unit),value=value,assistance="NONE",answer_exposed=FALSE,
      scoring_rule_id=if(definition=="def-2")"EQUAL_WEIGHT_BINARY_V1" else "FIXED_SUCCESS_CRITERION_V1",
      execution_id=execution,active_seconds=active),seconds,"OUTCOME_OBSERVED","outcome_id",session)
  }
  outcome("historic-ret","","def-1","historic-retention",0,86400)
  outcome("historic-novel","","def-2","historic-novel-item",1,86401,session="historical-exam")
  outcome("historic-time","","def-5","historic-activity",100,302,"historic-execution",100)
  outcome("pre-post","","def-6","pre-item",0,86402,"historic-execution")
  inputs <- contextual_gate_fixture("unknown")
  record <- scientific_policy_record("decision-current",inputs)
  input$decisions <- list(record)
  input$events <- rbind(input$events,data.frame(event_id=record$decision_id,student_id=student,
    occurred_at=stamp(2*86400+10),recorded_at=stamp(2*86400+10),origin="SYNTHETIC_FIXTURE",source_id="fixture-ledger",
    evidence_version="fixture-science-1",event_type="DECISION_COMMITTED",append_order=0,payload_sha256=.se_hash(record),session_id="fixture-session"))
  state <- record$result
  register("executions",list(execution_id="execution-current",decision_id=record$decision_id,run_id=state$run_id,
    decision_input_id=state$decision_trace$input_id,policy_version="EVIDENCE_CONTEXTUAL_V1",candidate_id="curriculum",
    unit_id="current-activity",scope_id="curriculum",authorization="AUTHORIZED",status="COMPLETED",
    started_at=stamp(2*86400+100),ended_at=stamp(2*86400+300),active_seconds=120),2*86400+301,"EXECUTION_RECORDED","execution_id")
  for(i in seq_along(targets)) {
    unit <- if(i==5)"current-activity" else paste0("item-",i)
    register("forecasts",list(forecast_id=paste0("forecast-",i),definition_id=paste0("def-",i),unit_id=unit,
      template_id=paste0("template-",unit),model_version="FIXTURE_FROZEN_V1",model_state_id="fixture-state-1",
      policy_version="EVIDENCE_CONTEXTUAL_V1",data_cutoff_at=stamp(2*86400),training_cutoff_at=stamp(2*86400),
      predicted_value=c(.75,.6,.8,.2,90,.7)[i],forecast_status="PREDICTED",evidence_ids=c("historic-ret","historic-novel")),
      2*86400+20+i,"FORECAST_COMMITTED","forecast_id")
    outcome(paste0("outcome-",i),paste0("forecast-",i),paste0("def-",i),unit,c(1,0,1,1,120,1)[i],
      if(i==5)2*86400+302 else 3*86400+i,if(i %in% c(5,6))"execution-current" else "",if(i==5)120 else NA_real_,
      if(i==2)"exam-current" else "fixture-session")
  }
  register("followups",list(followup_id="followup-current",execution_id="execution-current",outcome_id="outcome-6",
    pre_outcome_id="pre-post"),3*86400+10,"FOLLOWUP_LINKED","followup_id")
  input$events <- input$events[order(input$events$recorded_at,input$events$event_id,method="radix"),,drop=FALSE]
  input$events$append_order <- seq_len(nrow(input$events)); rownames(input$events)<-NULL
  input
}
# Explicit rehash is used only by adversarial fixture tests. It cannot confer source trust.
scientific_fixture_rehash <- function(x) {
  mappings <- c(definitions="definition_id",forecasts="forecast_id",outcomes="outcome_id",exposures="exposure_id",
    executions="execution_id",followups="followup_id",curriculum="catalogue_id")
  for(table in names(mappings))for(row in .se_rows(x[[table]])) {
    id<-row[[mappings[[table]]]];x$events$payload_sha256[match(id,x$events$event_id)]<-.se_hash(row)
  }
  for(record in x$decisions)x$events$payload_sha256[match(record$decision_id,x$events$event_id)]<-.se_hash(record)
  x
}
