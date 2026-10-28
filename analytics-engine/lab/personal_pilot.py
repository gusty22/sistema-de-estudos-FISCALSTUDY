"""Read-only local export evaluation. Does not start study, contact services or write SQLite."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

MAX_EXPORT_BYTES = 32 * 1024 * 1024  # Project policy for this local tool.
ENGINE = Path(__file__).resolve().parents[1]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def validate_export(path, synthetic_test=False):
    path = Path(path)
    if path.stat().st_size > MAX_EXPORT_BYTES:
        raise ValueError("Export exceeds local processing policy")
    raw = path.read_bytes()
    envelope = json.loads(raw.decode("utf-8"))
    if envelope.get("contractVersion") != "prospective-question-v1" or envelope.get("can_apply") is not False or envelope.get("can_schedule") is not False:
        raise ValueError("Unsupported authority/contract")
    payload = envelope.get("inputJson")
    if not isinstance(payload, str) or sha(payload.encode("utf-8")) != envelope.get("inputSha256"):
        raise ValueError("Export integrity mismatch; not an authenticity check")
    source = json.loads(payload)
    if source.get("sourceKind") == "SYNTHETIC_FIXTURE" and not synthetic_test:
        raise ValueError("Synthetic exports require explicit test mode")
    if synthetic_test and source.get("sourceKind") != "SYNTHETIC_FIXTURE":
        raise ValueError("Test mode cannot relabel personal/unknown data")
    return raw, source.get("sourceKind")

def private_write(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(data)

def evaluate_local(input_path, output, rscript="Rscript", synthetic_test=False):
    input_path = Path(input_path).resolve()
    raw, source = validate_export(input_path, synthetic_test)
    output = Path(output).resolve()
    output.mkdir(mode=0o700, exist_ok=False)  # Never overwrite/reuse an existing report directory.
    private_write(output / "input-envelope.json", raw)
    manifest = {
        "contract_version": "personal-pilot-execution-v1",
        "status": "RUNNING",
        "source_kind": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_file_sha256": sha(raw),
        "workflow_protocol": "personal-prospective-pilot-v2",
        "scoring_protocol": "personal-prospective-pilot-v1",
        "cohort": "ALL_PRECOMMITTED_FORECASTS_IN_SNAPSHOT_NOT_A_DELAYED_OR_NOVEL_ITEM_TRIAL",
        "personal_validation": "NOT_ESTABLISHED",
        "can_apply": False, "can_schedule": False,
        "code_sha256": {str(file.relative_to(ENGINE)): sha(file.read_bytes()) for file in sorted(
            list((ENGINE / "R").glob("*.R")) + [ENGINE / name for name in
            ["lab/prospective_evaluation.R", "lab/prospective_scorecard.R", "lab/individual_calibration.R", "lab/personal_pilot.py"]])},
    }
    error = None
    try:
        run = subprocess.run(
            [rscript, str(ENGINE / "lab/prospective_evaluation.R"),
             str(output / "input-envelope.json"), str(output / "metrics.json")],
            cwd=ENGINE, capture_output=True, timeout=120, check=False)
        private_write(output / "r-output.log", run.stdout + run.stderr)
        if run.returncode:
            raise RuntimeError("R evaluation failed; private log retained")
        metrics = json.loads((output / "metrics.json").read_text(encoding="utf-8"))
        if metrics.get("can_apply") is not False or metrics.get("can_schedule") is not False:
            raise RuntimeError("Unexpected analytical authority")
        envelope = json.loads(raw.decode("utf-8"))
        required = ("forecast_count", "scored_count", "excluded_count")
        if (metrics.get("contract_version") != "prospective-evaluation-v1"
                or metrics.get("input_sha256") != envelope["inputSha256"]
                or metrics.get("source_kind") != source
                or any(type(metrics.get(key)) is not int or metrics[key] < 0 for key in required)
                or metrics["scored_count"] > metrics["forecast_count"]
                or not isinstance(metrics.get("metrics"), dict)
                or not isinstance(metrics.get("scientific_scorecard"), dict)):
            raise RuntimeError("Incomplete or mismatched analytical report")
        n = metrics["scored_count"]
        score = metrics["scientific_scorecard"]
        if (score.get("version") != "prospective-scorecard-v1" or score.get("n") != n
                or score.get("can_apply") is not False or score.get("can_schedule") is not False
                or (n == 0 and metrics["metrics"].get("status") != "INSUFFICIENT_EVIDENCE")
                or (n > 0 and metrics["metrics"].get("n") != n)):
            raise RuntimeError("Incomplete scientific scorecard")
        if input_path.read_bytes() != raw:
            raise RuntimeError("Input changed during execution")
        manifest["status"] = "SUCCEEDED_SOFTWARE_EVALUATION_ONLY"
        manifest["metrics_sha256"] = sha((output / "metrics.json").read_bytes())
    except Exception as failed:
        manifest["status"] = "FAILED"
        manifest["failure_type"] = type(failed).__name__
        error = RuntimeError("Evaluation incomplete; inspect local private report")
    finally:
        # On POSIX enforce private outputs; Windows ACLs must be checked separately.
        for file in output.iterdir():
            if file.is_file():
                file.chmod(0o600)
        private_write(output / "manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))
    if error:
        raise error
    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--rscript", default="Rscript")
    parser.add_argument("--synthetic-test", action="store_true")
    args = parser.parse_args()
    try:
        report = evaluate_local(args.input, args.output, args.rscript, args.synthetic_test)
        print(json.dumps({"status": report["status"], "personal_validation": "NOT_ESTABLISHED", "can_apply": False, "can_schedule": False}))
    except Exception:
        print("Local pilot evaluation failed; no personal data or credentials printed.", file=sys.stderr)
        sys.exit(1)
