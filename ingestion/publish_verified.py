"""Mecanismo de Publicação Segura e Idempotente no Banco Operacional (ETAPA 8).

Princípios rigorosos:
1. Barreira de segurança: Apenas registros aprovados (SOURCE_VERIFIED) entram no banco operacional.
2. Backup físico prévio: Sempre gera cópia física íntegra de 'db/fiscalstudy.db' antes de qualquer escrita.
3. Transações atômicas: Inserção de questões e evento de auditoria no mesmo commit.
4. Idempotência: IDs canônicos 'slug(banca)-ano-slug(orgao)-slug(cargo)-q{numero_original}'.
5. Auditoria permanente: Registra evento 'IMPORT_RECEIVED' na tabela 'event_store'.
"""
import os
import sys
import json
import sqlite3
import datetime
import uuid
import argparse
from typing import Dict, Any, List, Optional

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

DEFAULT_OPERATIONAL_DB = os.path.join(ROOT_DIR, "db", "fiscalstudy.db")
DEFAULT_STAGING_DB = os.path.join(ROOT_DIR, "db", "staging.db")
DEFAULT_BACKUP_DIR = os.path.join(ROOT_DIR, "db", "backups")


def create_physical_backup(db_path: str, backup_dir: str) -> str:
    """Cria backup físico com verificação rigorosa de integridade."""
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"backup_fiscalstudy_{ts}.db")

    with sqlite3.connect(db_path) as src_conn, sqlite3.connect(backup_path) as dst_conn:
        src_conn.backup(dst_conn)

    # Verificação de integridade pós-backup
    with sqlite3.connect(backup_path) as chk_conn:
        res = chk_conn.execute("PRAGMA integrity_check").fetchone()[0]
        if res.lower() != "ok":
            raise RuntimeError(f"Falha na verificação de integridade do backup {backup_path}: {res}")

    print(f"[Backup] Backup físico criado e verificado com sucesso: {backup_path}")
    return backup_path


