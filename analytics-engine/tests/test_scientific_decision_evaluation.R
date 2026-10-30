source("lab/decision_scientific_evaluation.R")
source("tests/fixtures/scientific_evaluation/scenarios.R")
sci_error<-function(expr)inherits(try(force(expr),silent=TRUE),"try-error")
sci_run<-function(x)evaluate_scientific_decisions(scientific_fixture_rehash(x))
sci_x<-scientific_fixture();sci_r<-evaluate_scientific_decisions(sci_x)
assert_equal(sci_r$scored_count,6L,"All six distinct future targets are technically scored")
assert_equal(sci_r$source_state,"SYNTHETIC_CONTRACT_ONLY","Scientific fixture never becomes personal evidence")
assert_true(all(vapply(sci_r$targets,function(t)t$audited_real_scored_n==0L,logical(1))),"No target claims sufficient real personal observations")
assert_false(sci_r$can_apply,"Scientific evaluator has no operational apply capability")
assert_false(sci_r$can_schedule,"Scientific evaluator has no scheduling capability")
assert_equal(sci_r$personal_validation,"NOT_ESTABLISHED","Correct software fixtures do not validate a student model")
assert_equal(sci_r$causal_effect,"NOT_ESTABLISHED","Prospective association is not a causal effect")
assert_equal(sci_r$scored$`forecast-1`$retention_lag_seconds,3*86400+1,"Retention interval is measured from item contact, not forecast creation")
assert_true(sci_r$scored$`forecast-1`$delay_seconds<sci_r$scored$`forecast-1`$retention_lag_seconds,"Response delay is kept separate from retention interval")
assert_equal(sci_r$prefix_baselines$`forecast-1`$predictions$PREFIX_BETA11,1/3,"Binary baseline is reconstructed from eligible prior outcomes only")
assert_equal(sci_r$prefix_baselines$`forecast-5`$predictions$PREFIX_MEAN_SECONDS,100,"Duration reference uses observed prefix active seconds")
sci_time<-sci_r$prediction_metrics[["def-5::FIXTURE_FROZEN_V1::EVIDENCE_CONTEXTUAL_V1"]]
assert_equal(sci_time$metrics$mae_seconds,30,"Duration MAE has a closed-form expected value")
assert_equal(sci_time$baselines$PREFIX_MEAN_SECONDS$mean_loss_difference,10,"Duration model and baseline use the same paired activity")
sci_binary<-sci_r$prediction_metrics[["def-1::FIXTURE_FROZEN_V1::EVIDENCE_CONTEXTUAL_V1"]]
assert_equal(sci_binary$metrics$brier,1/16,"Delayed retrieval Brier score is numerically correct")
assert_equal(sci_binary$metrics$n,1L,"Each predictive metric reports its actual denominator")
assert_equal(sci_r$efficiency$active_time$total_seconds,220,"Invested time is the observed sum, including historical execution")
assert_equal(sci_r$efficiency$registered_curriculum_coverage$n,2L,"Curricular coverage uses an explicit registered denominator")
assert_equal(sci_r$efficiency$registered_curriculum_coverage$k,1L,"Activity coverage is not inferred mastery")
assert_equal(sci_r$efficiency$opportunity_cost$status,"NOT_ESTABLISHED","Foregone learning outcomes are never invented")
assert_equal(sci_r$policy_comparison$followups$`followup-current`$pre_post_change,1,"Comparable pre/post change is descriptive and calculable")
assert_equal(sci_r$policy_comparison$policies$EVIDENCE_CONTEXTUAL_V1$observed_followups,1L,"Only executed policy receives a recorded outcome")
assert_equal(sci_r$policy_comparison$policies$CURRICULAR_CONSERVATIVE_V1$observed_followups,0L,"Unexecuted policy receives no credit even when it chose the same action")
assert_equal(sci_r$policy_comparison$policies$SHORTEST_ADMISSIBLE_V1$observed_followups,0L,"Unexecuted shortest policy has no fabricated outcome")
for(choice in sci_r$policy_comparison$states[[1]]$choices)
  assert_equal(choice$evaluated_candidates,sci_r$policy_comparison$states[[1]]$admissible_ids,"Policy comparison retains exactly the original admissible alternatives")
