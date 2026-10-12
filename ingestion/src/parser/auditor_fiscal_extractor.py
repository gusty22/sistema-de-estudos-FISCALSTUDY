import json
import os
import re

GABARITO_AUDITOR_FISCAL = {
    1: "A", 2: "A", 3: "A", 4: "C", 5: "A", 6: "A", 7: "C", 8: "D", 9: "A", 10: None,
    11: "D", 12: None, 13: "B", 14: "C", 15: "B", 16: "C", 17: "B", 18: "B", 19: "B", 20: "D",
    21: "C", 22: None, 23: None, 24: "D", 25: "B", 26: "D", 27: "B", 28: "A", 29: "B", 30: "D",
    31: "D", 32: "C", 33: "C", 34: "D", 35: "B", 36: "B", 37: "A", 38: "A", 39: "D", 40: "B"
}

QUESTOES_ANULADAS = {10, 12, 22, 23}

def get_discipline(q_num: int) -> str:
    if 1 <= q_num <= 10:
        return "Língua Portuguesa"
    elif 11 <= q_num <= 15:
        return "Raciocínio Lógico"
    elif 16 <= q_num <= 20:
        return "Noções de Informática"
    elif 21 <= q_num <= 25:
        return "Conhecimentos Gerais"
    elif 26 <= q_num <= 30:
        return "Legislação Municipal"
    else:
        return "Conhecimentos Específicos"

def reconstruct_page_lines(words, mid_x=610, y_top=60, y_bottom=1620):
    filtered = [w for w in words if y_top <= w["y"] <= y_bottom]
    gutter_words = [w for w in filtered if 570 <= w["x"] <= 630]
    
    def words_to_lines(col_words):
        if not col_words:
            return []
        col_words.sort(key=lambda w: (w["y"], w["x"]))
        lines = []
        cur_line = [col_words[0]]
        for w in col_words[1:]:
            if abs(w["y"] - cur_line[-1]["y"]) <= 12:
                cur_line.append(w)
            else:
                cur_line.sort(key=lambda x: x["x"])
                lines.append(" ".join(x["t"] for x in cur_line))
                cur_line = [w]
        if cur_line:
            cur_line.sort(key=lambda x: x["x"])
            lines.append(" ".join(x["t"] for x in cur_line))
        return lines

    has_right_question = any(
        w["x"] > mid_x and re.search(r"^quest", w["t"], re.IGNORECASE)
        for w in filtered
    )
    if not has_right_question and len(gutter_words) > 10:
        return words_to_lines(filtered)

    col0 = [w for w in filtered if w["x"] < mid_x]
    col1 = [w for w in filtered if w["x"] >= mid_x]
    return words_to_lines(col0) + words_to_lines(col1)

