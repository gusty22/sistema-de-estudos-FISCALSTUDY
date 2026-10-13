"""Segmentacao de questoes objetivas a partir de linhas em ordem de leitura.

Regras genericas (sem excecoes por numero de questao):
  * "QUESTAO N" abre uma questao; a numeracao e verificada em sequencia.
  * Cabecalhos de secao (caixa alta, fonte maior) definem a disciplina e nunca
    sao anexados a alternativas.
  * "Instrucao:" abre um texto de apoio compartilhado; ele e guardado como
    contexto e referenciado pelas questoes do intervalo, nunca colado em
    alternativas.
  * Marcadores de alternativa sao tokens "X)" no inicio da linha ou apos um vao
    horizontal largo (grade 2x2: "A) ... C) ..." / "B) ... D) ..."). Ruido de
    manuscrito colado ao marcador ("OA)", "dD)") e tolerado.
  * Lancamentos contabeis ("D - Conta ... R$ valor") preservam quebra de linha.
"""
from __future__ import annotations

import re
import statistics
import unicodedata

QUESTION_RE = re.compile(r"^\W*QUEST[AÃ][O0]\s*[:.\-]?\s*(\S+)", re.IGNORECASE)
INSTRUCTION_RE = re.compile(r"^\W*Instru[cç][aã]o\s*:", re.IGNORECASE)
MARKER_RE = re.compile(r"^[^\w(]{0,2}[a-zO0]?[^\w(]?([A-E])\)$")
ACCOUNTING_ENTRY_RE = re.compile(r"^[DC]\s*[—–\-]\s")
ITEM_START_RE = re.compile(r"^(\(\s*\S{0,3}\s*\)|\(|•|[IVX]+\s*[—–\-)]|[a-e]\)\s)")
CURRENCY_RE = re.compile(r"^\d{1,3}(\.\d{3})*,\d{2}[.,;)]?$")

INCOMPLETE_FLAGS = {
    "STATEMENT_EMPTY", "OPTIONS_MISSING", "OPTIONS_DUPLICATE", "OPTION_EMPTY",
    "OPTION_TOO_LONG", "CONTAMINATION",
}
REVIEW_FLAGS = {"SUSPICIOUS_TOKENS", "OPTION_MARKER_INFERRED", "NUMBER_SEQUENCE", "CONTEXT_RANGE_NORMALIZED"}


def _norm_digits(token: str) -> str:
    table = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1"})
    return token.translate(table).strip(".,;:")


def parse_question_number(token: str) -> int | None:
    t = _norm_digits(token)
    return int(t) if t.isdigit() else None


def _is_section_header(line, body_h: float) -> bool:
    text = line.text
    if QUESTION_RE.match(text) or len(text) < 6:
        return False
    letters = [c for c in text if c.isalpha()]
    if not letters or any(c.islower() for c in letters) or any(c.isdigit() for c in text):
        return False
    return line.height >= 1.2 * body_h


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _markers(line) -> list[tuple[int, str]]:
    """Indices de palavras que iniciam alternativas e a letra correspondente."""
    found = []
    gap_min = 1.5 * line.height
    for i, w in enumerate(line.words):
        m = MARKER_RE.match(w["t"])
        if not m:
            continue
        if i == 0:
            found.append((i, m.group(1)))
            continue
        prev = line.words[i - 1]
        if w["x"] - (prev["x"] + prev["w"]) >= gap_min:
            found.append((i, m.group(1)))
    return found


def _join_option_lines(parts: list[str]) -> str:
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if not out:
            out = p
        elif ACCOUNTING_ENTRY_RE.match(p):
            out += "\n" + p
        else:
            out += " " + p
    return re.sub(r"[ \t]+", " ", out).strip()


def _reflow(lines: list[dict]) -> str:
    """Reune linhas em paragrafos usando itens e espacamento vertical."""
    if not lines:
        return ""
    pitches = [b["y0"] - a["y0"] for a, b in zip(lines, lines[1:]) if 0 < b["y0"] - a["y0"]]
    typical = statistics.median(pitches) if pitches else 0
    paras = [lines[0]["text"]]
    for prev, cur in zip(lines, lines[1:]):
        gap = cur["y0"] - prev["y0"]
        new_para = bool(ITEM_START_RE.match(cur["text"])) or (typical and gap > 1.45 * typical) or gap < 0
        if new_para:
            paras.append(cur["text"])
        else:
            paras[-1] += " " + cur["text"]
    return "\n".join(re.sub(r"[ \t]+", " ", p).strip() for p in paras)


