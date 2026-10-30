# Catálogo de Epics — FiscalStudy: Mentor Cognitivo Pessoal Adaptativo

> **Status:** Planejamento e Arquitetura Canônica (Revisão 2 — Consolidada)
> **Data:** 25/10/2026
> **Propósito:** Definir o horizonte funcional da plataforma além dos achados de auditoria técnica (F01–F36), consolidando o FiscalStudy como um Mentor Cognitivo Pessoal e Determinístico para Concursos de Alto Rendimento.

---

## 1. Princípios de Engenharia Cognitiva do Mentor

1. **Separação Epistêmica Rigorosa**:
   - **Fatos Observados:** Tentativas reais de questões, tempos ativos medidos, notas e respostas fornecidas.
   - **Previsão de Memória:** Calculada estritamente pelo algoritmo oficial **FSRS** (estabilidade, recuperabilidade e intervalo).
   - **Diagnóstico Pedagógico:** Camada externa determinística que qualifica causas de erro, lacunas conceituais e urgência sem inventar dados causais fictícios.
   - **Incerteza Explícita:** O sistema expõe graus de confiança e intervalo de incerteza em vez de apresentar hipóteses como certezas consolidadas.

2. **Níveis de Maturidade Operacional (Critério de Verificação)**:
   - **[N1] Implementado nos Fontes:** Código existe no repositório.
   - **[N2] Validado por Testes Unitários:** Suíte automatizada de domínio passa (`BUILD SUCCESS`).
   - **[N3] Integrado Entre Camadas:** Comunicação ponta a ponta funcional entre Banco, Backend e Frontend.
   - **[N4] Homologado Visualmente / E2E:** Interface validada via navegador com Tecnologia Calma e acessibilidade.
   - **[N5] Validado Empiricamente:** Eficácia pedagógica e retenção comprovadas por uso longitudinal autêntico.

---

## 2. Catálogo Estruturado de Epics (15 Epics)

### EPIC 01 — Mentor Cognitivo Pessoal Adaptativo
- **Objetivo:** Orquestrar o ciclo diário de estudo de forma adaptativa, balanceando teoria, questões e revisões com base na proximidade do concurso e no estado real de retenção.
- **Maturidade Atual:** **N1 — Parcial** (Código implementado em `MaestroOrchestratorService.java` e `PlanejamentoAdaptativo.tsx`; pendente desacoplamento de heurísticas mockadas e integração plena com agendamento FSRS).
- **Dependências:** EPIC 02, EPIC 03, EPIC 04, EPIC 05.

