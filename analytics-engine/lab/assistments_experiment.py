"""Separate human first-attempt experiment. No FSRS, fake timestamps or hint leakage."""
import argparse
import json
import subprocess
from pathlib import Path
from collections import defaultdict
from public_data_adapters import acquire_assistments,parse_assistments_csv,clone_public_snapshot
from human_metrics import metrics,paired_comparison
from run_experiment import dump,sha,resolve_rscript

def run(output,download=False,source_run=None):
    engine=Path(__file__).resolve().parents[1];output=Path(output).resolve()
    root=(engine/"lab"/"runs").resolve()
    if output==root or not output.is_relative_to(root):
        raise ValueError("ASSISTments must use a new lab/runs subdirectory")
    output.mkdir(parents=True,exist_ok=False)
    try:
        dump(output/"criteria.json",dict(target="First attempt correctness; help counts as failure",
            selection="12 midpoint-rank history-length strata, eligible 50..500 logical events; complete selected histories",
            warmup=10,models=["PERSONAL_HISTORICAL","SMOOTHED_SKILL_SET","MOVING_5"],
            chronology="Official order_id only; no absolute time or retention horizons inferred",
            primary="SMOOTHED_SKILL_SET vs PERSONAL_HISTORICAL",
            acceptance="Five or more paired students and both Brier/log loss bootstrap upper bounds below zero",
            can_apply=False,can_schedule=False))
        if bool(download)==bool(source_run):
            raise ValueError("Choose --download OR --source-run")
        if download:
            payload,source=acquire_assistments(output/"raw",True)
        else:
            source=clone_public_snapshot(source_run,output/"raw","assistments")
            payload=(output/"raw"/"corrected.csv").read_bytes()
        dump(output/"source-manifest.json",source)
        # Byte-preserving decoding, NOT an inference about natural-language encoding.
        events,qa=parse_assistments_csv(payload,encoding="latin-1",origin_type="PUBLIC_HUMAN_DATASET")
        users=defaultdict(list)
        for event in events:
            if not event["student_id"] or any(not skill.isascii() or not skill.isdigit() for skill in event["skill_ids"]):
                # Missing skill is retained as unknown; non-numeric unexpected tags stop the data contract.
                if event["skill_ids"] not in ((),("NA",)):
                    raise ValueError("Unexpected curricular skill ID encoding")
            users[event["student_id"]].append(event)
        frame=sorted([(len(rows),id) for id,rows in users.items() if 50<=len(rows)<=500])
        if len(frame)<12:
            raise ValueError("Insufficient ASSISTments eligible histories")
        chosen=[frame[min(len(frame)-1,int((i+.5)*len(frame)/12))][1] for i in range(12)]
        normalized=[]
        for id in chosen:
            for e in users[id]:
                normalized.append(dict(event_id=e["event_id"],student_id=id,question_id=e["question_id"],
                    event_order=e["event_order"],skill_key="_".join(e["skill_ids"]) or "UNCLASSIFIED",
                    is_correct=e["is_correct"],chronology=e["chronology"],origin_type=e["origin_type"]))
        dump(output/"events.json",normalized)
        dump(output/"snapshot.json",dict(contract_version="assistments_ordered_v1",input_sha256=sha(output/"events.json"),
            row_count=len(normalized),can_apply=False))
        process=subprocess.run([resolve_rscript(),str(engine/"lab"/"assistments_adapter.R"),
            str(output/"events.json"),str(output/"r-results.json"),str(output/"snapshot.json")],
            cwd=engine,capture_output=True,text=True,errors="replace",timeout=300)
        (output/"r.log").write_text(process.stdout+"\n"+process.stderr,encoding="utf-8")
        if process.returncode:
            raise RuntimeError("ASSISTments R failed: "+process.stderr[-2000:])
        actual=json.loads((output/"r-results.json").read_text(encoding="utf-8"))
        if actual["can_apply"] is not False or actual["can_schedule"] is not False:
            raise ValueError("Unexpected authority")
        rows=actual["predictions"]
        if not rows:
            raise ValueError("No ASSISTments predictions")
        names=sorted({r["model_name"] for r in rows})
        report=dict(source_kind="PUBLIC_HUMAN_DATASET",source=source,qa=qa,
            selected_students=len(chosen),selected_events=len(normalized),eligible_students=len(frame),
            metrics={m:metrics([r for r in rows if r["model_name"]==m]) for m in names},
            comparisons=[paired_comparison(rows,"SMOOTHED_SKILL_SET","PERSONAL_HISTORICAL")],
            novelty={label:{m:metrics([r for r in rows if r["model_name"]==m and r["novelty"]==label]) for m in names}
                for label in ("FIRST_OBSERVED_ITEM","REPEATED_ITEM")},
            time_horizons="NOT_AVAILABLE",memory_validation="NOT_APPLICABLE",
            transfer="First observed item is NOT proof of conceptual transfer",
            policy_effectiveness="NOT_EXECUTED",personal_validation="NOT_EXECUTED",can_apply=False,can_schedule=False)
        dump(output/"summary.json",report)
        dump(output/"manifest.json",dict(status="SUCCEEDED",source_kind="PUBLIC_HUMAN_DATASET",
            artifacts={p.relative_to(output).as_posix():sha(p) for p in output.rglob("*") if p.is_file()},
            code_hashes={name:sha(engine/"lab"/name) for name in
                ("assistments_experiment.py","assistments_adapter.R","public_data_adapters.py","human_metrics.py")},
            r_baselines_sha256=sha(engine/"R"/"baselines.R"),r_version=actual["r_version"],
            can_apply=False,can_schedule=False))
        return report
    except Exception as error:
        dump(output/"failure.json",dict(status="FAILED",error=str(error),can_apply=False))
        raise

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--download",action="store_true")
    parser.add_argument("--source-run",type=Path)
    opts=parser.parse_args();result=run(opts.output,opts.download,opts.source_run)
    print(json.dumps({k:v for k,v in result.items() if k not in ("qa","novelty")},sort_keys=True))
