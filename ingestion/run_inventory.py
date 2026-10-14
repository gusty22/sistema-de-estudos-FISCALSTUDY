"""Script CLI para execução do Inventário e Descoberta Segura do Acervo.

Executa:
1. Inicialização do banco isolado db/staging.db
2. Descoberta estrita de arquivos elegíveis em c:\\Users\\washi\\Downloads\\provas
3. Exclusão de qualquer pasta 'processados'
4. Decomposição de documentos lógicos
5. Geração de sumário executivo em JSON e no console
"""
import os
import sys
import json
import argparse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Adiciona o diretório ingestion ao PYTHONPATH
INGESTION_DIR = os.path.dirname(os.path.abspath(__file__))
if INGESTION_DIR not in sys.path:
    sys.path.insert(0, INGESTION_DIR)

from src.pipeline.inventory_manager import StagingDatabase, InventoryManager

DEFAULT_ACERVO = r"c:\Users\washi\Downloads\provas"
DEFAULT_DB = os.path.abspath(os.path.join(INGESTION_DIR, "..", "db", "staging.db"))
DEFAULT_OUT_REPORT = os.path.abspath(os.path.join(INGESTION_DIR, "..", "db", "inventory_report.json"))

def main():
    parser = argparse.ArgumentParser(description="FiscalStudy Acervo Safe Discovery & Inventory")
    parser.add_argument("--acervo-dir", default=DEFAULT_ACERVO, help="Caminho do acervo de PDFs")
    parser.add_argument("--staging-db", default=DEFAULT_DB, help="Caminho do banco SQLite de staging")
    parser.add_argument("--output-json", default=DEFAULT_OUT_REPORT, help="Caminho do relatório JSON")

    args = parser.parse_args()

    print("=" * 80)
    print("INICIANDO INVENTÁRIO DO ACERVO FISCALSTUDY (ETAPA 2)")
    print(f"Diretório do Acervo : {args.acervo_dir}")
    print(f"Banco de Staging    : {args.staging_db}")
    print("=" * 80)

    db = StagingDatabase(args.staging_db)
    manager = InventoryManager(args.acervo_dir, db)

    summary = manager.run_inventory()

    # Salva relatório JSON
    os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\nRESUMO DO INVENTÁRIO:")
    print(f"  - Total de arquivos PDF escaneados no acervo : {summary['total_files_scanned']}")
    print(f"  - PDFs Elegíveis cadastrados no Staging      : {summary['eligible_files_count']}")
    print(f"  - PDFs Excluídos (pertencentes a 'processados'): {summary['excluded_processed_count']}")
    print(f"  - Grupos de Hash duplicados entre elegíveis  : {summary['duplicate_hash_groups']} ({summary['duplicate_files_redundant']} redundantes)")
    print(f"  - Arquivos com problemas de leitura          : {summary['unreadable_count']}")
    print(f"\nRelatório completo salvo em: {args.output_json}")
    print(f"Banco de staging atualizado: {args.staging_db}")

if __name__ == "__main__":
    main()
