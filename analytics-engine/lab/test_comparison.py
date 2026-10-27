"""Experimental integrity, real pyBKT (when installed) and replay audit tests."""
import copy
import csv
from importlib.metadata import version, PackageNotFoundError
import json
from pathlib import Path
import tempfile
import unittest
import pybkt_adapter
from simulator import generate, write_events
from run_experiment import sha
from audit_run import audit

ENGINE=Path(__file__).resolve().parents[1]

def available():
    try:
        return version("pyBKT")=="1.4.3"
    except PackageNotFoundError:
        return False

class SnapshotTests(unittest.TestCase):
    def test_forged_manifest_and_mixed_session_rejected(self):
        events,_,_=generate(11,12)
        with tempfile.TemporaryDirectory(prefix="case-",dir=ENGINE/"tests"/"fixtures"/"learner_lab") as temporary:
            folder=Path(temporary); data=folder/"observations.csv"; meta=folder/"manifest.json"
            write_events(data, events)
            manifest=dict(source_kind="SYNTHETIC_BENCHMARK",contract_version="learner_lab_events_v1",
                input_sha256=sha(data),row_count=len(events))
            meta.write_text(json.dumps(manifest),encoding="utf-8")
            with data.open(encoding="utf-8",newline="") as stream:
                self.assertEqual(pybkt_adapter.read_snapshot(data,meta),list(csv.DictReader(stream)))
            manifest["row_count"]+=1
            meta.write_text(json.dumps(manifest),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"row count"):
                pybkt_adapter.read_snapshot(data,meta)
            events[-1]["session_id"]=events[0]["session_id"]
            write_events(data,events)
            manifest.update(input_sha256=sha(data),row_count=len(events))
            meta.write_text(json.dumps(manifest),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"multiple owners"):
                pybkt_adapter.read_snapshot(data,meta)

    def test_hash_tampering_is_detected(self):
        with tempfile.TemporaryDirectory(prefix="case-",dir=ENGINE/"tests"/"fixtures"/"learner_lab") as temporary:
            root=Path(temporary); payload=root/"summary.json"
            payload.write_text("{}",encoding="utf-8")
            manifest=dict(status="SUCCEEDED",source_kind="SYNTHETIC_BENCHMARK",
                can_apply=False,can_schedule=False,inputs=[],artifacts={"summary.json":sha(payload)})
            (root/"run-manifest.json").write_text(json.dumps(manifest),encoding="utf-8")
            payload.write_text("tampered",encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"hash mismatch"):
                audit(root)

    def test_unlisted_artifact_is_detected(self):
        with tempfile.TemporaryDirectory(prefix="case-",dir=ENGINE/"tests"/"fixtures"/"learner_lab") as temporary:
            root=Path(temporary)
            (root/"unexpected").write_text("x",encoding="utf-8")
            (root/"run-manifest.json").write_text(json.dumps(dict(status="SUCCEEDED",
                source_kind="SYNTHETIC_BENCHMARK",can_apply=False,can_schedule=False,artifacts={})),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"unlisted"):
                audit(root)

    def test_report_keeps_sparse_observations_without_fabricating_predictions(self):
        from run_experiment import report_html
        with tempfile.TemporaryDirectory(prefix="case-",dir=ENGINE/"tests"/"fixtures"/"learner_lab") as temporary:
            target=Path(temporary)/"report.html"
            report_html(target,{"can_apply":False},[],[dict(profile="sparse",skill="A",
                event_id="observed-only",is_correct="",student_id="s0",seed=1)])
            text=target.read_text(encoding="utf-8")
            self.assertIn('"rows": []',text)
            self.assertIn('"profile": "sparse"',text)
            self.assertIn('id="history"',text)
            self.assertIn("data.history.filter",text)

    def test_decision_authority_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="case-",dir=ENGINE/"tests"/"fixtures"/"learner_lab") as temporary:
            root=Path(temporary)
            (root/"run-manifest.json").write_text(json.dumps(dict(status="SUCCEEDED",
                source_kind="SYNTHETIC_BENCHMARK",can_apply=True,can_schedule=False)),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"authority"):
                audit(root)

