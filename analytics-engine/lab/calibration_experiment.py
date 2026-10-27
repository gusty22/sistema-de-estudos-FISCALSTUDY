"""Synthetic temporal calibration and diagnostic identifiability, never production.
The R processes receive only observable files; truth is persisted after ALL R exits.
"""
import argparse
import csv
import json
import math
from pathlib import Path
import platform
import subprocess
from importlib.metadata import version
from memory_benchmark import FSRSReference, validate_memory, MODEL_VERSION
from memory_simulator import FIELDS, generate_memory
from identifiability_simulator import FIELDS as PROBE_FIELDS, generate_probes
from run_experiment import dump, sha, resolve_rscript, score, reliability, interval

CRITERIA=dict(contract_version="calibration_lab_v1",source_kind="SYNTHETIC_BENCHMARK",
    seeds=[811,839,863,887,911],memory_items=8,probe_items=64,probe_pairs=4,
    split="Per student: mature batches 1..3 TRAIN, batch 4 VALIDATION, batches 5..6 TEST",
    fit="Logit intercept offset of official pre-update FSRS; global ridge=1; individual ridge centered at global",
    penalty_candidates=[1,4,16],selection="Lowest validation log loss, fixed candidate order breaks ties",
    test_use="Score only; never fit, select, or refit on test outcomes",
    comparison="INDIVIDUAL_SHRUNK_SHIFT vs GLOBAL_SHIFT; same future events",
    superiority="At least five seeds and paired seed bootstrap upper bounds <0 for BOTH Brier and log loss",
    identifiability="Paired students with identical immediate observations; single delayed tests on distinct items",
    detection="Non-overlapping Wilson95 intervals AND correct ordering evaluated against hidden truth",
    probe_sample_sizes=[2,8,32,64],lags_days=[1,7,28],
    limits="Only recall probabilities under known acquisition; half-life, conceptual knowledge and causal policy not identified",
    can_apply=False,can_schedule=False)

def write_csv(path,fields,rows):
    with path.open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=fields)
        writer.writeheader();writer.writerows(rows)

def call_r(engine,arguments,log_path):
    result=subprocess.run([resolve_rscript(),*map(str,arguments)],cwd=engine,
        capture_output=True,text=True,errors="replace",timeout=180)
    log_path.write_text(result.stdout+"\n"+result.stderr,encoding="utf-8")
    if result.returncode:
        raise RuntimeError("R experiment failed: "+str(log_path))

def compare_predictions(predictions,truth,seeds):
    hidden={row["event_id"]:row for row in truth}
    if len(hidden)!=len(truth):
        raise ValueError("Duplicate hidden event identity")
    scored=[]
    seen=set()
    for row in predictions:
        key=(row["model_name"],row["event_id"])
        if key in seen or row["event_id"] not in hidden:
            raise ValueError("Duplicate/unmatched prediction")
        seen.add(key)
        p=float(row["predicted_probability"])
        actual=hidden[row["event_id"]]
        if not math.isfinite(p) or not 0<=p<=1 or row["observed_correct"]!=actual["observed_correct"]:
            raise ValueError("Invalid prediction/outcome join")
        scored.append(dict(row,seed=actual["seed"],true_probability=actual["retrieval"]))
    names=sorted({r["model_name"] for r in scored})
    targets=[{r["event_id"] for r in scored if r["model_name"]==m} for m in names]
    if not names or any(ids!=targets[0] for ids in targets):
        raise ValueError("Unequal model target coverage")
    metrics={name:dict(**score([r for r in scored if r["model_name"]==name]),
        reliability=reliability([r for r in scored if r["model_name"]==name])) for name in names}
    contrasts={}
    for baseline in ("GLOBAL_SHIFT","FSRS_OFFICIAL","TRAIN_BETA11","STUDENT_TRAIN_BETA11"):
        differences={key:[] for key in ("brier","log_loss")}
        for seed in seeds:
            left=score([r for r in scored if r["seed"]==seed and r["model_name"]=="INDIVIDUAL_SHRUNK_SHIFT"])
            right=score([r for r in scored if r["seed"]==seed and r["model_name"]==baseline])
            for key in differences:
                differences[key].append(left[key]-right[key])
        bounds={key:interval(values) for key,values in differences.items()}
        approved=len(seeds)>=5 and all(v[1] is not None and v[1]<0 for v in bounds.values())
        contrasts[baseline]=dict(paired_seed_differences=differences,paired_seed_intervals=bounds,
            status="APROVADO_SOMENTE_NESTE_SIMULADOR" if approved else "INCONCLUSIVO_OU_SEM_SUPERIORIDADE")
    by_student={}
    for student in sorted({r["student_id"] for r in scored}):
        by_student[student]={name:score([r for r in scored if r["student_id"]==student and r["model_name"]==name])
            for name in names}
    return dict(metrics=metrics,comparisons=contrasts,by_student=by_student,
        unique_test_events=len(targets[0]),independent_seed_clusters=len(seeds),
        personal_calibration="NOT_VALIDATED",half_life="NOT_ESTIMATED",can_apply=False)