assert_equal(evaluate_scientific_decisions(sci_x),sci_r,"Scientific evaluation deterministically replays without fitting")
sci_empty<-evaluate_scientific_decisions(list(schema_version="scientific-decision-evaluation-v1",evaluation_cutoff=sci_x$evaluation_cutoff))
assert_equal(sci_empty$scored_count,0L,"Empty data preserve no-data rather than zero ability")
assert_equal(sci_empty$efficiency$registered_curriculum_coverage$status,"NOT_ESTABLISHED","Absent curriculum does not produce a false zero coverage")

# Contract corruption and temporal leakage remain invalid even after an attacker rehashes bytes.
x<-sci_x;x$forecasts$predicted_value[1]<-.99
assert_true(sci_error(evaluate_scientific_decisions(x)),"Payload mutation without registry commitment is rejected")
x<-sci_x;x$forecasts$training_cutoff_at[1]<-sci_x$evaluation_cutoff
assert_true(sci_error(sci_run(x)),"Training on information after the frozen cutoff is rejected")
x<-sci_x;x$forecasts$evidence_ids[[1]]<-"outcome-1"
assert_true(sci_error(sci_run(x)),"Future outcome cannot be forecast evidence")
x<-sci_x;x$forecasts$model_version[1]<-"UNKNOWN"
assert_true(sci_error(sci_run(x)),"Unknown model version cannot be treated as an identified forecast")
x<-sci_x;x$events$origin[1]<-"REAL_STUDY"
assert_true(sci_error(sci_run(x)),"Mixed real/synthetic scientific records are rejected")
x<-sci_x;x$events$student_id[1]<-"another-student"
assert_true(sci_error(sci_run(x)),"Individual pilot evaluation cannot pool another student")
x<-sci_x;x$outcomes$attempt_id[2]<-x$outcomes$attempt_id[1]
assert_true(sci_error(sci_run(x)),"Duplicate physical assessment attempt cannot inflate denominators")
x<-sci_x;x$forecasts<-rbind(x$forecasts,x$forecasts[1,])
assert_true(sci_error(sci_run(x)),"Duplicate forecast identities are rejected")
x<-sci_x;x$forecasts$predicted_value[1]<-NaN
assert_true(sci_error(sci_run(x)),"Nonfinite committed probability is invalid")
x<-sci_x;x$outcomes$answer_exposed<-"false"
assert_true(sci_error(sci_run(x)),"Unknown/string boolean cannot acquire independence authority")
x<-sci_x;x$events$recorded_at[x$events$event_id=="forecast-1"]<-x$events$occurred_at[x$events$event_id=="outcome-1"]
assert_true(sci_error(sci_run(x)),"Forecast must have been recorded strictly before the outcome")
x<-sci_x;x$decisions[[1]]$result$proposal$candidate_id<-"gap"
assert_true(sci_error(sci_run(x)),"Adulterated policy choice is rejected by replay of original validator")
x<-sci_x;x$decisions[[1]]$inputs$context$available_minutes<-1
assert_true(sci_error(sci_run(x)),"Comparison from different alternatives/time state is rejected")
x<-sci_x;x$executions$decision_input_id[x$executions$execution_id=="execution-current"]<-"another-input"
assert_true(sci_error(sci_run(x)),"Execution cannot be attributed to another decision input")
x<-sci_x;x$executions$policy_version[x$executions$execution_id=="execution-current"]<-"SHORTEST_ADMISSIBLE_V1"
assert_true(sci_error(sci_run(x)),"Policy cannot receive execution credit for an action it did not choose")
x<-sci_x;x$executions$active_seconds[1]<-999999
assert_true(sci_error(sci_run(x)),"Active time cannot exceed observed execution clock")

