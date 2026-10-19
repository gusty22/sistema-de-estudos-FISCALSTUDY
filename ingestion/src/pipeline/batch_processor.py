"""Processador em Lote com Checkpointing e Retomada para o FiscalStudy (ETAPA 4).

Responsabilidades:
- Leitura incremental dos arquivos elegíveis em 'staging_files' (db/staging.db).
- Isolamento estrito de falhas: um arquivo problemático nunca aborta o restante do lote.
- Checkpointing transacional: cada arquivo concluído comita seu estado imediatamente.
- Mecanismo de retomada: reinicia exatamente onde parou, ignorando arquivos já extraídos.
- Pareamento universal de gabaritos e rotulagem estrita de flags de risco.
- Persistência das questões estruturadas em 'staging_questions' com chaves canônicas idempotentes.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

import pymupdf

# Ajuste de path para importação dos módulos irmãos
PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
INGESTION_DIR = os.path.dirname(os.path.dirname(PIPELINE_DIR))
if INGESTION_DIR not in sys.path:
    sys.path.insert(0, INGESTION_DIR)

from src.pipeline.inventory_manager import slugify
from src.pipeline.universal_extractor import (
    UniversalExtractor,
    detect_contextual_suspect_chars,
    detect_exam_metadata_from_cover,
    extract_targeted_answer_key,
    parse_answer_key_universal,
)
from src.pipeline.question_image_extractor import extract_question_images


class BatchProcessor:
    """Orquestrador do processamento em lotes com garantia de isolamento e persistência."""

    def __init__(self, staging_db_path: str, acervo_dir: str):
        self.staging_db_path = os.path.abspath(staging_db_path)
        self.acervo_dir = os.path.abspath(acervo_dir)

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.staging_db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def fetch_pending_files(self, limit: Optional[int] = None, force: bool = False, file_id: Optional[str] = None) -> List[sqlite3.Row]:
        with self.get_connection() as conn:
            if file_id:
                cur = conn.execute("SELECT * FROM staging_files WHERE id = ?", (file_id,))
                return cur.fetchall()

            if force:
                query = "SELECT * FROM staging_files ORDER BY doc_family, rel_path"
            else:
                query = "SELECT * FROM staging_files WHERE status IN ('DISCOVERED', 'FAILED', 'PROCESSING') ORDER BY doc_family, rel_path"

            if limit and limit > 0:
                query += f" LIMIT {limit}"

            cur = conn.execute(query)
            return cur.fetchall()

    def process_single_file(self, file_row: sqlite3.Row) -> Dict[str, Any]:
        file_id = file_row["id"]
        rel_path = file_row["rel_path"]
        full_path = os.path.join(self.acervo_dir, rel_path.replace("/", os.sep))
        banca = file_row["banca"] or "IBGP"
        ano = file_row["ano"] or 0
        orgao = file_row["orgao"] or "UNKNOWN"
        cargo = file_row["cargo"] or "UNKNOWN"

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Arquivo físico não encontrado no acervo: {full_path}")

        # Marcar status como PROCESSING
        with self.get_connection() as conn:
            conn.execute("UPDATE staging_files SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (file_id,))

        # Buscar documentos lógicos cadastrados no inventário
        with self.get_connection() as conn:
            cur = conn.execute("SELECT * FROM staging_documents WHERE file_id = ? ORDER BY page_start", (file_id,))
            docs = cur.fetchall()

        prova_doc = next((d for d in docs if d["doc_role"] == "PROVA"), None)
        gab_doc = next((d for d in docs if "GABARITO" in d["doc_role"]), None)

        if not prova_doc:
            # Arquivo não contém caderno de prova (ex: edital puro ou gabarito isolado)
            with self.get_connection() as conn:
                conn.execute(
                    "UPDATE staging_files SET status = 'NO_QUESTIONS_FOUND', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (file_id,),
                )
            return {
                "file_id": file_id,
                "rel_path": rel_path,
                "banca": banca,
                "total_questions": 0,
                "structurally_valid": 0,
                "needs_review": 0,
                "gabaritos_matched": 0,
                "status": "SUCCESS",
                "notes": "Arquivo sem caderno de prova (edital/gabarito puro)",
            }

        p_start = prova_doc["page_start"]
        p_end = prova_doc["page_end"]
        prova_doc_id = prova_doc["id"]

        doc_pdf = None
        try:
            doc_pdf = pymupdf.open(full_path)
            # 1. Detectar metadados da capa (código de cargo e tipo de prova)
            cover_meta = detect_exam_metadata_from_cover(doc_pdf, p_start=p_start)
            target_code = cover_meta.get("cargo_codigo")
            target_prova = cover_meta.get("tipo_prova")

            # 2. Extração estruturada de questões e materiais de apoio
            extractor = UniversalExtractor(banca=banca)
            questions, support_mats = extractor.extract_questions_from_span(
                doc_pdf,
                p_start=p_start,
                p_end=p_end,
                metadata={"banca": banca, "ano": ano, "orgao": orgao, "cargo": cargo},
            )

            # 2.1 Extração e otimização de imagens vinculadas aos enunciados
            assets_dir = os.path.join(os.path.dirname(self.staging_db_path), "assets")
            image_mats = extract_question_images(
                doc_pdf,
                questions,
                assets_dir=assets_dir,
                p_start=p_start,
                p_end=p_end
            )
            if image_mats:
                support_mats.extend(image_mats)

            # 3. Extração e pareamento direcionado do gabarito oficial do cargo
            gab_answers: Dict[int, str] = {}
            gab_status = "AUSENTE"
            if gab_doc:
                g_start, g_end = gab_doc["page_start"], gab_doc["page_end"]
                gab_answers, gab_status = extract_targeted_answer_key(
                    doc_pdf,
                    g_start,
                    g_end,
                    target_cargo=cargo,
                    target_code=target_code,
                    target_prova=target_prova,
                )

            # 4. Validação de qualidade, cálculo de flags e estruturação final
            persisted_questions = []
            valid_count = 0
            needs_review_count = 0

            # Mapeamento prévio de questões que possuem material de apoio vinculado
            covered_questions = set()
            for sm in support_mats:
                for q_num in sm.get("applies_to_questions", []):
                    covered_questions.add(q_num)

            for q in questions:
                num = q["numero_original"]
                statement = q["statement"]
                options = q.get("options", [])
                pages = q.get("pages", [p_start])
                disciplina = q.get("disciplina", "Geral")

                # Gabarito pareado (do documento de gabarito ou inferido do texto comentado)
                correct_opt = gab_answers.get(num) or q.get("correct_option")
                q_gab_status = "DEFINITIVO" if correct_opt else "AUSENTE"
                if correct_opt == "ANULADA":
                    q_gab_status = "ANULADA"

                justificativa = q.get("justificativa")
                texto_apoio = q.get("texto_apoio")
                texto_apoio_titulo = q.get("texto_apoio_titulo")

                # Avaliação de flags de risco
                flags = []
                if len(statement) < 15:
                    flags.append("STATEMENT_TOO_SHORT")
                if not correct_opt:
                    flags.append("OFFICIAL_ANSWER_KEY_MISSING")
                if len(options) < 4 and len(options) != 2: # 2 alternativas permitido para C/E
                    flags.append(f"OPTIONS_INCOMPLETE:{len(options)}")
                if detect_contextual_suspect_chars(statement):
                    flags.append("SUSPECT_OCR")

                # Verificar se enunciado exige texto de apoio mas não está coberto
                if not texto_apoio and num not in covered_questions and re.search(
                    r"\b(?:no texto|do texto|segundo o texto|conforme o texto|o texto acima|a tabela acima|o gr[aá]fico)\b",
                    statement,
                    re.IGNORECASE,
                ):
                    flags.append("SUPPORT_MATERIAL_MISSING")

                # Status de validação
                status = "NEEDS_REVIEW" if flags else "STRUCTURALLY_VALID"
                if status == "STRUCTURALLY_VALID":
                    valid_count += 1
                else:
                    needs_review_count += 1

                # Chave canônica unívoca e idempotente
                canonical_id = f"{slugify(banca)}-{ano}-{slugify(orgao)}-{slugify(cargo)}-q{num}"

                persisted_questions.append({
                    "id": canonical_id,
                    "document_id": prova_doc_id,
                    "numero_original": num,
                    "statement": statement,
                    "options_json": json.dumps(options, ensure_ascii=False),
                    "correct_option": correct_opt,
                    "gabarito_status": q_gab_status,
                    "disciplina": disciplina,
                    "assunto": None,
                    "subassunto": None,
                    "edital_topico_id": None,
                    "status": status,
                    "flags_json": json.dumps(flags, ensure_ascii=False),
                    "pages_json": json.dumps(pages),
                    "evidence_image_path": None,
                    "justificativa": justificativa,
                    "texto_apoio": texto_apoio,
                    "texto_apoio_titulo": texto_apoio_titulo,
                })

            # 5. Gravação atômica no banco de staging
            with self.get_connection() as conn:
                # Remove registros anteriores deste documento (idempotência transacional)
                conn.execute(
                    "DELETE FROM staging_question_support_materials WHERE question_id IN (SELECT id FROM staging_questions WHERE document_id = ?)",
                    (prova_doc_id,),
                )
                conn.execute("DELETE FROM staging_support_materials WHERE document_id = ?", (prova_doc_id,))
                conn.execute("DELETE FROM staging_questions WHERE document_id = ?", (prova_doc_id,))

                for pq in persisted_questions:
                    conn.execute(
                        """
                        INSERT INTO staging_questions (
                            id, document_id, numero_original, statement, options_json,
                            correct_option, gabarito_status, disciplina, assunto, subassunto,
                            edital_topico_id, status, flags_json, pages_json, evidence_image_path,
                            justificativa, texto_apoio, texto_apoio_titulo,
                            updated_at
                        ) VALUES (
                            :id, :document_id, :numero_original, :statement, :options_json,
                            :correct_option, :gabarito_status, :disciplina, :assunto, :subassunto,
                            :edital_topico_id, :status, :flags_json, :pages_json, :evidence_image_path,
                            :justificativa, :texto_apoio, :texto_apoio_titulo,
                            CURRENT_TIMESTAMP
                        )
                        """,
                        pq,
                    )

                # Persistir materiais de apoio e vincular às questões correspondentes
                for sm in support_mats:
                    sm_id = sm.get("id") or str(uuid.uuid4())
                    conn.execute(
                        """
                        INSERT INTO staging_support_materials (
                            id, document_id, tipo, titulo, conteudo_texto, media_path,
                            pagina_inicio, pagina_fim, coordenadas_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        (
                            sm_id,
                            prova_doc_id,
                            sm.get("tipo", "TEXTO_BASE"),
                            sm.get("titulo"),
                            sm.get("conteudo_texto"),
                            sm.get("media_path"),
                            sm.get("pagina_inicio"),
                            sm.get("pagina_fim"),
                            sm.get("coordenadas_json"),
                        ),
                    )

                    persisted_q_ids = {pq["id"] for pq in persisted_questions}
                    for q_num in sm.get("applies_to_questions", []):
                        q_id = f"{slugify(banca)}-{ano}-{slugify(orgao)}-{slugify(cargo)}-q{q_num}"
                        if q_id in persisted_q_ids:
                            conn.execute(
                                """
                                INSERT OR IGNORE INTO staging_question_support_materials (question_id, material_id)
                                VALUES (?, ?)
                                """,
                                (q_id, sm_id),
                            )

                # Atualiza status do arquivo para EXTRACTED
                file_status = "EXTRACTED" if len(persisted_questions) > 0 else "NO_QUESTIONS_FOUND"
                conn.execute(
                    "UPDATE staging_files SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (file_status, file_id),
                )

            return {
                "file_id": file_id,
                "rel_path": rel_path,
                "banca": banca,
                "total_questions": len(persisted_questions),
                "structurally_valid": valid_count,
                "needs_review": needs_review_count,
                "gabaritos_matched": sum(1 for q in persisted_questions if q["correct_option"]),
                "status": "SUCCESS",
            }
        except Exception as e:
            with self.get_connection() as conn:
                conn.execute(
                    "UPDATE staging_files SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (file_id,),
                )
            return {
                "file_id": file_id,
                "rel_path": rel_path,
                "status": "FAILED",
                "error": str(e),
                "total_questions": 0,
                "structurally_valid": 0,
                "needs_review": 0,
                "gabaritos_matched": 0,
            }
        finally:
            if doc_pdf is not None:
                doc_pdf.close()

    def run_batch(self, limit: Optional[int] = None, force: bool = False, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Executa um lote de processamento com checkpoints."""
        pending_files = self.fetch_pending_files(limit=limit, force=force, file_id=file_id)
        total_pending = len(pending_files)

        print(f"\n[BatchProcessor] Iniciando lote de {total_pending} arquivos elegíveis.")
        start_time = time.time()

        processed_count = 0
        success_count = 0
        failed_count = 0
        total_extracted_questions = 0
        results_summary = []

        for idx, file_row in enumerate(pending_files, 1):
            rel_path = file_row["rel_path"]
            filename = file_row["filename"]
            print(f"  ({idx}/{total_pending}) Processando: {filename[:60]}...")

            try:
                res = self.process_single_file(file_row)
                if res.get("status") == "SUCCESS":
                    success_count += 1
                    total_extracted_questions += res["total_questions"]
                    print(f"     -> OK: {res['total_questions']} questões (Válidas: {res['structurally_valid']} | Revisão: {res['needs_review']} | Gabaritos: {res['gabaritos_matched']})")
                else:
                    failed_count += 1
                    print(f"     -> FALHA: {res.get('error')}")
                results_summary.append(res)
            except Exception as e:
                failed_count += 1
                print(f"     -> ERRO: {e}")
                # Registrar falha em staging_files sem abortar o lote
                with self.get_connection() as conn:
                    conn.execute(
                        "UPDATE staging_files SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (file_row["id"],),
                    )
                results_summary.append({
                    "file_id": file_row["id"],
                    "rel_path": rel_path,
                    "status": "FAILED",
                    "error": str(e),
                })

            processed_count += 1

        elapsed = time.time() - start_time
        summary = {
            "total_files_in_batch": total_pending,
            "processed_successfully": success_count,
            "failed_count": failed_count,
            "total_questions_extracted": total_extracted_questions,
            "elapsed_seconds": round(elapsed, 2),
            "results": results_summary,
        }

        print("\n" + "=" * 80)
        print("LOTE DE PROCESSAMENTO CONCLUÍDO:")
        print(f"  - Arquivos processados com sucesso : {success_count}/{total_pending}")
        print(f"  - Falhas registradas               : {failed_count}")
        print(f"  - Total de questões estruturadas   : {total_extracted_questions}")
        print(f"  - Tempo total                      : {elapsed:.2f} segundos")
        print("=" * 80)

        return summary

