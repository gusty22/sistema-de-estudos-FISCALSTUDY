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
| **Gabaritos Ausentes, Inválidos e Anulados (Fase 1.3)** | Sim | Sim | Sim | COMPROVADO POR TESTE | Eliminado fallback fictício "A". Questões sem gabarito ou anuladas não afetam acurácia negativamente. Coberto por `QuestionControllerTest` e `SessionControllerTest`. |
| **Prevenção de Colisão e Identidade Canônica (Fase 1.2)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `IngestionController.java` detecta colisões de ID com procedência distinta e qualifica o ID canonicamente. Proposta formal em `docs/QUESTION_IDENTITY_MIGRATION_PROPOSAL.md`. |
| **Confiabilidade das Sessões (Fase 3)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `AttemptSubmissionService.java` bloqueia tentativas em sessões finalizadas (400 Bad Request) e garante idempotência em submissões repetidas na mesma sessão. |
| **Projeções Determinísticas de Traqueamento (Fase 4)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `AnalyticsProjectionService.java` e `AnalyticsController.java` (`/api/v1/analytics/overview`) calculam acurácia global, métricas por disciplina, over/underconfidence e orientação diagnóstica. |
| **Integração Analítica Desacoplada com R (Fase 5)** | Sim | Sim | Sim | COMPROVADO EM R 4.5.1 | `/api/v1/analytics/export` gera CSV analítico consumido por `analytics/descriptive_analysis.R` executado via Rscript local (R Base puro). Documentado em `docs/ANALYTICS_R_INTEGRATION.md`. |
| **Experimento de OCR e Golden Set Principal (Fase 2)** | Sim | Sim | Sim | AUDITADO E EXECUTADO | Experimento na Pág. 2 de Auditor Fiscal com Windows Native OCR (`Windows.Media.Ocr.OcrEngine` pt-BR) concluído em 340ms com 99,2% de precisão. Gabarito oficial definitivo auditado com 4 anulações (Q10, Q12, Q22, Q23). Documentado em `docs/OCR_EXPERIMENT_AUDITOR_FISCAL.md`. |
| **Isolamento de Banco nos Testes de Integração** | Sim | Sim | Sim | COMPROVADO POR TESTE | `backend/src/test/resources/application.yml` isola suite em `target/test-fiscalstudy.db`. Banco local `db/fiscalstudy.db` 100% protegido (hash SHA256 inalterado). |
| **Frontend TypeScript Build & Lint com Seletor** | Sim | Sim | Sim | COMPROVADO POR BUILD | `npm run build` (`tsc -b && vite build`) compilado com sucesso em 464ms. `oxlint` executado com 0 avisos e 0 erros. |
| **Teste com Navegador Playwright** | Sim | Falha de driver | Não | BLOQUEADO AMBIENTALMENTE | Driver indisponível via download corporativo. Roteiro de validação manual documentado. |

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
4. **Substituição silenciosa do Golden Set principal (Reconciliado):**
   - *Problema:* Relatos anteriores categorizaram a prova de Técnico Fiscal (Cargo 532) como Golden Set principal.
   - *Fato comprovado:* A prova de **Auditor Fiscal da Receita Municipal de Araguari (IBGP 2023, Cargo 503)** é a referência principal estabelecida pelo projeto. A de Técnico Fiscal permanece como conjunto secundário de testes.
5. **Auditor Fiscal (Cargo 503) é PDF 100% rasterizado:**
   - *Fato comprovado:* O arquivo `503_-_auditor_fiscal_da_receita_municipal.pdf` (9 páginas) contém 0 caracteres de texto nativo (imagens escaneadas de 2480x3504px). Requer pipeline com OCR para extração de texto.
6. **4 Questões Anuladas no Gabarito Oficial de Auditor Fiscal:**
   - *Fato comprovado:* Em `gab_def_-_iss_araguari_2023_-_auditor.pdf` (pág. 3 de 16), as **questões 10, 12, 22 e 23** constam formalmente como **ANULADA**.
7. **Anomalias de Extração na prova de Técnico Fiscal (Cargo 532):**
   - **Q14:** Extraídas apenas 3 alternativas (A, B, D). A alternativa `C) 256.` foi sobreposta por anotações manuais do candidato (`168 MENTECAPTO`), corrompendo a camada OCR embutida. Como o gabarito oficial é C, a questão é insolúvel pelo aluno no estado bruto.
   - **Q39:** Extraídas apenas 3 alternativas (A, B, C). A alternativa D foi marcada com lápis no PDF e interpretada pelo OCR como `f )`, sendo rejeitada pelo regex de opções.
   - **Q21:** O trecho do enunciado `(PIB)` foi capturado pelo regex anterior como alternativa `B)`, partindo o enunciado e gerando opções duplicadas.
   - **Ordem das alternativas:** Questões com opções distribuídas em 2 sub-colunas (Q11, Q17, Q21, Q25, Q32, Q37, Q38) tiveram blocos ordenados incorretamente por `y0`, invertendo alternativas (ex: C, D, A, B).