# Eligibility exclusions preserve missingness and do not become favorable outcomes.
x<-sci_x;x$exposures$unit_id[1]<-"unrelated-item"
r<-sci_run(x)
assert_equal(r$audits$`forecast-1`$status,"NOT_SCORED","Unknown delayed contact interval is not immediate retention evidence")
x<-sci_x;x$outcomes$assistance[x$outcomes$outcome_id=="outcome-3"]<-"HINTS"
r<-sci_run(x)
assert_equal(r$audits$`forecast-3`$status,"NOT_SCORED","Assisted application response is not an independent outcome")
x<-sci_x;x$outcomes$answer_exposed[x$outcomes$outcome_id=="outcome-4"]<-NA
r<-sci_run(x)
assert_equal(r$audits$`forecast-4`$status,"NOT_SCORED","Unknown answer exposure preserves unknown transfer independence")
x<-sci_x;x$definitions$independent_instrument[x$definitions$definition_id=="def-4"]<-NA
r<-sci_run(x)
assert_true("INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED" %in% r$audits$`forecast-4`$codes,"Unknown transfer instrument cannot self-establish transfer")
x<-sci_x;x$outcomes$value[x$outcomes$outcome_id=="outcome-2"]<-NA_real_
r<-sci_run(x)
assert_true("OUTCOME_MISSING_OR_NONFINITE" %in% r$audits$`forecast-2`$codes,"Missing outcome is counted and excluded without favorable imputation")
x<-sci_x;x$forecasts$forecast_status[2]<-"ABSTAIN";x$forecasts$predicted_value[2]<-NA_real_
r<-sci_run(x)
assert_equal(r$scored_count,5L,"Explicit abstention stays in forecast denominator")
assert_true("MODEL_ABSTAINED" %in% r$audits$`forecast-2`$codes,"Abstention has an explicit reason")
x<-sci_x;x$definitions$max_delay_seconds[4]<-1
r<-sci_run(x)
assert_true("OUTCOME_OUTSIDE_PREDECLARED_HORIZON" %in% r$audits$`forecast-4`$codes,"Out-of-window result cannot validate registered horizon")
x<-sci_x;x$outcomes$unit_id[x$outcomes$outcome_id=="historic-novel"]<-"item-2"
r<-sci_run(x)
assert_true("PRIOR_ITEM_OR_TEMPLATE_EXPOSURE" %in% r$audits$`forecast-2`$codes,"Previously answered item cannot be a first observed item")
x<-sci_x;x$outcomes$template_id[x$outcomes$outcome_id=="historic-novel"]<-"template-item-4"
r<-sci_run(x)
assert_true("PRIOR_ITEM_OR_TEMPLATE_EXPOSURE" %in% r$audits$`forecast-4`$codes,"Previously exposed template cannot establish independent transfer")
x<-sci_x;x$executions$status[x$executions$execution_id=="execution-current"]<-"PARTIAL"
r<-sci_run(x)
assert_equal(r$policy_comparison$followups$`followup-current`$status,"NOT_ATTRIBUTABLE","Partial activity receives no completed-intervention outcome credit")
assert_equal(r$efficiency$active_time$total_seconds,220,"Partial execution still contributes observed invested time")
x<-sci_x;x$executions$active_seconds[x$executions$execution_id=="execution-current"]<-NA_real_
r<-sci_run(x)
assert_equal(r$efficiency$active_time$status,"NOT_ESTABLISHED","Missing activity time is not silently replaced by zero")
assert_equal(r$efficiency$active_time$known_subtotal_seconds,100,"Known subtotal reports its limited coverage")
x<-sci_x;x$definitions$blueprint_unit_ids[[2]]<-c("item-2","absent-exam-item")
r<-sci_run(x)
assert_equal(r$efficiency$representative_exam$status,"NOT_ESTABLISHED","Incomplete exam blueprint cannot establish representative exam score")
# Future labels never alter frozen references or earlier eligibility.
x<-sci_x;x$outcomes$value[x$outcomes$outcome_id=="outcome-1"]<-0
r<-sci_run(x)
assert_equal(r$prefix_baselines,sci_r$prefix_baselines,"Changing future labels cannot change any frozen baseline")
x<-sci_x;x$outcomes$value[x$outcomes$outcome_id=="historic-ret"]<-1
r<-sci_run(x)
assert_equal(r$prefix_baselines$`forecast-1`$predictions$PREFIX_BETA11,2/3,"Only a prior eligible outcome can update future temporal reference")
# An independent forecast's metadata must be registered, not learned from its result.
x<-sci_x;x$events$recorded_at[x$events$event_id=="def-4"]<-x$events$recorded_at[x$events$event_id=="outcome-4"]
x$events<-x$events[order(x$events$recorded_at,x$events$event_id),];x$events$append_order<-seq_len(nrow(x$events))
r<-sci_run(x)
assert_true("DEFINITION_NOT_AVAILABLE_AT_CUTOFF" %in% r$audits$`forecast-4`$codes,"Later difficulty/classification metadata cannot leak into forecast eligibility")

