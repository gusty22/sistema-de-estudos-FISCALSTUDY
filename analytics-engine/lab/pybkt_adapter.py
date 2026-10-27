"""Optional real pyBKT baseline, isolated from production and simulator truth.
Parameters fitted to the first 10 eligible responses PER learner only.
Predictions use strict prefixes; current outcomes are replaced with dummy 0.
"""
import csv
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
import sys
import warnings
from datetime import datetime
from simulator import validate

PINNED_VERSION = "1.4.3"
MODEL = "PYBKT_FROZEN_WARMUP"
WARMUP = 10

def instant(row):
    return datetime.fromisoformat(row["occurred_at"].replace("Z", "+00:00"))

def eligible(row):
    return (row["gabarito_status"] == "DEFINITIVO" and
            row["is_correct"] in ("true", "false") and
            row["used_help"] == "false" and row["session_complete"] == "true")

def read_snapshot(observations, manifest):
    raw = observations.read_bytes()
    meta = json.loads(manifest.read_text(encoding="utf-8"))
    if (meta.get("source_kind") != "SYNTHETIC_BENCHMARK" or
        meta.get("contract_version") != "learner_lab_events_v1" or
        meta.get("input_sha256") != hashlib.sha256(raw).hexdigest()):
        raise ValueError("Unapproved or corrupted experiment input")
    with observations.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if meta.get("row_count") != len(rows):
        raise ValueError("Snapshot row count mismatch")
    validate(rows)
    sessions = {}
    for row in rows:
        owner = sessions.setdefault(row["session_id"], row["student_id"])
        if owner != row["student_id"]:
            raise ValueError("Session identity has multiple owners")
    return rows

