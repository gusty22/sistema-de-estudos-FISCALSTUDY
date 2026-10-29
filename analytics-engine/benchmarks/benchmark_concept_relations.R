#!/usr/bin/env Rscript
# Reproducible scaling check; benchmark data is synthetic and never operational.
source("R/evidence_specialists.R")
make_relations <- function(n) data.frame(question_id = paste0("benchmark-q-", seq_len(n)), concept_id = "benchmark-c",
  relation_version = "1", source_id = "synthetic-benchmark", classification_status = "CONFIRMED",
  valid_from = "2026-01-01T00:00:00Z", valid_to = "2026-01-02T00:00:00Z", recorded_at = "2026-01-01T00:00:00Z", stringsAsFactors = FALSE)
for (n in c(5000L, 20000L, 50000L)) {
  relations <- make_relations(n)
  elapsed <- system.time(result <- validate_concept_relations(relations, "2026-10-28T12:00:00Z"))["elapsed"]
  if (sum(result$eligible) != n) stop("BENCHMARK_SEMANTIC_REGRESSION")
  cat(sprintf("relations=%d eligible=%d elapsed_seconds=%.3f algorithm=sorted_interval_sweep\n", n, sum(result$eligible), elapsed))
}
