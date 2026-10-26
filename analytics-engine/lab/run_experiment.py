"""Experimental orchestration/evaluation. Truth is written only AFTER R exits."""
import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import shutil
import subprocess
import sys
from simulator import COLUMNS, generate, identifiability_probe, validate, write_events

VERSION = "learner-lab-mvp-2"
ENGINE_BASE_COMMIT = "4db0ac08c70e0c651b9bc345e6e9d6b634b2a6e7"
CRITERIA = dict(
    registered_before_results=True, target="graded unassisted objective answer",
    warmup=10, minimum_independent_seeds=5, bootstrap_replicates=2000,
    comparators=[["GLOBAL_HISTORICAL_MEAN","FIXED_050"],["GLOBAL_HISTORICAL_MEAN","FIXED_020"],["SMOOTHED_TOPIC_MEAN","GLOBAL_HISTORICAL_MEAN"]],
    development_run="run-002 motivated adding the stronger global comparator; no model parameters were tuned",
    task_assumption="five-choice synthetic tasks; fixed .20 is the declared chance baseline",
    scientific_superiority="Both paired Brier and log-loss mean-difference bootstrap upper bounds < 0.",
    no_human_validation=True, decision_authority=False,
    note="Seed-cluster intervals are conditional on this simulator, not evidence about human learners.")

def dump(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False), encoding="utf-8")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def resolve_rscript():
    explicit = os.environ.get("FISCALSTUDY_RSCRIPT")
    if explicit and Path(explicit).is_file():
        return explicit
    executable = shutil.which("Rscript")
    if executable:
        return executable
    candidates = sorted(Path("C:/Program Files/R").glob("R-*/bin/Rscript.exe"), reverse=True)
    if candidates:
        return str(candidates[0])
    raise RuntimeError("Rscript unavailable; no substitute model or fabricated results")

def score(rows):
    if not rows:
        return dict(n=0, brier=None, log_loss=None, calibration_bias=None, probability_rmse=None)
    probabilities = [float(r["predicted_probability"]) for r in rows]
    outcomes = [int(r["observed_correct"]) for r in rows]
    if any(not math.isfinite(p) or p < 0 or p > 1 for p in probabilities):
        raise ValueError("Invalid model probability")
    if any(y not in (0, 1) for y in outcomes):
        raise ValueError("Invalid binary outcome")
    logloss = sum(-y * math.log(max(p, 1e-15)) - (1-y) * math.log(max(1-p, 1e-15))
                  for p, y in zip(probabilities, outcomes)) / len(rows)
    return dict(n=len(rows), brier=sum((p-y)**2 for p,y in zip(probabilities,outcomes))/len(rows),
                log_loss=logloss, calibration_bias=sum(p-y for p,y in zip(probabilities,outcomes))/len(rows),
                probability_rmse=math.sqrt(sum((p-float(r["true_probability"]))**2 for p,r in zip(probabilities,rows))/len(rows)))

def quantile(values, p):
    ordered = sorted(values)
    return ordered[int((len(ordered)-1)*p)]

def interval(values):
    if len(values) < 2:
        return [None, None]
    rng = random.Random(90210)
    sampled = [sum(rng.choices(values, k=len(values)))/len(values) for _ in range(CRITERIA["bootstrap_replicates"])]
    return [quantile(sampled, .025), quantile(sampled, .975)]

def reliability(rows):
    bins = []
    for index in range(10):
        bucket = [r for r in rows if min(9, int(float(r["predicted_probability"])*10)) == index]
        if not bucket:
            continue
        n = len(bucket)
        p = sum(float(r["predicted_probability"]) for r in bucket)/n
        accuracy = sum(int(r["observed_correct"]) for r in bucket)/n
        z = 1.959963984540054
        center = (accuracy+z*z/(2*n))/(1+z*z/n)
        spread = z*math.sqrt(accuracy*(1-accuracy)/n+z*z/(4*n*n))/(1+z*z/n)
        bins.append(dict(bin=index, n=n, mean_prediction=p, observed_accuracy=accuracy,
                         binomial_wilson_interval=[max(0,center-spread),min(1,center+spread)]))
    return bins

