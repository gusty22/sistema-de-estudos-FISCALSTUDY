"""Inspeção e classificação documental para o pipeline de ingestão do FiscalStudy.

Responsabilidades:
- Cálculo de hash SHA-256 do arquivo original (Nível 1).
- Detecção de formato (PDF, imagem PNG/JPG, texto TXT).
- Análise de páginas: dimensões, orientação, contagem de palavras/caracteres.
- Classificação do tipo de documento: digital nativo, escaneado, híbrido.
- Sugestão heurística do papel documental: PROVA, GABARITO_PRELIMINAR, GABARITO_DEFINITIVO, etc.
"""
from __future__ import annotations

import hashlib
import os
import re
from typing import Any, Dict, List

import pymupdf


def compute_sha256(file_path: str) -> str:
    """Calcula o hash SHA-256 de um arquivo em blocos de 1MB."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def detect_document_role(filename: str, sample_text: str = "") -> str:
    """Sugere o papel do documento a partir do nome e amostra textual."""
    name_upper = filename.upper()
    text_upper = sample_text.upper()

    if "GAB_DEF" in name_upper or "DEFINITIVO" in name_upper or "APOS RECURSO" in text_upper:
        return "GABARITO_DEFINITIVO"
    if "GAB" in name_upper or "GABARITO" in name_upper or "GABARITO PRELIMINAR" in text_upper:
        return "GABARITO_PRELIMINAR"
    if "RETIF" in name_upper or "RETIFICACAO" in text_upper or "RETIFICAÇÃO" in text_upper:
        return "RETIFICACAO"
    if "EDITAL" in name_upper or "CONTEUDO PROGRAMATICO" in text_upper or "CONTEÚDO PROGRAMÁTICO" in text_upper or "DISPOSIÇÕES PRELIMINARES" in text_upper:
        return "EDITAL"
    if "PROVA" in name_upper or "CADERNO" in name_upper or "QUESTAO" in text_upper or "QUESTÃO" in text_upper:
        return "PROVA"
    if "MATERIAL" in name_upper or "APOSTILA" in name_upper:
        return "MATERIAL"
    return "FONTE_NAO_IDENTIFICADA"


def inspect_document(file_path: str) -> Dict[str, Any]:
    """Inspeciona exaustivamente o documento e retorna diagnóstico estruturado."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")

    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    sha256 = compute_sha256(file_path)
    ext = os.path.splitext(filename)[1].lower()

    if ext not in [".pdf", ".png", ".jpg", ".jpeg", ".txt"]:
        return {
            "filename": filename,
            "sha256": sha256,
            "size_bytes": file_size,
            "format": ext.replace(".", "").upper(),
            "status": "UNSUPPORTED_FORMAT",
            "error": f"Formato não suportado: {ext}",
            "pages": [],
        }

    if ext in [".png", ".jpg", ".jpeg"]:
        return {
            "filename": filename,
            "sha256": sha256,
            "size_bytes": file_size,
            "format": "IMAGE",
            "doc_type": "IMAGEM_ESTATICA",
            "suggested_role": detect_document_role(filename),
            "page_count": 1,
            "has_text_layer": False,
            "strategy": "OCR_VISUAL",
            "pages": [{"page_number": 1, "is_raster": True, "word_count": 0}],
        }

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {
            "filename": filename,
            "sha256": sha256,
            "size_bytes": file_size,
            "format": "TXT",
            "doc_type": "TEXTO_PURO",
            "suggested_role": detect_document_role(filename, content[:2000]),
            "page_count": 1,
            "has_text_layer": True,
            "strategy": "NATIVE_TEXT",
            "pages": [{"page_number": 1, "char_count": len(content)}],
        }

    # PDF Inspection com PyMuPDF
    doc = pymupdf.open(file_path)
    try:
        page_count = len(doc)
        pages_summary = []
        total_words = 0
        all_text_sample = []

        for p_idx in range(page_count):
            page = doc[p_idx]
            rect = page.rect
            words = page.get_text("words")
            word_count = len(words)
            total_words += word_count
            
            # Detecta presença de imagens rasterizadas na página
            image_list = page.get_images()
            has_images = len(image_list) > 0

            # Orientação
            is_portrait = rect.height >= rect.width

            # Coleta texto para heurística
            p_text = page.get_text()[:400]
            if p_idx < 3:
                all_text_sample.append(p_text)

            pages_summary.append({
                "page_number": p_idx + 1,
                "width": round(rect.width, 2),
                "height": round(rect.height, 2),
                "is_portrait": is_portrait,
                "word_count": word_count,
                "has_raster_images": has_images,
                "text_layer": "DIGITAL" if word_count > 40 else ("SPARSE" if word_count > 0 else "NONE"),
            })

        sample_str = " ".join(all_text_sample)
        suggested_role = detect_document_role(filename, sample_str)

        digital_pages = sum(1 for p in pages_summary if p["text_layer"] == "DIGITAL")
        if digital_pages == page_count:
            doc_type = "PDF_DIGITAL"
            strategy = "CAMINHO_A_NATIVO"
        elif digital_pages == 0:
            doc_type = "PDF_ESCANEADO"
            strategy = "CAMINHO_C_OCR"
        else:
            doc_type = "PDF_HIBRIDO"
            strategy = "CAMINHO_B_HIBRIDO"

        return {
            "filename": filename,
            "sha256": sha256,
            "size_bytes": file_size,
            "format": "PDF",
            "doc_type": doc_type,
            "suggested_role": suggested_role,
            "page_count": page_count,
            "total_words": total_words,
            "has_text_layer": digital_pages > 0,
            "strategy": strategy,
            "pages": pages_summary,
        }
    finally:
        doc.close()
