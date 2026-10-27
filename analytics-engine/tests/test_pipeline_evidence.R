# End-to-end R contract fixtures. Generated records are synthetic test inputs.
# A positive manifest validates the declared contract, not real human learning.
source("R/adapter.R", local = FALSE)

run_pipeline_fixture <- function(input, output, run_id, manifest = "") {
  keys <- c("FISCALSTUDY_ANALYTICS_OUTPUT", "FISCALSTUDY_RUN_ID", "FISCALSTUDY_EXPORT_MANIFEST", "LANG", "LC_ALL")
  old <- Sys.getenv(keys, unset = NA_character_)
  on.exit({
    for (i in seq_along(keys)) {
      if (is.na(old[i])) Sys.unsetenv(keys[i]) else do.call(Sys.setenv, setNames(list(old[i]), keys[i]))
    }
  }, add = TRUE)
  Sys.setenv(FISCALSTUDY_ANALYTICS_OUTPUT = output, FISCALSTUDY_RUN_ID = run_id,
             FISCALSTUDY_EXPORT_MANIFEST = manifest, LANG = "C", LC_ALL = "C")
  log <- tempfile(fileext = ".log")
  rscript <- file.path(R.home("bin"), if (.Platform$OS.type == "windows") "Rscript.exe" else "Rscript")
  exit <- system2(rscript, c("run_analytics.R", shQuote(input)), stdout = log, stderr = log)
  list(exit = exit, log = readLines(log, warn = FALSE))
}

pipeline_dir <- tempfile("pipeline-contract-")
dir.create(pipeline_dir)
pipeline_csv <- file.path(pipeline_dir, "attempts.csv")
pipeline_output <- file.path(pipeline_dir, "results")
pipeline_df <- data.frame(
  event_id = c("fixture-event-1", "fixture-event-2", "fixture-event-3"),
  session_id = c("fixture-session-1", "fixture-session-2", "fixture-session-2"),
  occurred_at = c("2026-10-10T10:00:00Z", "2026-10-12T10:00:00Z", "2026-10-12T10:05:00Z"),
  origin_type = c("REAL_STUDY", "REAL_STUDY", "REAL_STUDY"),
  question_id = c("fixture-item-1", "fixture-item-1", "fixture-item-2"),
  selected_option = c("A", "B", "C"), is_correct = c(TRUE, FALSE, TRUE),
  gabarito_status = c("DEFINITIVO", "DEFINITIVO", "ANULADA"),
  confidence_level = c(5, 3, 4), active_time_ms = c(12345, 23456, 34567),
  discipline = c("Disciplina fixture", "Disciplina fixture", "Disciplina fixture"),
  assunto = c("Topico fixture", "Topico fixture", "Topico fixture"),
  fsrs_retrievability_pre_update = c(0.30, 0.95, 0.20),
  fsrs_model_version = rep("FSRS-6.0-default-core-no-fuzz", 3),
  fsrs_prediction_timestamp = c("2026-10-10T09:59:00Z", "2026-10-12T09:59:00Z", "2026-10-12T10:04:00Z"),
  fsrs_evidence_status = rep("UNCALIBRATED_ITEM_ESTIMATE", 3), stringsAsFactors = FALSE
)
write.csv(pipeline_df, pipeline_csv, row.names = FALSE)
pipeline_manifest_path <- file.path(pipeline_dir, "export_manifest.json")
pipeline_manifest <- list(manifest_version = "1.0.0", declared_origin = "REAL_STUDY",
  export_timestamp = "2026-10-12T11:00:00Z", database_source = "TEST_FIXTURE_ONLY",
  is_production_environment = FALSE, total_records = nrow(pipeline_df),
  checksum = digest::digest(pipeline_csv, algo = "sha256", file = TRUE))
writeLines(jsonlite::toJSON(pipeline_manifest, auto_unbox = TRUE), pipeline_manifest_path)

