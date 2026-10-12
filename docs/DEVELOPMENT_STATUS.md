# FiscalStudy — Estado e Registro de Desenvolvimento

> **Data de Atualização:** 2026-10-12  
> **Branch Atual:** `main`  
> **Fase Vigente:** Fase 1 — Auditoria de Integridade e Hardening da V1  

---

## 1. Inventário de Funcionalidades e Status

| Requisito / Componente | Implementado | Testado | Validado | Status | Evidência / Referência |
|---|---|---|---|---|---|
| **CQRS QUESTION_PRESENTED (Endpoint Explícito)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionController.java:51`, `QuestionSelectionService.java:31`. Coberto por `QuestionControllerTest` (GET é leitura pura; POST grava evento). |
| **Idempotência / Debounce Técnico (5 segundos)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `EventStoreRepositoryImpl.java:36` (`hasRecentEventSeconds` com janela de 5s). Testado em `QuestionControllerTest` para duplicata imediata e reapresentação legítima. |
| **Blindagem de Gabarito (Sem vazamento de resposta)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionDTO` não possui `correctOption`. `QuestionControllerTest` valida ausência. |
| **Validação de Payload de Tentativa (400 Bad Request)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionController.java:74` e `AttemptSubmissionService.java:20` validam `confidenceLevel (1-5)`, `activeTimeMs >= 0`, `sessionId` obrigatório e `selectedOption` existente. |
| **Ciclo de Sessão (Start, End, Projeção de Resumo)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `SessionController.java` grava `STUDY_SESSION_STARTED`, `STUDY_SESSION_ENDED` e projeta métricas de acerto, tempo médio e overconfidence. Coberto por `SessionControllerTest` (3 testes). |
| **Seleção Determinística por Sessão e Disciplina** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionRepositoryImpl.java:31` exclui questões com `ANSWER_SUBMITTED` na sessão atual e suporta filtro por disciplina. Coberto por `QuestionControllerTest`. |
| **Isolamento de Banco nos Testes de Integração** | Sim | Sim | Sim | COMPROVADO POR TESTE | `backend/src/test/resources/application.yml` isola suite em `target/test-fiscalstudy.db`. Banco local `db/fiscalstudy.db` 100% protegido contra `DELETE`. |
| **Frontend TypeScript Build & Lint com Seletor** | Sim | Sim | Sim | COMPROVADO POR BUILD | `npm run build` (`tsc -b && vite build`) compilado com sucesso em 334ms. `oxlint` executado com 0 avisos e 0 erros. |
| **Auditoria do Golden Set (Auditor vs Técnico)** | Sim | Sim | Sim | AUDITADO (DOCUMENTAL E VISUAL) | Auditor Fiscal (Cargo 503) restabelecido como Golden Set principal (PDF 100% rasterizado; 4 questões anuladas no gabarito oficial). Técnico Fiscal (Cargo 532) mantido como teste secundário. |
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
- **Total de Testes:** **23 testes executados** (0 falhas, 0 erros).
- **Banco Utilizado:** `jdbc:sqlite:target/test-fiscalstudy.db` (isolado).
- **Cobertura Auditada:**
  - `FiscalStudyApplicationTests`: 1 teste de contextLoads.
  - `IngestionControllerTest`: 2 testes de contrato de ingestão.
  - `QuestionControllerTest`: 17 testes (GET read-only, filtro por disciplina, exclusão de respondidas na sessão, 404 ao concluir lote, POST presented com debounce de 5s, teste de reapresentação legítima após debounce, proteção contra vazamento de gabarito, validação de limites de confiança, alternativas inexistentes, tempos negativos e rejeição de tentativa sem `sessionId`).
  - `SessionControllerTest`: 3 testes (início, encerramento e projeção dinâmica de acurácia, tempo médio e overconfidence).

### Frontend (`npm run build` & `npm run lint`):
- `npm run build`: `tsc -b && vite build` — 18 módulos transformados, 0 erros (334ms).
- `npm run lint`: `oxlint` — 0 avisos, 0 erros em 4 arquivos com 116 regras.

### Banco de Dados Local (`db/fiscalstudy.db`):
- `SELECT COUNT(*) FROM questions`: **41 questões** preservadas (1 questão cold-start + 40 questões oficiais Técnico Fiscal Araguari).
- `SELECT COUNT(*) FROM event_store`: **2 eventos** preservados (`IMPORT_RECEIVED` e `STUDY_SESSION_ENDED`), comprovando integridade e preservação imutável pós-testes.

---

## 4. Limitações de Validação e Operação

