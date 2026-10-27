# Real-world validation — protocol v1 (registered before results)

## Scope and source audit

Base: main 525fb13186cf062a87060df887697ce5e69ebf65 after PR #32. This increment implements external retrospective recall validation. It does NOT validate the FiscalStudy user's personal model or execute a study policy. FSRS remains the operational memory authority.

The requested repository ankitects/fsrs-benchmark, commit f63af1caf6e658b390809583e00931e31776590a, is an older fork. Its README links an old dataset identifier, while download_data.py actually retrieves open-spaced-repetition/fsrs-dataset/v4. Our adapter pins dataset revision ae96575728d364265a75f2447fe7b7fa389ba96c and verifies its card's MIT declaration BEFORE data acquisition. License card and each upstream TSV SHA-256 are recorded; declared licensing is not proof that source data are error-free. Raw human records are not redistributed in the PR or CI artifacts.

FSRS source: https://huggingface.co/datasets/open-spaced-repetition/fsrs-dataset . Source schema: review_time (epoch milliseconds), card_id, i, delta_t, review_rating, y, t_history, r_history. Outcome is SELF-REPORTED RECALL: rating>1. Actual ratings 1..4 update official py-fsrs 6.3.2 AFTER prediction; never binary Good/Again substitution from the synthetic experiment. Same-day source filtering and missing original Anki actions limit transport validity. Source delta_t reflects the source preparation; horizons here use observed epoch differences in UTC, not an invented timezone or day boundary. t_history/r_history are not predictors.

Sample is fixed BEFORE outcome inspection: 12 midpoint size ranks among complete files in 50,000..1,000,000 bytes. Metadata inspection found 71 v4 files and 36 in this frame, totaling 5,217,827 bytes for selected files. This is a bounded size-stratified feasibility sample, NOT representative of excluded large collections or all Anki users. All rows of each selected file are acquired; cards without a consistent observed prefix are excluded with counts. No card state is reconstructed from a future response.

ASSISTments requested source:
https://sites.google.com/site/assistmentsdata/home/2009-2010-assistment-data/skill-builder-data-2009-2010
Parent documentation states "The dataset is free to use" and requests citation. This is not an SPDX license or a commercial redistribution grant. The corrected file is the official Drive resource 1NNXHFRxcArrU0ZJSb9BIL56vmUt5FhlE. Adapter is separate: chronological order_id is ordinal, not elapsed time; absent timestamps stay absent. correct=0 includes requesting help; current hint counts/attempt counts are post-target metadata, never predictors. Duplicate skill annotations collapse into one event; conflicting outcomes fail. Open-response items marked always correct are excluded. ASSISTments is NOT a recall dataset and is NOT passed to FSRS. Acquisition and execution status must be reported explicitly; fixtures are only technical tests.

## Prespecified evaluation

The human memory adapter reuses the PR32 pure fit_shift/cal_shift/cal_loss helpers, not its synthetic generator or its hidden truth. Per student, complete timestamp batches divide 60%/20%/20% into training/selection/final evaluation. Models and shrinkage are frozen before final evaluation. Official FSRS states and the personal Beta(1,1) baseline update prequentially from earlier events; all equal-time predictions precede any batch outcome update.

Global calibrator is fit on OTHER users only, with donor timestamps strictly before the target's training cutoff. This is leave-one-user-out calibration transfer with existing own-item FSRS history, NOT zero-shot prediction or a uniform population holdout. Shared donor models mean uncertainty is conditional on fitted models and overlapping folds. Unknown overlap between FSRS default pretraining and public contributors prevents a claim of uncontaminated pretraining generalization.

Personal intercepts use penalties {1,4,16}, selected by validation log loss only. Eligibility requires 30 training events, 20 training items and 10 timestamp batches; these are registered coverage policies, NOT empirically sufficient sample sizes. Failure produces explicit calibration abstention while raw/default and historical baselines remain evaluable. Coefficient uncertainty uses 100 item-cluster bootstrap draws from TRAIN only, conditional on the global fit and selected penalty. It does not capture all model-selection, donor, or inter-item dependence uncertainty.

Primary comparison: individual versus global on matched future events. Five or more paired students, equal model coverage, and both Brier and log-loss student-bootstrap upper bounds below zero are required for conditional improvement. Inconclusive outcomes must remain inconclusive. Also compare with online personal Beta(1,1) and raw FSRS; incomplete coverage never establishes full-population superiority.

