import pytest
from backend.app.services.question_extractor import QuestionExtractor


def test_standard_numbering_extraction():
    pages = [
        {
            "page_number": 1,
            "text": """
1. What is the derivative of sin(x)?
A) cos(x)
B) -cos(x)
C) tan(x)
D) sec(x)

2. What is the unit of electric current?
(A) Volt
(B) Ampere
(C) Ohm
(D) Watt
""",
            "has_images": False
        }
    ]
    questions = QuestionExtractor.extract_from_pages(pages)
    assert len(questions) == 2
    assert questions[0].number == "1"
    assert "derivative of sin(x)" in questions[0].text
    assert questions[0].question_type == "MCQ"
    assert len(questions[0].options) == 4

    assert questions[1].number == "2"
    assert questions[1].options[1].label == "B"
    assert questions[1].options[1].text == "Ampere"


def test_q_style_numbering_extraction():
    pages = [
        {
            "page_number": 1,
            "text": """
Q1. Define photosynthesis in green plants.
Q2: State Newton's Second Law of Motion.
""",
            "has_images": False
        }
    ]
    questions = QuestionExtractor.extract_from_pages(pages)
    assert len(questions) == 2
    assert questions[0].number == "1"
    assert "photosynthesis" in questions[0].text
    assert questions[0].question_type == "short_answer"

    assert questions[1].number == "2"
    assert "Newton's Second Law" in questions[1].text


def test_question_without_number():
    pages = [
        {
            "page_number": 1,
            "text": "What are the primary factors affecting global climate change in modern times?",
            "has_images": False
        }
    ]
    questions = QuestionExtractor.extract_from_pages(pages)
    assert len(questions) == 1
    assert questions[0].number is None
    # Missing number should result in lower boundary confidence
    assert questions[0].boundary_confidence < 1.0
