"""Read-only run integrity audit. Hash consistency is not authenticity/signature."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
from simulator import validate

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def audit(root):
    root = Path(root).resolve()
    manifest_path = root/"run-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if (manifest.get("status") != "SUCCEEDED" or
        manifest.get("source_kind") != "SYNTHETIC_BENCHMARK" or
        manifest.get("can_apply") is not False or manifest.get("can_schedule") is not False):
        raise ValueError("Unapproved run status or authority")
    if (root/"failure.json").exists():
        raise ValueError("Run has a failure artifact")
    recorded = manifest.get("artifacts", {})
    expected = {name.replace(chr(92), "/"):value for name,value in recorded.items()}
    if len(expected) != len(recorded):
        raise ValueError("Ambiguous artifact path aliases")
    actual = {p.relative_to(root).as_posix() for p in root.rglob("*")
              if p.is_file() and p != manifest_path}
    if set(expected) != actual:
        raise ValueError("Missing or unlisted run artifact")
    for relative, checksum in expected.items():
        path = (root/relative).resolve()
        if not path.is_relative_to(root) or not path.is_file() or digest(path) != checksum:
            raise ValueError("Artifact path or hash mismatch: "+relative)
    event_count = 0
    for i, record in enumerate(manifest["inputs"]):
        folder = root/("replicate-%02d" % i)
        observations = folder/"input"/"observations.csv"
        with observations.open(encoding="utf-8-sig", newline="") as stream:
            rows = list(csv.DictReader(stream))
        validate(rows)
        event_count += len(rows)
        sub = json.loads((folder/"input"/"manifest.json").read_text(encoding="utf-8"))
        if (len(rows) != record["rows"] or len(rows) != sub["row_count"] or
            digest(observations) != record["sha256"] or record["sha256"] != sub["input_sha256"]):
            raise ValueError("Input snapshot identity mismatch")
        reference = {r["event_id"]:r for r in rows}
        for name in ("predictions.csv", "pybkt-predictions.csv"):
            path=folder/name
            if not path.exists():
                continue
            seen=set()
            with path.open(encoding="utf-8-sig", newline="") as stream:
                for prediction in csv.DictReader(stream):
                    key=(prediction["event_id"],prediction["model_name"])
                    if key in seen or key[0] not in reference:
                        raise ValueError("Duplicate or unknown prediction event")
                    seen.add(key)
                    probability=float(prediction["predicted_probability"])
                    if not math.isfinite(probability) or not 0<=probability<=1:
                        raise ValueError("Invalid prediction probability")
                    event=reference[key[0]]
                    if (prediction["student_id"] != event["student_id"] or
                        prediction["question_id"] != event["question_id"] or
                        int(prediction["observed_correct"]) != int(event["is_correct"]=="true")):
                        raise ValueError("Prediction identity/outcome mismatch")
                    if (event["gabarito_status"]!="DEFINITIVO" or event["used_help"]!="false" or
                        event["session_complete"]!="true" or event["is_correct"] not in ("true","false")):
                        raise ValueError("Ineligible prediction target")
    summary=json.loads((root/"summary.json").read_text(encoding="utf-8"))
    if (summary["event_count"]!=event_count or summary["can_apply"] is not False or
        summary.get("can_schedule") is not False):
        raise ValueError("Summary inconsistent with snapshots")
    return dict(status="PASSED_INTEGRITY_ONLY",artifacts=len(expected),
        events=event_count,manifest_sha256=digest(manifest_path),
        authenticity="NOT_VERIFIED_NO_SIGNATURE",scientific_validity="NOT_ESTABLISHED",
        can_apply=False)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("run",type=Path)
    options=parser.parse_args()
    print(json.dumps(audit(options.run),sort_keys=True))
