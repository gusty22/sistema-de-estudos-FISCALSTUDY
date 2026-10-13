"""Leitura do gabarito oficial IBGP (PDF textual com varios cargos lado a lado).

O PDF "gab_def" da IBGP traz, numa mesma pagina, colunas QUESTAO/ALTERNATIVA
para varios cargos (ex.: 502, 503, 505). A coluna de cada cargo e localizada
pela posicao horizontal do cabecalho "<codigo> - <CARGO>".

Resultado: {numero: "A".."E" | "ANULADA"} mais metadados de origem. Nao ha
valor padrao: questao ausente no PDF fica ausente no resultado.
"""
from __future__ import annotations

import hashlib
import re

import pymupdf

VALID = {"A", "B", "C", "D", "E", "ANULADA"}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_key_status(text: str) -> str:
    upper = text.upper()
    if "APÓS RECURSO" in upper or "APOS RECURSO" in upper or "DEFINITIVO" in upper:
        return "DEFINITIVO"
    if "PRELIMINAR" in upper:
        return "PRELIMINAR"
    return "SOB_REVISAO"


def parse_ibgp_answer_key(pdf_path: str, cargo_codigo: str) -> dict:
    doc = pymupdf.open(pdf_path)
    try:
        for page_index, page in enumerate(doc):
            words = page.get_text("words")  # x0, y0, x1, y1, text, block, line, wno
            header = [w for w in words if w[4] == cargo_codigo]
            if not header:
                continue
            hy0, hy1 = header[0][1], header[0][3]
            # Os cabecalhos de cargo (codigos de 3 digitos na mesma linha) e os
            # cabecalhos "QUESTAO" aparecem na mesma ordem horizontal: o k-esimo
            # cargo corresponde a k-esima coluna QUESTAO/ALTERNATIVA.
            codes = sorted(
                (w for w in words if re.fullmatch(r"\d{3}", w[4]) and abs(w[1] - hy0) < 5 and abs(w[3] - hy1) < 5),
                key=lambda w: w[0],
            )
            q_headers = sorted((w[0] for w in words if w[4].upper().startswith("QUEST")), key=float)
            if len(codes) != len(q_headers):
                raise ValueError(
                    f"Layout inesperado no gabarito: {len(codes)} cargos e {len(q_headers)} colunas QUESTAO"
                )
            rank = [w[4] for w in codes].index(cargo_codigo)
            left = q_headers[rank] - 15
            right = q_headers[rank + 1] - 15 if rank + 1 < len(q_headers) else page.rect.width
            col_words = [w for w in words if left <= w[0] < right]
            rows: dict = {}
            for w in col_words:
                rows.setdefault(round(w[1]), []).append(w)
            key: dict = {}
            for y in sorted(rows):
                tokens = sorted(rows[y], key=lambda w: w[0])
                texts = [t[4] for t in tokens]
                for i, t in enumerate(texts[:-1]):
                    if t.isdigit() and texts[i + 1].upper() in VALID:
                        key.setdefault(int(t), texts[i + 1].upper())
            text = page.get_text()
            return {
                "cargo_codigo": cargo_codigo,
                "status": detect_key_status(text),
                "source_file": pdf_path.replace("\\", "/").split("/")[-1],
                "source_sha256": sha256_file(pdf_path),
                "source_page": page_index + 1,
                "answers": dict(sorted(key.items())),
            }
    finally:
        doc.close()
    raise ValueError(f"Cargo {cargo_codigo} nao encontrado em {pdf_path}")
