-- ======================================================================================
-- V1__init_cognitive_platform_schema.sql
-- FiscalStudy - Plataforma Inteligente de Preparação para Concursos
-- PostgreSQL 16+ com pgvector e Arquitetura Cognitiva FSRS / MVT
-- ======================================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. TIPOS ENUMERADOS (DOMÍNIO COGNITIVO E DE PROVENIÊNCIA)
CREATE TYPE question_origin_type AS ENUM (
    'OFFICIAL_EXAM',
    'AI_ISOMORPHIC_VARIATION',
    'AI_ORIGINAL',
    'EXTERNAL_TELEMETRY_STUB'
);

CREATE TYPE question_format_type AS ENUM (
    'MULTIPLE_CHOICE_5',
    'MULTIPLE_CHOICE_4',
    'TRUE_FALSE_CEBRASPE'
);

CREATE TYPE question_lifecycle_status AS ENUM (
    'ACTIVE',
    'ANNULLED_BY_BOARD',
    'OUTDATED_LAW',
    'PENDING_HUMAN_REVIEW'
);

CREATE TYPE question_similarity_type AS ENUM (
    'EXACT_DUPLICATE',
    'NEAR_DUPLICATE_CLONE',
    'SAME_CONCEPT_VARIANT'
);

CREATE TYPE proficiency_stage_type AS ENUM (
    'STAGE_1_BEGINNER',
    'STAGE_2_CONSOLIDATION',
    'STAGE_3_MASTERY'
);

CREATE TYPE confidence_level_type AS ENUM (
    'CERTAIN',
    'DOUBT_BETWEEN_TWO',
    'BLIND_GUESS'
);

CREATE TYPE error_category_type AS ENUM (
    'NONE',
    'THEORETICAL_GAP',
    'LAW_LITERALNESS_FORGOTTEN',
    'BOARD_TRAP_INTERPRETATION',
    'LACK_OF_ATTENTION_RUSH'
);

CREATE TYPE telemetry_source_provider AS ENUM (
    'NATIVE_PLATFORM',
    'TEC_TAMPERMONKEY_BRIDGE'
);

CREATE TYPE error_notebook_status AS ENUM (
    'ACTIVE_ERROR',
    'MASTERED'
);

CREATE TYPE study_block_modality AS ENUM (
    'BLOCKED_PRACTICE',
    'REVERSE_STUDY_QUESTIONS',
    'INTERLEAVED_PRACTICE',
    'SPACED_REVIEW_BATTERY',
    'THEORY_SURGICAL_READING'
);

-- ======================================================================================
-- 3. TAXONOMIA CANÔNICA, LEI SECA E EDITAIS (SEÇÃO 3.1)
-- ======================================================================================

-- 3.1.1. Disciplinas Canônicas
CREATE TABLE IF NOT EXISTS canonical_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(160) NOT NULL UNIQUE,
    area VARCHAR(100) NOT NULL, -- FISCAL, JURIDICA, CONTABIL, EXATAS, GERAL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1.2. Árvore Hierárquica Canônica de Assuntos
CREATE TABLE IF NOT EXISTS canonical_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES canonical_subjects(id) ON DELETE CASCADE,
    parent_topic_id UUID REFERENCES canonical_topics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code_path VARCHAR(255), -- Ex: 'DIR_TRIB.CRED_TRIB.LANCAMENTO'
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1.3. Dispositivos e Mapeamento de Lei Seca
CREATE TABLE IF NOT EXISTS legislation_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    law_name VARCHAR(150) NOT NULL, -- Ex: 'CTN', 'CF/88', 'LC 116/03'
    article VARCHAR(50) NOT NULL,
    paragraph VARCHAR(50),
    inciso VARCHAR(50),
    alinea VARCHAR(20),
    full_text TEXT NOT NULL,
    incidence_count INT NOT NULL DEFAULT 0,
    hot_keywords_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1.4. Concursos / Editais do Aluno
CREATE TABLE IF NOT EXISTS target_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    banca_name VARCHAR(100),
    orgao VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    exam_date DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, COMPLETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1.5. Itens do Edital Verticalizado
