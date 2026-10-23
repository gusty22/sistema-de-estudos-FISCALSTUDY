#!/usr/bin/env python3
"""
measure_tokens.py - Auditoria determinística de tokens da sessão ativa do Antigravity.
Lê os registros reais de 'transcript.jsonl' em .system_generated/logs sem conjecturas.
"""

import os
import sys
import json
import glob
from pathlib import Path

# Suporte adequado a saída UTF-8 no Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def find_latest_transcript():
    user_home = Path.home()
    base_dir = user_home / ".gemini" / "antigravity" / "brain"
    
    if not base_dir.exists():
        return None
    
    pattern = str(base_dir / "*" / ".system_generated" / "logs" / "transcript.jsonl")
    transcripts = glob.glob(pattern)
    if not transcripts:
        return None
    
    latest = max(transcripts, key=os.path.getmtime)
    return Path(latest)

def analyze_transcript(transcript_path: Path):
    if not transcript_path or not transcript_path.exists():
        return {"error": "Arquivo transcript.jsonl não localizado."}

    steps = []
    total_new_input = 0
    total_cache_read = 0
    total_output = 0

    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except Exception:
                continue

            usage = item.get("token_usage") or item.get("usage") or {}
            
            inp = usage.get("input_tokens") or item.get("input_tokens", 0)
            cache_read = usage.get("cache_read_tokens") or item.get("cache_read_tokens", 0)
            out = usage.get("output_tokens") or item.get("output_tokens", 0)

            if inp or cache_read or out:
                steps.append({
                    "step_index": item.get("step_index"),
                    "type": item.get("type"),
                    "input_tokens": inp,
                    "cache_read_tokens": cache_read,
                    "output_tokens": out,
                    "created_at": item.get("created_at")
                })
                total_new_input += inp
                total_cache_read += cache_read
                total_output += out

    total_context_processed = total_new_input + total_cache_read

    return {
        "transcript_path": str(transcript_path),
        "total_steps_with_tokens": len(steps),
        "total_new_input_tokens": total_new_input,
        "total_cache_read_tokens": total_cache_read,
        "total_context_tokens_processed": total_context_processed,
        "total_output_tokens": total_output,
        "cache_hit_ratio_percent": round((total_cache_read / total_context_processed * 100), 2) if total_context_processed else 0,
        "recent_steps": steps[-5:] if steps else []
    }

def main():
    transcript_path = None
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        transcript_path = Path(sys.argv[1])
    else:
        transcript_path = find_latest_transcript()

    if not transcript_path:
        print(json.dumps({"error": "Nenhum transcript encontrado."}, indent=2))
        return

    report = analyze_transcript(transcript_path)
    if "--json" in sys.argv:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print("=" * 65)
        print(" AUDITORIA DETERMINÍSTICA DE TOKENS (ANTIGRAVITY)")
        print("=" * 65)
        print(f"Log: {report.get('transcript_path')}")
        print(f"Total de turnos com métricas: {report.get('total_steps_with_tokens')}")
        print(f"Tokens de Novo Input:         {report.get('total_new_input_tokens'):,}")
        print(f"Tokens Lidos de Cache:        {report.get('total_cache_read_tokens'):,}")
        print(f"Total de Contexto Processado: {report.get('total_context_tokens_processed'):,}")
        print(f"Taxa de Cache Hit:            {report.get('cache_hit_ratio_percent')}%")
        print(f"Tokens de Saída (Output):     {report.get('total_output_tokens'):,}")
        print("-" * 65)
        print("Últimos turnos registrados (sem dupla contagem):")
        for s in report.get("recent_steps", []):
            print(f"  [Step {s.get('step_index')}] {s.get('type')}: new_in={s.get('input_tokens')} | cache={s.get('cache_read_tokens')} | out={s.get('output_tokens')}")
        print("=" * 65)

if __name__ == "__main__":
    main()
