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
    status TEXT DEFAULT 'VALIDADA',
    justificativa TEXT,
    texto_apoio TEXT,
    texto_apoio_titulo TEXT,
    numero_original INTEGER,
    arquivo_origem TEXT,
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

-- Roteamento Inteligente de Mídia e Registro de Bloqueio Cognitivo
CREATE TABLE IF NOT EXISTS cognitive_lock_records (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    assunto TEXT NOT NULL,
    consecutive_errors INTEGER DEFAULT 3,
    chat_dialogue_json TEXT,
    resolved BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
);

-- Sessões de Engenharia Reversa / Estudo Reverso Orientado
CREATE TABLE IF NOT EXISTS reverse_engineering_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    assunto TEXT NOT NULL,
    banca TEXT NOT NULL,
    nivel_topico TEXT NOT NULL DEFAULT 'INTERMEDIARIO', -- INTERMEDIARIO, AVANCADO
    total_questoes INTEGER NOT NULL DEFAULT 5,
    questoes_resolvidas INTEGER NOT NULL DEFAULT 0,
    questoes_corretas INTEGER NOT NULL DEFAULT 0,
    erros_questoes_numeros TEXT,
    alternativas_eliminadas_json TEXT,
    pegadinhas_detectadas_json TEXT,
    prescricao_recorte_texto TEXT,
    pdf_doc_nome TEXT,
    pagina_inicio_recorte INTEGER DEFAULT 16,
    pagina_fim_recorte INTEGER DEFAULT 22,
    paginas_puladas INTEGER DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO', -- EM_ANDAMENTO, CONCLUIDA
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

