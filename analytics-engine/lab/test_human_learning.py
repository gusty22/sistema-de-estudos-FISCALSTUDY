"""External-data adapter/metric tests use explicit software fixtures, not human evidence."""
import csv
import io
import json
import math
import unittest
from public_data_adapters import parse_fsrs_tsv,FSRS_FIELDS,parse_assistments_csv
from human_metrics import metrics,paired_comparison,auc_roc,failure_average_precision

def tsv(rows):
    stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=FSRS_FIELDS,delimiter="\t")
    writer.writeheader();writer.writerows(rows);return stream.getvalue().encode()

def sample():
    return [dict(review_time=1600000000000,card_id=10,i=1,delta_t=0,review_rating=3,y=1,t_history="",r_history=""),
            dict(review_time=1600086400000,card_id=10,i=2,delta_t=1,review_rating=1,y=0,t_history="0",r_history="3")]

class PublicAdapterTests(unittest.TestCase):
    def test_fsrs_identity_and_order(self):
        rows,qa=parse_fsrs_tsv(tsv(sample()[::-1]),"fixture-only")
        self.assertEqual([r["sequence"] for r in rows],[1,2])
        self.assertEqual(qa["origin_type"],"PUBLIC_HUMAN_DATASET")
        self.assertEqual(rows[0]["moment"].utcoffset().total_seconds(),0)
        self.assertEqual(qa["eligible_rows"],2)

    def test_fsrs_bad_target_duplicate_and_missing_prefix(self):
        rows=sample();rows[1]["y"]=1
        with self.assertRaises(ValueError):
            parse_fsrs_tsv(tsv(rows),"fixture")
        with self.assertRaises(ValueError):
            parse_fsrs_tsv(tsv(sample()+sample()),"fixture")
        rows,qa=parse_fsrs_tsv(tsv(sample()[1:]),"fixture")
        self.assertEqual(rows,[])
        self.assertEqual(qa["exclusions"]["MISSING_OR_INCONSISTENT_CARD_PREFIX"],1)

    def test_assistments_one_event_multiskill_and_no_fake_time(self):
        data=b"order_id,user_id,problem_id,skill_id,correct,hint_count\n5,1,7,10,0,1\n5,1,7,11,0,1\n6,1,8,10,1,0\n"
        rows,qa=parse_assistments_csv(data)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]["skill_ids"],("10","11"))
        self.assertIsNone(rows[0]["occurred_at"])
        self.assertEqual(rows[0]["hint_timing"],"POST_TARGET_METADATA_NOT_A_PREDICTOR")
        self.assertEqual(qa["collapsed_skill_annotations"],1)

    def test_assistments_conflicting_target_rejected(self):
        data=b"order_id,user_id,problem_id,skill_id,correct\n5,1,7,10,0\n5,1,7,11,1\n"
        with self.assertRaises(ValueError):
            parse_assistments_csv(data)

class HumanMetricsTests(unittest.TestCase):
    def rows(self,p=(.2,.8)):
        return [dict(student_id="fixture",event_id=str(i),question_id=str(i),model_name="A",
            predicted_probability=prob,observed_correct=i,elapsed_days=7) for i,prob in enumerate(p)]

    def test_proper_scores_and_auc(self):
        result=metrics(self.rows())
        self.assertAlmostEqual(result["brier"],.04)
        self.assertAlmostEqual(result["log_loss"],-math.log(.8))
        self.assertEqual(result["auc_roc"],1)
        self.assertEqual(result["failure_average_precision"],1)
        self.assertEqual(result["true_probability_rmse"],"NOT_OBSERVABLE")

    def test_ties_and_single_class(self):
        self.assertEqual(auc_roc([0,1],[.5,.5]),.5)
        self.assertEqual(failure_average_precision([0,1],[.5,.5]),.5)
        self.assertIsNone(auc_roc([1,1],[.5,.6]))
        self.assertIsNone(failure_average_precision([1,1],[.5,.6]))

    def test_paired_bss_same_events_and_incomplete_coverage(self):
        left=self.rows();right=[dict(r,model_name="B",predicted_probability=.5) for r in left]
        report=paired_comparison(left+right,"A","B")
        self.assertAlmostEqual(report["brier_skill_score"],.84)
        self.assertEqual(report["status"],"INCONCLUSIVE_OR_NO_SUPERIORITY")
        partial=paired_comparison(left+right[:1],"A","B")
        self.assertFalse(partial["complete_coverage"])
        self.assertEqual(partial["paired_events"],1)

    def test_missing_true_probability_allowed_but_duplicates_rejected(self):
        self.assertEqual(metrics([])["status"],"NO_PREDICTIONS")
        with self.assertRaises(ValueError):
            metrics(self.rows()+self.rows())

if __name__=="__main__":
    unittest.main()
