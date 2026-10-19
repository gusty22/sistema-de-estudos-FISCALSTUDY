import re
import pymupdf

def test_items_seec():
    pdf_path = r"c:\Users\washi\Downloads\provas\Auditor_Fiscal_2019+\2020 - CEBRASPE - SEEC_DF - Auditor Fiscal.pdf"
    doc = pymupdf.open(pdf_path)

    # Combine pages 2 to 5 (pages index 1 to 4)
    text = ""
    for p in range(1, 5):
        text += f"\n--- PAGE {p+1} ---\n" + doc[p].get_text()

    # Pre-extract reading texts like "Texto CG1A1-I"
    # Notice: In Cebraspe, a text usually starts with:
    # "Texto [A-Z0-9_\-]+" and ends before a command like "Considerando as informações..." or "Com relação..."
    # or an author attribution line like "Internet: <...>"
    
    text_pattern = re.compile(
        r"(Texto\s+[A-Z0-9_\-]+[^\n]*\n)(.*?)(?=(?:Assis Moreira|Internet:\s*<|Fonte:\s*|Considerando\s+|Com rela[çc][ãa]o\s+|No que se refere\s+|Acerca\s+|Quanto [aà]\s+))",
        re.DOTALL
    )

    support_mats = []
    def clean_margin_lines(body: str) -> str:
        # Margin numbers in Cebraspe are 1, 4, 7, 10... on their own line or at line start
        lines = []
        for line in body.splitlines():
            # if line is just a number between 1 and 100 (margin line counter)
            if re.match(r"^\s*\d{1,2}\s*$", line):
                continue
            # if line starts with a margin counter like "4   conforme estudo"
            line = re.sub(r"^\s*\d{1,2}\s{2,}", "", line)
            lines.append(line)
        return "\n".join(lines).strip()

    # Find support texts
    for m in text_pattern.finditer(text):
        title = m.group(1).strip()
        body = clean_margin_lines(m.group(2).strip())
        print(f"FOUND SUPPORT TEXT: {title} (len={len(body)})")
        support_mats.append({"title": title, "body": body})

    # Now let's test item matching on page 4 (which has 15, 16, 17, 18, 19, 20...)
    page4_text = doc[3].get_text()
    print("\n--- Testing Page 4 Items ---")

    # Item pattern that matches:
    # (newline) (digits) (newline or space) (Letter, upper or lower)
    # Notice: In Cebraspe, items can have justifications:
    # "JUSTIFICATIVA: (CERTO|ERRADO). ..."
    
    # Split items by item header
    item_header_pattern = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*\n\s*(?=[A-Za-zÀ-ÿ])")
    
    # Let's find all item positions
    matches = list(item_header_pattern.finditer(page4_text))
    print(f"Found {len(matches)} item numbers on Page 4:")
    for idx, m in enumerate(matches):
        num = int(m.group(1))
        start_pos = m.end()
        end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(page4_text)
        chunk = page4_text[start_pos:end_pos].strip()

        # Check for justification
        just_match = re.search(r"\n\s*(JUSTIFICATIVA\s*:\s*(?:CERTO|ERRADO)[\.:]?\s*.*)", chunk, re.DOTALL | re.IGNORECASE)
        stem = ""
        justification = ""
        statement = chunk
        if just_match:
            statement = chunk[:just_match.start()].strip()
            full_just = just_match.group(1).strip()
            # If after the justification there is a stem for the next question (before the next item),
            # e.g. "Ciente de que seus atos..."
            # Let's see: chunk ends at the next item number!
            # So if there is text after the justification period, it could be a command/stem!
            just_lines = full_just.splitlines()
            # Justification usually ends before lines that look like commands or discipline headers
            just_clean = []
            stem_lines = []
            in_stem = False
            for jline in just_lines:
                jstrip = jline.strip()
                if (
                    "Ciente de que" in jstrip or
                    "julgue os itens" in jstrip or
                    "CONTABILIDADE PÚBLICA" in jstrip or
                    "Relativamente à" in jstrip or
                    "Considerando que os sistemas" in jstrip
                ):
                    in_stem = True
                if in_stem:
                    stem_lines.append(jline)
                else:
                    just_clean.append(jline)
            justification = "\n".join(just_clean).strip()
            stem = "\n".join(stem_lines).strip()

        print(f"\nItem {num}:")
        print(f"  Statement: {repr(statement[:70])}...")
        print(f"  Justification: {repr(justification[:60])}...")
        if stem:
            print(f"  Trailing Stem/Header: {repr(stem[:60])}...")

test_items_seec()