Report Brier, log loss, BSS on exact event intersections, reliability bins, bias, ROC AUC, failure average precision (not trapezoidal PR AUC), horizons <1/1–7/7–30/30+ days, student/item/event denominators, macro and event-weighted results, calibration coverage/abstention, and histories harmed by personalization. Undefined AUC or BSS is absent with reason, not zero. No human true-probability RMSE or latent mastery is fabricated. Reliability Wilson intervals assume binomiality and are descriptive under within-card dependence.

## Isolation and reproducibility

From analytics-engine, in an isolated environment with the existing experimental requirements:

    python -m pip install -r lab/requirements-memory-lab.txt
    python -m unittest discover -s lab -p "test_human_learning.py" -v
    python lab/human_learning_experiment.py --download --output lab/runs/human-first

Source acquisition requires explicit --download. Output must be a NEW lab/runs directory, ignored by Git. It never writes to operational SQLite or the production analytics root. Schema, source byte limit, source SHA-256, snapshot SHA-256, chronology, event identity and target are validated. R receives no synthetic truth, user personality labels or production identity. Manifest records sources, parameters, code/package hashes, splits, coverage and model versions. can_apply and can_schedule are always false.

CI preserves aggregate results, source manifest and logs only; raw/per-event human records remain in the disposable runner. Reproducibility relies on pinned source files and hashes, not redistribution of raw data. Software fixtures do not count as real-human evidence.

## Personal lab and next stages

NOT_EXECUTED in this increment: the integrated frontend→Java→SQLite→R audit, isolated SQLite prospectively frozen predictions, personal intervention assignments, held-out novel question reservation, causal N-of-1 efficacy, and validated active selection by information gain. These require examining current operational contracts and a separate change, not invented public-data columns.

The first prospective personal experiment should freeze predictions and model versions before feedback, separately identify recall and novel-question outcomes, and reserve delayed evaluations before choosing a candidate intervention. Randomization/counterbalancing and delayed outcomes must be defined before observation; test-induced learning must be logged. No fixed universal session duration or personality classification is implied. An active-evidence candidate remains non-executable until its response model and measurement quality are validated.

## Execution status

Implementation prepared; new CI must execute the current revision. No human superiority or personal validation is claimed before results are recorded.


## Observed retrospective results (historical source commits, not personal validation)

FSRS first run: commit a009e9d, CI 40535216294. Twelve selected source collections contained 105,955 records and 23,794 cold-start records; 16,438 final events were evaluated per model. Individual calibration vs global had aggregate BSS 0.044003 and paired-student difference intervals Brier [-0.026047,-0.000193], log loss [-0.069491,-0.007517]. This conditional primary contrast improved, but four of twelve users had worse Brier. Against raw FSRS the Brier interval crossed zero. Against the online personal mean the log-loss difference was POSITIVE [0.037058,0.312681]: personalization did not establish superiority. These are selected, retrospective human records, not FiscalStudy personal data.

| Recall model | N | Brier | Log loss |
|---|---:|---:|---:|
| Raw FSRS defaults | 16438 | 0.119052 | 0.883565 |
| Global calibration | 16438 | 0.123745 | 0.577203 |
| Individual calibration | 16438 | 0.118299 | 0.547752 |
| Online personal Beta(1,1) | 16438 | 0.122574 | 0.398297 |

After observing the large log-loss contrast, a SECONDARY numerical-guard baseline was added: FSRS probability clipped to the same 1e-6 guard used by the calibrator, without a fitted shift. This distinguishes clipping effects from genuine calibration gains. It does not retune models or change the registered primary contrast; it must be evaluated by the subsequent CI and not retroactively described as preregistered.

ASSISTments corrected official file was actually acquired in commit 0f9d8cb, CI 40536145013: 64,412,812 bytes, SHA256 162ef8d2d28bcbfea6591a282994062bd8d5eaa00636544292a0d268dca6e5da. Selection before outcomes: twelve midpoint history-length strata in 50..500-event eligibility frame, complete selected histories. The adapter found 1,161 eligible students; 1,682 selected events, 1,562 evaluated after ten-event warmups. Source hint/attempt counts and answer text are not prediction features. Raw file is NOT redistributed.

| First-attempt/help target | N | Brier | Log loss |
|---|---:|---:|---:|
| Personal historical mean | 1562 | 0.211697 | 0.654515 |
| Smoothed skill-set baseline (existing R function) | 1562 | 0.203064 | 0.638261 |
| Moving last five | 1562 | 0.229168 | 2.253296 |