fixture_run <- run_pipeline_fixture(pipeline_csv, pipeline_output, "fixture-run-synthetic")
assert_equal(fixture_run$exit, 0L, paste("Pipeline accepts valid temporal contract:", paste(tail(fixture_run$log, 2), collapse = " ")))
if (fixture_run$exit == 0) {
  summary <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "metrics_summary_v1.json"), simplifyVector = FALSE)
  weights <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "robin_hood_weights.json"), simplifyVector = FALSE)
  retrieval <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "retrieval_surprise_v1.json"), simplifyVector = FALSE)
  temporal_backtest <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "temporal_baseline_backtest_v1.json"), simplifyVector = FALSE)
  assert_equal(summary$run_id, "fixture-run-synthetic", "Summary identifies its actual run")
  assert_equal(summary$data_provenance, "UNVERIFIED_SOURCE", "Synthetic fixture manifest cannot establish operational provenance")
  assert_false(summary$is_real_student_data, "Synthetic fixture cannot be labeled real-student data")
  assert_false(weights$can_apply, "Exploratory R output cannot override the scheduler")
  assert_equal(retrieval$run_id, "fixture-run-synthetic", "FSRS diagnostic identifies its source run")
  assert_equal(temporal_backtest$run_id, "fixture-run-synthetic", "Temporal baseline artifact identifies its actual run")
  assert_equal(temporal_backtest$status, "INSUFFICIENT_HISTORY", "Small history is reported without a fabricated score")
  assert_false(temporal_backtest$can_apply, "Temporal baseline audit cannot drive decisions")
  assert_equal(retrieval$per_attempt[[2]]$classification, "ERROR_WITH_HIGH_PREDICTED_RETRIEVAL", "Pipeline separates a high-retrievability error for investigation")
  assert_equal(length(retrieval$investigation_queue), 1L, "Pipeline emits one unresolved investigation candidate")
  assert_false(retrieval$can_apply, "FSRS diagnostic cannot change memory scheduling")
  assert_equal(length(weights$weights), 0L, "Unvalidated model emits no discipline overrides")
  assert_true(all(vapply(summary$metrics, function(m) identical(m$n_observations, 2L) || identical(m$n_observations, 2), logical(1))), "Non-evaluable attempt does not enter effective metric denominators")
}


# A locale-C subprocess must preserve Unicode and emit warning-free metric CSV.
unicode_df <- pipeline_df
unicode_label <- "Direito Tribut\u00e1rio: exce\u00e7\u00e3o"
unicode_df$discipline <- rep(unicode_label,nrow(unicode_df))
unicode_df$assunto <- rep("Cr\u00e9dito tribut\u00e1rio",nrow(unicode_df))
unicode_input <- file.path(pipeline_dir,"unicode-attempts.csv")
unicode_output <- file.path(pipeline_dir,"unicode-results")
utils::write.csv(unicode_df,unicode_input,row.names=FALSE,fileEncoding="UTF-8")
unicode_manifest <- pipeline_manifest
unicode_manifest$checksum <- compute_file_sha256(unicode_input)
unicode_manifest_path <- file.path(pipeline_dir,"unicode-manifest.json")
writeLines(jsonlite::toJSON(unicode_manifest,auto_unbox=TRUE),unicode_manifest_path,useBytes=TRUE)
unicode_run <- run_pipeline_fixture(unicode_input,unicode_output,"fixture-unicode",unicode_manifest_path)
assert_equal(unicode_run$exit,0L,"UTF-8 operational fixture runs under locale C")
assert_false(any(grepl("invalid char|invalid input|conversion",unicode_run$log,ignore.case=TRUE)),
             "Locale C pipeline reports no character conversion warning")
if (unicode_run$exit==0L) {
  unicode_metrics <- utils::read.csv(file.path(unicode_output,"metrics/metrics_summary_v1.csv"),encoding="UTF-8",stringsAsFactors=FALSE)
  time_limitations <- unicode_metrics$limitations[unicode_metrics$metric_name=="median_active_time_seconds"]
  assert_true(grepl("n\u00e3o mede aten\u00e7\u00e3o",time_limitations,fixed=TRUE),
              "Locale C export preserves full UTF-8 metric limitations")
  unicode_summary <- jsonlite::fromJSON(file.path(unicode_output,"metrics/metrics_summary_v1.json"))
  assert_false(unicode_summary$is_real_student_data,"Unicode fixture never gains real-student provenance")
}

