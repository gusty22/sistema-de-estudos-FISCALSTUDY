# FiscalStudy — Contexto Consolidado e Reconciliado (2026-10-12)

> **Natureza:** Documento central de contexto consolidado, reconciliado com o código-fonte real, histórico Git e testes do repositório Antigravity. Preserva as decisões estratégicas e arquiteturais de `docs/PROMPT_MESTRE.md` e `AGENTS.md`.

---

## 1. Missão, Resultados e Limites

- **Objetivo Central:** Sistema pessoal adaptativo de preparação para concursos fiscais (iniciando por ISS Araguari e expandindo para SEFAZ-MG, Receita Federal e outros fiscos).
- **Filosofia do Terceiro Observador:** O sistema não é mero banco de questões nem visualizador de PDF; ele atua como um terceiro observador longitudinal que avalia atividade, desempenho, retenção, transferência e fluência para determinar a melhor próxima ação de estudo.
- **Princípio Operacional:** O sistema nunca confunde atividade com aprendizagem (horas estudadas != aprendido; questões resolvidas != dominado).
- **Limites de Escopo V1:** Foco estrito em desktop/tablet (web responsiva com React+Vite+TypeScript). Não utilizar React Native, microserviços, Kafka, Redis, modelos generativos para lógica determinística, nem integrações externas complexas (Drive/Anki/Spark/R) nesta fase inicial.

---

## 2. Arquitetura e Contratos

- **Backend:** Monólito modular em Java 17 + Spring Boot 3.3.4.
- **Banco de Dados:** SQLite local (`db/fiscalstudy.db`).
- **Arquitetura de Dados:** Append-only Event Log (`event_store`) + Projeções Materializadas. Nenhum evento histórico é editado ou apagado (`UPDATE` e `DELETE` proibidos no log de eventos).
- **Ingestão:** Python (PyMuPDF com extração estruturada de blocos e fallback OCR para imagens/digitalizações). PDFs originais não ficam armazenados permanentemente no banco local; apenas dados estruturados e recortes essenciais em `media_assets`.
- **Frontend:** React 19 + TypeScript + Vite.

---

## 3. Reconciliação do Estado Real vs. Relatos Anteriores

