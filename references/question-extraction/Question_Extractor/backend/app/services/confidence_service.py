from typing import Dict, Any, Optional
from backend.app.config import settings


class ConfidenceBreakdown:
    def __init__(
        self,
        overall_score: float,
        ocr_score: float,
        boundary_score: float,
        option_score: float,
        number_score: float,
        answer_score: float,
        completeness_score: float,
        status: str
    ):
        self.overall_score = round(max(0.0, min(1.0, overall_score)), 2)
        self.ocr_score = round(ocr_score, 2)
        self.boundary_score = round(boundary_score, 2)
        self.option_score = round(option_score, 2)
        self.number_score = round(number_score, 2)
        self.answer_score = round(answer_score, 2)
        self.completeness_score = round(completeness_score, 2)
        self.status = status

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "status": self.status,
            "factors": {
                "ocr": self.ocr_score,
                "boundary": self.boundary_score,
                "options": self.option_score,
                "numbering": self.number_score,
                "answer": self.answer_score,
                "completeness": self.completeness_score
            }
        }


class ConfidenceService:
    """
    Computes deterministic multi-factor confidence scores for question extraction.
    Weights:
        - OCR Quality: 20%
        - Question Boundary & Formatting: 25%
        - Option Extraction: 20%
        - Number Detection: 15%
        - Text Completeness & Length: 10%
        - Cross-page Continuity / Answer Match: 10%
    """

    @classmethod
    def calculate_confidence(
        cls,
        ocr_used: bool,
        has_number: bool,
        boundary_score: float,
        options_count: int,
        question_type: str,
        text_length: int,
        is_split_across_pages: bool,
        has_answer: bool,
        answer_matching_status: str
    ) -> ConfidenceBreakdown:
        # 1. OCR quality factor
        ocr_score = 0.85 if ocr_used else 1.0

        # 2. Numbering factor
        number_score = 1.0 if has_number else 0.40

        # 3. Boundary score
        b_score = boundary_score
        if is_split_across_pages:
            b_score = min(b_score, 0.85)

        # 4. Options factor
        if question_type in ("MCQ", "multiple_select", "true_false"):
            if options_count >= 4:
                option_score = 1.0
            elif options_count >= 2:
                option_score = 0.90
            else:
                option_score = 0.35  # MCQ expected options but found none
        else:
            option_score = 1.0  # short or long answer does not need options

        # 5. Completeness factor
        if text_length > 30:
            completeness_score = 1.0
        elif text_length > 15:
            completeness_score = 0.80
        else:
            completeness_score = 0.40

        # 6. Answer match factor
        if has_answer and answer_matching_status == "matched":
            answer_score = 1.0
        elif answer_matching_status == "uncertain":
            answer_score = 0.40
        else:
            answer_score = 0.80  # no answer key isn't necessarily a failure

        # Weighted calculation
        overall = (
            (ocr_score * 0.20) +
            (b_score * 0.25) +
            (option_score * 0.20) +
            (number_score * 0.15) +
            (completeness_score * 0.10) +
            (answer_score * 0.10)
        )

        # Status categorization based on configurable thresholds
        if overall >= settings.HIGH_CONFIDENCE_THRESHOLD:
            status = "high"
        elif overall >= settings.REVIEW_THRESHOLD:
            status = "medium"
        else:
            status = "low"

        return ConfidenceBreakdown(
            overall_score=overall,
            ocr_score=ocr_score,
            boundary_score=b_score,
            option_score=option_score,
            number_score=number_score,
            answer_score=answer_score,
            completeness_score=completeness_score,
            status=status
        )
