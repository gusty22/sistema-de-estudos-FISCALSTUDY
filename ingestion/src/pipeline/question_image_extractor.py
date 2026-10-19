import re
import uuid
from typing import List, Dict, Any, Optional
import pymupdf
from .image_optimizer import ImageOptimizer

IMAGE_REFERENCING_PATTERNS = re.compile(
    r"\b(?:"
    r"imagem\s+(?:a\s+seguir|abaixo|acima|ao\s+lado)|"
    r"observe\s+a\s+imagem|"
    r"considere\s+a\s+imagem|"
    r"leia\s+a\s+imagem|"
    r"conforme\s+a\s+figura|"
    r"figura\s+(?:a\s+seguir|abaixo|acima|\d+)|"
    r"gr[aá]fico\s+(?:a\s+seguir|abaixo|acima|\d+)|"
    r"tabela\s+(?:a\s+seguir|abaixo|acima|\d+)|"
    r"charge\s+(?:a\s+seguir|abaixo|acima)|"
    r"tirinha\s+(?:a\s+seguir|abaixo|acima)"
    r")\b",
    re.IGNORECASE
)

def extract_question_images(
    doc_pdf: pymupdf.Document,
    questions: List[Dict[str, Any]],
    assets_dir: str,
    p_start: int = 1,
    p_end: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Localiza, otimiza e associa imagens às questões que as referenciam no enunciado.
    Para cada questão que menciona imagem/figura/gráfico/charge:
      - Localiza na(s) página(s) da questão a imagem espacialmente correspondente.
      - Comprime a imagem em WebP (900px max, quality 80) e armazena em assets_dir/{hash}.webp.
      - Retorna lista de materiais de apoio do tipo FIGURA/GRAFICO/TABELA para vincular via staging_support_materials.
    """
    if p_end is None:
        p_end = len(doc_pdf)

    new_support_materials: List[Dict[str, Any]] = []

    # Agrupar questões por página para busca espacial
    # Nota: se a questão não tiver páginas mapeadas, assumimos o span
    for q in questions:
        stmt = q.get("statement", "")
        if not IMAGE_REFERENCING_PATTERNS.search(stmt):
            continue

        q_num = q.get("numero_original")
        pages = q.get("pages") or list(range(p_start, p_end + 1))
        
        found_image = False
        for page_num in pages:
            if page_num < 1 or page_num > len(doc_pdf):
                continue
            
            page = doc_pdf[page_num - 1]
            page_images = page.get_images()
            if not page_images:
                continue

            # Tenta encontrar a posição do texto da questão na página
            q_search_terms = [
                f"QUESTÃO {q_num}",
                f"QUESTAO {q_num}",
                f"QUESTÃO 0{q_num}",
                f"QUESTAO 0{q_num}",
                f"{q_num}.",
                f"0{q_num}."
            ]
            q_rect = None
            for term in q_search_terms:
                rects = page.search_for(term)
                if rects:
                    q_rect = rects[0]
                    break

            # Se temos múltiplos candidatos de imagem na página, selecionamos a mais próxima espacialmente
            best_img_info = None
            min_dist = float("inf")

            for img_info in page_images:
                xref = img_info[0]
                img_rects = page.get_image_rects(xref)
                if not img_rects:
                    continue
                img_rect = img_rects[0]

                # Filtra ícones minúsculos (logos, marcadores < 30px)
                if img_rect.width < 30 or img_rect.height < 30:
                    continue

                if q_rect:
                    # Preferência para imagens que começam após o início da questão
                    # ou imediatamente acima das alternativas
                    vert_dist = img_rect.y0 - q_rect.y0
                    if vert_dist >= -20:  # imagem logo abaixo ou na altura do início
                        dist = vert_dist
                    else:
                        dist = abs(vert_dist) + 1000
                else:
                    dist = 0

                if dist < min_dist:
                    min_dist = dist
                    best_img_info = img_info

            if best_img_info:
                xref = best_img_info[0]
                try:
                    base_img = doc_pdf.extract_image(xref)
                    img_bytes = base_img["image"]

                    # Otimização e deduplicação via ImageOptimizer (WebP econômico)
                    filename, file_size, width, height = ImageOptimizer.save_to_assets_dir(
                        img_bytes, assets_dir
                    )

                    mat_id = str(uuid.uuid4())
                    media_rel_path = f"assets/{filename}"

                    new_support_materials.append({
                        "id": mat_id,
                        "tipo": "FIGURA",
                        "titulo": f"Imagem da Questão {q_num}",
                        "conteudo_texto": None,
                        "media_path": media_rel_path,
                        "pagina_inicio": page_num,
                        "pagina_fim": page_num,
                        "applies_to_questions": [q_num],
                        "coordenadas_json": None
                    })
                    found_image = True
                    break
                except Exception as e:
                    print(f"[ImageExtractor] Erro ao extrair/otimizar imagem xref {xref} na p.{page_num}: {e}")

    return new_support_materials
