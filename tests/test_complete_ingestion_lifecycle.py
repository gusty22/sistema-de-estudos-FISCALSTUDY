"""Testes do Ciclo Completo de Ingestão e Publicação (ETAPA 5).

Verifica o percurso fim a fim:
Staging -> Validação -> Classificação -> Aprovação (SOURCE_VERIFIED) -> 
Publicação Atômica com Backup Físico -> Disponibilização em questions -> Idempotência Operacional
"""
import os
import sys
import unittest
import sqlite3
import tempfile
import json
from contextlib import closing

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from ingestion.publish_verified import publish_questions, create_physical_backup

class TestCompleteIngestionLifecycle(unittest.TestCase):

    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory(prefix="fiscalstudy-lifecycle-")
        self.staging_db = os.path.join(self.workspace.name, "staging.db")
        self.operational_db = os.path.join(self.workspace.name, "operational.db")
        self.backup_dir = os.path.join(self.workspace.name, "backups")

        # Criar schema de staging idêntico ao staging-schema.sql
        with closing(sqlite3.connect(self.staging_db)) as conn, conn:
            conn.execute("""
                CREATE TABLE staging_files (
                    id TEXT PRIMARY KEY,
                    rel_path TEXT NOT NULL UNIQUE,
                    filename TEXT NOT NULL,
                    file_size_bytes INTEGER NOT NULL,
                    sha256 TEXT NOT NULL,
                    total_pages INTEGER NOT NULL,
                    banca TEXT,
                    ano INTEGER,
                    orgao TEXT,
                    cargo TEXT,
                    status TEXT DEFAULT 'PROCESSED'
                )
            """)
            conn.execute("""
                CREATE TABLE staging_documents (
                    id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    doc_role TEXT NOT NULL,
                    page_start INTEGER NOT NULL,
                    page_end INTEGER NOT NULL,
                    banca TEXT,
                    orgao TEXT,
                    cargo TEXT,
                    ano INTEGER,
                    status TEXT DEFAULT 'CLASSIFIED',
                    FOREIGN KEY(file_id) REFERENCES staging_files(id)
                )
            """)
            conn.execute("""
                CREATE TABLE staging_questions (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    numero_original INTEGER NOT NULL,
                    statement TEXT NOT NULL,
                    options_json TEXT NOT NULL,
                    correct_option TEXT,
                    gabarito_status TEXT NOT NULL DEFAULT 'DEFINITIVO',
                    disciplina TEXT,
                    assunto TEXT,
                    subassunto TEXT,
                    justificativa TEXT,
                    texto_apoio TEXT,
                    texto_apoio_titulo TEXT,
                    status TEXT NOT NULL DEFAULT 'EXTRACTED',
                    pages_json TEXT NOT NULL DEFAULT '[]',
                    FOREIGN KEY(document_id) REFERENCES staging_documents(id)
                )
            """)
            conn.execute("""
                CREATE TABLE staging_support_materials (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    titulo TEXT,
                    conteudo_texto TEXT,
                    media_path TEXT,
                    pagina_inicio INTEGER,
                    pagina_fim INTEGER,
                    coordenadas_json TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE staging_question_support_materials (
                    question_id TEXT NOT NULL,
                    material_id TEXT NOT NULL,
                    PRIMARY KEY(question_id, material_id)
                )
            """)

            # Popular questão simulando saída da extração e classificação
            conn.execute("""
                INSERT INTO staging_files VALUES (
                    'file_01', 'provas/araguari.pdf', 'araguari.pdf', 1024, 'hash_abc', 10,
                    'IBGP', 2023, 'Prefeitura Araguari', 'Auditor Fiscal', 'PROCESSED'
                )
            """)
            conn.execute("""
                INSERT INTO staging_documents VALUES (
                    'doc_01', 'file_01', 'PROVA', 1, 10,
                    'IBGP', 'Prefeitura Araguari', 'Auditor Fiscal', 2023, 'CLASSIFIED'
                )
            """)
            conn.execute("""
                INSERT INTO staging_questions VALUES (
                    'stg_q_01', 'doc_01', 1,
                    'Sobre a Lei Complementar 123/2006, assinale a opção correta:',
                    '["A) Opcao 1", "B) Opcao 2", "C) Opcao 3", "D) Opcao 4"]',
                    'B', 'DEFINITIVO',
                    'Direito Tributário', 'Simples Nacional', 'Alíquotas',
                    'Base no art. 18 da LC 123', 'Texto legal de referência', 'LC 123/06',
                    'SOURCE_VERIFIED', '[1]'
                )
            """)

        # Criar schema operacional temporário idêntico ao schema.sql de produção
        with closing(sqlite3.connect(self.operational_db)) as conn, conn:
            conn.execute("""
                CREATE TABLE questions (
                    id TEXT PRIMARY KEY,
                    enunciado TEXT,
                    options_json TEXT,
                    correct_option TEXT,
                    gabarito_status TEXT DEFAULT 'DEFINITIVO',
                    banca TEXT,
                    ano INTEGER,
                    orgao TEXT,
                    cargo TEXT,
                    disciplina TEXT,
                    assunto TEXT,
                    dificuldade TEXT,
                    status TEXT DEFAULT 'VALIDADA',
                    justificativa TEXT,
                    texto_apoio TEXT,
                    texto_apoio_titulo TEXT,
                    numero_original INTEGER,
                    arquivo_origem TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE support_materials (
                    id TEXT PRIMARY KEY,
                    tipo TEXT NOT NULL,
                    titulo TEXT,
                    conteudo_texto TEXT,
                    media_path TEXT,
                    doc_origem TEXT,
                    pagina_inicio INTEGER,
                    pagina_fim INTEGER,
                    coordenadas_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE question_support_materials (
                    question_id TEXT NOT NULL,
                    material_id TEXT NOT NULL,
                    PRIMARY KEY(question_id, material_id)
                )
            """)
            conn.execute("""
                CREATE TABLE event_store (
                    event_id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    aggregate_type TEXT NOT NULL,
                    aggregate_id TEXT NOT NULL,
                    session_id TEXT,
                    occurred_at TEXT NOT NULL,
                    recorded_at TEXT NOT NULL,
                    event_version INTEGER NOT NULL,
                    schema_version TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
            """)

    def tearDown(self):
        try:
            self.workspace.cleanup()
        except Exception:
            pass

    def test_01_publish_pipeline_end_to_end_with_backup_and_audit(self):
        """Verifica a promoção segura de staging para o banco operacional com backup e auditoria."""
        # 1. Executa a publicação atômica
        result = publish_questions(
            staging_db_path=self.staging_db,
            operational_db_path=self.operational_db,
            backup_dir=self.backup_dir,
            file_id="file_01",
            allow_structurally_valid=False,
            dry_run=False
        )

        self.assertEqual(result["status"], "SUCCESS")
        self.assertEqual(result["published_count"], 1)

        # 2. Confirma a criação e integridade do backup físico prévio
        self.assertTrue(os.path.exists(self.backup_dir))
        backups = os.listdir(self.backup_dir)
        self.assertEqual(len(backups), 1, "Um backup físico deve ser gerado antes da publicação.")

        # 3. Confirma a presença e integridade dos dados no banco operacional
        with closing(sqlite3.connect(self.operational_db)) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, enunciado, correct_option, disciplina, status FROM questions")
            row = cur.fetchone()
            self.assertIsNotNone(row)
            q_id, enunciado, correct_option, disciplina, status = row
            self.assertEqual(q_id, "stg_q_01")
            self.assertEqual(correct_option, "B")
            self.assertEqual(disciplina, "Direito Tributário")
            self.assertEqual(status, "VALIDADA")

            # 4. Confirma o registro do evento de auditoria no event_store
            cur.execute("SELECT event_type, aggregate_type, aggregate_id FROM event_store WHERE event_type = 'IMPORT_RECEIVED'")
            evt = cur.fetchone()
            self.assertIsNotNone(evt)
            self.assertEqual(evt[0], "IMPORT_RECEIVED")
            self.assertEqual(evt[1], "INGESTION_STAGING")
            self.assertEqual(evt[2], "file_01")

    def test_02_idempotent_republishing(self):
        """Verifica que republicar o mesmo arquivo não duplica questões nem gera corrupção."""
        # Primeira publicação
        publish_questions(
            staging_db_path=self.staging_db,
            operational_db_path=self.operational_db,
            backup_dir=self.backup_dir,
            file_id="file_01"
        )

        # Republicação do mesmo arquivo
        summary2 = publish_questions(
            staging_db_path=self.staging_db,
            operational_db_path=self.operational_db,
            backup_dir=self.backup_dir,
            file_id="file_01"
        )
        self.assertEqual(summary2["status"], "SUCCESS")
        self.assertEqual(summary2["published_count"], 1)

        with closing(sqlite3.connect(self.operational_db)) as conn:
            count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
            self.assertEqual(count, 1, "A questão deve ser atualizada via ON CONFLICT sem duplicação.")

if __name__ == "__main__":
    unittest.main()