### EPIC 02 — Modelo Individual de Conhecimento
- **Objetivo:** Mapear o domínio conceitual do estudante por disciplina, tópico e subtópico do edital, mantendo o histórico de contato frio, retestes e simulados.
- **Maturidade Atual:** **N2 — Validado Unitariamente** (`StudentKnowledgeStateService.java` refatorado no PR #9 para filtrar eventos não pessoais `origin_type = REAL_STUDY`; pendente integração com frontend).
- **Dependências:** EPIC 08, EPIC 14.

### EPIC 03 — Memória de Longo Prazo e FSRS
- **Objetivo:** Implementar o agendador FSRS oficial e canônico para itens de memorização ativa, respeitando fusos horários locais e desconsiderando tentativas não avaliáveis (`isCorrect = null`).
- **Maturidade Atual:** **N2 — Validado Unitariamente** (`FsrsEngine.java`, `FsrsReferenceConformanceTest` e PR #11 `fix/backend-ungraded-revisions`; sem validação longitudinal N5).
- **Dependências:** EPIC 08, EPIC 14.

### EPIC 04 — Diagnóstico Pedagógico e Intervenções
- **Objetivo:** Qualificar a natureza dos erros (confusão conceitual, pegadinha de banca, lapso de interpretação ou falta de base) através de anotações pós-tentativa (`attempt_annotations`), sugerindo intervenções pontuais sem distorcer o histórico append-only.
- **Maturidade Atual:** **N2 — Validado Unitariamente no Backend** (PR #9 e PR #10 aprovados com 17 e 11 testes; integração no frontend em andamento).
- **Dependências:** EPIC 08, EPIC 13, EPIC 15.

### EPIC 05 — Planejamento Inteligente Orientado à Data da Prova
- **Objetivo:** Calcular o orçamento de estudo disponível até o dia da prova, distribuindo matérias por prioridade de Pareto, peso no edital e déficits críticos de retenção (Robin Hood Cycle).
- **Maturidade Atual:** **N1 — Parcial** (`RobinHoodCycleService.java`, `SwotCycleCalibratorService.java` e `RoutineBudgetRegressionTest`).
- **Dependências:** EPIC 01, EPIC 07.

### EPIC 06 — Ingestão e Classificação de Provas
- **Objetivo:** Ingerir cadernos de prova e gabaritos oficiais em PDF com precisão cirúrgica (PyMuPDF, Docling) e classificar questões por assunto da taxonomia canônica.
- **Maturidade Atual:** **N1 — Parcial** (`UniversalExtractor.py`, isolamento de `SUPPORT_PATTERNS`, branch `feature/document-ingestion`; classificação final depende de curadoria humana guiada).
- **Dependências:** EPIC 14.

### EPIC 07 — Raio-X de Editais e Bancas
- **Objetivo:** Analisar a incidência estatística de assuntos por banca examinadora (FGV, Cebraspe, FCC), calculando matrizes de Pareto e pesos relativos para calibrar o estudo.
- **Maturidade Atual:** **N1 — Parcial** (`motorParetoEdital.ts`, `MotorParetoEditalModal.tsx` e `EditalImportController.java`).
- **Dependências:** EPIC 06.

### EPIC 08 — Banco de Questões e Tentativas Legítimas
- **Objetivo:** Execução e resolução de questões com isolamento de gabarito, medição real de tempo ativo (Page Visibility API), nível de confiança metacognitiva (1 a 5) e segregação estrita de eventos de estudo real vs testes sintéticos.
- **Maturidade Atual:** **N2 — Validado Unitariamente** (PR #8 `fix/analytics-learning-evidence` e `ActiveTimeAndConfidenceIntegrationTest`).
- **Dependências:** EPIC 14.

### EPIC 09 — Simulados e Transferência de Conhecimento
- **Objetivo:** Montagem de cadernos de simulados estratégicos (SWOT) para testar a retenção fria e a capacidade de transferir conceitos para questões inéditas sob condições de pressão de tempo de prova.
- **Maturidade Atual:** **N1 — Parcial** (`StrategicSimuladoService.java` e `CadernosSimulados.tsx`; pendente unificação de DDL de `study_notebooks` no PR da base).
- **Dependências:** EPIC 04, EPIC 08, EPIC 14.

### EPIC 10 — Analytics e Validação Estatística
- **Objetivo:** Motor estatístico assíncrono em R (`digital_twin_engine.R`) para calcular brier scores, calibração metacognitiva e previsões com intervalo de confiança estatístico real.
- **Maturidade Atual:** **N2 — Validado Unitariamente em R** (PR #8 com 336 verificações R aprovadas; pendente contorno do digest no Windows).
- **Dependências:** EPIC 08, EPIC 14.

### EPIC 11 — Painel Diário Inteligente
- **Objetivo:** Dashboard central de Tecnologia Calma apresentando a tarefa imediata de maior alavancagem, revisões FSRS prioritárias do dia e alertas de anomalias sem jargões de engenharia de software no Modo Aluno.
- **Maturidade Atual:** **N1 — Parcial** (`Dashboard.tsx`, `SimplifiedModeContext.tsx` e `AuditoriaAnomaliasEstudo.tsx`).
- **Dependências:** EPIC 01, EPIC 03, EPIC 15.

### EPIC 12 — Materiais e Explicações com Fontes
- **Objetivo:** Vincular parágrafos de PDF e normas técnicas (ex: CPCs, leis) a questões e resumos, aplicando blindagem epistêmica para evitar contaminação terminológica entre ramos do conhecimento.
- **Maturidade Atual:** **N2 — Validado Unitariamente** (`StrategicSummaryService.java` com enum `KnowledgeDomain` e `StrategicSummaryHybridPipelineTest`).
- **Dependências:** EPIC 06, EPIC 08.

### EPIC 13 — Caderno de Erros e Integração Anki
- **Objetivo:** Centralizar assertivas incorretas com justificativa, sincronizando de forma segura e com controle de privacidade com o Anki Desktop via auto-sync daemon sem falhas de rede.
- **Maturidade Atual:** **N2 — Validado Unitariamente** (`AnkiIntegrationService.java`, `CuradoriaAnki.tsx` e `AnkiPrivacyPolicy`).
- **Dependências:** EPIC 04, EPIC 08, EPIC 14.

### EPIC 14 — Segurança, Persistência e Integridade
- **Objetivo:** Schema SQLite canônico com migrações centralizadas, restrições referenciais, backup consistente com API confinada, proteção da API administrativa e event store estritamente append-only.
- **Maturidade Atual:** **N2 — Validado Unitariamente** (`SchemaBootstrapIntegrationTest`, `PersistenceContractTest` na branch `feature/database-contracts`).
- **Dependências:** Nenhuma (Fundação).

### EPIC 15 — Experiência de Uso e Acessibilidade
- **Objetivo:** Interface de Tecnologia Calma (Paper/Night), eliminação completa de hooks condicionais em modais, suporte total a navegação por teclado e otimização de bundle (< 500kB inicial).
- **Maturidade Atual:** **N1 — Implementado nos Fontes** (`fix/frontend-accessibility-flows`; build Vite/TS aprovado; homologação visual em andamento).
- **Dependências:** Nenhuma (Interface).

---

## 3. Resumo Consolidado de Maturidade dos Epics

- **N1 — Parcial nos Fontes:** 6 Epics (EPIC 01, EPIC 05, EPIC 06, EPIC 07, EPIC 09, EPIC 11)
- **N1 — Implementado Completo (Pendente E2E):** 1 Epic (EPIC 15)
- **N2 — Validado Unitariamente por Testes:** 8 Epics (EPIC 02, EPIC 03, EPIC 04, EPIC 08, EPIC 10, EPIC 12, EPIC 13, EPIC 14)
- **N3 — Integrado Entre Módulos:** 0 Epics (Objeto da branch `integration/wave-1`)
- **N4 — Homologado Visualmente / E2E:** 0 Epics (Em execução)
- **N5 — Validado Empiricamente:** 0 Epics (Exige uso longitudinal continuado)
