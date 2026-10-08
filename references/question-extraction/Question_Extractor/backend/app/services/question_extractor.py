import re
from typing import List, Dict, Any, Optional, Tuple
from backend.app.services.option_extractor import OptionExtractor, ExtractedOption


class RawQuestionBlock:
    def __init__(
        self,
        number: Optional[str],
        raw_text: str,
        start_page: int,
        end_page: int,
        has_image: bool = False,
        image_pages: Optional[List[int]] = None
    ):
        self.number = number
        self.raw_text = raw_text.strip()
        self.start_page = start_page
        self.end_page = end_page
        self.has_image = has_image
        self.image_pages = image_pages or []


class ParsedQuestion:
    def __init__(
        self,
        number: Optional[str],
        text: str,
        options: List[ExtractedOption],
        question_type: str,
        start_page: int,
        end_page: int,
        has_image: bool,
        image_pages: List[int],
        boundary_confidence: float = 1.0,
        type_confidence: float = 1.0,
        is_split_across_pages: bool = False
    ):
        self.number = number
        self.text = text
        self.options = options
        self.question_type = question_type
        self.start_page = start_page
        self.end_page = end_page
        self.has_image = has_image
        self.image_pages = image_pages
        self.boundary_confidence = boundary_confidence
        self.type_confidence = type_confidence
        self.is_split_across_pages = is_split_across_pages


