# DATA_CONTRACT_V1 — Contrato de Dados Estrito: FiscalStudy Core & FiscalStudy Analytics (R)

> **Versão do Contrato:** 1.0.0  
> **Status:** Ativo / Homologado  
> **Ecossistema:** FiscalStudy Core (Java 17, Spring Boot, SQLite, React) $\leftrightarrow$ FiscalStudy Analytics (Base R)

---

## 1. Visão Geral e Princípios Fundamentais

O **FiscalStudy Core** adota uma arquitetura estritamente desacoplada entre a **máquina operacional de estudos** e o **laboratório psicométrico/estatístico**:

1. **Lógica "Burra" e Rápida (Spring Boot):** O backend Java não implementa regressões logísticas, análise de sobrevivência ou cálculo de intervalos de confiança em tempo real. Ele orquestra o ciclo de interface, persiste eventos imutáveis e consome artefatos JSON calculados externamente (`robin_hood_weights.json`).
2. **Event Store Imutável (SQLite):** Todo evento registrado no banco (`event_store`) é estritamente **append-only**. Uma questão resolvida gera um evento imutável `ANSWER_SUBMITTED` com telemetria de `active_time_ms` e `confidence_level`. Não existem operações de `UPDATE` ou `DELETE` no histórico.
3. **Metrologia e Calibração em R (`fiscalstudy-analytics`):** O sistema em R calcula o decaimento de memória baseado no intervalo temporal ($\Delta t$) entre exposições do mesmo assunto, confiança prévia ($C_{n-1}$), e acurácia ($Y_n$), parametrizando o Ponto Crítico de Intervenção via limite inferior do Intervalo de Confiança de Wilson a 95%.
4. **Loop de Reinjeção (Robin Hood):** O R emite um artefato JSON que instrui o Spring Boot a redistribuir tempo de estudo (roubando tempo de matérias hiper-consolidadas com retenção $> 90\%$ e injetando blocos emergenciais de 15 minutos em tópicos à beira do esquecimento).

---

## 2. Contrato de Exportação 1: `questions_v1.csv` (Vetor de Esquecimento e Tentativas)

- **Endpoint REST:** `GET /api/v1/analytics/export/questions-v1[?origin=REAL_STUDY|ALL]`
- **Content-Type:** `text/csv; charset=UTF-8`
- **Content-Disposition:** `attachment; filename="questions_v1.csv"`
- **Finalidade:** Alimentar os scripts `retention_analysis.R`, `descriptive_analysis.R` e `recommendation_evaluation.R`.

### 2.1 Esquema das Colunas

| Coluna | Tipo | Obrigatório | Descrição / Regra Metrológica | Exemplo |
|---|---|---|---|---|
| `attempt_id` | String (UUID) | Sim | Identificador único do evento de resposta no `event_store` | `e7a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c` |
| `question_id` | String | Sim | Identificador canônico da questão no catálogo | `q-ibgp-2023-01` |
| `session_id` | String | Sim | Identificador da sessão de estudos | `sess-2026-10-14-01` |
| `discipline` | String | Sim | Nome padronizado da disciplina do concurso | `Direito Tributário` |
| `topic` | String | Sim | Tópico/assunto específico associado à questão | `Imunidades Tributárias` |
| `occurred_at` | String (ISO-8601 UTC) | Sim | Timestamp exato da submissão da resposta | `2026-10-14T20:15:30Z` |
| `attempt_index_topic` | Integer | Sim | Número sequencial da tentativa $n$ deste estudante neste mesmo tópico ($1, 2, 3 \dots$) | `3` |
| `delta_t_hours` | Double | Sim | Tempo exato decorrido ($\Delta t$) em horas desde a tentativa $n-1$ no mesmo tópico (`0.0` na 1ª tentativa) | `48.50` |
| `delta_t_days` | Double | Sim | Tempo decorrido em dias ($\Delta t / 24.0$) | `2.02` |
| `prev_confidence_level` | Integer (1..5) / NA | Não | Nível de confiança declarado na tentativa anterior $n-1$ ($C_{n-1}$). `NA` na 1ª exposição. | `4` |
| `confidence_level` | Integer (1..5) | Sim | Nível de confiança declarado na tentativa atual $n$ ($C_n$) | `3` |
| `selected_option` | String | Sim | Alternativa marcada pelo estudante (`A`, `B`, `C`, `D`, `E`) | `B` |
| `official_option` | String / NA | Não | Alternativa oficial do gabarito da banca | `B` |
| `gabarito_status` | String | Sim | Status do gabarito oficial (`DEFINITIVO`, `PRELIMINAR`, `ANULADA`, `AUSENTE`, `SOB_REVISAO`) | `DEFINITIVO` |
| `is_correct` | Boolean / NA | Não | Acurácia pedagógica (`true`, `false`, ou `NA` se anulada/sem gabarito) | `true` |
| `y_n` | Integer (0..1) / NA | Não | Variável binária de acerto para regressão logística ($Y_n \in \{0, 1\}$). `NA` se anulada. | `1` |
| `active_time_ms` | Long | Sim | Tempo ativo em tela em milissegundos. Permite filtrar ruídos ($< 1000$ ms). | `45200` |
| `is_noise_filtered` | Boolean | Sim | `true` se $active\_time\_ms < 1000$ ms (indicativo de clique acidental ou chute cego) | `false` |
| `topic_difficulty_prior` | Double | Não | Dificuldade a priori do tópico (0.0 a 1.0, calculada pelo edital ou taxa histórica) | `0.45` |
| `board` | String | Sim | Banca examinadora | `IBGP` |
| `origin_type` | String | Sim | Proveniência formal (`REAL_STUDY`, `AUTOMATED_TEST`, `DEMONSTRATION`) | `REAL_STUDY` |
| `concurso_point` | Integer (0..1) | Sim | Pontuação oficial de concurso (1 para acerto ou questão anulada) | `1` |