CREATE TABLE IF NOT EXISTS syllabus_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_exam_id UUID NOT NULL REFERENCES target_exams(id) ON DELETE CASCADE,
    canonical_topic_id UUID NOT NULL REFERENCES canonical_topics(id) ON DELETE RESTRICT,
    raw_edital_text TEXT NOT NULL,
    subject_weight DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    min_score_cutoff DECIMAL(5,2) DEFAULT 0.0,
    historical_incidence_weight DECIMAL(5,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1.6. De-Para Dinâmico com Plataformas Externas
CREATE TABLE IF NOT EXISTS external_taxonomy_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name VARCHAR(50) NOT NULL DEFAULT 'TEC_CONCURSOS',
    external_subject_name VARCHAR(200) NOT NULL,
    external_topic_name VARCHAR(255) NOT NULL,
    external_notebook_url TEXT,
    canonical_topic_id UUID NOT NULL REFERENCES canonical_topics(id) ON DELETE CASCADE,
    confidence_score DECIMAL(4,3) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_name, external_subject_name, external_topic_name)
);

-- ======================================================================================
-- 4. BANCO DE QUESTÕES PRÓPRIO E PROVENIÊNCIA (SEÇÃO 3.2)
-- ======================================================================================

-- 4.1. Provas Reais Originais
CREATE TABLE IF NOT EXISTS exam_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    banca VARCHAR(100) NOT NULL,
    orgao VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    year INT NOT NULL,
    exam_date DATE,
    exam_pdf_sha256 VARCHAR(64) NOT NULL,
    gabarito_pdf_sha256 VARCHAR(64),
    source_url TEXT,
    ingestion_status VARCHAR(50) DEFAULT 'PROCESSED', -- PENDING, PROCESSED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.2. Questões (Core)
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_type question_origin_type NOT NULL,
    exam_source_id UUID REFERENCES exam_sources(id) ON DELETE SET NULL,
    parent_question_id UUID REFERENCES questions(id) ON DELETE SET NULL, -- Para variações isomórficas
    external_provider_id VARCHAR(100), -- Ex: 'TEC:1928374'
    question_number_in_exam INT,
    question_type question_format_type NOT NULL,
    statement_markdown TEXT NOT NULL,
    statement_assets_json JSONB DEFAULT '[]'::jsonb, -- Coordenadas e paths de figuras/tabelas
    canonical_topic_id UUID REFERENCES canonical_topics(id) ON DELETE SET NULL,
    legislation_device_id UUID REFERENCES legislation_devices(id) ON DELETE SET NULL,
    classification_confidence DECIMAL(4,3) DEFAULT 1.0,
    status question_lifecycle_status NOT NULL DEFAULT 'ACTIVE',
    official_answer CHAR(1), -- 'A', 'B', 'C', 'D', 'E', 'C', 'E'
    rationale_markdown TEXT,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.3. Alternativas das Questões
CREATE TABLE IF NOT EXISTS question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    original_letter CHAR(1) NOT NULL, -- 'A', 'B', 'C', 'D', 'E'
    option_text_markdown TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    distractor_pattern_tag VARCHAR(100), -- Ex: 'INVERTED_PREMISE', 'EXHAUSTIVE_MODIFIER'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.4. Arestas de Similaridade Semântica e Gêmeas
CREATE TABLE IF NOT EXISTS question_similarity_edges (
    question_a_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    question_b_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    cosine_similarity DECIMAL(4,3) NOT NULL,
    relationship_type question_similarity_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(question_a_id, question_b_id),
    CHECK (question_a_id <> question_b_id)
);

-- ======================================================================================
-- 5. TELEMETRIA COGNITIVA, FSRS E CICLO DE ESTUDOS (SEÇÃO 3.3)
-- ======================================================================================

-- 5.1. Domínio de Tópico por Usuário (FSRS Model)
CREATE TABLE IF NOT EXISTS user_topic_mastery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    canonical_topic_id UUID NOT NULL REFERENCES canonical_topics(id) ON DELETE CASCADE,
    proficiency_stage proficiency_stage_type NOT NULL DEFAULT 'STAGE_1_BEGINNER',
    fsrs_difficulty DECIMAL(5,3) NOT NULL DEFAULT 5.0,
    fsrs_stability DECIMAL(7,3) NOT NULL DEFAULT 0.0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    next_review_due_at TIMESTAMP WITH TIME ZONE,
    consecutive_relearning_successes INT NOT NULL DEFAULT 0,
    raw_accuracy DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    confidence_adjusted_mastery DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    total_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, canonical_topic_id)
);