class QuestionExtractor:
    """
    Extracts examination questions across multiple document pages.
    Handles multiple numbering schemes, missing numbers, cross-page spanning questions,
    option extraction, and question type classification.
    """

    # Regex patterns that signify the start of a question
    QUESTION_START_PATTERNS = [
        # Question 1: / Question 1. / Question 1 -
        re.compile(r'^(?:Question|Ques|Q)\.?\s*(\d+)\s*[:\.\-\)]\s*(.*)$', re.IGNORECASE),
        # Q1. / Q1) / Q1:
        re.compile(r'^Q(\d+)[\.\:\)\-]\s*(.*)$', re.IGNORECASE),
        # 1. / 1) / 1: (at least 1 digit, followed by dot/paren/colon)
        re.compile(r'^(\d+)[\.\)\:]\s*(.*)$'),
        # (1) / [1]
        re.compile(r'^(?:\((\d+)\)|\[(\d+)\])\s*(.*)$'),
    ]

    # Section headers to skip (e.g. "Section A", "Part 1", "General Instructions")
    SECTION_HEADER_PATTERNS = [
        re.compile(r'^(?:SECTION|PART)\s+[A-Z0-9]', re.IGNORECASE),
        re.compile(r'^(?:GENERAL INSTRUCTIONS|INSTRUCTIONS|MAX\.?\s*MARKS)', re.IGNORECASE),
        re.compile(r'^(?:TIME ALLOWED|ALL QUESTIONS ARE COMPULSORY)', re.IGNORECASE),
    ]

    @classmethod
    def detect_question_type(cls, question_text: str, options: List[ExtractedOption]) -> Tuple[str, float]:
        """
        Classifies the question type and returns (question_type, type_confidence).
        """
        text_lower = question_text.lower()

        # 1. Multiple Choice (MCQ) or Multiple Select
        if len(options) >= 2:
            if "select all that apply" in text_lower or "which of the following are" in text_lower or "multiple options" in text_lower:
                return "multiple_select", 0.95
            if len(options) == 2 and any(opt.text.lower() in ("true", "false", "yes", "no") for opt in options):
                return "true_false", 0.98
            return "MCQ", 0.96

        # 2. True / False without formal options
        if "state whether true or false" in text_lower or text_lower.startswith("true or false") or "is this statement true or false" in text_lower:
            return "true_false", 0.90

        # 3. Fill in the blanks
        if "___" in question_text or "....." in question_text or "fill in the blank" in text_lower:
            return "fill_blank", 0.92

        # 4. Short answer vs Long answer
        word_count = len(question_text.split())
        if any(marker in text_lower for marker in ["explain in detail", "discuss", "elaborate", "write an essay", "critically analyze"]):
            return "long_answer", 0.88
        if any(marker in text_lower for marker in ["define", "what is", "name the", "give two examples", "state the formula", "short note on"]):
            return "short_answer", 0.85

        if word_count < 25:
            return "short_answer", 0.70
        elif word_count >= 25:
            return "long_answer", 0.70

        return "unknown", 0.50

    @classmethod
    def extract_from_pages(
        cls,
        pages_data: List[Dict[str, Any]]
    ) -> List[ParsedQuestion]:
        """
        Extracts questions from a list of pages.
        pages_data elements:
            - page_number: int
            - text: str
            - has_images: bool
        """
        raw_blocks: List[RawQuestionBlock] = []
        current_block: Optional[RawQuestionBlock] = None

        for page in pages_data:
            page_num = page["page_number"]
            page_text = page["text"] or ""
            has_img = page.get("has_images", False)

            lines = [l.strip() for l in page_text.splitlines() if l.strip()]

            for line in lines:
                # Check for section headers
                if any(p.match(line) for p in cls.SECTION_HEADER_PATTERNS):
                    continue

                # Check if this line starts an answer key section (we don't want to parse answer key as questions)
                if re.match(r'^(?:ANSWER\s*KEY|SOLUTIONS|ANSWERS)\b', line, re.IGNORECASE):
                    # Answer key started, stop creating new question blocks
                    break

                # Check if line matches a new question header
                matched_num = None
                matched_rest = None

                for pattern in cls.QUESTION_START_PATTERNS:
                    m = pattern.match(line)
                    if m:
                        # Extract the captured number
                        groups = [g for g in m.groups() if g is not None]
                        if len(groups) >= 2:
                            matched_num = groups[0]
                            matched_rest = groups[1]
                        elif len(groups) == 1:
                            matched_num = groups[0]
                            matched_rest = ""
                        break

                if matched_num is not None:
                    # New question detected! Save previous block if exists
                    if current_block:
                        raw_blocks.append(current_block)

                    current_block = RawQuestionBlock(
                        number=matched_num,
                        raw_text=matched_rest or line,
                        start_page=page_num,
                        end_page=page_num,
                        has_image=has_img,
                        image_pages=[page_num] if has_img else []
                    )
                else:
                    # Line continuation
                    if current_block is not None:
                        current_block.raw_text += "\n" + line
                        current_block.end_page = page_num
                        if has_img and page_num not in current_block.image_pages:
                            current_block.has_image = True
                            current_block.image_pages.append(page_num)
                    else:
                        # Text before first numbered question (might be unnumbered question or preamble)
                        # Only start unnumbered if it looks like a question or has a question mark
                        if "?" in line or line.lower().startswith(("what", "why", "how", "explain", "describe", "calculate", "find")):
                            current_block = RawQuestionBlock(
                                number=None,
                                raw_text=line,
                                start_page=page_num,
                                end_page=page_num,
                                has_image=has_img,
                                image_pages=[page_num] if has_img else []
                            )

        if current_block:
            raw_blocks.append(current_block)

        # Post-process raw blocks:
        # Extract options, detect question types, calculate boundary confidence
        parsed_questions: List[ParsedQuestion] = []

        for block in raw_blocks:
            clean_text, options = OptionExtractor.extract_options(block.raw_text)

            # If clean_text is empty, fallback to raw_text
            if not clean_text:
                clean_text = block.raw_text

            q_type, type_conf = cls.detect_question_type(clean_text, options)

            # Boundary confidence evaluation
            boundary_conf = 1.0
            if not block.number:
                boundary_conf -= 0.30  # missing question number reduces confidence
            if block.start_page != block.end_page:
                # Multi-page spanning question: verify continuity
                is_split = True
                # Slight boundary uncertainty for multi-page questions
                boundary_conf -= 0.10
            else:
                is_split = False

            if len(clean_text.split()) < 4:
                boundary_conf -= 0.35  # suspiciously short question text

            boundary_conf = max(0.20, min(1.0, boundary_conf))

            parsed_questions.append(
                ParsedQuestion(
                    number=block.number,
                    text=clean_text,
                    options=options,
                    question_type=q_type,
                    start_page=block.start_page,
                    end_page=block.end_page,
                    has_image=block.has_image,
                    image_pages=block.image_pages,
                    boundary_confidence=boundary_conf,
                    type_confidence=type_conf,
                    is_split_across_pages=is_split
                )
            )

        return parsed_questions
