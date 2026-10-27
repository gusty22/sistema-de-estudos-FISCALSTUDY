"""Independent recall-only simulator. No FSRS/R import or fitted-model equation.
Known acquisition is fixed at one; this experiment isolates a memory hypothesis.
"""
import hashlib
import random
from datetime import datetime, timedelta, timezone
from simulator import forgetting

CALENDAR = (0,1,3,7,14,28,42)
FIELDS = ("event_id","student_id","question_id","occurred_at","origin_type",
          "gabarito_status","is_correct","fsrs_model_version","fsrs_prediction_timestamp",
          "fsrs_evidence_status","fsrs_retrievability_pre_update",
          "fsrs_stability_pre_update","fsrs_difficulty_pre_update")

def identity(*parts):
    return hashlib.sha256("|".join(map(str,parts)).encode()).hexdigest()[:24]

def generate_memory(seed, reference, items=8):
    if not 1<=items<=32:
        raise ValueError("items must be 1..32")
    rng=random.Random(seed)
    profiles=[(h,f) for h in (1.5,18.) for f in ("exponential","power")]
    rng.shuffle(profiles)
    base=datetime(2026,1,1,tzinfo=timezone.utc)
    events, truth=[],[]
    for index,(half_life,form) in enumerate(profiles):
        student=identity(seed,index)
        state={identity(student,i):dict(h=half_life,last=0) for i in range(items)}
        for day in CALENDAR:
            moment=base+timedelta(days=day)
            # Baseline history is frozen for the entire equal-timestamp batch.
            reference.begin_batch(student,moment)
            batch=[]
            for item,current in state.items():
                probability=forgetting(day-current["last"],current["h"],form)
                prediction=reference.predict(student,item,moment)
                success=rng.random()<probability
                event=identity(seed,student,item,day)
                stamp=moment.isoformat().replace("+00:00","Z")
                row=dict(event_id=event,student_id=student,question_id=item,
                    occurred_at=stamp,origin_type="SYNTHETIC_BENCHMARK",
                    gabarito_status="DEFINITIVO",is_correct=str(success).lower(),
                    fsrs_model_version=prediction["version"],
                    fsrs_prediction_timestamp=stamp,
                    fsrs_evidence_status="COLD_START_NO_PREVIOUS_REVIEW" if prediction["probability"] is None else "UNCALIBRATED_ITEM_ESTIMATE",
                    fsrs_retrievability_pre_update="" if prediction["probability"] is None else prediction["probability"],
                    fsrs_stability_pre_update="" if prediction["stability"] is None else prediction["stability"],
                    fsrs_difficulty_pre_update="" if prediction["difficulty"] is None else prediction["difficulty"])
                events.append(row)
                truth.append(dict(event_id=event,student_id=student,item_id=item,day=day,
                    knowledge=1.,retrieval=probability,half_life_days=current["h"],
                    forgetting_form=form,initial_half_life_days=half_life,
                    historical_prediction=prediction["historical_probability"],
                    fixed_prediction=.5,observed_correct=int(success)))
                batch.append((item,success,current))
            # Every prediction precedes every observation at the same instant.
            for item,success,current in batch:
                reference.observe(student,item,moment,success)
                current["last"]=day
                current["h"]*=1.12  # Simulator hypothesis: restudy after each recall test.
    return events,truth