1. **Validação E2E Automatizada em Browser:** Permanece indisponível devido ao bloqueio ambiental de download dos binários do Playwright. A validação de interface é reproduzível manualmente via `npm run dev` (porta 5173) e `mvnw spring-boot:run` (porta 8080).
2. **Métrica de Tempo Ativo:** Mede a duração em que a aba esteve visível em primeiro plano. Não detecta ociosidade física do usuário (ex: estudante ausente com o navegador aberto).
3. **Motor de Seleção:** A seleção de questões atual é determinística (filtro por disciplina + exclusão de respondidas na sessão via `ORDER BY RANDOM() LIMIT 1`), não devendo ser classificada como motor adaptativo.

---

## 5. Pendências que Dependem de Decisões do Usuário

1. **Pipeline de OCR para o Golden Set Principal (Auditor Fiscal - Cargo 503):** Definir a biblioteca para extração das 40 questões do PDF rasterizado `503_-_auditor_fiscal_da_receita_municipal.pdf` (PyMuPDF com OCR/Tesseract, Docling ou EasyOCR), integrando as 4 anulações oficiais (Q10, Q12, Q22, Q23).
2. **Tratamento das Questões Avariadas de Técnico Fiscal (Cargo 532):** Decidir se as questões com ruído OCR (Q14 sem opção C, Q39 sem opção D, Q21 com enunciado fragmentado) devem ser marcadas como inativas (`confidence_score < 1.0` / excluídas da seleção) ou corrigidas pontualmente no conjunto de testes secundário.
3. **Padrão de Nomenclatura de IDs de Questão:** Definir a convenção de IDs compostos na ingestão (ex: `ibgp-araguari-2023-tecnico-q14` ou UUID) para evitar colisões entre provas diferentes.

---

## 6. Ledger de Sessões

| Data / Branch / Commit Base | Tarefa | Arquivos Modificados | Testes (Comando / Resultado) | Estado e Bloqueios | Próxima Ação |
|---|---|---|---|---|---|
| 2026-10-12 / `main` / `7a2fff9` | **Fase 0:** Auditoria completa e reconciliação documental | `docs/PROJECT_CONTEXT.md`, `docs/DEVELOPMENT_STATUS.md` | `.\mvnw test` (10 pass, 1 fail) | Diagnóstico completo concluído | Executar P1 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P1):** Correção da vertical de apresentação (CQRS/Idempotência) | `QuestionControllerTest.java`, `SessionControllerTest.java`, `App.tsx`, `QuestionViewer.tsx` | `.\mvnw test` (17 pass, 0 fail); `npm run build` (sucesso); `oxlint` (0 erros) | Vertical de eventos testada | Executar P2 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P2):** Ingestão do conjunto secundário Técnico Fiscal (40 questões) | `pymupdf_extractor.py`, `IngestionController.java`, `IngestionControllerTest.java`, `main.py`, `.gitignore` | `.\mvnw test` (18 pass, 0 fail); Banco SQLite com 41 questões | Concluído com proveniência | P4: Seleção por disciplina e sessão |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P4):** Seleção determinística por sessão/disciplina | `QuestionRepository.java`, `QuestionRepositoryImpl.java`, `QuestionSelectionService.java`, `QuestionController.java`, `QuestionControllerTest.java`, `QuestionViewer.tsx` | `.\mvnw test` (22 pass, 0 fail); `npm run build` (182ms); `oxlint` (0 erros) | Filtros de disciplina e sessão integrados | P5: Análise de referências |
| 2026-10-12 / `main` / `69a4229` | **Fase 1 (P5):** Avaliação de 8 referências open-source | `references/EXTERNAL_PROJECTS_ANALYSIS.md`, `docs/DEVELOPMENT_STATUS.md` | Análise estática e licenças | Intacto sem dependências novas | Auditoria de integridade |
| 2026-10-12 / `main` / `HEAD` | **Fase 1 (Auditoria V1):** Auditoria integral de dados, Golden Set, idempotência e isolamento de banco | `application.yml` (test), `QuestionController.java`, `EventStoreRepository.java`, `EventStoreRepositoryImpl.java`, `QuestionSelectionService.java`, `QuestionControllerTest.java`, `docs/DEVELOPMENT_STATUS.md` | `.\mvnw test` (23 pass, 0 fail); `npm run build` (334ms); `oxlint` (0 erros); SQLite audit (41 questões preservadas) | Integridade e isolamento comprovados por testes e evidências | Aguardar decisões do usuário ou prosseguir para P3 (Higiene/Consolidação) |