def suspicious_tokens(text: str) -> list[str]:
    """Tokens com padroes improvaveis em texto impresso (tipico de rasura/manuscrito)."""
    out = []
    tokens = text.split()
    for i, raw in enumerate(tokens):
        tok = raw.strip(",.;:!?\"'“”‘’()[]")
        if not tok or "http" in tok or "www" in tok:
            continue
        bad = (
            re.search(r"[a-zà-ÿ][A-ZÀ-Þ]", tok)
            or (re.search(r"[A-Za-zÀ-ÿ]\d|\d[A-Za-zÀ-ÿ]", tok) and not re.fullmatch(r"[A-Z]{1,4}\d{1,4}|\d+(º|ª|°|%)", tok))
            or re.search(r"[\wÀ-ÿ][;|}{\[\]\\][\wÀ-ÿ]", tok)
            or re.search(r"[A-Za-zÀ-ÿ]:[A-Za-zÀ-ÿ]", tok)
        )
        if not bad and i > 0 and tokens[i - 1] == "R$" and not CURRENCY_RE.match(raw):
            bad = True
        if bad:
            out.append(raw)
    return out


def parse_questions(lines: list, section_names: dict | None = None) -> dict:
    """Converte linhas (scanned_layout.Line) em questoes, contextos e diagnostico."""
    section_names = section_names or {}
    questions: list[dict] = []
    contexts: list[dict] = []
    unassigned: list[dict] = []
    sections: list[dict] = []
    current_section = None
    q = None
    ctx = None
    mode = None  # "question" | "context" | None

    def finish():
        if q is not None:
            questions.append(q)

    for ln in lines:
        body_h = ln.meta.get("body_h", ln.height)
        text = ln.text
        if not text:
            continue
        qm = QUESTION_RE.match(text)
        if qm:
            finish()
            num = parse_question_number(qm.group(1))
            q = {
                "numero_original": num,
                "numero_ocr": qm.group(1),
                "section": current_section,
                "statement_lines": [],
                "options": [],
                "pages": [ln.page],
                "flags": [],
            }
            tail = " ".join(w["t"] for w in ln.words[2:]) if len(ln.words) > 2 else ""
            if tail:
                q["statement_lines"].append({"text": tail, "y0": ln.y0, "x0": ln.x0})
            mode = "question"
            continue
        if _is_section_header(ln, body_h):
            key = _strip_accents(text).upper()
            current_section = section_names.get(key, text.title())
            sections.append({"raw": text, "name": current_section, "page": ln.page})
            finish()
            q, mode = None, None
            continue
        if INSTRUCTION_RE.match(text):
            finish()
            q = None
            ctx = {"raw_lines": [], "pages": [ln.page], "section": current_section}
            contexts.append(ctx)
            ctx["raw_lines"].append({"text": text, "y0": ln.y0, "x0": ln.x0, "page": ln.page})
            mode = "context"
            continue
        if mode == "context":
            ctx["raw_lines"].append({"text": text, "y0": ln.y0, "x0": ln.x0, "page": ln.page})
            if ln.page not in ctx["pages"]:
                ctx["pages"].append(ln.page)
            continue
        if mode != "question" or q is None:
            unassigned.append({"page": ln.page, "text": text})
            continue

        if ln.page not in q["pages"]:
            q["pages"].append(ln.page)
        marks = _markers(ln)
        if marks:
            if marks[0][0] > 0:
                pre = " ".join(w["t"] for w in ln.words[: marks[0][0]])
                if q["options"]:
                    q["options"][-1]["parts"].append(pre)
                else:
                    q["statement_lines"].append({"text": pre, "y0": ln.y0, "x0": ln.x0})
            for k, (idx, letter) in enumerate(marks):
                end = marks[k + 1][0] if k + 1 < len(marks) else len(ln.words)
                body = " ".join(w["t"] for w in ln.words[idx + 1:end])
                q["options"].append({
                    "letter": letter,
                    "parts": [body],
                    "y0": ln.y0,
                    "text_x0": ln.words[idx + 1]["x"] if idx + 1 < end else ln.words[idx]["x"],
                    "continuations": [],
                })
            continue
        if q["options"]:
            opt = q["options"][-1]
            opt["parts"].append(text)
            opt["continuations"].append({"text": text, "y0": ln.y0, "x0": ln.x0, "part_index": len(opt["parts"]) - 1})
        else:
            q["statement_lines"].append({"text": text, "y0": ln.y0, "x0": ln.x0})
    finish()
    return {"questions": questions, "contexts": contexts, "unassigned": unassigned, "sections": sections}


