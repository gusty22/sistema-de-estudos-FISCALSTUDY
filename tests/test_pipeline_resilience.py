"""Testes de Integração e Resiliência do Pipeline Documental FiscalStudy (ETAPA 6).

Cenários validados:
1. Idempotência: Reprocessamento do mesmo arquivo não duplica questões em staging_questions.
2. Isolamento de Falhas: Documento inválido/corrompido registra falha sem derrubar o lote.
3. Retomada / Checkpointing: Arquivos com status PROCESSED são pulados na próxima execução.
4. Regressão do Golden Set: 100% de pareamento nos formatos de gabarito (vertical, horizontal, Cebraspe, anulada).
"""
import os
import sys
import unittest
import sqlite3
import tempfile
import pymupdf

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from ingestion.src.pipeline.batch_processor import BatchProcessor
from ingestion.src.pipeline.universal_extractor import UniversalExtractor, parse_answer_key_universal

class TestPipelineResilience(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.acervo_dir = r"C:\Users\washi\Downloads\provas"
        cls.staging_db_path = os.path.join(ROOT_DIR, "db", "staging.db")
        cls.processor = BatchProcessor(cls.staging_db_path, cls.acervo_dir)

    def test_01_idempotence_no_duplicate_questions(self):
        """Verifica se reprocessar um arquivo já processado mantém o mesmo número de questões."""
        with self.processor.get_connection() as conn:
            cur = conn.execute("""
                SELECT f.id, f.rel_path, COUNT(q.id) as q_count 
                FROM staging_files f
                JOIN staging_documents d ON d.file_id = f.id
                JOIN staging_questions q ON q.document_id = d.id
                GROUP BY f.id
                HAVING q_count > 0
                LIMIT 1
            """)
            row = cur.fetchone()
            self.assertIsNotNone(row, "Deveria haver pelo menos um arquivo processado no staging.db")
            file_id = row["id"]
            initial_count = row["q_count"]

            files = self.processor.fetch_pending_files(file_id=file_id)
            self.assertEqual(len(files), 1)
            stats = self.processor.process_single_file(files[0])
            self.assertEqual(stats["status"], "SUCCESS")

            cur2 = conn.execute("""
                SELECT COUNT(q.id) as q_count
                FROM staging_questions q
                JOIN staging_documents d ON q.document_id = d.id
                WHERE d.file_id = ?
            """, (file_id,))
            after_count = cur2.fetchone()["q_count"]
            self.assertEqual(initial_count, after_count, 
                             f"Idempotência violada! Inicial: {initial_count}, Final: {after_count}")

    def test_02_resumption_skips_processed_files(self):
        """Garante que a busca de arquivos pendentes ignora os que já têm status EXTRACTED."""
        pending_files = self.processor.fetch_pending_files(limit=10, force=False)
        for f in pending_files:
            self.assertNotIn(f["status"], ("EXTRACTED", "NO_QUESTIONS_FOUND"), 
                             f"Arquivo {f['filename']} com status final foi retornado na lista de pendentes!")

    def test_03_fault_isolation(self):
        """Simula um arquivo corrompido em staging temporário e verifica se o pipeline registra erro sem quebrar."""
        tmp_dir = tempfile.mkdtemp()
        temp_db = os.path.join(tmp_dir, "temp_staging.db")
        try:
            with sqlite3.connect(self.staging_db_path) as src_conn, sqlite3.connect(temp_db) as dst_conn:
                src_conn.backup(dst_conn)

            corrupt_pdf = os.path.join(tmp_dir, "corrupt.pdf")
            with open(corrupt_pdf, "wb") as f:
                f.write(b"%PDF-1.4 corrupt junk bytes that cannot be parsed by pymupdf\n")

            with sqlite3.connect(temp_db) as conn:
                conn.execute("""
                    INSERT INTO staging_files (id, rel_path, filename, file_size_bytes, sha256, total_pages, status)
                    VALUES ('fake-corrupt-id', 'corrupt.pdf', 'corrupt.pdf', 100, 'sha-fake', 1, 'PENDING')
                """)
                conn.execute("""
                    INSERT INTO staging_documents (id, file_id, doc_role, page_start, page_end, banca, ano, cargo, status)
                    VALUES ('fake-doc-id', 'fake-corrupt-id', 'PROVA', 1, 1, 'TEST', 2026, 'Cargo Teste', 'PENDING')
                """)
                conn.commit()

            temp_processor = BatchProcessor(temp_db, tmp_dir)
            files = temp_processor.fetch_pending_files(file_id='fake-corrupt-id')
            self.assertEqual(len(files), 1)

            res = temp_processor.process_single_file(files[0])
            self.assertEqual(res["status"], "FAILED")

            with sqlite3.connect(temp_db) as conn:
                status = conn.execute("SELECT status FROM staging_files WHERE id = 'fake-corrupt-id'").fetchone()[0]
                self.assertEqual(status, "FAILED")
        finally:
            # Fechar qualquer conexão pendente antes de remover tmp_dir
            import gc
            gc.collect()
            try:
                import shutil
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass

    def test_04_golden_set_regression(self):
        """Verifica se os gabaritos das bancas continuam sendo parseados universalmente via PyMuPDF in-memory."""
        # 1. IBGP Vertical
        doc_ibgp = pymupdf.open()
        p1 = doc_ibgp.new_page()
        p1.insert_text((50, 50), "QUESTÃO GABARITO\n1 D\n2 A\n3 C\n4 B\n5 D")
        g_ibgp, st_ibgp = parse_answer_key_universal(doc_ibgp, 1, 1)
        self.assertEqual(len(g_ibgp), 5)
        self.assertEqual(g_ibgp[1], "D")
        self.assertEqual(g_ibgp[2], "A")

        # 2. Horizontal (FGV / CEBRASPE / FCC)
        doc_fgv = pymupdf.open()
        p2 = doc_fgv.new_page()
        p2.insert_text((50, 50), "1 2 3 4 5 6 7 8 9 10\nA B C D E A B C D E")
        g_fgv, st_fgv = parse_answer_key_universal(doc_fgv, 1, 1)
        self.assertEqual(len(g_fgv), 10)
        self.assertEqual(g_fgv[1], "A")
        self.assertEqual(g_fgv[5], "E")
        self.assertEqual(g_fgv[10], "E")

        # 3. Cebraspe C/E
        doc_ceb = pymupdf.open()
        p3 = doc_ceb.new_page()
        p3.insert_text((50, 50), "1 2 3 4 5\nC E C C E")
        g_ceb, st_ceb = parse_answer_key_universal(doc_ceb, 1, 1)
        self.assertEqual(len(g_ceb), 5)
        self.assertEqual(g_ceb[1], "C")
        self.assertEqual(g_ceb[2], "E")

        # 4. Questão anulada
        doc_anulada = pymupdf.open()
        p4 = doc_anulada.new_page()
        p4.insert_text((50, 50), "1 A\n2 ANULADA\n3 C\n4 ANULADA\n5 B")
        g_anulada, st_anulada = parse_answer_key_universal(doc_anulada, 1, 1)
        self.assertEqual(g_anulada[2], "ANULADA")
        self.assertEqual(g_anulada[4], "ANULADA")

if __name__ == "__main__":
    unittest.main()
