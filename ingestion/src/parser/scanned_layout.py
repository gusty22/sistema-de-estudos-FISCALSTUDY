"""Reconstrucao de ordem de leitura para provas digitalizadas (OCR por palavra).

Entrada: palavras OCR com caixa delimitadora e indice de linha OCR
({"t", "x", "y", "w", "h", "l"}), como produzido por ocr_extract_words.ps1.

Causas estruturais tratadas aqui (auditoria da prova 503):
  * Linhas de colunas diferentes fundidas por proximidade vertical.
  * Blocos de largura total (textos de apoio) intercalados com blocos em duas
    colunas na mesma pagina; a leitura coluna-a-coluna jogava metade do texto
    de apoio dentro da ultima alternativa da coluna esquerda.
  * Linhas justificadas fragmentadas pelo OCR em varias "linhas" de uma palavra.
  * Anotacoes manuscritas na margem e rabiscos minusculos.
  * Cabecalho e rodape da banca.

Nada aqui e especifico de numero de questao; tudo e decidido por geometria.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field

# Fracoes da altura da pagina tratadas como cabecalho/rodape.
HEADER_BOTTOM_FRACTION = 0.045
FOOTER_TOP_FRACTION = 0.935
# Largura minima (fracao da pagina) para um fragmento ser considerado de largura total.
FULL_WIDTH_MIN_FRACTION = 0.5


@dataclass
class Fragment:
    words: list
    page: int
    zone: str = ""  # "L", "R" ou "F" (largura total)

    @property
    def x0(self) -> int:
        return min(w["x"] for w in self.words)

    @property
    def x1(self) -> int:
        return max(w["x"] + w["w"] for w in self.words)

    @property
    def y0(self) -> int:
        return min(w["y"] for w in self.words)

    @property
    def y1(self) -> int:
        return max(w["y"] + w["h"] for w in self.words)

    @property
    def yc(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def max_h(self) -> int:
        return max(w["h"] for w in self.words)


@dataclass
class Line:
    words: list
    page: int
    zone: str
    meta: dict = field(default_factory=dict)

    def __post_init__(self):
        self.words = sorted(self.words, key=lambda w: w["x"])

    @property
    def x0(self) -> int:
        return self.words[0]["x"]

    @property
    def y0(self) -> int:
        return min(w["y"] for w in self.words)

    @property
    def y1(self) -> int:
        return max(w["y"] + w["h"] for w in self.words)

    @property
    def height(self) -> float:
        return statistics.median(w["h"] for w in self.words)

    @property
    def text(self) -> str:
        return " ".join(w["t"] for w in self.words).strip()


def _fragments(words: list, page: int) -> list[Fragment]:
    groups: dict = {}
    for i, w in enumerate(words):
        key = w.get("l", f"w{i}")
        groups.setdefault(key, []).append(w)
    return [Fragment(sorted(ws, key=lambda w: w["x"]), page) for ws in groups.values()]


def detect_gutter(words: list, width: int) -> int:
    """Coordenada x do vao entre colunas: posicao central menos coberta por palavras."""
    lo, hi = int(width * 0.40), int(width * 0.60)
    best_x, best_cov = width // 2, None
    for x in range(lo, hi + 1, 4):
        cov = sum(1 for w in words if w["x"] <= x <= w["x"] + w["w"])
        if best_cov is None or cov < best_cov or (cov == best_cov and abs(x - width / 2) < abs(best_x - width / 2)):
            best_x, best_cov = x, cov
    return best_x


def _split_at_gutter(frag: Fragment, gutter: int, min_gap: int) -> list[Fragment]:
    if not (frag.x0 < gutter < frag.x1):
        return [frag]
    ws = frag.words
    for a, b in zip(ws, ws[1:]):
        gap_start, gap_end = a["x"] + a["w"], b["x"]
        if gap_start <= gutter <= gap_end and gap_end - gap_start >= min_gap:
            idx = ws.index(b)
            return [Fragment(ws[:idx], frag.page), Fragment(ws[idx:], frag.page)]
    return [frag]


def _column_left_edge(frags: list[Fragment]) -> int | None:
    starts = sorted(f.x0 for f in frags if len(f.words) >= 2)
    if not starts:
        return None
    return starts[max(0, int(len(starts) * 0.10) - 1)]


def _build_lines(frags: list[Fragment], zone: str, page: int) -> list[Line]:
    """Agrupa fragmentos de uma mesma zona em linhas visuais por sobreposicao vertical."""
    lines: list[Line] = []
    cur: list[Fragment] = []
    cur_y0 = cur_y1 = 0
    for f in sorted(frags, key=lambda f: (f.y0, f.x0)):
        if cur:
            overlap = min(cur_y1, f.y1) - max(cur_y0, f.y0)
            ref_h = min(cur_y1 - cur_y0, f.y1 - f.y0)
            if overlap >= 0.5 * ref_h:
                cur.append(f)
                cur_y0, cur_y1 = min(cur_y0, f.y0), max(cur_y1, f.y1)
                continue
            lines.append(Line([w for fr in cur for w in fr.words], page, zone))
        cur, cur_y0, cur_y1 = [f], f.y0, f.y1
    if cur:
        lines.append(Line([w for fr in cur for w in fr.words], page, zone))
    return lines


def page_lines(page: dict) -> tuple[list[Line], dict]:
    """Retorna as linhas de uma pagina em ordem de leitura e um diagnostico."""
    words = page["Words"]
    pnum = page["Page"]
    width = page.get("Width") or max(w["x"] + w["w"] for w in words)
    height = page.get("Height") or max(w["y"] + w["h"] for w in words)
    diag = {"page": pnum, "dropped": []}
    if not words:
        return [], diag

    body_h = statistics.median(w["h"] for w in words)
    gutter = detect_gutter(words, width)
    diag["gutter"] = gutter

    frags: list[Fragment] = []
    for f in _fragments(words, pnum):
        if f.y1 < height * HEADER_BOTTOM_FRACTION or f.y0 > height * FOOTER_TOP_FRACTION:
            diag["dropped"].append(("header_footer", " ".join(w["t"] for w in f.words)))
            continue
        if f.max_h < 0.45 * body_h:
            diag["dropped"].append(("tiny_marks", " ".join(w["t"] for w in f.words)))
            continue
        frags.extend(_split_at_gutter(f, gutter, min_gap=int(1.5 * body_h)))

    for f in frags:
        crosses = f.x0 < gutter - body_h and f.x1 > gutter + body_h
        if crosses and (f.x1 - f.x0) >= FULL_WIDTH_MIN_FRACTION * width:
            f.zone = "F"
        else:
            f.zone = "L" if (f.x0 + f.x1) / 2 < gutter else "R"

    # Anotacoes de margem: fragmentos inteiramente a esquerda da margem do texto.
    for zone in ("L", "R"):
        zf = [f for f in frags if f.zone == zone]
        edge = _column_left_edge(zf)
        if edge is None:
            continue
        for f in zf:
            if f.x1 < edge - 15:
                diag["dropped"].append(("margin_note", " ".join(w["t"] for w in f.words)))
                f.zone = "X"
    frags = [f for f in frags if f.zone != "X"]

    # Segmentos de largura total: fragmentos "F" consecutivos, interrompidos apenas
    # quando existe entre eles uma linha genuinamente em duas colunas.
    full = sorted((f for f in frags if f.zone == "F"), key=lambda f: f.y0)
    cols = [f for f in frags if f.zone in ("L", "R")]

    def two_column_row_between(top: float, bottom: float) -> bool:
        left = [f for f in cols if f.zone == "L" and top < f.yc < bottom]
        right = [f for f in cols if f.zone == "R" and top < f.yc < bottom]
        return any(min(a.y1, b.y1) - max(a.y0, b.y0) > 0 for a in left for b in right)

    segments: list[list[Fragment]] = []
    for f in full:
        if segments and not two_column_row_between(segments[-1][-1].y1, f.y0):
            segments[-1].append(f)
        else:
            segments.append([f])

    tol = 0.6 * body_h
    seg_ranges = []
    for seg in segments:
        top, bottom = min(f.y0 for f in seg), max(f.y1 for f in seg)
        for f in cols:
            if f.zone in ("L", "R") and top - tol <= f.yc <= bottom + tol:
                f.zone = "F"
                seg.append(f)
        seg_ranges.append((top, bottom, seg))
    diag["full_width_segments"] = [(int(t), int(b)) for t, b, _ in seg_ranges]

    # Particiona a pagina em regioes verticais alternando colunas e largura total.
    lines: list[Line] = []
    cursor = -1.0
    remaining = [f for f in frags if f.zone in ("L", "R")]
    for top, bottom, seg in sorted(seg_ranges, key=lambda s: s[0]):
        region = [f for f in remaining if cursor < f.yc < top]
        lines += _build_lines([f for f in region if f.zone == "L"], "L", pnum)
        lines += _build_lines([f for f in region if f.zone == "R"], "R", pnum)
        lines += _build_lines(seg, "F", pnum)
        cursor = bottom
    region = [f for f in remaining if f.yc > cursor]
    lines += _build_lines([f for f in region if f.zone == "L"], "L", pnum)
    lines += _build_lines([f for f in region if f.zone == "R"], "R", pnum)

    for ln in lines:
        ln.meta["body_h"] = body_h
    return lines, diag
