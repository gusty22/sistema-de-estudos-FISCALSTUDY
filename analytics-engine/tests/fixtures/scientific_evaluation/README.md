# Scientific evaluation software fixtures

SYNTHETIC_CONTRACT_ONLY. No personal study history, empirical policy superiority or
causal benefit is represented. All six target results and the one pre/post change are
constructed contract cases. Source/model/policy identities are explicit fixture IDs.

From analytics-engine, with the existing R dependencies:

```sh
Rscript tests/fixtures/scientific_evaluation/reproduce.R NEW-input.json NEW-report.json
Rscript lab/run_decision_evaluation.R NEW-input.json NEW-replay.json
cmp NEW-report.json NEW-replay.json
cmp NEW-input.json tests/fixtures/scientific_evaluation/expected-input.json
cmp NEW-report.json tests/fixtures/scientific_evaluation/expected-report.json
```

Existing files are never overwritten. Replay was checked with R 4.6.1 and 4.5.0.
The example includes target definitions, temporal history, frozen forecasts, actual
orchestrator inputs/result, recorded execution and linked independent followup.
The other two policies have choices but zero executed followup credit.

`tests/test_scientific_decision_evaluation.R` exercises corruption, time leakage,
metadata availability, assistance/exposure, unknown fields, baseline pairing,
policy replay, physical attempt uniqueness and observation/causality separation.
Definitions and full results: [scientific contract](../../../docs/SCIENTIFIC_DECISION_EVALUATION_V1.md).
