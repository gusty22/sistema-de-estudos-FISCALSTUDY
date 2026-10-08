import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, update, delete
from backend.app.config import settings
from backend.app.db.database import AsyncSessionLocal
from backend.app.models.document import Document
from backend.app.models.document_page import DocumentPage
from backend.app.models.question import Question
from backend.app.models.option import Option
from backend.app.models.answer import Answer
from backend.app.models.review_item import ReviewItem
from backend.app.models.document_relation import DocumentRelation
from backend.app.services.pdf_service import PDFService
from backend.app.services.image_service import ImageService
from backend.app.services.ocr_service import get_ocr_service
from backend.app.services.question_extractor import QuestionExtractor
from backend.app.services.answer_key_service import AnswerKeyService
from backend.app.services.confidence_service import ConfidenceService
from backend.app.services.review_service import ReviewService

logger = logging.getLogger(__name__)


class DocumentProcessingWorker:
    """
    Executes the comprehensive asynchronous document extraction pipeline.
    Ensures idempotency, robust error handling, and partial failure tolerance.
    """

    @classmethod
    async def update_status(
        cls,
        session,
        document_id: str,
        status: str,
        stage: str,
        progress: int,
        error: Optional[str] = None
    ):
        values: Dict[str, Any] = {
            "status": status,
            "current_stage": stage,
            "progress": progress,
        }
        if status == "processing" and progress <= 15:
            values["processing_started_at"] = datetime.now(timezone.utc)
        elif status in ("completed", "partially_completed", "failed"):
            values["processing_completed_at"] = datetime.now(timezone.utc)
            if error:
                values["processing_error"] = error

        await session.execute(
            update(Document).where(Document.id == document_id).values(**values)
        )
        await session.commit()

    @classmethod
    async def process_document(cls, document_id: str):
        """Asynchronous document processing entrypoint."""
        async with AsyncSessionLocal() as session:
            # 1. Fetch document
            result = await session.execute(select(Document).where(Document.id == document_id))
            doc: Optional[Document] = result.scalar_one_or_none()

            if not doc:
                logger.error(f"Document {document_id} not found.")
                return

            # Idempotency check: if already processing or completed, check
            if doc.status == "processing":
                logger.info(f"Document {document_id} is already being processed. Continuing safely.")

            try:
                # Stage 1: Reading document
                await cls.update_status(session, document_id, "processing", "Reading document", 15)

                if not os.path.exists(doc.storage_path):
                    raise FileNotFoundError(f"Storage file not found: {doc.storage_path}")

                # Clean up any existing pages/questions in case of retry (idempotent re-run)
                await session.execute(delete(DocumentPage).where(DocumentPage.document_id == document_id))
                await session.execute(delete(Question).where(Question.document_id == document_id))
                await session.commit()

                pages_to_process: List[Dict[str, Any]] = []
                ocr_service = get_ocr_service()

                # Stage 2: Extract pages / text
                await cls.update_status(session, document_id, "processing", "Extracting text", 30)

                if doc.mime_type == "application/pdf":
                    pdf_pages = PDFService.extract_pages(doc.storage_path, document_id)
                    for p in pdf_pages:
                        page_text = p.direct_text
                        ocr_used = False

                        if p.ocr_needed:
                            # Stage 3: Running OCR on scanned page
                            await cls.update_status(session, document_id, "processing", f"Running OCR on page {p.page_number}", 45)
                            preprocessed_img = ImageService.preprocess_image(
                                p.image_path,
                                p.image_path.replace(".png", "_proc.png")
                            )
                            ocr_text = ocr_service.extract_text_from_image(preprocessed_img)
                            if ocr_text:
                                page_text = ocr_text
                                ocr_used = True

                        # Save page record
                        db_page = DocumentPage(
                            document_id=document_id,
                            page_number=p.page_number,
                            extracted_text=page_text,
                            ocr_used=ocr_used,
                            image_path=p.image_path,
                            processing_status="completed"
                        )
                        session.add(db_page)
                        pages_to_process.append({
                            "page_number": p.page_number,
                            "text": page_text,
                            "has_images": p.has_embedded_images,
                            "ocr_used": ocr_used,
                            "image_path": p.image_path
                        })
                    await session.commit()

                else:
                    # Image file (PNG / JPEG)
                    await cls.update_status(session, document_id, "processing", "Running OCR on image", 45)
                    pages_dir = os.path.join(settings.PAGES_DIR, document_id)
                    os.makedirs(pages_dir, exist_ok=True)
                    page_img_path = os.path.join(pages_dir, "page_1.png")

                    preprocessed = ImageService.preprocess_image(doc.storage_path, page_img_path)
                    text = ocr_service.extract_text_from_image(preprocessed)

                    db_page = DocumentPage(
                        document_id=document_id,
                        page_number=1,
                        extracted_text=text,
                        ocr_used=True,
                        image_path=page_img_path,
                        processing_status="completed"
                    )
                    session.add(db_page)
                    pages_to_process.append({
                        "page_number": 1,
                        "text": text,
                        "has_images": True,
                        "ocr_used": True,
                        "image_path": page_img_path
                    })
                    await session.commit()

                # Stage 4: Detecting questions & options
                await cls.update_status(session, document_id, "processing", "Detecting questions", 60)
                parsed_questions = QuestionExtractor.extract_from_pages(pages_to_process)

                # Stage 5: Matching answers
                await cls.update_status(session, document_id, "processing", "Matching answers", 75)

                # 5a. Look for answer key inside current document
                detected_answers = AnswerKeyService.detect_answer_key_in_pages(pages_to_process)

                # 5b. Check if there are related answer key documents
                relations_result = await session.execute(
                    select(DocumentRelation).where(
                        DocumentRelation.source_document_id == document_id,
                        DocumentRelation.relation_type == "answer_key"
                    )
                )
                related_docs = relations_result.scalars().all()
                for rel in related_docs:
                    rel_pages_result = await session.execute(
                        select(DocumentPage).where(DocumentPage.document_id == rel.related_document_id)
                    )
                    rel_pages = rel_pages_result.scalars().all()
                    rel_page_dicts = [
                        {"page_number": rp.page_number, "text": rp.extracted_text}
                        for rp in rel_pages
                    ]
                    external_answers = AnswerKeyService.detect_answer_key_in_pages(rel_page_dicts)
                    detected_answers.update(external_answers)

                # Match answers to questions
                matched_answers = AnswerKeyService.match_answers_for_questions(parsed_questions, detected_answers)

                # Stage 6: Calculating confidence & Review creation
                await cls.update_status(session, document_id, "processing", "Calculating confidence", 85)

                has_low_confidence = False
                for idx, pq in enumerate(parsed_questions):
                    ans = matched_answers[idx]

                    # Find page OCR status
                    page_info = next((p for p in pages_to_process if p["page_number"] == pq.start_page), {})
                    ocr_used = page_info.get("ocr_used", False)

                    confidence_breakdown = ConfidenceService.calculate_confidence(
                        ocr_used=ocr_used,
                        has_number=bool(pq.number),
                        boundary_score=pq.boundary_confidence,
                        options_count=len(pq.options),
                        question_type=pq.question_type,
                        text_length=len(pq.text),
                        is_split_across_pages=pq.is_split_across_pages,
                        has_answer=(ans.matching_status == "matched"),
                        answer_matching_status=ans.matching_status
                    )

                    extraction_status = "verified" if confidence_breakdown.overall_score >= settings.HIGH_CONFIDENCE_THRESHOLD else "needs_review"
                    if extraction_status == "needs_review":
                        has_low_confidence = True

                    # Insert question
                    db_question = Question(
                        document_id=document_id,
                        question_number=pq.number,
                        question_text=pq.text,
                        question_type=pq.question_type,
                        confidence=confidence_breakdown.overall_score,
                        extraction_status=extraction_status,
                        start_page=pq.start_page,
                        end_page=pq.end_page,
                        has_image=pq.has_image,
                        image_pages=pq.image_pages
                    )
                    session.add(db_question)
                    await session.flush()  # get db_question.id

                    # Insert options
                    for opt in pq.options:
                        db_option = Option(
                            question_id=db_question.id,
                            label=opt.label,
                            text=opt.text,
                            confidence=opt.confidence
                        )
                        session.add(db_option)

                    # Insert answer
                    db_answer = Answer(
                        question_id=db_question.id,
                        answer_label=ans.answer_label,
                        answer_text=ans.answer_text,
                        confidence=ans.confidence,
                        source_page=ans.source_page,
                        matching_status=ans.matching_status
                    )
                    session.add(db_answer)

                    # Generate review items
                    review_specs = ReviewService.evaluate_and_create_review_items(
                        question_id=db_question.id,
                        question_number=pq.number,
                        confidence=confidence_breakdown.overall_score,
                        ocr_used=ocr_used,
                        is_split_across_pages=pq.is_split_across_pages,
                        has_image=pq.has_image,
                        options_count=len(pq.options),
                        question_type=pq.question_type,
                        answer_matching_status=ans.matching_status,
                        answer_confidence=ans.confidence
                    )
                    for rspec in review_specs:
                        db_rev = ReviewItem(
                            question_id=rspec["question_id"],
                            issue_type=rspec["issue_type"],
                            description=rspec["description"],
                            confidence=rspec["confidence"],
                            status=rspec["status"]
                        )
                        session.add(db_rev)

                await session.commit()

                # Stage 7: Finalizing
                final_status = "partially_completed" if has_low_confidence or len(parsed_questions) == 0 else "completed"
                final_stage = "Completed with review items" if final_status == "partially_completed" else "Completed"
                await cls.update_status(session, document_id, final_status, final_stage, 100)
                logger.info(f"Document {document_id} successfully processed: {len(parsed_questions)} questions extracted.")

            except Exception as e:
                logger.exception(f"Error processing document {document_id}: {e}")
                await cls.update_status(
                    session,
                    document_id,
                    status="failed",
                    stage="Failed",
                    progress=0,
                    error=str(e)
                )


def run_document_processing_task(document_id: str):
    """Bridge for running the async worker in background task or thread."""
    asyncio.run(DocumentProcessingWorker.process_document(document_id))
