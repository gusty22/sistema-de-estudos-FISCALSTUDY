"""Official FSRS reference -> existing R retrieval audit, synthetic recall only."""
import argparse
import csv
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
import platform
import subprocess
import sys
from memory_simulator import FIELDS, generate_memory
from run_experiment import dump, sha, resolve_rscript, score, reliability, interval

MODEL_VERSION="FSRS-6-py-fsrs-6.3.2-defaults-no-fuzz"
CRITERIA=dict(source_kind="SYNTHETIC_BENCHMARK",target="BINARY_UNASSISTED_RECALL",
    knowledge="FIXED_AT_ONE_IN_GENERATOR_NOT_ESTIMATED",
    rating_rule="Observed recall -> Good; observed failure -> Again; laboratory convention only",
    observation_policy="FIXED_CALENDAR_0_1_3_7_14_28_42_DAYS",
    seeds=[601,631,661,691,721],items_per_student=8,
    generators=["exponential","power"],initial_half_lives_days=[1.5,18],
    generator_restudy_multiplier=1.12,
    baseline="Beta(1,1) student success rate from strictly earlier timestamp batches",
    primary_comparison="FSRS_OFFICIAL vs HISTORICAL_BETA11 on identical mature-card events",
    criterion="Both paired-seed Brier and log-loss bootstrap upper bounds <0; descriptive, conditional on generator",
    parameters="OFFICIAL_DEFAULTS_NOT_OPTIMIZED_FOR_STUDENT",
    can_apply=False,can_schedule=False,causal_policy_evaluation="NOT_EXECUTED")

class FSRSReference:
    def __init__(self):
        if version("fsrs")!="6.3.2":
            raise RuntimeError("Required official fsrs==6.3.2")
        from fsrs import Scheduler,Card,Rating
        self.Card,self.Rating=Card,Rating
        self.scheduler=Scheduler(enable_fuzzing=False,learning_steps=(),relearning_steps=())
        self.cards,self.history,self.frozen={},{},{}
    def begin_batch(self,student,moment):
        k,n=self.history.get(student,(0,0))
        self.frozen[student]=(k+1)/(n+2)
    def card(self,student,item,moment):
        key=(student,item)
        if key not in self.cards:
            self.cards[key]=self.Card(card_id=int(item[:12],16),due=moment)
        return self.cards[key]
    def predict(self,student,item,moment):
        card=self.card(student,item,moment)
        cold=card.last_review is None or card.stability is None
        probability=None if cold else self.scheduler.get_card_retrievability(card,current_datetime=moment)
        if probability is not None and (not math.isfinite(probability) or not 0<=probability<=1):
            raise ValueError("Invalid official FSRS probability")
        return dict(version=MODEL_VERSION,probability=probability,
            stability=card.stability,difficulty=card.difficulty,
            historical_probability=self.frozen[student])
    def observe(self,student,item,moment,success):
        card=self.card(student,item,moment)
        self.cards[student,item],_=self.scheduler.review_card(card,
            self.Rating.Good if success else self.Rating.Again,review_datetime=moment)
        k,n=self.history.get(student,(0,0))
        self.history[student]=(k+int(success),n+1)

def validate_memory(rows):
    if not rows:
        raise ValueError("No memory evidence")
    from datetime import datetime
    seen=set()
    for row in rows:
        if set(row)!=set(FIELDS):
            raise ValueError("Forbidden or missing memory column")
        if row["origin_type"]!="SYNTHETIC_BENCHMARK":
            raise ValueError("Non-synthetic input")
        if not all(str(row[k]).strip() for k in ("student_id","event_id","question_id")) or row["event_id"] in seen:
            raise ValueError("Missing or duplicate identity")
        seen.add(row["event_id"])
        observed=datetime.fromisoformat(row["occurred_at"].replace("Z","+00:00"))
        predicted=datetime.fromisoformat(row["fsrs_prediction_timestamp"].replace("Z","+00:00"))
        if observed.tzinfo is None or predicted.tzinfo is None or predicted>observed:
            raise ValueError("Invalid temporal evidence")
        if row["is_correct"] not in ("true","false") or row["gabarito_status"]!="DEFINITIVO":
            raise ValueError("Invalid recall outcome")
        p=row["fsrs_retrievability_pre_update"]
        if p!="":
            p=float(p)
            if not math.isfinite(p) or not 0<=p<=1:
                raise ValueError("Invalid probability")
        if row["fsrs_evidence_status"]=="UNCALIBRATED_ITEM_ESTIMATE":
            if p=="" or not row["fsrs_model_version"]:
                raise ValueError("Mature state missing pre-update prediction")
        elif row["fsrs_evidence_status"]!="COLD_START_NO_PREVIOUS_REVIEW" or p!="":
            raise ValueError("Ambiguous cold start")
    return True