@unittest.skipUnless(available(),"NOT_EXECUTED: optional pyBKT==1.4.3 unavailable")
class RealPyBKTTests(unittest.TestCase):
    def fixture(self):
        events,_,_=generate(919,24,profiles=[dict(name="test_only",gain=.10,half_life=8)])
        # Fix measurement conditions, not outcomes or hidden parameters.
        return [dict(e,used_help="false",session_complete="true",gabarito_status="DEFINITIVO",
                     is_correct="true" if i%3 else "false") for i,e in enumerate(events)]

    def test_future_and_target_outcomes_cannot_change_prior_prediction(self):
        rows=self.fixture()
        before,status=pybkt_adapter.predict_events(rows)
        changed=copy.deepcopy(rows)
        for row in changed[15:]:
            row["is_correct"]="false" if row["is_correct"]=="true" else "true"
        after,_=pybkt_adapter.predict_events(changed)
        p={r["event_id"]:r["predicted_probability"] for r in before}
        q={r["event_id"]:r["predicted_probability"] for r in after}
        for row in rows[:16]:  # target outcome at index 15 is also hidden
            if row["event_id"] in p:
                self.assertEqual(p[row["event_id"]],q[row["event_id"]])
        self.assertEqual(len(before),14)
        self.assertFalse(status["can_apply"])
        self.assertEqual(status["temporal_forgetting"],"NOT_MODELED")
        student=rows[0]["student_id"]
        self.assertEqual(status["students"][student]["training_event_ids"],[e["event_id"] for e in rows[:10]])

    def test_extreme_prefix_never_exports_nonfinite_probabilities(self):
        import math
        rows=self.fixture()
        for i,row in enumerate(rows):
            row["is_correct"]="true" if i<10 else "false"
        predictions,status=pybkt_adapter.predict_events(rows)
        self.assertTrue(all(math.isfinite(r["predicted_probability"]) and
                            0<=r["predicted_probability"]<=1 for r in predictions))
        student=status["students"][rows[0]["student_id"]]
        missing=len(student.get("numerical_unavailable_event_ids",[]))
        if student["status"]=="NON_FINITE_FIT_UNAVAILABLE":
            self.assertEqual(predictions,[])
        else:
            self.assertEqual(len(predictions)+missing+student["unknown_skill_count"],14)

    def test_reordering_input_preserves_predictions(self):
        rows=self.fixture()
        before,_=pybkt_adapter.predict_events(rows)
        after,_=pybkt_adapter.predict_events(list(reversed(rows)))
        self.assertEqual(before,after)

    def test_same_timestamp_is_not_ordered_into_training(self):
        rows=self.fixture()
        rows[9]["occurred_at"]=rows[10]["occurred_at"]
        predictions,status=pybkt_adapter.predict_events(rows)
        self.assertEqual(predictions,[])
        self.assertEqual(status["students"][rows[0]["student_id"]]["status"],"AMBIGUOUS_WARMUP_BOUNDARY")

    def test_insufficient_history_is_not_zero_knowledge(self):
        rows=self.fixture()[:6]
        predictions,status=pybkt_adapter.predict_events(rows)
        self.assertEqual(predictions,[])
        self.assertEqual(status["students"][rows[0]["student_id"]]["status"],"INSUFFICIENT_HISTORY")

class RealMovingAverageTests(unittest.TestCase):
    def test_real_r_reuses_previous_five_without_current_outcome(self):
        from test_lab import RealRContractTests
        rows,_,_=generate(331,18,profiles=[dict(name="test_only",gain=.1,half_life=8)])
        rows=[dict(e,used_help="false",session_complete="true",gabarito_status="DEFINITIVO",
                   is_correct="true" if i%3 else "false") for i,e in enumerate(rows)]
        caller=RealRContractTests()
        predictions,_=caller.invoke(rows)
        moving={r["event_id"]:r for r in predictions if r["model_name"]=="MOVING_AVERAGE_5"}
        self.assertEqual(len(moving),8)
        for i in range(10,len(rows)):
            expected=round(sum(e["is_correct"]=="true" for e in rows[i-5:i])/5,4)
            self.assertAlmostEqual(float(moving[rows[i]["event_id"]]["predicted_probability"]),expected)
        reversed_predictions,_=caller.invoke(list(reversed(rows)))
        self.assertEqual(predictions,reversed_predictions)

if __name__=="__main__":
    unittest.main()
