source("R/learning_orchestrator.R")
source("tests/fixtures/contextual_gate/scenarios.R")
gate_error <- function(expr) inherits(try(force(expr), silent = TRUE), "try-error")
for (scenario in c("cold", "insufficient_inventory", "memory", "gap", "transfer", "execution", "time", "unknown")) {
  x <- contextual_gate_fixture(scenario); result <- run_contextual_gate_fixture(x)
  expected <- switch(scenario, cold = "curriculum", insufficient_inventory = NULL, time = NULL, unknown = "curriculum", scenario)
  assert_equal(result$proposal$candidate_id, expected, paste("Real orchestrator scenario:", scenario))
  assert_equal(result$decision_policy$status, "EXPERIMENTAL", "Contextual policy remains experimental")
  assert_false(result$proposal$can_apply, "Synthetic integrated proposal has no apply authority")
  assert_false(result$proposal$can_schedule, "Synthetic integrated proposal has no scheduling authority")
  assert_false(result$proposal$personal_inference, "Synthetic integrated evidence never becomes personal history")
  admitted <- sort(vapply(result$admissible_candidates, function(c) c$candidate_id, character(1)), method = "radix")
  for (choice in result$policy_comparison$choices) assert_equal(choice$evaluated_candidates, admitted,
    "All three policies execute over identical original admission")
  assert_equal(result$proposal$executed_rules, result$decision_trace$comparison$choices$EVIDENCE_CONTEXTUAL_V1$executed_rules,
    "Trace contains rules emitted by executed policy")
  assert_equal(result, run_contextual_gate_fixture(x), "Integrated result deterministically replays")
  if (scenario %in% c("memory", "gap", "transfer", "execution")) {
    refs <- result$proposal$determining_evidence
    assert_equal(refs[[1]]$event_id, paste0("event-", scenario), "Selected contextual need cites actual determining event")
    assert_true(any(vapply(result$pedagogical_needs, function(n) paste0("event-", scenario) %in% n$evidence_ids, logical(1))),
      "Pedagogical need and choice refer to the same validated evidence")
  }
}
x <- contextual_gate_fixture("memory"); original <- run_contextual_gate_fixture(x)
# Missing optional candidate flags must have no effect and no zero-length ranks.
for (field in c("evidence_verified", "fsrs_due_verified", "memory_risk_verified", "inventory_verified")) {
  y <- x; y$candidates[[field]] <- rep(TRUE, nrow(y$candidates))
  assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "memory", "Declared flags do not replace validated evidence")
  y$candidates[[field]] <- rep(NA, nrow(y$candidates))
  assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "memory", "Unknown flag cannot remove real validated evidence")
  y$candidates[[field]] <- rep("true", nrow(y$candidates))
  assert_equal(run_contextual_gate_fixture(y)$proposal$status, "ABSTAIN", "String boolean fails original candidate admission")
}
for (field in c("source_id", "scope_id", "evidence_type", "evidence_version", "valid_until")) {
  y <- x; y$snapshot$evidence[[field]][1] <- if (field == "valid_until") "2026-01-01T00:00:00Z" else "wrong"
  changed <- run_contextual_gate_fixture(y)
  assert_equal(changed$proposal$candidate_id, "curriculum", paste("Unbound memory evidence falls back conservatively:", field))
  assert_true(!length(changed$proposal$determining_evidence), "Unknown memory claim receives no determining-evidence credit")
}
y <- x; y$specialists[[1]]$result$memory_risk <- NULL
assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "curriculum", "Absent specialist memory risk remains unknown")
y <- x; y$specialists[[1]]$result$due <- "TRUE"
assert_true("INVALID_RESULT_BOOLEAN_DUE" %in% run_contextual_gate_fixture(y)$specialists[[4]]$blocking_codes ||
  any(vapply(run_contextual_gate_fixture(y)$specialists, function(s) "INVALID_RESULT_BOOLEAN_DUE" %in% s$blocking_codes, logical(1))), "Specialist boolean cannot be a string")
