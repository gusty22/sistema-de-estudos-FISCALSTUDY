import os
import hashlib
from io import BytesIO
from PIL import Image
from typing import Optional, Tuple

class ImageOptimizer:
    """
    Otimizador e normalizador de imagens de apoio do FiscalStudy.
    - Redimensionamento inteligente proporcional (largura máx 900px, altura máx 900px).
    - Conversão para WebP de alta eficiência (quality 80) ou PNG otimizado se transparência for crítica.
    - Deduplicação de armazenamento por SHA-256.
    - Metadados econômicos para banco de dados.
    """
    MAX_WIDTH = 900
    MAX_HEIGHT = 900
    WEBP_QUALITY = 80

    @classmethod
    def optimize_image_bytes(cls, raw_bytes: bytes) -> Tuple[bytes, str, int, int, str]:
        """
        Recebe bytes brutos de imagem, redimensiona se necessário, converte para WebP econômico
        e retorna: (webp_bytes, sha256_hash, width, height, mime_type).
        """
        img = Image.open(BytesIO(raw_bytes))
        
        # Converte modos incompatíveis (como CMYK ou P) para RGB / RGBA
        if img.mode in ("CMYK", "P", "1"):
            img = img.convert("RGB")
        elif img.mode in ("RGBA", "LA") and "A" in img.getbands():
            # Se tiver transparência, mantém RGBA para webp preservar transparência com compressão
            pass
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Redimensionamento inteligente com filtro LANCZOS
        orig_w, orig_h = img.size
        ratio = min(cls.MAX_WIDTH / float(orig_w), cls.MAX_HEIGHT / float(orig_h), 1.0)
        
        if ratio < 1.0:
            new_w = max(1, int(orig_w * ratio))
            new_h = max(1, int(orig_h * ratio))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        w, h = img.size

        # Salva em WebP comprimido
        out_buf = BytesIO()
        img.save(out_buf, format="WEBP", quality=cls.WEBP_QUALITY, method=6)
        optimized_bytes = out_buf.getvalue()

        # SHA-256 para deduplicação de storage
        sha256_hash = hashlib.sha256(optimized_bytes).hexdigest()
        
        return optimized_bytes, sha256_hash, w, h, "image/webp"

    @classmethod
    def save_to_assets_dir(cls, raw_bytes: bytes, assets_dir: str) -> Tuple[str, int, int, int]:
        """
        Salva imagem otimizada em `assets_dir/{hash}.webp`.
        Retorna: (rel_or_file_name, file_size_bytes, width, height)
        """
        os.makedirs(assets_dir, exist_ok=True)
        opt_bytes, file_hash, w, h, _ = cls.optimize_image_bytes(raw_bytes)
        filename = f"{file_hash}.webp"
        target_path = os.path.join(assets_dir, filename)

        # Se já existir, aproveita o mesmo arquivo (deduplicação)
        if not os.path.exists(target_path):
            with open(target_path, "wb") as f:
                f.write(opt_bytes)

        return filename, len(opt_bytes), w, h
