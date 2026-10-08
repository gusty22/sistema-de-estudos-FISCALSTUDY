import re
import pymupdf
from .pdf_extractor import PdfExtractor

class PyMuPDFExtractor(PdfExtractor):
    def __init__(self):
        # Regex para ancoragem
        self.question_pattern = re.compile(r"^QUESTÃO\s*(\d+)", re.IGNORECASE)
        self.option_pattern = re.compile(r"^(?:[a-z]{1,3}\s*)?([A-E])\)")

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
                    opt_match = self.option_pattern.match(clean_line)
                    if opt_match and current_question is not None:
                        opt_letter = opt_match.group(1) + ")"
                        opt_text = clean_line[opt_match.end():].strip()
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
        
        # Limpar texto e padronizar
        for q in questions:
            q["statement"] = q["statement"].strip()
            q["options"] = [o.strip() for o in q["options"]]
            
        return {
            "version": "v1",
            "source": "PyMuPDFExtractor",
            "data": {
                "questions": questions
            }
        }
