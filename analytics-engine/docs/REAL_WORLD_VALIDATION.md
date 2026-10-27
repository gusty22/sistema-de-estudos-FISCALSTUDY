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
