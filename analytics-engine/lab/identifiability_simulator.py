"""Independent diagnostic-probe generator. No R, FSRS, fitted parameters or policy.
Known acquisition=1 and no restudy between the immediate and single delayed probe.
Each lag uses a different synthetic student/item cohort; no repeated tests create gains.
"""
import hashlib
import random
from datetime import datetime, timedelta, timezone
from simulator import forgetting

FIELDS=("event_id","student_id","question_id","occurred_at","origin_type",
        "is_correct","phase","item_index")
def ident(*parts):
    return hashlib.sha256("|".join(map(str,parts)).encode()).hexdigest()[:24]

def generate_probes(seeds, items=64, pairs=4):
    if not seeds or len(set(seeds))!=len(seeds) or not 2<=items<=64 or not 1<=pairs<=8:
        raise ValueError("Distinct seeds, 2..64 items and 1..8 pairs required")
    events,truth=[],[]
    base=datetime(2026,1,1,tzinfo=timezone.utc)
    for seed in seeds:
        rng=random.Random(seed)
        for form in ("exponential","power"):
            for pair in range(pairs):
                for lag in (1,7,28):
                    roles=[1.5,18.]
                    rng.shuffle(roles)
                    pair_id=ident(seed,form,pair,lag)
                    for role,half_life in enumerate(roles):
                        student=ident(pair_id,role)
                        truth.append(dict(student_id=student,pair_id=pair_id,seed=seed,
                            form=form,lag_days=lag,half_life=half_life,
                            delayed_probability=forgetting(lag,half_life,form)))
                        for i in range(1,items+1):
                            question=ident(student,i)
                            success=rng.random()<forgetting(lag,half_life,form)
                            for phase,day,outcome in (("IMMEDIATE",0,True),("DELAYED",lag,success)):
                                events.append(dict(event_id=ident(question,phase),student_id=student,
                                    question_id=question,occurred_at=(base+timedelta(days=day)).isoformat().replace("+00:00","Z"),
                                    origin_type="SYNTHETIC_BENCHMARK",is_correct=str(outcome).lower(),
                                    phase=phase,item_index=i))
    return events,truth
