"""Extrator Universal Multi-Banca para o Mecanismo de Ingestão do FiscalStudy.

Responsabilidades:
- Reconhecimento adaptativo de leiautes de provas:
  * Padrão IBGP / Tradicional: 'QUESTÃO 01', opções 'A) ...' e minúsculas 'a) ...'
  * Padrão FGV / FCC / Multicoluna: numeração destacada ('1', '2', '3'), opções '(A) ...'
  * Padrão CEBRASPE / CESPE: assertivas numeradas vinculadas a comandos ('1 O STF...'), opções C/E
  * Padrões Gerais: 'Questão 1.', '1 - ...'
- Extração precisa de textos de apoio e materiais compartilhados ('Texto para as questões de X a Y', textos-base pré-questão 1).
- Pareamento universal de gabaritos multi-cargo:
  * Identificação de cargo, código e tipo de prova específicos no caderno
  * Segmentação do gabarito oficial em tabelas por cargo
  * Pontuação e pareamento estrito com o cargo correspondente (evitando gabaritos de outros cargos)
  * Suporte a tabelas verticais, pares alternados linha a linha e grades horizontais
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


def clean_page_artifacts(t: str) -> str:
    """Remove marcas d'água de download, numeração de páginas, rodapés e cabeçalhos repetitivos."""
    if not t:
        return ""
    lines = t.splitlines()
    clean = []
    for l in lines:
        s = l.strip()
        if not s:
            clean.append(l)
            continue
        if s.startswith("pcimarkpci") or "pciconcursos" in s:
            continue
        if re.search(r"P[aá]gina \d+ de \d+", s, re.IGNORECASE):
            continue
        if re.search(r"^\d+\s+de\s+\d+\b", s, re.IGNORECASE):
            continue
        if re.search(r"^Banca\s+[A-Z0-9&]+", s, re.IGNORECASE):
            continue
        if re.search(r"^PSS\s+[^\n]+", s, re.IGNORECASE):
            continue
        if re.search(r"^Concurso\s+[^\n]+", s, re.IGNORECASE):
            continue
        if re.search(r"v\.Audit\.:|v\.\d+/\d+", s, re.IGNORECASE):
            continue
        if re.search(r"^Instituto\s+[A-Z0-9&]+\s*\|", s, re.IGNORECASE):
            continue
        clean.append(l)
    return "\n".join(clean).strip()


ADMIN_INSTRUCTION_PATTERNS = [
    r"LEIA\s+(?:COM\s+ATEN[CÇ][AÃ]O|ATENTAMENTE)\s+(?:AS\s+)?INSTRU[CÇ][OÕ]ES",
    r"AO\s+RECEBER\s+ESTE\s+CADERNO",
    r"INSTRU[CÇ][OÕ]ES\s+(?:GERAIS|AO\s+CANDIDATO|AOS\s+CANDIDATOS|DA\s+PROVA)",
    r"ORIENTA[CÇ][OÕ]ES\s+GERAIS",
    r"ESTE\s+CADERNO\s+(?:DE\s+PROVAS?\s+)?CONT[EÉ]M\s+\d+",
    r"SEU\s+CADERNO\s+(?:DE\s+PROVAS?\s+)?DEVE\s+CONTER\s+\d+",
    r"VERIFIQUE\s+SE\s+(?:ESTE\s+)?CADERNO\s+CONT[EÉ]M",
    r"FOLHA\s+DE\s+RESPOSTAS?\s*[\(\-–]\s*RASCUNHO",
    r"GABARITO\s+(?:DO\s+CANDIDATO|RASCUNHO)",
    r"CART[AÃ]O[\s\-]RESPOSTA\s*[\(\-–]\s*RASCUNHO",
    r"CANETA\s+(?:ESFEROGR[AÁ]FICA\s+)?(?:DE\s+TINTA\s+)?(?:AZUL\s+OU\s+PRETA|PRETA\s+OU\s+AZUL)",
    r"N[AÃ]O\s+SER[AÁ]\s+PERMITIDO\s+AO\s+CANDIDATO",
    r"SOMENTE\s+SER[AÁ]\s+PERMITIDO\s+AO\s+CANDIDATO\s+RETIRAR",
    r"DURA[CÇ][AÃ]O\s+(?:M[AÁ]XIMA\s+)?DA\s+PROVA",
    r"TEMPO\s+(?:M[IÍ]NIMO\s+DE\s+PERMAN[EÊ]NCIA|DESTINADO\s+[AÀ]\s+PROVA)",
    r"ASSINE\s+NO\s+LOCAL\s+INDICADO",
    r"CONFIRA\s+SEU\s+N[UÚ]MERO\s+DE\s+INSCRI[CÇ][AÃ]O",
    r"N[AÃ]O\s+DOBRE[,\s]+AMASSE\s+OU\s+MANCHE",
    r"APARELHOS\s+ELETR[OÔ]NICOS\s*\(?MESMO\s+DESLIGADOS\)?",
    r"DESLIGUE\s+O\s+TELEFONE\s+CELULAR",
    r"QUADRO\s+DE\s+DISTRIBUI[CÇ][AÃ]O\s+DE\s+QUEST[OÕ]ES",
    r"TABELA\s+DE\s+PONTUA[CÇ][AÃ]O",
]

COMPILED_ADMIN_REGEX = [re.compile(p, re.IGNORECASE) for p in ADMIN_INSTRUCTION_PATTERNS]

ANSWER_SHEET_GRID_REGEX = re.compile(
    r"(?:^|\n)\s*0?\d{1,2}\s*(?:[\(\[]?[A-Da-d][\)\]]?\s*){4,5}",
    re.MULTILINE
)


def is_answer_sheet_page(p_text: str) -> bool:
    """Detecta páginas de rascunho de folha de respostas/gabarito vertical com grade de bolinhas."""
    if not p_text:
        return False
    norm = normalize_ascii_upper(p_text)
    if any(k in norm for k in ["FOLHA DE RESPOSTAS", "FOLHA DE RESPOSTA", "GABARITO DO CANDIDATO", "CARTAO-RESPOSTA", "GABARITO RASCUNHO"]):
        grid_matches = ANSWER_SHEET_GRID_REGEX.findall(p_text)
        if len(grid_matches) >= 5 or "RASCUNHO" in norm:
            return True
    return False