def evaluate_identifiability(estimates,truth,seeds):
    known={r["student_id"]:r for r in truth}
    groups={}
    for row in estimates:
        state=known[row["student_id"]]
        key=(state["pair_id"],row["phase"],row["n"])
        groups.setdefault(key,[]).append((row,state))
    totals={}
    for (pair,phase,n),rows in groups.items():
        if len(rows)!=2:
            raise ValueError("Incomplete diagnostic pair")
        rows.sort(key=lambda value:value[1]["half_life"])
        (low,ls),(high,hs)=rows
        separated=high["lower"]>low["upper"]
        wrong=low["lower"]>high["upper"]
        key=(ls["form"],ls["lag_days"],phase,n)
        totals.setdefault(key,[]).append(dict(seed=ls["seed"],separated=int(separated),wrong=int(wrong)))
    summaries=[]
    for (form,lag,phase,n),rows in sorted(totals.items()):
        rates=[sum(r["separated"] for r in rows if r["seed"]==seed)/sum(r["seed"]==seed for r in rows)
            for seed in seeds]
        summaries.append(dict(form=form,lag_days=lag,phase=phase,observations_per_student=n,
            pairs=len(rows),correctly_separated=sum(r["separated"] for r in rows),
            wrongly_separated=sum(r["wrong"] for r in rows),
            detection_rate=sum(r["separated"] for r in rows)/len(rows),
            mean_seed_detection_interval=interval(rates)))
    return dict(strata=summaries,
        immediate_invariance=all(s["correctly_separated"]==s["wrongly_separated"]==0
            for s in summaries if s["phase"]=="IMMEDIATE"),
        latent_parameters="NOT_IDENTIFIED",knowledge_vs_forgetting="NOT_IDENTIFIED",
        policy_benefit="NOT_EXECUTED",can_apply=False)

def audit(folder):
    folder=Path(folder).resolve()
    manifest=json.loads((folder/"manifest.json").read_text(encoding="utf-8"))
    if manifest.get("status")!="SUCCEEDED" or manifest.get("can_apply") is not False or manifest.get("can_schedule") is not False:
        raise ValueError("Invalid experimental authority/status")
    if manifest.get("source_kind")!="SYNTHETIC_BENCHMARK":
        raise ValueError("Invalid experimental origin")
    if (folder/"failure.json").exists():
        raise ValueError("Failed run")
    expected=manifest["artifacts"]
    actual={p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file() and p.name!="manifest.json"}
    if set(expected)!=actual:
        raise ValueError("Unlisted or missing artifact")
    for name,checksum in expected.items():
        path=(folder/name).resolve()
        if not path.is_relative_to(folder) or sha(path)!=checksum:
            raise ValueError("Artifact hash mismatch")
    return dict(status="PASSED_INTEGRITY_ONLY",artifacts=len(actual),can_apply=False)

