import re
import pymupdf

def test_isolated_text():
    pdf_path = r"c:\Users\washi\Downloads\provas\Auditor_Fiscal_2019+\2020 - CEBRASPE - SEEC_DF - Auditor Fiscal.pdf"
    doc = pymupdf.open(pdf_path)

    text_p2 = doc[1].get_text()

    # Pattern for Cebraspe base text:
    support_text_pat = re.compile(
        r"(Texto\s+[A-Z0-9_\-]+[^\n]*\n)(.*?)(?=(?:Considerando|Com rela[çc][ãa]o|No que se refere|Acerca|Quanto [aà]|Julgue).*?(?:[\.:]|\bjulgue\b))",
        re.DOTALL | re.IGNORECASE
    )

    m = support_text_pat.search(text_p2)
    if m:
        text_title = m.group(1).strip()
        text_body = m.group(2).strip()
        print(f"Extracted support text: {text_title}")
        print(f"Body length: {len(text_body)}")

        # Clean margin line numbers from support text
        cleaned_body_lines = []
        for line in text_body.splitlines():
            if re.match(r"^\s*\d{1,2}\s*$", line):
                continue
            line = re.sub(r"^\s*\d{1,2}\s{2,}", "", line)
            cleaned_body_lines.append(line)
        cleaned_body = "\n".join(cleaned_body_lines).strip()
        print(f"Cleaned body length: {len(cleaned_body)}")

        # Replace support text with placeholder in page text
        text_p2_clean = text_p2[:m.start()] + "\n[TEXTO_BASE_ISOLADO]\n" + text_p2[m.end():]
        
        # Now run item pattern
        item_header_pattern = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*(?:\n|\s+(?=[A-Za-zÀ-ÿ]))")
        matches = list(item_header_pattern.finditer(text_p2_clean))
        print(f"\nMatches after isolation: {len(matches)}")
        for match in matches:
            num = int(match.group(1))
            preview = text_p2_clean[match.end():match.end()+60].replace('\n', ' ')
            print(f"  Match {num}: {preview}")

test_isolated_text()
