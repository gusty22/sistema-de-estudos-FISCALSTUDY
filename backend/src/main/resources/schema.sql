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

-- Rotina semanal e modo de planejamento do estudante
CREATE TABLE IF NOT EXISTS student_routines (
    id TEXT PRIMARY KEY,
    concurso_id TEXT NOT NULL,
    modo_planejamento TEXT DEFAULT 'SEMANAL', -- SEMANAL, CICLO
    horas_segunda REAL DEFAULT 3.0,
    horas_terca REAL DEFAULT 3.0,
    horas_quarta REAL DEFAULT 3.0,
    horas_quinta REAL DEFAULT 3.0,
    horas_sexta REAL DEFAULT 3.0,
    horas_sabado REAL DEFAULT 5.0,
    horas_domingo REAL DEFAULT 4.0,
    ciclo_disciplinas_json TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Compromissos fixos da rotina (trabalho, faculdade, academia, etc.)
CREATE TABLE IF NOT EXISTS routine_commitments (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    dia_semana TEXT NOT NULL, -- SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO, DOMINGO, TODOS_DIAS_UTEIS
    hora_inicio TEXT,
    hora_fim TEXT,
    tipo TEXT DEFAULT 'TRABALHO', -- TRABALHO, FACULDADE, ACADEMIA, FAMILIA, OUTRO
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Exceções e imprevistos na rotina (redução ou ampliação pontual de tempo)
CREATE TABLE IF NOT EXISTS routine_exceptions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL, -- YYYY-MM-DD
    tipo TEXT NOT NULL, -- INDISPONIBILIDADE, TEMPO_EXTRA
    horas REAL NOT NULL,
    motivo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Biblioteca de materiais de estudo didáticos (livros, PDFs, cursos, videoaulas, lei seca)
CREATE TABLE IF NOT EXISTS study_materials (
    id TEXT PRIMARY KEY,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    titulo TEXT NOT NULL,
    autor TEXT,
    formato TEXT NOT NULL DEFAULT 'PDF', -- PDF, LIVRO, VIDEO, LEI_SECA, LINK
    total_paginas INTEGER DEFAULT 0,
    pagina_atual INTEGER DEFAULT 0,
    url_ou_caminho TEXT,
    notas TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vínculo entre tópicos do edital e materiais didáticos com progresso de páginas
CREATE TABLE IF NOT EXISTS topic_material_links (
    id TEXT PRIMARY KEY,
    topico_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    pagina_inicio INTEGER,
    pagina_fim INTEGER,
    paginas_lidas INTEGER DEFAULT 0,
    status TEXT DEFAULT 'NAO_INICIADO', -- NAO_INICIADO, EM_ANDAMENTO, CONCLUIDO
    anotacoes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Visão domain_events apontando para event_store imutável
CREATE VIEW IF NOT EXISTS domain_events AS
SELECT event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json
FROM event_store;

-- Lista de Distrações / Brain Dump (Modo Monge / Anti-AIDA Ctrl+D)
CREATE TABLE IF NOT EXISTS student_distractions (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    concurso_id TEXT,
    distraction_text TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pré-Mortem de Gary Klein (Antecipação de falhas e planos de contingência)
CREATE TABLE IF NOT EXISTS pre_mortems (
    id TEXT PRIMARY KEY,
    concurso_id TEXT,
    titulo TEXT NOT NULL,
    data_prevista TEXT,
    cenario_fracasso TEXT NOT NULL,
    causa_1 TEXT,
    acao_1 TEXT,
    causa_2 TEXT,
    acao_2 TEXT,
    causa_3 TEXT,
    acao_3 TEXT,
    status TEXT DEFAULT 'ATIVO',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sessões Feynman em Tela Limpa (Reconstrução ativa e identificação de lacunas)
CREATE TABLE IF NOT EXISTS feynman_sessions (
    id TEXT PRIMARY KEY,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    topico TEXT NOT NULL,
    reconstruction_text TEXT NOT NULL,
    lacunas_identificadas TEXT,
    tempo_minutos INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Material de Pontos-Chave (Cloze Deletion / Omissão com base nos 5 critérios críticos)
CREATE TABLE IF NOT EXISTS ponto_chave_cards (
    id TEXT PRIMARY KEY,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    topico TEXT NOT NULL,
    criterio TEXT NOT NULL, -- MAIS_CAI, MAIS_DIFICIL, MAIS_ERRA, MAIS_ESQUECE, PEGADINHA_BANCA
    cloze_text TEXT NOT NULL,
    explicacao TEXT,
    artigo_ou_referencia TEXT,
    taxa_acerto REAL DEFAULT 0.0,
    proxima_revisao TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sessões Teóricas pelo Método ERA (Explorar, Estudar, Revisar, Avaliar)
CREATE TABLE IF NOT EXISTS metodo_era_sessions (
    id TEXT PRIMARY KEY,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    topico TEXT NOT NULL,
    etapa TEXT NOT NULL, -- EXPLORAR, ESTUDAR, REVISAR, AVALIAR, CONCLUIDO
    tempo_explorar_segundos INTEGER DEFAULT 0,
    tempo_estudar_segundos INTEGER DEFAULT 0,
    tempo_revisar_segundos INTEGER DEFAULT 0,
    questoes_avaliar_feitas INTEGER DEFAULT 0,
    anotacoes_excecoes TEXT,
    resumo_raiz_abstracao TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pontes de Colisão de Domínios (Intercalação de estruturas conceituais profundas)
CREATE TABLE IF NOT EXISTS cross_domain_bridges (
    id TEXT PRIMARY KEY,
    dominio_a_disciplina TEXT NOT NULL,
    dominio_a_topico TEXT NOT NULL,
    dominio_b_disciplina TEXT NOT NULL,
    dominio_b_topico TEXT NOT NULL,
    conceito_fronteira TEXT NOT NULL,
    desafio_prompt TEXT NOT NULL,
    max_caracteres INTEGER DEFAULT 140,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Respostas de Síntese Ativa das Pontes de Colisão de Domínios
CREATE TABLE IF NOT EXISTS cross_domain_responses (
    id TEXT PRIMARY KEY,
    bridge_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    active_output_text TEXT NOT NULL,
    tempo_resposta_segundos INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bridge_id) REFERENCES cross_domain_bridges(id)
);

-- Auditoria de Erros Críticos via Técnica de Feynman Constrangida (Fail-safe)
CREATE TABLE IF NOT EXISTS critical_error_feynman_audits (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    pegadinha_explicacao TEXT NOT NULL,
    regra_correta_explicacao TEXT NOT NULL,
    status_validacao TEXT DEFAULT 'VALIDADO',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Execuções em Modo Sombra para Algoritmos de Planejamento (Shadow Mode)
CREATE TABLE IF NOT EXISTS shadow_mode_runs (
    id TEXT PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    active_policy TEXT NOT NULL,
    shadow_policy TEXT NOT NULL,
    active_recommendation_json TEXT NOT NULL,
    shadow_recommendation_json TEXT NOT NULL,
    divergence_score REAL DEFAULT 0.0,
    divergence_rationale TEXT
);

-- Integração Silenciosa com Anki (AnkiConnect & Fila Local de Flashcards)
CREATE TABLE IF NOT EXISTS anki_flashcards (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    assunto TEXT NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'BASIC', -- BASIC, CLOZE
    front_or_text TEXT NOT NULL,
    back_or_extra TEXT,
    deck_name TEXT NOT NULL,
    anki_note_id INTEGER,
    sync_status TEXT NOT NULL DEFAULT 'PENDING_ANKI', -- PENDING_ANKI, SYNCED, ERROR
    source_type TEXT NOT NULL, -- QUESTION_ERROR, PDF_PARAGRAPH, SESSION_SYNTHESIS
    source_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT,
    error_message TEXT
);



