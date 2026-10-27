"""First retrospective human memory gate. Online source access is explicit."""
import argparse
import csv
import json
import platform
import subprocess
from pathlib import Path
from importlib.metadata import version
from public_data_adapters import acquire_fsrs,parse_fsrs_tsv,replay_fsrs,NORMAL_FIELDS,digest
from human_metrics import summarize,metrics
from run_experiment import dump,sha,resolve_rscript

CRITERIA=dict(version="human-memory-protocol-v1",source_kind="PUBLIC_HUMAN_DATASET",
    sample="12 complete files at midpoint size-ranks in 50KB..1MB eligibility frame; no outcome-based selection",
    split="Within student by timestamp batches: 60% train, 20% validation, 20% final test",
    global_fit="Other students ONLY; donor time strictly earlier than the target training cutoff",
    personalization="Reuse PR32 fit_shift; shrinkage 1/4/16 selected on validation log loss; freeze before final test",
    uncertainty="100 training-item cluster bootstrap, conditional on selected penalty/global model",
    minimum_calibration_events=30,minimum_calibration_items=20,minimum_timestamp_batches=10,
    thresholds="Experimental coverage policy, NOT a proven sufficient sample size",
    primary="INDIVIDUAL_CALIBRATION vs GLOBAL_CALIBRATION on identical test events",
    acceptance="At least five paired students, equal coverage and BOTH paired student bootstrap upper bounds <0",
    baseline="Official FSRS 6.3.2 defaults with actual 1..4 ratings; online personal Beta(1,1) from prior batches",
    fsrs_pretraining_overlap="UNKNOWN; do not claim fully independent validation of pretrained FSRS defaults",
    hypothesis="Predict self-reported flashcard recall; not multiple-choice accuracy or conceptual mastery",
    can_apply=False,can_schedule=False)

def run(output,download=False):
    engine=Path(__file__).resolve().parents[1];output=Path(output).resolve()
    allowed=(engine/"lab"/"runs").resolve()
    if output==allowed or not output.is_relative_to(allowed):
        raise ValueError("Output must be a new lab/runs subdirectory")
    if not download:
        raise RuntimeError("Explicit --download required for external research data")
    output.mkdir(parents=True,exist_ok=False)
    try:
        dump(output/"criteria.json",CRITERIA)
        source=acquire_fsrs(output/"raw",download=True)
        dump(output/"source-manifest.json",source)
        events=[];qa=[];parameters=None
        for record in source["files"]:
            payload=(output/"raw"/record["name"]).read_bytes()
            if digest(payload)!=record["sha256"]:
                raise ValueError("Source snapshot changed")
            rows,quality=parse_fsrs_tsv(payload,record["path"],origin_type="PUBLIC_HUMAN_DATASET")
            observations,current=replay_fsrs(rows,record["path"],origin_type="PUBLIC_HUMAN_DATASET")
            if parameters is not None and parameters!=current:
                raise ValueError("FSRS parameters changed")
            parameters=current;events.extend(observations)
            qa.append(dict(source_file=record["path"],**quality,
                n_cold=sum(row["predicted_probability"]=="" for row in observations),
                first_timestamp=observations[0]["occurred_at"] if observations else None,
                last_timestamp=observations[-1]["occurred_at"] if observations else None))
        obs=output/"observations.csv"
        with obs.open("w",encoding="utf-8",newline="") as stream:
            writer=csv.DictWriter(stream,fieldnames=NORMAL_FIELDS);writer.writeheader();writer.writerows(events)
        dump(output/"snapshot.json",dict(contract_version="public_memory_v1",origin_type="PUBLIC_HUMAN_DATASET",
            input_sha256=sha(obs),row_count=len(events),can_apply=False,can_schedule=False))
        result=subprocess.run([resolve_rscript(),str(engine/"lab"/"human_memory_adapter.R"),
            str(obs),str(output/"r-results.json"),str(output/"snapshot.json")],cwd=engine,
            capture_output=True,text=True,errors="replace",timeout=300)
        (output/"r.log").write_text(result.stdout+"\n"+result.stderr,encoding="utf-8")
        if result.returncode:
            raise RuntimeError("Real human-data R analysis failed: "+result.stderr[-2000:])
        analytical=json.loads((output/"r-results.json").read_text(encoding="utf-8"))
        if analytical.get("can_apply") is not False or analytical.get("can_schedule") is not False:
            raise ValueError("Unexpected authority")
        predictions=analytical["predictions"]
        if not isinstance(predictions,list) or not predictions:
            raise ValueError("No human predictions; not a successful validation")
        report=summarize(predictions)
        for model,rs in analytical["scores"].items():
            ps=report["metrics"][model]
            if rs["n"]!=ps["n"] or any(abs(rs[key]-ps[key])>1e-10 for key in ("brier","log_loss")):
                raise ValueError("R/Python observed score mismatch")
        report.update(dict(source_kind="PUBLIC_HUMAN_DATASET",dataset=source["dataset"],revision=source["revision"],
            n_input_events=len(events),qa=qa,students=analytical["students"],
            total_cold=analytical["n_cold"],r_python_score_agreement=True,
            generalization=analytical["global_generalization"],
            fsrs_pretraining_overlap="UNKNOWN",policy_effectiveness="NOT_EXECUTED",
            conceptual_knowledge="NOT_IDENTIFIED",personal_validation="NOT_EXECUTED",can_schedule=False))
        dump(output/"summary.json",report)
        sources=["public_data_adapters.py","human_learning_experiment.py","human_metrics.py",
            "human_memory_adapter.R","individual_calibration.R"]
        import fsrs
        package=Path(next(iter(fsrs.__path__)))
        artifacts={p.relative_to(output).as_posix():sha(p) for p in sorted(output.rglob("*")) if p.is_file()}
        dump(output/"manifest.json",dict(status="SUCCEEDED",source_kind="PUBLIC_HUMAN_DATASET",
            artifacts=artifacts,fsrs_version=version("fsrs"),fsrs_parameters=parameters,
            fsrs_source_hashes={p.relative_to(package).as_posix():sha(p) for p in sorted(package.rglob("*.py"))},
            code_hashes={name:sha(engine/"lab"/name) for name in sources},
            r_source_hashes={name:sha(engine/"R"/name) for name in ("descriptive_analysis.R","provenance.R")},
            python_version=platform.python_version(),r_version=analytical["r_version"],can_apply=False,can_schedule=False))
        return report
    except Exception as error:
        dump(output/"failure.json",dict(status="FAILED",error=str(error),can_apply=False))
        raise

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--download",action="store_true")
    opts=parser.parse_args()
    report=run(opts.output,opts.download)
    print(json.dumps({k:v for k,v in report.items() if k not in ("qa","students","horizons")},sort_keys=True))