# Inert bundle/CLI replay includes the actual orchestrator's three-policy record.
folder<-tempfile("scientific-cli-");dir.create(folder)
request<-file.path(folder,"input.json");one<-file.path(folder,"one.json");two<-file.path(folder,"two.json")
write_analytical_bundle(sci_x,request)
run<-function(path)system2(file.path(R.home("bin"),"Rscript"),c("lab/run_decision_evaluation.R",shQuote(request),shQuote(path)),stdout=TRUE,stderr=TRUE)
assert_true(is.null(attr(run(one),"status")),"Scientific CLI executes JSON contract and real policy replay")
assert_true(is.null(attr(run(two),"status")),"Scientific CLI replay executes independently")
assert_equal(readLines(one),readLines(two),"Scientific CLI produces identical replay artifact bytes")
portable<-read_analytical_bundle(one)$payload
assert_equal(portable$input_id,sci_r$input_id,"Native and JSON scientific tables preserve the same input identity")
assert_equal(portable$scored_count,6L,"Portable scientific contract preserves all target results")
assert_false(portable$can_apply,"Portable scientific artifact carries no operational authority")
assert_true(!is.null(attr(suppressWarnings(run(one)),"status")),"Scientific CLI refuses overwriting prior evidence artifact")
unlink(folder,recursive=TRUE)

x<-sci_x;x$definitions$scoring_source[4]<-"UNKNOWN"
r<-sci_run(x)
assert_true("INDEPENDENT_SCORING_NOT_ESTABLISHED" %in% r$audits$`forecast-4`$codes,"Unknown scoring source cannot establish transfer success")
assert_equal(sci_r$prediction_metrics[["def-4::FIXTURE_FROZEN_V1::EVIDENCE_CONTEXTUAL_V1"]]$difficulty_strata$UNKNOWN$n,1L,"Unknown difficulty is reported as its own uncalibrated stratum")
assert_equal(sci_r$efficiency$representative_exam$by_assessment$`def-2::exam-current`$n,1L,"Complete predeclared equal-weight exam blueprint has a known denominator")
x<-sci_x;x$exposures$unit_id[1]<-"item-2";x$exposures$kind[1]<-"ASSESSMENT_PROMPT"
r<-sci_run(x)
assert_true("PRIOR_ITEM_OR_TEMPLATE_EXPOSURE" %in% r$audits$`forecast-2`$codes,"An earlier question presentation is prior exposure even without a submitted answer")
x<-sci_x;x$outcomes<-x$outcomes[x$outcomes$outcome_id!="outcome-2",];x$events<-x$events[x$events$event_id!="outcome-2",]
r<-sci_run(x)
assert_true("PENDING_OUTCOME" %in% r$audits$`forecast-2`$codes,"Unanswered forecast remains pending instead of becoming an incorrect response")
x<-sci_x;x$events$recorded_at[x$events$event_id=="historic-execution"]<-x$events$recorded_at[x$events$event_id=="outcome-6"]
x$events<-x$events[order(x$events$recorded_at,x$events$event_id),];x$events$append_order<-seq_len(nrow(x$events))
r<-sci_run(x)
assert_equal(r$prefix_baselines$`forecast-5`$n,0L,"Late-recorded execution cannot validate a duration reference at earlier cutoff")
assert_equal(r$prediction_metrics[["def-5::FIXTURE_FROZEN_V1::EVIDENCE_CONTEXTUAL_V1"]]$baselines$PREFIX_MEAN_SECONDS$status,"NOT_ESTABLISHED","Duration comparison with no known prefix reference is explicitly unavailable")
x<-sci_x;x$events$origin<-"REAL_STUDY"
assert_true(sci_error(sci_run(x)),"Nested synthetic decision cannot be laundered into a real registry")
claimed<-list(is_proven_operational=TRUE,is_real_student_data=TRUE,can_generate_student_profile=TRUE)
attr(claimed,"trusted_source_authorized")<-TRUE
attr(claimed,"orchestrator_evidence_id")<-.pd_identity(sci_x$events,NULL,NULL)
r<-evaluate_scientific_decisions(sci_x,claimed)
assert_equal(r$source_state,"SYNTHETIC_CONTRACT_ONLY","Even a claimed audit cannot relabel synthetic records as personal evidence")
x<-sci_x
x$executions$policy_version[x$executions$execution_id=="execution-current"]<-"CURRICULAR_CONSERVATIVE_V1"
x$forecasts$policy_version[x$forecasts$definition_id %in% c("def-5","def-6")]<-"CURRICULAR_CONSERVATIVE_V1"
r<-sci_run(x)
assert_equal(r$policy_comparison$policies$EVIDENCE_CONTEXTUAL_V1$observed_followups,0L,"Changing actual executed policy removes contextual outcome credit")
assert_equal(r$policy_comparison$policies$CURRICULAR_CONSERVATIVE_V1$observed_followups,1L,"Actual conservative execution receives its own observed followup")
assert_equal(sci_r$policy_comparison$policies$EVIDENCE_CONTEXTUAL_V1$by_definition$`def-6`$mean_pre_post_change,1,"Paired observational change is calculated separately from policy effect")
protocol<-jsonlite::fromJSON("lab/PERSONAL_PILOT_PROTOCOL.json",simplifyVector=FALSE)$decision_scientific_extension
assert_equal(protocol$status,"NOT_STARTED","Individual scientific protocol remains unstarted")
assert_false(protocol$automatic_start,"No personal experiment starts automatically")
assert_false(protocol$manual_flashcards_required,"Pilot does not require manual flashcard creation")
assert_false(protocol$manual_review_management_required,"Pilot does not require manual review scheduling")

