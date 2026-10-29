#!/usr/bin/env Rscript
# Run from analytics-engine. Synthetic contract example; never personal history.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2L || !args[2] %in% c("cold", "insufficient_inventory", "memory", "gap", "transfer", "execution", "time", "unknown"))
  stop("Usage: Rscript tests/fixtures/contextual_gate/reproduce.R NEW-artifact.json scenario")
source("R/learning_orchestrator.R")
source("R/analytical_portability.R")
source("tests/fixtures/contextual_gate/scenarios.R")
result <- run_contextual_gate_fixture(contextual_gate_fixture(args[2]))
result$fixture_notice <- "SYNTHETIC_FIXTURE_CONTRACT_TEST_ONLY_NOT_PERSONAL_HISTORY_OR_OPERATIONAL_AUTHORITY"
write_analytical_bundle(result, args[1])