def extract_auditor_fiscal_questions(words_json_path: str, metadata: dict) -> dict:
    with open(words_json_path, "r", encoding="utf-8-sig") as f:
        pages_data = json.load(f)
        
    question_pattern = re.compile(r"^QUEST[AÃ][O0]\s*(\d+)", re.IGNORECASE)
    # Exige obrigatoriamente fechamento de parêntese após a letra da opção (ex: A), B), C), D), VA), 'A))
    option_start_pattern = re.compile(r"^(?:[^\w\n]*|\S{1,2}\s*|\S{1,2})?([A-E])\)\s*(.*)", re.IGNORECASE)
    # Suporta opções inline na mesma linha (ex: 'A) 48. C) 216.' ou 'B) 154. dl)) 1.296.')
    inline_split_pattern = re.compile(r"\s+(?:[^\w\n]*|\S{1,2}\s*|\S{1,2})?([B-E])\)\s*", re.IGNORECASE)

    all_questions = []
    current_q = None
    current_opt = None
    
    for page in pages_data:
        p_num = page["Page"]
        lines = reconstruct_page_lines(page["Words"])
        
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
                
            clean_start = re.sub(r"^[\W_]+", "", line_str)
            q_match = question_pattern.match(clean_start)
            if q_match:
                if current_q:
                    all_questions.append(current_q)
                q_num = int(q_match.group(1))
                statement_tail = clean_start[q_match.end():].strip()
                current_q = {
                    "id": f"ibgp-2023-auditor-fiscal-q{q_num}",
                    "numero_original": q_num,
                    "statement": statement_tail,
                    "options": [],
                    "provenance": {
                        "banca": metadata.get("banca", "IBGP"),
                        "cargo": metadata.get("cargo", "Auditor Fiscal da Receita Municipal"),
                        "ano": metadata.get("ano", 2023),
                        "orgao": metadata.get("orgao", "Prefeitura Municipal de Araguari - MG"),
                        "edital": "01/2023",
                        "cargo_codigo": "503",
                        "hash": metadata.get("hash", ""),
                        "pages": [p_num]
                    }
                }
                current_opt = None
                continue
                
            # Verifica se há início de alternativa
            opt_match = option_start_pattern.match(line_str)
            if opt_match and current_q is not None:
                letter = opt_match.group(1).upper()
                rest = opt_match.group(2).strip()
                
                # Checa se há opção inline secundária (ex: C) na mesma linha)
                # Exemplo: 'A) 1,25. C) 1,65.'
                parts = inline_split_pattern.split(rest)
                if len(parts) > 1:
                    # parts[0] é o texto da primeira opção
                    first_text = parts[0].strip()
                    current_opt = f"{letter}) {first_text}"
                    current_q["options"].append(current_opt)
                    
                    # parts[1] é a segunda letra (ex: 'C) '), parts[2] é o texto
                    idx = 1
                    while idx < len(parts):
                        sub_letter = parts[idx].strip().replace(")", "").upper()
                        sub_text = parts[idx+1].strip() if idx + 1 < len(parts) else ""
                        current_q["options"].append(f"{sub_letter}) {sub_text}")
                        idx += 2
                    current_opt = current_q["options"][-1]
                else:
                    current_opt = f"{letter}) {rest}"
                    current_q["options"].append(current_opt)
                    
                if p_num not in current_q["provenance"]["pages"]:
                    current_q["provenance"]["pages"].append(p_num)
                continue
                
            # Boundary stitching
            if current_q is not None:
                if current_opt is not None:
                    current_q["options"][-1] += " " + line_str
                else:
                    if current_q["statement"]:
                        current_q["statement"] += "\n" + line_str
                    else:
                        current_q["statement"] = line_str
                        
                if p_num not in current_q["provenance"]["pages"]:
                    current_q["provenance"]["pages"].append(p_num)

    if current_q:
        all_questions.append(current_q)
        
    # Pós-processamento e pareamento com Gabarito Oficial Definitivo
    for q in all_questions:
        q_num = q["numero_original"]
        q["statement"] = q["statement"].strip()
        q["options"] = [re.sub(r"\s+", " ", opt).strip() for opt in q["options"]]
        q["disciplina"] = get_discipline(q_num)
        
        if q_num in QUESTOES_ANULADAS:
            q["correct_option"] = None
            q["gabarito_status"] = "ANULADA"
        else:
            correct = GABARITO_AUDITOR_FISCAL.get(q_num)
            q["correct_option"] = correct
            q["gabarito_status"] = "DEFINITIVO" if correct else "AUSENTE"
            
        q["confidence_score"] = 1.0 if len(q["options"]) == 4 else 0.75

    return {
        "version": "v1",
        "source": "AuditorFiscalWinRtOcrExtractor",
        "golden_set": "IBGP-2023-Auditor-Fiscal-503",
        "total_questions": len(all_questions),
        "data": {
            "metadata": metadata,
            "questions": all_questions
        }
    }

if __name__ == "__main__":
    meta = {
        "banca": "IBGP",
        "cargo": "Auditor Fiscal da Receita Municipal",
        "cargo_codigo": "503",
        "ano": 2023,
        "orgao": "Prefeitura Municipal de Araguari - MG",
        "hash": "auditor_fiscal_503_ibgp_2023_sha256"
    }
    result = extract_auditor_fiscal_questions("ingestion/output/auditor_words.json", meta)
    
    os.makedirs("tests/golden-set", exist_ok=True)
    out_file = "tests/golden-set/auditor_fiscal_503_fixture.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print(f"Extracted {result['total_questions']} questions to {out_file}")
    
    anuladas = [q["numero_original"] for q in result["data"]["questions"] if q["gabarito_status"] == "ANULADA"]
    print(f"Questões Anuladas identificadas: {anuladas}")
    
    with_4_opts = [q for q in result["data"]["questions"] if len(q["options"]) == 4]
    print(f"Questões com exatamente 4 alternativas: {len(with_4_opts)} de {result['total_questions']}")