# Mixed origins are never laundered by a valid checksum or a later eligibility filter.
pipeline_df$origin_type[2] <- "AUTOMATED_TEST"
write.csv(pipeline_df, pipeline_csv, row.names = FALSE)
pipeline_manifest$checksum <- digest::digest(pipeline_csv, algo = "sha256", file = TRUE)
writeLines(jsonlite::toJSON(pipeline_manifest, auto_unbox = TRUE), pipeline_manifest_path)
mixed_run <- run_pipeline_fixture(pipeline_csv, pipeline_output, "fixture-run-mixed")
assert_equal(mixed_run$exit, 0L, "Mixed-origin diagnostic pipeline remains readable")
if (mixed_run$exit == 0) {
  mixed_summary <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "metrics_summary_v1.json"))
  assert_false(mixed_summary$is_real_student_data, "Mixed origins cannot establish a personal summary")
}

# A mismatching sidecar stays visibly unverified; it must never authorize a profile.
pipeline_manifest$checksum <- paste(rep("0", 64), collapse = "")
writeLines(jsonlite::toJSON(pipeline_manifest, auto_unbox = TRUE), pipeline_manifest_path)
tampered_run <- run_pipeline_fixture(pipeline_csv, pipeline_output, "fixture-run-tampered")
assert_equal(tampered_run$exit, 0L, "Tampered-manifest input produces diagnostic output, not personal authorization")
if (tampered_run$exit == 0) {
  tampered_summary <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "metrics_summary_v1.json"))
  assert_false(tampered_summary$is_real_student_data, "Checksum mismatch never grants personal-study status")
}

# Reusing a directory must replace an old intervention result even during cold start.
write.csv(pipeline_df[0, ], pipeline_csv, row.names = FALSE)
pipeline_manifest$total_records <- 0L
pipeline_manifest$checksum <- digest::digest(pipeline_csv, algo = "sha256", file = TRUE)
writeLines(jsonlite::toJSON(pipeline_manifest, auto_unbox = TRUE), pipeline_manifest_path)
dir.create(file.path(pipeline_output, "metrics"), recursive = TRUE, showWarnings = FALSE)
writeLines('{"evaluation_status":"OLD_RUN_SENTINEL"}', file.path(pipeline_output, "metrics", "intervention_evaluation_v1.json"))
writeLines('{"status":"OLD_RUN_SENTINEL"}', file.path(pipeline_output, "metrics", "temporal_baseline_backtest_v1.json"))
empty_run <- run_pipeline_fixture(pipeline_csv, pipeline_output, "fixture-run-empty")
assert_equal(empty_run$exit, 0L, "Empty operational export finishes with an explicit cold-start contract")
if (empty_run$exit == 0) {
  no_intervention <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "intervention_evaluation_v1.json"))
  assert_equal(no_intervention$evaluation_status, "NO_DATA", "Cold start replaces stale intervention results")
  assert_equal(no_intervention$run_id, "fixture-run-empty", "Cold-start artifact identifies its own run")
  cold_retrieval <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "retrieval_surprise_v1.json"), simplifyVector = FALSE)
  cold_temporal <- jsonlite::fromJSON(file.path(pipeline_output, "metrics", "temporal_baseline_backtest_v1.json"), simplifyVector = FALSE)
  assert_equal(cold_retrieval$status, "NO_DATA", "Cold start replaces memory diagnostics with explicit no-data status")
  assert_equal(cold_temporal$status, "NO_DATA", "Cold start replaces temporal baseline output with explicit no-data status")
  assert_equal(cold_temporal$run_id, "fixture-run-empty", "Cold-start baseline artifact identifies its own run")
  assert_false(cold_temporal$can_apply, "Cold-start baseline artifact cannot drive decisions")
  assert_false(cold_retrieval$can_apply, "Cold-start memory diagnostics cannot schedule")
  assert_false(no_intervention$can_apply, "No data is not an actionable recommendation")
}
missing_manifest <- run_pipeline_fixture(pipeline_csv, pipeline_output, "fixture-run-missing", file.path(pipeline_dir, "does-not-exist.json"))
assert_true(missing_manifest$exit != 0L, "An explicitly configured missing manifest fails visibly")
unlink(pipeline_dir, recursive = TRUE)
