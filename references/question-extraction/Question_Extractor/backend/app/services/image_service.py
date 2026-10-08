import os
import logging
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)


class ImageService:
    """Preprocesses images for optimal OCR recognition while preserving originals."""

    @staticmethod
    def preprocess_image(image_path: str, output_path: str) -> str:
        """
        Creates a preprocessed copy of the image:
        - Auto-orients based on EXIF
        - Grayscale conversion
        - Contrast enhancement
        - Slight sharpening / noise reduction
        """
        try:
            with Image.open(image_path) as img:
                # 1. EXIF rotation correction
                img = ImageOps.exif_transpose(img)

                # 2. Convert to grayscale
                gray = img.convert("L")

                # 3. Enhance contrast (factor 1.5)
                enhancer = ImageEnhance.Contrast(gray)
                enhanced = enhancer.enhance(1.5)

                # 4. Enhance sharpness
                sharpener = ImageEnhance.Sharpness(enhanced)
                sharpened = sharpener.enhance(1.3)

                # 5. Median filter for noise reduction
                denoised = sharpened.filter(ImageFilter.MedianFilter(size=3))

                # 6. Save preprocessed copy
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                denoised.save(output_path, "PNG", dpi=(300, 300))
                return output_path
        except Exception as e:
            logger.warning(f"Image preprocessing encountered error: {e}. Using original.")
            return image_path

    @staticmethod
    def detect_and_normalize_orientation(image_path: str, output_path: str) -> str:
        """Corrects orientation using EXIF data without modifying the source image."""
        try:
            with Image.open(image_path) as img:
                oriented = ImageOps.exif_transpose(img)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                oriented.save(output_path)
                return output_path
        except Exception:
            return image_path