-- 5.2. Telemetria de Tentativas e Resoluções
CREATE TABLE IF NOT EXISTS question_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    study_session_id UUID,
    source_provider telemetry_source_provider NOT NULL DEFAULT 'NATIVE_PLATFORM',
    selected_option_id UUID REFERENCES question_options(id) ON DELETE SET NULL,
    is_correct BOOLEAN NOT NULL,
    confidence_level confidence_level_type NOT NULL,
    error_category error_category_type DEFAULT 'NONE',
    eliminated_options_json JSONB DEFAULT '[]'::jsonb,
    time_spent_seconds INT NOT NULL DEFAULT 0,
    self_explanation_note TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.3. Caderno de Erros Estruturado
CREATE TABLE IF NOT EXISTS error_notebook_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    canonical_topic_id UUID NOT NULL REFERENCES canonical_topics(id) ON DELETE CASCADE,
    error_category error_category_type NOT NULL,
    user_diagnostic_note TEXT,
    key_takeaway_flashcard_front TEXT,
    key_takeaway_flashcard_back TEXT,
    fsrs_difficulty DECIMAL(5,3) NOT NULL DEFAULT 5.0,
    fsrs_stability DECIMAL(7,3) NOT NULL DEFAULT 0.0,
    next_review_due_at TIMESTAMP WITH TIME ZONE,
    resolved_count INT NOT NULL DEFAULT 0,
    status error_notebook_status NOT NULL DEFAULT 'ACTIVE_ERROR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.4. Ciclo de Estudos Global
CREATE TABLE IF NOT EXISTS study_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    target_exam_id UUID NOT NULL REFERENCES target_exams(id) ON DELETE CASCADE,
    weekly_hours_available DECIMAL(5,2) NOT NULL DEFAULT 24.0,
    standard_block_minutes INT NOT NULL DEFAULT 50,
    active_cycle_index INT NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.5. Blocos do Ciclo de Estudos
CREATE TABLE IF NOT EXISTS study_cycle_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES study_cycles(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    canonical_topic_id UUID NOT NULL REFERENCES canonical_topics(id) ON DELETE CASCADE,
    modality study_block_modality NOT NULL,
    target_minutes INT NOT NULL,
    target_questions_count INT NOT NULL DEFAULT 15,
    priority_score DECIMAL(8,4) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================================
-- 6. ÍNDICES DE PERFORMANCE E BUSCA VETORIAL
-- ======================================================================================

-- Índices B-Tree para Chaves Estrangeiras e Consultas Frequentes
CREATE INDEX IF NOT EXISTS idx_canonical_topics_subject ON canonical_topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_exam ON syllabus_items(target_exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(canonical_topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_source ON questions(exam_source_id);
CREATE INDEX IF NOT EXISTS idx_questions_origin ON questions(origin_type);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_topic ON question_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_date ON question_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_topic_mastery_review ON user_topic_mastery(next_review_due_at ASC);
CREATE INDEX IF NOT EXISTS idx_error_notebook_review ON error_notebook_entries(user_id, next_review_due_at ASC);
CREATE INDEX IF NOT EXISTS idx_study_cycle_blocks_order ON study_cycle_blocks(cycle_id, sequence_order ASC);

-- Índice GIN para Metadados JSONB
CREATE INDEX IF NOT EXISTS idx_legislation_keywords_gin ON legislation_devices USING gin(hot_keywords_json);
CREATE INDEX IF NOT EXISTS idx_questions_assets_gin ON questions USING gin(statement_assets_json);

-- Índices HNSW para Busca Vetorial Semântica (pgvector)
CREATE INDEX IF NOT EXISTS idx_questions_embedding_hnsw 
    ON questions USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_canonical_topics_embedding_hnsw 
    ON canonical_topics USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
