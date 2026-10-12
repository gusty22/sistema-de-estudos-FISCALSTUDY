# FiscalStudy — Estado e Registro de Desenvolvimento

> **Data de Atualização:** 2026-10-12  
> **Branch Atual:** `main`  
> **Commit Base Inicial:** `7a2fff9` (`feat(session): implementa calculo de projecao de metricas ao encerrar sessao`)

---

## 1. Inventário de Funcionalidades e Status

| Requisito / Componente | Implementado | Testado | Validado | Status | Evidência / Referência |
|---|---|---|---|---|---|
| **CQRS QUESTION_PRESENTED (Endpoint Explícito)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionController.java:51`, `QuestionSelectionService.java:31`. Coberto por `QuestionControllerTest` (GET é leitura pura; POST grava evento). |
| **Idempotência / Debounce de Apresentação** | Sim | Sim | Sim | COMPROVADO POR TESTE | `EventStoreRepositoryImpl.java:31` (`hasRecentEvent` com janela de 5 min). Testado em `recordPresentation_DuplicateCall_IsIdempotent`. |
| **Blindagem de Gabarito (Sem vazamento de resposta)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionDTO` não possui `correctOption`. `QuestionControllerTest` linha 56. |
| **Validação de Payload de Tentativa (400 Bad Request)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `AttemptSubmissionService.java:18` valida `confidenceLevel (1-5)`, `activeTimeMs >= 0`, `selectedOption` pertencente às opções. |
| **Ciclo de Sessão (Start, End, Projeção de Resumo)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `SessionController.java` grava `STUDY_SESSION_STARTED`, `STUDY_SESSION_ENDED` e projeta métricas de acerto, tempo médio e overconfidence. Coberto por `SessionControllerTest` (3 testes). |
| **Seleção de Questões na Sessão (P4)** | Sim | Sim | Sim | COMPROVADO POR TESTE | `QuestionRepositoryImpl.java:31` exclui questões já respondidas (`ANSWER_SUBMITTED`) na sessão atual e suporta filtro por disciplina. Coberto por `QuestionControllerTest` (4 novos testes). |
| **Frontend TypeScript Build & Lint com Seletor** | Sim | Sim | Sim | COMPROVADO POR BUILD | `npm run build` (`tsc -b && vite build`) compilado com sucesso em 182ms. `oxlint` executado com 0 avisos e 0 erros. Dropdown dinâmico de disciplinas integrado. |
| **Cold Start de Banco do Zero via Spring** | Sim | Sim | Sim | COMPROVADO POR TESTE | `application.yml` executa `schema.sql` em `db/fiscalstudy.db`. 22 testes JUnit passam com suíte de banco limpo. |
| **Ingestão Golden Set Araguari (40 questões oficiais)** | Sim | Sim | Sim | COMPROVADO POR EXECUÇÃO E SQL | `PyMuPDFExtractor` atualizado com regex tolerante a OCR (`QUEST[AÃ][O0]`), pareamento de gabarito oficial do cargo 532 e disciplinas por faixa. 40 questões importadas via `/api/v1/ingestion/import` para `db/fiscalstudy.db` e evento `IMPORT_RECEIVED` registrado. |
| **Teste com Navegador Playwright** | Sim | Falha de driver | Não | BLOQUEADO AMBIENTALMENTE | Subagente tentou execução; Playwright falhou com 404 ao baixar driver (`playwright-1.57.0-win32_x64.zip` em `azureedge.net`). Lacuna documentada e roteiro manual fornecido. |

---

## 2. Testes e Evidências Fatuais

### Backend (`.\mvnw test`):
- **Total de Testes:** 22 testes executados.
- **Falhas:** 0.
- **Erros:** 0.
- **Classes Testadas:**
  - `FiscalStudyApplicationTests`: 1 teste de contextLoads.
  - `IngestionControllerTest`: 2 testes de ingestão (payload vazio e payload completo com gabarito e metadados).
  - `QuestionControllerTest`: 16 testes (GET read-only sem side-effects, exclusão de questões já respondidas na sessão, retorno 404 quando concluído o lote da sessão, filtro por disciplina, listagem de disciplinas disponíveis, POST presented válido, POST presented duplicado com idempotência, validação de confiança, alternativas inválidas e tempos negativos).
  - `SessionControllerTest`: 3 testes (start session, end session, cálculo dinâmico de acurácia, tempo médio e contagem de excesso de confiança / overconfidence).

### Frontend (`npm run build` & `npm run lint`):
- `npm run build`: `tsc -b && vite build` — 18 módulos transformados, 0 erros.
- `npm run lint`: `oxlint` — 0 warnings e 0 errors em 4 arquivos com 116 regras.

### Banco de Dados (`db/fiscalstudy.db`):
- `SELECT COUNT(*) FROM questions`: **41 questões** (1 questão de cold-start inicial + 40 questões oficiais do concurso IBGP Araguari 2023 - Técnico Fiscal da Receita Municipal).
- `SELECT DISTINCT disciplina FROM questions`:
  - Língua Portuguesa (Q1..Q10)
  - Raciocínio Lógico (Q11..Q15)
  - Noções de Informática (Q16..Q20)
  - Conhecimentos Gerais (Q21..Q25)
  - Legislação Municipal (Q26..Q30)
  - Conhecimentos Específicos (Q31..Q40)
- `SELECT COUNT(*) FROM event_store`: Eventos imutáveis gravados (`STUDY_SESSION_ENDED`, `IMPORT_RECEIVED` com payload de 40 questões).

---

## 3. Limitação Ambiental e Roteiro de Validação Manual no Navegador

