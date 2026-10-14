"""Gerenciador de Descoberta Segura e Inventário do Acervo documental do FiscalStudy.

Responsabilidades:
- Criação e inicialização do banco isolado de staging (db/staging.db).
- Varredura recursiva do acervo documental respeitando exclusão estrita da pasta 'processados'.
- Registro de metadados físicos (SHA-256, tamanho, páginas, presença de texto selecionável, bookmarks).
- Decomposição lógica inicial (mapeamento de spans de páginas para Prova, Gabarito e Edital).
- Totalmente idempotente: reexecuções não duplicam registros e atualizam estado com segurança.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import unicodedata
import uuid
from typing import Any, Dict, List, Optional, Tuple

import pymupdf


def normalize_str(s: str) -> str:
    if not s:
        return ""
    n = unicodedata.normalize("NFKD", s)
    return "".join(c for c in n if not unicodedata.combining(c)).strip()


def slugify(s: str) -> str:
    norm = normalize_str(s)
    clean = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return clean or "unknown"


def is_processed_path(path: str) -> bool:
    """Verifica se o caminho pertence a qualquer diretório ou subdiretório 'processados'."""
    norm_path = os.path.normpath(path).lower()
    parts = norm_path.split(os.sep)
    return "processados" in parts


class StagingDatabase:
    """Gerenciador do banco de dados isolado de staging (db/staging.db)."""

    SCHEMA_SQL = """
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS staging_files (
        id TEXT PRIMARY KEY,
        rel_path TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        total_pages INTEGER NOT NULL,
        has_selectable_text INTEGER DEFAULT 1,
        is_scanned INTEGER DEFAULT 0,
        has_bookmarks INTEGER DEFAULT 0,
        bookmarks_json TEXT,
        doc_family TEXT,
        banca TEXT,
        ano INTEGER,
        orgao TEXT,
        cargo TEXT,
        status TEXT DEFAULT 'DISCOVERED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staging_documents (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        doc_role TEXT NOT NULL, -- PROVA, GABARITO_DEFINITIVO, GABARITO_PRELIMINAR, EDITAL, ALTERACOES
        page_start INTEGER NOT NULL,
        page_end INTEGER NOT NULL,
        banca TEXT,
        orgao TEXT,
        cargo TEXT,
        cargo_codigo TEXT,
        ano INTEGER,
        status TEXT DEFAULT 'CLASSIFIED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(file_id) REFERENCES staging_files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staging_questions (
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
        edital_topico_id TEXT,
        status TEXT NOT NULL DEFAULT 'EXTRACTED', -- EXTRACTED, STRUCTURALLY_VALID, NEEDS_REVIEW, SOURCE_VERIFIED, REJECTED, PUBLISHED
        flags_json TEXT DEFAULT '[]',
        pages_json TEXT NOT NULL,
        evidence_image_path TEXT,
        modified_by_user INTEGER DEFAULT 0,
        review_notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(document_id) REFERENCES staging_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staging_support_materials (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        tipo TEXT NOT NULL, -- TEXTO_BASE, TABELA, GRAFICO, FIGURA, FORMULA
        titulo TEXT,
        conteudo_texto TEXT,
        media_path TEXT,
        pagina_inicio INTEGER,
        pagina_fim INTEGER,
        coordenadas_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(document_id) REFERENCES staging_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staging_question_support_materials (
        question_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        PRIMARY KEY(question_id, material_id),
        FOREIGN KEY(question_id) REFERENCES staging_questions(id) ON DELETE CASCADE,
        FOREIGN KEY(material_id) REFERENCES staging_support_materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staging_inventory_runs (
        id TEXT PRIMARY KEY,
        acervo_dir TEXT NOT NULL,
        total_files_scanned INTEGER NOT NULL,
        eligible_files_count INTEGER NOT NULL,
        excluded_processed_count INTEGER NOT NULL,
        duplicate_hash_count INTEGER NOT NULL,
        unreadable_count INTEGER NOT NULL,
        run_timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            conn.executescript(self.SCHEMA_SQL)


class InventoryManager:
    """Executor do inventário com exclusão estrita e extração de metadados estruturais."""

    def __init__(self, acervo_dir: str, staging_db: StagingDatabase):
        self.acervo_dir = os.path.abspath(acervo_dir)
        self.staging_db = staging_db

    def compute_sha256(self, file_path: str) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def inspect_file(self, full_path: str, rel_path: str) -> Dict[str, Any]:
        file_size = os.path.getsize(full_path)
        sha256 = self.compute_sha256(full_path)
        filename = os.path.basename(full_path)

        doc = pymupdf.open(full_path)
        total_pages = len(doc)
        toc = doc.get_toc()
        has_bookmarks = len(toc) > 0

        # Inspeciona se tem texto selecionável ou é scan puro
        char_count = 0
        pages_with_text = 0
        for i in range(min(5, total_pages)):
            txt = doc[i].get_text()
            char_count += len(txt.strip())
            if len(txt.strip()) > 50:
                pages_with_text += 1

        is_scanned = 1 if (pages_with_text == 0 and char_count < 100) else 0
        has_selectable_text = 1 if is_scanned == 0 else 0

        # Decomposição de metadados a partir do nome e caminho
        # Exemplos:
        # QConcursos_IBGP / IBGP - 2019 - Câmara de Dom Viçoso - MG - Contador.pdf
        # Auditor_Fiscal_2019+ / 2019 - CESPE - SEFAZ_RS - Auditor Fiscal.pdf
        parts_rel = rel_path.split(os.sep)
        doc_family = parts_rel[0] if len(parts_rel) > 1 else "GERAL"

        banca, ano, orgao, cargo = "UNKNOWN", 0, "UNKNOWN", "UNKNOWN"
        name_no_ext = os.path.splitext(filename)[0]
        segments = [s.strip() for s in name_no_ext.split(" - ")]

        if doc_family == "QConcursos_IBGP":
            # Formato padrão: IBGP - [Ano] - [Orgao] - [Cargo]
            banca = "IBGP"
            if len(segments) >= 4:
                try:
                    ano = int(segments[1])
                except ValueError:
                    ano = 0
                orgao = segments[2]
                cargo = " - ".join(segments[3:])
            elif len(segments) >= 2:
                orgao = segments[1]
        elif doc_family == "Auditor_Fiscal_2019+":
            # Formato padrão: [Ano] - [Banca] - [Orgao] - [Cargo]
            if len(segments) >= 4:
                try:
                    ano = int(segments[0])
                except ValueError:
                    ano = 0
                banca = segments[1]
                orgao = segments[2]
                cargo = " - ".join(segments[3:])
            elif len(segments) >= 2:
                banca = segments[0]
                orgao = segments[1]

        # Decomposição de documentos lógicos a partir dos bookmarks (TOC)
        logical_documents = []
        if has_bookmarks:
            # TOC formato: [[lvl, title, page_1_indexed], ...]
            for idx, item in enumerate(toc):
                lvl, title, p_start = item[0], item[1], item[2]
                p_end = total_pages
                if idx + 1 < len(toc):
                    p_end = toc[idx + 1][2] - 1
                if p_end < p_start:
                    p_end = p_start

                title_clean = normalize_str(title).upper()
                doc_role = "PROVA"
                if "EDITAL" in title_clean:
                    doc_role = "EDITAL"
                elif "ALTERA" in title_clean or "RETIF" in title_clean:
                    doc_role = "ALTERACOES"
                elif "GAB" in title_clean:
                    doc_role = "GABARITO_DEFINITIVO" if "DEF" in title_clean else "GABARITO_PRELIMINAR"

                logical_documents.append({
                    "id": str(uuid.uuid4()),
                    "doc_role": doc_role,
                    "page_start": p_start,
                    "page_end": p_end,
                    "banca": banca,
                    "orgao": orgao,
                    "cargo": cargo,
                    "ano": ano,
                    "cargo_codigo": None,
                    "status": "CLASSIFIED",
                })
        else:
            # Sem bookmarks: documento único
            doc_role = "PROVA"
            name_norm = normalize_str(filename).upper()
            if "GAB" in name_norm:
                doc_role = "GABARITO_DEFINITIVO" if "DEF" in name_norm else "GABARITO_PRELIMINAR"
            elif "EDITAL" in name_norm:
                doc_role = "EDITAL"

            logical_documents.append({
                "id": str(uuid.uuid4()),
                "doc_role": doc_role,
                "page_start": 1,
                "page_end": total_pages,
                "banca": banca,
                "orgao": orgao,
                "cargo": cargo,
                "ano": ano,
                "cargo_codigo": None,
                "status": "CLASSIFIED",
            })

        doc.close()

        return {
            "id": str(uuid.uuid4()),
            "rel_path": rel_path.replace(os.sep, "/"),
            "filename": filename,
            "file_size_bytes": file_size,
            "sha256": sha256,
            "total_pages": total_pages,
            "has_selectable_text": has_selectable_text,
            "is_scanned": is_scanned,
            "has_bookmarks": 1 if has_bookmarks else 0,
            "bookmarks_json": json.dumps(toc, ensure_ascii=False) if has_bookmarks else "[]",
            "doc_family": doc_family,
            "banca": banca,
            "ano": ano,
            "orgao": orgao,
            "cargo": cargo,
            "status": "DISCOVERED",
            "logical_documents": logical_documents,
        }

    def run_inventory(self) -> Dict[str, Any]:
        """Executa a descoberta completa do acervo com exclusão da pasta processados."""
        total_scanned = 0
        eligible_files: List[Dict[str, Any]] = []
        excluded_processed: List[str] = []
        unreadable_files: List[Dict[str, str]] = []
        hash_tracker: Dict[str, List[str]] = {}

        for root, dirs, files in os.walk(self.acervo_dir):
            for f in files:
                if not f.lower().endswith(".pdf"):
                    continue
                total_scanned += 1
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, self.acervo_dir)

                # REGRA ESPECIAL: exclusão estrita de 'processados'
                if is_processed_path(full_path):
                    excluded_processed.append(rel_path)
                    continue

                try:
                    meta = self.inspect_file(full_path, rel_path)
                    eligible_files.append(meta)
                    hash_tracker.setdefault(meta["sha256"], []).append(meta["rel_path"])
                except Exception as e:
                    unreadable_files.append({"rel_path": rel_path, "error": str(e)})

        duplicate_hashes = {h: p for h, p in hash_tracker.items() if len(p) > 1}
        duplicate_files_count = sum(len(p) - 1 for p in duplicate_hashes.values())

        # Persistir no banco de staging de forma atômica
        with self.staging_db.get_connection() as conn:
            # Inserir ou atualizar arquivos elegíveis
            for f_meta in eligible_files:
                conn.execute(
                    """
                    INSERT INTO staging_files (
                        id, rel_path, filename, file_size_bytes, sha256, total_pages,
                        has_selectable_text, is_scanned, has_bookmarks, bookmarks_json,
                        doc_family, banca, ano, orgao, cargo, status, updated_at
                    ) VALUES (
                        :id, :rel_path, :filename, :file_size_bytes, :sha256, :total_pages,
                        :has_selectable_text, :is_scanned, :has_bookmarks, :bookmarks_json,
                        :doc_family, :banca, :ano, :orgao, :cargo, :status, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT(rel_path) DO UPDATE SET
                        file_size_bytes=excluded.file_size_bytes,
                        sha256=excluded.sha256,
                        total_pages=excluded.total_pages,
                        has_selectable_text=excluded.has_selectable_text,
                        is_scanned=excluded.is_scanned,
                        has_bookmarks=excluded.has_bookmarks,
                        bookmarks_json=excluded.bookmarks_json,
                        doc_family=excluded.doc_family,
                        banca=excluded.banca,
                        ano=excluded.ano,
                        orgao=excluded.orgao,
                        cargo=excluded.cargo,
                        updated_at=CURRENT_TIMESTAMP
                    """,
                    f_meta,
                )

                # Obter o file_id real do banco (pode ser o inserido ou já existente)
                cur = conn.execute("SELECT id FROM staging_files WHERE rel_path = ?", (f_meta["rel_path"],))
                real_file_id = cur.fetchone()[0]

                # Deletar documentos lógicos antigos para reinserção limpa (idempotente)
                conn.execute("DELETE FROM staging_documents WHERE file_id = ?", (real_file_id,))

                for doc in f_meta["logical_documents"]:
                    doc["file_id"] = real_file_id
                    conn.execute(
                        """
                        INSERT INTO staging_documents (
                            id, file_id, doc_role, page_start, page_end,
                            banca, orgao, cargo, cargo_codigo, ano, status
                        ) VALUES (
                            :id, :file_id, :doc_role, :page_start, :page_end,
                            :banca, :orgao, :cargo, :cargo_codigo, :ano, :status
                        )
                        """,
                        doc,
                    )

            # Gravar registro da rodada de inventário
            run_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO staging_inventory_runs (
                    id, acervo_dir, total_files_scanned, eligible_files_count,
                    excluded_processed_count, duplicate_hash_count, unreadable_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    self.acervo_dir,
                    total_scanned,
                    len(eligible_files),
                    len(excluded_processed),
                    duplicate_files_count,
                    len(unreadable_files),
                ),
            )

        summary = {
            "total_files_scanned": total_scanned,
            "eligible_files_count": len(eligible_files),
            "excluded_processed_count": len(excluded_processed),
            "duplicate_hash_groups": len(duplicate_hashes),
            "duplicate_files_redundant": duplicate_files_count,
            "unreadable_count": len(unreadable_files),
            "unreadable_files": unreadable_files,
            "duplicate_samples": duplicate_hashes,
        }
        return summary

