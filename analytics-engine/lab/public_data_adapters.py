"""Public human data only. No production DB, synthetic origin, or invented fields."""
import csv
import hashlib
import io
import json
import math
from datetime import datetime,timezone
from pathlib import Path

FSRS_DATASET="open-spaced-repetition/fsrs-dataset"
FSRS_REVISION="ae96575728d364265a75f2447fe7b7fa389ba96c"
BENCHMARK_REVISION="f63af1caf6e658b390809583e00931e31776590a"
FSRS_FIELDS=("review_time","card_id","i","delta_t","review_rating","y","t_history","r_history")
NORMAL_FIELDS=("event_id","student_id","question_id","occurred_at","is_correct",
    "predicted_probability","elapsed_days","rating","origin_type","fsrs_model_version")

def digest(data):
    return hashlib.sha256(data).hexdigest()
def pseudonym(namespace,value):
    return digest((namespace+":"+str(value)).encode())[:24]

def parse_fsrs_tsv(data,source_id,origin_type="UNVERIFIED_EXTERNAL"):
    reader=csv.DictReader(io.StringIO(data.decode("utf-8-sig")),delimiter="\t")
    if tuple(reader.fieldnames or ())!=FSRS_FIELDS:
        raise ValueError("Unsupported FSRS TSV schema")
    rows=[];seen=set();cards={}
    for row in reader:
        try:
            ms=int(row["review_time"]);card=int(row["card_id"])
            seq=int(row["i"]);rating=int(row["review_rating"]);outcome=int(row["y"])
            interval=float(row["delta_t"])
        except (KeyError,TypeError,ValueError) as error:
            raise ValueError("Invalid FSRS numeric field") from error
        if ms<=0 or card<=0 or seq<1 or rating not in (1,2,3,4) or outcome!=int(rating>1) or not math.isfinite(interval) or interval<0:
            raise ValueError("Invalid FSRS identity/rating/target")
        moment=datetime.fromtimestamp(ms/1000,tz=timezone.utc)
        key=(card,ms)
        if key in seen:
            raise ValueError("Duplicate/colliding FSRS event")
        seen.add(key)
        entry=dict(ms=ms,card=card,sequence=seq,rating=rating,outcome=outcome,
            moment=moment,source_delta_t=interval,event_id=pseudonym(source_id,f"{card}:{ms}"))
        cards.setdefault(card,[]).append(entry)
    # A partial card history cannot initialize an official state honestly.
    excluded=0;clock_comparisons=0;clock_mismatches=0;positive_source_under_24h=0
    for card,history in cards.items():
        history.sort(key=lambda r:r["ms"])
        if [r["sequence"] for r in history]!=list(range(1,len(history)+1)):
            excluded+=len(history)
        else:
            for previous,current in zip(history,history[1:]):
                days=(current["moment"]-previous["moment"]).total_seconds()/86400
                clock_comparisons+=1
                clock_mismatches+=int(not math.isclose(current["source_delta_t"],math.floor(days),abs_tol=1e-9))
                positive_source_under_24h+=int(current["source_delta_t"]>0 and days<1)
            rows.extend(history)
    rows.sort(key=lambda r:(r["ms"],r["card"]))
    return rows,dict(raw_rows=len(seen),eligible_rows=len(rows),
        exclusions={"MISSING_OR_INCONSISTENT_CARD_PREFIX":excluded},
        time_basis=dict(comparisons=clock_comparisons,source_interval_vs_utc_whole_day_mismatches=clock_mismatches,
            positive_source_interval_under_24h=positive_source_under_24h,
            status="UNRESOLVED_CLOCK_ALIGNMENT" if clock_mismatches else "NO_MISMATCH_OBSERVED"),
        ignored_fields=["t_history","r_history"],target="SELF_REPORTED_RECALL_RATING_GT_1",
        origin_type=origin_type,local_timezone="NOT_AVAILABLE",
        limitation="Already filtered source; not the complete original within-day Anki log")