---

## 3. Contrato de Exportação 2: `events_v1.csv` (Raw Event Store Log)

- **Endpoint REST:** `GET /api/v1/analytics/export/events-v1[?eventType=...&maxRowid=...]`
- **Content-Type:** `text/csv; charset=UTF-8`
- **Content-Disposition:** `attachment; filename="events_v1.csv"`
- **Finalidade:** Auditoria de proveniência completa, reconstrução determinística de projeções e testes de integridade cronológica.

### 3.1 Esquema das Colunas

| Coluna | Tipo | Descrição |
|---|---|---|
| `rowid` | Long | Identificador sequencial físico no SQLite |
| `event_id` | String (UUID) | Identificador único imutável do evento |
| `event_type` | String | Tipo do evento (`ANSWER_SUBMITTED`, `STUDY_SESSION_STARTED`, etc.) |
| `aggregate_type` | String | Tipo da entidade raiz (`QUESTION`, `SESSION`, `CYCLE`) |
| `aggregate_id` | String | Chave da entidade |
| `session_id` | String | Chave da sessão de estudos |
| `occurred_at` | String (ISO-8601 UTC) | Timestamp do cliente |
| `recorded_at` | String (ISO-8601 UTC) | Timestamp de escrita no banco |
| `event_version` | Integer | Versão do evento |
| `schema_version` | String | Versão do schema (`1.0.0`) |
| `payload_json` | String (JSON escapado) | Carga estruturada com dados brutos |

---

## 4. Contrato de Reinjeção: `robin_hood_weights.json` (Artefato do Laboratório R)

- **Localização de Saída no R:** `output/metrics/robin_hood_weights.json`
- **Endpoint de Consumo no Spring Boot:** `POST /api/v1/cycle/robin-hood/inject-weights` ou leitura do diretório configurado
- **Formato:** JSON UTF-8

### 4.1 Estrutura do Documento JSON

```json
{
  "contract_version": "1.0.0",
  "generated_at": "2026-10-14T23:59:00Z",
  "source_model": "survival_logistic_regression_wilson_v1",
  "parameters": {
    "target_minimum_retention": 0.85,
    "confidence_level_z": 1.96,
    "noise_cutoff_ms": 1000
  },
  "critical_topics": [
    {
      "discipline": "Auditoria",
      "topic": "Normas Relativas ao Relatório do Auditor",
      "beta_0": 2.15,
      "beta_1_decay": -0.68,
      "beta_2_conf": 0.42,
      "beta_3_diff": -0.31,
      "wilson_lower_bound": 0.742,
      "sample_size_n": 14,
      "metacognitive_penalty": true,
      "priority_score": 98.5,
      "recommended_intervention": "ANKI_FLASHCARD",
      "emergency_block_minutes": 15,
      "rationale": "Limite inferior de Wilson (74.2%) cruzou abaixo da meta de 85%. Erro com confiança 5 identificado (overconfidence). Prioridade máxima."
    }
  ],
  "hyper_consolidated_disciplines": [
    {
      "discipline": "Direito Constitucional",
      "wilson_lower_bound": 0.935,
      "projected_retention_14d": 0.912,
      "max_stealable_minutes": 30,
      "status": "DOADOR_DE_TEMPO"
    }
  ],
  "redistribution_plan": {
    "total_stolen_minutes": 15,
    "donor_discipline": "Direito Constitucional",
    "receiver_discipline": "Auditoria",
    "receiver_topic": "Normas Relativas ao Relatório do Auditor",
    "intervention_type": "EMERGENCIA_ROBIN_HOOD"
  }
}
```

---

## 5. Regras Matemáticas e Psicométricas em `retention_analysis.R`

### 5.1 Regressão Logística de Retenção

$$\text{logit}(P(Y_n = 1)) = \beta_0 + \beta_1 \ln(\max(\Delta t, 0.01)) + \beta_2 C_{n-1} + \beta_3 (\text{Dificuldade do Tópico})$$

- $\Delta t$: tempo em dias desde a exposição anterior.
- $C_{n-1}$: confiança prévia (1 a 5).
- $\beta_1 < 0$: coeficiente de decaimento de memória (taxa de esquecimento temporal).

### 5.2 Limite Inferior do Intervalo de Confiança de Wilson a 95%

Para evitar falácias de pequenas amostras (onde um estudante tem $2$ acertos em $2$ tentativas e parece ter $100\%$ de retenção):

$$W_{lower} = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

onde $z = 1.96$, $\hat{p} = \frac{\text{Acertos}}{n}$.

- **Regra de Decisão:** Se $W_{lower} < 0.85$, o tópico entra imediatamente na lista de `critical_topics`.
- Amostras pequenas com $n < 10$ produzem intervalos largos, rebaixando $W_{lower}$ e forçando a coleta de telemetria imediata.

---

## 6. Auditoria Epistemológica em `recommendation_evaluation.R`

### 6.1 Brier Skill Score (BSS)

$$BS_{modelo} = \frac{1}{N} \sum_{i=1}^N (P_i - Y_i)^2$$
$$BS_{baseline} = \frac{1}{N} \sum_{i=1}^N (P_{baseline} - Y_i)^2$$
$$BSS = 1 - \frac{BS_{modelo}}{BS_{baseline}}$$

- Se $BSS > 0$, o agendamento adaptativo de Robin Hood supera a revisão fixa de 7 dias com significância metrológica comprovada.
