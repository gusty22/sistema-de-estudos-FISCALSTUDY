# Catálogo Canônico de Epics — FiscalStudy: Mentor Cognitivo Pessoal Adaptativo

> **Status:** FONTE ÚNICA CANÔNICA DE VERDADE  
> **Data de Fixação:** 25 de Outubro de 2026  
> **Regra de Governança Inegociável:** Esta numeração (01 a 15) é canônica e definitiva. Nenhuma iniciativa de engenharia, governança Git, observabilidade ou infraestrutura pode reordenar ou substituir estes identificadores funcionais.

---

## 1. Princípio Arquitetural e Segregação de Iniciativas

1. **Epics Funcionais (01 a 15):** Representam os horizontes de valor e capacidades cognitivas entregues ao estudante concurseiro.
2. **Iniciativas Transversais de Engenharia (Rastreadas Separadamente):**
   - `ENG-GOV`: Governança Git, Pull Requests, Worktrees e Orquestração Multiagente (Antigravity + Codex).
   - `ENG-OBS`: Observabilidade, Telemetria OpenTelemetry e Auditoria de Tokens.
   - `ENG-DB`: Estratégia de Migrações SQLite, Backups Físicos e Idempotência DDL.
   - `ENG-CI`: Pipelines de Testes Automatizados, Gates de Qualidade e Conformidade.

---

## 2. Os 15 Epics Canônicos Funcionais

### EPIC 01 — Mentor Cognitivo Pessoal Adaptativo
- **Escopo:** Orquestração inteligente do ciclo diário de estudo de alto rendimento. Seleciona dinamicamente a próxima atividade de maior impacto (teoria, questões, recuperação ativa, simulados) considerando tempo disponível, proximidade da prova e estado real de retenção.
- **Maturidade:** N1 (Parcial).
- **Dependências:** EPIC 02, EPIC 03, EPIC 04, EPIC 05.

### EPIC 02 — Modelo Individual de Conhecimento
- **Escopo:** Mapeamento granular do domínio conceitual do aluno por disciplina, tópico e subtópico do edital verticalizado, distinguindo contato frio, retestes e simulados a partir de eventos `REAL_STUDY`.
- **Maturidade:** N2 (Validado por testes unitários).
- **Dependências:** EPIC 08, EPIC 14.

### EPIC 03 — Memória de Longo Prazo e FSRS
- **Escopo:** Implementação canônica do algoritmo FSRS-4.5 oficial (17 parâmetros de referência) para modelar estabilidade ($S$), recuperabilidade ($R$) e agendamento de repetição espaçada, sem contaminação com pesos heurísticos arbitrários.
- **Maturidade:** N2 (Validado pela suíte de conformidade de referência FSRS-4.5).
- **Dependências:** EPIC 08, EPIC 14.

### EPIC 04 — Diagnóstico Pedagógico e Intervenções
- **Escopo:** Qualificação da natureza e causa dos erros cometidos (falta de atenção, confusão conceitual, pegadinha de banca, lacuna teórica pura) via anotações pós-tentativa (`ATTEMPT_ANNOTATED`), sem violar o log append-only.
- **Maturidade:** N2 (Validado por testes de integração de controller e repositório).
- **Dependências:** EPIC 08, EPIC 13, EPIC 15.

### EPIC 05 — Planejamento Inteligente Orientado à Data da Prova
- **Escopo:** Cálculo determinístico do orçamento de estudo até o dia da prova, distribuindo a carga horária por relevância de Pareto, peso no edital e déficits críticos (Ciclo Robin Hood e calibração pós-simulado).
- **Maturidade:** N1 (Parcial nos fontes).
- **Dependências:** EPIC 01, EPIC 07.

### EPIC 06 — Ingestão e Classificação de Provas
- **Escopo:** Pipeline de extração e higienização documental de PDFs de provas e gabaritos (UniversalExtractor, PyMuPDF), garantindo integridade física e staging isolado antes da publicação operacional.
- **Maturidade:** N3 (Ciclo Staging -> Publicação -> Estudo validado ponta a ponta com SQLite temporário).
- **Dependências:** EPIC 14.

### EPIC 07 — Raio-X de Editais e Bancas
- **Escopo:** Análise estatística de incidência histórica de tópicos por banca examinadora (FGV, Cebraspe, FCC), gerando matrizes de Pareto para priorização do estudo.
- **Maturidade:** N1 (Parcial nos fontes).
- **Dependências:** EPIC 06.