def audit_memory(folder):
    folder=Path(folder).resolve()
    meta=json.loads((folder/"manifest.json").read_text(encoding="utf-8"))
    if (meta.get("status")!="SUCCEEDED" or meta.get("source_kind")!="SYNTHETIC_BENCHMARK" or
        meta.get("can_apply") is not False or meta.get("can_schedule") is not False):
        raise ValueError("Invalid memory run authority")
    if (folder/"failure.json").exists():
        raise ValueError("Memory run has failure artifact")
    expected=meta["artifacts"]
    actual={p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file() and p.name!="manifest.json"}
    if set(expected)!=actual:
        raise ValueError("Missing/unlisted memory artifact")
    for name,checksum in expected.items():
        path=(folder/name).resolve()
        if not path.is_relative_to(folder) or sha(path)!=checksum:
            raise ValueError("Memory artifact hash mismatch")
    return dict(status="PASSED_INTEGRITY_ONLY",artifacts=len(actual),manifest_sha256=sha(folder/"manifest.json"),can_apply=False)

def run(output,seeds=None,items=8):
    engine=Path(__file__).resolve().parents[1]
    output=Path(output).resolve()
    allowed=(engine/"tests"/"fixtures"/"learner_lab").resolve()
    if output==allowed or not output.is_relative_to(allowed):
        raise ValueError("Output must be a new synthetic fixture directory")
    seeds=CRITERIA["seeds"] if seeds is None else seeds
    if not seeds or len(set(seeds))!=len(seeds):
        raise ValueError("Distinct seeds required")
    output.mkdir(parents=True,exist_ok=False)
    dump(output/"criteria.json",dict(CRITERIA,seeds=seeds,items_per_student=items))
    events,truth=[],[]
    parameters=None
    for seed in seeds:
        reference=FSRSReference()
        generated,hidden=generate_memory(seed,reference,items)
        parameters=list(reference.scheduler.parameters)
        events.extend(generated)
        truth.extend(dict(r,seed=seed) for r in hidden)
    validate_memory(events)
    observations=output/"observations.csv"
    with observations.open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=FIELDS)
        writer.writeheader();writer.writerows(events)
    snapshot=output/"input-manifest.json"
    dump(snapshot,dict(contract_version="memory_lab_events_v1",source_kind="SYNTHETIC_BENCHMARK",
        input_sha256=sha(observations),row_count=len(events),can_apply=False,can_schedule=False))
    target=output/"r-diagnostics.json"
    result=subprocess.run([resolve_rscript(),str(engine/"lab"/"memory_adapter.R"),
        str(observations),str(target),str(snapshot)],cwd=engine,capture_output=True,
        text=True,errors="replace",timeout=120)
    (output/"r.log").write_text(result.stdout+"\n"+result.stderr,encoding="utf-8")
    if result.returncode:
        raise RuntimeError("Real R memory audit failed: "+str(output/"r.log"))
    # Hidden states never written until R has exited.
    dump(output/"truth.json",truth)
    diagnostics=json.loads(target.read_text(encoding="utf-8"))
    hidden={r["event_id"]:r for r in truth}
    scored=[]
    for row in events:
        if row["fsrs_evidence_status"]!="UNCALIBRATED_ITEM_ESTIMATE":
            continue
        state=hidden[row["event_id"]]
        for name,p in (("FSRS_OFFICIAL",float(row["fsrs_retrievability_pre_update"])),
                       ("HISTORICAL_BETA11",state["historical_prediction"]),("FIXED_050",.5)):
            scored.append(dict(model_name=name,event_id=row["event_id"],student_id=row["student_id"],
                predicted_probability=p,observed_correct=state["observed_correct"],
                true_probability=state["retrieval"],seed=state["seed"]))
    metrics={name:dict(**score([r for r in scored if r["model_name"]==name]),
        reliability=reliability([r for r in scored if r["model_name"]==name]))
        for name in ("FSRS_OFFICIAL","HISTORICAL_BETA11","FIXED_050")}
    r_versions=diagnostics["aggregate"]["prediction_metrics"]["by_fsrs_model_version"]
    # Cross-language independent score agreement is an integration gate.
    measured=r_versions[MODEL_VERSION]
    if (measured["n_observations"]!=metrics["FSRS_OFFICIAL"]["n"] or
        abs(measured["brier_score"]-metrics["FSRS_OFFICIAL"]["brier"])>1e-10 or
        abs(measured["log_loss"]-metrics["FSRS_OFFICIAL"]["log_loss"])>1e-10):
        raise ValueError("R/Python memory scores disagree")
    differences={key:[score([r for r in scored if r["seed"]==seed and r["model_name"]=="FSRS_OFFICIAL"])[key]-
        score([r for r in scored if r["seed"]==seed and r["model_name"]=="HISTORICAL_BETA11"])[key]
        for seed in seeds] for key in ("brier","log_loss")}
    bounds={key:interval(values) for key,values in differences.items()}
    superior=len(seeds)>=5 and all(x[1] is not None and x[1]<0 for x in bounds.values())
    summary=dict(source_kind="SYNTHETIC_BENCHMARK",seeds=seeds,events=len(events),
        cold_start_count=sum(r["fsrs_evidence_status"]!="UNCALIBRATED_ITEM_ESTIMATE" for r in events),
        metrics=metrics,paired_seed_differences=differences,paired_seed_intervals=bounds,
        comparison="SUPERIOR_ONLY_IN_THIS_GENERATOR" if superior else "NO_SUPERIORITY_ESTABLISHED",
        r_python_score_agreement=True,can_apply=False,can_schedule=False,
        policy_effectiveness="NOT_EXECUTED",human_validation="NOT_EXECUTED",
        limitation="Known acquisition; hypothetical forgetting/restudy; fixed calendar; unoptimized FSRS defaults.")
    dump(output/"summary.json",summary)
    import fsrs
    package_root=Path(next(iter(fsrs.__path__)))
    artifacts={p.relative_to(output).as_posix():sha(p) for p in sorted(output.rglob("*")) if p.is_file()}
    dump(output/"manifest.json",dict(status="SUCCEEDED",source_kind="SYNTHETIC_BENCHMARK",
        python_version=platform.python_version(),fsrs_version=version("fsrs"),parameters=parameters,
        input_sha256=sha(observations),artifacts=artifacts,
        package_source_hashes={p.relative_to(package_root).as_posix():sha(p) for p in sorted(package_root.rglob("*.py"))},
        code_hashes={p.name:sha(p) for p in sorted((engine/"lab").glob("*.py"))},
        r_adapter_sha256=sha(engine/"lab"/"memory_adapter.R"),
        r_diagnostics_sha256=sha(engine/"R"/"retrieval_diagnostics.R"),can_apply=False,can_schedule=False))
    audit_memory(output)
    return summary

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    options=parser.parse_args()
    try:
        result=run(options.output)
    except Exception as error:
        allowed=(Path(__file__).resolve().parents[1]/"tests"/"fixtures"/"learner_lab").resolve()
        folder=options.output.resolve()
        if not isinstance(error,FileExistsError) and folder.is_dir() and folder.is_relative_to(allowed):
            dump(folder/"failure.json",dict(status="FAILED",error_type=type(error).__name__,
                error=str(error),source_kind="SYNTHETIC_BENCHMARK",can_apply=False))
        raise
    print(json.dumps(result,sort_keys=True))
