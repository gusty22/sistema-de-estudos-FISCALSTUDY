import fitz  # PyMuPDF
import sys
import json

def inspect(pdf_path):
    doc = fitz.open(pdf_path)
    output = {
        "total_pages": len(doc),
        "pages": []
    }
    
    # Check just first 5 pages for structure
    for page_num in range(min(5, len(doc))):
        page = doc[page_num]
        
        # Get blocks
        blocks = page.get_text("blocks")
        
        page_info = {
            "page_num": page_num + 1,
            "rect": [page.rect.x0, page.rect.y0, page.rect.x1, page.rect.y1],
            "blocks": []
        }
        
        for b in blocks:
            x0, y0, x1, y1, text, block_no, block_type = b
            if block_type == 0:  # text
                page_info["blocks"].append({
                    "text": text.strip(),
                    "bbox": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]
                })
            else:
                page_info["blocks"].append({
                    "type": "image",
                    "bbox": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]
                })
                
        output["pages"].append(page_info)
        
    print(json.dumps(output, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    inspect(sys.argv[1])