| Elemento | Relatado Anteriormente | Estado Real Comprovado no Repositório (2026-10-12) | Status |
|---|---|---|---|
| **P1 - Semântica de QUESTION_PRESENTED** | Evento gerado via `GET /next`, duplicável por React StrictMode/retries | **Resolvido na arquitetura:** CQRS estrito. `GET /next` é puramente de leitura. Criado `POST /api/v1/questions/{id}/presented` com verificação de idempotência/debounce (5 min) por sessão em `QuestionSelectionService.java`. O frontend `QuestionViewer.tsx` chama o POST explicitamente. | **CONCLUÍDO E TESTADO** |
| **Backend Unit Tests** | 11 testes passando no hardening #05.2 | 22 testes unitários e de integração passando integralmente com `.\mvnw test` (0 falhas, 0 erros). Cobertura inclui apresentação idempotente, ciclo de sessão, projeção de métricas, exclusão de questões respondidas e filtro de disciplinas. | **CONCLUÍDO E TESTADO** |
| **Frontend TypeScript Build** | Frontend funcional com ciclo de estudo | `tsc -b && vite build` compila com 0 erros (182ms). `oxlint` executado com 0 warnings e 0 errors. Tipos alinhados e dropdown de disciplinas integrado na UI. | **CONCLUÍDO E TESTADO** |
| **Ciclo de Sessão e Projeções** | Sessão de estudo não iniciada | Implementado no backend `SessionController` (`/start`, `/end`, `/{sessionId}/summary` calculando acerto, tempo médio e contagem de excesso de confiança/overconfidence via projeção de eventos) e no frontend `QuestionViewer.tsx`. | **CONCLUÍDO E TESTADO** |
| **Proteção de Gabarito** | DTO não vaza `correctOption` | Comprovado: `QuestionDTO` não possui o campo; teste unitário valida ausência. | **CONCLUÍDO E TESTADO** |
| **Validação de Resposta e Tempo** | `selectedOption` inválida e tempo negativo tratados | Implementado em `AttemptSubmissionService` e testado em `QuestionControllerTest` (400 Bad Request para opção inexistente, tempo < 0 e confiança fora de 1..5). | **CONCLUÍDO E TESTADO** |
| **Page Visibility API** | Tempo ativo corrigido para pausar em abas ocultas | Implementado em `QuestionViewer.tsx` ouvindo `visibilitychange` para pausar contagem quando a aba perde foco. | **CONCLUÍDO E TESTADO** |
| **Volume de Questões no SQLite (P2)** | Cerca de 32 questões IBGP Araguari | **41 questões** persistidas no banco oficial `db/fiscalstudy.db` (1 inicial + 40 questões oficiais da prova IBGP 2023 Araguari - Técnico Fiscal), pareadas com o gabarito oficial (cargo 532) e distribuídas em 6 disciplinas. Evento `IMPORT_RECEIVED` gravado na `event_store`. | **CONCLUÍDO E PERSISTIDO** |
| **Seleção Adaptativa por Disciplina e Sessão (P4)** | Seleção sem filtro de sessão ou disciplina | Implementado em `QuestionRepositoryImpl`: exclui questões já respondidas (`ANSWER_SUBMITTED`) na sessão atual e permite filtro por disciplina (`GET /api/v1/questions/disciplines` e `GET /api/v1/questions/next?disciplina=...`). Frontend com seletor interativo. | **CONCLUÍDO E TESTADO** |
| **Testes E2E com Navegador** | Bloqueado por falta de driver Playwright | Limitação ambiental comprovada (download de binário bloqueado com 404 em repositório externo). Roteiro manual passo-a-passo disponibilizado em `docs/DEVELOPMENT_STATUS.md`. | **DOCUMENTADO E REPRODUZÍVEL** |

---

## 4. Decisões Consolidadas e Status das Fases

1. **Idempotência e Semântica de Exposição (P1):**
   - A separação de responsabilidades (CQRS: `GET /next` para busca sem side-effects e `POST /presented` para confirmação da renderização) é a decisão canônica da aplicação.
   - Suíte de testes do backend (`QuestionControllerTest.java`) atualizada e aprovada com cobertura de debounce.
2. **Qualidade do Frontend (P1 & P4):**
   - Tipos corrigidos, compilação de produção e linter 100% limpos.
   - Dropdown de disciplinas integrado na tela inicial com tratamento de encerramento de questões disponíveis.
3. **Ingestão e Golden Set de Araguari (P2):**
   - Parser PyMuPDF ajustado com regex resiliente a OCR (`QUEST[AÃ][O0]`), pareamento de gabarito oficial do cargo 532 e disciplinas por faixa.
   - 40 questões oficiais persistidas no SQLite com rastreabilidade e proveniência completa.
4. **Seleção Inteligente por Sessão e Disciplina (P4):**
   - O estudante não recebe a mesma questão repetida durante uma mesma sessão, e pode focar em disciplinas específicas ou alternar entre elas.


---

## 5. Diretriz de Referências Externas e Projetos Open-Source (ADOPT_LATER)

Existem projetos e referências de código aberto catalogados no repositório (diretório `references/`, incluindo `ts-fsrs`, `docling`, `agent-memory`, `notebooklm-para-concursos` e `spaced-repetition`) que serão avaliados posteriormente para enriquecer capacidades pedagógicas e analíticas do FiscalStudy.

**Regras Mandatórias de Escopo:**
1. **Sem Interrupção da V1:** A estabilização e entrega da V1 não é interrompida para investigar, prototipar ou integrar essas referências.
2. **Sem Novas Dependências:** Nenhuma ferramenta, biblioteca ou serviço relacionado a essas referências deve ser instalado nesta fase.
3. **Classificação como P5:** A análise comparativa profunda dessas referências está registrada formalmente como tarefa futura (P5), a ser iniciada somente após a consolidação completa e validada das fases prioritárias (P0 a P4).

