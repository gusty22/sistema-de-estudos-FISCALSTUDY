"""Contextual correctness experiment. Reuses real source adapters and original baseline replay."""
import argparse
import json
import subprocess
from pathlib import Path
from assistments_experiment import run as reference_run
from public_data_adapters import validate_prediction_join
from run_experiment import dump, sha, resolve_rscript

CRITERIA = dict(
    protocol="contextual-v1-fixed-before-execution",
    hypothesis="Prefix-only content shrinkage and online ridge context may improve future correctness",
    target="ASSISTments first-attempt correctness; help counts as failure, NOT memory recall",
    split="Per student final 20 percent ordinal events; preceding events train online",
    evaluation="Predict then update; earlier test outcomes may update subsequent forecasts, never hyperparameters",
    models=["PERSONAL_BETA11_PREFIX_V1", "RECENT20_BETA11_V1", "CONTENT_SHRINK20_V1", "CONTEXT_ONLINE_RIDGE_V1"],
    parameters=dict(warmup=10, recent_window=20, content_prior_weight=20,
                    logistic_learning_rate=.05, logistic_ridge=.01),
    selection="No model or hyperparameter selection on final outcomes",
    acceptance="Exploratory only; report both proper-score differences, cluster uncertainty and harms; no automatic promotion",
    exposure="This published dataset/sample was previously inspected by project; development-exposed external replication, not untouched confirmatory test",
    uncertainty="Paired selected-student cluster bootstrap, conditional on fitted prequential trajectories; not personal temporal uncertainty",
    can_apply=False, can_schedule=False)

def run(output, download=False, source_run=None):
    engine=Path(__file__).resolve().parents[1]
    root=(engine/"lab"/"runs").resolve();output=Path(output).resolve()
    if output==root or not output.is_relative_to(root):
        raise ValueError("New lab/runs subdirectory required")
    output.mkdir(parents=True,exist_ok=False)
    dump(output/"criteria.json",CRITERIA)  # Persist criteria BEFORE source retrieval/evaluation.
    try:
        old=reference_run(output/"reference",download,source_run)
        process=subprocess.run([resolve_rscript(),str(engine/"lab"/"contextual_adapter.R"),
            str(output/"reference"/"events.json"),str(output/"results.json"),
            str(output/"reference"/"snapshot.json")],cwd=engine,capture_output=True,text=True,timeout=300)
        (output/"r.log").write_text(process.stdout+"\n"+process.stderr,encoding="utf-8")
        if process.returncode:
            raise RuntimeError("Contextual R failed: "+process.stderr[-1500:])
        result=json.loads((output/"results.json").read_text(encoding="utf-8"))
        if result.get("can_apply") is not False or result.get("can_schedule") is not False:
            raise ValueError("Unexpected authority")
        events=json.loads((output/"reference"/"events.json").read_text(encoding="utf-8"))
        validate_prediction_join(result["predictions"],events)
        counts={name:len([r for r in result["predictions"] if r["model_name"]==name])
                for name in CRITERIA["models"]}
        if len(set(counts.values()))!=1 or not all(counts.values()):
            raise ValueError("Incomplete paired coverage")
        # A sanitized aggregate is the only publishable experiment artifact.
        summary={k:v for k,v in result.items() if k!="predictions"}
        for comparison in summary["comparisons"].values():
            comparison["harmed_student_count"]=len(comparison.pop("harmed_students"))
            comparison.pop("student_differences")
        summary["source_kind"]="PUBLIC_HUMAN_DATASET"
        summary["source_sha256"]=sha(output/"reference"/"raw"/"corrected.csv")
        summary["source_manifest_sha256"]=sha(output/"reference"/"source-manifest.json")
        summary["selected_students"]=old["selected_students"]
        summary["selected_events"]=old["selected_events"]
        summary["original_baselines_reproduced"]=old["metrics"]
        summary["classification_provenance"]="Official event skill annotations; no human-reviewed equivalence or fiscal-domain validity"
        dump(output/"summary.json",summary)
        dump(output/"manifest.json",dict(status="SUCCEEDED",source_kind="PUBLIC_HUMAN_DATASET",
            artifacts={p.relative_to(output).as_posix():sha(p) for p in sorted(output.rglob("*")) if p.is_file()},
            code_hashes={name:sha(engine/"lab"/name) for name in (
                "contextual_experiment.py","contextual_prequential.R","contextual_adapter.R",
                "assistments_experiment.py","assistments_adapter.R","public_data_adapters.py","human_metrics.py")},
            can_apply=False,can_schedule=False))
        return summary
    except Exception:
        dump(output/"failure.json",dict(status="FAILED",can_apply=False,can_schedule=False))
        raise

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--output",type=Path,required=True)
    p.add_argument("--download",action="store_true");p.add_argument("--source-run",type=Path)
    a=p.parse_args()
    print(json.dumps(run(a.output,a.download,a.source_run),sort_keys=True))
