# Contexto e Estado Arquitetural — FiscalStudy (Índice Ativo)

## 1. Ambientes e Diretórios
- **Workspace Principal**: `C:\Users\washi\OneDrive\Área de Trabalho\fiscalstudy-platform\core-app`
- **Analytics Engine (R)**: `..\analytics-engine\R\digital_twin_engine.R`
- **Acervo de Provas**: `c:\Users\washi\Downloads\provas` (386 arquivos elegíveis processados)
- **Cofre de Conhecimento (Obsidian)**: `..\obsidian\FiscalStudy-Obsidian`

## 2. Decisões Arquiteturais Fundamentais
- **Princípio Central**: APPEND-ONLY EVENT LOG + MATERIALIZED PROJECTIONS. Eventos históricos nunca são alterados ou apagados.
- **Backend**: Java LTS + Spring Boot + SQLite local (`db/fiscalstudy.db` e `db/staging.db`).
- **Frontend**: React + TypeScript + Vite. Design Tokens de *Tecnologia Calma* (Paper `#f9f8f6` e Night `#0e0f11`).
- **Ingestão**: Python (`UniversalExtractor` com isolamento prévio de `SUPPORT_PATTERNS` e fusão multi-cargo de gabaritos).
- **Resiliência**: Falhas no motor R ou extratores nunca travam o estudo; o sistema opera em fallback local resiliente.

## 3. Estado Atual dos Bancos e Produção (v3.24)
- **Produção (`db/fiscalstudy.db`)**: 13.241 questões ativas publicadas com segurança atômica; 486 materiais vinculados.
- **Motor de Ingestão e Matriz de Pareto**: Módulo nativo ativo no Edital Verticalizado (`motorParetoEdital.ts` e `MotorParetoEditalModal.tsx`) para ingestão de edital bruto, classificação Pareto A/B/C histórica, cálculo de pesos da prova e diagnóstico do Quarteto de Alocação de Tempo.
- **Build & Testes**: Backend (`mvnw.cmd test-compile` -> SUCCESS) e Frontend (`tsc -b && vite build` -> SUCCESS).
- **Modelo Matemático do Estado Real de Conhecimento (v3.25)**:
  - Implementado em `StudentKnowledgeStateService.java` e conectado a `PerformanceIntelligenceService`, `DigitalTwinService` e `AnalyticsController`.
  - Equação canônica: $P_{atual}(t) = P_{base} \cdot e^{-\frac{\Delta t}{S}}$, onde $P_{base}$ pondera simulados ($1.5\times$) e retestes frios ($1.2\times$) vs. mesmo dia pós-leitura ($0.5\times$), $\Delta t$ é o tempo sem contato (dias) e $S$ é a força da memória (dias).
  - UI de transparência e calibração em `CalibracaoRetencaoAbas.tsx` (Aba B e Aba C) e coluna de Domínio Real / alerta de Falsa Fluência em `PainelDesempenho.tsx`.
- **Calibrador Automático de Pesos do Ciclo — Feedback Loop Pós-Simulado (v3.26)**:
  - Implementado em `SwotCycleCalibratorService.java` e conectado a `StrategicSimuladoService`, `RobinHoodCycleService` e `RobinHoodCycleController`.
  - Mecanismo determinístico de feedback loop: rouba de 15% a 20% (padrão 18%) da carga horária de matérias em zona de Força (>80% consolidado) e injeta em Fraquezas/Ameaças com alto peso no edital.
  - Insere blocos emergenciais prioritários no topo do ciclo para tópicos críticos de erro (ex: "Crédito Tributário").
  - UI no frontend em `CadernosSimulados.tsx` (modalidade Simulado SWOT Semanal + painel de calibração ativa) e na fila adaptativa do `Dashboard.tsx`.
- **Detector de Anomalias de Estudo — Auditoria Automática por Logs (v3.27)**:
  - Substitui questionários manuais da antiga *Planilha de Diagnóstico de 8 Áreas* por telemetria 100% determinística a partir dos logs do `event_store` (`STUDY_SESSION_RECORDED` e `ANSWER_SUBMITTED`).
  - Implementado em `StudyAnomalyDetectionService.java` e exposto via `AnalyticsController` (`GET /api/v1/analytics/study-anomalies` e `POST /api/v1/analytics/study-anomalies/check-fatigue`).
  - 3 Monitores Canônicos:
    1. *Alerta de Excesso de Teoria Passiva*: disparado se tempo semanal em PDF/Vídeo > 60% e Questões < 20%.
    2. *Alerta de Estagnação Vertical*: disparado se o aluno ficar > 21 dias (3 semanas) na mesma disciplina sem girar as demais matérias do edital.
    3. *Alerta de Fadiga/Queda de Rendimento*: disparado em sessões contínuas >= 90 minutos sem pausa com queda severa de velocidade de leitura (>= 35%) ou acertos (>= 25%).
  - UI de Tecnologia Calma: aba T29 em `PainelDesempenho.tsx` com `AuditoriaAnomaliasEstudo.tsx`, banner de alerta adaptativo no `Dashboard.tsx` e banner de fadiga em tempo real em `SessaoEstudoAtiva.tsx`. Imutabilidade estrita do event store preservada.
