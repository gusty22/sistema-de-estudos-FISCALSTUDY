from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from backend.app.config import settings
from backend.app.models.review_item import ReviewItem


class ReviewService:
    """
    Generates human review items for questions with potential issues,
    and handles reviewer actions (approve, correct, reject).
    """

    @classmethod
    def evaluate_and_create_review_items(
        cls,
        question_id: str,
        question_number: Optional[str],
        confidence: float,
        ocr_used: bool,
        is_split_across_pages: bool,
        has_image: bool,
        options_count: int,
        question_type: str,
        answer_matching_status: str,
        answer_confidence: float
    ) -> List[Dict[str, Any]]:
        """
        Evaluates extraction attributes and generates descriptive review items.
        """
        items: List[Dict[str, Any]] = []

        # 1. Low overall confidence
        if confidence < settings.REVIEW_THRESHOLD:
            items.append({
                "question_id": question_id,
                "issue_type": "low_confidence",
                "description": f"Extraction confidence score is {int(confidence * 100)}%, below threshold of {int(settings.REVIEW_THRESHOLD * 100)}%.",
                "confidence": confidence,
                "status": "pending"
            })

        # 2. Missing question number
        if not question_number:
            items.append({
                "question_id": question_id,
                "issue_type": "uncertain_question_boundary",
                "description": "Question number could not be determined confidently from document layout.",
                "confidence": confidence,
                "status": "pending"
            })

        # 3. Cross-page question split
        if is_split_across_pages:
            items.append({
                "question_id": question_id,
                "issue_type": "partial_extraction",
                "description": "Question text continues across multiple pages. Verify that the stitched stem and options are complete.",
                "confidence": confidence,
                "status": "pending"
            })

        # 4. Embedded diagram / image warning
        if has_image:
            items.append({
                "question_id": question_id,
                "issue_type": "diagram_warning",
                "description": "Embedded diagram or table detected on question page; visual verification recommended.",
                "confidence": confidence,
                "status": "pending"
            })

        # 5. Missing or uncertain options for MCQ
        if question_type in ("MCQ", "multiple_select") and options_count < 2:
            items.append({
                "question_id": question_id,
                "issue_type": "partial_extraction",
                "description": "Question is classified as multiple-choice, but fewer than 2 distinct options were detected.",
                "confidence": confidence,
                "status": "pending"
            })

        # 6. Uncertain answer match
        if answer_matching_status == "uncertain":
            items.append({
                "question_id": question_id,
                "issue_type": "missing_answer",
                "description": "Answer key entry could not be matched unambiguously to extracted options.",
                "confidence": answer_confidence,
                "status": "pending"
            })

        # 7. OCR artifacts on scanned page
        if ocr_used and confidence < 0.75:
            items.append({
                "question_id": question_id,
                "issue_type": "ocr_issue",
                "description": "OCR text extraction used for scanned page; potential character noise detected.",
                "confidence": confidence,
                "status": "pending"
            })

        return items