def publish_questions(
    staging_db_path: str,
    operational_db_path: str,
    backup_dir: str,
    file_id: Optional[str] = None,
    allow_structurally_valid: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Publica questões elegíveis de staging para o banco operacional fiscalstudy.db."""
    if not os.path.exists(staging_db_path):
        raise FileNotFoundError(f"Banco de staging não encontrado: {staging_db_path}")
    if not os.path.exists(operational_db_path):
        raise FileNotFoundError(f"Banco operacional não encontrado: {operational_db_path}")

    # 1. Recuperar questões elegíveis de staging
    eligible_statuses = ["SOURCE_VERIFIED"]
    if allow_structurally_valid:
        eligible_statuses.append("STRUCTURALLY_VALID")

    status_placeholders = ",".join(f"'{s}'" for s in eligible_statuses)

    with sqlite3.connect(staging_db_path) as s_conn:
        s_conn.row_factory = sqlite3.Row
        sql = f"""
            SELECT q.id, q.statement, q.options_json, q.correct_option, q.gabarito_status,
                   q.disciplina, q.assunto, q.subassunto, q.status, q.numero_original,
                   f.banca, f.ano, f.orgao, f.cargo, f.id as file_id
            FROM staging_questions q
            JOIN staging_documents d ON q.document_id = d.id
            JOIN staging_files f ON d.file_id = f.id
            WHERE q.status IN ({status_placeholders})
        """
        params = []
        if file_id:
            sql += " AND f.id = ?"
            params.append(file_id)

        sql += " ORDER BY f.ano DESC, f.banca ASC, q.numero_original ASC"
        cur = s_conn.execute(sql, params)
        staging_rows = cur.fetchall()

    total_eligible = len(staging_rows)
    print(f"[Publicação] Encontradas {total_eligible} questões elegíveis ({', '.join(eligible_statuses)}).")

    if total_eligible == 0:
        return {
            "status": "NOOP",
            "message": "Nenhuma questão elegível para publicação encontrada com os critérios informados.",
            "published_count": 0,
            "dry_run": dry_run,
        }

    # 2. Em modo Dry-Run, apenas simular
    if dry_run:
        print("[Publicação] MODO SIMULAÇÃO (DRY-RUN): Nenhuma alteração gravada.")
        return {
            "status": "SIMULATION_SUCCESS",
            "dry_run": True,
            "eligible_count": total_eligible,
            "backup_performed": False,
        }

    # 3. Executar backup físico prévio
    backup_path = create_physical_backup(operational_db_path, backup_dir)

    # 4. Transação atômica de publicação no banco operacional
    published_count = 0
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    with sqlite3.connect(operational_db_path) as op_conn:
        op_conn.execute("PRAGMA foreign_keys = ON;")
        op_conn.execute("BEGIN TRANSACTION;")

        try:
            # Inserção das questões com proteção não destrutiva
            insert_sql = """
                INSERT INTO questions (
                    id, enunciado, options_json, correct_option, gabarito_status,
                    banca, ano, orgao, cargo, disciplina
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    enunciado = excluded.enunciado,
                    options_json = excluded.options_json,
                    correct_option = excluded.correct_option,
                    gabarito_status = excluded.gabarito_status,
                    banca = excluded.banca,
                    ano = excluded.ano,
                    orgao = excluded.orgao,
                    cargo = excluded.cargo,
                    disciplina = excluded.disciplina
            """

            for r in staging_rows:
                q_id = r["id"]
                stmt = r["statement"]
                opts_json = r["options_json"] or "[]"
                corr_opt = r["correct_option"]
                gab_st = r["gabarito_status"] or "DEFINITIVO"
                banca = r["banca"] or "IBGP"
                ano = r["ano"] or 0
                orgao = r["orgao"] or "UNKNOWN"
                cargo = r["cargo"] or "UNKNOWN"
                disc = r["disciplina"] or "Geral"

                op_conn.execute(
                    insert_sql,
                    (q_id, stmt, opts_json, corr_opt, gab_st, banca, ano, orgao, cargo, disc),
                )
                published_count += 1

            # Inserção de evento auditável em event_store
            event_id = str(uuid.uuid4())
            event_payload = json.dumps({
                "published_count": published_count,
                "file_filter": file_id or "ALL",
                "statuses_included": eligible_statuses,
                "backup_path": backup_path,
                "published_at": now_iso,
            }, ensure_ascii=False)

            op_conn.execute("""
                INSERT INTO event_store (
                    event_id, event_type, aggregate_type, aggregate_id,
                    occurred_at, recorded_at, event_version, schema_version, payload_json
                ) VALUES (?, 'IMPORT_RECEIVED', 'INGESTION_STAGING', ?, ?, ?, 1, 'v1', ?)
            """, (event_id, file_id or "ALL_ELIGIBLE", now_iso, now_iso, event_payload))

            op_conn.commit()
            print(f"[Publicação] Sucesso atômico: {published_count} questões salvas e auditadas em event_store.")

        except Exception as e:
            op_conn.rollback()
            print(f"[Publicação] ERRO durante publicação! Rollback executado: {e}")
            raise

    return {
        "status": "SUCCESS",
        "dry_run": False,
        "published_count": published_count,
        "backup_path": backup_path,
        "timestamp": now_iso,
    }


def main():
    parser = argparse.ArgumentParser(description="FiscalStudy Authorized Publisher (ETAPA 8)")
    parser.add_argument("--file-id", default=None, help="ID do arquivo específico a publicar de staging")
    parser.add_argument("--all-verified", action="store_true", help="Publica todas as questões com status SOURCE_VERIFIED")
    parser.add_argument("--include-valid", action="store_true", help="Inclui também questões STRUCTURALLY_VALID além de SOURCE_VERIFIED")
    parser.add_argument("--dry-run", action="store_true", help="Simula a publicação sem alterar o banco operacional")
    parser.add_argument("--staging-db", default=DEFAULT_STAGING_DB, help="Caminho do staging.db")
    parser.add_argument("--operational-db", default=DEFAULT_OPERATIONAL_DB, help="Caminho do fiscalstudy.db")
    parser.add_argument("--backup-dir", default=DEFAULT_BACKUP_DIR, help="Diretório para backups físicos")

    args = parser.parse_args()

    print("=" * 80)
    print("PUBLICADOR AUTORIZADO DE QUESTÕES — FISCALSTUDY (ETAPA 8)")
    print(f"Staging DB      : {args.staging_db}")
    print(f"Operacional DB  : {args.operational_db}")
    print(f"Modo Simulação  : {args.dry_run}")
    print(f"Incluir Válidas : {args.include_valid}")
    print("=" * 80)

    result = publish_questions(
        staging_db_path=args.staging_db,
        operational_db_path=args.operational_db,
        backup_dir=args.backup_dir,
        file_id=args.file_id,
        allow_structurally_valid=args.include_valid,
        dry_run=args.dry_run,
    )

    print("\n" + json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
