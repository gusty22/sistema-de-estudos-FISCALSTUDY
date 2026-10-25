"""Disposable regressions: inventory must not erase extracted or reviewed evidence."""
import os
import tempfile
import unittest
import pymupdf
from ingestion.src.pipeline.inventory_manager import StagingDatabase, InventoryManager
from ingestion.src.pipeline.batch_processor import BatchProcessor

class InventoryIntegrityTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fiscalstudy-inventory-")
        self.addCleanup(self.temp.cleanup)
        self.acervo = os.path.join(self.temp.name, "acervo")
        os.makedirs(self.acervo)
        self.pdf = os.path.join(self.acervo, "prova.pdf")
        with pymupdf.open() as doc:
            page=doc.new_page()
            page.insert_text((50,50), "QUESTAO 1\nQual resultado?\nA) Um\nB) Dois\nC) Tres\nD) Quatro")
            doc.save(self.pdf)
        self.db = StagingDatabase(os.path.join(self.temp.name,"staging.db"))
        self.manager = InventoryManager(self.acervo,self.db)
        self.manager.run_inventory()
        with self.db.get_connection() as conn:
            self.document=conn.execute("SELECT id FROM staging_documents").fetchone()[0]
            conn.execute("INSERT INTO staging_questions(id,document_id,numero_original,statement,options_json,pages_json,status,modified_by_user) VALUES('reviewed',?,1,'Preservar','[]','[1]','SOURCE_VERIFIED',1)",(self.document,))
    def test_rescan_preserves_document_identity_and_review(self):
        self.manager.run_inventory()
        with self.db.get_connection() as conn:
            self.assertEqual(self.document,conn.execute("SELECT id FROM staging_documents").fetchone()[0])
            self.assertEqual(1,conn.execute("SELECT COUNT(*) FROM staging_questions WHERE id='reviewed'").fetchone()[0])
            self.assertEqual([],conn.execute("PRAGMA foreign_key_check").fetchall())
            self.assertEqual(1,conn.execute("PRAGMA foreign_keys").fetchone()[0])
    def test_changed_file_is_not_destructively_reinventoried(self):
        with open(self.pdf,"ab") as file: file.write(b"\n% changed source")
        with self.assertRaises(ValueError): self.manager.run_inventory()
        with self.db.get_connection() as conn:
            self.assertEqual(1,conn.execute("SELECT COUNT(*) FROM staging_questions").fetchone()[0])
    def test_reviewed_content_blocks_batch_reprocessing(self):
        processor=BatchProcessor(self.db.db_path,self.acervo)
        row=processor.fetch_pending_files(force=True)[0]
        with self.assertRaises(ValueError): processor.process_single_file(row)
    def test_path_escape_is_rejected_before_opening_source(self):
        processor=BatchProcessor(self.db.db_path,self.acervo)
        row=dict(processor.fetch_pending_files(force=True)[0]);row['rel_path']='../outside.pdf'
        with self.assertRaises(ValueError):processor.process_single_file(row)

    def test_multiple_exam_spans_require_review_without_partial_extraction(self):
        with self.db.get_connection() as conn:
            conn.execute("UPDATE staging_questions SET status='EXTRACTED',modified_by_user=0")
            file_id=conn.execute("SELECT id FROM staging_files").fetchone()[0]
            conn.execute("INSERT INTO staging_documents(id,file_id,doc_role,page_start,page_end,status) VALUES('other-span',?,'PROVA',1,1,'CLASSIFIED')",(file_id,))
        processor=BatchProcessor(self.db.db_path,self.acervo)
        with self.assertRaisesRegex(ValueError,'Vários trechos'):
            processor.process_single_file(processor.fetch_pending_files(force=True)[0])
        with self.db.get_connection() as conn:
            self.assertEqual(1,conn.execute("SELECT COUNT(*) FROM staging_questions").fetchone()[0])

if __name__=='__main__':unittest.main()
