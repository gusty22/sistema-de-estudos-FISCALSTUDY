import sqlite3

def add_col(con, table, col, col_type):
    try:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        con.commit()
        print(f"Added {col} to {table}")
    except Exception as e:
        print(f"Skip {col} on {table}: {e}")

def migrate():
    con_staging = sqlite3.connect("db/staging.db")
    add_col(con_staging, "staging_questions", "justificativa", "TEXT")
    add_col(con_staging, "staging_questions", "texto_apoio", "TEXT")
    add_col(con_staging, "staging_questions", "texto_apoio_titulo", "TEXT")
    con_staging.close()

    con_prod = sqlite3.connect("db/fiscalstudy.db")
    add_col(con_prod, "questions", "justificativa", "TEXT")
    add_col(con_prod, "questions", "texto_apoio", "TEXT")
    add_col(con_prod, "questions", "texto_apoio_titulo", "TEXT")
    add_col(con_prod, "questions", "status", "TEXT DEFAULT 'VALIDADA'")
    add_col(con_prod, "questions", "numero_original", "INTEGER")
    add_col(con_prod, "questions", "arquivo_origem", "TEXT")
    
    con_prod.execute("UPDATE questions SET status = 'VALIDADA' WHERE status IS NULL")
    con_prod.commit()
    con_prod.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