def run(output,seeds=None,items=8,probe_items=64,pairs=4):
    engine=Path(__file__).resolve().parents[1]
    output=Path(output).resolve()
    allowed=(engine/"tests"/"fixtures"/"learner_lab").resolve()
    if output==allowed or not output.is_relative_to(allowed):
        raise ValueError("Output outside new synthetic fixture directory")
    seeds=CRITERIA["seeds"] if seeds is None else seeds
    if not seeds or len(set(seeds))!=len(seeds):
        raise ValueError("Distinct seeds required")
    output.mkdir(parents=True,exist_ok=False)
    try:
        dump(output/"criteria.json",dict(CRITERIA,seeds=seeds,memory_items=items,probe_items=probe_items,probe_pairs=pairs))
        events,truth=[],[]
        parameters=None
        for seed in seeds:
            reference=FSRSReference()
            current=list(reference.scheduler.parameters)
            if parameters is not None and parameters!=current:
                raise ValueError("Reference parameters changed across seeds")
            parameters=current
            rows,hidden=generate_memory(seed,reference,items)
            events.extend(rows);truth.extend(dict(r,seed=seed) for r in hidden)
        validate_memory(events)
        probes,probe_truth=generate_probes(seeds,probe_items,pairs)
        obs,probe_file=output/"observations.csv",output/"probes.csv"
        write_csv(obs,FIELDS,events);write_csv(probe_file,PROBE_FIELDS,probes)
        dump(output/"memory-input.json",dict(contract_version="memory_lab_events_v1",
            source_kind="SYNTHETIC_BENCHMARK",input_sha256=sha(obs),row_count=len(events),can_apply=False,can_schedule=False))
        dump(output/"input-manifest.json",dict(contract_version="calibration_lab_v1",
            source_kind="SYNTHETIC_BENCHMARK",memory_sha256=sha(obs),probes_sha256=sha(probe_file),
            memory_rows=len(events),probe_rows=len(probes),can_apply=False,can_schedule=False))
        call_r(engine,[engine/"lab"/"memory_adapter.R",obs,output/"memory-r.json",output/"memory-input.json"],output/"memory-r.log")
        call_r(engine,[engine/"lab"/"calibration_adapter.R",obs,probe_file,output/"calibration-r.json",output/"input-manifest.json"],output/"calibration-r.log")
        # All model processes are finished before any hidden generator state is persisted.
        dump(output/"truth.json",truth);dump(output/"probe-truth.json",probe_truth)
        result=json.loads((output/"calibration-r.json").read_text(encoding="utf-8"))
        if result.get("can_apply") is not False or result.get("can_schedule") is not False:
            raise ValueError("R acquired decision authority")
        calibration=compare_predictions(result["calibration"]["predictions"],truth,seeds)
        # Independent Python recomputation of the R's untouched test-event scores.
        for model,metrics in calibration["metrics"].items():
            r_metric=result["calibration"]["metrics"][model]
            if r_metric["n"]!=metrics["n"] or any(abs(r_metric[k]-metrics[k])>1e-10 for k in ("brier","log_loss")):
                raise ValueError("R/Python calibration score disagreement")
        identifiability=evaluate_identifiability(result["identifiability"]["estimates"],probe_truth,seeds)
        summary=dict(source_kind="SYNTHETIC_BENCHMARK",calibration=calibration,
            identifiability=identifiability,r_python_score_agreement=True,
            can_apply=False,can_schedule=False,human_validation="NOT_EXECUTED",causal_policy_evaluation="NOT_EXECUTED")
        dump(output/"summary.json",summary)
        artifacts={p.relative_to(output).as_posix():sha(p) for p in sorted(output.rglob("*")) if p.is_file()}
        sources=[engine/"lab"/name for name in ("calibration_experiment.py","individual_calibration.R",
            "calibration_adapter.R","identifiability_simulator.py","memory_benchmark.py","memory_simulator.py",
            "memory_adapter.R","simulator.py","run_experiment.py")]
        sources += [engine/"R"/name for name in ("descriptive_analysis.R","provenance.R","retrieval_diagnostics.R","baselines.R")]
        import fsrs
        package_root=Path(next(iter(fsrs.__path__)))
        dump(output/"manifest.json",dict(status="SUCCEEDED",source_kind="SYNTHETIC_BENCHMARK",
            artifacts=artifacts,code_hashes={p.relative_to(engine).as_posix():sha(p) for p in sources},
            python_version=platform.python_version(),fsrs_version=version("fsrs"),fsrs_model=MODEL_VERSION,
            fsrs_parameters=parameters,fsrs_package_source_hashes={p.relative_to(package_root).as_posix():sha(p) for p in sorted(package_root.rglob("*.py"))},
            can_apply=False,can_schedule=False))
        audit(output)
        return summary
    except Exception as error:
        dump(output/"failure.json",dict(status="FAILED",error_type=type(error).__name__,error=str(error),can_apply=False))
        raise

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    opts=parser.parse_args()
    print(json.dumps(run(opts.output),sort_keys=True))