def is_administrative_cover(p_text: str) -> bool:
    """Verifica se a página é capa administrativa / instruções gerais / regras de caneta / tabela de pontuação."""
    if not p_text or len(p_text.strip()) < 50:
        return True

    norm = normalize_ascii_upper(p_text)

    # 1. Folha de respostas ou rascunho
    if is_answer_sheet_page(p_text):
        return True

    # 2. Contagem de termos administrativos inequívocos
    matches_count = sum(1 for r in COMPILED_ADMIN_REGEX if r.search(p_text))
    if matches_count >= 2:
        return True
    if matches_count == 1 and len(p_text.strip().splitlines()) < 28:
        # Página curta com regras
        return True

    return False


def strip_administrative_leak(statement: str) -> str:
    """Remove cabeçalhos administrativos, instruções gerais aos candidatos, tabelas de pontuação
    e folhas de respostas residuais que possam ter vazado para o início do enunciado."""
    if not statement:
        return statement

    s = statement.strip()

    admin_starters = [
        r"^(?:Este\s+CADERNO|Este\s+caderno|Seu\s+caderno|Verifique\s+se\s+ele\s+cont[eé]m|O\s+presente\s+caderno)[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú])|PORTUGU[EÊ]S|L[IÍ]NGUA\s+PORTUGUESA)|$)",
        r"^No\s+Cart[aã]o[\-\s]Resposta[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^Confira[,\s]+acima[,\s]+o\s+seu\s+n[uú]mero[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^Ao\s+receber\s+este\s+caderno[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^N[aã]o\s+ser[aá]\s+permitido\s+ao\s+candidato[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^FOLHA\s+DE\s+RESPOSTAS?[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^INSTRU[CÇ][OÕ]ES\s+GERAIS[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^ORIENTA[CÇ][OÕ]ES[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
        r"^TABELA\s+DE\s+PONTUA[CÇ][AÃ]O[\s\S]*?(?:(?=QUEST[AÃ]O|\n\s*0?1[\.\-–\)]\s+(?=[A-ZÀ-Ú]))|$)",
    ]

    for pat in admin_starters:
        m = re.search(pat, s, re.IGNORECASE)
        if m:
            matched_len = m.end() - m.start()
            remainder = s[m.end():].strip()
            # Se sobrou conteúdo substancial (mais de 20 chars), o remainder é o enunciado real
            if len(remainder) >= 20:
                s = remainder
            elif matched_len > 0 and len(remainder) < 20:
                # O enunciado capturado era 100% administrativo
                return ""

    # Remove eventuais linhas residuais de grade de respostas isoladas (ex: 1 A B C D)
    lines = s.splitlines()
    clean_lines = []
    for l in lines:
        if re.match(r"^\s*0?\d{1,2}\s*(?:[A-Da-d]\s*){4,5}$", l.strip()):
            continue
        clean_lines.append(l)

    return "\n".join(clean_lines).strip()


def is_instruction_item(text: str) -> bool:
    """Detecta se uma assertiva/bloco é na verdade instrução administrativa do caderno."""
    t_clean = text.strip().lower()
    instruction_starters = [
        "ao receber este caderno", "durante a realização da prova", "na duração das provas",
        "ao terminar as provas", "nenhuma folha deste caderno", "a desobediência a qualquer",
        "confira inicialmente se os", "não serão aceitas reclamações", "o tempo destinado à",
        "folha\nnenhuma folha deste", "caso o caderno esteja incompleto", "este caderno contém",
        "este caderno de prova", "não será permitido ao candidato", "no cartão-resposta",
        "confira, acima, o seu número", "seu caderno deve conter"
    ]
    for starter in instruction_starters:
        if starter in t_clean[:120]:
            return True
    return False


def extract_inline_justification(text: str) -> Tuple[str, Optional[str], Optional[str]]:
    """Separa o enunciado da justificativa/comentário e infere o gabarito se presente.
    Retorna: (enunciado_limpo, justificativa, gabarito_inferido)
    """
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


def clean_support_text_line_numbers(text: str) -> str:
    """
    Remove rigorosamente todas as formas de numeração de linhas de textos de apoio e enunciados:
    1. Linhas contendo apenas numeração (ex: 01, 1, 02, 2, 5, 10, 15...).
    2. Prefixos explícitos de linha (ex: 'Linha 1:', 'linha 01 -', 'L. 1', 'l. 01').
    3. Numeração de margem colada ao texto (ex: '01  Texto...', '5   Texto...', '1 - Texto...').
    4. Marcadores de linha entre parênteses ou colchetes (ex: '(1)', '[01]', '(linha 1)').
    """
    if not text:
        return ""

    lines = text.splitlines()
    clean_lines = []

    for line in lines:
        l = line.strip()
        if not l:
            continue

        # 1. Ignora linhas contendo apenas numeração de linha (ex: '01', '1', '15', '41')
        if re.match(r"^\d{1,3}$", l):
            continue

        # 2. Remove prefixos explícitos de linha: 'Linha 1:', 'linha 01 -', 'L. 1', 'l. 01'
        l = re.sub(r"^(?:linha|l\.)\s*\d{1,3}\s*[:\-–—\.]?\s*", "", l, flags=re.IGNORECASE)
        l = re.sub(r"^\[\s*(?:linha|l\.)\s*\d{1,3}\s*\]\s*[:\-–—\.]?\s*", "", l, flags=re.IGNORECASE)
        l = re.sub(r"^\(\s*(?:linha|l\.)\s*\d{1,3}\s*\)\s*[:\-–—\.]?\s*", "", l, flags=re.IGNORECASE)
        l = re.sub(r"\s*\[\s*(?:linha|l\.)\s*\d{1,3}\s*\]", "", l, flags=re.IGNORECASE)
        l = re.sub(r"\s*\(\s*(?:linha|l\.)\s*\d{1,3}\s*\)", "", l, flags=re.IGNORECASE)

        # 3. Remove marcadores numéricos de margem no início da linha (ex: '01  Palavra', '5   Palavra', '1 - Palavra')
        l = re.sub(r"^\d{1,3}\s{2,}(?=[A-Za-zÀ-ÿ\"'“‘\(\[])", "", l)
        l = re.sub(r"^\d{1,3}\s*[-–—]\s*(?=[A-Za-zÀ-ÿ\"'“‘])", "", l)
        l = re.sub(r"^0\d\s+(?=[A-Za-zÀ-ÿ\"'“‘])", "", l)

        # 4. Remove numeração isolada no início de linha com ponto se for claramente linha (ex: '01. ')
        l = re.sub(r"^0\d\.\s+(?=[A-Za-zÀ-ÿ\"'“‘])", "", l)

        l = l.strip()
        if l:
            clean_lines.append(l)

    return "\n".join(clean_lines).strip()


