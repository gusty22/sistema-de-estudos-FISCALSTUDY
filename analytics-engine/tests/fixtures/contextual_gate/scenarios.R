# SYNTHETIC_FIXTURE ONLY. Host authority below simulates a trusted adapter in tests;
# it is never imported by the production CLI or installed as operational policy.
contextual_gate_fixture <- function(scenario = "memory") {
  snapshot <- list(student_id = "SYNTHETIC-gate-student", run_id = "SYNTHETIC-gate-run",
    cutoff = "2026-10-28T12:00:00Z", fixture_notice = "SYNTHETIC_CONTRACT_TEST_ONLY")
  ids <- c("memory", "gap", "transfer", "execution", "curriculum")
  needs <- c("MEMORY_MAINTENANCE", "OBSERVED_CONCEPTUAL_GAP", "TRANSFER_ASSESSMENT", "EXAM_EXECUTION_ERROR", "UNKNOWN")
  targets <- c("ITEM_MEMORY", "KNOWLEDGE_OBSERVATIONS", "APPLICATION_OBSERVATIONS", "KNOWLEDGE_OBSERVATIONS", "KNOWLEDGE_OBSERVATIONS")
  snapshot$evidence <- data.frame(event_id = paste0("event-", ids), source_id = paste0("source-", ids),
    scope_id = ids, evidence_type = needs, evidence_version = "fixture-evidence-v1",
    occurred_at = "2026-10-28T10:00:00Z", valid_until = "2026-10-29T12:00:00Z", origin = "SYNTHETIC_FIXTURE")
  candidates <- data.frame(candidate_id = ids, activity_type = c("REVIEW_ITEM", "DIAGNOSE_CONCEPT", "DEEPEN_APPLICATION", "DIAGNOSE_CONCEPT", "LEARN_NEW"),
    scope_id = ids, contest_id = "fixture-contest", priority = c("MAINTENANCE_DUE", "DIAGNOSTIC_GAP", "DEEPEN", "DIAGNOSTIC_GAP", "NEW_CONTENT"),
    estimated_minutes = c(10, 8, 12, 7, 15), material_available = TRUE, in_syllabus = TRUE,
    prerequisites_status = "SATISFIED", risk = "LOW_REVERSIBLE", support_specialist_id = paste0("specialist-", ids))
  specialists <- lapply(seq_along(ids), function(i) build_specialist_result(paste0("specialist-", ids[i]),
    "SYNTHETIC contract scenario", targets[i], snapshot$student_id, ids[i], snapshot$cutoff,
    paste0("event-", ids[i]), result = list(need_type = if (scenario == ids[i]) needs[i] else "UNKNOWN", due = TRUE, memory_risk = TRUE),
    model_version = "fixture-model-v1", validation_status = "CONFIGURED_POLICY",
    source_ids = paste0("source-", ids[i]), run_id = snapshot$run_id))
  registry <- lapply(seq_along(ids), function(i) list(specialist_id = paste0("specialist-", ids[i]),
    model_version = "fixture-model-v1", target = targets[i], unit = "NOT_APPLICABLE", horizon = "NOT_APPLICABLE",
    validation_status = "CONFIGURED_POLICY", epistemic_type = "OBSERVATION", can_propose = TRUE,
    evidence_versions = "fixture-evidence-v1", scope_id = ids[i], source_ids = paste0("source-", ids[i]), evidence_types = needs[i],
    valid_from = "2026-01-01T00:00:00Z", valid_until = "2026-12-31T00:00:00Z"))
  context <- list(contest_id = "fixture-contest", available_minutes = 30)
  if (scenario == "cold") {
    snapshot$evidence <- snapshot$evidence[FALSE, ]; specialists <- list()
    candidates <- candidates[c(2, 5), ]; candidates$inventory_id <- paste0("inventory-", candidates$candidate_id)
    candidates$inventory_version <- "fixture-inventory-v1"; candidates$curriculum_source_id <- "fixture-edital"
    registry <- lapply(seq_len(nrow(candidates)), function(i) c(as.list(candidates[i,
      c("inventory_id", "inventory_version", "curriculum_source_id", "scope_id", "contest_id", "activity_type", "material_available", "in_syllabus", "prerequisites_status", "estimated_minutes", "risk")]),
      list(target = "CURRICULUM_INVENTORY", validation_status = "CONFIGURED_POLICY", can_propose = TRUE,
        valid_from = "2026-01-01T00:00:00Z", valid_until = "2026-12-31T00:00:00Z")))
  }
  if (scenario == "insufficient_inventory") candidates <- candidates[FALSE, ]
  if (scenario == "time") context$available_minutes <- 2
  list(snapshot = snapshot, context = context, specialists = specialists, candidates = candidates, authority_registry = registry)
}
run_contextual_gate_fixture <- function(x) do.call(orchestrate_learning, x)
