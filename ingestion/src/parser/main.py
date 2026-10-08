import os
import json
import hashlib
from .pymupdf_extractor import PyMuPDFExtractor

def main():
    pdf_path = os.path.join(os.path.dirname(__file__), "../../../tests/golden-set/docs/ibgp-2023-prefeitura-de-araguari-mg-tecnico-fiscal-da-receita-municipal-prova.pdf")
    output_dir = os.path.join(os.path.dirname(__file__), "../../output")
    output_path = os.path.join(output_dir, "import_payload.json")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate mock hash
    file_hash = "mock_hash_ibgp_tecnico_2023"
    try:
        with open(pdf_path, "rb") as f:
            file_hash = hashlib.md5(f.read()).hexdigest()
    except Exception:
        pass

    metadata = {
        "banca": "IBGP",
        "cargo": "Técnico Fiscal da Receita Municipal",
        "ano": 2023,
        "hash": file_hash
    }
    
    extractor = PyMuPDFExtractor()
    payload = extractor.extract(pdf_path, metadata)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        
    print(f"Extracted {len(payload['data']['questions'])} questions.")
    print(f"Payload saved to {output_path}")

if __name__ == "__main__":
    main()