SUPPORT_PATTERNS = [
    # 1. Padrão Instrução Fundatec: "Instrução: As questões de números 01 a 18 referem-se ao texto abaixo..."
    (
        re.compile(
            r"(?:^|\n)\s*Instru[çc\ufffd][ãa\ufffd]o:\s*As\s+quest[oõ\ufffd]es\s+(?:de\s+)?(?:n[uú\ufffd]meros\s+)?0?(\d{1,3})\s*(?:[aàe\ufffd]|\bat[eé\ufffd]\b)\s*0?(\d{1,3})\s*referem-se\s+ao\s+texto\s+abaixo.*?\n(.*?)(?=(?:\n\s*QUEST[AÃ\ufffd][O0\ufffd]\s*[:.\-]?\s*0?\d+\b|\Z))",
            re.IGNORECASE | re.DOTALL,
        ),
        lambda m: (int(m.group(1)), int(m.group(2)), m.group(3))
    ),
    # 2. Padrão Base/Referência: "O texto seguinte servirá de base para responder às questões X a Y"
    (
        re.compile(
            r"(?:^|\n)\s*(?:O\s+texto\s+(?:seguinte|abaixo)\s+servir[aá\ufffd]\s+de\s+base\s+para\s+responder\s+[aà\ufffd]s?\s+|Leia\s+(?:atentamente\s+)?o\s+texto\s+(?:a\s+seguir\s+|abaixo\s+)?(?:e\s+responda|para\s+responder)\s+[aà\ufffd]s?\s+|Com\s+base\s+no\s+texto\s+(?:a\s+seguir\s+|abaixo\s+)?,?\s*responda\s+[aà\ufffd]s?\s+|Considere\s+o\s+texto\s+(?:a\s+seguir\s+|abaixo\s+)?para\s+responder\s+[aà\ufffd]s?\s+|Texto\s+para\s+as\s+quest[oõ\ufffd]es\s+)(?:quest[ãa\ufffd]o|quest[oõ\ufffd]es)?\s*(?:de\s+)?0?(\d{1,3})\s*(?:(?:[aàe\ufffd]|\bat[eé\ufffd]\b)\s*0?(\d{1,3}))?[^\n]*\n(.*?)(?=(?:\n\s*QUEST[AÃ\ufffd][O0\ufffd]\s*[:.\-]?\s*0?\d+\b|\Z))",
            re.IGNORECASE | re.DOTALL,
        ),
        lambda m: (int(m.group(1)), int(m.group(2)) if m.group(2) else int(m.group(1)), m.group(3))
    ),
]


def detect_exam_metadata_from_cover(doc_pdf: pymupdf.Document, p_start: int = 1) -> Dict[str, str]:
    """Detecta metadados essenciais (código de cargo e tipo de caderno de prova) a partir da capa."""
    meta = {}
    if not doc_pdf or len(doc_pdf) < p_start:
        return meta

    cover_text = doc_pdf[p_start - 1].get_text()

    # 1. Detectar código de cargo: "512 – AUDITOR", "13 – AUDITOR", "CÓDIGO: 13", "CÓD. 01"
    cargo_keywords = "AUDITOR|FISCAL|AGENTE|ANALISTA|TECNICO|CONTADOR|PROCURADOR|MOTORISTA|ENGENHEIRO|MEDICO|INSPETOR|ADVOGADO|OFICIAL|ESCRITURARIO|AUXILIAR|CONSULTOR|DELEGADO|ADMINISTRADOR|ECONOMISTA|PROFESSOR|GUARDA"
    code_match = re.search(r"(?:C[OÓ]DIGO|C[OÓ]D\.?)\s*[:.\-]?\s*(\d{1,4})\b", cover_text, re.IGNORECASE)
    if not code_match:
        code_match = re.search(r"(?:^|\n)\s*(\d{1,4})\s*[\-\–\—\.\u2013\u2014\ufffd]\s*(?:" + cargo_keywords + r")", cover_text, re.IGNORECASE)
    if code_match:
        meta["cargo_codigo"] = code_match.group(1).lstrip("0") or "0"

    # 2. Detectar tipo de prova / caderno: "PROVA 01", "PROVA 1", "TIPO 1", "TIPO A", "CADERNO 01", "PROVA BRANCA"
    prova_match = re.search(
        r"\b((?:PROVA|TIPO|CADERNO)\s*(?:0?[1-9]|[A-E]|BRANCA|VERDE|AMARELA|AZUL|CINZA|ROSA))\b",
        cover_text,
        re.IGNORECASE,
    )
    if prova_match:
        meta["tipo_prova"] = prova_match.group(1).upper()

    return meta


