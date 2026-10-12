import re
import pymupdf
from .pdf_extractor import PdfExtractor

GABARITO_TECNICO_FISCAL = {
    1: "A", 2: "B", 3: "A", 4: "D", 5: "C", 6: "A", 7: "C", 8: "D", 9: "D", 10: "D",
    11: "B", 12: "A", 13: "B", 14: "C", 15: "C", 16: "D", 17: "A", 18: "B", 19: "D", 20: "A",
    21: "B", 22: "D", 23: "A", 24: "A", 25: "B", 26: "D", 27: "A", 28: "D", 29: "A", 30: "B",
    31: "A", 32: "C", 33: "A", 34: "D", 35: "B", 36: "B", 37: "D", 38: "C", 39: "A", 40: "B"
}

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

class PyMuPDFExtractor(PdfExtractor):
    def __init__(self):
        # Regex para ancoragem
        self.question_pattern = re.compile(r"^QUEST[AÃ][O0]\s*(\d+)", re.IGNORECASE)
        self.option_pattern = re.compile(r"^(?:[^\w\n]*[a-z]{0,2}[\)\.]?\s*)?([A-E])\)\s*(.*)", re.IGNORECASE)

    def extract(self, file_path: str, metadata: dict) -> dict:
        doc = pymupdf.open(file_path)
        questions = []
        
        current_question = None
        current_option = None
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            blocks = page.get_text("blocks")
            
            page_height = page.rect.height
            page_width = page.rect.width
            mid_x = page_width / 2
            
            valid_blocks = []
            
            for b in blocks:
                if b[6] != 0:  # Somente blocos de texto
                    continue
                
                x0, y0, x1, y1 = b[:4]
                
                # Filtragem de Ruído (Heurística de Margem)
                # Ignora cabeçalhos (top 4%) e rodapés (bottom 4%)
                if y0 < page_height * 0.04 or y1 > page_height * 0.96:
                    continue
                    
                # Ordenação por Bounding Boxes (Layout de Duas Colunas)
                col = 0 if x0 < mid_x else 1
                valid_blocks.append((col, y0, b))
                
            # Ordena primeiro pela coluna, depois verticalmente pelo eixo y0
            valid_blocks.sort(key=lambda item: (item[0], item[1]))
            
            for _, _, b in valid_blocks:
                text = b[4].strip()
                if not text:
                    continue
                
                # Tratar linha por linha dentro do bloco para evitar fusão de opções
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                        
                    clean_line = re.sub(r"^[\W_]+", "", line)
                    
                    # Detecta início de uma nova questão
                    q_match = self.question_pattern.match(clean_line)
                    if q_match:
                        if current_question:
                            questions.append(current_question)
                        
                        q_num = int(q_match.group(1))
                        statement_text = line[q_match.end():].strip()
                        
                        current_question = {
                            "id": q_num,
                            "statement": statement_text,
                            "options": [],
                            "provenance": {
                                "banca": metadata.get("banca", ""),
                                "cargo": metadata.get("cargo", ""),
                                "ano": metadata.get("ano", ""),
                                "hash": metadata.get("hash", ""),
                                "pages": [page_num + 1]
                            }
                        }
                        current_option = None
                        continue
                    
                    # Detecta início de alternativa
                    opt_match = self.option_pattern.match(line)
                    if opt_match and current_question is not None:
                        opt_letter = opt_match.group(1).upper() + ")"
                        opt_text = opt_match.group(2).strip()
                        current_option = opt_letter + " " + opt_text
                        current_question["options"].append(current_option)
                        
                        # Atualizar as páginas na proveniência, se expandiu
                        if (page_num + 1) not in current_question["provenance"]["pages"]:
                            current_question["provenance"]["pages"].append(page_num + 1)
                        continue
                    
                    # Boundary-Stitching: Acumular ao statement ou à option atual
                    if current_question is not None:
                        if current_option is not None:
                            # Append to the last option
                            current_question["options"][-1] += " " + line
                        else:
                            # Append to the statement
                            if current_question["statement"]:
                                current_question["statement"] += "\n" + line
                            else:
                                current_question["statement"] = line
                                
                        if (page_num + 1) not in current_question["provenance"]["pages"]:
                            current_question["provenance"]["pages"].append(page_num + 1)
                            
        if current_question:
            questions.append(current_question)
            
        doc.close()
        
        # Limpar texto, padronizar e parear gabarito oficial
        for q in questions:
            q_id = q["id"]
            q["statement"] = q["statement"].strip()
            q["options"] = [o.strip() for o in q["options"]]
            q["correct_option"] = GABARITO_TECNICO_FISCAL.get(q_id, "A")
            q["disciplina"] = get_discipline(q_id)
            q["confidence_score"] = 1.0 if len(q["options"]) == 4 else 0.75
            
        return {
            "version": "v1",
            "source": "PyMuPDFExtractor",
            "data": {
                "metadata": metadata,
                "questions": questions
            }
        }
