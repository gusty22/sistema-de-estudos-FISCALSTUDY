"""Transport experiment only. Observed UTC timestamps NEVER become model coordinates."""
import csv
import io
import json
import math
import re
from datetime import timedelta
from pathlib import Path
from importlib.metadata import version
from public_data_adapters import (FSRS_DATASET,FSRS_REVISION,FSRS_FIELDS,NORMAL_FIELDS,
    bounded_get,digest,parse_fsrs_tsv,pseudonym,clone_public_snapshot)

CLOCKS=("UTC_WHOLE_24H","SOURCE_RECORDED_DAYS")
FIELDS=(*NORMAL_FIELDS,"source_event_index","source_interval_days","model_elapsed_days",
        "prediction_status","clock_basis","model_clock_coordinate")

def load_protocol():
    return json.loads((Path(__file__).with_name("CLOCK_VALIDATION_PROTOCOL.json")).read_text(encoding="utf-8"))

def select_new_cohort(tree,prior):
    frame=sorted([r for r in tree if re.fullmatch(r"v4/revlog_history-[0-9a-f]{7}\.tsv",r.get("path",""))
        and 50000<=r.get("size",0)<=1000000],key=lambda r:(r["size"],r["path"]))
    remaining=[r for r in frame if r["path"] not in set(prior)]
    if len(remaining)<12:
        raise ValueError("Fewer than 12 untouched eligible files")
    selected=[remaining[min(len(remaining)-1,int((i+.5)*len(remaining)/12))] for i in range(12)]
    if len({r["path"] for r in selected})!=12 or any(r["path"] in set(prior) for r in selected):
        raise ValueError("Invalid held-out cohort selection")
    return selected,len(frame),len(remaining)

def acquire_new_cohort(folder,download=False,source_run=None):
    protocol=load_protocol()
    if bool(download)==bool(source_run):
        raise ValueError("Choose --download OR --source-run")
    if source_run:
        source=clone_public_snapshot(source_run,folder,"fsrs")
        names={r["path"] for r in source["files"]}
        if (names & set(protocol["prior_excluded_files"]) or
            source.get("experiment_protocol")!=protocol["version"] or
            sorted(source.get("prior_excluded_files",[]))!=sorted(protocol["prior_excluded_files"])):
            raise ValueError("Offline run is not the registered untouched cohort")
        selected=(Path(source_run).resolve()/"raw"/"selection-before-data.json").read_bytes()
        if digest(selected)!=source.get("selection_sha256"):
            raise ValueError("Changed preregistered source selection")
        (Path(folder)/"selection-before-data.json").write_bytes(selected)
        return source
    root=f"https://huggingface.co/datasets/{FSRS_DATASET}/resolve/{FSRS_REVISION}"
    card=bounded_get(root+"/README.md",100000)
    if not re.search(rb"(?im)^license:\s*mit\s*$",card):
        raise ValueError("Dataset license declaration not verified")
    tree=json.loads(bounded_get(f"https://huggingface.co/api/datasets/{FSRS_DATASET}/tree/{FSRS_REVISION}/v4",1000000))
    selected,frame,remaining=select_new_cohort(tree,protocol["prior_excluded_files"])
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=False)
    # Save selection BEFORE the first outcome file is acquired.
    source=dict(dataset=FSRS_DATASET,revision=FSRS_REVISION,license="MIT_DECLARED_IN_DATASET_CARD",
        license_sha256=digest(card),experiment_protocol=protocol["version"],
        prior_excluded_files=protocol["prior_excluded_files"],eligible_frame_files=frame,
        remaining_frame_files=remaining,selection=protocol["selection"],files=[])
    (folder/"dataset-card.txt").write_bytes(card)
    (folder/"selection-before-data.json").write_text(json.dumps(selected,sort_keys=True),encoding="utf-8")
    for meta in selected:
        payload=bounded_get(root+"/"+meta["path"],1000000)
        if len(payload)!=meta["size"]:
            raise ValueError("Source byte length changed")
        expected=meta.get("lfs",{}).get("oid")
        if expected and digest(payload)!=expected.removeprefix("sha256:"):
            raise ValueError("Upstream source SHA mismatch")
        name=Path(meta["path"]).name
        (folder/name).write_bytes(payload)
        source["files"].append(dict(path=meta["path"],name=name,bytes=len(payload),sha256=digest(payload)))
    # This is metadata, not a duplicate raw outcome source.
    source["selection_sha256"]=digest((folder/"selection-before-data.json").read_bytes())
    return source