assert_equal(sci_r$policy_comparison$executions$`execution-current`$opportunity_cost$observed_budget_fraction,1/15,"Observed budget consumption is calculable without inventing foregone learning")
assert_equal(sci_r$policy_comparison$executions$`execution-current`$opportunity_cost$observed_minus_estimated_seconds,-780,"Observed time and planning estimate remain distinct from causal opportunity cost")

assert_equal(sci_binary$metrics$discrimination$status,"NOT_ESTABLISHED","Single-class discrimination is explicitly not established")

x<-sci_x;original<-contextual_gate_fixture("unknown");original$snapshot$evidence$origin[1]<-"REAL_STUDY"
x$decisions<-list(scientific_policy_record("decision-current",original));x$events$origin<-"REAL_STUDY"
msg<-tryCatch({sci_run(x);"NO_ERROR"},error=function(e)conditionMessage(e))
assert_equal(msg,"SYNTHETIC_DECISION_IN_REAL_REGISTRY","A mixed-origin decision cannot be hidden inside a purportedly real registry")

# Verification of the 6 targets matrix and contractual dimensions
matrix_specs<-scientific_target_matrix()
assert_equal(length(matrix_specs),6L,"Target matrix defines all six scientific prediction targets")
expected_keys<-c("target_id","target_name","instrument_required","unit_of_analysis","preparation_event",
  "frozen_forecast","future_outcome","scoring_criterion","provenance","evidence_of_independence",
  "assistance","prior_exposure","temporal_window","eligibility","exclusion_reasons",
  "scientific_limitations","evaluation_capacity")
for(t_name in names(matrix_specs)) {
  target<-matrix_specs[[t_name]]
  assert_true(all(expected_keys %in% names(target)),paste0("Target ",t_name," defines all required contractual dimensions"))
  assert_equal(target$evaluation_capacity,"SYNTHETIC_CONTRACT_ONLY in automated software test suite; personal pilot NOT_ESTABLISHED",
    paste0("Target ",t_name," preserves NOT_ESTABLISHED personal validation"))
}
assert_true(all(vapply(sci_r$targets,function(t)!is.null(t$instrument_required)&&!is.null(t$exclusion_reasons),logical(1))),
  "Evaluator output targets include enriched matrix dimensions")

