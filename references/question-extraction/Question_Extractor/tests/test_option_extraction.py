import pytest
from backend.app.services.option_extractor import OptionExtractor


def test_parenthesized_options():
    text = "What is the capital of France?\n(A) London\n(B) Paris\n(C) Rome\n(D) Madrid"
    clean_text, options = OptionExtractor.extract_options(text)
    assert "What is the capital of France?" in clean_text
    assert len(options) == 4
    assert options[0].label == "A" and options[0].text == "London"
    assert options[1].label == "B" and options[1].text == "Paris"
    assert options[2].label == "C" and options[2].text == "Rome"
    assert options[3].label == "D" and options[3].text == "Madrid"


def test_letter_closing_paren_options():
    text = "Which language is dynamically typed?\nA) C++\nB) Python\nC) Rust\nD) Go"
    clean_text, options = OptionExtractor.extract_options(text)
    assert len(options) == 4
    assert options[1].label == "B" and options[1].text == "Python"


def test_letter_dot_options():
    text = "Identify the odd one out:\nA. Dog\nB. Cat\nC. Table\nD. Bird"
    clean_text, options = OptionExtractor.extract_options(text)
    assert len(options) == 4
    assert options[2].label == "C" and options[2].text == "Table"


def test_numeric_options():
    text = "Choose the correct value of pi:\n1) 3.14\n2) 2.71\n3) 1.41\n4) 0.57"
    clean_text, options = OptionExtractor.extract_options(text)
    assert len(options) == 4
    assert options[0].label == "1" and options[0].text == "3.14"


def test_horizontal_options():
    text = "Select the prime number:\n(A) 4  (B) 6  (C) 7  (D) 9"
    clean_text, options = OptionExtractor.extract_options(text)
    assert len(options) == 4
    assert options[2].label == "C" and options[2].text == "7"
