import os
import logging
from typing import List, Dict, Any, Tuple
import pymupdf as fitz
from backend.app.config import settings

logger = logging.getLogger(__name__)


class PDFPageInfo:
    def __init__(
        self,
        page_number: int,
        direct_text: str,
        image_path: str,
        ocr_needed: bool,
        has_embedded_images: bool,
        image_count: int
    ):
        self.page_number = page_number
        self.direct_text = direct_text
        self.image_path = image_path
        self.ocr_needed = ocr_needed
        self.has_embedded_images = has_embedded_images
        self.image_count = image_count


class PDFService:
    @staticmethod
    def extract_pages(pdf_path: str, document_id: str) -> List[PDFPageInfo]:
        """
        Parses a PDF page-by-page.
        Renders each page to a high-quality PNG image for UI preview and OCR fallback.
        Determines whether direct selectable text exists or OCR is required.
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found at {pdf_path}")

        pages_info: List[PDFPageInfo] = []
        doc_pages_dir = os.path.join(settings.PAGES_DIR, document_id)
        os.makedirs(doc_pages_dir, exist_ok=True)

        doc = fitz.open(pdf_path)
        try:
            for page_idx in range(len(doc)):
                page_num = page_idx + 1
                page = doc.load_page(page_idx)

                # 1. Direct text extraction
                text = page.get_text("text").strip()

                # 2. Render page to image (scale=2.0 for sharp 144+ DPI)
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                page_img_path = os.path.join(doc_pages_dir, f"page_{page_num}.png")
                pix.save(page_img_path)

                # 3. Check for embedded images (diagrams, graphs)
                images = page.get_images()
                has_images = len(images) > 0

                # 4. OCR fallback threshold: if text is empty or fewer than 25 chars, scanned
                ocr_needed = len(text) < 25

                pages_info.append(
                    PDFPageInfo(
                        page_number=page_num,
                        direct_text=text,
                        image_path=page_img_path,
                        ocr_needed=ocr_needed,
                        has_embedded_images=has_images,
                        image_count=len(images)
                    )
                )
        finally:
            doc.close()

        return pages_info
