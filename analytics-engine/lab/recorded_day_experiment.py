"""Preregistered untouched-human-cohort clock transport; never product scheduling."""
import argparse
import csv
import json
import platform
import subprocess
from pathlib import Path
from collections import defaultdict
from importlib.metadata import version
from public_data_adapters import parse_fsrs_tsv,digest,validate_prediction_join
from recorded_day_clock import (CLOCKS,FIELDS,load_protocol,acquire_new_cohort,
    validate_declared_prefixes,replay_recorded_clock)
from human_metrics import summarize,paired_comparison
from run_experiment import dump,sha,resolve_rscript

def run(output,download=False,source_run=None):
    engine=Path(__file__).resolve().parents[1];output=Path(output).resolve()
    root=(engine/"lab"/"runs").resolve()
    if output==root or not output.is_relative_to(root):
        raise ValueError("Clock experiment must use a new lab/runs directory")
    output.mkdir(parents=True,exist_ok=False)
    try:
        protocol=load_protocol()
        dump(output/"criteria.json",protocol)
        source=acquire_new_cohort(output/"raw",download,source_run)
        dump(output/"source-manifest.json",source)
        observed={};qa=[];parameters=None
        for record in source["files"]:
            payload=(output/"raw"/record["name"]).read_bytes()
            if digest(payload)!=record["sha256"]:
                raise ValueError("Source snapshot changed")
            rows,quality=parse_fsrs_tsv(payload,record["path"],origin_type="PUBLIC_HUMAN_DATASET")
            validate_declared_prefixes(payload,rows)
            observed[record["path"]]=rows
            qa.append(dict(source_file=record["path"],prefix_validation="PASSED",**quality))
        outcomes={};reports={};joined=[]
        for basis in CLOCKS:
            folder=output/basis;folder.mkdir()
            records=[]
            for source_id,rows in observed.items():
                events,current=replay_recorded_clock(rows,source_id,basis)
                records.extend(events)
                if parameters is not None and parameters!=current:
                    raise ValueError("Canonical reference parameters changed")
                parameters=current
            path=folder/"observations.csv"
            with path.open("w",encoding="utf-8",newline="") as stream:
                writer=csv.DictWriter(stream,fieldnames=FIELDS);writer.writeheader();writer.writerows(records)
            dump(folder/"snapshot.json",dict(contract_version="recorded_day_memory_v1",
                origin_type="PUBLIC_HUMAN_DATASET",input_sha256=sha(path),row_count=len(records),clock_basis=basis,
                can_apply=False,can_schedule=False))
            proc=subprocess.run([resolve_rscript(),str(engine/"lab"/"recorded_day_adapter.R"),
                str(path),str(folder/"r-results.json"),str(folder/"snapshot.json")],
                cwd=engine,capture_output=True,text=True,errors="replace",timeout=300)
            (folder/"r.log").write_text(proc.stdout+"\n"+proc.stderr,encoding="utf-8")
            if proc.returncode:
                raise RuntimeError("Real R clock analysis failed: "+proc.stderr[-2000:])
            result=json.loads((folder/"r-results.json").read_text(encoding="utf-8"))
            if result.get("can_apply") is not False or result.get("can_schedule") is not False:
                raise ValueError("Clock arm acquired decision authority")
            if result.get("reference_time_basis")!=basis:
                raise ValueError("R returned a different clock arm")
            predictions=result["predictions"]
            if not isinstance(predictions,list) or not predictions:
                raise ValueError("No new-cohort R predictions")
            validate_prediction_join(predictions,records)
            report=summarize(predictions)
            for name,measured in result["scores"].items():
                score=report["metrics"][name]
                if measured["n"]!=score["n"] or any(abs(measured[key]-score[key])>1e-10 for key in ("brier","log_loss")):
                    raise ValueError("R/Python score disagreement")
            domain=defaultdict(int)
            for row in records:
                domain[row["prediction_status"]]+=1
            report.update(dict(reference_clock=basis,scoring_domain_counts=dict(domain),
                n_source_events=len(records),students=result["students"],
                technical_transport=result["clock_transport"],r_version=result["r_version"],
                original_timezone="NOT_RECOVERED",can_schedule=False))
            dump(folder/"summary.json",report)
            reports[basis]=report
            outcomes[basis]={(row["event_id"],row["student_id"],row["question_id"],row["occurred_at"],row["is_correct"],row["prediction_status"]) for row in records}
            joined.extend(dict(row,model_name=basis+"::"+row["model_name"]) for row in predictions)
        if outcomes[CLOCKS[0]]!=outcomes[CLOCKS[1]]:
            raise ValueError("Arms differ in observed identity/outcome/time/domain")
        comparison=paired_comparison(joined,"SOURCE_RECORDED_DAYS::FSRS_DEFAULT","UTC_WHOLE_24H::FSRS_DEFAULT")
        comparison["uncertainty"]="Paired source-collection bootstrap; conditional on this selected cohort"
        summary=dict(source_kind="PUBLIC_HUMAN_DATASET",protocol_version=protocol["version"],
            data_revision=source["revision"],new_source_files=len(source["files"]),
            prior_cohort_overlap=0,qa=qa,arms=reports,primary_clock_comparison=comparison,
            causal_policy_effectiveness="NOT_EXECUTED",original_timezone="NOT_RECOVERED",
            memory_curve_validity="NOT_IDENTIFIED",personal_validation="NOT_EXECUTED",
            source_day_transport="TECHNICALLY_CHECKED_NOT_EMPIRICAL_PERSONAL_VALIDATION",
            fsrs_pretraining_overlap="UNKNOWN",can_apply=False,can_schedule=False)
        dump(output/"summary.json",summary)
        import fsrs
        package=Path(next(iter(fsrs.__path__)))
        code=["recorded_day_clock.py","recorded_day_adapter.R","recorded_day_experiment.py",
            "CLOCK_VALIDATION_PROTOCOL.json","human_memory_adapter.R","individual_calibration.R",
            "human_metrics.py","public_data_adapters.py","run_experiment.py"]
        dump(output/"manifest.json",dict(status="SUCCEEDED",source_kind="PUBLIC_HUMAN_DATASET",
            artifacts={p.relative_to(output).as_posix():sha(p) for p in sorted(output.rglob("*")) if p.is_file()},
            code_hashes={name:sha(engine/"lab"/name) for name in code},
            r_source_hashes={name:sha(engine/"R"/name) for name in ("descriptive_analysis.R","provenance.R")},
            fsrs_version=version("fsrs"),fsrs_parameters=parameters,python_version=platform.python_version(),
            fsrs_source_hashes={p.relative_to(package).as_posix():sha(p) for p in sorted(package.rglob("*.py"))},
            can_apply=False,can_schedule=False))
        return summary
    except Exception as error:
        dump(output/"failure.json",dict(status="FAILED",error=str(error),can_apply=False))
        raise

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True);parser.add_argument("--download",action="store_true")
    parser.add_argument("--source-run",type=Path)
    opts=parser.parse_args()
    result=run(opts.output,opts.download,opts.source_run)
    print(json.dumps(dict(primary=result["primary_clock_comparison"],cohort=result["new_source_files"],
        arms={name:{key:value for key,value in report.items() if key not in ("students","horizons")} for name,report in result["arms"].items()},
        can_apply=False,can_schedule=False),sort_keys=True))
