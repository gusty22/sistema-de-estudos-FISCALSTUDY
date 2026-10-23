#!/usr/bin/env python3
"""
second_brain_bridge.py - Ponte unificada entre Obsidian (Semântico) e Graphify (Estrutural).
Parte do Segundo Cérebro Técnico do FiscalStudy.

Permite:
- Resolver uma pergunta conceitual -> notas Obsidian -> nós AST no Graphify -> arquivos reais.
- Descobrir raio de impacto (quais notas e quais códigos são afetados por uma mudança).
"""

import sys
import json
import argparse
import subprocess
from pathlib import Path

# Assegura que o stdout aceite caracteres UTF-8 mesmo no console cp1252 do Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
OBSIDIAN_SCRIPT = BASE_DIR / "scripts" / "obsidian_kb.py"

def run_obsidian_query(query: str, limit: int = 3):
    cmd = [sys.executable, str(OBSIDIAN_SCRIPT), "--query", query, "--limit", str(limit), "--json"]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8",
            errors="replace"
        )
        return json.loads(res.stdout)
    except Exception:
        return []

def run_graphify_query(term: str):
    cmd = ["graphify", "query", term]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(BASE_DIR),
            encoding="utf-8",
            errors="replace"
        )
        lines = res.stdout.splitlines()
        nodes = []
        for l in lines:
            if l.startswith("NODE "):
                nodes.append(l[5:].strip())
        return nodes[:10]
    except Exception:
        return []

def bridge_query(concept_or_question: str):
    print(f"\n[Segundo Cérebro: Ponte Cognitiva] Analisando: '{concept_or_question}'\n" + "="*75)
    
    # 1. Recuperar contexto do Obsidian
    notes = run_obsidian_query(concept_or_question, limit=3)
    print("1. CONTEXTO SEMÂNTICO (Obsidian):")
    if not notes:
        print("   Nenhuma nota direta encontrada.")
    else:
        for n in notes:
            print(f"   • {n['title']} (Seção: {n['section']}) -> Relevância: {n['score']}")
            first_line = n['excerpt'].splitlines()[0] if n['excerpt'] else ""
            print(f"     Resumo: {first_line[:120]}...")
            
    # 2. Consultar topologia estrutural (Graphify)
    print("\n2. TOPOLOGIA ESTRUTURAL DO CÓDIGO (Graphify):")
    nodes = run_graphify_query(concept_or_question)
    if not nodes:
        print("   Nenhum nó de código retornado diretamente.")
    else:
        for node in nodes[:6]:
            print(f"   • {node}")
            
    print("\n3. DIRETRIZ DE ENGENHARIA:")
    print("   Consulte a especificação correspondente em 'docs/architecture/modules/'")
    print("   e o grafo estrutural antes de efetuar alterações no código-fonte.")
    print("="*75 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Ponte integrada Obsidian + Graphify")
    parser.add_argument("query", type=str, help="Pergunta ou conceito a ser investigado")
    args = parser.parse_args()
    bridge_query(args.query)

if __name__ == "__main__":
    main()
