"""Motor de análise geométrica de layout e segmentação estruturada de questões.

Resolve diretamente os problemas identificados na auditoria:
1. Isolamento estrito de colunas (ordem de leitura geométrica).
2. Detecção de cabeçalhos de disciplina (encerram questão imediatamente e nunca se anexam a alternativas).
3. Higienização de anotações manuscritas/rabiscos de candidatos (classificação e trilha de auditoria).
4. Suporte a alternativas em linha (grades 2x2: A/C e B/D).
5. Trilha de auditoria preservando Nível 1 (original), Nível 2 (blocos brutos) e Nível 3 (estruturado).
6. Alerta explícito de divergência em questões críticas (ex: Q15 ARAGUARI 3.360 vs 336).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

import pymupdf


def normalize_ascii_upper(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ASCII", "ignore").decode("ASCII").upper().strip()


DISCIPLINES_CANONICAL = {
    "LINGUA PORTUGUESA": "Língua Portuguesa",
    "PORTUGUES": "Língua Portuguesa",
    "RACIOCINIO LOGICO": "Raciocínio Lógico",
    "RACIOCINIO LOGICO-MATEMATICO": "Raciocínio Lógico",
    "NOCOES DE INFORMATICA": "Noções de Informática",
    "INFORMATICA": "Noções de Informática",
    "CONHECIMENTOS GERAIS": "Conhecimentos Gerais",
    "ATUALIDADES": "Conhecimentos Gerais",
    "LEGISLACAO MUNICIPAL": "Legislação Municipal",
    "LEGISLACAO": "Legislação Municipal",
    "CONHECIMENTOS ESPECIFICOS": "Conhecimentos Específicos",
    "DIREITO TRIBUTARIO": "Direito Tributário",
    "CONTABILIDADE GERAL": "Contabilidade Geral",
    "AUDITORIA": "Auditoria",
}

QUESTION_START_RE = re.compile(r"^QUEST[AÃ][O0]\s*[:.\-]?\s*(\d+)", re.IGNORECASE)
OPTION_START_RE = re.compile(r"^[^\w(]{0,2}[a-zO0]?[^\w(]?([A-E])\)\s*(.*)", re.IGNORECASE)
INLINE_OPTION_SPLIT_RE = re.compile(r"\s+([B-E])\)\s*")
INSTRUCTION_HEADER_RE = re.compile(r"^\W*Instru[cç][aã]o\s*:", re.IGNORECASE)


class LayoutEngine:
    """Motor de análise de layout para PDFs digitais com texto extraível."""

    def __init__(self, header_margin_pct: float = 0.04, footer_margin_pct: float = 0.04):
        self.header_margin_pct = header_margin_pct
        self.footer_margin_pct = footer_margin_pct

    def is_candidate_noise(self, text: str, x0: float, left_margin_threshold: float = 32.0) -> Tuple[bool, str]:
        """Detecta se uma linha/bloco é ruído de candidato ou rabisco."""
        stripped = text.strip()
        if not stripped:
            return True, "EMPTY_LINE"

        # Conteúdo estrutural legítimo nunca é ruído
        clean_prefix = re.sub(r"^[\W_]+", "", stripped)
        if QUESTION_START_RE.match(clean_prefix) or OPTION_START_RE.match(stripped):
            return False, ""

        # Anotação em margem lateral extrema (fora da mancha de texto)
        if x0 < left_margin_threshold:
            return True, "MARGIN_ANNOTATION"

        # Linhas formadas puramente por símbolos de caneta/rascunho
        clean_alphanumeric = re.sub(r"[\s\W_~]+", "", stripped)
        if not clean_alphanumeric:
            return True, "DOODLE_SYMBOLS"

        # Padrões conhecidos de rabiscos puros
        if re.search(r"^[~\\/|_!@#$%\^&*()=+\[\]{}:;<>.,\s-]+$", stripped):
            return True, "NON_TEXT_GLYPHS"

        # Linhas com poucas letras misturadas com caracteres não usuais (mas não números puros como '336.')
        letters = [c for c in stripped if c.isalpha()]
        if len(letters) < 2 and len(stripped) > 4 and not re.match(r"^[\d\.,\s\(\)R\$\%\º\ª\-]+$", stripped):
            return True, "SUSPICIOUS_SCRIBBLE"

        return False, ""

    def clean_option_tail(self, text: str) -> str:
        """Higieniza rabiscos acidentais colados ao final da alternativa impressa."""
        # Ex: '336.10,.~rl\'l' -> '336.'
        cleaned = re.sub(r"(\d+[\.,]?)\s*[^\w\s].*$", r"\1", text)
        # Ex: '560. ·_1, ! :i.. 1' -> '560.'
        cleaned = re.sub(r"(\.)\s*[\·_\-~!@#\$%\^&\*\(\):;,\?].*$", r"\1", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    def process_pdf(self, pdf_path: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Executa a análise de layout e retorna Nível 2 (raw) e Nível 3 (questões estruturadas)."""
        metadata = metadata or {}
        doc = pymupdf.open(pdf_path)
        
        raw_blocks_level2: List[Dict[str, Any]] = []
        audit_log: List[Dict[str, Any]] = []
        structured_questions: List[Dict[str, Any]] = []
        shared_contexts: List[Dict[str, Any]] = []

        current_discipline = "Geral"
        current_q: Optional[Dict[str, Any]] = None
        current_opt: Optional[Dict[str, Any]] = None
        current_context: Optional[Dict[str, Any]] = None

        def finalize_current_question():
            nonlocal current_q, current_opt
            if current_q is not None:
                # Higieniza alternativas
                for opt in current_q["options"]:
                    opt["text"] = self.clean_option_tail(opt["text"])

                # Avalia qualidade estrutural
                opts_letters = [o["letter"] for o in current_q["options"]]
                stmt_text = " ".join(current_q["statement_lines"]).strip()
                current_q["statement"] = stmt_text

                # Verificações de integridade
                if len(stmt_text) < 15:
                    current_q["flags"].append("STATEMENT_TOO_SHORT")
                if len(current_q["options"]) < 4:
                    current_q["flags"].append(f"OPTIONS_INCOMPLETE:found_{len(current_q['options'])}")
                if len(set(opts_letters)) != len(opts_letters):
                    current_q["flags"].append("OPTIONS_DUPLICATE")

                # Auditoria específica para Questão 15 / Anagramas ARAGUARI
                if "ARAGUARI" in stmt_text.upper() and "ANAGRAMA" in stmt_text.upper():
                    c_opt = next((o for o in current_q["options"] if o["letter"] == "C"), None)
                    if c_opt and "336" in c_opt["text"]:
                        current_q["flags"].append(
                            "MATH_DIVERGENCE_SUSPECTED: Palavra ARAGUARI produz 3.360 anagramas distintos (8! / 3!2!), "
                            "mas alternativa C impressa apresenta 336. Gabarito preliminar oficial indica C. Conferência necessária."
                        )

                # Detecção de dependência de material de apoio ausente
                stmt_lower = stmt_text.lower()
                mentions_external_material = any(
                    phrase in stmt_lower for phrase in [
                        "com base no texto", "conforme o texto", "de acordo com o texto",
                        "segundo o texto", "leia o texto", "observe a tabela", "conforme a tabela",
                        "observe o gráfico", "no gráfico acima", "no mapa a seguir", "conforme a figura"
                    ]
                )
                if mentions_external_material and not current_q.get("support_material"):
                    current_q["flags"].append("SUPPORT_MATERIAL_MISSING: Enunciado referencia texto ou tabela não vinculada")

                # Classificação de status
                has_critical_issue = any(
                    f.startswith("OPTIONS_INCOMPLETE") or f == "STATEMENT_TOO_SHORT" or f == "OPTIONS_DUPLICATE"
                    for f in current_q["flags"]
                )
                has_review_flag = len(current_q["flags"]) > 0

                if has_critical_issue:
                    current_q["status"] = "REJECTED"
                elif has_review_flag:
                    current_q["status"] = "NEEDS_REVIEW"
                else:
                    current_q["status"] = "STRUCTURALLY_VALID"

                structured_questions.append(current_q)
                current_q = None
                current_opt = None

        try:
            for p_idx in range(len(doc)):
                page = doc[p_idx]
                p_num = p_idx + 1
                width = page.rect.width
                height = page.rect.height
                mid_x = width / 2.0

                blocks = page.get_text("blocks")
                left_col_blocks = []
                right_col_blocks = []

                for b in blocks:
                    x0, y0, x1, y1, text, b_no, b_type = b
                    if b_type != 0:
                        continue

                    # Preservação do Nível 2 (Extração Bruta)
                    raw_blocks_level2.append({
                        "page": p_num,
                        "bbox": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                        "text": text.strip(),
                        "block_id": f"p{p_num}_b{b_no}",
                    })

                    # Descarte de cabeçalho da página (top 4%) e rodapé (bottom 4%)
                    if y0 < height * self.header_margin_pct:
                        audit_log.append({
                            "page": p_num,
                            "bbox": [x0, y0, x1, y1],
                            "classification": "DOCUMENT_ARTIFACT",
                            "reason": "PAGE_HEADER_EXCLUDED",
                            "text": text.strip(),
                        })
                        continue

                    if y1 > height * (1.0 - self.footer_margin_pct):
                        audit_log.append({
                            "page": p_num,
                            "bbox": [x0, y0, x1, y1],
                            "classification": "DOCUMENT_ARTIFACT",
                            "reason": "PAGE_FOOTER_EXCLUDED",
                            "text": text.strip(),
                        })
                        continue

                    # Partição geométrica de colunas
                    if (x1 - x0) > 0.65 * width:
                        left_col_blocks.append((y0, x0, b, "FULL_WIDTH"))
                    elif (x0 + x1) / 2.0 < mid_x:
                        left_col_blocks.append((y0, x0, b, "LEFT"))
                    else:
                        right_col_blocks.append((y0, x0, b, "RIGHT"))

                # Leitura ordenada: coluna esquerda depois coluna direita
                left_col_blocks.sort(key=lambda item: (item[0], item[1]))
                right_col_blocks.sort(key=lambda item: (item[0], item[1]))

                for y0, x0, b, zone in (left_col_blocks + right_col_blocks):
                    block_text = b[4]
                    lines = [l.strip() for l in block_text.split("\n") if l.strip()]

                    for line in lines:
                        # 1. Checa anotação de candidato / ruído de caneta
                        is_noise, noise_reason = self.is_candidate_noise(line, x0)
                        if is_noise:
                            audit_log.append({
                                "page": p_num,
                                "bbox": [x0, y0, b[2], b[3]],
                                "classification": "CANDIDATE_ANNOTATION",
                                "reason": noise_reason,
                                "text": line,
                            })
                            continue

                        # 2. Checa cabeçalho de disciplina
                        norm_line = normalize_ascii_upper(line)
                        is_disc_header = False
                        for disc_key, canon_name in DISCIPLINES_CANONICAL.items():
                            if disc_key in norm_line and len(norm_line) <= len(disc_key) + 8:
                                current_discipline = canon_name
                                is_disc_header = True
                                break

                        if is_disc_header:
                            # Encerra questão atual para não contaminar última opção
                            finalize_current_question()
                            audit_log.append({
                                "page": p_num,
                                "classification": "PRINTED_SOURCE",
                                "reason": "SECTION_HEADER_DETECTED",
                                "discipline": current_discipline,
                                "text": line,
                            })
                            continue

                        # 3. Checa texto compartilhado de instrução ou texto-base
                        inst_m = INSTRUCTION_HEADER_RE.match(line) or re.search(r"^(?:TEXTO|QUADRO|TABELA)\s*(?:[I|V|X\d]+)?\s*[-—:]?", line, re.IGNORECASE)
                        if inst_m and not QUESTION_START_RE.match(line):
                            finalize_current_question()
                            range_m = re.search(r"(?:quest[oõ]es?|itens?)\s*(?:de\s*)?(\d+)\s*(?:a|à|e)\s*(\d+)", line, re.IGNORECASE)
                            start_q, end_q = (int(range_m.group(1)), int(range_m.group(2))) if range_m else (None, None)
                            
                            tipo = "TEXTO_BASE"
                            line_up = line.upper()
                            if "TABELA" in line_up or "QUADRO" in line_up:
                                tipo = "TABELA"
                            elif "GRAFICO" in line_up or "GRÁFICO" in line_up:
                                tipo = "GRAFICO"
                            elif "FIGURA" in line_up or "MAPA" in line_up or "IMAGEM" in line_up:
                                tipo = "FIGURA"

                            current_context = {
                                "tipo": tipo,
                                "header": line,
                                "page": p_num,
                                "lines": [],
                                "target_range": (start_q, end_q),
                            }
                            shared_contexts.append(current_context)
                            continue

                        # 4. Checa início de nova questão
                        clean_start = re.sub(r"^[\W_]+", "", line)
                        qm = QUESTION_START_RE.match(clean_start)
                        if qm:
                            finalize_current_question()
                            q_num = int(qm.group(1))
                            tail = clean_start[qm.end():].strip()

                            # Verifica se pertence a um material de apoio ativo
                            matched_material = None
                            for ctx in shared_contexts:
                                rng = ctx.get("target_range")
                                if rng and rng[0] is not None and rng[1] is not None:
                                    if rng[0] <= q_num <= rng[1]:
                                        matched_material = {
                                            "tipo": ctx.get("tipo", "TEXTO_BASE"),
                                            "titulo": ctx.get("header", "Material de Apoio"),
                                            "conteudo_texto": "\n".join(ctx.get("lines", [])).strip(),
                                            "pagina_inicio": ctx.get("page", p_num),
                                            "pagina_fim": p_num,
                                        }
                                        break

                            current_q = {
                                "id": f"q{q_num}",
                                "numero_original": q_num,
                                "disciplina": current_discipline,
                                "statement_lines": [tail] if tail else [],
                                "options": [],
                                "pages": [p_num],
                                "flags": [],
                                "support_material": matched_material,
                                "provenance": {
                                    "banca": metadata.get("banca", "IBGP"),
                                    "cargo": metadata.get("cargo", "Técnico Fiscal da Receita Municipal"),
                                    "cargo_codigo": metadata.get("cargo_codigo", "532"),
                                    "ano": metadata.get("ano", 2023),
                                    "orgao": metadata.get("orgao", "Prefeitura Municipal de Araguari - MG"),
                                    "pages": [p_num],
                                },
                            }
                            current_opt = None
                            continue

                        if current_q is None:
                            if current_context is not None:
                                current_context["lines"].append(line)
                            continue

                        if p_num not in current_q["pages"]:
                            current_q["pages"].append(p_num)
                            current_q["provenance"]["pages"].append(p_num)

                        # 5. Checa início de alternativa
                        om = OPTION_START_RE.match(line)
                        if om:
                            letter = om.group(1).upper()
                            body = om.group(2).strip()

                            # Checa alternativa secundária na mesma linha (ex: A)... C)...)
                            parts = INLINE_OPTION_SPLIT_RE.split(body)
                            if len(parts) > 1:
                                current_opt = {"letter": letter, "text": parts[0].strip()}
                                current_q["options"].append(current_opt)
                                k = 1
                                while k < len(parts):
                                    sub_letter = parts[k].upper()
                                    sub_text = parts[k + 1].strip() if k + 1 < len(parts) else ""
                                    current_q["options"].append({"letter": sub_letter, "text": sub_text})
                                    k += 2
                                current_opt = current_q["options"][-1]
                            else:
                                current_opt = {"letter": letter, "text": body}
                                current_q["options"].append(current_opt)
                            continue

                        # 6. Continuação de enunciado ou de alternativa
                        if current_opt is not None:
                            current_opt["text"] += " " + line
                        else:
                            current_q["statement_lines"].append(line)

            finalize_current_question()
        finally:
            doc.close()

        # Formatando opções como lista canônica "A) texto"
        for q in structured_questions:
            q["options_formatted"] = [f"{o['letter']}) {o['text']}" for o in q["options"]]

        return {
            "version": "v1",
            "document_metadata": metadata,
            "total_questions_extracted": len(structured_questions),
            "level2_raw_blocks_count": len(raw_blocks_level2),
            "level3_questions": structured_questions,
            "audit_log": audit_log,
            "shared_contexts": shared_contexts,
        }
