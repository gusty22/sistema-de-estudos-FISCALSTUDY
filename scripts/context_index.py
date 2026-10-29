#!/usr/bin/env python3
"""Bounded, local Graphify lifecycle; never scans operational data or the vault."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PREFIXES = ('backend/src/', 'frontend/src/', 'analytics-engine/R/',
            'analytics-engine/lab/', 'scripts/', 'ingestion/')
EXTENSIONS = {'.java', '.ts', '.tsx', '.js', '.jsx', '.py', '.r'}
EXCLUDED = {'node_modules', 'target', 'dist', '__pycache__', 'data', 'output',
            'private', '.private', 'venv', '.venv', 'cache', 'db'}


def inventory(root):
    result = subprocess.run(['git', 'ls-files', '-z'], cwd=root, check=True,
                            capture_output=True)
    files = {}
    for name in result.stdout.decode('utf-8').split('\0'):
        p = Path(name)
        if (not name.startswith(PREFIXES) or p.suffix.lower() not in EXTENSIONS
                or EXCLUDED.intersection(part.casefold() for part in p.parts)):
            continue
        full = root / p
        parts = [full, *full.parents]
        if any(x.is_symlink() or (hasattr(x, 'is_junction') and x.is_junction()) for x in parts):
            continue
        if full.is_file() and full.resolve().is_relative_to(root.resolve()):
            files[name] = hashlib.sha256(full.read_bytes()).hexdigest()
    return files


def refresh(root=ROOT, run=False, files=None):
    root = Path(root).resolve()
    out = root / 'graphify-out'
    mirror = out / 'source'
    state_path = out / 'context-state.json'
    graph = mirror / 'graphify-out/graph.json'
    for managed in (out, mirror, state_path, graph):
        if any(p.is_symlink() or (hasattr(p, 'is_junction') and p.is_junction()) for p in [managed, *managed.parents]):
            return {'status': 'error', 'error': 'linked-managed-path', 'graph': 'graphify-out/source/graphify-out/graph.json'}
    files = inventory(root) if files is None else files
    previous = json.loads(state_path.read_text()) if state_path.exists() else {}
    changed = sorted(k for k, v in files.items() if previous.get('files', {}).get(k) != v)
    removed = sorted(set(previous.get('files', {})) - files.keys())
    graph = mirror / 'graphify-out/graph.json'
    fresh = previous.get('files') == files and graph.is_file() and previous.get('status') == 'updated'
    status = {'status': 'fresh' if fresh else 'stale', 'files': len(files),
              'changed': len(changed), 'removed': len(removed),
              'graph': 'graphify-out/source/graphify-out/graph.json'}
    if not run or fresh:
        return status
    out.mkdir(exist_ok=True)
    executable = shutil.which('graphify')
    if not executable:
        status['status'] = 'unavailable'
    else:
        # Only individual files owned by this helper; no recursive removal.
        for name in removed:
            dest = mirror / name
            if dest.resolve().is_relative_to(mirror.resolve()):
                dest.unlink(missing_ok=True)
        for name in files:
            dest = mirror / name
            if name in changed or not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(root / name, dest)
        try:
            result = subprocess.run([executable, 'update', str(mirror), '--no-cluster'],
                                    cwd=root, capture_output=True, timeout=240,
                                    env={**os.environ, 'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'})
            (out / 'update.log').write_bytes(result.stdout + result.stderr)
            status['exit_code'] = result.returncode
            status['status'] = 'updated' if result.returncode == 0 and graph.is_file() else 'error'
        except (OSError, subprocess.TimeoutExpired) as exc:
            status.update(status='error', error=type(exc).__name__)
    state_path.write_text(json.dumps({**status, 'files': files}, indent=2), encoding='utf-8')
    return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--update', action='store_true', help='Run once after completing a source change')
    args = parser.parse_args()
    state = refresh(run=args.update)
    print(json.dumps(state))
    raise SystemExit(2 if state['status'] in {'error', 'unavailable'} else 0)
