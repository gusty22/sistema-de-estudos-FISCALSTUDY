"""Only synthetic Java-generated fixtures; privately replay the same signed artifact."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ENGINE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ENGINE / "lab"))
from personal_pilot import evaluate_local


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rscript", default="Rscript")
    parser.add_argument("--second-rscript", default="Rscript")
    parser.add_argument("--second-r-home")
    args = parser.parse_args()
    fixture = ENGINE.parent / "backend/target/prospective-attested-fixture.json"
    key = ENGINE.parent / "backend/target/prospective-fixture-public.pem"
    envelope = json.loads(fixture.read_text(encoding="utf-8"))
    if json.loads(envelope["inputJson"]).get("sourceKind") != "SYNTHETIC_FIXTURE":
        raise ValueError("This fixture harness cannot evaluate personal exports")
    with tempfile.TemporaryDirectory(prefix="fiscalstudy signed replay ") as temporary:
        root = Path(temporary)
        result = evaluate_local(fixture, root / "private run", args.rscript, True,
                                key, "SYNTHETIC-INTEGRATION-INSTALLATION")
        second_env = os.environ.copy()
        if args.second_r_home:
            second_env["RHOME"] = args.second_r_home
            second_env["R_HOME"] = args.second_r_home
        command = [args.second_rscript, str(ENGINE / "lab/attested_prospective_evaluation.R"),
                   str(fixture), str(root / "replay.json"), str(key),
                   "SYNTHETIC-INTEGRATION-INSTALLATION", "synthetic-test"]
        run = subprocess.run(command, cwd=ENGINE, env=second_env, capture_output=True, timeout=120)
        if run.returncode:
            raise RuntimeError("Synthetic R replay failed: " + run.stderr.decode("utf-8", errors="replace"))
        metrics = (root / "private run/metrics.json").read_bytes()
        assert metrics == (root / "replay.json").read_bytes()
        assert metrics.endswith(b"\n") and b"\r\n" not in metrics
        overwrite = subprocess.run(command, cwd=ENGINE, env=second_env, capture_output=True, timeout=120)
        assert overwrite.returncode != 0 and metrics == (root / "replay.json").read_bytes()
        report = json.loads(metrics)
        assert report["personal_profile"] == "NOT_CREATED"
        assert all(value == "NOT_ESTABLISHED" for value in report["six_scientific_targets"].values())
        print(json.dumps({
            "scope": "SYNTHETIC_INTEGRATION_SOFTWARE_ONLY",
            "source_authentication": result["source_authentication"],
            "replay_identical": True, "overwrite_refused": True, "lf_utf8": True,
            "input_sha256": envelope["inputSha256"],
            "input_file_sha256": hashlib.sha256(fixture.read_bytes()).hexdigest(),
            "metrics_sha256": hashlib.sha256(metrics).hexdigest(),
            "forecast_count": report["forecast_count"], "scored_count": report["scored_count"],
            "unforecasted_attempt_count": report["unforecasted_attempt_count"],
            "brier": report["metrics"]["brier"],
            "recent20_brier": report["scientific_scorecard"]["temporal_reference"]["brier"],
            "same_event_comparison": report["scientific_scorecard"]["paired_comparison"],
            "personal_validation": "NOT_ESTABLISHED", "can_apply": False, "can_schedule": False,
        }, sort_keys=True))


if __name__ == "__main__":
    main()