-- Conceitos Canônicos (Núcleo Epistemológico transversal independente de editais)
CREATE TABLE IF NOT EXISTS canonical_concepts (
    id TEXT PRIMARY KEY,
    disciplina TEXT NOT NULL,
    macro_tema TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    profundidade_padrao INTEGER DEFAULT 1, -- 1=Conceitual, 2=Legal/Doutrinário, 3=Jurisprudencial/Cálculo
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- DAG de Pré-Requisitos e Dependências entre Conceitos Canônicos
CREATE TABLE IF NOT EXISTS canonical_concept_prerequisites (
    concept_id TEXT NOT NULL,
    prerequisite_concept_id TEXT NOT NULL,
    grau_dependencia TEXT NOT NULL DEFAULT 'ESSENCIAL', -- ESSENCIAL, RECOMENDADO, CONTRASTIVO
    PRIMARY KEY(concept_id, prerequisite_concept_id),
    FOREIGN KEY(concept_id) REFERENCES canonical_concepts(id),
    FOREIGN KEY(prerequisite_concept_id) REFERENCES canonical_concepts(id)
);

-- Vínculo entre Tópicos do Edital Verticalizado e Conceitos Canônicos
CREATE TABLE IF NOT EXISTS edital_topico_concept_links (
    id TEXT PRIMARY KEY,
    topico_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    nivel_cobranca TEXT NOT NULL DEFAULT 'PADRAO', -- BASICO, PADRAO, APROFUNDADO
    peso_relativo REAL DEFAULT 1.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(topico_id) REFERENCES edital_topicos(id),
    FOREIGN KEY(concept_id) REFERENCES canonical_concepts(id)
);

-- Projeções do Gêmeo Digital Cognitivo (Calculadas pelo motor estatístico em R)
CREATE TABLE IF NOT EXISTS digital_twin_projections (
    concept_id TEXT PRIMARY KEY,
    disciplina TEXT NOT NULL,
    nome_conceito TEXT NOT NULL,
    prob_dominio REAL NOT NULL DEFAULT 0.10,     -- P(L_k) calculado por BKT em R
    incerteza_sigma REAL NOT NULL DEFAULT 1.0,  -- Incerteza estatística da estimativa
    estabilidade_dias REAL NOT NULL DEFAULT 1.0, -- Estabilidade sináptica S (FSRS v5)
    retencao_atual_pct REAL NOT NULL DEFAULT 0.0, -- R(t) no instante da projeção
    dias_sem_contato REAL NOT NULL DEFAULT 0.0,
    total_tentativas INTEGER DEFAULT 0,
    total_acertos INTEGER DEFAULT 0,
    friccao_cognitiva_media REAL DEFAULT 0.0,
    tempo_medio_resposta_segundos REAL DEFAULT 0.0,
    estado_neural TEXT NOT NULL DEFAULT 'VIRGEM_NAO_EXPLORADO', -- VIRGEM_NAO_EXPLORADO, EM_EQUILIBRIO, CONSOLIDADO, RISCO_AMNESIA
    minutos_ate_quebra REAL DEFAULT 0.0,
    calibrado_por_r INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Memória de Decisões Pedagógicas (Histórico auditável de prescrições vs execução real)
CREATE TABLE IF NOT EXISTS pedagogical_decision_log (
    id TEXT PRIMARY KEY,
    concurso_id TEXT,
    concept_id TEXT,
    topico_id TEXT,
    tipo_atividade TEXT NOT NULL,               -- PRIMING, TEORIA_HIPERFOCADA, FIXACAO_QUESTOES, FEYNMAN_AUDIT, REVISAO_SRS
    duracao_estimada_minutos INTEGER NOT NULL,
    duracao_estimada_min INTEGER NOT NULL,
    duracao_estimada_max INTEGER NOT NULL,
    duracao_real_minutos INTEGER,
    metodo_pedagogico TEXT NOT NULL,
    justificativa_probabilistica TEXT NOT NULL,
    algoritmo_versao TEXT NOT NULL DEFAULT 'R_ENGINE_V1',
    brier_score_previsto REAL,
    executado INTEGER DEFAULT 0,
    resultado_observado TEXT,                   -- SUCESSO_CONSOLIDADO, FRICCAO_RESIDUAL, RETENTATIVA_NECESSARIA
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TEXT
);

-- Fila Adaptativa de Revisão (Baseada em Retenção, Confiança e Estágios Cognitivos)
CREATE TABLE IF NOT EXISTS revision_calendar (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    concurso_id TEXT,
    disciplina TEXT NOT NULL,
    topico TEXT NOT NULL,
    tipo_revisao TEXT NOT NULL, -- IMEDIATO, CONSOLIDACAO, MANUTENCAO, ADAPTATIVA
    intervalo_dias INTEGER NOT NULL DEFAULT 1,
    data_agendada TEXT NOT NULL, -- YYYY-MM-DD
    origem_evento TEXT NOT NULL, -- ERRO_QUESTAO, CHUTE_EDUCADO, FRICCAO_COGNITIVA, PROGRESSAO_APRENDIZAGEM
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, CONCLUIDA, ATRASADA
    taxa_acerto_revisao REAL,
    justificativa_pedagogica TEXT,
    estagio_intervencao TEXT DEFAULT 'RECUPERACAO_ATIVA', -- INTERVENCAO_CORRETIVA, TESTE_TRANSFERENCIA, RECUPERACAO_ATIVA, MANUTENCAO_PREVENTIVA
    prioridade_score REAL DEFAULT 0.5,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    concluida_em TEXT
);

-- Cadernos e Simulados (Módulo E — T19 e T23)
CREATE TABLE IF NOT EXISTS study_notebooks (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    concurso_id TEXT,
    tipo TEXT NOT NULL DEFAULT 'DINAMICO', -- FIXO, DINAMICO
    modo_resolucao TEXT NOT NULL DEFAULT 'PRATICA', -- PRATICA, DIAGNOSTICO, FIXACAO, SIMULADO
    filtros_json TEXT,
    questoes_ids_json TEXT,
    quantidade INTEGER DEFAULT 20,
    tempo_minutos INTEGER DEFAULT 90,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TEXT
);

-- Questões Favoritas do Estudante (T18)
CREATE TABLE IF NOT EXISTS favorite_questions (
    question_id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Reporte de Problemas de Questões (T18)
CREATE TABLE IF NOT EXISTS question_reports (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    motivo TEXT NOT NULL,
    descricao TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- Canonical persistence contracts; services must not create these independently.
CREATE TABLE IF NOT EXISTS system_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS simulado_executions(id TEXT PRIMARY KEY,notebook_id TEXT,concurso_id TEXT,titulo TEXT NOT NULL,estrategia TEXT NOT NULL,modo TEXT DEFAULT 'SIMULADO',total_questoes INTEGER NOT NULL,acertos INTEGER DEFAULT 0,erros INTEGER DEFAULT 0,nao_respondidas INTEGER DEFAULT 0,nota_liquida REAL DEFAULT 0,tempo_gasto_segundos INTEGER DEFAULT 0,disciplinas_json TEXT,finalizado_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS question_topic_classifications(id TEXT PRIMARY KEY,question_id TEXT NOT NULL REFERENCES questions(id),topic_id TEXT NOT NULL REFERENCES edital_topicos(id),status TEXT NOT NULL CHECK(status IN ('SUGGESTED','CONFIRMED','REJECTED')),confidence REAL NOT NULL CHECK(confidence>=0 AND confidence<=1),origin TEXT NOT NULL,reviewer TEXT,evidence TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_qtc_question ON question_topic_classifications(question_id,created_at);
CREATE INDEX IF NOT EXISTS idx_qtc_topic ON question_topic_classifications(topic_id,status);
CREATE TABLE IF NOT EXISTS question_families(question_id TEXT PRIMARY KEY REFERENCES questions(id),family_id TEXT NOT NULL,fingerprint_version TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_qfamily_id ON question_families(family_id);

CREATE TABLE IF NOT EXISTS learning_memory_state(question_id TEXT PRIMARY KEY,stability REAL NOT NULL,difficulty REAL NOT NULL,reps INTEGER NOT NULL,lapses INTEGER NOT NULL,last_reviewed_at TEXT NOT NULL,due_at TEXT NOT NULL,model_version TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learning_evidence_projection(attempt_id TEXT PRIMARY KEY,question_id TEXT NOT NULL,occurred_at TEXT NOT NULL,origin TEXT NOT NULL,recall_before REAL,pedagogical_signal TEXT NOT NULL,model_version TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_learning_memory_due ON learning_memory_state(due_at);
