"""Renderiza paginas de um PDF digitalizado para OCR.

Uso:
    python ingestion/render_auditor_pages.py [pdf] [saida] [dpi]

O padrao e 300 DPI, que corresponde a resolucao nativa das digitalizacoes
do golden set (2480x3504 px por pagina A4). Renderizar abaixo disso descarta
informacao e degrada o OCR (causa raiz de alternativas perdidas na fixture
anterior, gerada a 150 DPI).
"""
import os
import sys

import pymupdf

DEFAULT_PDF = "tests/golden-set/docs/503_-_auditor_fiscal_da_receita_municipal.pdf"
DEFAULT_OUT = "ingestion/output/auditor_pages_300"
DEFAULT_DPI = 300


def render(pdf_path: str, output_dir: str, dpi: int) -> None:
    os.makedirs(output_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    print(f"Total pages: {len(doc)} (dpi={dpi})")
    for page_idx in range(len(doc)):
        pix = doc[page_idx].get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
        img_path = os.path.join(output_dir, f"page_{page_idx + 1}.png")
        pix.save(img_path)
        print(f"Rendered {img_path} ({pix.width}x{pix.height})")
    doc.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    render(
        args[0] if len(args) > 0 else DEFAULT_PDF,
        args[1] if len(args) > 1 else DEFAULT_OUT,
        int(args[2]) if len(args) > 2 else DEFAULT_DPI,
    )
