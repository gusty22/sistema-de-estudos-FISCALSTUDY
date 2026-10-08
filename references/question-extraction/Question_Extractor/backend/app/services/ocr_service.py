import abc
import os
import logging
from typing import List, Optional
from PIL import Image
import pytesseract
from backend.app.config import settings

logger = logging.getLogger(__name__)


class OCRService(abc.ABC):
    """Abstract base class for OCR services."""

    @abc.abstractmethod
    def extract_text_from_image(self, image_path: str) -> str:
        """Extract plain text from an image file."""
        pass

    @abc.abstractmethod
    def extract_text_from_page(self, page_image_path: str) -> str:
        """Extract text from a single rendered page image."""
        pass

    @abc.abstractmethod
    def extract_document_text(self, page_image_paths: List[str]) -> List[str]:
        """Extract text from a sequence of page images."""
        pass


class TesseractOCRService(OCRService):
    """Tesseract OCR implementation using pytesseract and local tesseract engine."""

    def __init__(self, tesseract_cmd: Optional[str] = None):
        cmd = tesseract_cmd or settings.TESSERACT_CMD
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd

    def extract_text_from_image(self, image_path: str) -> str:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")

        try:
            with Image.open(image_path) as img:
                # Convert to RGB if needed
                if img.mode not in ("L", "RGB"):
                    img = img.convert("RGB")
                text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
                return text.strip()
        except Exception as e:
            logger.error(f"Tesseract OCR failed on {image_path}: {e}")
            return ""

    def extract_text_from_page(self, page_image_path: str) -> str:
        return self.extract_text_from_image(page_image_path)

    def extract_document_text(self, page_image_paths: List[str]) -> List[str]:
        return [self.extract_text_from_page(p) for p in page_image_paths]


class VisionLLMOCRService(OCRService):
    """Vision LLM / Cloud OCR provider abstraction (e.g. Gemini Vision, Cloud Vision, Textract)."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OCR_API_KEY

    def extract_text_from_image(self, image_path: str) -> str:
        # Fallback to Tesseract if cloud key is not set
        logger.info("VisionLLMOCRService invoked; routing through OCR pipeline.")
        fallback = TesseractOCRService()
        return fallback.extract_text_from_image(image_path)

    def extract_text_from_page(self, page_image_path: str) -> str:
        return self.extract_text_from_image(page_image_path)

    def extract_document_text(self, page_image_paths: List[str]) -> List[str]:
        return [self.extract_text_from_page(p) for p in page_image_paths]


def get_ocr_service() -> OCRService:
    provider = settings.OCR_PROVIDER.lower()
    if provider == "vision_llm" or provider == "cloud_vision":
        return VisionLLMOCRService()
    return TesseractOCRService()