### EPIC 08 — Banco de Questões e Tentativas Legítimas
- **Escopo:** Motor de resolução de questões com isolamento estrito de gabarito pré-tentativa, medição de tempo ativo (activeTimeMs), nível de confiança metacognitiva (1 a 5) e garantia de imutabilidade da resposta original.
- **Maturidade:** N3 (Testes de integração REST e persistência no SQLite aprovados).
- **Dependências:** EPIC 14.

### EPIC 09 — Simulados e Transferência de Conhecimento
- **Escopo:** Geração de cadernos de simulados estratégicos (SWOT) sob restrição rigorosa de tempo de prova, avaliando a transferência de conceitos para questões inéditas (`UNSEEN`) e variantes (`VARIANT`).
- **Maturidade:** N1 (Parcial nos fontes).
- **Dependências:** EPIC 04, EPIC 08, EPIC 14.

### EPIC 10 — Analytics e Validação Estatística
- **Escopo:** Comunicação assíncrona com motor analítico R (`digital_twin_engine.R`) com verificação criptográfica estrita em SHA-256 (fail-closed) para cálculo de Brier Score, matrizes de confusão e calibração de certeza.
- **Maturidade:** N2 (Validado em testes de scripts R; pendente resolução de caminhos de pacotes no Windows).
- **Dependências:** EPIC 08, EPIC 14.

### EPIC 11 — Painel Diário Inteligente
- **Escopo:** Dashboard de Tecnologia Calma apresentando a tarefa imediata de maior alavancagem ("O que estudar agora?"), revisões prioritárias do dia e alertas de fadiga/anomalias, com alternância entre Modo Aluno e Modo Avançado.
- **Maturidade:** N2 (Componentes implementados e testados unitariamente).
- **Dependências:** EPIC 01, EPIC 03, EPIC 15.

### EPIC 12 — Materiais e Explicações com Fontes
- **Escopo:** Vinculação de materiais didáticos (PDFs, leis secas) a questões e resumos, aplicando blindagem epistêmica para evitar contaminação conceitual entre áreas (ex.: contabilidade vs. direito penal).
- **Maturidade:** N2 (Validado por testes de pipeline híbrido).
- **Dependências:** EPIC 06, EPIC 08.

### EPIC 13 — Caderno de Erros e Integração Anki
- **Escopo:** Centralização das assertivas erradas com curadoria inteligente (bloqueio de textos puramente circunstanciais de interpretação) e sincronização segura com Anki Desktop.
- **Maturidade:** N2 (Validado com testes de serviço e daemon agendado).
- **Dependências:** EPIC 04, EPIC 08, EPIC 14.

### EPIC 14 — Segurança, Persistência e Integridade
- **Escopo:** Schema SQLite canônico, migrações com backup físico verificado (`PRAGMA integrity_check`), repositórios isolados e log de eventos `event_store` estritamente append-only.
- **Maturidade:** N3 (Validado em testes de migração, isolamento e persistência).
- **Dependências:** Nenhuma (Fundação de Dados).

### EPIC 15 — Experiência de Uso e Acessibilidade
- **Escopo:** Interface de Tecnologia Calma (Paper `#f9f8f6` / Night `#0e0f11`), foco navegável por teclado (`Tab`, `:focus-visible`), eliminação de flashes cognitivos e conformidade com acessibilidade.
- **Maturidade:** N3 automatizado (Playwright headless validando DOM/CSS; N4 pendente de homologação humana em tela real).
- **Dependências:** Nenhuma (Camada de Apresentação).

---

## 3. Matriz de Níveis de Maturidade (Definições Operacionais)

- **[N0] Planejado / Especificado:** Contrato arquitetural documentado sem implementação no repositório.
- **[N1] Implementado nos Fontes:** Código-fonte presente no repositório, compilando sem erros.
- **[N2] Validado por Testes Unitários:** Suítes automatizadas de unidade passam com asserções matemáticas/lógicas comprovadas.
- **[N3] Integrado Entre Camadas:** Fluxos ponta a ponta funcionais com comunicação comprovada entre Banco SQLite, Backend e Frontend via testes de integração automatizados.
- **[N4] Homologado Visualmente / E2E:** Interface validada por sessão em tela real por operador humano atestando usabilidade e ausência de atritos visuais.
- **[N5] Validado Empiricamente:** Eficácia de retenção de memória e aprovação em concurso comprovadas longitudinalmente.