# Rigorous edge case tests for eligibility, chronology and exclusions of the six targets
# 1. DELAYED_ITEM_RETRIEVAL: Intervening item contact between forecast and outcome
x<-sci_x
origin_dt<-as.POSIXct("2026-10-26T12:00:00Z",format="%Y-%m-%dT%H:%M:%SZ",tz="UTC")
stamp_dt<-function(s)format(origin_dt+s,"%Y-%m-%dT%H:%M:%SZ",tz="UTC")
intervening_exp<-data.frame(exposure_id="intervening-exposure",unit_id="item-1",template_id="template-item-1",
  scope_id="tax",kind="LEARNING",forecast_id=NA_character_,stringsAsFactors=FALSE)
x$exposures<-rbind(x$exposures,intervening_exp)
intervening_ev<-data.frame(event_id="intervening-exposure",student_id="SYNTHETIC-gate-student",
  occurred_at=stamp_dt(2.5*86400),recorded_at=stamp_dt(2.5*86400),
  origin="SYNTHETIC_FIXTURE",source_id="fixture-ledger",evidence_version="fixture-science-1",
  event_type="EXPOSURE_OBSERVED",append_order=0,payload_sha256="",session_id="fixture-session",stringsAsFactors=FALSE)
x$events<-rbind(x$events,intervening_ev)
x$events<-x$events[order(x$events$recorded_at,x$events$event_id),];x$events$append_order<-seq_len(nrow(x$events))
r<-sci_run(x)
assert_true("INTERVENING_ITEM_CONTACT" %in% r$audits$`forecast-1`$codes,"Intervening item contact disqualifies delayed retention evidence")
assert_equal(r$audits$`forecast-1`$status,"NOT_SCORED","Intervening contact leads to un-scored forecast")

# 2. APPLICATION_SUCCESS: Unknown template independence
x<-sci_x
x$forecasts$template_id[x$forecasts$forecast_id=="forecast-3"]<-"UNKNOWN"
x$outcomes$template_id[x$outcomes$outcome_id=="outcome-3"]<-"UNKNOWN"
r<-sci_run(x)
assert_true("TEMPLATE_INDEPENDENCE_UNKNOWN" %in% r$audits$`forecast-3`$codes,"Unknown template ID disqualifies application problem independence")

# 3. TRANSFER_SUCCESS: Fractional outcome violates binary criterion
x<-sci_x
x$outcomes$value[x$outcomes$outcome_id=="outcome-4"]<-0.5
r<-sci_run(x)
assert_true("BINARY_CRITERION_REQUIRED" %in% r$audits$`forecast-4`$codes,"Fractional score violates binary success criterion for transfer")

# 4. ACTIVITY_DURATION_SECONDS: Disagreement between execution and outcome active time
x<-sci_x
x$outcomes$active_seconds[x$outcomes$outcome_id=="outcome-5"]<-110
x$outcomes$value[x$outcomes$outcome_id=="outcome-5"]<-110
r<-sci_run(x)
assert_true("DURATION_EXECUTION_DISAGREEMENT" %in% r$audits$`forecast-5`$codes,"Disagreement between execution and outcome active seconds is caught")

# 5. POST_INTERVENTION_SUCCESS: Outcome outside registered post-intervention delay window
x<-sci_x
x$definitions$max_delay_seconds[x$definitions$definition_id=="def-6"]<-10
r<-sci_run(x)
assert_true("POST_ASSESSMENT_OUTSIDE_REGISTERED_WINDOW" %in% r$audits$`forecast-6`$codes,"Post-intervention outcome exceeding maximum window is excluded")

# 6. FOLLOWUP: Late pre-measure recorded after intervention start
x<-sci_x
x$events$recorded_at[x$events$event_id=="pre-post"]<-x$events$occurred_at[x$events$event_id=="execution-current"]
x$events<-x$events[order(x$events$recorded_at,x$events$event_id),];x$events$append_order<-seq_len(nrow(x$events))
r<-sci_run(x)
assert_true("INCOMPARABLE_OR_LATE_PRE_MEASURE" %in% r$policy_comparison$followups$`followup-current`$pre_measure_codes,
  "Late pre-measure recorded after activity started cannot provide baseline for pre/post change")

# 7. DELAYED_ITEM_RETRIEVAL definition: Zero retention interval is invalid
x<-sci_x
x$definitions$min_retention_seconds[x$definitions$definition_id=="def-1"]<-0
assert_true(sci_error(sci_run(x)),"Definition for DELAYED_ITEM_RETRIEVAL without positive retention interval is rejected")