def validate_declared_prefixes(payload,rows):
    """Do not initialize a model from an incomplete or inconsistent declared history."""
    accepted={(r["card"],r["ms"]):r for r in rows}
    by_card={}
    raw=csv.DictReader(io.StringIO(payload.decode("utf-8-sig")),delimiter="\t")
    for entry in raw:
        key=(int(entry["card_id"]),int(entry["review_time"]))
        if key not in accepted:
            continue
        row=accepted[key]
        if not row["source_delta_t"].is_integer():
            raise ValueError("This protocol requires integer recorded day intervals")
        by_card.setdefault(row["card"],[]).append((row,entry))
    for history in by_card.values():
        history.sort(key=lambda pair:pair[0]["ms"])
        times=[];ratings=[]
        for row,entry in history:
            recorded_times=[] if not entry["t_history"] else [float(x) for x in entry["t_history"].split(",")]
            recorded_ratings=[] if not entry["r_history"] else [int(x) for x in entry["r_history"].split(",")]
            if recorded_times!=times or recorded_ratings!=ratings:
                raise ValueError("Declared history differs from the complete observed prefix")
            times.append(row["source_delta_t"]);ratings.append(row["rating"])
    return True

def replay_recorded_clock(rows,source_id,basis,origin_type="UNVERIFIED_EXTERNAL"):
    if basis not in CLOCKS or version("fsrs")!="6.3.2":
        raise ValueError("Unregistered clock or official package version")
    from fsrs import Scheduler,Card,Rating
    scheduler=Scheduler(enable_fuzzing=False,learning_steps=(),relearning_steps=())
    cards={};observed_last={};output=[]
    for row in rows:
        key=row["card"];card=cards.get(key);actual=row["moment"]
        delta=row["source_delta_t"]
        if not math.isfinite(delta) or delta<0 or delta!=math.floor(delta):
            raise ValueError("Invalid recorded whole-day interval")
        model_time=actual if basis=="UTC_WHOLE_24H" or card is None else card.last_review+timedelta(days=int(delta))
        elapsed=None if card is None else (actual-observed_last[key]).total_seconds()/86400
        model_elapsed=None if card is None else (model_time-card.last_review).days
        status="COLD_START" if card is None else ("ELIGIBLE" if delta>=1 else "OUTSIDE_LONG_TERM_DOMAIN")
        probability=None if status!="ELIGIBLE" else scheduler.get_card_retrievability(card,current_datetime=model_time)
        if probability is not None and (not math.isfinite(probability) or not 0<=probability<=1):
            raise ValueError("Invalid official probability")
        if basis=="SOURCE_RECORDED_DAYS" and card is not None and model_elapsed!=int(delta):
            raise ValueError("Recorded-day clock transport mismatch")
        output.append(dict(event_id=row["event_id"],student_id=pseudonym("fsrs-user",source_id),
            question_id=pseudonym(source_id,key),occurred_at=actual.isoformat().replace("+00:00","Z"),
            is_correct=row["outcome"],predicted_probability="" if probability is None else probability,
            elapsed_days="" if elapsed is None else elapsed,rating=row["rating"],
            origin_type=origin_type,fsrs_model_version="py-fsrs-6.3.2-defaults-"+basis,
            source_event_index=row["sequence"],source_interval_days=int(delta),
            model_elapsed_days="" if model_elapsed is None else model_elapsed,prediction_status=status,
            clock_basis=basis,model_clock_coordinate=model_time.isoformat().replace("+00:00","Z")))
        if card is None:
            card=Card(card_id=key,due=model_time)
        # Even unscored events update the canonical memory state, AFTER any prediction.
        cards[key],_=scheduler.review_card(card,Rating(row["rating"]),review_datetime=model_time)
        observed_last[key]=actual
    return output,list(scheduler.parameters)
