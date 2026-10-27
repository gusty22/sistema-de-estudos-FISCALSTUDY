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
    excluded=0
    for card,history in cards.items():
        history.sort(key=lambda r:r["ms"])
        if [r["sequence"] for r in history]!=list(range(1,len(history)+1)):
            excluded+=len(history)
        else:
            rows.extend(history)
    rows.sort(key=lambda r:(r["ms"],r["card"]))
    return rows,dict(raw_rows=len(seen),eligible_rows=len(rows),
        exclusions={"MISSING_OR_INCONSISTENT_CARD_PREFIX":excluded},
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
    (folder/"corrected.csv").write_bytes(payload)
    return payload,dict(source=ASSIST_CORRECTED,source_page=ASSIST_PAGE,
        sha256=digest(payload),bytes=len(payload),license="OFFICIAL_FREE_USE_DECLARATION_NO_SPDX",
        license_page_sha256=digest(page),redistribution="NOT_AUTHORIZED_BY_THIS_LAB",
        source_version="Corrected Drive file, mutable upstream; bytes SHA recorded BEFORE analysis",
        decoding="latin-1 byte-preserving transport; only ASCII numeric IDs/skills selected")
