# Individual learning orchestration v1

## Scope and initial state

Base inspected: main `930141fe54bf9ac99643442cec1f666e59c94260` (28 October 2026).
Existing profile, provenance, FSRS surprise, intervention, prospective-ledger and
prequential laboratory modules remain intact. This increment adds a local R
observation-only decision boundary, not a server or a replacement scheduler.
Graphify CLI was unavailable; bounded path/symbol searches were used instead.
Historical CONTEXT.md statements about exponential canonical mastery and frozen
main hashes are superseded by the inspected code/current HEAD, not silently reused.

## Data and responsibilities

`R/evidence_specialists.R` reuses `select_evaluable_attempts` and produces six
separate descriptive responsibilities: knowledge, application, transfer, item
memory context, ordinal metacognition and execution. Missing dimensions remain
NOT_ESTABLISHED; task correctness never becomes latent mastery. No new predictive
model, intervention effect, approval probability or forgetting equation is fitted.

Independent evidence requires explicit `assistance_status=NONE` and
`answer_exposed=FALSE`. Missing fields do not establish independence. Specific
COMPREHENSION/APPLICATION/TRANSFER instruments require `assessment_verification=VERIFIED`;
transfer additionally requires `task_relation=INDEPENDENT_CONTEXT_VERIFIED` and an
item not previously attempted in recorded history. Verification labels are source
assertions, not proof that the system independently verified them.

Concept relations are many-to-many assertions with `question_id`, `concept_id`,
`relation_version`, `source_id`, `classification_status`, `valid_from`, `recorded_at`,
and optional `valid_to`. Only CONFIRMED assertions available at the attempt time
can associate observations. AI_PROPOSED, missing dates, overlapping confirmed
versions and composite-item attribution cannot manufacture concept success.
No prerequisite mastery is propagated. The complete contest/discipline/topic
ontology and review UI remain future adapters, not duplicated graphs here.

Execution observations distinguish nine error categories, preserve the reported
category/source and keep self-reports UNVERIFIED_REPORT. High confidence, short
latency and high FSRS retrieval never prove a psychological or cognitive cause.

## Common contract and authority

`build_specialist_result` defines versioned identity, student/scope/target,
horizon, cutoff, source/evidence IDs, result/unit, uncertainty, limitations,
validation/model/policy/run versions and separate capabilities. The validator
recomputes capabilities; imported `can_apply`, `can_schedule` and decision flags
cannot authorize a model. Unknown versions, invalid numeric results, contradictory
counts and evidence after either cutoff block support.

Authority is a trusted local configuration, never an authority registry imported
from a JSON request. Experimental models can be described/evaluated in shadow
mode; they cannot win operational authority by reporting greater confidence.
The built-in inventory policy is configured, not learned. Memory estimates cannot
support conceptual claims. Comparable conflicting results are recorded; unresolved
conflicts abstain, never average incompatible probabilities.

## Flow and policy

`orchestrate_learning` validates the immutable evidence registry, executes the
descriptive specialists when raw attempt fields are available, checks specialist
contracts, records conflicts, admits available inventory candidates, ranks them,
and returns an unapplied proposal plus future outcome association record.
No source event is rewritten. Reordered identical inputs replay deterministically.

Admission precedes ranking: exact contest, confirmed syllabus membership, material
availability, positive time cost within budget, satisfied/not-applicable
prerequisites, low reversible risk and target-compatible authorized support.
REVIEW_ITEM additionally requires official operational memory/due evidence; the
built-in policy cannot invent a review date or compete with FSRS. Stock is supplied
by the caller; no nonexistent questions/materials are generated.

Configured lexicographic order is maintenance due, diagnosis, new content, deeper
application, then shorter duration and lexical candidate ID. This is an explicit
operational preference, not measured expected learning gain. Baseline is the
shortest admissible candidate. Disagreement does not establish either policy's
superiority. Candidate costs, relevance and syllabus declarations require a future
Core App inventory adapter; no empirical benefit coefficients are invented.

Output includes evidence profile, checked specialists, conflicts, admitted/rejected
candidates with reasons, preferred candidate or ABSTAIN, baseline comparison,
uncertainty and a PENDING evaluation record. Every proposal is NOT_AUTHORIZED,
can_apply=false and can_schedule=false. High-impact actions are rejected for
confirmation; this batch routine never requests or performs their application.

## Portable import/export and execution

`R/analytical_portability.R` provides inert `analytical-bundle-v1` JSON transport,
exclusive-create output, bounded input and an external-assessment contract. External
records preserve source/model/version (UNKNOWN permitted explicitly), UTC timestamp,
question/response, criteria, assistance and verifiability. Imported text is not
executed; external results remain CONTEXT_ONLY and cannot update FSRS or mastery.
Duplicate IDs, same-day future timestamps, malformed contracts and authority claims
are audited/rejected. Checksums prove byte integrity, not authorship or truth.

`evaluate_learning_proposal` links a later observed event to a proposal/run without
mutating the original record. The result is descriptive follow-up, not causal
efficacy, and requires a separate provenance audit. Operational append-only storage
and deduplication remain the existing event store's responsibility.

From `analytics-engine`, with R 4.5.1+, jsonlite and digest:

```sh
Rscript tests/test_runner.R
Rscript lab/test_contextual_prequential.R
python -m unittest discover -s lab -p 'test_*.py'
Rscript run_learning_orchestrator.R tests/fixtures/orchestration/request.json /tmp/new-orchestrator-result.json
```

The fixture deliberately returns SYNTHETIC_ONLY and abstains from personal policy.
Reusing the output path fails rather than replacing a prior analytical artifact.
Real requests use the same envelope with an actual exported CSV plus the existing
operational SHA-256 manifest/provenance declaration. The CLI recomputes audit from
CSV bytes; it ignores embedded authority/provenance flags. Imported assessments are
kept separate from observed event rows. Raw personal exports/results must not be
committed. Unit fixtures exercise actual candidate selection under isolated trusted
configuration without presenting synthetic data as personal learning.

## Scientific limits and deferred work

No personal dataset was collected or experiment started. The existing prospective
ledger, temporal baselines, Brier/log loss/calibration and human laboratories remain
the evaluation infrastructure; software tests do not validate pedagogy. Future
credible personalization needs authentic timestamped pre-answer forecasts, honest
assistance/exposure, reviewed conceptual instruments, delayed/independent assessments,
paired prospective policy outcomes and enough variation to identify the target.

Existing N-of-1 specification is a design proposal, not automatic experimental
permission or evidence. Its minimum pairs/p-value rules do not establish efficacy by
themselves; randomization must match the actual assignment, serial dependence and
carryover require design-specific handling, confidence ordinal scores are not
validated probability calibration, and first recorded items do not prove novelty.
No automatic trial, new model promotion, parameter optimization, causal estimator,
frontend, Java adapter, DB migration or scheduling change is included.

FSRS reference review and concrete legacy divergences are in
`ORCHESTRATOR_REFERENCE_REVIEW.md`. In particular, the Java aggregator's exponential
retrieval projection is not consumed as canonical FSRS evidence. Correcting that
separate Java projection needs its own conformance/integration gate; no Java code
was changed or Java suite claimed here. Personal optimization remains unintegrated,
with reference parameters preserved until appropriate history and validation exist.
