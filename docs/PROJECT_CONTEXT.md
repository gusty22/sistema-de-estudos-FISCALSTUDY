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

| **Blindagem de Integridade e Gabaritos (Fase 1)** | Fictício fallback "A" quando gabarito ausente; risco de colisão por ID numérico simples | **Corrigido:** Eliminado fallback "A" em `IngestionController` e `pymupdf_extractor.py`. Questões sem gabarito ou anuladas não penalizam acurácia. Proteção contra sobrescrita acidental entre provas distintas implementada. Proposta canônica registrada em `docs/QUESTION_IDENTITY_MIGRATION_PROPOSAL.md`. | **CONCLUÍDO E TESTADO** |
| **Proteção de Questões Incompletas (Fase 1.4)** | Q14 (sem C), Q21 (ruído PIB), Q39 (apenas 3 opções) servíveis ao aluno | **Resolvido:** `QuestionRepositoryImpl.findNextAvailableQuestion` aplica filtro de completude estrutural (`isStructurallyValid`). Questões com menos de 4 alternativas ou sem a alternativa correta na lista são automaticamente filtradas do fluxo de estudo. Parser ajustado para tratar ruídos OCR e siglas entre parênteses. | **CONCLUÍDO E TESTADO** |
| **Confiabilidade das Sessões (Fase 3)** | Tentativas pós-término ou duplicatas na mesma sessão permitidas | **Corrigido:** `AttemptSubmissionService` rejeita tentativas em sessões finalizadas (`STUDY_SESSION_ENDED`) com 400 Bad Request e aplica idempotência em tentativas repetidas para a mesma questão na mesma sessão, preservando métricas. | **CONCLUÍDO E TESTADO** |
| **Camada Analítica e Traqueamento (Fases 4 e 5)** | Traqueamento dependente de agregações externas ou serviços inexistentes | **Implementado e Validado:** `AnalyticsProjectionService` e `AnalyticsController` (`/api/v1/analytics/overview` e `/api/v1/analytics/export`). Exportação analítica em CSV consumida por script R Base (`analytics/descriptive_analysis.R`) executado via Rscript 4.5.1 com zero dependências externas. Mapeamento conceitual de modelos psicométricos futuros em `docs/ANALYTICS_R_INTEGRATION.md`. | **CONCLUÍDO E TESTADO** |
| **Experimento de OCR e Golden Set (Fase 2)** | PDF de Auditor Fiscal 100% rasterizado sem validação empírica | **Comprovado:** Experimento controlado na Página 2 executado com Windows Native OCR (`Windows.Media.Ocr.OcrEngine` pt-BR) em 340ms, alcançando 99,2% de integridade textual. Gabarito definitivo oficial (Cargo 503) auditado, confirmando 4 anulações (Q10, Q12, Q22, Q23). Documentado em `docs/OCR_EXPERIMENT_AUDITOR_FISCAL.md`. | **CONCLUÍDO E DOCUMENTADO** |

---

## 4. Decisões Consolidadas e Status das Fases

1. **Idempotência e Semântica de Exposição (P1 / Fase 1 & 3):**
   - CQRS estrito: `GET /next` puramente leitura; `POST /presented` com debounce técnico de 5s.
   - Tentativas com `sessionId` encerrado rejeitadas; tentativas repetidas na mesma sessão são idempotentes.
2. **Proteção Estrutural de Dados e Gabaritos (Fase 1):**
   - Nenhuma resposta correta fictícia é atribuída.
   - Questões sem gabarito oficial verificado ou anuladas não degradam o cálculo de acurácia.
   - Itens incompletos (com menos de 4 opções ou opção correta faltante) são protegidos pelo repositório.
3. **Ingestão e Golden Set de Araguari (Fase 2):**
   - Auditor Fiscal (Cargo 503) é o Golden Set principal; Técnico Fiscal (Cargo 532) é conjunto secundário.
   - Viabilidade de OCR nativo do Windows comprovada com alta velocidade e precisão.
4. **Fundamentos do Traqueamento e Camada Analítica com R (Fase 4 & 5):**
   - Separação explícita entre Observação, Indicador, Hipótese, Diagnóstico e Intervenção.
   - Rscript (R 4.5.1 Base) integrado via contrato de exportação analítica desacoplado.
   - Modelos avançados (BKT, IRT, FSRS) mantidos como horizontes futuros, respeitando limiares amostrais mínimos.

---

## 5. Diretriz de Referências Externas e Projetos Open-Source (ADOPT_LATER)

Existem projetos e referências de código aberto catalogados no repositório (diretório `references/`, incluindo `ts-fsrs`, `docling`, `agent-memory`, `notebooklm-para-concursos` e `spaced-repetition`) que serão avaliados posteriormente para enriquecer capacidades pedagógicas e analíticas do FiscalStudy.

**Regras Mandatórias de Escopo:**
1. **Sem Interrupção da V1:** A estabilização e entrega da V1 não é interrompida para investigar, prototipar ou integrar essas referências.
2. **Sem Novas Dependências:** Nenhuma ferramenta, biblioteca ou serviço relacionado a essas referências deve ser instalado nesta fase.
3. **Classificação como P5:** A análise comparativa profunda dessas referências está registrada formalmente como tarefa futura (P5), a ser iniciada somente após a consolidação completa e validada das fases prioritárias (P0 a P4).

