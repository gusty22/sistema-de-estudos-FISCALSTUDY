"""Executed R calibration/leakage and independent generator tests, not human validation."""
import copy
import csv
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from importlib.metadata import version, PackageNotFoundError
import calibration_experiment
from calibration_experiment import run,audit,write_csv
from identifiability_simulator import generate_probes,FIELDS
from run_experiment import resolve_rscript,sha

ENGINE=Path(__file__).resolve().parents[1]
ROOT=ENGINE/"tests"/"fixtures"/"learner_lab"
def has_fsrs():
    try:
        return version("fsrs")=="6.3.2"
    except PackageNotFoundError:
        return False

class ProbeTests(unittest.TestCase):
    def test_independent_generator_and_observational_equivalence(self):
        events,truth=generate_probes([19],items=8,pairs=1)
        self.assertEqual((events,truth),generate_probes([19],items=8,pairs=1))
        self.assertTrue(all(set(row)==set(FIELDS) for row in events))
        self.assertTrue(all(row["is_correct"]=="true" for row in events if row["phase"]=="IMMEDIATE"))
        self.assertEqual({row["half_life"] for row in truth},{1.5,18.})
        self.assertEqual({row["form"] for row in truth},{"exponential","power"})
        pairs={}
        for row in truth:
            pairs.setdefault(row["pair_id"],[]).append(row)
        self.assertTrue(all(len(pair)==2 and pair[0]["delayed_probability"]!=pair[1]["delayed_probability"]
            for pair in pairs.values()))

    def test_invalid_generator_arguments(self):
        for seeds,items,pairs in (([],8,1),([1,1],8,1),([1],1,1),([1],65,1),([1],8,0)):
            with self.assertRaises(ValueError):
                generate_probes(seeds,items,pairs)

