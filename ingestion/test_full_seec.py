import re
import pymupdf

def test_full_seec():
    pdf_path = r"c:\Users\washi\Downloads\provas\Auditor_Fiscal_2019+\2020 - CEBRASPE - SEEC_DF - Auditor Fiscal.pdf"
    doc = pymupdf.open(pdf_path)

    # 1. Filter out cover and trailing gabarito pages
    valid_pages = []
    for idx, page in enumerate(doc):
        t = page.get_text()
        norm = t.upper()
        # Page 1 cover check
        if idx == 0 and ("LEIA COM ATENÇÃO AS INSTRUÇÕES" in norm or "AO RECEBER ESTE CADERNO" in norm):
            continue
        # Gabarito sheets at end
        if "FOLHA DE RESPOSTAS" in norm and re.search(r"\b1\s*\n\s*2\s*\n\s*3\b", t):
            break
        if "FOLHA DE RASCUNHO" in norm and len(t.strip().splitlines()) < 8:
            continue
        valid_pages.append((idx + 1, t))

    print(f"Valid exam pages: {len(valid_pages)}")

    # Combine text with page markers
    full_text = "\n".join(t for _, t in valid_pages)

    # 2. Extract base texts
    support_text_pat = re.compile(
        r"(Texto\s+[A-Z0-9_\-]+[^\n]*\n)(.*?)(?=(?:Considerando|Com rela[çc][ãa]o|No que se refere|Acerca|Quanto [aà]|Julgue).*?(?:[\.:]|\bjulgue\b))",
        re.DOTALL | re.IGNORECASE
    )

    support_mats = []
    def isolate_texts(text: str):
        offset = 0
        cleaned_text = text
        for m in support_text_pat.finditer(text):
            title = m.group(1).strip()
            raw_body = m.group(2).strip()
            # Clean margin numbers
            body_lines = []
            for l in raw_body.splitlines():
                if re.match(r"^\s*\d{1,2}\s*$", l):
                    continue
                l = re.sub(r"^\s*\d{1,2}\s{2,}", "", l)
                body_lines.append(l)
            clean_body = "\n".join(body_lines).strip()
            support_mats.append({"title": title, "body": clean_body, "span": (m.start(), m.end())})
            # Replace in cleaned_text
            cleaned_text = cleaned_text.replace(m.group(0), f"\n[TEXTO_BASE: {title}]\n", 1)
        return cleaned_text

    cleaned_full_text = isolate_texts(full_text)
    print(f"Extracted {len(support_mats)} base texts.")

    # 3. Cebraspe item regex matching: (newline) (digits) (newline or space) (Letter, upper or lower)
    item_header_pattern = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*(?:\n|\s+(?=[A-Za-zÀ-ÿ]))")
    matches = list(item_header_pattern.finditer(cleaned_full_text))
    print(f"Total item header matches: {len(matches)}")

    items = []
    # Patterns for stem/discipline/command detection
    cmd_pattern = re.compile(
        r'(?:'
        r'(?:(?:Com rela[çc][ãa]o|A respeito|Acerca|No que se refere|No que tange|No que concerne|'
        r'Considerando|Tendo em vista|Em rela[çc][ãa]o|Quanto [aà]|A partir d[oe]|Com base n[oe]|'
        r'Em cada um dos itens|Em refer[eê]ncia|Relativamente [aà]|De acordo com|Ciente de que)[^\.]*?'
        r'(?:julgue|deve|julgue os itens)[^\.:]*?[\.:])'
        r'|'
        r'(?:Julgue\s+[^\.:]*?[\.:])'
        r')',
        re.IGNORECASE | re.DOTALL
    )

    current_cmd = ""
    for idx, m in enumerate(matches):
        num = int(m.group(1))
        start_pos = m.end()
        end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(cleaned_full_text)
        chunk = cleaned_full_text[start_pos:end_pos].strip()

        # Check for justification
        just_match = re.search(r"\n\s*(JUSTIFICATIVA\s*:\s*(?:CERTO|ERRADO)[\.:]?\s*.*)", chunk, re.DOTALL | re.IGNORECASE)
        statement = chunk
        justification = ""
        correct_opt = None
        trailing_text = ""

        if just_match:
            statement = chunk[:just_match.start()].strip()
            raw_just = just_match.group(1).strip()
            # Determine correct_opt from justification
            opt_match = re.search(r"JUSTIFICATIVA\s*:\s*(CERTO|ERRADO)", raw_just, re.IGNORECASE)
            if opt_match:
                correct_opt = "C" if opt_match.group(1).upper() == "CERTO" else "E"

            # Check if there is a trailing stem or command in raw_just
            lines = raw_just.splitlines()
            clean_just_lines = []
            trailing_lines = []
            found_cmd = False
            for line in lines:
                l_str = line.strip()
                # Check for command or discipline heading
                if (
                    cmd_pattern.search(l_str)
                    or any(h in l_str.upper() for h in ["CONTABILIDADE", "DIREITO", "AUDITORIA", "ADMINISTRAÇÃO", "CONHECIMENTOS"])
                ):
                    found_cmd = True
                if found_cmd:
                    trailing_lines.append(line)
                else:
                    clean_just_lines.append(line)

            justification = "\n".join(clean_just_lines).strip()
            trailing_text = "\n".join(trailing_lines).strip()

        # Update current command if trailing_text contains one
        if trailing_text:
            cmd_m = cmd_pattern.search(trailing_text)
            if cmd_m:
                current_cmd = cmd_m.group(0).strip()
        elif not current_cmd:
            # Check text before item 1
            if num == 1:
                pre_text = cleaned_full_text[:m.start()]
                cmd_m = cmd_pattern.search(pre_text)
                if cmd_m:
                    current_cmd = cmd_m.group(0).strip()

        # Prepend stem/command if present and not already in statement
        final_statement = statement
        if current_cmd and not statement.startswith(current_cmd[:20]):
            final_statement = f"{current_cmd}\n\n{statement}"

        items.append({
            "num": num,
            "statement": final_statement,
            "justification": justification,
            "correct_option": correct_opt,
        })

    # Summary
    print(f"Processed {len(items)} items.")
    nums = [it["num"] for it in items]
    print(f"Min num: {min(nums)}, Max num: {max(nums)}")
    missing = [x for x in range(1, 161) if x not in nums]
    print(f"Missing nums between 1 and 160: {missing}")

    # Inspect specific items
    for it in items:
        if it["num"] in [1, 2, 6, 16, 17, 18, 159, 160]:
            print(f"\n--- Item {it['num']} ---")
            print(f"Statement: {repr(it['statement'][:100])}...")
            print(f"Justification: {repr(it['justification'][:80])}...")
            print(f"Correct: {it['correct_option']}")

test_full_seec()
