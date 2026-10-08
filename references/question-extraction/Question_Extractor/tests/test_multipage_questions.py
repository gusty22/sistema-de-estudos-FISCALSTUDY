import pytest
from backend.app.services.question_extractor import QuestionExtractor


def test_question_spanning_across_pages():
    pages = [
        {
            "page_number": 1,
            "text": """
Question 5. Explain the fundamental advantages of distributed cloud
computing architectures, particularly focusing on fault tolerance
""",
            "has_images": False
        },
        {
            "page_number": 2,
            "text": """
and horizontal scalability, and discuss three practical limitations.
A) Fault tolerance only
B) High availability and resilience
C) Single point of failure
D) None of the above
""",
            "has_images": False
        }
    ]

    questions = QuestionExtractor.extract_from_pages(pages)
    # Must NOT create two separate questions
    assert len(questions) == 1
    q = questions[0]
    assert q.number == "5"
    assert q.start_page == 1
    assert q.end_page == 2
    assert q.is_split_across_pages is True
    assert "fault tolerance" in q.text
    assert "horizontal scalability" in q.text
    assert len(q.options) == 4
