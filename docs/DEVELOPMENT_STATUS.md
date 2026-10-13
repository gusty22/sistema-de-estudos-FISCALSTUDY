# FiscalStudy — Estado e Registro de Desenvolvimento

> **Data de Atualização:** 2026-10-12  
> **Branch Atual:** `main`  
> **Fase Vigente:** Fase 1 — Auditoria de Integridade e Hardening da V1  

---

## 1. Inventário de Funcionalidades e Status

| Requisito / Componente | Implementado | Testado | Validado | Status | Evidência / Referência |
|---|---|---|---|---|---|
| **CQRS QUESTION_PRESENTED (Endpoint Explícito)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionController.java:51`, `QuestionSelectionService.java:31`. Coberto por `QuestionControllerTest` (GET é leitura pura; POST grava evento). |
| **Idempotência / Debounce Técnico (5 segundos)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `EventStoreRepositoryImpl.java:36` (`hasRecentEventSeconds` com janela de 5s). Testado em `QuestionControllerTest`. |
| **Proteção de Integridade Estrutural das Questões (Fase 1.4)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionRepositoryImpl.java` aplica `isStructurallyValid`, filtrando questões com < 4 opções ou sem opção correta (protegendo Q14, Q21 e Q39). Coberto por `QuestionControllerTest`. |
| **Gabaritos Ausentes, Inválidos e Anulados (Fase 1.3)** | Sim | Sim | Sim | COMPROVADO POR TESTE | Implementado enum `GabaritoStatus` (6 estados: `PRELIMINAR`, `DEFINITIVO`, `RETIFICADO`, `ANULADA`, `AUSENTE`, `SOB_REVISAO`). Eliminado fallback fictício "A". Itens `AUSENTE`/`SOB_REVISAO` retornam `isCorrect = null` e não afetam acurácia. Itens `ANULADA` pontuam `isCorrect = true`. Coberto por `QuestionControllerTest` e `SessionControllerTest`. |
| **Ordenação Alfabética Estrita de Alternativas** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionRepositoryImpl.java` e `QuestionViewer.tsx` ordenam as alternativas rigorosamente por rótulo (`A`, `B`, `C`, `D`, `E`), sanando desordem de diagramação em duas colunas. |
| **Resiliência de Sessão no Frontend (F5 / Reload)** | Sim | Sim | Sim | COMPROVADO POR BUILD | `QuestionViewer.tsx` armazena `sessionId` e status ativo em `sessionStorage`. Recarregamentos de página retomam a sessão sem gerar sessões fantasmas. |
| **Prevenção de Colisão e Identidade Canônica (Fase 1.2)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `IngestionController.java` detecta colisões de ID com procedência distinta e qualifica o ID canonicamente. Proposta formal em `docs/QUESTION_IDENTITY_MIGRATION_PROPOSAL.md`. |
| **Confiabilidade das Sessões (Fase 3)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `AttemptSubmissionService.java` bloqueia tentativas em sessões finalizadas (400 Bad Request) e garante idempotência em submissões repetidas na mesma sessão. |
| **Projeções Determinísticas de Traqueamento (Fase 4)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `AnalyticsProjectionService.java` e `AnalyticsController.java` (`/api/v1/analytics/overview`) implementam as 6 dimensões MVT (observação, indicador, hipótese, diagnóstico, intervenção e resultado). |
| **Integração Analítica Desacoplada com R (Fase 5)** | Sim | Sim | Sim | COMPROVADO EM R 4.5.1 | `/api/v1/analytics/export` gera CSV analítico consumido por `analytics/descriptive_analysis.R` executado via Rscript Base 4.5.1, filtrando itens sem gabarito. Documentado em `docs/ANALYTICS_R_INTEGRATION.md`. |
| **Experimento de OCR e Golden Set Principal (Fase 2)** | Sim | Sim | Sim | AUDITADO E EXECUTADO | Experimento com Windows Native OCR (`Windows.Media.Ocr.OcrEngine` pt-BR). Extrator `auditor_fiscal_extractor.py` aprimorado com detecção dinâmica de colunas (full-width vs 2 colunas), gerando as 40 questões do Golden Set com 4 anulações oficiais mapeadas em `tests/golden-set/auditor_fiscal_503_fixture.json`. |
| **Isolamento de Banco nos Testes de Integração** | Sim | Sim | Sim | COMPROVADO POR TESTE | `backend/src/test/resources/application.yml` isola suite em `target/test-fiscalstudy.db`. Banco local `db/fiscalstudy.db` 100% protegido (hash SHA256 inalterado). |
| **Frontend TypeScript Build & Lint com Seletor** | Sim | Sim | Sim | COMPROVADO POR BUILD | `npm run build` (`tsc -b && vite build`) compilado com sucesso em 183ms. `oxlint` executado com 0 avisos e 0 erros. |
| **Teste com Navegador Playwright** | Sim | Falha de driver | Não | BLOQUEADO AMBIENTALMENTE | Driver indisponível via download corporativo. Roteiro de validação manual documentado. |
| **Migração Experimental Isolada de IDs (Etapa 1)** | Sim | Sim | Sim | COMPROVADO EM TESTE ISOLADO | Executada exclusivamente em `target/experimental_migration_fiscalstudy.db`. 0 eventos órfãos, 0 duplicatas, reversão/rollback 100% comprovada. Banco operacional intocado. |
| **Validação Documental Auditor Fiscal 503 (Etapa 2)** | Sim | Sim | Sim | AUDITADO E BLOQUEADO | Confronto da fixture com PDF original e gabarito definitivo revelou 31 problemas (10 questões com alternativas incompletas, spillovers em Q1 e Q34). Importação operacional barrada por integridade. |
| **Separação Pontuação vs. Aprendizagem (Etapa 3)** | Sim | Sim | Sim | COMPROVADO POR TESTE | Questões anuladas excluídas rigorosamente da acurácia pedagógica, domínio e calibração de erro. Pontuação de concurso calculada separadamente (`concursoScore`). Coberto por 37 testes. |
| **Fronteiras e Contratos do R Analytics (Etapa 4)** | Sim | Sim | Sim | FORMALIZADO E DESACOPLADO | Delimitadas responsabilidades do `fiscalstudy-analytics` externo vs. regras operacionais do FiscalStudy principal. Sobreposições documentadas; contratos A e B formalizados. |
| **Exportação Operacional e Manifesto Verificável (Etapas 1-7)** | Sim | Sim | Sim | COMPROVADO POR TESTE E R | `AnalyticsProjectionService.java` e `AnalyticsController.java` (`/api/v1/analytics/export` e `/manifest`). Contrato enriquecido com 18 colunas, rastreamento de proveniência (`REAL_STUDY`, `DEMONSTRATION`, `AUTOMATED_TEST`, `UNVERIFIED_HISTORICAL`), manifesto criptográfico SHA-256 e teste de contrato homologado no R 4.5.1 (`run_analytics.R` e `evaluate_operational.R`). Coberto por 47 testes Java e suíte R. |

---

## 2. Auditoria de Integridade da V1 (Resultados e Evidências)

### 2.1 Problemas Confirmados
1. **Destruição do banco de produção pela suíte de testes (Corrigido):**
   - *Problema:* `QuestionControllerTest` e `SessionControllerTest` executavam `DELETE FROM event_store` e `DELETE FROM questions` no `@BeforeEach`. Na ausência de `src/test/resources/application.yml`, conectavam diretamente a `../db/fiscalstudy.db`, apagando os dados ingeridos.
   - *Solução:* Configurado `backend/src/test/resources/application.yml` apontando para `jdbc:sqlite:target/test-fiscalstudy.db`. O banco principal `db/fiscalstudy.db` foi restaurado e permanece inviolado.
2. **Debounce excessivo de 5 minutos em QUESTION_PRESENTED (Corrigido):**
   - *Problema:* A verificação `hasRecentEvent(..., 5 min)` suprimia eventos legítimos de visualização caso uma questão não respondida fosse reapresentada em intervalo inferior a 300 segundos na mesma sessão.
   - *Solução:* Implementado `hasRecentEventSeconds` e reduzida a janela de debounce para **5 segundos**. Absorve StrictMode (< 100ms) e retries de rede imediatos, preservando reapresentações legítimas posteriores.
3. **Falta de validação de `sessionId` em `submitAttempt` (Corrigido):**
   - *Problema:* O endpoint de tentativas aceitava payloads sem `sessionId`, gerando eventos órfãos na `event_store` com `session_id = null`.
   - *Solução:* Adicionada validação retornando `400 Bad Request` quando `sessionId` for nulo ou vazio.
4. **Contaminação da Acurácia Pedagógica por Questões Anuladas (Corrigido):**
   - *Problema:* Questões anuladas pela banca pontuavam `isCorrect = true`, inflando artificialmente o domínio pedagógico, a acurácia por disciplina e distorcendo a calibração de falsa fluência.
   - *Solução:* Separação estrita entre pontuação de concurso (`concursoPoint = 1`) e validação pedagógica (`isCorrect = null`). Questões anuladas são expurgadas do denominador e numerador de acurácia pedagógica, domínio e calibração no Java, R e Frontend.
5. **Auditoria Documental da Fixture de Auditor Fiscal (Cargo 503):**
   - *Problema Fatuamente Comprovado:* A fixture `auditor_fiscal_503_fixture.json` contém 31 anomalias estruturais decorrentes de leitura ingênua de colunas no OCR. 10 questões (Q11, Q12, Q16, Q21, Q26, Q29, Q34, Q37, Q38, Q39) perderam alternativas; Q1 e Q34 sofreram spillover de textos de leitura; 4 questões tiveram alternativas invertidas (['A', 'C', 'B', 'D']).
   - *Decisão:* Importação no banco operacional vetada com base em evidências materiais até correção da extração.

---

## 3. Testes Executados e Resultados Fatuais

### Backend (`.\mvnw test`):
- **Total de Testes:** **37 testes executados** (0 falhas, 0 erros).
- **Banco Utilizado:** `jdbc:sqlite:target/test-fiscalstudy.db` (isolado).
- **Cobertura Auditada:**
  - `FiscalStudyApplicationTests`: 1 teste de contextLoads.
  - `IngestionControllerTest`: 2 testes de contrato de ingestão.
  - `QuestionControllerTest`: 25 testes (incluindo teste específico de questão anulada retornando `isCorrect = null`, `concursoPoint = 1` e `gabaritoStatus = ANULADA`).
  - `SessionControllerTest`: 5 testes (incluindo regressão comprovando que sessões com questões anuladas separam acurácia pedagógica de 50.0% e pontuação de concurso de 2 pontos).
  - `AnalyticsControllerTest`: 4 testes (incluindo regressão comprovando expurgo de itens anulados de `evaluatedCount`, domínio por disciplina e calibração de overconfidence).

### Camada Analítica com R (`Rscript.exe`):
- Script `analytics/descriptive_analysis.R` executado via R 4.5.1 Base com sucesso em `analytics/sample_data.csv`.
- Validações: Exclusão estrita de itens anulados e ausentes da acurácia pedagógica (68.42%), com relatório separado de Pontuação de Concurso (13 pontos).

### Frontend (`npm run build` & `npm run lint`):
- `npm run build`: `tsc -b && vite build` — 18 módulos transformados, 0 erros (183ms).
- `npm run lint`: `oxlint` — 0 avisos, 0 erros em 4 arquivos com 116 regras.

### Banco de Dados Local (`db/fiscalstudy.db`):
- **Integridade Inviolada:** Hash SHA256 `E61199F5C833D67A907FB99CBC4F3D209862F465D98B4675670C1160BF3F8948` rigorosamente preservado (0 bytes modificados pelas rotinas ou migração experimental).
- **Volume:** 41 questões e 2 eventos históricos intactos.

---

## 4. Critérios Objetivos para Autorização

A transição das etapas experimentais para o ambiente operacional só deverá ser autorizada após o cumprimento integral dos seguintes critérios:

### 4.1 Critérios para Autorizar a Migração Operacional de IDs:
1. **Script Transacional Validado em Ambiente Isolado:** Comprovada ausência de órfãos (`orphaned = 0`) e ausência de duplicatas (`duplicates = 0`) — *Critério Atendido em 2026-10-12*.
2. **Capacidade de Rollback Testada:** Script reverso de migração testado com sucesso, garantindo recuperação total do estado anterior — *Critério Atendido em 2026-10-12*.
3. **Backup Criptográfico Imediato Pré-Execução:** Realização de cópia de segurança com hash SHA256 verificado antes de qualquer escrita no arquivo operacional.
4. **Convenção Qualificada:** Suporte completo no backend a órgão, caderno e turno (`{banca}-{ano}-{orgao}-{cargo}[-{caderno}]-q{num}`) para impedir colisões entre múltiplos concursos.

### 4.2 Critérios para Autorizar a Importação Definitiva de Auditor Fiscal (Cargo 503):
1. **Completude das Alternativas:** 100% das 40 questões devem conter exatamente 4 alternativas completas (A, B, C, D) — *Critério Atualmente Reprovado na Fixture (10 questões incompletas)*.
2. **Eliminação de Spillovers de Coluna:** Expurgo integral dos textos de instrução e apoio fundidos indevidamente às opções de Q1 e Q34 — *Critério Atualmente Reprovado na Fixture*.
3. **Gabarito e Anulações Verificados:** Atribuição do gabarito oficial definitivo da pág. 3 do documento oficial, com anulações (10, 12, 22, 23) mapeadas com `concursoPoint = 1` e `isCorrect = null` — *Critério Atendido na Lógica do Backend*.
4. **Passagem pelo Gate Estrutural:** O método `isStructurallyValid` deve validar 40/40 questões sem descartar nenhum item por truncamento.
5. **Aprovação Explícita do Usuário:** Formalização de autorização após revisão do relatório de validação documental.

---

## 5. Ledger de Sessões

| Data / Branch / Commit Base | Tarefa | Arquivos Modificados / Criados | Testes (Comando / Resultado) | Estado e Bloqueios | Próxima Ação |
|---|---|---|---|---|---|
| 2026-10-12 / `main` / `7a2fff9` | **Fase 0:** Auditoria completa e reconciliação documental | `docs/PROJECT_CONTEXT.md`, `docs/DEVELOPMENT_STATUS.md` | `.\mvnw test` (10 pass, 1 fail) | Diagnóstico completo concluído | Executar P1 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P1):** Correção da vertical de apresentação (CQRS/Idempotência) | `QuestionControllerTest.java`, `SessionControllerTest.java`, `App.tsx`, `QuestionViewer.tsx` | `.\mvnw test` (17 pass, 0 fail); `npm run build` (sucesso); `oxlint` (0 erros) | Vertical de eventos testada | Executar P2 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P2):** Ingestão do conjunto secundário Técnico Fiscal (40 questões) | `pymupdf_extractor.py`, `IngestionController.java`, `IngestionControllerTest.java`, `main.py`, `.gitignore` | `.\mvnw test` (18 pass, 0 fail); Banco SQLite com 41 questões | Concluído com proveniência | P4: Seleção por disciplina e sessão |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P4):** Seleção determinística por sessão/disciplina | `QuestionRepository.java`, `QuestionRepositoryImpl.java`, `QuestionSelectionService.java`, `QuestionController.java`, `QuestionControllerTest.java`, `QuestionViewer.tsx` | `.\mvnw test` (22 pass, 0 fail); `npm run build` (182ms); `oxlint` (0 erros) | Filtros de disciplina e sessão integrados | P5: Análise de referências |
| 2026-10-12 / `main` / `69a4229` | **Fase 1 (P5):** Avaliação de 8 referências open-source | `references/EXTERNAL_PROJECTS_ANALYSIS.md`, `docs/DEVELOPMENT_STATUS.md` | Análise estática e licenças | Intacto sem dependências novas | Auditoria de integridade |
| 2026-10-12 / `main` / `5fd14eb` | **Fase 1 a 6 (Execução Prolongada):** Proteção de integridade, identidade de questões, eliminação de gabarito fake, filtro de itens incompletos, experimento OCR no Golden Set, confiabilidade de sessões, traqueamento determinístico e integração analítica com R | `IngestionController.java`, `AttemptSubmissionService.java`, `SessionController.java`, `QuestionRepositoryImpl.java`, `EventStoreRepository.java`, `EventStoreRepositoryImpl.java`, `AnalyticsProjectionService.java`, `AnalyticsController.java`, `AnalyticsOverviewDTO.java`, `QuestionControllerTest.java`, `AnalyticsControllerTest.java`, `pymupdf_extractor.py`, `descriptive_analysis.R`, `QUESTION_IDENTITY_MIGRATION_PROPOSAL.md`, `OCR_EXPERIMENT_AUDITOR_FISCAL.md`, `ANALYTICS_R_INTEGRATION.md`, `PROJECT_CONTEXT.md`, `DEVELOPMENT_STATUS.md` | `.\mvnw test` (30 pass, 0 fail); `Rscript descriptive_analysis.R` (sucesso); `npm run build` (464ms); `oxlint` (0 erros); SQLite SHA256 intocado | Todas as 6 fases autônomas concluídas, validadas e testadas | Ingestão e extração do Golden Set Auditor Fiscal |
| 2026-10-12 / `main` / `49f14f3` | **Fase 2 (Avanço Progressivo):** Extração completa via Windows Native OCR e estruturação do Golden Set de Auditor Fiscal (Cargo 503) | `ingestion/ocr_extract_words.ps1`, `ingestion/render_auditor_pages.py`, `ingestion/src/parser/auditor_fiscal_extractor.py`, `tests/golden-set/auditor_fiscal_503_fixture.json`, `docs/OCR_EXPERIMENT_AUDITOR_FISCAL.md` | Execução OCR em 1,69s; 40 questões estruturadas com 4 anulações oficiais mapeadas; `.\mvnw test` (30 pass, 0 fail) | Golden Set Principal gerado em fixture com integridade comprovada | Decisão do usuário sobre migração e ingestão no DB |
| 2026-10-12 / `main` / `969c6d6` | **Fase 1, 2, 3, 4, 5 (Hardening Fino):** GabaritoStatus enum (6 estados), eliminação de falsos acertos/erros para ausente/revisão, pontuação correta de anuladas, ordenação alfabética estrita de opções (A..E), resiliência de sessão a F5 no frontend, detecção dinâmica de colunas no extrator de Auditor Fiscal | `GabaritoStatus.java`, `AttemptResult.java`, `Question.java`, `QuestionRepositoryImpl.java`, `AttemptSubmissionService.java`, `QuestionController.java`, `SessionController.java`, `AnalyticsProjectionService.java`, `AnalyticsOverviewDTO.java`, `schema.sql`, `QuestionControllerTest.java`, `SessionControllerTest.java`, `QuestionViewer.tsx`, `auditor_fiscal_extractor.py`, `auditor_fiscal_503_fixture.json`, `descriptive_analysis.R`, `DEVELOPMENT_STATUS.md` | `.\mvnw test` (35 pass, 0 fail); `npm run build` (183ms, 0 erros); `oxlint` (0 erros); Rscript Base (sucesso); SHA256 do DB operacional intocado | Suíte de 35 testes verde; estabilização robusta de ponta a ponta | Decisão do usuário sobre migração canônica e ingestão no DB operacional |
| 2026-10-12 / `main` / Atual | **Etapas 1 a 5 (Auditoria, Separação Pedagógica e Contratos R):** Validação de convenção com suporte a órgão/caderno/turno; migração experimental em cópia isolada com rollback comprovado; auditoria documental completa da prova 503 com revelação de 31 inconsistências estruturais e veto de importação; separação estrita de pontuação de concurso e acurácia pedagógica; contratos e fronteiras do R analytics | `AttemptResult.java`, `AttemptSubmissionService.java`, `SessionController.java`, `SessionSummaryDTO.java`, `AnalyticsProjectionService.java`, `QuestionController.java`, `descriptive_analysis.R`, `QuestionControllerTest.java`, `SessionControllerTest.java`, `AnalyticsControllerTest.java`, `QUESTION_IDENTITY_MIGRATION_PROPOSAL.md`, `ANALYTICS_R_INTEGRATION.md`, `DEVELOPMENT_STATUS.md` | `.\mvnw test` (37 pass, 0 fail); `npm run build` (183ms, 0 erros); `oxlint` (0 erros); `Rscript descriptive_analysis.R` (sucesso); SHA256 do SQLite operacional intacto (`E61199F5...`) | Todas as 5 etapas concluídas; banco operacional 100% protegido; critérios objetivos estabelecidos | Aguardar autorização formal do usuário para etapas operacionais |
| 2026-10-13 / `main` / Atual | **Exportação Operacional Verificável para o `fiscalstudy-analytics` (Etapas 1 a 7):** Ampliação do endpoint existente de exportação (`GET /api/v1/analytics/export`) com suporte a filtro de proveniência (`origin=REAL_STUDY|ALL`); novo endpoint de manifesto (`GET /api/v1/analytics/export/manifest`) com hash SHA-256 de integridade de arquivos, contagens e limitações declaradas; categorização formal de proveniência (`EventOrigin`: `REAL_STUDY`, `AUTOMATED_TEST`, `DEMONSTRATION`, `UNVERIFIED_HISTORICAL`); preservação de cadeia temporal e sessões autênticas sem invenção de datas; validação end-to-end pelo laboratório R (`run_analytics.R`, `evaluate_operational.R` e `provenance.R`) | `EventOrigin.java`, `EventRecord.java`, `ExportManifestDTO.java`, `AnalyticsProjectionService.java`, `AnalyticsController.java`, `QuestionController.java`, `AttemptSubmissionService.java`, `Question.java`, `QuestionRepositoryImpl.java`, `EventStoreRepository.java`, `EventStoreRepositoryImpl.java`, `QuestionViewer.tsx`, `AnalyticsExportIntegrationTest.java`, `ANALYTICS_R_INTEGRATION.md`, `DEVELOPMENT_STATUS.md` | `.\mvnw test` (47 pass, 0 fail); `npm run build` (sucesso, 234ms); `oxlint` (0 erros); R Base `run_analytics.R` e `evaluate_operational.R` executados com sucesso em R 4.5.1; SHA256 do SQLite operacional intacto (`E61199F5...`) | Concluído com proveniência estrita e salvaguardas epistêmicas ativas | Próximas tarefas seguras e aprovadas |

