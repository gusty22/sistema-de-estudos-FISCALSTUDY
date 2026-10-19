import sqlite3, os, pymupdf
import sys
sys.path.insert(0, "ingestion")
from src.pipeline.universal_extractor import UniversalExtractor

def test_mossoro():
    con = sqlite3.connect("db/staging.db")
    rel = con.execute("SELECT rel_path FROM staging_files WHERE rel_path LIKE ?", ("%Mossor%Cont%",)).fetchone()[0]
    full = os.path.join(r"c:\Users\washi\Downloads\provas", rel)
    doc = pymupdf.open(full)
    
    extractor = UniversalExtractor(banca="CEBRASPE")
    qs, sms = extractor.extract_questions_from_span(doc, p_start=1, p_end=7)
    print(f"Mossoró extracted: {len(qs)} questions, {len(sms)} support materials")
    nums = [q["numero_original"] for q in qs]
    print(f"Min: {min(nums)}, Max: {max(nums)}")
    missing = [x for x in range(1, 121) if x not in nums]
    print(f"Missing (1..120): {missing}")

test_mossoro()