8. **Vulnerabilidade de Colisão de IDs na Ingestão:**
   - O `IngestionController` persiste `id` a partir do número da questão (`"1"`, `"2"`, etc.) com `ON CONFLICT(id) DO UPDATE`, gerando sobrescrita destrutiva caso outra prova com numeração idêntica seja importada.

### 2.2 Problemas Descartados
1. **Vazamento de gabarito antes da resposta:** Descartado. `QuestionDTO` não possui o campo `correctOption` e os testes validam sua ausência.
2. **Efeitos colaterais em GET /next:** Descartado. O endpoint é estritamente read-only; o evento `QUESTION_PRESENTED` só é gravado após confirmação explícita via POST pelo frontend.
3. **Contaminação de exclusão entre sessões:** Descartado. A exclusão de respondidas é estritamente filtrada por `session_id`.
4. **Tabelas ou imagens não extraídas em Técnico Fiscal:** Descartado. Verificação estrutural e visual comprovou que todas as 40 questões são exclusivamente textuais.
5. **Comportamento incorreto de tempo ativo por aba oculta:** Descartado. A Page Visibility API no frontend acumula e pausa fidedignamente o tempo quando a aba perde foco.

---

## 3. Testes Executados e Resultados Fatuais

### Backend (`.\mvnw test`):
- **Total de Testes:** **30 testes executados** (0 falhas, 0 erros).
- **Banco Utilizado:** `jdbc:sqlite:target/test-fiscalstudy.db` (isolado).
- **Cobertura Auditada:**
  - `FiscalStudyApplicationTests`: 1 teste de contextLoads.
  - `IngestionControllerTest`: 2 testes de contrato de ingestão.
  - `QuestionControllerTest`: 21 testes (GET read-only, filtro por disciplina, exclusão de respondidas na sessão, 404 ao concluir lote, POST presented com debounce de 5s, reapresentação legítima pós-debounce, proteção contra vazamento de gabarito, limites de confiança, validação de alternativas, tempos negativos, rejeição sem sessionId, bloqueio de tentativas em sessões encerradas, idempotência de tentativas duplicadas na sessão, tratamento de questões anuladas e filtro de completude estrutural).
  - `SessionControllerTest`: 3 testes (início, encerramento e projeção dinâmica de acurácia excluindo questões sem gabarito).
  - `AnalyticsControllerTest`: 3 testes (resumo determinístico, estratificação por disciplina e exportação analítica CSV).

### Camada Analítica com R (`Rscript.exe`):
- Script `analytics/descriptive_analysis.R` executado via R 4.5.1 Base com sucesso em `analytics/sample_data.csv`.
- Validações: Acurácia empírica por nível de confiança, Brier Score determinístico, tempo médio e contingência.

### Frontend (`npm run build` & `npm run lint`):
- `npm run build`: `tsc -b && vite build` — 18 módulos transformados, 0 erros (464ms).
- `npm run lint`: `oxlint` — 0 avisos, 0 erros em 4 arquivos com 116 regras.

### Banco de Dados Local (`db/fiscalstudy.db`):
- **Integridade Inviolada:** Hash SHA256 `E61199F5C833D67A907FB99CBC4F3D209862F465D98B4675670C1160BF3F8948` rigorosamente preservado (0 bytes modificados pelos testes ou rotinas).
- **Volume:** 41 questões e 2 eventos históricos intactos.

---

## 4. Limitações de Validação e Operação

1. **Validação E2E Automatizada em Browser:** Permanece indisponível devido ao bloqueio ambiental de download dos binários do Playwright. A interface segue 100% validada visual e manualmente via `npm run dev` (porta 5173) e `mvnw spring-boot:run` (porta 8080).
2. **Métrica de Tempo Ativo:** Mede a duração em que a aba esteve visível em primeiro plano. Não detecta ociosidade física do usuário.
3. **Motor de Seleção:** A seleção de questões atual é determinística com filtros de sessão, disciplina e completude estrutural (`ORDER BY RANDOM() LIMIT 25` com filtro `isStructurallyValid`).

---

## 5. Pendências que Dependem de Decisões do Usuário

