"""Extrator Universal Multi-Banca para o Mecanismo de Ingestão do FiscalStudy.

Responsabilidades:
- Reconhecimento adaptativo de leiautes de provas:
  * Padrão IBGP / Tradicional: 'QUESTÃO 01', opções 'A) ...'
  * Padrão FGV / FCC / Multicoluna: numeração destacada ('1', '2', '3'), opções '(A) ...'
  * Padrão CEBRASPE / CESPE: assertivas numeradas vinculadas a comandos ('1 O STF...'), opções C/E
  * Padrões Gerais: 'Questão 1.', '1 - ...'
- Extração de textos de apoio compartilhados ('Leia o texto a seguir para responder às questões de X a Y').
- Pareamento universal de gabaritos: suporte a tabelas verticais e grades horizontais compactas.
- Avaliação estrita de qualidade, consistência de gabaritos e rotulagem de flags de risco.
"""
from __future__ import annotations

import os
import re
import unicodedata
import uuid
from typing import Any, Dict, List, Optional, Tuple

import pymupdf


def normalize_ascii_upper(s: str) -> str:
    if not s:
        return ""
    return unicodedata.normalize("NFKD", s).encode("ASCII", "ignore").decode("ASCII").upper().strip()


DISCIPLINES_CANONICAL = {
    "LINGUA PORTUGUESA": "Língua Portuguesa",
    "PORTUGUES": "Língua Portuguesa",
    "RACIOCINIO LOGICO": "Raciocínio Lógico",
    "RACIOCINIO LOGICO-MATEMATICO": "Raciocínio Lógico",
    "MATEMATICA": "Raciocínio Lógico",
    "NOCOES DE INFORMATICA": "Noções de Informática",
    "INFORMATICA": "Noções de Informática",
    "CONHECIMENTOS GERAIS": "Conhecimentos Gerais",
    "ATUALIDADES": "Conhecimentos Gerais",
    "LEGISLACAO MUNICIPAL": "Legislação Municipal",
    "LEGISLACAO": "Legislação Municipal",
    "DIREITO TRIBUTARIO": "Direito Tributário",
    "DIREITO CONSTITUCIONAL": "Direito Constitucional",
    "DIREITO ADMINISTRATIVO": "Direito Administrativo",
    "DIREITO CIVIL": "Direito Civil",
    "DIREITO EMPRESARIAL": "Direito Empresarial",
    "DIREITO PROCESSUAL": "Direito Processual",
    "CONTABILIDADE GERAL": "Contabilidade Geral",
    "CONTABILIDADE": "Contabilidade Geral",
    "CONTABILIDADE PUBLICA": "Contabilidade Pública",
    "AUDITORIA": "Auditoria",
    "AUDITORIA FISCAL": "Auditoria",
    "ADMINISTRACAO PUBLICA": "Administração Pública",
    "ECONOMIA": "Economia",
    "CONHECIMENTOS ESPECIFICOS": "Conhecimentos Específicos",
}


def detect_contextual_suspect_chars(text: str) -> bool:
    """Detecta anomalias de OCR, caracteres de substituição Unicode e mojibake."""
    if not text:
        return False
    if "\uFFFD" in text:
        return True
    if re.search(r"(Ã£|Ã©|Ã³|Ã§|Ãª|Ã¡|Ãº|Ã­|â€“|â€|ï¿½)", text):
        return True
    if re.search(r"[a-zA-ZÀ-ÿ]\|[a-zA-ZÀ-ÿ]", text):
        return True
    return False


