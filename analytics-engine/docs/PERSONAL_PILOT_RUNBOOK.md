# Ordinary-question observational pilot — workflow v2
Status: NOT_PERSONALLY_EXECUTED. This is separate from protected novel/delayed assessments.
Software readiness: existing Java→SQLite→R and browser flow plus new local evaluator tested synthetically in CI; this does not validate the actual personal installation.
No diagnostic reserve creation, intervention randomization, FSRS override or automatic planner policy is enabled.

## Before collecting
- Use the personal local installation deliberately, bound to127.0.0.1. Current application.yml declares REAL_STUDY; confirm effective runtime configuration. Never relabel an isolated/test profile as personal evidence.
- Keep a private directory outside the Git repository/cloud sharing. Set owner-only ACLs on Windows; chmod in the CLI is not a Windows ACL or encryption guarantee.
- Read lab/PERSONAL_PILOT_PROTOCOL.json v2 BEFORE inspecting results. No hyperparameter selection from final outcomes.
- Current model PERSONAL_BETA11_PREFIX_V1 IS the online Beta11 reference. Main alternative is the fixed last20eligible Beta11 reference. Report identical predictions as ties.
- Scoring remains prospective-evaluation-v1 with scoring protocol v1; v2 versions this operational workflow, not a new predictive model.

## Start / stop
Start by opening the normal question session yourself. Wait for server-confirmed preparation before answering; do not bypass error/pending states. Report help honestly. Confidence timing is not proven as a metacognitive probability.
Stop through the normal end-session flow; resolve pending retries without clearing local journals/history. Do not delete events to obtain a cleaner dataset.
This task does not start or enroll a real personal study session automatically.

## Export / evaluate locally
Use the existing loopback GET /api/v1/learning-lab/prospective-export with X-FiscalStudy-Admin-Token. Keep the token in a local environment variable, never in Git, a report, screenshot or CLI argument. Choose a NEW export file and private report directory.
PowerShell example (operator-run; not executed against personal data):
~~~powershell
$pilotExport = 'C:\PrivateFiscalStudy\export-001.json'
if (Test-Path -LiteralPath $pilotExport) { throw 'Choose a new export file' }
$pilotHeaders = @{ 'X-FiscalStudy-Admin-Token' = $env:FISCALSTUDY_ADMIN_TOKEN }
Invoke-WebRequest -Uri 'http://127.0.0.1:8080/api/v1/learning-lab/prospective-export' -Headers $pilotHeaders -OutFile $pilotExport
python analytics-engine/lab/personal_pilot.py --input $pilotExport --output 'C:\PrivateFiscalStudy\run-001'
~~~
The CLI opens only the exported JSON and local R process, not SQLite or a remote service. Existing output directories are refused. Rscript4.5.1 plus existing jsonlite/digest required; no dependencies installed by the CLI.
32MiB export/120second execution limits are local tool policies. Missing dependencies, incomplete reports, authority/hash mismatches or process failure produce FAILED, not a false success.
Output includes immutable input copy, metrics.json, private R log and manifest with source/input/code hashes. POSIX directory0700/files0600; Windows owner-only ACL remains operator responsibility.
Do not publish these artifacts. CI runs only explicitly labeled SYNTHETIC_FIXTURE with --synthetic-test; that flag cannot relabel personal/unknown input.

## Interpretation
Evaluation covers all frozen forecasts in the snapshot, not a selected delayed/novel holdout cohort. Historical eligible prefix is used only as recorded before each forecast.
Primary target is no-declared-help question correctness. Memory recall, same-item familiarity, conceptual application and transfer are not inferred.
Report Brier/log loss, paired BSS/bias/calibration, ROC/AP when identifiable, pending/exclusion coverage and question/session counts. Those counts are not independent experimental units.
The scorecard abstains from dependence-aware superiority inference; no binomial interval is a calibrated parameter interval.
Response delay is NOT a retention horizon. First recorded attempt is NOT proven cognitive novelty.
No efficacy/causal/personal-superiority claim until a separate valid design and authentic future observations support it. This pipeline is capable of reporting failure or insufficient evidence.

## Before diagnostic/late assessment
Complete cache/background access gates, source membership and revalidation, reviewed fiscal items and a separate versioned target/horizon/intermediate-exposure contract.
Do not use these ordinary outcomes to tune a model and then call them an untouched final test.

## Scientific decision extension — prepared, not started

`PERSONAL_PILOT_PROTOCOL.json` now includes an additive `decision_scientific_extension`
with contract `scientific-decision-evaluation-v1`, status `NOT_STARTED`. The existing
ordinary-question v2 collection/scoring workflow above is unchanged. Its immediate
correctness observations must not be relabeled delayed retrieval, application or transfer.

The new R sidecar can evaluate committed forecasts and recorded executions after a
future trusted exporter provides the required contact, instrument, timing and custody
evidence. This change does not implement that exporter, reservations or a Core App UI,
and does not assert those fields are already collected on the personal installation.
No manual flashcard creation or manual review management is a prerequisite.

See [target definitions, metrics, source requirements and limitations](SCIENTIFIC_DECISION_EVALUATION_V1.md).
Before any real pilot, choose the independent assessments, observation windows and
precision/stopping plan explicitly; keep personal artifacts private. Observational
pre/post changes do not establish a causal policy benefit. No experiment was started.
