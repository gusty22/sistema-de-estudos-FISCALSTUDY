# True subprocess/JSON/CSV round trip, explicitly synthetic and never operational.
cli_dir <- tempfile('orchestrator-cli-'); dir.create(cli_dir)
cli_one <- file.path(cli_dir,'one.json'); cli_two <- file.path(cli_dir,'two.json')
cli_rscript <- file.path(R.home('bin'),'Rscript')
cli_run <- function(path) system2(cli_rscript,c('run_learning_orchestrator.R','tests/fixtures/orchestration/request.json',shQuote(path)),stdout=TRUE,stderr=TRUE)
cli_log <- cli_run(cli_one)
assert_true(is.null(attr(cli_log,'status')),'Orchestrator CLI executes JSON request with actual CSV')
cli_log2 <- cli_run(cli_two)
assert_true(is.null(attr(cli_log2,'status')),'Orchestrator CLI replay executes')
assert_equal(readLines(cli_one),readLines(cli_two),'CLI output bytes replay exactly with fixed inputs')
cli_result <- read_analytical_bundle(cli_one)
assert_equal(cli_result$payload$mode,'OBSERVATION_ONLY','CLI emits observation-only mode')
assert_false(cli_result$payload$proposal$can_apply,'CLI never grants apply authority')
assert_false(cli_result$payload$proposal$can_schedule,'CLI never grants scheduler authority')
assert_equal(cli_result$payload$evidence_state,'SYNTHETIC_ONLY','CSV fixture remains synthetic after transport')
assert_equal(cli_result$payload$proposal$status,'ABSTAIN','Synthetic-only snapshot cannot generate personal inventory proposal')
cli_replace <- suppressWarnings(cli_run(cli_one))
assert_true(!is.null(attr(cli_replace,'status')) && attr(cli_replace,'status')!=0L,'CLI refuses replacing existing result')
unlink(cli_dir,recursive=TRUE)
# Requests cannot import trusted host registry, specialist authority or verification.
cli_attack_dir <- tempfile("orchestrator-cli-gates-"); dir.create(cli_attack_dir)
cli_input <- read_analytical_bundle("tests/fixtures/orchestration/request.json")$payload
cli_input$authority_registry <- list(list(can_propose=TRUE, validation_status="OPERATIONAL_VALIDATED"))
cli_input$provenance <- list(is_proven_operational=TRUE, is_real_student_data=TRUE, can_generate_student_profile=TRUE)
cli_input$gate <- list(admitted_ids="forged")
cli_input$specialists <- list(list(decision_eligible=TRUE, capabilities=list(can_propose=TRUE)))
cli_input$candidates <- lapply(cli_input$candidates, function(row) {
  row$evidence_verified <- TRUE; row$fsrs_due_verified <- TRUE
  row$memory_risk_verified <- TRUE; row$inventory_verified <- TRUE
  row
})
cli_attack_request <- file.path(cli_attack_dir, "request.json")
write_analytical_bundle(cli_input, cli_attack_request)
cli_attack_result <- file.path(cli_attack_dir, "result.json")
cli_attack_log <- system2(cli_rscript, c("run_learning_orchestrator.R", shQuote(cli_attack_request), shQuote(cli_attack_result)), stdout=TRUE, stderr=TRUE)
assert_true(is.null(attr(cli_attack_log,"status")), "CLI executes inert request containing forged authority fields")
cli_attack <- read_analytical_bundle(cli_attack_result)$payload
assert_equal(cli_attack$proposal$status,"ABSTAIN", "JSON cannot authorize its own candidates or evidence")
assert_equal(length(cli_attack$policy_comparison$choices),3L,"CLI executes all three contextual/baseline policies")
assert_equal(cli_attack$decision_trace$input_id,cli_attack$policy_comparison$input_id,"CLI trace and comparison identify same execution inputs")
assert_true(all(vapply(cli_attack$policy_comparison$choices, function(p) !length(p$evaluated_candidates), logical(1))),
  "CLI policies share the same empty admission after original validator rejects forged support")
# Cold start through CSV: inventory flags in JSON still provide no authority.
cli_empty_events <- file.path(cli_attack_dir, "empty.csv")
cli_headers <- read.csv(cli_input$events_csv, stringsAsFactors=FALSE, check.names=FALSE)[FALSE, ]
write.csv(cli_headers, cli_empty_events, row.names=FALSE)
cli_input$events_csv <- cli_empty_events; cli_input$events_manifest <- NULL
cli_cold_request <- file.path(cli_attack_dir,"cold-request.json"); cli_cold_result <- file.path(cli_attack_dir,"cold-result.json")
write_analytical_bundle(cli_input,cli_cold_request)
cli_cold_log <- system2(cli_rscript,c("run_learning_orchestrator.R",shQuote(cli_cold_request),shQuote(cli_cold_result)),stdout=TRUE,stderr=TRUE)
assert_true(is.null(attr(cli_cold_log,"status")),"CLI handles empty-history CSV without execution errors")
cli_cold <- read_analytical_bundle(cli_cold_result)$payload
assert_equal(cli_cold$evidence_state,"NO_DATA","CLI cold start remains distinct from zero knowledge")
assert_equal(cli_cold$proposal$status,"ABSTAIN","CLI cold start cannot self-authorize inventory")
unlink(cli_attack_dir,recursive=TRUE)