def parse_answers_from_block(text: str) -> Dict[int, str]:
    """Extrai gabarito de um bloco de texto cobrindo grades horizontais, colunas alternadas e pares em linha."""
    tokens = [t.strip() for t in text.split() if t.strip()]

    # 1. Grade horizontal: sequência de números (ex: 1 a 10) seguida de sequência de letras
    i = 0
    grid_answers = {}
    while i < len(tokens):
        if tokens[i].isdigit() and (1 <= int(tokens[i]) <= 200):
            nums = [int(tokens[i])]
            j = i + 1
            while j < len(tokens) and tokens[j].isdigit() and int(tokens[j]) == nums[-1] + 1:
                nums.append(int(tokens[j]))
                j += 1
            if len(nums) >= 4:
                k = j
                # Pula tokens de preenchimento '0' comuns em tabelas Cebraspe
                while k < len(tokens) and tokens[k] == "0":
                    k += 1
                letters = []
                while k < len(tokens) and (tokens[k].upper() in ["A", "B", "C", "D", "E", "X", "ANULADA", "*", "-", "CERTO", "ERRADO"]):
                    letters.append(tokens[k].upper())
                    k += 1
                if len(nums) == len(letters):
                    for n, l in zip(nums, letters):
                        grid_answers[n] = "ANULADA" if l in ["ANULADA", "X", "*", "-"] else l
                    i = k
                    continue
        i += 1
    if len(grid_answers) >= 15:
        return grid_answers

    # 2. Linhas alternadas: número em uma linha, letra na linha imediatamente seguinte
    alt_matches = re.findall(r"(?:^|\n)\s*(\d{1,3})\s*\n\s*([A-E]|ANULADA|X|\*)\s*(?=\n|$)", text, re.IGNORECASE)
    alt_answers = {}
    if alt_matches:
        from collections import defaultdict
        by_q = defaultdict(list)
        for num_str, opt in alt_matches:
            num = int(num_str)
            if 1 <= num <= 200:
                val = opt.upper()
                by_q[num].append("ANULADA" if val in ["ANULADA", "X", "*"] else val)
        if by_q:
            for q_num, opts in by_q.items():
                alt_answers[q_num] = opts[0]
            if len(alt_answers) >= 15:
                return alt_answers

    # 3. Pares em linha: '1 D', '1 - D', '1: D', '1 | D', '01. A'
    inline_matches = re.findall(r"(?:^|\n|\s)(\d{1,3})\s*[:\-\|\.\s]\s*([A-E]|ANULADA|X|\*)\b", text, re.IGNORECASE)
    inline_answers = {}
    for num_str, opt in inline_matches:
        num = int(num_str)
        if 1 <= num <= 200:
            val = opt.upper()
            corr = "ANULADA" if val in ["ANULADA", "X", "*"] else val
            if num not in inline_answers:
                inline_answers[num] = corr

    candidates = [grid_answers, alt_answers, inline_answers]
    candidates.sort(key=len, reverse=True)
    return candidates[0]


def score_header_match(header_text: str, target_cargo: str, target_code: Optional[str] = None, target_prova: Optional[str] = None) -> int:
    """Calcula pontuação de aderência entre um cabeçalho de gabarito e o cargo/prova alvo com desempate determinístico."""
    norm_h = normalize_ascii_upper(header_text)
    norm_c = normalize_ascii_upper(target_cargo)
    score = 0

    stops = {"DE", "DA", "DO", "DOS", "DAS", "E", "EM", "PARA", "COM", "A", "O", "AO", "AOS"}
    common_words = {
        "GABARITO", "PRELIMINAR", "DEFINITIVO", "CONCURSO", "PUBLICO", "PREFEITURA",
        "MUNICIPAL", "ESTADUAL", "GOVERNO", "BLOCO", "DIA", "FOLHA", "PAGINA", "PROVAS",
        "OBJETIVAS", "CARGO", "CODIGO", "FUNCAO", "ORGANIZACAO", "FURB", "IBGP", "FGV", "CEBRASPE"
    }
    competing_specialties = {
        "TECNOLOGIA", "INFORMACAO", "TI", "DIREITO", "ADMINISTRACAO", "CONTABILIDADE",
        "CONTABEIS", "ECONOMIA", "OBRAS", "POSTURAS", "AGRONOMO", "AGRONOMIA", "QUIMICO",
        "QUIMICA", "GEOLOGO", "GEOLOGIA", "MEDICO", "MEDICINA", "ENFERMAGEM", "ENFERMEIRO",
        "VIGILANCIA", "SANITARIA", "AMBIENTAL", "MEIO", "AMBIENTE", "FLORESTAL", "CIVIL",
        "ARQUITETO", "ARQUITETURA", "PSICOLOGO", "PEDAGOGO", "PROFESSOR", "EDUCACAO",
        "FISICA", "FARMACEUTICO", "FISIOTERAPEUTA", "NUTRICIONISTA", "ODONTOLOGO", "DENTISTA",
        "VETERINARIO", "MOTORISTA", "OPERADOR", "MECANICO", "ELETRICISTA", "SERVICOS",
        "GERAIS", "AGENTE", "GUARDA", "AUDITORIA", "FISCALIZACAO"
    }

    cargo_tokens = set(t for t in re.split(r"[\s\-_/,\(\)]+", norm_c) if len(t) > 2 and t not in stops)
    header_tokens = set(t for t in re.split(r"[\s\-_/,\(\)]+", norm_h) if len(t) > 2 and t not in stops and t not in common_words)

    # 1. Correspondência de tokens de cargo
    matched = cargo_tokens & header_tokens
    score += len(matched) * 35

    # Bônus se todos os tokens do cargo alvo estão no cabeçalho
    if cargo_tokens and cargo_tokens.issubset(header_tokens):
        score += 100

    # Penalidade por tokens do cargo alvo ausentes no cabeçalho
    for m in (cargo_tokens - header_tokens):
        score -= 40

    # Penalidade por especialidades conflitantes no cabeçalho não presentes no cargo alvo
    for e in (header_tokens - cargo_tokens):
        if e in competing_specialties:
            score -= 60

    # 2. Correspondência exata de código de cargo (ex: '512', '13')
    if target_code:
        if re.search(r"(?:^|\D)" + re.escape(target_code) + r"(?:\D|$)", norm_h):
            score += 150
        elif re.search(r"(?:CARGO|CODIGO|COD)\s*[:\-]?\s*(\d+)", norm_h):
            score -= 100

    # 3. Correspondência de tipo de prova / caderno (ex: 'TIPO A', 'PROVA 01')
    if target_prova:
        norm_p = normalize_ascii_upper(target_prova)
        if norm_p in norm_h:
            score += 60
        elif "PROVA" in norm_h or "TIPO" in norm_h:
            score -= 30

    return score


