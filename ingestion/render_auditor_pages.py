import os
import pymupdf

pdf_path = "tests/golden-set/docs/503_-_auditor_fiscal_da_receita_municipal.pdf"
output_dir = "ingestion/output/auditor_pages"
os.makedirs(output_dir, exist_ok=True)

doc = pymupdf.open(pdf_path)
print(f"Total pages: {len(doc)}")

for page_idx in range(len(doc)):
    page = doc[page_idx]
    pix = page.get_pixmap(dpi=150)
    img_name = f"page_{page_idx + 1}.png"
    img_path = os.path.join(output_dir, img_name)
    pix.save(img_path)
    print(f"Rendered {img_name} ({pix.width}x{pix.height})")

doc.close()