@unittest.skipUnless(has_fsrs(),"NOT_EXECUTED: optional official fsrs==6.3.2 unavailable")
class CalibrationTests(unittest.TestCase):
    def test_end_to_end_real_r_and_manifest(self):
        with tempfile.TemporaryDirectory(prefix="calibration-",dir=ROOT) as temporary:
            folder=Path(temporary)/"run"
            result=run(folder,seeds=[97],items=2,probe_items=8,pairs=1)
            self.assertTrue(result["r_python_score_agreement"])
            self.assertEqual(result["calibration"]["unique_test_events"],16)
            self.assertTrue(result["identifiability"]["immediate_invariance"])
            self.assertFalse(result["can_apply"])
            self.assertEqual(audit(folder)["status"],"PASSED_INTEGRITY_ONLY")
            (folder/"probes.csv").write_text("tampered",encoding="utf-8")
            with self.assertRaises(ValueError):
                audit(folder)

    def test_both_r_calls_precede_truth_and_parameters_persistence(self):
        from types import SimpleNamespace
        calls=[]
        def inspect(engine,arguments,log):
            folder=Path(log).parent
            self.assertFalse((folder/"truth.json").exists())
            self.assertFalse((folder/"probe-truth.json").exists())
            self.assertNotIn("truth",str(arguments))
            calls.append(True)
            if len(calls)==2:
                raise RuntimeError("intentional boundary stop")
        with tempfile.TemporaryDirectory(prefix="calibration-",dir=ROOT) as temporary:
            with patch.object(calibration_experiment,"call_r",side_effect=inspect):
                with self.assertRaisesRegex(RuntimeError,"intentional"):
                    run(Path(temporary)/"run",seeds=[101],items=1,probe_items=2,pairs=1)
        self.assertEqual(len(calls),2)

    def test_r_temporal_invariance_and_cold_start(self):
        from memory_benchmark import FSRSReference
        from memory_simulator import generate_memory,FIELDS as MEMORY_FIELDS
        events,_=generate_memory(103,FSRSReference(),items=2)
        with tempfile.TemporaryDirectory(prefix="calibration-",dir=ROOT) as temporary:
            folder=Path(temporary)
            write_csv(folder/"memory.csv",MEMORY_FIELDS,events)
            # Pure-function assertions inspect model outputs, not only process exit.
            script=folder/"invariance.R"
            script.write_text("""
source("lab/calibration_adapter.R", local=TRUE)
""",encoding="utf-8")
            code='''source("R/descriptive_analysis.R",encoding="UTF-8")
source("lab/individual_calibration.R")
d<-read.csv(commandArgs(TRUE)[1],colClasses="character")
a<-evaluate_individual_calibration(d)
changed<-d
t<-parse_evidence_timestamp(changed$occurred_at)
changed$is_correct[t>=as.POSIXct("2026-01-29",tz="UTC")]<-ifelse(changed$is_correct[t>=as.POSIXct("2026-01-29",tz="UTC")]=="true","false","true")
b<-evaluate_individual_calibration(changed)
stopifnot(identical(a$global_shift,b$global_shift),identical(a$selected_penalty,b$selected_penalty),
 identical(a$students,b$students),identical(a$predictions$predicted_probability,b$predictions$predicted_probability))
c<-evaluate_individual_calibration(d[nrow(d):1,,drop=FALSE])
stopifnot(identical(a$predictions,c$predictions),identical(a$students,c$students))
cold<-d[d$fsrs_evidence_status=="COLD_START_NO_PREVIOUS_REVIEW",,drop=FALSE]
stopifnot(evaluate_individual_calibration(cold)$status=="INSUFFICIENT_EVIDENCE")
for (y in list(rep(0,8),rep(1,8))) {
 value<-fit_shift(rep(.8,8),y)
 stopifnot(is.finite(value),all(cal_shift(c(0,1),value)>0),all(cal_shift(c(0,1),value)<1))
}
'''
            script.write_text(code,encoding="utf-8")
            result=subprocess.run([resolve_rscript(),str(script),str(folder/"memory.csv")],
                cwd=ENGINE,capture_output=True,text=True,timeout=90)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_r_rejects_latent_columns_duplicate_and_future_predictions(self):
        from memory_benchmark import FSRSReference
        from memory_simulator import generate_memory,FIELDS as MEMORY_FIELDS
        from run_experiment import dump
        events,_=generate_memory(107,FSRSReference(),items=1)
        probes,_=generate_probes([107],items=2,pairs=1)
        for kind in ("latent","duplicate","future","origin"):
            with self.subTest(kind=kind),tempfile.TemporaryDirectory(prefix="calibration-",dir=ROOT) as temporary:
                folder=Path(temporary)
                rows=copy.deepcopy(events);fields=list(MEMORY_FIELDS)
                if kind=="latent":
                    fields.append("true_probability")
                    for row in rows:
                        row["true_probability"]=.9
                elif kind=="duplicate":
                    rows[1]["event_id"]=rows[0]["event_id"]
                elif kind=="future":
                    rows[1]["fsrs_prediction_timestamp"]="2035-01-01T00:00:00Z"
                else:
                    rows[0]["origin_type"]="REAL_STUDY"
                obs,probe=folder/"memory.csv",folder/"probes.csv"
                write_csv(obs,fields,rows);write_csv(probe,FIELDS,probes)
                dump(folder/"snapshot.json",dict(contract_version="calibration_lab_v1",
                    source_kind="SYNTHETIC_BENCHMARK",memory_sha256=sha(obs),probes_sha256=sha(probe),
                    memory_rows=len(rows),probe_rows=len(probes),can_apply=False,can_schedule=False))
                result=subprocess.run([resolve_rscript(),str(ENGINE/"lab"/"calibration_adapter.R"),
                    str(obs),str(probe),str(folder/"result.json"),str(folder/"snapshot.json")],
                    cwd=ENGINE,capture_output=True,text=True,timeout=90)
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((folder/"result.json").exists())

if __name__=="__main__":
    unittest.main()
