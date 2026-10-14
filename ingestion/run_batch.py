"""Script CLI para execução do Processamento em Lote do FiscalStudy (ETAPA 4).

Permite:
- Execução de lotes controlados (ex: --limit 10, --limit 50, --all).
- Checkpoints e retomada automática do ponto onde parou.
- Isolamento total no banco db/staging.db.
- Geração de relatório de execução estruturado.
"""
import os
import sys
import json
import argparse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

INGESTION_DIR = os.path.dirname(os.path.abspath(__file__))
if INGESTION_DIR not in sys.path:
    sys.path.insert(0, INGESTION_DIR)

from src.pipeline.batch_processor import BatchProcessor

DEFAULT_ACERVO = r"c:\Users\washi\Downloads\provas"
DEFAULT_DB = os.path.abspath(os.path.join(INGESTION_DIR, "..", "db", "staging.db"))
DEFAULT_OUT_REPORT = os.path.abspath(os.path.join(INGESTION_DIR, "..", "db", "batch_run_report.json"))

def main():
    parser = argparse.ArgumentParser(description="FiscalStudy Batch Ingestion Processor")
    parser.add_argument("--limit", type=int, default=None, help="Quantidade máxima de arquivos a processar neste lote")
    parser.add_argument("--file-id", default=None, help="Processa um arquivo específico por ID")
    parser.add_argument("--force", action="store_true", help="Reprocessa mesmo se o arquivo já estiver marcado como EXTRACTED")
    parser.add_argument("--staging-db", default=DEFAULT_DB, help="Caminho do banco SQLite de staging")
    parser.add_argument("--acervo-dir", default=DEFAULT_ACERVO, help="Caminho raiz do acervo")
    parser.add_argument("--output-json", default=DEFAULT_OUT_REPORT, help="Caminho para salvar o relatório de execução")

    args = parser.parse_args()

    print("=" * 80)
    print("EXECUTANDO PROCESSADOR EM LOTE DO FISCALSTUDY (ETAPA 4)")
    print(f"Banco de Staging : {args.staging_db}")
    print(f"Acervo           : {args.acervo_dir}")
    print(f"Limite do lote   : {args.limit if args.limit else 'Todos os pendentes'}")
    print(f"Modo Forçado     : {args.force}")
    print("=" * 80)

    processor = BatchProcessor(args.staging_db, args.acervo_dir)
    summary = processor.run_batch(limit=args.limit, force=args.force, file_id=args.file_id)

    os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nRelatório de execução salvo em: {args.output_json}")

if __name__ == "__main__":
    main()