- **Sincronizador Automático Anki Desktop & Auto-Sync Daemon (v3.28)**:
  - Sistema completo e resiliente para sincronizar flashcards gerados automaticamente (erros em questões, sessões de estudo, resumos estratégicos e parágrafos de PDF) diretamente com o Anki Desktop.
  - Implementado em `AnkiIntegrationService.java`, `FiscalStudyApplication.java` (`@EnableScheduling`) e exposto em `AnkiController.java` (`/api/v1/anki/status`, `/api/v1/anki/sync-queue`, `/api/v1/anki/sync-ankiweb`, `/api/v1/anki/auto-sync/toggle`).
  - Daemon Agendado (`runAutoSyncScheduled` a cada 25s): monitora a fila local SQLite (`anki_flashcards` com `PENDING_ANKI`) e injeta silenciosamente no Anki Desktop sem intervenção manual assim que o app é detectado na porta 8765.
  - Compatibilidade Multilíngue Dinâmica: detecta em tempo de execução os modelos e campos do Anki do usuário (suporta perfeitamente Anki em Português "Básico/Frente/Verso" e "Cloze/Omissão de Palavras", além do padrão em inglês "Basic/Cloze"), eliminando falhas de modelo inexistente.
  - Acionamento Automático do AnkiWeb: dispara a ação `sync` do AnkiConnect para propagar instantaneamente os novos cards para a nuvem AnkiWeb (AnkiDroid / AnkiMobile).
  - UI de Tecnologia Calma: aba Curadoria Anki (`CuradoriaAnki.tsx`) com status em tempo real, switch de auto-sync, métricas de cards injetados e banner de 1-clique no `Dashboard.tsx` quando há cards pendentes.
- **Unificação da Resolução de Questões no Banco & Desduplicação do Menu Lateral (v3.29)**:
  - **Eliminação de Duplicidade Visual**: Removido o item redundante *"Estudo Ativo & Questões"* da [Sidebar](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/frontend/src/components/navigation/Sidebar.tsx). O [Banco de Questões](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/frontend/src/components/questoes/BancoQuestoes.tsx) agora centraliza toda a navegação, filtragem, montagem de cadernos e execução prática de questões.
  - **Resolução Direta e Focada**: Ao clicar em *"Resolver"* ou clicar nas alternativas de qualquer questão no Banco de Questões, a questão abre imediatamente em foco pedagógico com [ResolucaoQuestaoModal](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/frontend/src/components/questoes/ResolucaoQuestaoModal.tsx), sem desviar nem forçar o estudante para outra tela.
  - **Feedback Pedagógico e Gabarito Oficial**: Backend expõe `correctOption` em `AttemptResultDTO` ([QuestionController.java](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/QuestionController.java)) apenas pós-submissão. Exibe alternativas corretas em verde, diagnóstico de causa de erro (metacognição), geração instantânea de flashcard Anki e navegação sequencial entre questões do lote sem sair do Banco.


## 4. Índice de Documentação Modular
Consulte pontualmente via `view_file` conforme o escopo da tarefa:
- **Detalhamento dos Módulos A a J**: [`docs/architecture/modules/MODULOS_ESPECIFICACOES.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/architecture/modules/MODULOS_ESPECIFICACOES.md)
- **Histórico Completo de Versões e Decisões**: [`docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md)
- **Especificações Funcionais Ativas**: [`openspec/`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/openspec/) (gerenciadas via OpenSpec)
- **Integração com Motor R**: [`docs/ANALYTICS_R_INTEGRATION.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/ANALYTICS_R_INTEGRATION.md)
- **Arquitetura de Ingestão Documental**: [`docs/ARQUITETURA_INGESTAO_DOCUMENTAL.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/ARQUITETURA_INGESTAO_DOCUMENTAL.md)
- **Contrato de Dados V1**: [`docs/DATA_CONTRACT_V1.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/DATA_CONTRACT_V1.md)

## 5. Ferramentas e Skills Ativas
- **OpenSpec (`openspec/`)**: Gestão de propostas (`/opsx-propose`) e tarefas (`/opsx-apply`).
- **Skills Sob Demanda (`.agents/skills/`)**: `implement` (TDD), `code-review` (diffs), `taste-skill` (UI anti-slop).
- **Obsidian**: Central de conhecimento e pesquisa em `..\obsidian\FiscalStudy-Obsidian\00 - Painel\Dashboard.md`.

