"""Scan bounded commit ranges; full history requires explicit dispatch."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

def scan(executable, event, event_name, report):
    if event_name == "pull_request":
        base, head = event["pull_request"]["base"]["sha"], event["pull_request"]["head"]["sha"]
        mode = "range"
    elif event_name == "push":
        base, head = event["before"], event["after"]
        mode = "tree" if base == "0" * 40 else "range"
    else:
        base, head = "", ""
        mode = "history" if event.get("inputs", {}).get("history") in {True, "true"} else "tree"
    for sha in (base, head):
        if sha and not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise ValueError("Invalid commit SHA")
    command = [executable, "git" if mode != "tree" else "dir", ".",
               "--redact=100", "--no-banner", "--ignore-gitleaks-allow",
               "--report-format=json", "--report-path", str(report), "--timeout=180"]
    if mode == "range":
        command += ["--log-opts", f"{base}..{head}"]
    result = subprocess.run(command, capture_output=True)
    if result.returncode not in (0, 1):
        print("Gitleaks execution failed; inspect configuration privately", file=sys.stderr)
        return result.returncode
    if not report.exists():
        print("Gitleaks report missing", file=sys.stderr)
        return 2
    findings = json.loads(report.read_text(encoding="utf-8"))
    for finding in findings:
        print(json.dumps({k: finding.get(k) for k in ("RuleID", "File", "StartLine", "Commit")}))
    print(f"Gitleaks: mode={mode}, findings={len(findings)}")
    return result.returncode

if __name__ == "__main__":
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    raise SystemExit(scan(sys.argv[1], event, os.environ["GITHUB_EVENT_NAME"],
                          Path(os.environ["RUNNER_TEMP"]) / "gitleaks-redacted.json"))