Skill-set BSS=0.040779 against personal mean, but both paired-student intervals crossed zero (Brier [-0.030040,0.003554], log loss [-0.063191,0.013884]); six of twelve students had worse Brier. Superiority is INCONCLUSIVE despite better aggregate scores. Moving-average extremes can cause poor log loss. No retention horizons are generated from ordinal order IDs.

The full historical aggregate summaries are archived in docs/results/public_human_reference_v1.json. The subsequent revision adds an independent R temporal-invariance test, explicit unverified origins in parsers, the guard comparator, raw data SHA freezing for ASSISTments and offline snapshot replay. Current-head CI must confirm these additions independently.

## Verified personal-data transport gaps on base 525fb13

This is code inspection, NOT integrated Spring/SQLite/browser homologation.

| Observation | Code evidence | Consequence / next test |
|---|---|---|
| Stable attempt UUID and idempotent append | backend/.../application/AttemptSubmissionService.java, submitAttempt, eventId attempt:UUID and appendEventOnce | Preserve identity across retries; retest with isolated DB before changing contract |
| FSRS preview before projection/update | Same service, preview(questionId) before append and project | Pre-update evidence exists; it is computed during answer submission, NOT an independently precommitted forecast before the student's response |
| Help, exposure count, prior outcome and intervention type recorded in payload | Same service fields usedHelp/helpType/exposicaoAnteriorCount/resultadoAnterior/interventionType | Canonical CSV does not transport these fields; do not infer absence of help from missing export |
| Current canonical export has 22 fields including event/session/time/origin and four FSRS fields | AnalyticsProjectionService.java exportCsv | Help, variants, exposure counts and post-attempt cause annotations need a versioned transport increment |
| Confidence submitted with answer | frontend/.../questoes/ResolucaoQuestaoModal.tsx handleAnswer | Explicit confidence-selection timestamp/feedback ordering is not established by this code inspection alone |
| Error cause can be annotated after response | Same modal handleSelectCausaErro / annotateAttempt | Must join by attempt ID and preserve annotation time; canonical CSV currently omits annotation |
| Legacy sequence timestamp fallback | AnalyticsProjectionService.java exportSequenceCsv Instant.EPOCH fallback | Not used by this public lab; cannot accept as genuine measurement time in future personal validation |

No historical event was altered and no missing value was promoted to zero. A complete personal prediction ledger and novel-item holdout must be tested through the existing frontend→Java→SQLite→R chain in a separate, versioned increment. Declaring the present public-data test a personal calibration would be incorrect.

## First proposed N-of-1 experiment (NOT_EXECUTED)

Precommit predictions and item/variant identities BEFORE responding; capture help and confidence timing without a long questionnaire. After taxonomy and source quality are verified, compare two acceptable retrieval-based strategies on matched concept clusters, with assignment randomized BEFORE outcomes and workload measured in actual time. Reserve unseen equivalent items for delayed evaluation and report both original-item recall and novel-item performance. Delay windows must be registered according to exam calendar and availability; no fixed universal session duration is assumed.

A naive same-concept ABAB crossover is inappropriate when learning persists and cannot be washed out. Consider parallel matched concept clusters with counterbalanced session order, recording prerequisite overlap/spillover, repeat exposures, test-induced learning, actual delays and intervention completion. Estimate effects at the randomized concept-cluster unit, not by pretending every attempt is independent. This protocol needs real eligible concepts/items and isolated integrated tests before execution. Active information-gain selection remains exploratory and unimplemented here; no simulated gain can schedule a real activity.

## Reproducibility and infrastructure

The updated CLI supports --source-run lab/runs/previous-success instead of --download. It checks a successful source manifest, every source SHA and confinement, and replays without internet. CI compares complete run trees byte for byte. The official ASSISTments file SHA is frozen from the first verified download, so upstream changes stop acquisition instead of silently changing the cohort.

An earlier unrelated synthetic gate (40536144628) timed out while INSTALLING the pinned R runtime after five minutes; no test assertion failed. R setup timeout is raised to ten minutes, keeping the same R 4.5.1 and dependencies. This changes the bounded infrastructure budget, not model criteria or test expectations.

The ten-minute retry also stalled in Ubuntu apt BEFORE R execution: setup-r installs gdebi-core/qpdf/devscripts/ghostscript and the Azure Ubuntu mirror was downloading small system dependencies slowly. The workflow now changes ONLY the disposable runner's Azure Ubuntu mirror to the official archive.ubuntu.com HTTPS mirror, preserving signed repositories, R 4.5.1, pinned actions, package requirements and all assertions. This is an infrastructure recovery, not a relaxed scientific gate. A final run is required. Offline replay also checks the stored licensing document and raw-source hashes; fixtures default to UNVERIFIED_EXTERNAL until acquisition verifies provenance.

