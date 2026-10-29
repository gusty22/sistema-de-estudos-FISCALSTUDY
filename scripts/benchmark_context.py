#!/usr/bin/env python3
"""Deterministic retrieval comparison, not an API-token or model-quality benchmark."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
import context

ROOT = context.ROOT
BASE = "091ccb89a08e549af8ccf3424160345f6a1a1187"
CASES = [
    ("java-service", "locate", "ProspectivePredictionService", "backend/src/main/java/com/fiscalstudy/backend/application/ProspectivePredictionService.java", "class ProspectivePredictionService"),
    ("architecture-decision", "docs", "APPEND", "docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md", "APPEND"),
    ("scientific-definition", "docs", "NOT_ESTABLISHED", "analytics-engine/docs/SCIENTIFIC_DECISION_EVALUATION_V1.md", "NOT_ESTABLISHED"),
    ("authentication-flow", "locate", "LocalAccessFilter", "backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/LocalAccessFilter.java", "class LocalAccessFilter"),
    ("security-tests", "locate", "ProspectiveExportSecurityTest", "backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/ProspectiveExportSecurityTest.java", "class ProspectiveExportSecurityTest"),
]

def measure():
    old_rules = subprocess.run(["git", "show", BASE + ":AGENTS.md"], cwd=ROOT, check=True, capture_output=True).stdout
    old_context = subprocess.run(["git", "show", BASE + ":.agents/memory/CONTEXT.md"], cwd=ROOT, check=True, capture_output=True).stdout
    startup = (ROOT / "AGENTS.md").read_text(encoding="utf-8").encode("utf-8") + (ROOT / ".agents/memory/CONTEXT.md").read_text(encoding="utf-8").encode("utf-8")
    rows = []
    for name, kind, query, target, required in CASES:
        target_path = ROOT / target
        if not target_path.exists():
            raise RuntimeError("Benchmark oracle path missing: " + target)
        full = target_path.read_text(encoding="utf-8").encode("utf-8")
        before = old_rules + old_context + full
        reads = {}
        calls = []
        original_text, original_bytes = Path.read_text, Path.read_bytes
        original_run = subprocess.run
        def read_text(p, *args, **kwargs):
            result = original_text(p, *args, **kwargs)
            reads[str(p)] = reads.get(str(p), 0) + len(result.encode("utf-8"))
            return result
        def read_bytes(p, *args, **kwargs):
            result = original_bytes(p, *args, **kwargs)
            reads[str(p)] = reads.get(str(p), 0) + len(result)
            return result
        def run(args, **kwargs):
            calls.append(args[0])
            return original_run(args, **kwargs)
        with patch.object(Path, "read_text", read_text), patch.object(Path, "read_bytes", read_bytes), patch.object(subprocess, "run", run):
            result = context.locate(query) if kind == "locate" else context.docs(query, file=target)
        output = json.dumps(result, ensure_ascii=False).encode("utf-8")
        matches = result["matches"]
        exact_path = any(m.get("path") == target for m in matches)
        # Definition coverage is checked independently of path retrieval.
        evidence_found = any(required.casefold() in m.get("excerpt", "").casefold() for m in matches)
        rows.append({
            "task": name, "oracle": target, "backend": result["backend"],
            "baseline": {"procedure":"main rules + main context + complete oracle file (declared baseline)",
                         "context_files":3, "returned_bytes":len(before), "retrieval_queries":1,
                         "api_tokens":None, "estimate_utf8_bytes_div4":round(len(before)/4)},
            "selective": {"context_files":2 + len({m.get("path") for m in matches}), "returned_bytes":len(startup)+len(output),
                          "retrieval_queries":1, "repeated_queries":0, "subprocesses":len(calls),
                          "internal_unique_files":len(reads), "internal_bytes_read":sum(reads.values()),
                          "api_tokens":None, "estimate_utf8_bytes_div4":round((len(startup)+len(output))/4)},
            "path_correct":exact_path, "required_evidence_in_excerpt":evidence_found,
            "model_task_completion":"NOT_MEASURED"
        })
    return {"base":BASE, "method":"Paired deterministic retrieval with fixed oracle paths. Baseline is an explicitly defined full-read procedure, not an observed previous AI session. Byte/4 is a rough UTF-8 estimate, not tokenizer/API measurement. Internal index I/O is separately reported. No model inference or causal efficiency claim.", "cases":rows}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = measure()
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8", newline="\n")
    else:
        print(text)
    raise SystemExit(0 if all(c["path_correct"] and c["required_evidence_in_excerpt"] for c in result["cases"]) else 1)
