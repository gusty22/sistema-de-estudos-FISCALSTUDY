"""Renderizador de evidências visuais de páginas e regiões de documentos para revisão lado a lado.

Gera PNGs leves e nítidos das páginas da prova para que o usuário
possa inspecionar visualmente a fonte documental original diretamente
ao lado da questão extraída.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional

import pymupdf


def render_document_evidence_pages(
    pdf_path: str,
    output_dir: str,
    pages_to_render: Optional[List[int]] = None,
    dpi: int = 140,
) -> Dict[int, str]:
    """Renderiza páginas selecionadas (1-indexed) de um PDF como imagens PNG.
    
    Retorna dicionário mapeando número da página ao caminho relativo do arquivo PNG gerado.
    """
    os.makedirs(output_dir, exist_ok=True)
    rendered_map: Dict[int, str] = {}

    doc = pymupdf.open(pdf_path)
    try:
        total = len(doc)
        target_pages = pages_to_render if pages_to_render is not None else list(range(1, total + 1))

        for p_num in target_pages:
            if not (1 <= p_num <= total):
                continue

            page = doc[p_num - 1]
            pix = page.get_pixmap(dpi=dpi)
            out_filename = f"page_{p_num}.png"
            out_path = os.path.join(output_dir, out_filename)
            pix.save(out_path)
            rendered_map[p_num] = out_filename
    finally:
        doc.close()

    return rendered_map
