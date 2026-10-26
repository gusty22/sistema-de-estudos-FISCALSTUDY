"""Software/experiment integrity tests, never evidence of human learning."""
import copy
import csv
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import run_experiment

from simulator import COLUMNS, PROFILES, forgetting, generate, identifiability_probe, validate, write_events
from run_experiment import evaluate, resolve_rscript, score, sha

ENGINE = Path(__file__).resolve().parents[1]

class SimulatorTests(unittest.TestCase):
    def test_reproducible_and_all_quantitative_profiles(self):
        a = generate(17)
        self.assertEqual(a, generate(17))
        self.assertNotEqual(a[0], generate(19)[0])
        self.assertEqual(len(a[2]), 12)
        self.assertEqual({p["parameters"]["name"] for p in a[2]}, {p["name"] for p in PROFILES})
        self.assertEqual({p["forgetting_form"] for p in a[2]}, {"exponential", "power"})
        self.assertTrue(validate(a[0]))
        self.assertEqual(len(a[0]), len(a[1]))

    def test_observations_cannot_contain_truth(self):
        events, truth, _ = generate(17)
        self.assertTrue(all(set(e) == set(COLUMNS) for e in events))
        for name in ("knowledge","retrieval","half_life_days","probability_correct","profile"):
            self.assertNotIn(name, events[0])
            self.assertIn(name, truth[0])

    def test_half_life_is_a_simulator_assumption_not_a_universal_law(self):
        for form in ("exponential","power"):
            self.assertEqual(forgetting(0,8,form),1)
            self.assertAlmostEqual(forgetting(8,8,form),.5)
            self.assertGreater(forgetting(1,8,form),forgetting(9,8,form))
        self.assertNotEqual(forgetting(16,8,"exponential"),forgetting(16,8,"power"))

    def test_invalid_events_are_rejected_without_repair(self):
        events, _, _ = generate(17,12)
        cases = []
        duplicate = copy.deepcopy(events[:2]); duplicate[1]["event_id"] = duplicate[0]["event_id"]; cases.append(duplicate)
        naive = copy.deepcopy(events[:1]); naive[0]["occurred_at"]="2026-01-01T10:00:00"; cases.append(naive)
        hidden = copy.deepcopy(events[:1]); hidden[0]["knowledge"]=.9; cases.append(hidden)
        origin = copy.deepcopy(events[:1]); origin[0]["origin_type"]="REAL_STUDY"; cases.append(origin)
        identity = copy.deepcopy(events[:1]); identity[0]["student_id"]=""; cases.append(identity)
        for rows in cases:
            with self.assertRaises(ValueError):
                validate(rows)

    def test_known_score_vector(self):
        rows=[dict(predicted_probability=p,observed_correct=y,true_probability=p) for p,y in zip((.8,.9,.2,.1),(1,1,0,0))]
        self.assertAlmostEqual(score(rows)["brier"],.025)
        self.assertAlmostEqual(score(rows)["probability_rmse"],0)
        with self.assertRaises(ValueError):
            score([dict(predicted_probability=1.1,observed_correct=1,true_probability=.9)])

    def test_absence_is_not_zero_knowledge(self):
        self.assertIsNone(score([])["brier"])
        self.assertEqual(identifiability_probe()["immediate_probabilities"][0],identifiability_probe()["immediate_probabilities"][1])
        self.assertNotEqual(identifiability_probe()["day7_probabilities"][0],identifiability_probe()["day7_probabilities"][1])

    def test_contract_matches_generator_columns(self):
        contract=json.loads((ENGINE/"lab"/"event_contract.json").read_text(encoding="utf-8"))
        self.assertEqual(contract["columns"],COLUMNS)

    def test_latent_truth_not_persisted_before_r(self):
        root=ENGINE/"tests"/"fixtures"/"learner_lab"
        root.mkdir(parents=True,exist_ok=True)
        checked=[]
        def inspect_boundary(*args,**kwargs):
            command=args[0]
            input_path=Path(command[2])
            folder=input_path.parent.parent
            self.assertFalse((folder/"truth.json").exists())
            with input_path.open(encoding="utf-8",newline="") as stream:
                self.assertEqual(next(csv.reader(stream)),COLUMNS)
            checked.append(True)
            return SimpleNamespace(returncode=1,stdout="",stderr="Intentional boundary-test stop")
        with tempfile.TemporaryDirectory(prefix="boundary-",dir=root) as temporary:
            with patch.object(run_experiment.subprocess,"run",side_effect=inspect_boundary):
                with self.assertRaises(RuntimeError):
                    run_experiment.run(ENGINE,Path(temporary)/"run",[11],12)
        self.assertEqual(checked,[True])

