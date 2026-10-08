import os
import pymupdf as fitz

os.makedirs("sample_documents", exist_ok=True)

# 1. Generate Sample Exam Paper (2 pages with a multi-page spanning question)
doc = fitz.open()

# Page 1
page1 = doc.new_page(width=595, height=842) # A4
p1_text = """NATIONAL BOARD OF HIGHER EDUCATION
PHYSICS QUALIFYING EXAMINATION
Time Allowed: 3 Hours                          Maximum Marks: 100
General Instructions:
1. All questions are compulsory.
2. Read each question carefully before answering.

SECTION A: OBJECTIVE TYPE QUESTIONS

1. What is the SI unit of magnetic flux density?
A) Weber
B) Tesla
C) Henry
D) Gauss

2. Which electromagnetic wave has the highest frequency?
(A) Infrared rays
(B) Ultraviolet rays
(C) Gamma rays
(D) Microwaves

Q3. The electric potential inside a hollow charged conducting sphere is:
1) Zero
2) Constant and equal to potential at surface
3) Directly proportional to radius
4) Inversely proportional to distance from center

Question 4. Identify whether the following statement is true or false:
An ideal voltmeter has infinite internal electrical resistance.
A) True
B) False

Question 5. Explain the physical principles of electromagnetic induction
underlying Faraday's second law, particularly regarding the time rate
of magnetic flux change through an arbitrary closed surface,
"""
page1.insert_text((50, 50), p1_text, fontsize=11, fontname="helv")

# Page 2
page2 = doc.new_page(width=595, height=842)
p2_text = """and determine the magnitude of induced electromotive force in a rotating conductive loop.
Also state how Lenz's law ensures the conservation of mechanical energy in electromagnetic systems.
A) Directly proportional to the rate of change of magnetic flux
B) Inversely proportional to magnetic flux
C) Independent of magnetic flux variation
D) Equal to magnetic vector potential

6. What is the de Broglie wavelength of an electron accelerated through 100 Volts?
A) 0.123 nm
B) 1.23 nm
C) 12.3 nm
D) 0.012 nm

7. The phenomenon of light bending around sharp obstacles is called:
(A) Polarization
(B) Refraction
(C) Diffraction
(D) Dispersion

Q8. Fill in the blank:
The work done in moving a test charge over an equipotential surface is always equal to _____________.
"""
page2.insert_text((50, 50), p2_text, fontsize=11, fontname="helv")

exam_pdf_path = "sample_documents/Sample_Physics_Exam_Paper.pdf"
doc.save(exam_pdf_path)
doc.close()
print(f"Generated {exam_pdf_path}")

# 2. Generate Separate Answer Key Document
doc_ans = fitz.open()
page_ans = doc_ans.new_page(width=595, height=842)
ans_text = """OFFICIAL SOLUTIONS & ANSWER KEY
PHYSICS QUALIFYING EXAMINATION

ANSWER KEY:
1. B - Tesla
2. C - Gamma rays
3: 2 - Constant and equal to potential at surface
4. A - True
5. A - Directly proportional to the rate of change of magnetic flux
6. A - 0.123 nm
7. C - Diffraction
8. Zero - Work done is 0 J
"""
page_ans.insert_text((50, 50), ans_text, fontsize=12, fontname="helv")
ans_pdf_path = "sample_documents/Sample_Physics_Answer_Key.pdf"
doc_ans.save(ans_pdf_path)
doc_ans.close()
print(f"Generated {ans_pdf_path}")
