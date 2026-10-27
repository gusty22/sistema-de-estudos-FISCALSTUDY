"""Technical tests of the independent memory laboratory, not human validation."""
import copy
import json
from importlib.metadata import version,PackageNotFoundError
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import memory_benchmark
from memory_benchmark import FSRSReference,validate_memory,run,audit_memory
from memory_simulator import FIELDS,generate_memory
ENGINE=Path(__file__).resolve().parents[1]

def installed():
    try:
        return version("fsrs")=="6.3.2"
    except PackageNotFoundError:
        return False

@unittest.skipUnless(installed(),"NOT_EXECUTED: optional fsrs==6.3.2 unavailable")
class MemoryTests(unittest.TestCase):
    def test_generator_replays_and_excludes_latent_fields(self):
        a=generate_memory(17,FSRSReference(),items=2)
        b=generate_memory(17,FSRSReference(),items=2)
        self.assertEqual(a,b)
        self.assertTrue(validate_memory(a[0]))
        self.assertEqual(len(a[0]),56)
        self.assertEqual(len(FSRSReference().scheduler.parameters),21)
        self.assertTrue(all(set(e)==set(FIELDS) for e in a[0]))
        self.assertTrue(all("half_life_days" not in e and "retrieval" not in e for e in a[0]))
        self.assertEqual({t["forgetting_form"] for t in a[1]},{"exponential","power"})
        self.assertEqual({t["initial_half_life_days"] for t in a[1]},{1.5,18.})

    def test_cold_start_is_not_zero_retrievability(self):
        events,truth=generate_memory(19,FSRSReference(),items=1)
        cold=[r for r in events if r["fsrs_evidence_status"]=="COLD_START_NO_PREVIOUS_REVIEW"]
        self.assertEqual(len(cold),4)
        self.assertTrue(all(r["fsrs_retrievability_pre_update"]=="" for r in cold))
        known={r["event_id"]:r for r in truth}
        self.assertTrue(all(known[r["event_id"]]["retrieval"]==1 for r in cold))

    def test_bad_id_future_time_and_latent_column_rejected(self):
        events,_,=generate_memory(23,FSRSReference(),items=1)
        duplicate=copy.deepcopy(events);duplicate[1]["event_id"]=duplicate[0]["event_id"]
        future=copy.deepcopy(events);future[1]["fsrs_prediction_timestamp"]="2030-01-01T00:00:00Z"
        latent=copy.deepcopy(events);latent[1]["retrieval"]=.99
        naive=copy.deepcopy(events);naive[1]["occurred_at"]="2026-01-02T00:00:00"
        for rows in (duplicate,future,latent,naive):
            with self.assertRaises(ValueError):
                validate_memory(rows)

    def test_pre_update_prediction_independent_of_current_outcome(self):
        from datetime import datetime,timedelta,timezone
        first=FSRSReference();second=FSRSReference()
        t=datetime(2026,1,1,tzinfo=timezone.utc); item="abc123abc123"
        for model in (first,second):
            model.begin_batch("s",t);model.observe("s",item,t,True)
            model.begin_batch("s",t+timedelta(days=3))
        p=first.predict("s",item,t+timedelta(days=3))
        q=second.predict("s",item,t+timedelta(days=3))
        self.assertEqual(p,q)
        first.observe("s",item,t+timedelta(days=3),False)
        second.observe("s",item,t+timedelta(days=3),True)
        first.begin_batch("s",t+timedelta(days=7));second.begin_batch("s",t+timedelta(days=7))
        self.assertNotEqual(first.predict("s",item,t+timedelta(days=7))["stability"],
                            second.predict("s",item,t+timedelta(days=7))["stability"])

    def test_same_time_baseline_history_is_frozen(self):
        from datetime import datetime,timezone
        model=FSRSReference();t=datetime(2026,1,1,tzinfo=timezone.utc)
        model.begin_batch("s",t)
        model.observe("s","abc123abc123",t,True)
        self.assertEqual(model.predict("s","def123def123",t)["historical_probability"],.5)

    def test_real_r_scores_match_and_hash_tamper_rejected(self):
        root=ENGINE/"tests"/"fixtures"/"learner_lab"
        with tempfile.TemporaryDirectory(prefix="case-",dir=root) as temporary:
            folder=Path(temporary)/"memory"
            summary=run(folder,seeds=[31],items=1)
            self.assertEqual(summary["events"],28)
            self.assertTrue(summary["r_python_score_agreement"])
            self.assertEqual(summary["cold_start_count"],4)
            self.assertFalse(summary["can_apply"])
            self.assertEqual(audit_memory(folder)["status"],"PASSED_INTEGRITY_ONLY")
            (folder/"truth.json").write_text("tampered",encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"hash mismatch"):
                audit_memory(folder)

    def test_truth_remains_unwritten_before_r(self):
        root=ENGINE/"tests"/"fixtures"/"learner_lab"
        checked=[]
        def inspect(*args,**kwargs):
            from types import SimpleNamespace
            folder=Path(args[0][2]).parent
            self.assertFalse((folder/"truth.json").exists())
            checked.append(True)
            return SimpleNamespace(returncode=1,stdout="",stderr="Intentional boundary stop")
        with tempfile.TemporaryDirectory(prefix="case-",dir=root) as temporary:
            with patch.object(memory_benchmark.subprocess,"run",side_effect=inspect):
                with self.assertRaises(RuntimeError):
                    run(Path(temporary)/"memory",seeds=[37],items=1)
        self.assertEqual(checked,[True])

if __name__=="__main__":
    unittest.main()
