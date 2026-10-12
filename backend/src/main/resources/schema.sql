-- schema.sql

CREATE TABLE IF NOT EXISTS event_store (
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
);

-- Tabela questions (estrutura básica representativa para Fase 1)
CREATE TABLE IF NOT EXISTS questions (
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