def extract_targeted_answer_key(
    doc_pdf: pymupdf.Document,
    g_start: int,
    g_end: int,
    target_cargo: str = "",
    target_code: Optional[str] = None,
    target_prova: Optional[str] = None,
) -> Tuple[Dict[int, str], str]:
    """Segmenta o gabarito oficial em blocos por cargo e extrai exclusivamente o gabarito do cargo correto."""
    full_text = ""
    pages_blocks = []
    cargo_keywords = [
        "AUDITOR", "FISCAL", "AGENTE", "ANALISTA", "TECNICO", "CONTADOR", "PROCURADOR",
        "ENGENHEIRO", "MEDICO", "INSPETOR", "ADVOGADO", "OFICIAL", "ESCRITURARIO", "AUXILIAR",
        "CONSULTOR", "DELEGADO", "ADMINISTRADOR", "ECONOMISTA", "TECNOLOGIA", "INFORMATICA",
        "VIGILANCIA", "OBRAS", "POSTURAS", "GUARDA", "TRIBUTOS", "RECEITA"
    ]
    generic_headers = {
        "QUESTAO", "GABARITO", "GABARITO OFICIAL", "GABARITO PRELIMINAR", "GABARITO DEFINITIVO",
        "CONHECIMENTOS GERAIS", "CONHECIMENTOS ESPECIFICOS", "RESPOSTA", "ITEM", "PROVAS OBJETIVAS"
    }

    for idx in range(max(0, g_start - 1), min(len(doc_pdf), g_end)):
        p_text = doc_pdf[idx].get_text()
        full_text += p_text + "\n"

        lines = [l.strip() for l in p_text.splitlines() if l.strip()]
        clean_lines = [l for l in lines if not l.startswith("pcimarkpci") and "pciconcursos" not in l]

        header_indices = []
        for l_idx, line in enumerate(clean_lines):
            norm_l = normalize_ascii_upper(line)
            words = norm_l.split()
            if (
                norm_l in generic_headers
                or (words and all(w in ["QUESTAO", "GABARITO", "RESPOSTA", "ITEM", "CADERNO", "PROVA", "TIPO", "OFICIAL", "PRELIMINAR", "DEFINITIVO"] for w in words))
                or any(w in ["ANULADA", "NULA", "CANCELADA", "REVOGADA", "DESERTA"] for w in words)
                or line.isdigit()
                or len(line) < 3
            ):
                continue
            if "PAGINA " in norm_l:
                continue

            # Ignorar linhas de continuação iniciadas por preposição / conjunção
            if re.match(r"^(?:DA|DE|DO|DAS|DOS|E|EM|PARA)\b", norm_l):
                continue
            # Ignorar cabeçalhos institucionais e preâmbulos que não iniciam com CARGO/CÓDIGO
            if re.search(r"\b(?:PREFEITURA|SECRETARIA|GOVERNO|MINISTERIO|CONCURSO)\b", norm_l) and not re.match(r"^(?:CARGO|CODIGO|COD)\b", norm_l):
                continue
            if re.search(r"\bPROCURADORIA\b", norm_l) and not re.search(r"\b(?:CARGO|ANALISTA|TECNICO|ASSESSOR)\b", norm_l):
                continue
            # Ignorar códigos internos de caderno (ex: 968_PREF_MOSSORO_...)
            if re.match(r"^\d+_[A-Z0-9_]+$", norm_l):
                continue

            is_header = False
            # Padrão numérico: '13 - AUDITOR...' ou '13 AUDITOR...' (com cargo de pelo menos 3 letras)
            if re.match(r"^\d{1,3}\s*[\-\–\—\.]?\s*[A-Z]{3,}", norm_l):
                is_header = True
            elif re.match(r"^(?:CARGO|CODIGO|COD|FUNCAO|VAGA|ESPECIALIDADE)\b", norm_l):
                is_header = True
            elif re.search(r"\bCONHECIMENTOS\s+(?:B[AÁ]SICOS|GERAIS)\b", norm_l):
                is_header = True
            elif any(k in norm_l for k in cargo_keywords):
                if len(line) < 180 and not line.isdigit() and not re.match(r"^\d{1,3}\s*[:\-\|\.]\s*[A-E]\b", norm_l):
                    is_header = True

            if is_header:
                header_indices.append(l_idx)

        # Checar se página possui colunas intercaladas (ex: IBGP com 3 colunas)
        alt_matches = re.findall(r"(?:^|\n)\s*(\d{1,3})\s*\n\s*([A-E]|ANULADA|X|\*)\s*(?=\n|$)", p_text, re.IGNORECASE)
        from collections import defaultdict
        by_q = defaultdict(list)
        for num_str, opt in alt_matches:
            num = int(num_str)
            if 1 <= num <= 200:
                val = opt.upper()
                by_q[num].append("ANULADA" if val in ["ANULADA", "X", "*"] else val)
        max_cols = max((len(v) for v in by_q.values()), default=0)

        if max_cols > 1 and len(by_q) >= 15:
            col_headers = [clean_lines[h] for h in header_indices] if header_indices else []
            for col_idx in range(max_cols):
                col_ans = {q: opts[col_idx] for q, opts in by_q.items() if col_idx < len(opts)}
                h_text = col_headers[col_idx] if col_idx < len(col_headers) else f"Coluna {col_idx + 1}"
                pages_blocks.append((h_text, col_ans, idx + 1, clean_lines))
            continue

        p_full_ans = parse_answers_from_block(p_text)
        if not header_indices:
            header_text = " ".join(clean_lines[:6])
            pages_blocks.append((header_text, p_full_ans, idx + 1, clean_lines))
        else:
            sliced_blocks = []
            for i, h_idx in enumerate(header_indices):
                next_h = header_indices[i + 1] if i + 1 < len(header_indices) else len(clean_lines)
                header_text = clean_lines[h_idx]
                if h_idx + 1 < len(clean_lines) and any(k in clean_lines[h_idx + 1].upper() for k in ["PROVA", "TIPO", "MANHA", "TARDE", "ESPECIALIDADE"]):
                    header_text += " " + clean_lines[h_idx + 1]
                block_txt = "\n".join(clean_lines[h_idx:next_h])
                sliced_ans = parse_answers_from_block(block_txt)
                sliced_blocks.append((header_text, sliced_ans, idx + 1, clean_lines[h_idx:next_h]))

            # Se algum bloco fatiado possui respostas, preserva fatiamento multi-cargo
            if any(len(sb[1]) > 0 for sb in sliced_blocks):
                pages_blocks.extend(sliced_blocks)
            else:
                # Caso CEBRASPE: cabeçalho posicionado no rodapé da página
                best_h_text = clean_lines[header_indices[-1]]
                pages_blocks.append((best_h_text, p_full_ans, idx + 1, clean_lines))

    # Detectar status oficial
    upper_txt = full_text.upper()
    status = "DEFINITIVO"
    if "PRELIMINAR" in upper_txt:
        status = "PRELIMINAR"
    elif "RETIF" in upper_txt:
        status = "RETIFICADO"

    scored_candidates = []
    for h_txt, ans, p_num, b_lines in pages_blocks:
        if ans:
            sc = score_header_match(h_txt, target_cargo, target_code, target_prova)
            scored_candidates.append({
                "score": sc,
                "ans_count": len(ans),
                "header": h_txt,
                "answers": ans,
                "page": p_num,
                "lines": b_lines,
            })

    if not scored_candidates:
        return parse_answers_from_block(full_text), status

    # Prioridade para maior pontuação de cargo; desempate pelo total de questões
    scored_candidates.sort(key=lambda x: (x["score"], x["ans_count"]), reverse=True)
    best = scored_candidates[0]
    final_answers = dict(best["answers"])

    # Identificar código numérico do cargo
    cargo_num = None
    if target_code and str(target_code).isdigit():
        cargo_num = int(target_code)
    else:
        cm = re.search(r"cargo\s*[:\s]*(\d+)", best["header"], re.I)
        if cm:
            cargo_num = int(cm.group(1))

    # CASO A: Faltam questões básicas no início (ex: bloco específico começa em 51 ou 61)
    min_q = min(final_answers.keys()) if final_answers else 1
    if min_q > 1:
        missing_end = min_q - 1
        basic_candidates = []
        for c in scored_candidates:
            if c == best:
                continue
            c_ans = c["answers"]
            if min(c_ans.keys()) <= 1 and max(c_ans.keys()) >= missing_end:
                b_sc = 0
                for l in c["lines"]:
                    norm_l = normalize_ascii_upper(l)
                    if "CONHECIMENTOS BASICOS" in norm_l or "CONHECIMENTOS GERAIS" in norm_l:
                        b_sc = max(b_sc, 50)
                        if cargo_num is not None:
                            rm = re.search(r"(?:CARGOS?|C[OÓ]DIGOS?)\s*(\d+)\s*(?:A|AO|AT[EÉ]|-)\s*(\d+)", norm_l)
                            if rm:
                                if int(rm.group(1)) <= cargo_num <= int(rm.group(2)):
                                    b_sc += 100
                                else:
                                    b_sc -= 100
                            lm = re.search(r"(?:CARGOS?|C[OÓ]DIGOS?)\s*(\d[\d\s,EE]*)", norm_l)
                            if lm and not rm:
                                nums = [int(n) for n in re.findall(r"\d+", lm.group(1))]
                                if cargo_num in nums:
                                    b_sc += 100
                                else:
                                    b_sc -= 100
                        if "SUPERIOR" in norm_l:
                            b_sc += 60
                    elif score_header_match(l, target_cargo) >= 50:
                        b_sc = max(b_sc, 120)

                basic_candidates.append((b_sc, c))

        basic_candidates.sort(key=lambda x: x[0], reverse=True)
        if basic_candidates and basic_candidates[0][0] > 0:
            for q_num, opt in basic_candidates[0][1]["answers"].items():
                if q_num not in final_answers:
                    final_answers[q_num] = opt

    # CASO B: Blocos complementares do mesmo cargo (ex: SEEC_DF dividido em 1..80 e 81..160)
    for c in scored_candidates:
        if c == best:
            continue
        if c["score"] >= 50:
            for q_num, opt in c["answers"].items():
                if q_num not in final_answers:
                    final_answers[q_num] = opt

    return final_answers, status


