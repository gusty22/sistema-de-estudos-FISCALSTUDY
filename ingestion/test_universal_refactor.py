import re
import uuid
import pymupdf
from typing import Dict, Any, List, Optional, Tuple

DISCIPLINES_CANONICAL = {
    "PORTUGUES": "Língua Portuguesa",
    "PORTUGUESA": "Língua Portuguesa",
    "DIREITO CONSTITUCIONAL": "Direito Constitucional",
    "DIREITO ADMINISTRATIVO": "Direito Administrativo",
    "DIREITO TRIBUTARIO": "Direito Tributário",
    "CONTABILIDADE GERAL": "Contabilidade Geral",
    "CONTABILIDADE PUBLICA": "Contabilidade Pública",
    "AUDITORIA": "Auditoria",
    "LEGISLACAO TRIBUTARIA": "Legislação Tributária",
    "ADMINISTRACAO PUBLICA": "Administração Pública",
    "TECNOLOGIA DA INFORMACAO": "Tecnologia da Informação",
    "RACIOCINIO LOGICO": "Raciocínio Lógico e Matemática",
}

def normalize_ascii_upper(s: str) -> str:
    import unicodedata
    n = unicodedata.normalize("NFKD", s)
    return "".join(c for c in n if not unicodedata.combining(c)).upper().strip()

def clean_page_artifacts(t: str) -> str:
    t = re.sub(r"pcimarkpci[^\n]*\n*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"www\.pciconcursos\.com\.br[^\n]*\n*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\|\|IdentificaPDF\|\|[^\n]*\n*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"/R\*Cargo:[^\*]+\*R/", "", t)
    t = re.sub(r"/C\*Caderno[^\*]+\*C/", "", t)
    t = re.sub(r"–\s*\d+\s*–", "", t)
    t = re.sub(r"\b\d{1,2}\s*\|\s*\d{1,2}\b", "", t)
    return t.strip()

def is_administrative_cover(p_text: str) -> bool:
    norm = p_text.upper()
    has_instruction = (
        "LEIA COM ATENÇÃO AS INSTRUÇÕES" in norm
        or "AO RECEBER ESTE CADERNO" in norm
        or "INSTRUÇÕES GERAIS" in norm
        or "INFORMAÇÕES ADICIONAIS: 0(XX)" in norm
        or "TÓPICO 1: LEIA COM ATENÇÃO" in norm
    )
    has_real_sections = any(
        s in norm for s in [
            "CONHECIMENTOS GERAIS", "CONHECIMENTOS BÁSICOS",
            "CONHECIMENTOS ESPECÍFICOS", "LÍNGUA PORTUGUESA",
            "DISCIPLINA:", "-- PROVAS OBJETIVAS --", "QUESTÃO 01", "QUESTÃO 1"
        ]
    )
    return has_instruction and not has_real_sections

def is_instruction_item(text: str) -> bool:
    t_clean = text.strip().lower()
    instruction_starters = [
        "ao receber este caderno", "durante a realização da prova", "na duração das provas",
        "ao terminar as provas", "nenhuma folha deste caderno", "a desobediência a qualquer",
        "confira inicialmente se os", "não serão aceitas reclamações", "o tempo destinado à",
        "folha\nnenhuma folha deste", "caso o caderno esteja incompleto"
    ]
    for starter in instruction_starters:
        if starter in t_clean[:120]:
            return True
    return False

def extract_inline_justification(text: str) -> Tuple[str, Optional[str], Optional[str]]:
    just_pat = re.compile(
        r"\n\s*(?:JUSTIFICATIVA|COMENT[AÁ]RIO|GABARITO\s+COMENTADO)\s*:\s*(.*)",
        re.DOTALL | re.IGNORECASE
    )
    m = just_pat.search(text)
    if not m:
        return text.strip(), None, None

    statement = text[:m.start()].strip()
    raw_just = m.group(1).strip()
    
    corr_opt = None
    opt_m = re.search(r"^(?:GABARITO\s*:\s*)?(CERTO|ERRADO|[A-E])\b", raw_just, re.IGNORECASE)
    if opt_m:
        val = opt_m.group(1).upper()
        if val == "CERTO":
            corr_opt = "C"
        elif val == "ERRADO":
            corr_opt = "E"
        else:
            corr_opt = val

    return statement, f"JUSTIFICATIVA: {raw_just}", corr_opt