def evaluate(predictions, truth):
    reference = {r["event_id"]: r for r in truth}
    scored, seen = [], set()
    for p in predictions:
        key = (p["event_id"], p["model_name"])
        if key in seen:
            raise ValueError("Duplicated model prediction")
        seen.add(key)
        row = dict(p)
        actual = reference[row["event_id"]]
        if int(row["observed_correct"]) != actual["observed_correct"]:
            raise ValueError("Model output not linked to its observed event")
        row.update(true_probability=actual["probability_correct"], profile=actual["profile"], skill=actual["skill"],
                   true_knowledge=actual["knowledge"], true_retrieval=actual["retrieval"])
        scored.append(row)
    event_rows = {r["event_id"]: r for r in scored}
    for r in event_rows.values():
        for name, probability in (("FIXED_050",.5),("FIXED_020",.2)):
            scored.append(dict(r, model_name=name, predicted_probability=probability))
    return scored

def report_html(path, summary, rows):
    # The dashboard is created from executed output, never a demo data fallback.
    payload = json.dumps(dict(summary=summary, rows=rows), allow_nan=False).replace("<", "\\u003c")
    html = """<!doctype html><meta charset="utf-8"><title>FiscalStudy Synthetic Laboratory</title>
<style>body{font:16px system-ui;margin:2rem;max-width:1100px;background:#f6f6f2;color:#222}table{border-collapse:collapse;width:100%}td,th{padding:.5rem;border-bottom:1px solid #ccc;text-align:left}.warn{background:#fff0c2;padding:1rem}select{padding:.6rem;margin:.5rem}pre{white-space:pre-wrap}svg{background:white}small{color:#555}</style>
<h1>FiscalStudy — laboratório executado</h1><p class="warn">DADOS SINTÉTICOS. Resultados condicionais ao simulador. Sem validação humana; sem autoridade de planejamento.</p>
<label>Perfil <select id="profile"></select></label><label>Modelo <select id="model"></select></label><label>Habilidade <select id="skill"></select></label>
<p id="metrics"></p><svg id="chart" viewBox="0 0 400 280" width="600" role="img" aria-label="Reliability diagram"></svg>
<p><small>Curva: probabilidade de acerto versus frequência observada. Não é curva de memória. K/R são estados verdadeiros apenas no simulador; não entram no Motor R. Estimativa mnemônica do Motor: indisponível neste adaptador.</small></p>
<table><thead><tr><th>Evento observado</th><th>Previsão P(acerto)</th><th>Resultado posterior</th><th>K verdadeiro</th><th>R verdadeiro</th><th>Item</th></tr></thead><tbody id="events"></tbody></table>
<h2>Escopo e critérios</h2><pre id="details"></pre>
<script>const data=PAYLOAD;
const controls=['profile','model','skill'];
for(const field of controls){const el=document.getElementById(field);for(const v of [...(field==='model'?[]:['ALL']),...new Set(data.rows.map(r=>r[field==='model'?'model_name':field]))]){const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);}el.onchange=draw;}
function draw(){const rows=data.rows.filter(r=>controls.every(f=>document.getElementById(f).value==='ALL'||r[f==='model'?'model_name':f]===document.getElementById(f).value));
document.getElementById('metrics').textContent='N='+rows.length+' | '+(rows.length?'Brier='+ (rows.reduce((s,r)=>s+(+r.predicted_probability-+r.observed_correct)**2,0)/rows.length).toFixed(4):'Sem evidência');
const tbody=document.getElementById('events');tbody.replaceChildren();for(const r of rows.slice(-30)){const tr=document.createElement('tr');for(const v of [r.event_id,(+r.predicted_probability).toFixed(3),r.observed_correct,(+r.true_knowledge).toFixed(3),(+r.true_retrieval).toFixed(3),r.question_id]){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}tbody.appendChild(tr);}
let svg='<line x1="35" y1="240" x2="360" y2="20" stroke="#aaa"/>';for(let b=0;b<10;b++){const bin=rows.filter(r=>Math.min(9,Math.floor(+r.predicted_probability*10))===b);if(bin.length){const x=bin.reduce((s,r)=>s+(+r.predicted_probability),0)/bin.length;const y=bin.reduce((s,r)=>s+(+r.observed_correct),0)/bin.length;svg+='<circle cx="'+(35+325*x)+'" cy="'+(240-220*y)+'" r="5" fill="#176783"><title>N='+bin.length+'</title></circle>';}}
svg+='<text x="100" y="270">Probabilidade de acerto prevista</text>';document.getElementById('chart').innerHTML=svg;}
document.getElementById('details').textContent=JSON.stringify(data.summary,null,2);draw();</script>"""
    path.write_text(html.replace("PAYLOAD",payload), encoding="utf-8")