def parse_answer_key_universal(doc_pdf: pymupdf.Document, g_start: int, g_end: int) -> Tuple[Dict[int, str], str]:
    """Wrapper retrocompatível para extração universal de gabarito."""
    return extract_targeted_answer_key(doc_pdf, g_start, g_end)


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
            return "FGV"
        return "IBGP"

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
        """Extrai questões estruturadas do intervalo de páginas do caderno de prova, preservando materiais de apoio."""
        metadata = metadata or {}
        pages_text: List[Tuple[int, str]] = []
        skipping_initial_admin_pages = True
        for p_idx in range(max(0, p_start - 1), min(len(doc_pdf), p_end)):
            p_text = doc_pdf[p_idx].get_text()

            # Pula páginas iniciais puramente administrativas (capa, instruções, regras de caneta, folhas de resposta/rascunho)
            if skipping_initial_admin_pages:
                if is_administrative_cover(p_text) or len(p_text.strip()) < 80:
                    continue
                else:
                    skipping_initial_admin_pages = False

            # Ignora folhas de respostas ou rascunhos avulsos ao longo do caderno ou ao final
            if is_answer_sheet_page(p_text) or ("FOLHA DE RASCUNHO" in p_text.upper() and len(p_text.strip().splitlines()) < 15):
                continue

            pages_text.append((p_idx + 1, p_text))

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

        # 0. Pré-extração e isolamento seguro de blocos de textos de apoio
        # Remove os textos de apoio e suas numerações de linhas do full_text ANTES do split de questões,
        # impedindo colisão com números de questões ou incorporação indevida no enunciado da questão.
        for pat, parser in SUPPORT_PATTERNS:
            def _sup_replacer(m):
                q_start, q_end, raw_body = parser(m)
                clean_body = clean_support_text_line_numbers(clean_page_artifacts(raw_body))
                lines = [l for l in clean_body.splitlines() if not any(x in l.upper() for x in ["PCIMARKPCI", "PCICONCURSOS", "WWW."])]
                candidate_lines = [l for l in lines if not re.search(r"citad[oa]s?\s+nas?\s+quest|longo\s+do\s+texto|destaques\s+ao", l, re.I)]
                title = candidate_lines[0] if (candidate_lines and len(candidate_lines[0]) < 70) else f"Texto para as questões {q_start} a {q_end}"

                sm = {
                    "id": str(uuid.uuid4()),
                    "tipo": "TEXTO_BASE",
                    "titulo": title,
                    "conteudo_texto": clean_body,
                    "pagina_inicio": p_start,
                    "pagina_fim": p_end,
                    "applies_to_questions": list(range(q_start, q_end + 1)),
                }
                support_materials.append(sm)
                return "\n" * m.group(0).count("\n")

            full_text = pat.sub(_sup_replacer, full_text)

        # Regex universal para alternativas (A-E e a-e, com parênteses, ponto ou hífen)
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
                # 1. Identifica e extrai textos de apoio na página no formato "Texto [A-Z0-9_-]+"
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
                    clean_bt = clean_support_text_line_numbers(clean_page_artifacts("\n".join(bt_lines))).strip()
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
                elif pages_text and p_num == pages_text[0][0]:
                    # 2. Se for a primeira página e não teve "Texto ...", verifica preâmbulo sob -- CONHECIMENTOS BÁSICOS -- (ex: Mossoró)
                    first_m = item_regex.search(page_text)
                    if first_m:
                        pre_text = page_text[:first_m.start()]
                        split_markers = [
                            "-- CONHECIMENTOS BÁSICOS --", "-- CONHECIMENTOS GERAIS --",
                            "-- CONHECIMENTOS ESPECÍFICOS --", "-- PROVAS OBJETIVAS --",
                            "CONHECIMENTOS BÁSICOS", "CONHECIMENTOS GERAIS",
                            "-- CONHECIMENTOS BSICOS --", "-- CONHECIMENTOS ESPECFICOS --",
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

                # Busca itens na página
                matches = list(item_regex.finditer(page_text))
                for idx, m in enumerate(matches):
                    num = int(m.group(1))
                    start_pos = m.end()
                    end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(page_text)
                    chunk = page_text[start_pos:end_pos].strip()

                    if len(chunk) < 12 or is_instruction_item(chunk):
                        continue

                    # Se o chunk antes do primeiro item da página possuir comando
                    if idx == 0:
                        pre_chunk = page_text[:m.start()]
                        pre_cmd_m = cmd_pattern.search(pre_chunk)
                        if pre_cmd_m:
                            current_cmd = pre_cmd_m.group(0).strip()

                    # Separação de justificativa e gabarito comentados
                    stmt, just, corr = extract_inline_justification(chunk)

                    # Trata trailing command se existir após a justificativa
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

                    # Monta enunciado com comando propagado (para autonomia completa da questão)
                    clean_stmt = clean_page_artifacts(stmt)
                    if current_cmd and not clean_stmt.startswith(current_cmd[:20]):
                        final_stmt = f"{current_cmd}\n\n{clean_stmt}"
                    else:
                        final_stmt = clean_stmt

                    # Atualiza current_cmd para as próximas questões se trailing possuir novo comando
                    if trailing:
                        cmd_m = cmd_pattern.search(trailing)
                        if cmd_m:
                            current_cmd = cmd_m.group(0).strip()
                        if any(h in trailing.upper() for h in ["CONTABILIDADE", "DIREITO", "AUDITORIA"]):
                            current_support_material = None

                    # Vincula material de apoio se ativo
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

        elif strategy == "FGV":
            # Formato FGV / FCC: numeração isolada em linha ('1', '2', ..., '70')
            q_blocks = re.split(r"(?:^|\n)\s*(\d{1,3})\s*\n", full_text)
            if len(q_blocks) > 1:
                pre_text = q_blocks[0]
                self._extract_preamble_support_material(pre_text, p_start, support_materials)

                for i in range(1, len(q_blocks), 2):
                    num = int(q_blocks[i])
                    body = q_blocks[i + 1]

                    opts_matches = list(opt_pattern.finditer(body))
                    if opts_matches:
                        first_pos = opts_matches[0].start()
                        raw_stmt = clean_page_artifacts(body[:first_pos])
                        opts = [f"({(om.group(1) or om.group(2)).upper()}) {clean_page_artifacts(om.group(3))}" for om in opts_matches]
                    else:
                        raw_stmt = clean_page_artifacts(body)
                        opts = []

                    stmt, just, corr = extract_inline_justification(raw_stmt)
                    stmt = strip_administrative_leak(stmt)
                    if not stmt or is_instruction_item(stmt):
                        continue

                    if opts or (1 <= num <= 100):
                        raw_questions.append({
                            "numero_original": num,
                            "statement": stmt,
                            "options": opts,
                            "disciplina": current_disc,
                            "pages": [p_start],
                            "justificativa": just,
                            "correct_option": corr,
                        })

        else:
            # Padrão IBGP / Tradicional: 'QUESTÃO 01' ou 'Questão 1'
            q_blocks = re.split(
                r"(?:^|\n)\s*QUEST[AÃ][O0]\s*[:.\-]?\s*0?(\d+)\b",
                full_text,
                flags=re.IGNORECASE,
            )
            # Fallback 1: Numeração pontuada '1. ', '01. ' (ex: CETREDE, URCA)
            if len(q_blocks) <= 2:
                q_blocks = re.split(r"(?:^|\n)\s*0?(\d{1,3})\.\s+(?=[A-ZÀ-Ú])", full_text)
            # Fallback 2: Numeração com hífen '1 - ', '01 - '
            if len(q_blocks) <= 2:
                q_blocks = re.split(r"(?:^|\n)\s*0?(\d{1,3})\s*[-–]\s+(?=[A-ZÀ-Ú])", full_text)

            if len(q_blocks) > 1:
                pre_text = q_blocks[0]
                self._extract_preamble_support_material(pre_text, p_start, support_materials)

                for i in range(1, len(q_blocks), 2):
                    num = int(q_blocks[i])
                    body = q_blocks[i + 1]

                    opts_matches = list(opt_pattern.finditer(body))
                    if opts_matches:
                        first_pos = opts_matches[0].start()
                        raw_stmt = clean_page_artifacts(body[:first_pos])
                        opts = [f"{(om.group(1) or om.group(2)).upper()}) {clean_page_artifacts(om.group(3))}" for om in opts_matches]
                    else:
                        raw_stmt = clean_page_artifacts(body)
                        opts = []

                    stmt, just, corr = extract_inline_justification(raw_stmt)
                    stmt = strip_administrative_leak(stmt)
                    if not stmt or is_instruction_item(stmt):
                        continue

                    raw_questions.append({
                        "numero_original": num,
                        "statement": stmt,
                        "options": opts,
                        "disciplina": current_disc,
                        "pages": [p_start],
                        "justificativa": just,
                        "correct_option": corr,
                    })

        # 2. Extração de textos de apoio internos ("Texto para as questões de X a Y")
        inline_patterns = [
            r"(?:(?:Texto|Instru[cç][aã]o|Considere o texto|Leia o texto)[^\n]*para responder [aà]s quest[oõ]es (?:de )?(\d+) (?:a|e) (\d+)\.?\s*\n)(.*?)(?=\n\s*(?:QUEST[AÃ]O|\d{1,2}\b))",
            r"(?:(Texto\s+[I|V|X\d]+[^\n]*)\n)(.*?)(?=\n\s*(?:QUEST[AÃ]O|\d{1,2}\b))",
        ]
        for pat in inline_patterns:
            for m in re.finditer(pat, full_text, re.IGNORECASE | re.DOTALL):
                body = m.group(0).strip()
                if len(body) >= 80 and not is_administrative_cover(body) and not is_answer_sheet_page(body):
                    start_q = None
                    end_q = None
                    try:
                        start_q = int(m.group(1))
                        end_q = int(m.group(2))
                    except (IndexError, ValueError, TypeError):
                        pass

                    applies_to = list(range(start_q, end_q + 1)) if start_q and end_q else []
                    title = "Texto de Apoio"
                    if start_q and end_q:
                        title = f"Texto para as questões {start_q} a {end_q}"

                    support_materials.append({
                        "id": str(uuid.uuid4()),
                        "tipo": "TEXTO_BASE",
                        "titulo": title,
                        "conteudo_texto": clean_page_artifacts(body),
                        "pagina_inicio": p_start,
                        "pagina_fim": p_end,
                        "applies_to_questions": applies_to,
                    })

        # Deduplicação por número de questão (preservando o item mais completo e com alternativas/justificativa)
        seen = {}
        for q in raw_questions:
            n = q["numero_original"]
            if n not in seen:
                seen[n] = q
            else:
                existing = seen[n]
                # Se o novo item tem alternativas e o existente não tem, prefere o novo (impede que texto de apoio engula questão real)
                if len(q.get("options", [])) > len(existing.get("options", [])):
                    seen[n] = q
                elif len(existing.get("options", [])) > len(q.get("options", [])):
                    continue
                # Se o novo item tem justificativa e o anterior não, substitui
                elif q.get("justificativa") and not existing.get("justificativa"):
                    seen[n] = q
                elif len(q.get("statement", "")) > len(existing.get("statement", "")) and not existing.get("justificativa"):
                    seen[n] = q

        unique_questions = sorted(seen.values(), key=lambda x: x["numero_original"])

        cleaned_unique_questions = []
        for q in unique_questions:
            # Limpa vazamento administrativo residual e numerações de margem
            if q.get("statement"):
                q["statement"] = strip_administrative_leak(q["statement"])
                q["statement"] = re.sub(r"^\s*0?\d{1,2}\s{2,}", "", q["statement"]).strip()
                q["statement"] = re.sub(r"^\s*0\d\s+", "", q["statement"]).strip()

            if not q.get("statement") or is_instruction_item(q["statement"]):
                continue

            cleaned_unique_questions.append(q)

        unique_questions = cleaned_unique_questions

        # Vinculação final de suporte (incorpora texto_apoio diretamente na questão para autonomia completa)
        for q in unique_questions:
            if not q.get("texto_apoio"):
                num = q["numero_original"]
                for sm in support_materials:
                    if num in sm.get("applies_to_questions", []):
                        q["texto_apoio"] = sm.get("conteudo_texto")
                        q["texto_apoio_titulo"] = sm.get("titulo")
                        break

        return unique_questions, support_materials

    def _extract_preamble_support_material(self, pre_text: str, p_start: int, support_materials: List[Dict[str, Any]]) -> None:
        """Limpa e extrai textos-base longos localizados no preâmbulo antes da Questão 1."""
        if not pre_text or len(pre_text) < 200:
            return

        # Descarta se for página ou bloco de instruções gerais ou folha de respostas
        if is_administrative_cover(pre_text) or is_answer_sheet_page(pre_text):
            return

        clean_lines = []
        skip_headers = [
            "PCIMARKPCI", "PCICONCURSOS", "WWW.PCICONCURSOS.COM.BR", "PREFEITURA MUNICIPAL", "INSTITUTO",
            "PROVA DE CONHECIMENTOS", "PROVA 0", "PROVA 1", "CADERNO DE PROVA",
            "TEL:", "CEP:", "CNPJ:", "AV.", "RUA ", "CONCURSO PUBLICO",
            "LEIA ATENTAMENTE", "INSTRUÇÕES", "ORIENTAÇÕES", "FOLHA DE RESPOSTA",
        ]

        for line in pre_text.splitlines():
            l = line.strip()
            if not l:
                continue
            norm_l = normalize_ascii_upper(l)
            if any(h in norm_l for h in skip_headers):
                continue
            if re.match(r"^\d+$", l) or "____" in l:
                continue
            clean_lines.append(l)

        raw_clean = clean_page_artifacts("\n".join(clean_lines)).strip()
        clean_text = clean_support_text_line_numbers(raw_clean)
        clean_text = strip_administrative_leak(clean_text)

        if len(clean_text) >= 150 and not is_administrative_cover(clean_text):
            candidate_lines = [l for l in clean_text.splitlines() if len(l) < 70 and not any(h in normalize_ascii_upper(l) for h in skip_headers)]
            title = candidate_lines[0] if candidate_lines else "Texto de Apoio Inicial"

            # Detecta se há menção a escopo de questões no preâmbulo
            applies = list(range(1, 11))
            m_scope = re.search(r"quest[oõ\ufffd]es\s+(?:de\s+)?0?(\d+)\s*(?:[aàe\ufffd]|\bat[eé\ufffd]\b)\s*0?(\d+)", pre_text, re.I)
            if m_scope:
                applies = list(range(int(m_scope.group(1)), int(m_scope.group(2)) + 1))

            support_materials.append({
                "id": str(uuid.uuid4()),
                "tipo": "TEXTO_BASE",
                "titulo": title,
                "conteudo_texto": clean_text,
                "pagina_inicio": p_start,
                "pagina_fim": p_start + 1,
                "applies_to_questions": applies,
            })