def native(value):
    if hasattr(value, "tolist"):
        return native(value.tolist())
    if isinstance(value, dict):
        return {str(k): native(v) for k,v in value.items()}
    if isinstance(value, (tuple, list)):
        return [native(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Non-finite fitted parameter")
    return value

def predict_events(rows):
    # No fallback, installer, network call or approximate BKT implementation.
    found = version("pyBKT")
    if found != PINNED_VERSION:
        raise RuntimeError("Expected pyBKT " + PINNED_VERSION + ", found " + found)
    sklearn_version=version("scikit-learn")
    if sklearn_version != "1.6.1":
        raise RuntimeError("Expected scikit-learn 1.6.1 for pyBKT compatibility; found "+sklearn_version)
    import pandas as pd
    from pyBKT.models import Model
    import pyBKT
    source_root=Path(next(iter(pyBKT.__path__)))
    source_hashes={f.relative_to(source_root).as_posix():hashlib.sha256(f.read_bytes()).hexdigest()
                   for f in sorted(source_root.rglob("*.py"))}
    validate(rows)
    predictions, support = [], {}
    defaults = dict(order_id="order_id", skill_name="skill_name",
                    correct="correct", user_id="user_id")
    def frame(events):
        return pd.DataFrame([dict(order_id=i, skill_name=e["skill_id"],
                     correct=int(e["is_correct"]=="true"), user_id=e["student_id"])
                     for i,e in enumerate(events)])
    for student in sorted({e["student_id"] for e in rows}):
        selected = sorted([e for e in rows if e["student_id"]==student and eligible(e)],
                          key=lambda e:(instant(e), e["event_id"]))
        if len(selected) <= WARMUP:
            support[student] = dict(status="INSUFFICIENT_HISTORY", eligible=len(selected))
            continue
        # Frozen fit, strictly before first evaluation time. Equal timestamps
        # at the warmup boundary are excluded from training, not arbitrarily ordered.
        cutoff = instant(selected[WARMUP])
        train = [e for e in selected[:WARMUP] if instant(e) < cutoff]
        if len(train) < WARMUP:
            support[student] = dict(status="AMBIGUOUS_WARMUP_BOUNDARY", eligible=len(selected))
            continue
        skills = sorted({e["skill_id"] for e in train})
        model = Model(seed=709, num_fits=3, parallel=False)
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter("always")
            model.fit(data=frame(train), defaults=defaults, skills=skills, forgets=False)
        warning_messages=set(str(w.message) for w in captured)
        warning_count=len(captured)
        try:
            params = native(model.fit_model)
        except ValueError as error:
            if str(error)!="Non-finite fitted parameter":
                raise
            support[student]=dict(status="NON_FINITE_FIT_UNAVAILABLE",eligible=len(selected),
                prediction_count=0,training_event_ids=[e["event_id"] for e in train],
                warning_count=warning_count,warnings=sorted(warning_messages))
            continue
        count, unavailable = 0, 0
        numerical_unavailable=[]
        for event in selected[WARMUP:]:
            if event["skill_id"] not in skills:
                unavailable += 1
                continue  # Do not permit library default prediction .5 for unseen skill.
            history = [e for e in selected if instant(e) < instant(event)]
            query = dict(event, is_correct="false")  # no target label passed to predict
            with warnings.catch_warnings(record=True) as captured:
                warnings.simplefilter("always")
                prediction = model.predict(data=frame(history + [query]))
            warning_count+=len(captured)
            warning_messages.update(str(w.message) for w in captured)
            probability = float(prediction.iloc[-1]["correct_predictions"])
            if not math.isfinite(probability) or not 0 <= probability <= 1:
                numerical_unavailable.append(event["event_id"])
                continue  # Explicit abstention; no clipping, substitute or refit.
            predictions.append(dict(event_id=event["event_id"], student_id=student,
                question_id=event["question_id"], occurred_at=event["occurred_at"],
                model_name=MODEL, predicted_probability=probability,
                observed_correct=int(event["is_correct"]=="true"),
                training_observations=len(train),
                state_history_observations=len(history),
                topic_training_observations=sum(e["skill_id"]==event["skill_id"] for e in train),
                model_history_item_exposure="REPEATED_ITEM" if any(e["question_id"]==event["question_id"] for e in history) else "FIRST_SEEN_ITEM",
                item_exposure="RECORDED_PREVIOUS_EXPOSURE" if int(event["prior_exposures"])>0 else "RECORDED_FIRST_EXPOSURE",
                prediction_basis="FROZEN_PREFIX_PARAMETERS_FORWARD_HISTORY"))
            count += 1
        support[student] = dict(status="PARTIAL_NUMERICAL_UNAVAILABILITY" if numerical_unavailable else "EXPLORATORY_FROZEN_PREFIX", eligible=len(selected),
            numerical_unavailable_event_ids=numerical_unavailable, warning_count=warning_count,
            warnings=sorted(warning_messages),
            training_event_ids=[e["event_id"] for e in train], prediction_count=count,
            unknown_skill_count=unavailable, parameters=params,
            parameter_identifiability="NOT_ESTABLISHED_SMALL_PREFIX")
    return predictions, dict(source_kind="SYNTHETIC_BENCHMARK", engine="REAL_PYBKT",
        pybkt_version=found, pandas_version=version("pandas"), numpy_version=version("numpy"),
        installed_pybkt_source_sha256=source_hashes, sklearn_version=sklearn_version,
        students=support, fitting_seed=709, initializations=3, warmup=WARMUP,
        protocol="FROZEN_WARMUP_FIT_STRICT_PREFIX_STATE",
        temporal_forgetting="NOT_MODELED", can_apply=False, can_schedule=False,
        is_empirically_validated=False)

def main():
    observations, target, manifest = map(Path, sys.argv[1:])
    allowed=(Path(__file__).resolve().parents[1]/"tests"/"fixtures"/"learner_lab").resolve()
    for path in (observations, target, manifest):
        if not path.resolve().is_relative_to(allowed):
            raise ValueError("Adapter paths must remain in synthetic fixtures")
    if target.exists() or Path(str(target)+".status.json").exists():
        raise FileExistsError("Refusing to overwrite experimental predictions")
    rows = read_snapshot(observations, manifest)
    predictions, status = predict_events(rows)
    columns = ["event_id","student_id","question_id","occurred_at","model_name",
        "predicted_probability","observed_correct","training_observations",
        "state_history_observations","topic_training_observations","item_exposure","model_history_item_exposure","prediction_basis"]
    with target.open("w", encoding="utf-8", newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=columns)
        writer.writeheader()
        writer.writerows(predictions)
    Path(str(target)+".status.json").write_text(
        json.dumps(status, indent=2, sort_keys=True, allow_nan=False), encoding="utf-8")

if __name__ == "__main__":
    main()
