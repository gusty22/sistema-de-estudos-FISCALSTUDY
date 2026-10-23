# Contrato de Dados Versionado (v1)
# FiscalStudy Analytics

> **Versão do Contrato:** 1.0.0  
> **Compatibilidade:** FiscalStudy V1 (Java 17 / SQLite `event_store` e `questions`)  
> **Formato de Transporte:** CSV estruturado (delimitador vírgula `,`, codificação UTF-8)

---

## 1. Matriz de Classificação das Necessidades Analíticas

| Necessidade Analítica | Campos Operacionais Requeridos | Origem no FiscalStudy | Classificação de Disponibilidade | Observações e Limitações |
|---|---|---|---|---|
| **1. Desempenho por Disciplina** | `disciplina`, `is_correct` | `questions.disciplina`, payload de `ANSWER_SUBMITTED` | **Existente e disponível** | Mapeado diretamente do banco e eventos. |
| **2. Desempenho por Tópico** | `assunto` (ou `topico`), `is_correct` | `questions.assunto`, payload de `ANSWER_SUBMITTED` | **Existente, mas insuficiente** | Campo existe na tabela `questions`, mas é frequentemente nulo na ingestão da V1. |
| **3. Tempo de Resolução** | `active_time_ms` | payload de `ANSWER_SUBMITTED` | **Existente e disponível** | Medido em milissegundos de foco ativo pelo frontend. |
| **4. Confiança Declarada** | `confidence_level` | payload de `ANSWER_SUBMITTED` | **Existente e disponível** | Escala discreta de 1 a 5 (1 = palpite total, 5 = certeza absoluta). |
| **5. Calibração Metrológica** | `confidence_level`, `is_correct` | payload de `ANSWER_SUBMITTED` | **Existente e disponível** | Permite Brier Score, ECE (Expected Calibration Error) em 5 faixas e matriz de sobreconfiança. |
| **6. Evolução Temporal** | `occurred_at`, `session_id` | `event_store.occurred_at`, `event_store.session_id` | **Existente e disponível** | Timestamp UTC em formato ISO-8601. |
| **7. Tentativas Repetidas** | `question_id`, sequenciamento temporal | Múltiplos eventos `ANSWER_SUBMITTED` no `event_store` | **Existente e disponível** | O log append-only preserva o histórico de todas as tentativas. |
| **8. Retenção Observada** | Intervalo $\Delta t$ entre repetições da mesma questão | `occurred_at` da tentativa $k$ e $k+1$ para a mesma questão | **Existente e disponível (mesma questão)** / **Não disponível (transferência de conceito)** | A repetição da mesma questão é observável, mas a retenção de conceitos abstratos entre questões distintas depende de taxonomia granular de tópicos. |
| **9. Intervenções Pedagógicas** | Tipo de intervenção, timestamp | Eventos pedagógicos deliberados | **Planejado / Não disponível** | V1 registra apenas sessões e questões; eventos do tipo `INTERVENTION_TRIGGERED` ainda não existem. |
| **10. Resultados Posteriores** | Performance pré vs pós intervenção | Eventos sequenciais com marcador de intervenção | **Dependente de decisão / Planejado** | Depende da implementação formal de intervenções pedagógicas e grupos de controle. |

---

## 2. Especificação do Arquivo: `events_v1.csv`

Representa a exportação tabular e auditável do log de eventos de resolução de questões do FiscalStudy.

| Coluna | Tipo R | Nulável? | Domínio / Valores Válidos | Descrição |
|---|---|---|---|---|
| `event_id` | `character` | Não | UUID v4 válido | Identificador único e imutável do evento. |
| `event_type` | `character` | Não | `ANSWER_SUBMITTED`, `QUESTION_PRESENTED`, `STUDY_SESSION_STARTED`, `STUDY_SESSION_ENDED` | Tipo do evento de aprendizagem. |
| `session_id` | `character` | Não | String não-vazia | Identificador da sessão de estudo. |
| `question_id` | `character` | Condicional (Não para `ANSWER_` e `QUESTION_`) | String não-vazia | Identificador único da questão. |
| `occurred_at` | `character` | Não | ISO-8601 UTC (ex: `2026-10-12T14:30:00Z`) | Momento exato da ocorrência no cliente. |
| `selected_option` | `character` | Condicional (Não para `ANSWER_SUBMITTED`) | `A`, `B`, `C`, `D`, `E` | Letra da alternativa escolhida pelo estudante. |
| `is_correct` | `logical` | Condicional (Não para `ANSWER_SUBMITTED`) | `TRUE`, `FALSE` | Avaliação do acerto comparado ao gabarito oficial. |
| `confidence_level` | `integer` | Condicional (Não para `ANSWER_SUBMITTED`) | `1`, `2`, `3`, `4`, `5` | Nível de confiança declarado (1 a 5). |
| `active_time_ms` | `numeric` | Condicional (Não para `ANSWER_SUBMITTED`) | Inteiro $\ge 0$ e $\le 1.800.000$ (30 min) | Tempo de tela ativa gasto na resolução, em milissegundos. |

