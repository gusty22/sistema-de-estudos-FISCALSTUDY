#!/usr/bin/env python3
"""Model-independent context CLI. JSON output, bounded excerpts, explicit updates."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
def local(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
index = local("context_index")
kb = local("obsidian_kb")
task_reg = local("task_registry")

def tracked(root=ROOT):
    return subprocess.run(["git", "ls-files", "-z"], cwd=root, check=True,
                          capture_output=True).stdout.decode("utf-8").split("\0")

def snippet(file, line, max_chars=600, root=ROOT, lines=None):
    full = (root / file).resolve()
    if not full.is_relative_to(root.resolve()) or full.is_symlink():
        raise ValueError("Path outside repository")
    lines = full.read_text(encoding="utf-8").splitlines() if lines is None else lines
    start = max(0, line - 3)
    text = "\n".join(f"{n+1}: {lines[n]}" for n in range(start, min(len(lines), line + 4)))
    return {"path": file, "line": line, "excerpt": text[:max_chars]}

def locate(symbol, module=None, root=ROOT, relations=False):
    files = index.inventory(root)
    state = index.refresh(root, files=files)
    if module:
        files = {p: h for p, h in files.items() if p.startswith(module.rstrip("/") + "/")}
    graph_path = root / state["graph"]
    if state["status"] == "fresh":
        try:
            graph = json.loads(graph_path.read_text(encoding="utf-8"))
            if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list):
                raise ValueError("Invalid graph schema")
        except (OSError, ValueError):
            graph = {}
            state = {**state, "status": "invalid"}
        nodes = [n for n in graph.get("nodes", [])
                 if (n.get("id") == symbol or n.get("label", "").casefold() == symbol.casefold()
                     or Path(n.get("source_file", "")).stem.casefold() == symbol.casefold())
                 and n.get("source_file") in files]
        named = [n for n in nodes if n.get("id") == symbol or n.get("label", "").casefold() == symbol.casefold()]
        nodes = named or [n for n in nodes if n.get("source_location") == "L1"]
        # Full ID always selects one node; filename search may expose overloads explicitly.
        exact = [n for n in nodes if n.get("id") == symbol]
        nodes = exact or nodes
        if nodes:
            selected = []
            for node in nodes[:4]:
                loc = str(node.get("source_location", "L1"))
                line = int(loc[1:].split("-")[0]) if loc.startswith("L") else 1
                selected.append({"id": node["id"], **snippet(node["source_file"], line, root=root)})
            result = {"backend": "graphify-index", "ambiguous": len(nodes) > 1, "matches": selected}
            if relations and len(nodes) == 1 and shutil.which("graphify"):
                try:
                    proc = subprocess.run(["graphify", "query", symbol, "--seed", nodes[0]["id"],
                                           "--budget", "500", "--graph", str(graph_path)],
                                          cwd=root, capture_output=True, text=True, encoding="utf-8",
                                          errors="replace", timeout=45)
                    result["relations_status"] = proc.returncode
                    result["relations"] = proc.stdout[:2400]
                except (OSError, subprocess.SubprocessError):
                    result["relations_status"] = "unavailable"
            return result
    # Exact filename first avoids reading an entire module for a known service.
    paths = [p for p in files if Path(p).stem.casefold() == symbol.casefold()]
    if paths:
        matches = []
        for p in paths[:3]:
            lines = (root / p).read_text(encoding="utf-8").splitlines()
            anchor = next((n for n, line in enumerate(lines, 1) if symbol.casefold() in line.casefold()), 1)
            matches.append(snippet(p, anchor, root=root, lines=lines))
        return {"backend": "tracked-path", "index_status": state["status"], "matches": matches}
    results = []
    for file in sorted(files):
        for n, line in enumerate((root / file).read_text(encoding="utf-8").splitlines(), 1):
            if symbol.casefold() in line.casefold():
                results.append(snippet(file, n, root=root))
                break
        if len(results) == 3:
            break
    return {"backend": "selective-text", "index_status": state["status"], "matches": results}

def docs(query, file=None, root=ROOT):
    # Only versioned technical docs; historical logs and personal corpora are not searched.
    names = tracked(root)
    paths = [p for p in names if p.endswith(".md") and
             (p.startswith("docs/architecture/") or p.startswith("docs/obsidian-sync/") or
              p.startswith("analytics-engine/docs/") or p.startswith("docs/engineering/") or
              p.startswith("knowledge/")) and
             "/validation/" not in p and "/checkpoints/" not in p]
    if file:
        if file not in names or not file.endswith(".md"):
            raise ValueError("Use a tracked Markdown file")
        paths = [file]
    terms = [t.casefold() for t in query.split() if len(t) >= 3]
    paths.sort(key=lambda p: (-sum(t in p.casefold() for t in terms), p))
    results = []
    for p in paths:
        full = root / p
        if not full.is_file() or full.is_symlink():
            continue
        lines = full.read_text(encoding="utf-8").splitlines()
        for n, line in enumerate(lines, 1):
            if terms and any(t in line.casefold() for t in terms):
                results.append(snippet(p, n, root=root, lines=lines))
                break
        if len(results) == 2:
            break
    return {"backend": "versioned-docs", "matches": results}

def decision(query, db=None, root=ROOT):
    db = db or root / "graphify-out/obsidian_fts.db"
    if db.exists():
        try:
            matches = kb.search_vault(query, db, limit=2, max_chars=600)
            if matches:
                return {"backend": "obsidian-fts5-read-only", "matches": matches}
        except sqlite3.Error:
            pass
    return {"obsidian": "unavailable-or-no-match", **docs(query, root=root)}

def doctor(root=ROOT):
    vault_p = Path(os.environ.get("FISCALSTUDY_OBSIDIAN_VAULT") or (root / "knowledge"))
    return {"tools": {name: bool(shutil.which(name)) for name in
                      ("git", "graphify", "openspec", "gitleaks", "codeql", "rg")},
            "python": sys.version.split()[0], "fts5": sqlite3.connect(":memory:").execute(
                "SELECT sqlite_compileoption_used('ENABLE_FTS5')").fetchone()[0] == 1,
            "graph": index.refresh(root), "obsidian_index": (root / "graphify-out/obsidian_fts.db").is_file(),
            "vault_configured": vault_p.is_dir(),
            "vault_path": str(vault_p.relative_to(root)).replace("\\", "/") if vault_p.is_relative_to(root) else str(vault_p),
            "protocol": "AGENTS.md", "skills": ".agents/skills"}

def update(root=ROOT):
    graph_res = index.refresh(root=root, run=True)
    vault_p = Path(os.environ.get("FISCALSTUDY_OBSIDIAN_VAULT") or (root / "knowledge"))
    db_p = root / "graphify-out/obsidian_fts.db"
    obsidian_status = "skipped"
    if vault_p.is_dir():
        try:
            ok = kb.sync_vault(vault_p, db_p)
            obsidian_status = "updated" if ok else "unavailable"
        except Exception as e:
            obsidian_status = f"error: {type(e).__name__}"
    return {
        **graph_res,
        "obsidian": obsidian_status,
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("doctor", "status", "update"):
        sub.add_parser(name)
    loc = sub.add_parser("locate")
    loc.add_argument("symbol")
    loc.add_argument("--module", choices=["backend", "frontend", "analytics-engine", "scripts", "ingestion"])
    loc.add_argument("--relations", action="store_true")
    for name in ("docs", "decision"):
        p = sub.add_parser(name)
        p.add_argument("query")
        p.add_argument("--path" if name == "docs" else "--db", type=Path)
    sync = sub.add_parser("sync")
    sync.add_argument("--vault", type=Path, required=True)
    sync.add_argument("--db", type=Path, required=True)
    sync.add_argument("--exclude", action="append", default=[])

    # task subparser
    task_p = sub.add_parser("task")
    task_sub = task_p.add_subparsers(dest="task_command", required=True)
    tl = task_sub.add_parser("list")
    tl.add_argument("--status", choices=sorted(task_reg.ALLOWED_STATUSES))
    ts = task_sub.add_parser("show")
    ts.add_argument("id")
    tc = task_sub.add_parser("create")
    tc.add_argument("id")
    tc.add_argument("title")
    tc.add_argument("objective")
    tc.add_argument("--agent", default="N/A")
    tc.add_argument("--branch", default="N/A")
    tc.add_argument("--module", action="append", default=[])
    tc.add_argument("--file", action="append", default=[])
    tu = task_sub.add_parser("update")
    tu.add_argument("id")
    tu.add_argument("--status", choices=sorted(task_reg.ALLOWED_STATUSES))
    tu.add_argument("--agent")
    tu.add_argument("--branch")
    tu.add_argument("--module", action="append")
    tu.add_argument("--file", action="append")
    tu.add_argument("--objective")
    tu.add_argument("--discoveries")
    tu.add_argument("--changes")
    tu.add_argument("--tests")
    tu.add_argument("--evidence")
    tu.add_argument("--decisions")
    tu.add_argument("--pending")
    tu.add_argument("--next")
    tu.add_argument("--pr")
    tu.add_argument("--commit", action="append")
    tu.add_argument("--confirm-merge", action="store_true")

    args = parser.parse_args()
    try:
        if args.command == "doctor":
            result = doctor()
        elif args.command == "status":
            result = index.refresh(run=False)
        elif args.command == "update":
            result = update()
        elif args.command == "locate":
            result = locate(args.symbol, args.module, relations=args.relations)
        elif args.command == "docs":
            result = docs(args.query, args.path.as_posix() if args.path else None)
        elif args.command == "decision":
            result = decision(args.query, args.db)
        elif args.command == "task":
            if args.task_command == "list":
                result = {"tasks": task_reg.list_tasks(status=args.status)}
            elif args.task_command == "show":
                result = task_reg.get_task(args.id)
            elif args.task_command == "create":
                result = task_reg.create_task(
                    task_id=args.id,
                    title=args.title,
                    objective=args.objective,
                    agent=args.agent,
                    branch=args.branch,
                    modules=args.module,
                    relevant_files=args.file,
                )
            elif args.task_command == "update":
                result = task_reg.update_task(
                    task_id=args.id,
                    status=args.status,
                    agent=args.agent,
                    branch=args.branch,
                    modules=args.module,
                    relevant_files=args.file,
                    objective=args.objective,
                    discoveries=args.discoveries,
                    changes=args.changes,
                    tests=args.tests,
                    evidence=args.evidence,
                    decisions=args.decisions,
                    pending=args.pending,
                    next_action=args.next,
                    pr=args.pr,
                    commits=args.commit,
                    pr_confirmed=args.confirm_merge,
                )
        else:
            result = {"status": "updated" if kb.sync_vault(args.vault, args.db, excludes=args.exclude) else "unavailable"}
        print(json.dumps(result, ensure_ascii=False))
        return 2 if result.get("status") in {"error", "unavailable"} else 0
    except (OSError, ValueError, sqlite3.Error, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "unavailable", "reason": type(exc).__name__}))
        return 2
if __name__ == "__main__":
    raise SystemExit(main())
