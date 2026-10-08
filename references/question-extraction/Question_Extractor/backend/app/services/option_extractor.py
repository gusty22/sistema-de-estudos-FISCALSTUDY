import re
from typing import List, Dict, Tuple, Optional, Any


class ExtractedOption:
    def __init__(self, label: str, text: str, confidence: float = 1.0):
        self.label = label.strip()
        self.text = text.strip()
        self.confidence = confidence

    def to_dict(self) -> Dict[str, Any]:
        return {
            "label": self.label,
            "text": self.text,
            "confidence": self.confidence
        }


class OptionExtractor:
    """
    Extracts options from question text blocks supporting multiple formats:
    - (A), (B), (C), (D) or (a), (b), (c), (d)
    - A), B), C), D) or a), b), c), d)
    - A. B. C. D. or a. b. c. d.
    - [A], [B]
    - 1), 2), 3), 4) or (1), (2), (3), (4)
    """

    # Primary regex matching option markers at the start of a line or after spaces
    OPTION_PATTERNS = [
        # (A) text, (B) text, (a) text
        r'(?:^|\n|\s{2,})\(([A-Da-d1-4])\)\s+([^\n\(\)]+)',
        # A) text, B) text, 1) text
        r'(?:^|\n|\s{2,})([A-Da-d1-4])\)\s+([^\n\)]+)',
        # A. text, B. text
        r'(?:^|\n|\s{2,})([A-Da-d1-4])\.\s+([^\n\.]+)',
        # [A] text, [B] text
        r'(?:^|\n|\s{2,})\[([A-Da-d1-4])\]\s+([^\n\[\]]+)',
    ]

    @classmethod
    def extract_options(cls, raw_text: str) -> Tuple[str, List[ExtractedOption]]:
        """
        Extracts options from text.
        Returns:
            cleaned_question_text: text with options removed
            options: list of ExtractedOption objects
        """
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return raw_text, []

        options: List[ExtractedOption] = []
        clean_question_lines: List[str] = []

        # 1. Line-by-line option scanning (highest accuracy)
        line_opt_pattern = re.compile(
            r'^(?:(?:\(([A-Da-d1-4])\))|(?:([A-Da-d1-4])[\)\.])|(?:\[([A-Da-d1-4])\]))\s*(.*)$'
        )

        in_options = False
        current_option: Optional[ExtractedOption] = None

        for line in lines:
            m = line_opt_pattern.match(line)
            if m:
                in_options = True
                label = (m.group(1) or m.group(2) or m.group(3)).upper()
                opt_text = m.group(4).strip()
                current_option = ExtractedOption(label=label, text=opt_text, confidence=0.95)
                options.append(current_option)
            elif in_options and current_option:
                # Multi-line option continuation or inline secondary options
                # Check for inline option inside this line, e.g. "B) Next Option"
                inline_match = re.search(r'\s+(?:(?:\(([B-Db-d])\))|(?:([B-Db-d])[\)\.]))\s+(.*)$', line)
                if inline_match:
                    inline_lbl = (inline_match.group(1) or inline_match.group(2)).upper()
                    inline_text = inline_match.group(3).strip()
                    options.append(ExtractedOption(label=inline_lbl, text=inline_text, confidence=0.90))
                else:
                    current_option.text += " " + line
            else:
                clean_question_lines.append(line)

        # 2. Fallback: If line-by-line found fewer than 2 options, check inline/horizontal options
        if len(options) < 2:
            options.clear()
            clean_question_lines.clear()

            marker_pattern = re.compile(r'(?:^|\s+)(?:\(([A-Da-d1-4])\)|([A-Da-d1-4])[\)\.\]])\s*')
            matches = list(marker_pattern.finditer(raw_text))

            if len(matches) >= 2:
                # Stem is everything before first marker
                stem = raw_text[:matches[0].start()].strip()
                if stem:
                    clean_question_lines.append(stem)

                for i, m in enumerate(matches):
                    lbl = (m.group(1) or m.group(2)).upper()
                    start_pos = m.end()
                    end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
                    opt_text = raw_text[start_pos:end_pos].strip()
                    options.append(ExtractedOption(label=lbl, text=opt_text, confidence=0.92))
            else:
                clean_question_lines = lines

        cleaned_text = "\n".join(clean_question_lines).strip()
        return cleaned_text, options