def extract_questions_refactored(doc_pdf: pymupdf.Document, p_start: int, p_end: int, metadata: Dict[str, Any] = None):
    metadata = metadata or {}
    pages_text: List[Tuple[int, str]] = []
    for p_idx in range(max(0, p_start - 1), min(len(doc_pdf), p_end)):
        p_text = doc_pdf[p_idx].get_text()
        if p_idx == max(0, p_start - 1) and is_administrative_cover(p_text):
            continue
        if "FOLHA DE RASCUNHO" in p_text.upper() and len(p_text.strip().splitlines()) < 8:
            continue
        pages_text.append((p_idx + 1, p_text))

    full_text = "\n".join(t for _, t in pages_text)
    
    # Strategy
    strategy = "IBGP"
    if "CEBRASPE" in metadata.get("banca", "").upper() or "CESPE" in full_text.upper():
        strategy = "CEBRASPE"
    elif "FGV" in metadata.get("banca", "").upper():
        strategy = "FGV"

    current_disc = "Geral"
    page_disciplines: Dict[int, str] = {}
    for p_num, p_txt in pages_text:
        for line in p_txt.splitlines()[:10]:
            norm_line = normalize_ascii_upper(line)
            for disc_key, disc_name in DISCIPLINES_CANONICAL.items():
                if disc_key == norm_line or f"-- {disc_key}" in norm_line or f"DISCIPLINA: {disc_key}" in norm_line:
                    current_disc = disc_name
                    break
        page_disciplines[p_num] = current_disc

    raw_questions: List[Dict[str, Any]] = []
    support_materials: List[Dict[str, Any]] = []

    opt_pattern = re.compile(
        r"(?:^|\n)\s*(?:\(?([A-Ea-e])\)|\b([A-Ea-e])\s*[\.\-–]\s*)\s*(.*?)(?=(?:\n\s*(?:\(?[A-Ea-e]\)|\b[A-Ea-e]\s*[\.\-–]\s*)|$))",
        re.DOTALL,
    )

    if strategy == "CEBRASPE":
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
        base_text_pattern = re.compile(
            r"(Texto\s+[A-Z0-9_\-]+[^\n]*\n)(.*?)(?=(?:Considerando|Com rela[çc][ãa]o|No que se refere|Acerca|Quanto [aà]|Julgue)\s+[^\.:]*?[\.:])",
            re.DOTALL | re.IGNORECASE
        )
        item_regex = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*(?:\n|\s+(?=[A-Za-zÀ-ÿ]))")

        current_cmd = ""
        current_support_material = None
        items_found = []

        for p_num, p_raw in pages_text:
            page_text = p_raw
            
            # 1. Verifica se a página possui texto base no formato "Texto [A-Z0-9_-]+"
            m_bt = base_text_pattern.search(page_text)
            if m_bt:
                title = m_bt.group(1).strip()
                raw_bt = m_bt.group(2).strip()
                bt_lines = []
                for l in raw_bt.splitlines():
                    if re.match(r"^\s*\d{1,2}\s*$", l):
                        continue
                    l = re.sub(r"^\s*\d{1,2}\s{2,}", "", l)
                    bt_lines.append(l)
                clean_bt = clean_page_artifacts("\n".join(bt_lines)).strip()
                sm_obj = {
                    "id": str(uuid.uuid4()),
                    "tipo": "TEXTO_BASE",
                    "titulo": title,
                    "conteudo_texto": clean_bt,
                    "pagina_inicio": p_num,
                    "pagina_fim": p_num,
                    "applies_to_questions": [],
                }
                support_materials.append(sm_obj)
                current_support_material = sm_obj
                page_text = page_text[:m_bt.start()] + "\n" + page_text[m_bt.end():]
            elif p_num == pages_text[0][0]:
                # 2. Se for a primeira página e não teve "Texto ...", verifica preâmbulo sob -- CONHECIMENTOS BÁSICOS -- (ex: Mossoró)
                first_m = item_regex.search(page_text)
                if first_m:
                    pre_text = page_text[:first_m.start()]
                    split_markers = [
                        "-- CONHECIMENTOS BÁSICOS --", "-- CONHECIMENTOS GERAIS --",
                        "-- CONHECIMENTOS ESPECÍFICOS --", "-- PROVAS OBJETIVAS --",
                        "CONHECIMENTOS BÁSICOS", "CONHECIMENTOS GERAIS",
                    ]
                    upper_pre = normalize_ascii_upper(pre_text)
                    best_split = -1
                    for marker in split_markers:
                        pos = upper_pre.rfind(normalize_ascii_upper(marker))
                        if pos != -1:
                            best_split = max(best_split, pos + len(marker))
                    raw_cand = pre_text[best_split:].strip() if best_split != -1 else pre_text.strip()
                    cmd_cand = cmd_pattern.search(raw_cand)
                    body_cand = raw_cand[:cmd_cand.start()].strip() if cmd_cand else raw_cand.strip()
                    clean_cand = clean_page_artifacts(body_cand)
                    if len(clean_cand) >= 150:
                        lines = [l.strip() for l in clean_cand.splitlines() if l.strip()]
                        t_title = lines[0] if (lines and (lines[0].startswith("Texto") or len(lines[0]) < 60)) else "Texto de Apoio Inicial"
                        sm_pre = {
                            "id": str(uuid.uuid4()),
                            "tipo": "TEXTO_BASE",
                            "titulo": t_title,
                            "conteudo_texto": clean_cand,
                            "pagina_inicio": p_num,
                            "pagina_fim": p_num,
                            "applies_to_questions": list(range(1, 11)),
                        }
                        support_materials.append(sm_pre)
                        current_support_material = sm_pre

            matches = list(item_regex.finditer(page_text))
            for idx, m in enumerate(matches):
                num = int(m.group(1))
                start_pos = m.end()
                end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(page_text)
                chunk = page_text[start_pos:end_pos].strip()

                if len(chunk) < 12 or is_instruction_item(chunk):
                    continue

                if idx == 0:
                    pre_chunk = page_text[:m.start()]
                    pre_cmd_m = cmd_pattern.search(pre_chunk)
                    if pre_cmd_m:
                        current_cmd = pre_cmd_m.group(0).strip()

                stmt, just, corr = extract_inline_justification(chunk)

                trailing = ""
                if just:
                    lines = just.splitlines()
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
                    just = "\n".join(clean_j).strip()
                    trailing = "\n".join(trail_lines).strip()

                clean_stmt = clean_page_artifacts(stmt)
                if current_cmd and not clean_stmt.startswith(current_cmd[:20]):
                    final_stmt = f"{current_cmd}\n\n{clean_stmt}"
                else:
                    final_stmt = clean_stmt

                if trailing:
                    cmd_m = cmd_pattern.search(trailing)
                    if cmd_m:
                        current_cmd = cmd_m.group(0).strip()
                    if any(h in trailing.upper() for h in ["CONTABILIDADE", "DIREITO", "AUDITORIA"]):
                        current_support_material = None

                texto_apoio = None
                texto_apoio_titulo = None
                if current_support_material:
                    texto_apoio = current_support_material["conteudo_texto"]
                    texto_apoio_titulo = current_support_material["titulo"]
                    if num not in current_support_material["applies_to_questions"]:
                        current_support_material["applies_to_questions"].append(num)

                items_found.append({
                    "numero_original": num,
                    "statement": final_stmt,
                    "options": ["C) CERTO", "E) ERRADO"],
                    "disciplina": page_disciplines.get(p_num, current_disc),
                    "pages": [p_num],
                    "justificativa": just,
                    "texto_apoio": texto_apoio,
                    "texto_apoio_titulo": texto_apoio_titulo,
                    "correct_option": corr,
                })

        raw_questions.extend(items_found)

    # Deduplicação
    seen = {}
    for q in raw_questions:
        num = q["numero_original"]
        if num not in seen or len(q["statement"]) > len(seen[num]["statement"]):
            seen[num] = q

    unique_questions = sorted(seen.values(), key=lambda x: x["numero_original"])
    
    # Vinculação final de suporte
    for q in unique_questions:
        if not q.get("texto_apoio"):
            num = q["numero_original"]
            for sm in support_materials:
                if num in sm.get("applies_to_questions", []):
                    q["texto_apoio"] = sm.get("conteudo_texto")
                    q["texto_apoio_titulo"] = sm.get("titulo")
                    break

    return unique_questions, support_materials

