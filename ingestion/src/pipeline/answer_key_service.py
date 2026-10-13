"""Serviço de extração e pareamento seguro de gabaritos oficiais.

Responsabilidades:
- Extração de arquivos de gabarito em PDF (preliminar, definitivo, retificado).
- Pareamento por código de cargo, banca e número de questão.
- Separação estrita de status: PRELIMINAR, DEFINITIVO, RETIFICADO, ANULADA, AUSENTE, SOB_REVISAO.
- Proteção contra fallbacks fictícios: nunca preenche opções padrão arbitrariamente.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

import pymupdf


VALID_OPTIONS = {"A", "B", "C", "D", "E", "ANULADA"}


def detect_answer_key_status(doc_text: str) -> str:
    upper = doc_text.upper()
    if "APÓS RECURSO" in upper or "APOS RECURSO" in upper or "DEFINITIVO" in upper:
        return "DEFINITIVO"
    if "RETIF" in upper or "RETIFICADO" in upper:
        return "RETIFICADO"
    if "PRELIMINAR" in upper:
        return "PRELIMINAR"
    return "SOB_REVISAO"


def parse_tabular_answer_key(pdf_path: str, cargo_codigo: Optional[str] = None) -> Dict[str, Any]:
    """Extrai gabarito de PDF tabular (ex: IBGP, FCC, FGV)."""
    doc = pymupdf.open(pdf_path)
    try:
        combined_text = ""
        answers: Dict[int, str] = {}

        for page_idx, page in enumerate(doc):
            words = page.get_text("words")
            page_text = page.get_text()
            combined_text += " " + page_text

            # Se código de cargo especificado (ex: '532' ou '503')
            if cargo_codigo:
                header = [w for w in words if w[4] == cargo_codigo]
                if not header:
                    continue

                hy0, hy1 = header[0][1], header[0][3]
                # Códigos de cargos de 3 dígitos próximos verticalmente (tolerância de 25px para quebras)
                codes = sorted(
                    (w for w in words if re.fullmatch(r"\d{3}", w[4]) and abs(w[1] - hy0) < 25 and abs(w[3] - hy1) < 25),
                    key=lambda w: w[0],
                )
                q_headers = sorted((w[0] for w in words if w[4].upper().startswith("QUEST")), key=float)

                if codes and q_headers and len(codes) == len(q_headers):
                    try:
                        rank = [w[4] for w in codes].index(cargo_codigo)
                        left = q_headers[rank] - 15
                        right = q_headers[rank + 1] - 15 if rank + 1 < len(q_headers) else page.rect.width
                        col_words = [w for w in words if left <= w[0] < right]

                        rows: Dict[int, List[Any]] = {}
                        for w in col_words:
                            rows.setdefault(round(w[1]), []).append(w)

                        for y in sorted(rows):
                            tokens = sorted(rows[y], key=lambda w: w[0])
                            texts = [t[4] for t in tokens]
                            for i, t in enumerate(texts[:-1]):
                                if t.isdigit() and texts[i + 1].upper() in VALID_OPTIONS:
                                    answers.setdefault(int(t), texts[i + 1].upper())
                        
                        if answers:
                            break
                    except ValueError:
                        pass

            # Fallback para extração linear de pares número + alternativa
            if not answers:
                lines = [l.strip() for l in page_text.split("\n") if l.strip()]
                for i, line in enumerate(lines[:-1]):
                    if line.isdigit() and lines[i + 1].upper() in VALID_OPTIONS:
                        q_num = int(line)
                        if 1 <= q_num <= 100:
                            answers.setdefault(q_num, lines[i + 1].upper())

        status = detect_answer_key_status(combined_text)
        return {
            "status": status,
            "cargo_codigo": cargo_codigo,
            "answers_count": len(answers),
            "answers": dict(sorted(answers.items())),
        }
    finally:
        doc.close()


def apply_answer_key_to_questions(
    questions: List[Dict[str, Any]], answer_key_dict: Dict[int, str], status: str
) -> None:
    """Aplica o gabarito oficial às questões estruturadas."""
    for q in questions:
        num = q.get("numero_original")
        if num in answer_key_dict:
            corr = answer_key_dict[num]
            if corr == "ANULADA":
                q["correct_option"] = "ANULADA"
                q["gabarito_status"] = "ANULADA"
            else:
                q["correct_option"] = corr
                q["gabarito_status"] = status
        else:
            q["correct_option"] = None
            q["gabarito_status"] = "AUSENTE"
            q["flags"].append("OFFICIAL_ANSWER_KEY_MISSING")