def replay_fsrs(rows,source_id,origin_type="UNVERIFIED_EXTERNAL"):
    from importlib.metadata import version
    if version("fsrs")!="6.3.2":
        raise RuntimeError("Official fsrs==6.3.2 required")
    from fsrs import Scheduler,Card,Rating
    scheduler=Scheduler(enable_fuzzing=False,learning_steps=(),relearning_steps=())
    cards={};result=[]
    for row in rows:
        moment=row["moment"];key=row["card"]
        card=cards.get(key)
        probability=None if card is None else scheduler.get_card_retrievability(card,current_datetime=moment)
        elapsed=None if card is None else (moment-card.last_review).total_seconds()/86400
        if probability is not None and (not math.isfinite(probability) or not 0<=probability<=1):
            raise ValueError("Invalid official pre-update prediction")
        result.append(dict(event_id=row["event_id"],student_id=pseudonym("fsrs-user",source_id),
            question_id=pseudonym(source_id,key),occurred_at=moment.isoformat().replace("+00:00","Z"),
            is_correct=row["outcome"],predicted_probability="" if probability is None else probability,
            elapsed_days="" if elapsed is None else elapsed,rating=row["rating"],
            origin_type=origin_type,fsrs_model_version="py-fsrs-6.3.2-defaults"))
        # Current rating is consumed ONLY after the event's prediction was recorded.
        if card is None:
            card=Card(card_id=key,due=moment)
        cards[key],_=scheduler.review_card(card,Rating(row["rating"]),review_datetime=moment)
    return result,list(scheduler.parameters)

def parse_assistments_csv(data,encoding="utf-8-sig",origin_type="UNVERIFIED_EXTERNAL"):
    reader=csv.DictReader(io.StringIO(data.decode(encoding)))
    required={"order_id","user_id","problem_id","skill_id","correct"}
    if not required.issubset(reader.fieldnames or ()):
        raise ValueError("Unsupported ASSISTments schema")
    merged={};physical=0;excluded=0
    for row in reader:
        physical+=1
        if row.get("answer_type")=="open_response":
            excluded+=1;continue
        order=int(row["order_id"]);student=row["user_id"].strip();problem=row["problem_id"].strip()
        if not student or not problem or order<0 or row["correct"] not in ("0","1"):
            raise ValueError("Invalid ASSISTments identity/target")
        key=(student,order)
        skills=tuple(sorted(set(filter(None,row["skill_id"].replace(",","_").split("_")))))
        entry=dict(event_id=pseudonym("assist-event",f"{student}:{order}"),
            student_id=pseudonym("assist-user",student),question_id=pseudonym("assist-item",problem),
            event_order=order,occurred_at=None,chronology="ORDINAL_ORDER_ID_ONLY",
            skill_ids=skills,is_correct=int(row["correct"]),
            hint_count=row.get("hint_count") or None,
            target="FIRST_ATTEMPT_CORRECT_WITHOUT_REQUESTED_HELP",
            hint_timing="POST_TARGET_METADATA_NOT_A_PREDICTOR",
            origin_type=origin_type)
        if key in merged:
            previous=merged[key]
            if previous["question_id"]!=entry["question_id"] or previous["is_correct"]!=entry["is_correct"]:
                raise ValueError("Conflicting ASSISTments event")
            previous["skill_ids"]=tuple(sorted(set(previous["skill_ids"])|set(skills)))
        else:
            merged[key]=entry
    return sorted(merged.values(),key=lambda r:(r["event_order"],r["student_id"])),dict(
        physical_rows=physical,logical_events=len(merged),collapsed_skill_annotations=physical-excluded-len(merged),
        exclusions={"OPEN_RESPONSE_ALWAYS_CORRECT":excluded},
        memory_evaluation="NOT_SUPPORTED",elapsed_time="NOT_AVAILABLE",
        chronology="Official documentation calls order_id chronological; elapsed time not inferred",
        target="Correct on first attempt; asking for help counts as incorrect")

