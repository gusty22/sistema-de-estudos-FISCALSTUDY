import fitz
import json

doc_path = "tests/golden-set/docs/ibgp-2023-prefeitura-de-araguari-mg-tecnico-fiscal-da-receita-municipal-prova.pdf"
doc = fitz.open(doc_path)

blocks_out = []
# Let's inspect pages 2 to 8 (index 1 to 7) assuming page 1 is cover
for page_num in range(1, 8):
    page = doc[page_num]
    blocks = page.get_text("blocks")
    for b in blocks:
        # block structure: (x0, y0, x1, y1, "text", block_no, block_type)
        if b[6] == 0:  # text block
            text = b[4].strip()
            if text:
                blocks_out.append({
                    "page": page_num + 1,
                    "bbox": [round(c, 2) for c in b[:4]],
                    "text": text
                })

with open("ingestion/inspection_tecnico.json", "w", encoding="utf-8") as f:
    json.dump(blocks_out, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(blocks_out)} blocks to ingestion/inspection_tecnico.json")