def infer_single_missing_marker(q: dict, expected: list[str]) -> None:
    """Recupera um marcador ilegivel quando ha evidencia estrutural forte.

    Condicoes: falta exatamente uma letra M; a alternativa anterior P termina
    em pontuacao final e possui uma linha de continuacao iniciada por
    maiuscula/digito/aspas, posicionada antes da alternativa seguinte. O texto
    nao e alterado; apenas o rotulo e atribuido, com flag de revisao.
    """
    letters = [o["letter"] for o in q["options"]]
    missing = [l for l in expected if l not in letters]
    if len(missing) != 1 or missing[0] == expected[0]:
        return
    m = missing[0]
    prev_letter = expected[expected.index(m) - 1]
    nxt = expected[expected.index(m) + 1] if expected.index(m) + 1 < len(expected) else None
    prev = next((o for o in q["options"] if o["letter"] == prev_letter), None)
    nxt_opt = next((o for o in q["options"] if o["letter"] == nxt), None) if nxt else None
    if prev is None or not prev["continuations"]:
        return
    cont = prev["continuations"][0]
    before_cont = _join_option_lines(prev["parts"][: cont["part_index"]])
    if not re.search(r"[.?!]$", before_cont):
        return
    if not re.match(r"^[\"“A-ZÀ-Þ0-9]", cont["text"]):
        return
    if nxt_opt is not None and not (prev["y0"] < cont["y0"] < nxt_opt["y0"]):
        return
    moved = prev["parts"][cont["part_index"]:]
    prev["parts"] = prev["parts"][: cont["part_index"]]
    prev["continuations"] = []
    q["options"].append({"letter": m, "parts": moved, "y0": cont["y0"], "text_x0": cont["x0"], "continuations": []})
    q["flags"].append(f"OPTION_MARKER_INFERRED:{m}")


def finalize_question(q: dict, expected: list[str], max_option_len: int = 400) -> dict:
    infer_single_missing_marker(q, expected)
    statement = _reflow(q["statement_lines"])
    by_letter: dict = {}
    for o in q["options"]:
        if o["letter"] in by_letter:
            q["flags"].append(f"OPTIONS_DUPLICATE:{o['letter']}")
            continue
        by_letter[o["letter"]] = _join_option_lines(o["parts"])
    options = [f"{l}) {by_letter[l]}" for l in sorted(by_letter)]

    flags = q["flags"]
    if len(statement) < 15:
        flags.append("STATEMENT_EMPTY")
    missing = [l for l in expected if l not in by_letter]
    if missing:
        flags.append("OPTIONS_MISSING:" + ",".join(missing))
    extra = [l for l in by_letter if l not in expected]
    if extra:
        flags.append("OPTIONS_DUPLICATE:unexpected " + ",".join(extra))
    for l, t in by_letter.items():
        if not t.strip():
            flags.append(f"OPTION_EMPTY:{l}")
        if len(t) > max_option_len:
            flags.append(f"OPTION_TOO_LONG:{l}")
    contamination = re.compile(r"QUEST[AÃ]O\s*\d|Instru[cç][aã]o\s*:|Banca Examinadora", re.IGNORECASE)
    if contamination.search(statement) or any(contamination.search(t) for t in by_letter.values()):
        flags.append("CONTAMINATION")
    sus = suspicious_tokens(statement) + [tok for t in by_letter.values() for tok in suspicious_tokens(t)]
    if sus:
        flags.append("SUSPICIOUS_TOKENS:" + " | ".join(sus))

    kinds = {f.split(":")[0] for f in flags}
    if kinds & INCOMPLETE_FLAGS:
        status = "INCOMPLETE"
    elif kinds & REVIEW_FLAGS:
        status = "NEEDS_REVIEW"
    else:
        status = "VALIDATED"
    return {"statement": statement, "options": options, "extraction_status": status, "extraction_flags": flags}


def resolve_context_range(raw_text: str, total_questions: int) -> tuple[list[int] | None, list[str]]:
    """Extrai o intervalo "questoes X a Y" de um texto de instrucao (com normalizacao OCR)."""
    m = re.search(r"quest\w*\s+(?:de\s+)?(\S+)\s+(?:a|e)\s+(\S+)", raw_text, re.IGNORECASE)
    if not m:
        return None, ["CONTEXT_RANGE_UNPARSED"]
    a_raw, b_raw = _norm_digits(m.group(1)), _norm_digits(m.group(2))
    if not (a_raw.isdigit() and b_raw.isdigit()):
        return None, ["CONTEXT_RANGE_UNPARSED"]
    a, b = int(a_raw), int(b_raw)
    flags = []
    if not (1 <= a <= b <= total_questions):
        # Ponto final lido como "0" ("10." -> "100").
        if b_raw.endswith("0") and b_raw[:-1].isdigit() and a <= int(b_raw[:-1]) <= total_questions:
            b = int(b_raw[:-1])
            flags.append("CONTEXT_RANGE_NORMALIZED")
        else:
            return None, ["CONTEXT_RANGE_UNPARSED"]
    return list(range(a, b + 1)), flags
