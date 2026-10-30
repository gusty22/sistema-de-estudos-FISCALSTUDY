# Synthetic contract fixture; never a personal-learning record.
core_shadow_fixture <- function() {
  files <- core_shadow_source_files()
  row <- list(activity_type='DIAGNOSE_CONCEPT',candidate_id='diagnostic:t:q',classification_id='link',contest_id='c',
    curriculum_source_id='e:v1',estimated_minutes=5,inventory_id='diagnostic:t:q',inventory_version='core-shadow-inventory-v1',
    material_available=TRUE,in_syllabus=TRUE,prerequisites_status='NOT_APPLICABLE',priority='DIAGNOSTIC_GAP',question_id='q',
    risk='LOW_REVERSIBLE',scope_id='q',support_specialist_id='',time_basis='HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION',topic_id='t')
  row <- row[sort(names(row))]
  row$inventory_observed_at <- '2026-10-28T12:00:00Z'
  list(schema_version='core-learning-shadow-v1',student_id='LOCAL_SINGLE_USER',cutoff='2026-10-28T12:00:00Z',snapshot_rowid=0,
    evidence_cutoff='2026-10-28T12:00:00Z',fixture_installation=TRUE,evidence_omissions=list(),
    context=list(contest_id='c',available_minutes=15),candidates=list(row),events=list(),memory=list(),
    limitations='SYNTHETIC_CONTRACT_ONLY',run_id='fixture-shadow',source_id='SYNTHETIC_SQLITE_FIXTURE',producer_version='CORE_SHADOW_READ_V1',java_runtime='SYNTHETIC_HOST_RUNTIME',
    engine_sources=setNames(lapply(files,function(f) digest::digest(f,algo='sha256',file=TRUE)),files))
}