Identity in the Anki source is a collection pseudonym, not an independently authenticated human identity. Source independence relies on the upstream contributor description. Reference settings are explicitly fuzzing off and no learning/relearning steps: results are a filtered-log benchmark configuration, not a reconstruction of every original Anki state. Unknown within-day actions and pretraining overlap limit generalization. The Java Bridge consumes its own current successful run manifest under the configured output root (AnalyticsBridgeService), not lab/runs; these experiments do not publish an operational manifest.


## Final executed validation

Implementation commit d48ae4fdd7d4f052d8205ed973ba0cb7fe87da6b:
- [Human CI 40540737927](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40540737927): SUCCESS. Ten external integration/metric tests, 640 R checks, actual Anki and corrected ASSISTments processing and OFFLINE replay.
- [Regression CI 40540737980](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40540737980): SUCCESS. 46 total laboratory tests (the ten human tests are a SUBSET), 640 R checks, zero failures.
- Byte-identical replays: 50 question / eight synthetic-memory / 13 synthetic-calibration files; 21 human-memory and ten ASSISTments files. No network download during the two human replays.
- The final ZIP was downloaded and independently SHA-256 verified as 06aec87939ce056628a75b5f8073ae90273051c3694955d6a7c803ba7083fa96. Complete aggregate summaries, per-horizon metrics, parameter intervals, source/analysis manifests and code hashes are permanently archived in docs/results/public_human_reference_v1.json; no raw/per-event data are committed.
- Successful installer logs record Python 3.13.7, FSRS 6.3.2, typing_extensions 4.15.0, R 4.5.1, jsonlite 2.0.0 and digest 0.6.39. R packages are currently fetched from CRAN rather than an R lockfile: bitwise replay here is within the same validated environment, not a promise across arbitrary future environments.

### Numerical guard finding and decision

The fixed 1e-6 numerical guard alone changed raw-FSRS log loss from 0.883565 to 0.559567 with essentially unchanged Brier (0.119052). Individual calibration remained 0.547752 log loss / 0.118299 Brier. Against this guard, BOTH intervals crossed zero: Brier [-0.014046,0.003498], log loss [-0.038270,0.001904]. Thus much of the apparent log-loss gain against unguarded defaults was numerical saturation handling, not learned individual structure. This secondary contrast was added after initial results and is exploratory; it does not establish a new confirmatory finding or optimize a model on the test.

The online personal mean's log loss remained lower, 0.398297; individual-minus-baseline interval was positive [0.037058,0.312681]. Conditional improvement against the global calibrator does not establish superiority against strong simple references. The online baseline uses previous test outcomes only after their batch; calibration coefficients remain frozen. Comparing their predictions is legitimate prequential evaluation, not evidence that either study policy is causally better.

ASSISTments results and inconclusive intervals were unchanged by integrity/replay hardening. Newly observed items are not validated transfer, ordinal ordering is not a retention interval, and six of twelve histories had worse skill-set Brier.

**Decision: keep all planner authority blocked.** There is no personal prospective validation, validated cognitive twin, estimated conceptual mastery, identified personal forgetting curve, causal intervention effect or demonstrated operational planner benefit. The next justified implementation is the versioned personal evidence transport and an independently precommitted prediction ledger, with isolated SQLite integration tests, before a randomized/counterbalanced delayed-outcome N-of-1 experiment.


## Temporal compatibility finding — do not interpret this pilot as canonical FSRS calibration

Horizon inspection of the executed report identified 1,265 final targets below 24 hours: the official helper predicted exactly 1, but 257 failures were observed (Brier and bias both 257/1265). Source inspection at official py-fsrs v6.3.2 fsrs/scheduler.py get_card_retrievability confirms elapsed_days=max(0,(current_datetime-card.last_review).days). This is declared library behavior, not an equation to patch in R.

The dataset's prepared delta_t is not necessarily the number of complete UTC 24-hour periods. Therefore source-study-day versus actual-UTC clock alignment is unresolved, including intervals beyond the subday bin. The new QA reports mismatch counts and positive source intervals under 24 hours, without changing outcomes, deleting subday cases, tuning the test, or replacing the canonical formula. Technical tests exercise the difference explicitly.