Como o ambiente do agente não possui os binários instalados do Playwright devido ao bloqueio de download (HTTP 404 no repositório de drivers da Microsoft), o teste E2E interativo em browser pode ser executado manualmente pelo usuário:
1. Em um terminal: `cd backend && .\mvnw spring-boot:run` (ou execute o jar gerado com Java 17).
2. Em outro terminal: `cd frontend && npm run dev`.
3. Abra o navegador em `http://localhost:5173`.
4. Escolha uma disciplina (ex: "Língua Portuguesa") ou deixe em "Todas as Disciplinas".
5. Clique em **"Iniciar Estudo"**.
6. Verifique a primeira questão carregada com as 4 alternativas reais.
7. Selecione uma alternativa, escolha o nível de confiança (1 a 5) e clique em **"Responder"**.
8. Verifique o feedback imediato (Correto/Incorreto) sem recarregar a tela.
9. Troque de aba no navegador por alguns segundos e retorne (verifique que o temporizador do tempo ativo pausa em abas ocultas graças à Page Visibility API).
10. Ao responder todas as questões da disciplina, confirme a exibição de "Você concluiu todas as questões disponíveis de [Disciplina]!".
11. Clique em **"Encerrar Sessão"** e veja o painel final com total respondido, acurácia, tempo médio e alerta de excesso de confiança (se houver).

---

## 4. Ledger de Sessões

| Data / Branch / Commit Base | Tarefa | Arquivos Modificados | Testes (Comando / Resultado) | Estado e Bloqueios | Próxima Ação |
|---|---|---|---|---|---|
| 2026-10-12 / `main` / `7a2fff9` | **Fase 0:** Auditoria completa e reconciliação documental | `docs/PROJECT_CONTEXT.md`, `docs/DEVELOPMENT_STATUS.md` | `.\mvnw test` (10 pass, 1 fail) | Diagnóstico completo concluído | Executar P1 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P1):** Correção da vertical de apresentação (CQRS/Idempotência) e ajuste de testes backend | `QuestionControllerTest.java`, `SessionControllerTest.java`, `App.tsx`, `QuestionViewer.tsx` | `.\mvnw test` (17 pass, 0 fail); `npm run build` (sucesso); `oxlint` (0 erros) | Vertical de eventos e sessão 100% testada e aprovada | Executar P2 |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P2):** Ingestão do Golden Set Araguari (40 questões) com pareamento do gabarito oficial | `pymupdf_extractor.py`, `IngestionController.java`, `IngestionControllerTest.java`, `main.py`, `.gitignore` | `.\mvnw test` (18 pass, 0 fail); Ingestão executada via REST; Banco validado via SQLite com 41 questões e eventos persistidos | Concluído com integridade e proveniência | P4: Seleção com filtros de disciplina e exclusão de questões repetidas |
| 2026-10-12 / `main` / `7a2fff9` | **Fase 1 (P4):** Seleção adaptativa de questões por sessão/disciplina e listagem de disciplinas | `QuestionRepository.java`, `QuestionRepositoryImpl.java`, `QuestionSelectionService.java`, `QuestionController.java`, `QuestionControllerTest.java`, `QuestionViewer.tsx` | `.\mvnw test` (22 pass, 0 fail); `npm run build` (182ms, 0 erros); `oxlint` (0 erros) | Seleção de questões integrada com histórico da sessão e filtro por disciplina | P3: Higiene de scripts temporários e documentação final |
| 2026-10-12 / `main` / `69a4229` | **Fase 1 (P5):** Análise completa de 8 projetos públicos de referência externa | `references/EXTERNAL_PROJECTS_ANALYSIS.md`, `docs/DEVELOPMENT_STATUS.md` | Análise estática, licenças, viabilidade, matriz e mapeamento aos 5 eixos estratégicos | Concluído sem alteração de escopo, dependências ou arquitetura | Retomar plano principal da V1 |

---

## 5. Avaliação de Referências Open-Source (P5 — Concluída e Registrada)

Documento permanente consolidado em: [`references/EXTERNAL_PROJECTS_ANALYSIS.md`](file:///c:/Users/washi/OneDrive/Área de Trabalho/sistema de estudos/references/EXTERNAL_PROJECTS_ANALYSIS.md).

Projetos analisados e recomendações consolidadas:
1. `mattpocock/skills` (`teach`, `handoff`, `wait-what`, `writing-for-agents`) — **Aproveitar agora** (nível conceitual de prompts e concisão de feedback ao aluno).
2. `THU-MAIC/OpenMAIC` — **Manter como referência** (simulação multi-agente para discursivas em V2/V3; rejeitar runtime LangGraph na V1).
3. `Imbad0202/academic-research-skills` — **Descartar** (licença CC BY-NC 4.0 restritiva contra fins comerciais; escopo de papers LaTeX descolado de concursos).
4. `rebelytics/one-skill-to-rule-them-all` (*Task Observer*) — **Aproveitar agora** (formaliza o padrão de inferência da filosofia do Terceiro Observador).
5. `thedotmack/claude-mem` — **Investigar posteriormente** (avaliar FTS nativo no SQLite próprio em V2; descartar ChromaDB e workers na V1).
6. `headroomlabs-ai/headroom` — **Investigar posteriormente** (relevante para compressão de enunciados longos quando forem integradas LLMs em V2; irrelevante no core determinístico da V1).
7. `denzainch/omniroute` (*OmniRoute*) — **Descartar** (roteador de infraestrutura externa multi-provedor sem papel no software local da V1).
8. `cloudflare/security-audit-skill` — **Aproveitar agora** (adotar matriz estática de segurança OWASP para auditoria contínua de endpoints Spring e SQLite).

*Diretriz Cumprida:* Nenhuma dependência foi instalada, a arquitetura determinística local-first permaneceu intacta e o plano de desenvolvimento principal pode prosseguir com segurança.