y <- x; y$specialists[[1]]$run_id <- "another-run"
assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "curriculum", "Cross-run specialist cannot authorize contextual evidence")
y <- x; y$authority_registry[[1]]$source_ids <- "other-source"
assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "curriculum", "Source authorization is independent of source declaration")
y <- x; y$authority_registry[[1]]$can_propose <- FALSE
assert_true("memory" %in% vapply(run_contextual_gate_fixture(y)$rejected_candidates, function(r) r$candidate_id, character(1)), "Original authority validator still rejects unauthorized support")
y <- x; y$candidates$evidence_verified <- TRUE; y$candidates$fsrs_due_verified <- TRUE; y$candidates$memory_risk_verified <- TRUE
y$specialists[[1]]$result$memory_risk <- FALSE
assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "curriculum", "Input flags cannot override contradictory validated memory result")
y <- x; y$context$review_capacity_exceeded <- TRUE; y$context$review_capacity_verified <- TRUE
assert_equal(run_contextual_gate_fixture(y)$proposal$candidate_id, "memory", "Self-declared capacity cannot override verified memory")
y$context$review_capacity_verified <- "true"
assert_true(gate_error(run_contextual_gate_fixture(y)), "Context booleans are type-checked")
# Rehydrate just the immutable comparison inputs, without granting authority.
frame <- function(rows) if (length(rows)) do.call(rbind, lapply(rows, as.data.frame, stringsAsFactors = FALSE)) else data.frame()
inputs <- original$decision_inputs; input_candidates <- frame(inputs$candidates)
gate <- list(input_id = original$policy_comparison$input_id,
  admitted_ids = original$policy_comparison$admitted_ids,
  bindings = .pd_bindings(x$snapshot, x$candidates, original$specialists,
    original$policy_comparison$admitted_ids, x$authority_registry), rejections = original$rejected_candidates,
  inclusion_reasons = original$decision_trace$admission_reasons)
class(gate) <- "orchestrator_admission"
assert_equal(decision_trace(inputs$snapshot, input_candidates, inputs$context, original$policy_comparison, gate),
  original$decision_trace, "Trace reconstructs from recorded inputs and executed comparison")
other_snapshot <- inputs$snapshot; other_snapshot$run_id <- "other-run"
assert_true(gate_error(decision_trace(other_snapshot, input_candidates, inputs$context, original$policy_comparison, gate)), "Cross-run comparison rejected")
other_snapshot <- inputs$snapshot; other_snapshot$cutoff <- "2026-10-27T12:00:00Z"
assert_true(gate_error(decision_trace(other_snapshot, input_candidates, inputs$context, original$policy_comparison, gate)), "Different snapshot comparison rejected")
other_candidates <- input_candidates; other_candidates$estimated_minutes[1] <- 1
assert_true(gate_error(decision_trace(inputs$snapshot, other_candidates, inputs$context, original$policy_comparison, gate)), "Different candidate set comparison rejected")
other_comparison <- original$policy_comparison; other_comparison$choices$EVIDENCE_CONTEXTUAL_V1$candidate_id <- "gap"
assert_true(gate_error(decision_trace(inputs$snapshot, input_candidates, inputs$context, other_comparison, gate)), "Altered choice comparison rejected")
y <- x; y$candidates <- y$candidates[5:1, ]; y$snapshot$evidence <- y$snapshot$evidence[5:1, ]
assert_equal(original, run_contextual_gate_fixture(y), "Evidence and candidate permutation preserve complete artifact")
# Inert JSON preserves the immutable identity and supports trace reconstruction.
portable_dir <- tempfile("contextual-gate-"); dir.create(portable_dir)
portable_one <- file.path(portable_dir, "one.json"); portable_two <- file.path(portable_dir, "two.json")
portable_run <- function(path) system2(file.path(R.home("bin"), "Rscript"),
  c("tests/fixtures/contextual_gate/reproduce.R", shQuote(path), "memory"), stdout = TRUE, stderr = TRUE)
assert_true(is.null(attr(portable_run(portable_one), "status")), "Integrated example produces portable analytical bundle")
assert_true(is.null(attr(portable_run(portable_two), "status")), "Integrated example replays in independent R process")
assert_equal(readBin(portable_one, "raw", n = file.info(portable_one)$size),
  readBin(portable_two, "raw", n = file.info(portable_two)$size), "Independent integrated runs reproduce artifact bytes")
portable_result <- read_analytical_bundle(portable_one)$payload
portable_inputs <- portable_result$decision_inputs
assert_equal(.pd_identity(portable_inputs$snapshot, frame(portable_inputs$candidates), portable_inputs$context),
  portable_result$decision_trace$input_id, "JSON round trip preserves snapshot/candidate/context identity")