def bounded_get(url,limit):
    import urllib.request
    request=urllib.request.Request(url,headers={"User-Agent":"FiscalStudy-Human-Lab/1"})
    with urllib.request.urlopen(request,timeout=60) as response:
        if response.status!=200:
            raise ValueError("Unexpected source HTTP status")
        data=response.read(limit+1)
    if len(data)>limit:
        raise ValueError("Source exceeds declared resource limit")
    return data

def acquire_fsrs(folder,download=False):
    folder=Path(folder)
    if not download:
        raise RuntimeError("External source retrieval requires explicit --download")
    root=f"https://huggingface.co/datasets/{FSRS_DATASET}/resolve/{FSRS_REVISION}"
    card=bounded_get(root+"/README.md",100000)
    import re
    if not re.search(rb"(?im)^license:\s*mit\s*$",card):
        raise ValueError("Dataset MIT declaration not verified")
    tree=json.loads(bounded_get(
        f"https://huggingface.co/api/datasets/{FSRS_DATASET}/tree/{FSRS_REVISION}/v4",1000000))
    files=sorted([r for r in tree if re.fullmatch(r"v4/revlog_history-[0-9a-f]{7}\.tsv",r.get("path",""))
                  and 50000<=r.get("size",0)<=1000000],key=lambda r:(r["size"],r["path"]))
    if len(files)<12:
        raise ValueError("Insufficient source files for registered sample")
    selected=[files[min(len(files)-1,int((i+.5)*len(files)/12))] for i in range(12)]
    if len({r["path"] for r in selected})!=12:
        raise ValueError("Repeated source selection")
    folder.mkdir(parents=True,exist_ok=False)
    (folder/"dataset-card.txt").write_bytes(card)
    manifest=dict(dataset=FSRS_DATASET,revision=FSRS_REVISION,license="MIT_DECLARED_IN_DATASET_CARD",
        license_sha256=digest(card),benchmark_revision=BENCHMARK_REVISION,
        selection="12 midpoint rank strata by file bytes in eligible 50KB..1MB frame; full selected files",
        full_v4_files=sum(r.get("path","").endswith(".tsv") for r in tree),
        eligible_frame_files=len(files),not_representative_of="Large/excluded collections or all Anki users",files=[])
    for meta in selected:
        payload=bounded_get(root+"/"+meta["path"],1000000)
        if len(payload)!=meta["size"]:
            raise ValueError("Source byte count mismatch")
        expected=meta.get("lfs",{}).get("oid")
        if expected and digest(payload)!=expected.removeprefix("sha256:"):
            raise ValueError("Upstream LFS SHA mismatch")
        name=Path(meta["path"]).name
        (folder/name).write_bytes(payload)
        manifest["files"].append(dict(path=meta["path"],name=name,bytes=len(payload),sha256=digest(payload)))
    return manifest


ASSIST_PAGE="https://sites.google.com/site/assistmentsdata/home/2009-2010-assistment-data"
ASSIST_CORRECTED="https://drive.google.com/uc?export=download&id=1NNXHFRxcArrU0ZJSb9BIL56vmUt5FhlE"