---

## 3. Especificação do Arquivo: `questions_v1.csv`

Representa o catálogo de questões disponíveis no banco do FiscalStudy.

| Coluna | Tipo R | Nulável? | Domínio / Valores Válidos | Descrição |
|---|---|---|---|---|
| `question_id` | `character` | Não | String não-vazia única | Identificador único da questão. |
| `enunciado` | `character` | Não | Texto | Texto base e comando da questão. |
| `correct_option` | `character` | Sim (pode ser nulo se preliminar/anulada) | `A`, `B`, `C`, `D`, `E`, `ANULADA` | Gabarito oficial definitivo. |
| `disciplina` | `character` | Não | Texto normalizado (ex: `Direito Tributário`) | Disciplina da questão. |
| `assunto` | `character` | Sim | Texto ou `NA` | Tópico ou subassunto específico. |
| `banca` | `character` | Sim | Texto (ex: `IBGP`, `FCC`, `FGV`) | Banca examinadora. |
| `ano` | `integer` | Sim | Inteiro (ex: 2023, 2024) | Ano de aplicação da prova. |
| `orgao` | `character` | Sim | Texto (ex: `Prefeitura de Araguari`) | Órgão ou entidade demandante. |
| `cargo` | `character` | Sim | Texto (ex: `Auditor Fiscal`) | Cargo do concurso. |
| `is_annulled` | `logical` | Não | `TRUE`, `FALSE` | Indicador se a questão foi anulada pela banca. |

---

## 4. Regras de Validação e Integridade do Contrato

1. **Denominadores e Amostras:** Análises que cruzarem `events_v1.csv` com `questions_v1.csv` devem ignorar questões anuladas para métricas de calibração, mas registrá-las no inventário de volume de estudo.
2. **Tempo Ativo:** Valores de `active_time_ms` menores que 1.000 ms (1 segundo) são considerados atípicos (possível clique acidental ou leitura negligente) e devem ser assinalados como aviso. Valores maiores que 30 minutos (1.800.000 ms) são considerados abandono de sessão e sinalizados.
3. **Escala de Confiança:** Qualquer valor fora do intervalo $[1, 5]$ configura erro bloqueante (`BLOCKING_ERROR`).

---

## 5. Diretrizes de Procedência, Rastreabilidade e Custódia de Dados

Todo dataset consumido pelo laboratório analítico deve ser formalmente classificado em uma das 4 categorias de procedência:

1. `PROVEN_OPERATIONAL`:
   - Proveniente do banco de dados operacional de produção.
   - Exige rastreabilidade comprovada: timestamps UTC `occurred_at`, `session_id`, identificador de estudante e manifesto de exportação assinado.
   - **Único nível autorizado a emitir o perfil real do estudante.**
2. `DEMONSTRATION_SAMPLE`:
   - Amostras de desenvolvimento e validação de schema (ex: `sample_data.csv`, `sample_export_v1.csv`).
   - Permitido para testes de integração e adaptadores.
   - **Terminantemente proibido inferir proficiência real do usuário.**
3. `SYNTHETIC_FIXTURE`:
   - Conjuntos de dados sintéticos controlados em `tests/fixtures/`.
   - Utilizados exclusivamente para testes unitários automatizados.
4. `UNVERIFIED_SOURCE`:
   - Conjuntos sem cadeia de custódia demonstrada. Rebaixados por padrão para proteger consumidores a jusante.

Qualquer tentativa de classificar dados amostrais ou sintéticos como `PROVEN_OPERATIONAL` é rejeitada automaticamente pelo validador `R/provenance.R`.