# Test on SEEC_DF and Mossoro
doc_seec = pymupdf.open(r"c:\Users\washi\Downloads\provas\Auditor_Fiscal_2019+\2020 - CEBRASPE - SEEC_DF - Auditor Fiscal.pdf")
qs_seec, sm_seec = extract_questions_refactored(doc_seec, 1, 19, {"banca": "CEBRASPE"})
print(f"SEEC_DF: {len(qs_seec)} questions, {len(sm_seec)} support materials")
missing_seec = [x for x in range(1, 161) if x not in [q["numero_original"] for q in qs_seec]]
print(f"SEEC_DF Missing (1..160): {missing_seec}")
print("Q1 statement:", repr(qs_seec[0]["statement"][:60]))
print("Q1 justification:", repr((qs_seec[0].get("justificativa") or "")[:60]))
print("Q1 texto_apoio:", bool(qs_seec[0]["texto_apoio"]))
print("Q16 statement:", repr(qs_seec[15]["statement"][:60]))
print("Q17 statement:", repr(qs_seec[16]["statement"][:60]))
print("Q18 statement:", repr(qs_seec[17]["statement"][:60]))

import sqlite3, os
con = sqlite3.connect("db/staging.db")
rel = con.execute("SELECT rel_path FROM staging_files WHERE rel_path LIKE ?", ("%Mossor%Cont%",)).fetchone()[0]
full = os.path.join(r"c:\Users\washi\Downloads\provas", rel)
doc_mos = pymupdf.open(full)
qs_mos, sm_mos = extract_questions_refactored(doc_mos, 1, 7, {"banca": "CEBRASPE"})
print(f"\nMossoró: {len(qs_mos)} questions, {len(sm_mos)} support materials")
missing_mos = [x for x in range(1, 121) if x not in [q["numero_original"] for q in qs_mos]]
print(f"Mossoró Missing (1..120): {missing_mos}")
print("Mossoro Q1 texto_apoio:", bool(qs_mos[0]["texto_apoio"]))