def acquire_assistments(folder,download=False):
    if not download:
        raise RuntimeError("Explicit research download required")
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=False)
    page=bounded_get(ASSIST_PAGE,2000000)
    if b"The dataset is free to use" not in page:
        raise ValueError("Official free-use declaration not verified")
    payload=bounded_get(ASSIST_CORRECTED,100*1024*1024)
    if not payload.lstrip().startswith(b'"","order_id"'):
        raise ValueError("Not the corrected ASSISTments CSV; no HTML/consent bypass")
    if digest(payload)!="162ef8d2d28bcbfea6591a282994062bd8d5eaa00636544292a0d268dca6e5da":
        raise ValueError("ASSISTments corrected source changed from verified research snapshot")
    (folder/"corrected.csv").write_bytes(payload)
    (folder/"license-source.html").write_bytes(page)
    return payload,dict(source=ASSIST_CORRECTED,source_page=ASSIST_PAGE,
        sha256=digest(payload),bytes=len(payload),license="OFFICIAL_FREE_USE_DECLARATION_NO_SPDX",
        license_page_sha256=digest(page),redistribution="NOT_AUTHORIZED_BY_THIS_LAB",
        source_version="Corrected Drive file, mutable upstream; bytes SHA recorded BEFORE analysis",
        decoding="latin-1 byte-preserving transport; only ASCII numeric IDs/skills selected")


def clone_public_snapshot(source_run,target,kind):
    """Offline replay of an existing complete run. No arbitrary paths or partial inputs."""
    import re
    source_run=Path(source_run).resolve();target=Path(target)
    allowed=(Path(__file__).resolve().parents[1]/"lab"/"runs").resolve()
    if not source_run.is_relative_to(allowed) or source_run==allowed:
        raise ValueError("Source replay outside lab/runs")
    master=json.loads((source_run/"manifest.json").read_text(encoding="utf-8"))
    if (master.get("status")!="SUCCEEDED" or master.get("can_apply") is not False or
        master.get("can_schedule") is not False or master.get("source_kind")!="PUBLIC_HUMAN_DATASET"):
        raise ValueError("Invalid source run")
    payload=(source_run/"source-manifest.json").read_bytes()
    if digest(payload)!=master["artifacts"].get("source-manifest.json"):
        raise ValueError("Changed source manifest")
    source=json.loads(payload)
    if kind=="fsrs":
        if source.get("dataset")!=FSRS_DATASET or source.get("revision")!=FSRS_REVISION or len(source["files"])!=12:
            raise ValueError("Unregistered FSRS replay source")
        checks=[("dataset-card.txt",source["license_sha256"])]
        for row in source["files"]:
            if not re.fullmatch(r"revlog_history-[0-9a-f]{7}\.tsv",row["name"]):
                raise ValueError("Unsafe source filename")
            checks.append((row["name"],row["sha256"]))
    elif kind=="assistments":
        if source.get("source")!=ASSIST_CORRECTED:
            raise ValueError("Unregistered ASSISTments source")
        checks=[("corrected.csv",source["sha256"]),("license-source.html",source["license_page_sha256"])]
    else:
        raise ValueError("Unknown replay source")
    target.mkdir(parents=True,exist_ok=False)
    for name,expected in checks:
        path=(source_run/"raw"/name).resolve()
        if not path.is_relative_to(source_run/"raw") or digest(path.read_bytes())!=expected:
            raise ValueError("Raw source replay hash mismatch")
        (target/name).write_bytes(path.read_bytes())
    return source


def validate_prediction_join(predictions,observations):
    """Cross-language outputs must reference the ORIGINAL observed outcome, not R's copy alone."""
    originals={r["event_id"]:r for r in observations}
    if len(originals)!=len(observations):
        raise ValueError("Duplicate source event for scoring")
    seen=set()
    for row in predictions:
        key=(row["model_name"],row["event_id"])
        source=originals.get(row["event_id"])
        if key in seen or source is None:
            raise ValueError("Duplicate/unknown predicted event")
        seen.add(key)
        if any(row[k]!=source[k] for k in ("student_id","question_id")) or int(row["observed_correct"])!=int(source["is_correct"]):
            raise ValueError("Prediction identity/outcome differs from source")
        for key in ("occurred_at","event_order"):
            if key in source and source[key] is not None and row.get(key)!=source[key]:
                raise ValueError("Prediction chronology differs from source")
        probability=float(row["predicted_probability"])
        if not math.isfinite(probability) or not 0<=probability<=1:
            raise ValueError("Invalid prediction probability")
    return True