def parse_answer_key_universal(doc_pdf: pymupdf.Document, g_start: int, g_end: int) -> Tuple[Dict[int, str], str]:
    """Extrai gabarito oficial em formato vertical (IBGP) ou grade horizontal (FGV, Cebraspe, FCC)."""
    full_text = ""
    for idx in range(max(0, g_start - 1), min(len(doc_pdf), g_end)):
        full_text += doc_pdf[idx].get_text() + "\n"

    # Detecta status oficial do gabarito
    upper_txt = full_text.upper()
    status = "DEFINITIVO"
    if "PRELIMINAR" in upper_txt:
        status = "PRELIMINAR"
    elif "RETIF" in upper_txt:
        status = "RETIFICADO"

    answers: Dict[int, str] = {}

    # 1. Formato vertical / pares delimitados: '1 | A', '1 - A', '1: A', '01 A'
    matches = re.findall(r"\b(\d{1,3})\s*[:\-\|\s]\s*([A-E]|ANULADA|X)\b", full_text, re.IGNORECASE)
    for num_str, opt in matches:
        num = int(num_str)
        if 1 <= num <= 200:
            val = opt.upper()
            answers[num] = "ANULADA" if val in ["ANULADA", "X"] else val

    if len(answers) >= 15:
        return answers, status

    # 2. Formato grade horizontal compacta (FGV / CEBRASPE / FCC):
    # Linha com sequência numérica de pelo menos 4 questões, seguida por sequência de letras
    tokens = [t.strip() for t in full_text.split() if t.strip()]
    i = 0
    while i < len(tokens):
        if tokens[i].isdigit() and (1 <= int(tokens[i]) <= 200):
            nums = [int(tokens[i])]
            i += 1
            while i < len(tokens) and tokens[i].isdigit() and int(tokens[i]) == nums[-1] + 1:
                nums.append(int(tokens[i]))
                i += 1
            if len(nums) >= 4:
                letters = []
                while i < len(tokens) and (tokens[i].upper() in ["A", "B", "C", "D", "E", "X", "ANULADA"]):
                    letters.append(tokens[i].upper())
                    i += 1
                if len(nums) == len(letters):
                    for n, l in zip(nums, letters):
                        answers[n] = "ANULADA" if l in ["ANULADA", "X"] else l
        else:
            i += 1

    return answers, status


