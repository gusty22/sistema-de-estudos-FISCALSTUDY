import pytest
from backend.app.services.answer_key_service import AnswerKeyService
from backend.app.services.question_extractor import ParsedQuestion
from backend.app.services.option_extractor import ExtractedOption


def test_answer_key_parsing_and_matching():
    pages = [
        {
            "page_number": 3,
            "text": """
ANSWER KEY:
1. B
2. D
3. (A)
4: C
""",
            "has_images": False
        }
    ]

    detected = AnswerKeyService.detect_answer_key_in_pages(pages)
    assert "1" in detected and detected["1"][0] == "B"
    assert "2" in detected and detected["2"][0] == "D"
    assert "3" in detected and detected["3"][0] == "A"
    assert "4" in detected and detected["4"][0] == "C"

    # Match against dummy questions
    q1 = ParsedQuestion(
        number="1",
        text="Question 1",
        options=[ExtractedOption("A", "opt1"), ExtractedOption("B", "opt2")],
        question_type="MCQ",
        start_page=1,
        end_page=1,
        has_image=False,
        image_pages=[]
    )
    # Question 5 has no entry in answer key
    q5 = ParsedQuestion(
        number="5",
        text="Question 5",
        options=[],
        question_type="short_answer",
        start_page=2,
        end_page=2,
        has_image=False,
        image_pages=[]
    )

    matched = AnswerKeyService.match_answers_for_questions([q1, q5], detected)
    assert len(matched) == 2

    # q1 matched
    assert matched[0].question_number == "1"
    assert matched[0].answer_label == "B"
    assert matched[0].matching_status == "matched"
    assert matched[0].confidence > 0.8

    # q5 not found - must not hallucinate an answer!
    assert matched[1].question_number == "5"
    assert matched[1].answer_label is None
    assert matched[1].matching_status == "not_found"
    assert matched[1].confidence == 0.0


def test_uncertain_answer_label_mismatch():
    # Answer key says option 'Z', but question only has A and B
    detected = {"1": ("Z", "something", 1, 0.95)}
    q1 = ParsedQuestion(
        number="1",
        text="Sample Question",
        options=[ExtractedOption("A", "optA"), ExtractedOption("B", "optB")],
        question_type="MCQ",
        start_page=1,
        end_page=1,
        has_image=False,
        image_pages=[]
    )

    matched = AnswerKeyService.match_answers_for_questions([q1], detected)
    assert matched[0].matching_status == "uncertain"
    assert matched[0].confidence <= 0.50
