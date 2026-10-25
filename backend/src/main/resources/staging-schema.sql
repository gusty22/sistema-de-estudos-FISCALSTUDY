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