class UniversalExtractor:
    """Motor de extração adaptativo de provas de concursos públicos."""

    def __init__(self, banca: str = "AUTO"):
        self.banca_hint = banca.upper() if banca else "AUTO"

    def detect_banca_strategy(self, full_text: str) -> str:
        """Infere a estratégia de extração com base no vocabulário e estrutura do documento."""
        if self.banca_hint in ["IBGP", "FGV", "CEBRASPE", "CESPE", "FCC", "FEPESE"]:
            return "CEBRASPE" if self.banca_hint in ["CEBRASPE", "CESPE"] else self.banca_hint

        upper_txt = full_text[:4000].upper()
        if "CEBRASPE" in upper_txt or "CESPE" in upper_txt or "CÓDIGO C, CASO JULGUE O ITEM CERTO" in upper_txt:
            return "CEBRASPE"
        if "FGV CONHECIMENTO" in upper_txt or "FUNDAÇÃO GETULIO VARGAS" in upper_txt:
            return "FGV"
        if "INSTITUTO BRASILEIRO DE GESTÃO E PESQUISA" in upper_txt or "IBGP" in upper_txt:
            return "IBGP"
        if "FUNDAÇÃO CARLOS CHAGAS" in upper_txt or "FCC" in upper_txt:
            return "FGV" # FCC compartilha estrutura de alternativas em parênteses similar à FGV
        return "IBGP" # Padrão mais comum do acervo

    def extract_shared_contexts(self, text: str) -> List[Dict[str, Any]]:
        """Identifica textos de apoio compartilhados para múltiplas questões."""
        contexts = []
        patterns = [
            r"(?:Texto|Instru[cç][aã]o|Considere o texto|Leia o texto)[^\n]*para responder [aà]s quest[oõ]es (?:de )?(\d+) (?:a|e) (\d+)\.?\s*\n(.*?)(?=\n\s*(?:QUEST[AÃ]O|\d{1,2}\b))",
            r"(?:Com rela[cç][aã]o|A respeito|Acerca)[^\n]*julgue os itens (?:a seguir|que se seguem|subsequentes)\.?\s*\n(.*?)(?=\n\s*\d{1,3}\s+[A-ZÀ-Ú])",
        ]
        for pat in patterns:
            for match in re.finditer(pat, text, re.IGNORECASE | re.DOTALL):
                contexts.append({
                    "id": str(uuid.uuid4()),
                    "raw_match": match.group(0).strip(),
                })
        return contexts

    def extract_questions_from_span(
        self,
        doc_pdf: pymupdf.Document,
        p_start: int,
        p_end: int,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Extrai questões estruturadas do intervalo de páginas do caderno de prova."""
        metadata = metadata or {}
        pages_text: List[Tuple[int, str]] = []
        for p_idx in range(max(0, p_start - 1), min(len(doc_pdf), p_end)):
            pages_text.append((p_idx + 1, doc_pdf[p_idx].get_text()))

        full_text = "\n".join(t for _, t in pages_text)
        strategy = self.detect_banca_strategy(full_text)

        # Mapeamento de disciplinas ao longo do documento
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

        if strategy == "CEBRASPE":
            # Formato Cebraspe: assertivas numeradas 1 a 120
            # Ex: '17 No Windows Explorer, por meio da opção...'
            # Captura o texto de comando superior se houver
            item_regex = re.compile(
                r"(?:^|\n)\s*(\d{1,3})\s+([A-ZÀ-Ú][^\n]*?(?:\n(?!\s*\d{1,3}\s+[A-ZÀ-Ú]).*?)*)(?=(?:\n\s*\d{1,3}\s+[A-ZÀ-Ú]|$))",
                re.DOTALL,
            )
            for m in item_regex.finditer(full_text):
                num = int(m.group(1))
                body = m.group(2).strip()
                if 1 <= num <= 200 and len(body) >= 15:
                    raw_questions.append({
                        "numero_original": num,
                        "statement": body,
                        "options": ["C) CERTO", "E) ERRADO"],
                        "disciplina": current_disc,
                        "pages": [p_start], # Aproximação inicial
                    })

        elif strategy == "FGV":
            # Formato FGV / FCC: numeração isolada na linha ('1', '2', ..., '70')
            # Seguido por alternativas (A), (B), (C), (D), (E)
            q_blocks = re.split(r"(?:^|\n)\s*(\d{1,3})\s*\n", full_text)
            if len(q_blocks) > 1:
                for i in range(1, len(q_blocks), 2):
                    num = int(q_blocks[i])
                    body = q_blocks[i + 1]
                    opts_raw = re.findall(
                        r"(?:^|\n)\s*\(([A-E])\)\s*(.*?)(?=(?:\n\s*\([A-E]\)|$))",
                        body,
                        flags=re.DOTALL,
                    )
                    # O enunciado é o texto anterior à primeira alternativa
                    stmt_match = re.split(r"(?:^|\n)\s*\([A-E]\)", body, maxsplit=1)
                    stmt = stmt_match[0].strip() if stmt_match else body.strip()

                    if opts_raw or (1 <= num <= 100):
                        raw_questions.append({
                            "numero_original": num,
                            "statement": stmt,
                            "options": [f"({o[0]}) {o[1].strip()}" for o in opts_raw],
                            "disciplina": current_disc,
                            "pages": [p_start],
                        })

        else:
            # Padrão IBGP / Tradicional: 'QUESTÃO 01'
            q_blocks = re.split(
                r"(?:^|\n)\s*QUEST[AÃ][O0]\s*[:.\-]?\s*(\d+)",
                full_text,
                flags=re.IGNORECASE,
            )
            if len(q_blocks) > 1:
                for i in range(1, len(q_blocks), 2):
                    num = int(q_blocks[i])
                    body = q_blocks[i + 1]
                    opts_raw = re.findall(
                        r"(?:^|\n)\s*([A-E])\)\s*(.*?)(?=(?:\n\s*[A-E]\)|$))",
                        body,
                        flags=re.DOTALL,
                    )
                    stmt_match = re.split(r"(?:^|\n)\s*[A-E]\)", body, maxsplit=1)
                    stmt = stmt_match[0].strip() if stmt_match else body.strip()

                    raw_questions.append({
                        "numero_original": num,
                        "statement": stmt,
                        "options": [f"{o[0]}) {o[1].strip()}" for o in opts_raw],
                        "disciplina": current_disc,
                        "pages": [p_start],
                    })

        # Deduplicação por número de questão dentro da prova
        seen_nums = set()
        unique_questions: List[Dict[str, Any]] = []
        for q in raw_questions:
            n = q["numero_original"]
            if n not in seen_nums:
                seen_nums.add(n)
                unique_questions.append(q)

        unique_questions.sort(key=lambda x: x["numero_original"])
        return unique_questions, support_materials

