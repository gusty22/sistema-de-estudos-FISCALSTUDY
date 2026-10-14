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

-- Tabela concursos (Fase 2 - Plataforma Multiconcursos)
CREATE TABLE IF NOT EXISTS concursos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    orgao TEXT NOT NULL,
    banca TEXT,
    ano INTEGER,
    cargo TEXT,
    cargo_codigo TEXT,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
    descricao TEXT,
    situacao TEXT DEFAULT 'PREVISTO', -- PREVISTO, AUTORIZADO, COMISSAO_FORMADA, BANCA_DEFINIDA, EDITAL_PUBLICADO, INSCRICOES_ABERTAS, PROVA_AGENDADA, PROVA_REALIZADA, ENCERRADO
    localidade TEXT,
    escolaridade TEXT,
    vagas INTEGER,
    salario REAL,
    link_edital TEXT,
    data_prova TEXT,
    data_prova_tipo TEXT DEFAULT 'INFORMADA_PELO_USUARIO', -- OFICIAL, PREVISTA, INFORMADA_PELO_USUARIO
    datas_importantes_json TEXT,
    disponibilidade_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabela editais e retificações (Fase 3 - Edital e Conteúdo Programático)
CREATE TABLE IF NOT EXISTS editais (
    id TEXT PRIMARY KEY,
    concurso_id TEXT NOT NULL,
    titulo TEXT NOT NULL,
    versao TEXT NOT NULL DEFAULT '1.0',
    tipo TEXT NOT NULL DEFAULT 'ORIGINAL', -- ORIGINAL, ANEXO, RETIFICACAO
    filename TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabela edital_topicos (Fase 3 - Edital Verticalizado Editável)
CREATE TABLE IF NOT EXISTS edital_topicos (
    id TEXT PRIMARY KEY,
    edital_id TEXT NOT NULL,
    concurso_id TEXT NOT NULL,
    disciplina TEXT NOT NULL,
    assunto TEXT NOT NULL,
    subassunto TEXT,
    peso REAL DEFAULT 1.0,
    questoes_previstas INTEGER,
    doc_origem TEXT,
    pagina_origem INTEGER,
    trecho_origem TEXT,
    tipo_classificacao TEXT DEFAULT 'EXPLICITA', -- EXPLICITA, INFERIDA, CONFIRMADA
    confirmado_humano INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabela materiais de apoio compartilhados (Fase 5 - Textos-base, tabelas, figuras)
CREATE TABLE IF NOT EXISTS support_materials (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL, -- TEXTO_BASE, TABELA, GRAFICO, FIGURA, FORMULA, MAPA, ESTUDO_DE_CASO
    titulo TEXT,
    conteudo_texto TEXT,
    media_path TEXT,
    doc_origem TEXT,
    pagina_inicio INTEGER,
    pagina_fim INTEGER,
    coordenadas_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Associação N:M entre questões e materiais de apoio
CREATE TABLE IF NOT EXISTS question_support_materials (
    question_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    PRIMARY KEY(question_id, material_id)
);
