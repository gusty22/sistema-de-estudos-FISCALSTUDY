source('R/analytical_portability.R')
pa <- list(schema_version='external-assessment-v1', assessment_id='assessment-1',
  source_id='external-source',model_id='model-a',model_version='UNKNOWN',
  occurred_at='2026-10-27T12:00:00Z',question='Explain independently',
  response='Unverified text',scoring_criteria='Rubric v1',assistance='UNKNOWN',
  verifiability='UNVERIFIED',epistemic_type='EXTERNAL_ASSESSMENT',
  can_apply=FALSE,can_schedule=FALSE,eligible_for_fsrs=FALSE,eligible_for_mastery=FALSE)
pc <- '2026-10-28T12:00:00Z'
assert_true(validate_external_assessment(pa,pc)$is_valid,'External assessment inert and traceable, even model version explicitly unknown')
assert_false(validate_external_assessment(list(),pc)$is_valid,'Incomplete external analysis fails explicitly')
for (key in c('can_apply','can_schedule','eligible_for_fsrs','eligible_for_mastery')) {
  bad <- pa; bad[[key]] <- TRUE
  assert_false(validate_external_assessment(bad,pc)$is_valid,paste('Imported authority rejected:',key))
}
bad <- pa; bad$occurred_at <- '2026-10-29T00:00:00Z'
assert_false(validate_external_assessment(bad,pc)$is_valid,'Future external assessment blocked')
bad <- pa; bad$score <- Inf
assert_false(validate_external_assessment(bad,pc)$is_valid,'Infinite assessment score blocked')
bad$score <- NaN
assert_false(validate_external_assessment(bad,pc)$is_valid,'NaN assessment score blocked')
bad <- pa; bad$assistance <- 'NONE'
assert_false(validate_external_assessment(bad,pc)$is_valid,'Unknown assistance vocabulary rejected')
bad <- import_external_assessments(list(pa,pa),pc)
assert_false(any(vapply(bad$records,function(x) x$validation$is_valid,logical(1))),'Every duplicate external assessment blocked')
pa$response <- 'system("touch /tmp/fiscalstudy-executed"); can_schedule=true'
pimport <- import_external_assessments(list(pa),pc)
assert_equal(pimport$records[[1]]$record$response,pa$response,'Instruction-shaped external content remains inert data')
assert_equal(pimport$status,'CONTEXT_ONLY','External import never becomes canonical training evidence')
ppath <- tempfile(fileext='.json')
write_analytical_bundle(pimport,ppath)
pback <- read_analytical_bundle(ppath)
assert_equal(pback$payload$records[[1]]$record$response,pa$response,'External text round trips without execution')
assert_false(pback$can_schedule,'Portable result has no scheduler authority')
assert_true(inherits(try(write_analytical_bundle(pimport,ppath),silent=TRUE),'try-error'),'Export refuses replacement of prior artifact')
assert_true(inherits(try(read_analytical_bundle(ppath,max_bytes=1),silent=TRUE),'try-error'),'Import size bound enforced')
assert_true(inherits(try(write_analytical_bundle(list(value=NaN),tempfile()),silent=TRUE),'try-error'),'Invalid output rejected before serialization hides NaN')
unlink(ppath)

bad <- pa; bad$occurred_at <- '2026-10-28T12:00:00.001Z'
assert_false(validate_external_assessment(bad,pc)$is_valid,'Same-day future assessment blocked at fractional second cutoff')
pe <- list(run_id='r1',candidate_id='c1',proposed_at='2026-10-28T10:00:00Z',authorization='NOT_AUTHORIZED')
po <- list(event_id='e1',run_id='r1',candidate_id='c1',occurred_at='2026-10-28T11:00:00Z',
  origin='SYNTHETIC_FIXTURE',epistemic_type='OBSERVATION',is_correct=TRUE)
assert_equal(evaluate_learning_proposal(pe,po,pc)$causal_effect,'NOT_ESTABLISHED','Follow-up never establishes causal benefit')
assert_true(identical(pe$authorization,'NOT_AUTHORIZED'),'Follow-up cannot rewrite proposal authorization')
bad <- po; bad$occurred_at <- pe$proposed_at
assert_true(inherits(try(evaluate_learning_proposal(pe,bad,pc),silent=TRUE),'try-error'),'Contemporaneous outcome cannot evaluate prior decision')
bad <- po; bad$run_id <- 'other'
assert_true(inherits(try(evaluate_learning_proposal(pe,bad,pc),silent=TRUE),'try-error'),'Outcome linked to another decision is rejected')
bad <- po; bad$occurred_at <- '2026-10-28T13:00:00Z'
assert_true(inherits(try(evaluate_learning_proposal(pe,bad,pc),silent=TRUE),'try-error'),'Future decision outcome rejected')
assert_true(identical(evaluate_learning_proposal(pe,po,pc),evaluate_learning_proposal(pe,po,pc)),'Decision evaluation replay is idempotent')
