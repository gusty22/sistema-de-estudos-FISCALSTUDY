import re
from typing import Dict, List, Optional, Tuple, Any


class MatchedAnswer:
    def __init__(
        self,
        question_number: str,
        answer_label: Optional[str],
        answer_text: Optional[str],
        confidence: float,
        source_page: Optional[int],
        matching_status: str  # "matched", "uncertain", "not_found"
    ):
        self.question_number = question_number
        self.answer_label = answer_label
        self.answer_text = answer_text
        self.confidence = confidence
        self.source_page = source_page
        self.matching_status = matching_status


class AnswerKeyService:
    """
    Detects answer keys embedded within documents or in separate answer-key documents.
    Associates answers strictly with questions without inventing answers.
    """

    ANSWER_KEY_HEADERS = [
        re.compile(r'\b(?:ANSWER\s*KEYS?|SOLUTIONS?|ANSWERS|KEY\s*ANSWERS?)\b', re.IGNORECASE),
        re.compile(r'\b(?:CORRECT\s*OPTIONS?|MARKING\s*SCHEME)\b', re.IGNORECASE),
    ]

    # Regex patterns for matching answers like:
    # 1. A / 1-A / 1: A / 1) A / Q1 - A / Q1: A / Question 1: (A)
    ANSWER_ENTRY_PATTERNS = [
        # 1-A, 1 - A, 1. A, 1: A, 1) A
        re.compile(r'(?:^|\s+)(?:Q(?:uestion)?\.?\s*)?(\d+)\s*[\.\:\-\)]\s*\(?([A-Da-d1-4]|True|False)\)?(?:\s*[\:\-\.]\s*([^\n\r,;]+))?', re.IGNORECASE),
        # 1-(A), 1 (A)
        re.compile(r'(?:^|\s+)(?:Q(?:uestion)?\.?\s*)?(\d+)\s*[\.\:\-\s]\s*\(([A-Da-d1-4])\)', re.IGNORECASE),
        # Q1 A, Q1: A
        re.compile(r'\bQ(\d+)\s*[\:\-\.]?\s*([A-Da-d1-4]|True|False)\b', re.IGNORECASE),
    ]

    @classmethod
    def detect_answer_key_in_pages(
        cls,
        pages_data: List[Dict[str, Any]]
    ) -> Dict[str, Tuple[Optional[str], Optional[str], int, float]]:
        """
        Scans pages for an answer key section.
        Returns a dict mapping question_number -> (answer_label, answer_text, source_page, confidence).
        """
        detected_answers: Dict[str, Tuple[Optional[str], Optional[str], int, float]] = {}

        for page in pages_data:
            page_num = page["page_number"]
            page_text = page["text"] or ""

            # Check if page contains an answer key header or grid
            has_header = any(h.search(page_text) for h in cls.ANSWER_KEY_HEADERS)

            # Extract from the text following header, or entire page if header is found
            text_to_parse = page_text
            if has_header:
                # Find where header starts
                for h in cls.ANSWER_KEY_HEADERS:
                    m = h.search(page_text)
                    if m:
                        text_to_parse = page_text[m.start():]
                        break

            # Parse answer entries
            for pattern in cls.ANSWER_ENTRY_PATTERNS:
                for match in pattern.finditer(text_to_parse):
                    groups = match.groups()
                    q_num = groups[0]
                    ans_label = groups[1].upper() if groups[1] else None
                    ans_text = groups[2].strip() if len(groups) > 2 and groups[2] else None

                    # If this is already found with high confidence, don't overwrite with lower
                    if q_num not in detected_answers:
                        conf = 0.95 if has_header else 0.75
                        detected_answers[q_num] = (ans_label, ans_text, page_num, conf)

        return detected_answers

    @classmethod
    def match_answers_for_questions(
        cls,
        questions: List[Any],
        detected_answers: Dict[str, Tuple[Optional[str], Optional[str], int, float]]
    ) -> List[MatchedAnswer]:
        """
        Matches questions with detected answers.
        If uncertain or not found, sets matching_status accordingly.
        """
        results: List[MatchedAnswer] = []

        for q in questions:
            q_num = getattr(q, "number", None) or getattr(q, "question_number", None)

            if not q_num or str(q_num) not in detected_answers:
                # Answer not found
                results.append(
                    MatchedAnswer(
                        question_number=str(q_num) if q_num else "unknown",
                        answer_label=None,
                        answer_text=None,
                        confidence=0.0,
                        source_page=None,
                        matching_status="not_found"
                    )
                )
            else:
                label, text, page, conf = detected_answers[str(q_num)]

                # Check if question has options and label matches an option
                q_options = getattr(q, "options", [])
                opt_labels = [opt.label.upper() for opt in q_options] if q_options else []

                matching_status = "matched"
                if opt_labels and label and label.upper() not in opt_labels:
                    # Label doesn't match any option -> uncertain
                    matching_status = "uncertain"
                    conf = min(conf, 0.45)

                results.append(
                    MatchedAnswer(
                        question_number=str(q_num),
                        answer_label=label,
                        answer_text=text,
                        confidence=conf,
                        source_page=page,
                        matching_status=matching_status
                    )
                )

        return results
