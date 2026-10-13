"""Orquestrador do pipeline documental de ingestão do FiscalStudy.

Ponto único de execução para inspecionar documentos, analisar layout,
extrair questões estruturadas, associar gabaritos e renderizar evidências visuais.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional

from .answer_key_service import apply_answer_key_to_questions, parse_tabular_answer_key
from .document_inspector import inspect_document
from .evidence_renderer import render_document_evidence_pages
from .layout_engine import LayoutEngine


def run_pipeline(
    exam_pdf_path: str,
    output_dir: str,
    answer_key_pdf_path: Optional[str] = None,
    cargo_codigo: Optional[str] = "532",
    metadata: Optional[Dict[str, Any]] = None,
    render_evidence: bool = True,
) -> Dict[str, Any]:
    """Executa o pipeline completo de ponta a ponta."""
    os.makedirs(output_dir, exist_ok=True)
    metadata = metadata or {}

    # 1. Inspeção Documental (Fase 3)
    inspection = inspect_document(exam_pdf_path)

    # 2. Análise de Layout e Extração Estruturada (Fase 5, 6, 7)
    engine = LayoutEngine()
    extraction = engine.process_pdf(exam_pdf_path, metadata=metadata)
    questions = extraction["level3_questions"]

    # 3. Associação de Gabarito Oficial (Fase 8)
    answer_key_summary = None
    if answer_key_pdf_path and os.path.exists(answer_key_pdf_path):
        key_data = parse_tabular_answer_key(answer_key_pdf_path, cargo_codigo=cargo_codigo)
        apply_answer_key_to_questions(questions, key_data["answers"], key_data["status"])
        answer_key_summary = {
            "file": os.path.basename(answer_key_pdf_path),
            "status": key_data["status"],
            "cargo_codigo": cargo_codigo,
            "answers_matched": len(key_data["answers"]),
        }
    else:
        # Sem gabarito associado
        for q in questions:
            if "correct_option" not in q:
                q["correct_option"] = None
                q["gabarito_status"] = "AUSENTE"

    # 4. Renderização de Evidências Visuais (Fase 10)
    evidence_map = {}
    if render_evidence:
        evidence_dir = os.path.join(output_dir, "evidence")
        # Identifica páginas que contêm questões extraídas
        pages_needed = set()
        for q in questions:
            for p in q.get("pages", []):
                pages_needed.add(p)

        evidence_map = render_document_evidence_pages(
            exam_pdf_path, evidence_dir, pages_to_render=sorted(pages_needed), dpi=140
        )
        for q in questions:
            p_first = q.get("pages", [1])[0]
            if p_first in evidence_map:
                q["evidence_image"] = evidence_map[p_first]

    # 5. Métricas de Qualidade e Resumo (Fase 9)
    valid_count = sum(1 for q in questions if q.get("status") == "STRUCTURALLY_VALID")
    needs_review_count = sum(1 for q in questions if q.get("status") == "NEEDS_REVIEW")
    rejected_count = sum(1 for q in questions if q.get("status") == "REJECTED")

    result = {
        "version": "v1",
        "pipeline_status": "COMPLETED",
        "inspection": inspection,
        "answer_key_summary": answer_key_summary,
        "summary": {
            "total_questions": len(questions),
            "structurally_valid": valid_count,
            "needs_review": needs_review_count,
            "rejected": rejected_count,
            "raw_blocks_level2": extraction["level2_raw_blocks_count"],
            "audit_exclusions_count": len(extraction["audit_log"]),
        },
        "questions": questions,
        "audit_log": extraction["audit_log"],
        "shared_contexts": extraction["shared_contexts"],
    }

    # Salva resultado em JSON no diretório de saída
    out_json_path = os.path.join(output_dir, "pipeline_result.json")
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    return result


def main():
    parser = argparse.ArgumentParser(description="FiscalStudy Document Ingestion Pipeline")
    parser.add_argument("--exam", required=True, help="Path to exam PDF")
    parser.add_argument("--answer-key", default=None, help="Path to answer key PDF")
    parser.add_argument("--cargo-code", default="532", help="Cargo code (e.g. 532, 503)")
    parser.add_argument("--output-dir", required=True, help="Directory to save artifacts and json")
    parser.add_argument("--metadata", default="{}", help="JSON string of metadata")
    parser.add_argument("--metadata-file", default=None, help="Path to JSON file containing metadata")
    parser.add_argument("--no-evidence", action="store_true", help="Do not render page images")

    args = parser.parse_args()
    if args.metadata_file and os.path.exists(args.metadata_file):
        with open(args.metadata_file, "r", encoding="utf-8") as mf:
            meta = json.load(mf)
    else:
        meta = json.loads(args.metadata)
    
    result = run_pipeline(
        exam_pdf_path=args.exam,
        output_dir=args.output_dir,
        answer_key_pdf_path=args.answer_key,
        cargo_codigo=args.cargo_code,
        metadata=meta,
        render_evidence=not args.no_evidence,
    )
    print(f"PIPELINE_SUCCESS: {result['summary']['total_questions']} questions processed.")


if __name__ == "__main__":
    main()