portable_trace <- decision_trace(portable_inputs$snapshot, frame(portable_inputs$candidates), portable_inputs$context,
  portable_result$policy_comparison, gate)
assert_equal(portable_trace$input_id, original$decision_trace$input_id, "Exported comparison reconstructs the decision trace")
assert_equal(portable_result$proposal$determining_evidence[[1]]$event_id, "event-memory", "Transport retains determining evidence reference")
assert_false(portable_result$proposal$can_apply, "Portable contextual artifact has no operational authority")
unlink(portable_dir, recursive = TRUE)
y <- contextual_gate_fixture("cold")
y$authority_registry <- list(); y$candidates$inventory_verified <- TRUE
assert_equal(run_contextual_gate_fixture(y)$proposal$status, "ABSTAIN", "Cold inventory flags cannot replace trusted catalogue record")
y <- contextual_gate_fixture("cold"); y$authority_registry[[1]]$valid_until <- "2026-01-01T00:00:00Z"; y$authority_registry[[2]]$material_available <- FALSE
assert_equal(run_contextual_gate_fixture(y)$proposal$status, "ABSTAIN", "Expired or contradictory catalogue records cannot support cold proposal")
y <- contextual_gate_fixture("memory"); y$candidates$evidence_need_type <- "invented-label"
assert_equal(run_contextual_gate_fixture(y)$proposal$status, "ABSTAIN", "Malformed optional need label is rejected")
assert_true(all(vapply(run_contextual_gate_fixture(contextual_gate_fixture("memory"))$specialists,
  function(s) !s$validation_status %in% "OPERATIONAL_VALIDATED" && !s$capabilities$can_apply && !s$capabilities$can_schedule, logical(1))),
  "New synthetic scenarios never claim operational model validation or execution authority")
# Serializing a provenance audit strips the in-process source binding. A JSON
# document cannot manufacture it by adding fields with the same name.
forged <- contextual_gate_fixture("unknown")
forged$snapshot$evidence$origin <- "REAL_STUDY"
forged$snapshot$evidence$question_id <- paste0("question-", seq_len(nrow(forged$snapshot$evidence)))
forged$snapshot$evidence$is_correct <- TRUE
forged$snapshot$provenance <- list(is_proven_operational = TRUE, is_real_student_data = TRUE,
  can_generate_student_profile = TRUE, orchestrator_evidence_id = .pd_identity(forged$snapshot$evidence, NULL, NULL))
forged$specialists <- list(); forged$authority_registry <- list()
forged$candidates$support_specialist_id <- "BUILTIN_INVENTORY_POLICY"
assert_false(run_contextual_gate_fixture(forged)$personal_source_verified, "JSON-shaped provenance flags cannot establish personal source authority")
assert_equal(run_contextual_gate_fixture(forged)$proposal$status, "ABSTAIN", "Self-declared audit cannot trigger built-in personal inventory authority")

forged_gate <- unclass(gate)
assert_true(gate_error(choose_contextual_policy(input_candidates, inputs$context,
  gate = forged_gate, snapshot = inputs$snapshot)), "JSON-shaped admission cannot authorize standalone policy")

assert_true("event-memory" %in% original$decision_trace$eligible_evidence &&
  !"memory" %in% original$decision_trace$eligible_evidence, "Compatible eligible_evidence references real evidence IDs, not candidate IDs")
y <- contextual_gate_fixture("cold")
y$authority_registry <- c(y$authority_registry, y$authority_registry)
assert_equal(run_contextual_gate_fixture(y)$proposal$status, "ABSTAIN", "Ambiguous active catalogue identities fail closed")

attr(forged$snapshot$provenance, "orchestrator_evidence_id") <- .pd_identity(forged$snapshot$evidence, NULL, NULL)
assert_false(run_contextual_gate_fixture(forged)$personal_source_verified, "A matching byte binding does not authenticate an operational source")
assert_equal(run_contextual_gate_fixture(forged)$proposal$status, "ABSTAIN", "Hash and production declarations cannot self-authorize personal proposals")
assert_false(any(run_contextual_gate_fixture(forged)$learner_evidence_profile$evidence_registry$personal_eligible),
  "Automatic descriptive specialists preserve unverified personal provenance")
