"""External-data adapter/metric tests use explicit software fixtures, not human evidence."""
import csv
import io
import json
import math
import unittest
import subprocess
from pathlib import Path
from run_experiment import resolve_rscript
from public_data_adapters import parse_fsrs_tsv,FSRS_FIELDS,parse_assistments_csv,validate_prediction_join
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
        self.assertEqual(qa["origin_type"],"UNVERIFIED_EXTERNAL")
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

class PredictionJoinTests(unittest.TestCase):
    def test_original_source_identity_and_label(self):
        source=[dict(event_id="fixture-1",student_id="fixture-student",question_id="fixture-item",
            is_correct=1,event_order=5)]
        prediction=dict(event_id="fixture-1",student_id="fixture-student",question_id="fixture-item",
            observed_correct=1,event_order=5,model_name="fixture-model",predicted_probability=.7)
        self.assertTrue(validate_prediction_join([prediction],source))
        for field,value in (("observed_correct",0),("student_id","other"),("event_order",6),("event_id","unknown")):
            with self.assertRaises(ValueError):
                validate_prediction_join([dict(prediction,**{field:value})],source)
        with self.assertRaises(ValueError):
            validate_prediction_join([prediction,prediction],source)

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


class HumanRIntegrationTests(unittest.TestCase):
    def test_future_labels_do_not_change_frozen_calibration_or_use_future_donors(self):
        engine=Path(__file__).resolve().parents[1]
        code=r'''
source("lab/human_memory_adapter.R")
n<-300L
d<-data.frame(event_id=paste0("fixture-event-",seq_len(n)),student_id=rep(c("test-a","test-b","test-c"),each=100),
 question_id=rep(paste0("fixture-card-",rep(seq_len(30),length.out=100)),3),
 occurred_at=rep(format(as.POSIXct("2020-01-01",tz="UTC")+seq_len(100)*86400,"%Y-%m-%dT%H:%M:%SZ",tz="UTC"),3),
 is_correct=as.character(as.integer(seq_len(n)%%4!=0)),predicted_probability="0.7",elapsed_days="7",
 rating=ifelse(seq_len(n)%%4!=0,"3","1"),origin_type="AUTOMATED_TEST",fsrs_model_version="SOFTWARE_FIXTURE",
 stringsAsFactors=FALSE)
a<-analyze_public_memory(d,origin="AUTOMATED_TEST")
changed<-d
future<-parse_evidence_timestamp(changed$occurred_at)>as.POSIXct("2020-01-01",tz="UTC")+80*86400
changed$is_correct[future]<-ifelse(changed$is_correct[future]=="1","0","1")
changed$rating[future]<-ifelse(changed$is_correct[future]=="1","3","1")
b<-analyze_public_memory(changed,origin="AUTOMATED_TEST")
stopifnot(identical(a$students,b$students),all(vapply(a$students,function(s) !s$donor_identity_overlap && !s$donor_future_overlap,logical(1))))
x<-a$predictions[a$predictions$model_name=="INDIVIDUAL_CALIBRATION",]
y<-b$predictions[b$predictions$model_name=="INDIVIDUAL_CALIBRATION",]
stopifnot(identical(x$predicted_probability,y$predicted_probability))
shuffled<-analyze_public_memory(d[nrow(d):1,,drop=FALSE],origin="AUTOMATED_TEST")
stopifnot(identical(a$predictions,shuffled$predictions))
bad<-d;bad$origin_type<-"REAL_STUDY"
stopifnot(inherits(try(analyze_public_memory(bad),silent=TRUE),"try-error"))
short<-d[rep(seq_len(100)<=8,3),]
stopifnot(!length(analyze_public_memory(short,origin="AUTOMATED_TEST")$predictions))
'''
        result=subprocess.run([resolve_rscript(),"-e",code],cwd=engine,capture_output=True,text=True,timeout=120)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

if __name__=="__main__":
    unittest.main()