def run(engine, output, seeds, interactions):
    engine, output = engine.resolve(), output.resolve()
    allowed = engine/"tests"/"fixtures"/"learner_lab"
    if not output.is_relative_to(allowed.resolve()):
        raise ValueError("Output must be confined to tests/fixtures/learner_lab")
    output.mkdir(parents=True, exist_ok=False)  # Never overwrite a previous experiment.
    rscript = resolve_rscript()
    dump(output/"criteria.json", CRITERIA)  # Frozen before observing outcomes.
    all_scored, seed_results, input_records, pending_truth, support = [], [], [], [], []
    for replicate_index, seed in enumerate(seeds):
        folder = output/("replicate-%02d" % replicate_index)
        input_dir = folder/"input"
        input_dir.mkdir(parents=True)
        events, truth, profiles = generate(seed, interactions)
        validate(events)
        observations = input_dir/"observations.csv"
        write_events(observations, events)
        manifest = dict(contract_version="learner_lab_events_v1", source_kind="SYNTHETIC_BENCHMARK",
                        row_count=len(events), input_sha256=sha(observations), can_apply=False)
        dump(input_dir/"manifest.json",manifest)
        predicted = folder/"predictions.csv"
        # Latent states/parameters are only in Python memory at this point.
        command = [rscript,str(engine/"lab"/"engine_adapter.R"),str(observations),str(predicted),str(input_dir/"manifest.json")]
        result = subprocess.run(command,cwd=engine,capture_output=True,text=True,errors="replace",timeout=120)
        (folder/"r.log").write_text(result.stdout+"\n"+result.stderr,encoding="utf-8")
        if result.returncode:
            raise RuntimeError("Real R execution failed; inspect "+str(folder/"r.log"))
        with predicted.open(encoding="utf-8-sig",newline="") as stream:
            predictions = list(csv.DictReader(stream))
        # Hold every latent artifact until all R processes have exited.
        pending_truth.append((folder,dict(states=truth,profiles=profiles)))
        support.append(json.loads(Path(str(predicted)+".status.json").read_text(encoding="utf-8")))
        scored = evaluate(predictions,truth)
        for row in scored:
            row["seed"] = seed
        all_scored.extend(scored)
        by_model={m:score([r for r in scored if r["model_name"]==m]) for m in sorted({r["model_name"] for r in scored})}
        seed_results.append(dict(seed=seed,models=by_model))
        input_records.append(dict(seed=seed,sha256=manifest["input_sha256"],rows=len(events),
                                  prediction_file_sha256=sha(predicted),status_file_sha256=sha(Path(str(predicted)+".status.json"))))
    for folder, latent in pending_truth:
        dump(folder/"truth.json",latent)
    models = sorted({r["model_name"] for r in all_scored})
    metrics={m:dict(**score([r for r in all_scored if r["model_name"]==m]),
                    reliability=reliability([r for r in all_scored if r["model_name"]==m])) for m in models}
    comparisons={}
    for model, comparator in CRITERIA["comparators"]:
        diffs={key:[s["models"][model][key]-s["models"][comparator][key] for s in seed_results] for key in ("brier","log_loss")}
        bounds={key:interval(values) for key,values in diffs.items()}
        enough=len(seeds)>=CRITERIA["minimum_independent_seeds"]
        superior=enough and all(bound[1] is not None and bound[1]<0 for bound in bounds.values())
        worse=enough and all(bound[0] is not None and bound[0]>0 for bound in bounds.values())
        comparisons[model+"__VS__"+comparator]=dict(seed_paired_differences=diffs,seed_cluster_bootstrap_intervals=bounds,
            classification="APROVADO_SOMENTE_NESTE_SIMULADOR" if superior else "REPROVADO_NESTE_SIMULADOR" if worse else "INCONCLUSIVO")
    summary=dict(version=VERSION,source_kind="SYNTHETIC_BENCHMARK",seeds=seeds,interactions=interactions,
        event_count=sum(x["rows"] for x in input_records),prediction_count=len(all_scored),
        unique_evaluated_event_count=len({r["event_id"] for r in all_scored}),
        metrics=metrics,comparisons=comparisons,independent_seed_count=len(seeds),engine_base_commit=ENGINE_BASE_COMMIT,
        support=support,by_profile={profile:{m:score([r for r in all_scored if r["model_name"]==m and r["profile"]==profile]) for m in models} for profile in sorted({r["profile"] for r in all_scored})},
        criteria=CRITERIA,can_apply=False,can_schedule=False,is_empirically_validated=False,
        limitations=["Repeated attempts are dependent; binomial bin intervals are descriptive, not independence-adjusted.",
                      "Bootstrap uses seed clusters; only the specified generator population is covered.",
                      "No retention estimator, FSRS scheduler, pyBKT, causal policy evaluation or human data was executed.",
                      "First-seen question_id does not establish conceptual transfer."],
        experiments={k:({"A":"EXECUTED_SYNTHETIC_PREQUENTIAL","B":"EXECUTED_DESCRIPTIVE_CALIBRATION","G":"PARTIAL_COLD_START_GATE","I":"PARTIAL_WITHIN_STUDENT_TEMPORAL"}.get(k,"NOT_EXECUTED")) for k in "ABCDEFGHIJ"})
    dump(output/"summary.json",summary)
    dump(output/"identifiability.json",identifiability_probe())
    engine_files=sorted((engine/"R").glob("*.R"))+[engine/"lab"/"engine_adapter.R",engine/"lab"/"event_contract.json"]
    report_html(output/"report.html",summary,all_scored)
    artifacts={str(p.relative_to(output)):sha(p) for p in sorted(output.rglob("*")) if p.is_file()}
    dump(output/"run-manifest.json",dict(version=VERSION,source_kind="SYNTHETIC_BENCHMARK",status="SUCCEEDED",
        python_version=platform.python_version(),engine_base_commit=ENGINE_BASE_COMMIT,
        r_version=support[0]["r_version"],jsonlite_version=support[0]["jsonlite_version"],seeds=seeds,inputs=input_records,
        engine_hashes={str(p.relative_to(engine)):sha(p) for p in engine_files},
        lab_hashes={p.name:sha(p) for p in sorted((engine/"lab").glob("*.py"))},
        artifacts=artifacts,can_apply=False,can_schedule=False))
    return summary

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--seeds",default="11,23,37,53,71")
    parser.add_argument("--interactions",type=int,default=48)
    options=parser.parse_args()
    seeds=[int(x) for x in options.seeds.split(",")]
    if len(set(seeds))!=len(seeds) or not seeds or not 12<=options.interactions<=500:
        parser.error("Unique seeds and 12..500 interactions required")
    engine=Path(__file__).resolve().parents[1]
    try:
        result=run(engine,options.output,seeds,options.interactions)
    except Exception as error:
        folder=options.output.resolve()
        if not isinstance(error,FileExistsError) and folder.is_relative_to((engine/"tests"/"fixtures"/"learner_lab").resolve()) and folder.is_dir():
            dump(folder/"failure.json",dict(status="FAILED",source_kind="SYNTHETIC_BENCHMARK",
                 error_type=type(error).__name__,error=str(error),can_apply=False))
        raise
    print(json.dumps(dict(events=result["event_count"],predictions=result["prediction_count"],comparisons=result["comparisons"])))
