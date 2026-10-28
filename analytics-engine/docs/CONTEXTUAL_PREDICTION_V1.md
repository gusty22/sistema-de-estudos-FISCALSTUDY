# Contextual correctness prediction v1 — bounded experiment
Base: main 8e96cadcc42b01ffc903b307de2e03b8a2f7bf48, PR39 merged. PR40 draft.
Scope: R/lab and scientific execution only; no product, FSRS, SQLite, frontend or scheduling changes.

## Focused audit
| Component | Target / prediction information | Status / limitation |
|---|---|---|
| R/baselines.R | Historical, moving and smoothed topic estimates fitted to supplied rows; separate temporal helper batches strictly earlier timestamps | Full-sample estimates are descriptive, not frozen prospective forecasts; retain existing semantics |
| R/evaluate_operational.R | In-period descriptive confidence/baseline comparison plus separate temporal backtest | No predictive superiority inferred from in-sample comparison; ordinal confidence mapping unvalidated |
| R/retention_analysis.R | In-sample exploratory logistic association with lag | Not a second operational forgetting curve; FSRS_REQUIRED / can_schedule=false preserved |
| R/learning_profile.R | Observed performance, repetition and provisional evidence counts | No latent conceptual mastery or personality inference |
| R/retrieval_diagnostics.R | Recorded pre-update FSRS prediction vs later observed retrieval | Version/provenance requirements, descriptive surprise, no causal error diagnosis |
| R/recommendation_evaluation.R | Verified intervention/follow-up observations | Temporal association not causal efficacy |
| lab/individual_calibration.R, human_memory_adapter.R | Experimental shift of official retrieval probabilities | Previous synthetic/human protocols retained; not used for correctness experiment |
| lab/prospective_evaluation.R, prospective_scorecard.R, personal_pilot.py | Actual committed Beta11 forecasts and same-prefix recent20 reference | Genuine precommit, distinct from this retrospective ordinal reconstruction; not changed |
| lab/assistments_adapter.R | Expanding personal historical, skill-set smoothing and moving5 | Existing experiment reproduced without replacing or reinterpreting its results |

## Contract and hypotheses fixed before execution
Target: ASSISTments corrected first-attempt correctness, where help counts as failure. Not pure memory recall.
Source: existing acquisition checks official free-use declaration, corrected CSV SHA256 and retains raw license evidence locally; no raw redistribution.
Selection: existing twelve midpoint-ranked history-length strata, 50–500 logical events, full selected histories.
Order: source order_id ONLY. No invented timestamps, durations, sessions, FSRS state or retention horizon.
Classification: transported official skill annotation on each event; no catalogue retroactive join, no timestamp proof of original annotation availability, no semantic equivalence guarantee.
Split: last 20% of each complete selected history scored as FINAL_TEMPORAL; prior rows development-exposed. All predictions then outcome updates; earlier test outcomes can train subsequent forecasts as in normal prequential evaluation.
Public sample already examined by project. This is exploratory replication, NOT an untouched confirmation set or personal validation.
No hyperparameter selection from evaluation outcomes.

Models share exactly the same eligible prefix and available event context:
- Beta(1,1) online personal reference.
- Last20 eligible Beta(1,1) reference.
- Skill-set mean shrunk to current personal mean with fixed weight20 (technical regularizer, not psychological property).
- Online logistic: intercept, bounded personal/recent/content prefix probabilities and bounded log exposure count. Fixed learning rate0.05 and ridge0.01, all coefficients initially0, update only after prediction/outcome.
Parameters, prefix count/cutoff and context model coefficient snapshots are saved with predictions; hashes bind source/code.
Cold start produces conservative experimental predictions, not claims of sufficient individual evidence.
Unknown skill falls back to personal prefix. No population-calibrated item difficulty, prerequisites or unavailable context invented.
No ensemble, neural model, semantic classifier or new forgetting equation.

## Metrics and interpretation
Same-event Brier, log loss, BSS, mean differences, bias/reliability, tie-aware discrimination, high-confidence errors, descriptive content/first-observed/repeated strata.
Candidate compared against Beta11, content and recent20. Skill mean compared against Beta11.
Per-student harm and equal-student paired differences; 2000 fixed-seed student-cluster bootstrap replicates.
Intervals conditional on fitted trajectories and selected histories. They do not establish population representativeness or personal temporal uncertainty.
One-student uncertainty remains NOT_ESTIMATED; no independent-trial CI manufactured.
Calibration slope/intercept descriptive only; convergence/warnings/degenerate outcomes fail closed to insufficient evidence.
Coverage is eligible target coverage, not full raw-source coverage. Source adapter QA preserves exclusions.
All verdicts remain INCONCLUSIVE pending independent future evaluation. No automatic promotion or causal efficacy.
Actual precommitted personal predictions are NOT retroactively replaced by these candidate forecasts.

## Execution
From analytics-engine:
- Rscript tests/test_runner.R
- Rscript lab/test_contextual_prequential.R
- python lab/contextual_experiment.py --download --output lab/runs/NEW_RUN
- python lab/contextual_experiment.py --source-run lab/runs/NEW_RUN/reference --output lab/runs/NEW_REPLAY
- Compare results.json and summary.json byte-for-byte.

Raw records/predictions stay in ignored local run directories. Only sanitized aggregate summary/criteria/hash manifest may be published.
Source availability/integrity failure is FAILED, not skipped or fabricated success.
No new package required; existing jsonlite/digest and Base R. Runtime R4.5.1.
Software tests: future outcomes, row permutation, ineligible insertion, later classification, duplicate/ambiguous order, invalid outcomes, short/empty history, numerical endpoints, degenerate AUC, pairing and RNG/replay.
Initial CI exposed numeric-vs-integer ordinal representation changing output types after an ineligible fixture insertion. Canonical order now normalized to numeric before processing; the strict invariant assertion is preserved.
Local file materialization blocked by full disk; remote isolated CI is execution evidence. No local data deleted.

## State and next boundary
IMPLEMENTED: prefix-only correctness candidate and experiment.
Technical tests/human results: see PR40 exact-HEAD CI and subsequent recorded result checkpoint.
NOT established: personal calibration, human fiscal-domain benefit, conceptual mastery, retention, transfer or pedagogical causality.
can_apply=false / can_schedule=false. No model receives operational authority.
Rollback: revert this lab-only increment; original adapters/results and operational behavior unchanged.
Next experiment should use genuinely new human histories or prospective private exports, not tune repeatedly on this exposed sample.
