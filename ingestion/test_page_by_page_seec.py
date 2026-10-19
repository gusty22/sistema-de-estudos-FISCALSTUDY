import re
import pymupdf

def test_page_by_page_seec():
    pdf_path = r"c:\Users\washi\Downloads\provas\Auditor_Fiscal_2019+\2020 - CEBRASPE - SEEC_DF - Auditor Fiscal.pdf"
    doc = pymupdf.open(pdf_path)

    # Process pages 2 to 18 (index 1 to 17)
    items = []
    support_mats = []
    current_cmd = ""

    item_regex = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*(?:\n|\s+(?=[A-Za-zÀ-ÿ]))")
    just_regex = re.compile(r"\n\s*(JUSTIFICATIVA\s*:\s*(?:CERTO|ERRADO)[\.:]?\s*.*)", re.DOTALL | re.IGNORECASE)
    
    cmd_pattern = re.compile(
        r'(?:'
        r'(?:(?:Com rela[çc][ãa]o|A respeito|Acerca|No que se refere|No que tange|No que concerne|'
        r'Considerando|Tendo em vista|Em rela[çc][ãa]o|Quanto [aà]|A partir d[oe]|Com base n[oe]|'
        r'Em cada um dos itens|Em refer[eê]ncia|Relativamente [aà]|De acordo com|Ciente de que)[^\.]*?'
        r'(?:julgue[^\.:]*?[\.:]|deve:?))'
        r'|'
        r'(?:Julgue\s+[^\.:]*?[\.:])'
        r')',
        re.IGNORECASE | re.DOTALL
    )

    # Base text pattern bounded per page, matching until command
    base_text_pattern = re.compile(
        r"(Texto\s+[A-Z0-9_\-]+[^\n]*\n)(.*?)(?=(?:Considerando|Com rela[çc][ãa]o|No que se refere|Acerca|Quanto [aà]|Julgue)\s+[^\.:]*?[\.:])",
        re.DOTALL | re.IGNORECASE
    )

    for p_idx in range(1, 18): # pages 2 to 18
        p_num = p_idx + 1
        page_text = doc[p_idx].get_text()

        # Check if page has base text
        m_bt = base_text_pattern.search(page_text)
        if m_bt:
            title = m_bt.group(1).strip()
            raw_bt = m_bt.group(2).strip()
            # Clean margin numbers
            bt_lines = []
            for l in raw_bt.splitlines():
                if re.match(r"^\s*\d{1,2}\s*$", l):
                    continue
                l = re.sub(r"^\s*\d{1,2}\s{2,}", "", l)
                bt_lines.append(l)
            clean_bt = "\n".join(bt_lines).strip()
            support_mats.append({
                "title": title,
                "body": clean_bt,
                "page": p_num
            })
            # Remove base text from page
            page_text = page_text[:m_bt.start()] + "\n" + page_text[m_bt.end():]

        # Find items on this page
        matches = list(item_regex.finditer(page_text))
        for idx, m in enumerate(matches):
            num = int(m.group(1))
            start_pos = m.end()
            end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(page_text)
            chunk = page_text[start_pos:end_pos].strip()

            if len(chunk) < 10:
                continue

            # Check if this match is just a stray number or instruction
            if "Ao receber este caderno" in chunk:
                continue

            # Extract justification
            j_match = just_regex.search(chunk)
            statement = chunk
            justification = ""
            correct_opt = None
            trailing = ""

            if j_match:
                statement = chunk[:j_match.start()].strip()
                raw_just = j_match.group(1).strip()
                opt_m = re.search(r"JUSTIFICATIVA\s*:\s*(CERTO|ERRADO)", raw_just, re.IGNORECASE)
                if opt_m:
                    correct_opt = "C" if opt_m.group(1).upper() == "CERTO" else "E"

                # Check if there is trailing command
                lines = raw_just.splitlines()
                clean_j = []
                trail_lines = []
                in_trail = False
                for l in lines:
                    ls = l.strip()
                    if cmd_pattern.search(ls) or any(h in ls.upper() for h in ["CONTABILIDADE", "DIREITO", "AUDITORIA", "ADMINISTRAÇÃO", "CONHECIMENTOS"]):
                        in_trail = True
                    if in_trail:
                        trail_lines.append(l)
                    else:
                        clean_j.append(l)
                justification = "\n".join(clean_j).strip()
                trailing = "\n".join(trail_lines).strip()

            # Check if text before first item of page has command
            if idx == 0:
                pre_page = page_text[:m.start()]
                pre_cmd = cmd_pattern.search(pre_page)
                if pre_cmd:
                    current_cmd = pre_cmd.group(0).strip()

            final_statement = statement
            if current_cmd and not statement.startswith(current_cmd[:20]):
                final_statement = f"{current_cmd}\n\n{statement}"

            if trailing:
                cmd_m = cmd_pattern.search(trailing)
                if cmd_m:
                    current_cmd = cmd_m.group(0).strip()

            items.append({
                "num": num,
                "statement": final_statement,
                "justification": justification,
                "correct_option": correct_opt,
                "page": p_num
            })

    print(f"Extracted {len(items)} items from pages 2 to 18.")
    # Deduplicate by question number
    seen = {}
    for it in items:
        n = it["num"]
        if 1 <= n <= 160:
            if n not in seen or len(it["statement"]) > len(seen[n]["statement"]):
                seen[n] = it

    unique_items = sorted(seen.values(), key=lambda x: x["num"])
    print(f"Unique valid items (1..160): {len(unique_items)}")
    missing = [x for x in range(1, 161) if x not in seen]
    print(f"Missing items: {missing}")

    for it in unique_items:
        if it["num"] in [1, 6, 16, 17, 18, 159, 160]:
            print(f"\n================ ITEM {it['num']} ================")
            print(f"Enunciado:\n{it['statement']}")
            print(f"Justificativa:\n{it['justification']}")
            print(f"Gabarito: {it['correct_option']}")

test_page_by_page_seec()