class RealRContractTests(unittest.TestCase):
    def invoke(self, events, expect_success=True):
        root=ENGINE/"tests"/"fixtures"/"learner_lab"
        root.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="case-",dir=root) as directory:
            folder=Path(directory)
            csv_path=folder/"observations.csv"
            write_events(csv_path,events)
            manifest=folder/"manifest.json"
            manifest.write_text(json.dumps(dict(source_kind="SYNTHETIC_BENCHMARK",
                contract_version="learner_lab_events_v1",input_sha256=sha(csv_path),row_count=len(events))),encoding="utf-8")
            target=folder/"predictions.csv"
            result=subprocess.run([resolve_rscript(),str(ENGINE/"lab"/"engine_adapter.R"),str(csv_path),str(target),str(manifest)],
                cwd=ENGINE,capture_output=True,text=True,errors="replace",timeout=120)
            if not expect_success:
                self.assertNotEqual(result.returncode,0)
                return result.stderr
            self.assertEqual(result.returncode,0,result.stderr)
            with target.open(encoding="utf-8-sig",newline="") as stream:
                predictions=list(csv.DictReader(stream))
            statuses=json.loads(Path(str(target)+".status.json").read_text(encoding="utf-8"))
            return predictions,statuses

    def test_real_engine_future_perturbation_and_student_separation(self):
        events, _, _=generate(19,18)
        # Primary target excludes helped/incomplete rows; this fixture fixes conditions.
        rows=[dict(e,used_help="false",session_complete="true",gabarito_status="DEFINITIVO",
                   is_correct=("true" if i%2 else "false")) for i,e in enumerate(events)]
        before,status=self.invoke(rows)
        changed=copy.deepcopy(rows)
        first=next(s for s in sorted({e["student_id"] for e in rows}) if sum(e["student_id"]==s for e in rows)>13)
        first_events=[e for e in rows if e["student_id"]==first]
        cutoff=first_events[12]["occurred_at"]
        for e in changed:
            if e["student_id"]==first and e["occurred_at"]>=cutoff:
                e["is_correct"]="false" if e["is_correct"]=="true" else "true"
        after,_=self.invoke(changed)
        before_map={(r["event_id"],r["model_name"]):r for r in before}
        after_map={(r["event_id"],r["model_name"]):r for r in after}
        protected={e["event_id"] for e in rows if e["student_id"]!=first or e["occurred_at"]<cutoff}
        for key in before_map:
            if key[0] in protected:
                self.assertEqual(before_map[key]["predicted_probability"],after_map[key]["predicted_probability"])
        self.assertFalse(status["can_apply"])
        self.assertFalse(status["can_schedule"])

    def test_sparse_profile_produces_no_false_certainty(self):
        events, _, metadata=generate(29,12)
        sparse=next(p["student_id"] for p in metadata if p["parameters"]["name"]=="sparse")
        predictions,status=self.invoke([e for e in events if e["student_id"]==sparse])
        self.assertEqual(predictions,[])
        self.assertEqual(status["students"][sparse]["status"],"INSUFFICIENT_HISTORY")

    def test_r_rejects_duplicate_and_ambiguous_history(self):
        events,_,_=generate(31,12)
        duplicate=copy.deepcopy(events[:2])
        duplicate[1]["event_id"]=duplicate[0]["event_id"]
        self.assertIn("Duplicate event",self.invoke(duplicate,expect_success=False))
        naive=copy.deepcopy(events[:1])
        naive[0]["occurred_at"]="2026-01-01T10:00:00"
        self.assertIn("timestamp",self.invoke(naive,expect_success=False))

if __name__=="__main__":
    unittest.main()
