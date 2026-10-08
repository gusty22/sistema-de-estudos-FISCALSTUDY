import pytest
from backend.app.services.confidence_service import ConfidenceService
from backend.app.services.review_service import ReviewService


def test_confidence_scoring_factors():
    # Clean, digital document question with all options and matched answer
    high_score = ConfidenceService.calculate_confidence(
        ocr_used=False,
        has_number=True,
        boundary_score=1.0,
        options_count=4,
        question_type="MCQ",
        text_length=50,
        is_split_across_pages=False,
        has_answer=True,
        answer_matching_status="matched"
    )
    assert high_score.overall_score >= 0.85
    assert high_score.status == "high"

    # Scanned OCR question with missing number and uncertain boundary
    low_score = ConfidenceService.calculate_confidence(
        ocr_used=True,
        has_number=False,
        boundary_score=0.4,
        options_count=1,
        question_type="MCQ",
        text_length=10,
        is_split_across_pages=True,
        has_answer=False,
        answer_matching_status="uncertain"
    )
    assert low_score.overall_score < 0.60
    assert low_score.status == "low"


def test_review_service_issue_generation():
    # Evaluate a question with uncertain boundary, low confidence, and cross-page split
    review_items = ReviewService.evaluate_and_create_review_items(
        question_id="q-123",
        question_number=None,
        confidence=0.45,
        ocr_used=True,
        is_split_across_pages=True,
        has_image=True,
        options_count=1,
        question_type="MCQ",
        answer_matching_status="uncertain",
        answer_confidence=0.35
    )

    assert len(review_items) > 0
    issue_types = [item["issue_type"] for item in review_items]

    # Verify specific issues are captured
    assert "low_confidence" in issue_types
    assert "uncertain_question_boundary" in issue_types
    assert "partial_extraction" in issue_types
    assert "diagram_warning" in issue_types
    assert "missing_answer" in issue_types

    # Ensure descriptions are descriptive and not vague
    for item in review_items:
        assert len(item["description"]) > 10
        assert "something went wrong" not in item["description"].lower()