Any earlier statement of individual-global improvement remains a conditional comparison of the chosen adapters on these observations, not demonstrated personal retention calibration. The numerical guard finding is strongly affected by this time basis. Review source preparation/day boundaries, pre-register an alternative verified temporal adapter and evaluate it on a separate held-out cohort before interpreting FSRS predictive validity. No post-hoc target exclusion or new forgetting equation is authorized by these results.


## Current verification after temporal QA — supersedes earlier validation interpretations

Code 10f9be32215284b20ec10b20f7bd9bbdefb8937b:
[human CI 40543215399](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40543215399) and
[regression CI 40543214868](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40543214868) SUCCESS.
48 total laboratory tests (12 human subset), 640 R checks, zero failures/skips; all offline/synthetic replays still byte-identical (21/10 and 50/8/13 files). Complete current aggregate reports/manifests were recovered from SHA-verified ZIP fc33b8fd588202c009dd3b6c765e8b1fcfea7456a1ac39f786d798655536a42e and archived, replacing the previous historical-only summary.

Across ALL eligible source histories, 40,841 of 82,161 repeat intervals differed between recorded source days and floored UTC 24-hour periods; 9,026 had a positive source interval but elapsed UTC time under 24 hours. These are source-wide counts, NOT counts of final test targets. Final test targets under 24h were 1,265, including 257 observed failures. No row was removed or rescored to improve a model.

The report now retains statistical contrast values but labels memory comparisons INCONCLUSIVE_TEMPORAL_COMPATIBILITY and validation_status=BLOCKED_BY_CLOCK_ALIGNMENT. Earlier positive individual/global statistical comparisons are NOT validated memory inference. Review the source time basis and pre-register a verified adapter/new held-out cohort before personal interpretation. The next personal implementation remains a prospectively precommitted prediction ledger and complete versioned evidence transport, validated with isolated SQLite.

Minor report-label limitation: the shared comparison uncertainty text mentions donor/overlapping folds; that qualification applies to memory calibration. ASSISTments actually uses only within-student prequential models and a paired-student bootstrap. The computation is unchanged and documented separately; no ASSISTments donor fit is claimed.

The final documentation/archive commit changes no analytical code or workflow after these executions. No production data, FSRS equation, planner authority, credentials or main merge were changed.


## Registered continuation after PR33: untouched-cohort clock comparison

This protocol is fixed in lab/CLOCK_VALIDATION_PROTOCOL.json BEFORE new outcomes. Existing PR33 data remain diagnostic and are NOT retuned. Twelve complete files are selected by midpoint size ranks after excluding all twelve PR33 files from the same pinned source/license frame. Source selection metadata are saved before outcome files. Full per-item sequences and the declared t_history/r_history prefixes must agree; fractional intervals are rejected by this recorded-whole-day protocol.

Two SDK arms use identical observed events and actual UTC chronology:
- UTC_WHOLE_24H reproduces the prior SDK behavior.
- SOURCE_RECORDED_DAYS anchors a model-only coordinate at each item's first observed instant, then advances it by that item's recorded delta_t. This coordinate is DERIVED, not an observed timestamp or recovered timezone. Both get_card_retrievability and review_card remain official py-fsrs 6.3.2 with unchanged default parameters. No R forgetting formula is added.

Primary target domain is repeat events with recorded delta_t>=1, registered before reading the new cohort. Both arms score the SAME domain and use the same actual-time train/validation/test batches. All cold-start and zero-day events still update canonical states and the historical baseline after their event, but zero-day events are explicitly outside this long-term scoring domain. This is not post-hoc removal of the prior cohort's difficult events.

The primary paired comparison is SOURCE_RECORDED_DAYS raw FSRS versus UTC_WHOLE_24H raw FSRS on identical future targets. At least five paired collection IDs, complete coverage and negative upper bounds for both Brier and log-loss differences are required for conditional improvement. This does not establish personal calibration, conceptual understanding, correct original timezone, causal learning, or equivalence with Java/Anki scheduling. Default-weight pretraining overlap remains unknown.

Within each arm the existing R individual/global/guard/online-baseline experiment remains available, with prior-only donor fits, frozen coefficients and validation-only regularization. Semantic conformance and predictive quality are assessed separately. can_apply and can_schedule remain false. Data, formulas and labels are never changed to obtain a passing metric.

Run from analytics-engine:

    python lab/recorded_day_experiment.py --download --output lab/runs/recorded-day-first
    python lab/recorded_day_experiment.py --source-run lab/runs/recorded-day-first --output lab/runs/recorded-day-replay

Choose NEW run directories. Raw human files are not committed/uploaded; aggregate manifests and scores are retained. Current execution is pending and must not be replaced by historical PR33 results.
