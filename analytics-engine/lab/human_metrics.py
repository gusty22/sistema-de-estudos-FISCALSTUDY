"""Observed human outcomes only. No true probability or synthetic labels imputed."""
import math
from collections import defaultdict
from run_experiment import interval,reliability

def auc_roc(y,p):
    pos=sum(y);neg=len(y)-pos
    if not pos or not neg:
        return None
    ranked=sorted(zip(p,y));rank_sum=0;i=0
    while i<len(ranked):
        j=i+1
        while j<len(ranked) and ranked[j][0]==ranked[i][0]:
            j+=1
        rank_sum+=sum(v for _,v in ranked[i:j])*((i+1+j)/2)
        i=j
    return (rank_sum-pos*(pos+1)/2)/(pos*neg)

def failure_average_precision(y,p):
    positives=sum(1-v for v in y)
    if positives==0:
        return None
    ordered=sorted(zip(p,y));tp=seen=0;ap=0.;i=0
    while i<len(ordered):
        j=i+1
        while j<len(ordered) and ordered[j][0]==ordered[i][0]:
            j+=1
        new=sum(1-v for _,v in ordered[i:j]);tp+=new;seen+=j-i
        ap+=(new/positives)*(tp/seen);i=j
    return ap

def metrics(rows):
    if not rows:
        return dict(n=0,status="NO_PREDICTIONS")
    p=[float(r["predicted_probability"]) for r in rows];y=[int(r["observed_correct"]) for r in rows]
    if any(not math.isfinite(v) or not 0<=v<=1 for v in p) or any(v not in (0,1) for v in y):
        raise ValueError("Invalid observed outcome/probability")
    keys=[(r["student_id"],r["event_id"]) for r in rows]
    if len(set(keys))!=len(keys):
        raise ValueError("Duplicate scoring event")
    high=[v for v,outcome in zip(p,y) if v>=.9 and outcome==0]
    return dict(n=len(rows),n_students=len({r["student_id"] for r in rows}),
        n_items=len({(r["student_id"],r["question_id"]) for r in rows}),
        brier=sum((a-b)**2 for a,b in zip(p,y))/len(y),
        log_loss=sum(-b*math.log(max(a,1e-15))-(1-b)*math.log(max(1-a,1e-15)) for a,b in zip(p,y))/len(y),
        calibration_bias=sum(a-b for a,b in zip(p,y))/len(y),
        auc_roc=auc_roc(y,p),failure_average_precision=failure_average_precision(y,p),
        observed_failure_rate=1-sum(y)/len(y),high_predicted_recall_failures=len(high),
        high_predicted_recall_n=sum(v>=.9 for v in p),reliability=reliability(rows),
        true_probability_rmse="NOT_OBSERVABLE",conceptual_mastery="NOT_IDENTIFIED")

def paired_comparison(rows,left,right):
    models={name:{r["event_id"]:r for r in rows if r["model_name"]==name} for name in (left,right)}
    ids=set(models[left])&set(models[right])
    students=sorted({models[left][i]["student_id"] for i in ids})
    diffs={key:[] for key in ("brier","log_loss")};harm=[]
    for student in students:
        a=metrics([models[left][i] for i in sorted(ids) if models[left][i]["student_id"]==student])
        b=metrics([models[right][i] for i in sorted(ids) if models[right][i]["student_id"]==student])
        for key in diffs:
            diffs[key].append(a[key]-b[key])
        if a["brier"]>b["brier"]:
            harm.append(dict(student_id=student,n=a["n"],brier_difference=a["brier"]-b["brier"]))
    bounds={key:interval(value) for key,value in diffs.items()}
    a=metrics([models[left][i] for i in sorted(ids)]);b=metrics([models[right][i] for i in sorted(ids)])
    complete=bool(ids) and set(models[left])==set(models[right])
    approved=len(students)>=5 and complete and all(v[1] is not None and v[1]<0 for v in bounds.values())
    bss=None if not ids or b["brier"]==0 else 1-a["brier"]/b["brier"]
    return dict(left=left,right=right,paired_events=len(ids),paired_students=len(students),
        left_total=len(models[left]),right_total=len(models[right]),complete_coverage=complete,
        brier_skill_score=bss,paired_student_intervals=bounds,paired_student_differences=diffs,
        harmed_students_descriptive=harm,
        status="BETTER_ONLY_IN_THIS_RETROSPECTIVE_SAMPLE" if approved else "INCONCLUSIVE_OR_NO_SUPERIORITY",
        estimand="Equal-weight student mean difference; aggregate BSS weights events",
        uncertainty="Paired student-cluster bootstrap, conditional on fitted donor models; overlapping folds",
        can_apply=False)

def summarize(rows):
    names=sorted({r["model_name"] for r in rows})
    report=dict(metrics={m:metrics([r for r in rows if r["model_name"]==m]) for m in names})
    total=max((report["metrics"][m]["n"] for m in names),default=0)
    report["prediction_coverage"]={m:dict(n=report["metrics"][m]["n"],reference_targets=total,
        coverage=report["metrics"][m]["n"]/total if total else None) for m in names}
    report["macro_by_student"]={}
    for m in names:
        students=sorted({r["student_id"] for r in rows if r["model_name"]==m})
        values=[metrics([r for r in rows if r["model_name"]==m and r["student_id"]==id]) for id in students]
        report["macro_by_student"][m]={key:sum(v[key] for v in values)/len(values) for key in ("brier","log_loss")}
    report["comparisons"]=[paired_comparison(rows,"INDIVIDUAL_CALIBRATION",ref)
        for ref in ("GLOBAL_CALIBRATION","FSRS_DEFAULT","FSRS_NUMERICAL_GUARD","PERSONAL_ONLINE_BETA11") if ref in names]
    strata={}
    for label,lo,hi in (("LT_1_DAY",0,1),("1_TO_7_DAYS",1,7),("7_TO_30_DAYS",7,30),("GE_30_DAYS",30,float("inf"))):
        strata[label]={m:metrics([r for r in rows if r["model_name"]==m and lo<=float(r["elapsed_days"])<hi])
            for m in names}
    report["horizons"]=strata
    report["can_apply"]=False
    return report