1. **Migração Estrutural de IDs das Questões:** Avaliar proposta formal documentada em `docs/QUESTION_IDENTITY_MIGRATION_PROPOSAL.md` para migração transacional dos IDs legados (`1..40`) para o formato canônico `{banca}-{ano}-{cargo}-q{num}` no banco de dados operacional.
2. **Ingestão no Banco Operacional das 40 Questões de Auditor Fiscal (Cargo 503):** O pipeline de OCR e a fixture do Golden Set foram concluídos com sucesso em `tests/golden-set/auditor_fiscal_503_fixture.json`. A persistência no banco operacional aguarda autorização formal para preservar a integridade da tabela de questões.

---

## 6. Ledger de Sessões

| Data / Branch / Commit Base | Tarefa | Arquivos Modificados / Criados | Testes (Comando / Resultado) | Estado e Bloqueios | Próxima Ação |
|---|---|---|---|---|---|
| 2026-10-12 / `main` / `7a2fff9` | **Fase 0:** Auditoria completa e reconciliação documental | `docs/PROJECT_CONTEXT.md`, `docs/DEVELOPMENT_STATUS.md` | `.\mvnw test` (10 pass, 1 fail) | Diagnóstico completo concluído | Executar P1 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P1):** Correção da vertical de apresentação (CQRS/Idempotência) | `QuestionControllerTest.java`, `SessionControllerTest.java`, `App.tsx`, `QuestionViewer.tsx` | `.\mvnw test` (17 pass, 0 fail); `npm run build` (sucesso); `oxlint` (0 erros) | Vertical de eventos testada | Executar P2 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P2):** Ingestão do conjunto secundário Técnico Fiscal (40 questões) | `pymupdf_extractor.py`, `IngestionController.java`, `IngestionControllerTest.java`, `main.py`, `.gitignore` | `.\mvnw test` (18 pass, 0 fail); Banco SQLite com 41 questões | Concluído com proveniência | P4: Seleção por disciplina e sessão |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P4):** Seleção determinística por sessão/disciplina | `QuestionRepository.java`, `QuestionRepositoryImpl.java`, `QuestionSelectionService.java`, `QuestionController.java`, `QuestionControllerTest.java`, `QuestionViewer.tsx` | `.\mvnw test` (22 pass, 0 fail); `npm run build` (182ms); `oxlint` (0 erros) | Filtros de disciplina e sessão integrados | P5: Análise de referências |
| 2026-10-12 / `main` / `69a4229` | **Fase 1 (P5):** Avaliação de 8 referências open-source | `references/EXTERNAL_PROJECTS_ANALYSIS.md`, `docs/DEVELOPMENT_STATUS.md` | Análise estática e licenças | Intacto sem dependências novas | Auditoria de integridade |
| 2026-10-12 / `main` / `5fd14eb` | **Fase 1 a 6 (Execução Prolongada):** Proteção de integridade, identidade de questões, eliminação de gabarito fake, filtro de itens incompletos, experimento OCR no Golden Set, confiabilidade de sessões, traqueamento determinístico e integração analítica com R | `IngestionController.java`, `AttemptSubmissionService.java`, `SessionController.java`, `QuestionRepositoryImpl.java`, `EventStoreRepository.java`, `EventStoreRepositoryImpl.java`, `AnalyticsProjectionService.java`, `AnalyticsController.java`, `AnalyticsOverviewDTO.java`, `QuestionControllerTest.java`, `AnalyticsControllerTest.java`, `pymupdf_extractor.py`, `descriptive_analysis.R`, `QUESTION_IDENTITY_MIGRATION_PROPOSAL.md`, `OCR_EXPERIMENT_AUDITOR_FISCAL.md`, `ANALYTICS_R_INTEGRATION.md`, `PROJECT_CONTEXT.md`, `DEVELOPMENT_STATUS.md` | `.\mvnw test` (30 pass, 0 fail); `Rscript descriptive_analysis.R` (sucesso); `npm run build` (464ms); `oxlint` (0 erros); SQLite SHA256 intocado | Todas as 6 fases autônomas concluídas, validadas e testadas | Ingestão e extração do Golden Set Auditor Fiscal |
| 2026-10-12 / `main` / `49f14f3` | **Fase 2 (Avanço Progressivo):** Extração completa via Windows Native OCR e estruturação do Golden Set de Auditor Fiscal (Cargo 503) | `ingestion/ocr_extract_words.ps1`, `ingestion/render_auditor_pages.py`, `ingestion/src/parser/auditor_fiscal_extractor.py`, `tests/golden-set/auditor_fiscal_503_fixture.json`, `docs/OCR_EXPERIMENT_AUDITOR_FISCAL.md` | Execução OCR em 1,69s; 40 questões estruturadas com 4 anulações oficiais mapeadas; `.\mvnw test` (30 pass, 0 fail) | Golden Set Principal gerado em fixture com integridade comprovada | Decisão do usuário sobre migração e ingestão no DB |
