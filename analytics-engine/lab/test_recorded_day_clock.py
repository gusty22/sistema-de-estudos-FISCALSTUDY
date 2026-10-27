"""Clock transport conformance, not personal learning validation."""
import csv
import io
import copy
import importlib.util
import unittest
from public_data_adapters import FSRS_FIELDS,parse_fsrs_tsv
from recorded_day_clock import (CLOCKS,FIELDS,select_new_cohort,load_protocol,
    validate_declared_prefixes,replay_recorded_clock)

def fixture():
    return [
        dict(review_time=1600000000000,card_id=20,i=1,delta_t=0,review_rating=3,y=1,t_history="",r_history=""),
        dict(review_time=1600000000000+23*3600*1000,card_id=20,i=2,delta_t=1,review_rating=1,y=0,t_history="0",r_history="3"),
        dict(review_time=1600000000000+47*3600*1000,card_id=20,i=3,delta_t=1,review_rating=3,y=1,t_history="0,1",r_history="3,1")]
def payload(rows):
    stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=FSRS_FIELDS,delimiter="\t")
    writer.writeheader();writer.writerows(rows);return stream.getvalue().encode()

class SourceProtocolTests(unittest.TestCase):
    def test_untouched_selection_is_deterministic_and_excludes_prior(self):
        files=[dict(path=f"v4/revlog_history-{i:07x}.tsv",size=50000+i*1000) for i in range(36)]
        prior=[files[i]["path"] for i in range(1,36,3)]
        a,frame,remaining=select_new_cohort(files,prior)
        b,_,_=select_new_cohort(list(reversed(files)),prior)
        self.assertEqual(a,b);self.assertEqual((frame,remaining),(36,24))
        self.assertEqual(len(a),12)
        self.assertFalse({r["path"] for r in a}&set(prior))
        with self.assertRaises(ValueError):
            select_new_cohort(files[:10],[])

    def test_declared_history_is_checked_not_a_future_predictor(self):
        raw=payload(fixture());rows,_=parse_fsrs_tsv(raw,"fixture")
        self.assertTrue(validate_declared_prefixes(raw,rows))
        broken=fixture();broken[2]["r_history"]="3,3"
        with self.assertRaises(ValueError):
            validate_declared_prefixes(payload(broken),rows)
        broken=fixture();broken[2]["t_history"]="0,2"
        with self.assertRaises(ValueError):
            validate_declared_prefixes(payload(broken),rows)
        broken=fixture();broken[2]["delta_t"]=.5
        raw=payload(broken);rows,_=parse_fsrs_tsv(raw,"fixture")
        with self.assertRaises(ValueError):
            validate_declared_prefixes(raw,rows)

    def test_protocol_keeps_authority_blocked_and_registers_prior_cohort(self):
        p=load_protocol()
        self.assertEqual(len(set(p["prior_excluded_files"])),12)
        self.assertFalse(p["can_apply"]);self.assertFalse(p["can_schedule"])
        self.assertEqual(p["clocks"],list(CLOCKS))

@unittest.skipUnless(importlib.util.find_spec("fsrs"),"NOT_EXECUTED: optional official FSRS unavailable")
class OfficialClockTests(unittest.TestCase):
    def test_observed_instants_outcomes_and_ids_are_preserved(self):
        rows,_=parse_fsrs_tsv(payload(fixture()),"fixture")
        utc,params=replay_recorded_clock(rows,"fixture",CLOCKS[0])
        source,other=replay_recorded_clock(rows,"fixture",CLOCKS[1])
        self.assertEqual(params,other);self.assertEqual(len(params),21)
        for a,b in zip(utc,source):
            self.assertEqual(set(a),set(FIELDS))
            for field in ("event_id","student_id","question_id","occurred_at","is_correct","prediction_status"):
                self.assertEqual(a[field],b[field])
        self.assertEqual(utc[1]["predicted_probability"],1.)
        self.assertLess(source[1]["predicted_probability"],1.)
        self.assertEqual(source[1]["model_elapsed_days"],1)
        self.assertNotEqual(source[1]["model_clock_coordinate"],source[1]["occurred_at"])

    def test_current_rating_does_not_enter_its_own_prediction(self):
        original=fixture();changed=copy.deepcopy(original)
        changed[1]["review_rating"]=3;changed[1]["y"]=1
        a,_=parse_fsrs_tsv(payload(original),"fixture")
        b,_=parse_fsrs_tsv(payload(changed),"fixture")
        for basis in CLOCKS:
            x,_=replay_recorded_clock(a,"fixture",basis)
            y,_=replay_recorded_clock(b,"fixture",basis)
            self.assertEqual(x[1]["predicted_probability"],y[1]["predicted_probability"])

    def test_zero_source_day_is_retained_but_not_scored(self):
        records=fixture();records[1]["delta_t"]=0
        records[2]["t_history"]="0,0"
        raw=payload(records);rows,_=parse_fsrs_tsv(raw,"fixture")
        self.assertTrue(validate_declared_prefixes(raw,rows))
        result,_=replay_recorded_clock(rows,"fixture",CLOCKS[1])
        self.assertEqual(len(result),3)
        self.assertEqual(result[1]["prediction_status"],"OUTSIDE_LONG_TERM_DOMAIN")
        self.assertEqual(result[1]["predicted_probability"],"")
        self.assertEqual(result[2]["prediction_status"],"ELIGIBLE")
        self.assertEqual(result[2]["model_elapsed_days"],1)

if __name__=="__main__":
    unittest.main()
