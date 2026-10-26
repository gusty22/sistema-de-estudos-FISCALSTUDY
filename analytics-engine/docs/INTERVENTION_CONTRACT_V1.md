# Contrato de Eventos de Intervenção Pedagógica (v1)
# FiscalStudy Analytics

> **Documento:** `docs/INTERVENTION_CONTRACT_V1.md`  
> **Versão do Contrato:** 1.0.0  
> **Compatibilidade:** FiscalStudy V1 (interface desacoplada para exportação/avaliação)  
> **Formato de Transporte:** CSV estruturado (`interventions_v1.csv`) ou payload JSON

---

## 1. Princípios e Limites de Governança

1. **Isolamento Absoluto do Banco Operacional:**
   - Este contrato define a estrutura analítica de transporte para dados de intervenção.
   - Nenhuma escrita direta, gatilho ou alteração de schema é executada sobre o SQLite operacional (`db/fiscalstudy.db`).
   - A integração ocorre exclusivamente por exportações periódicas auditáveis.

2. **Natureza Científica das Intervenções:**
   - Intervenções não são "prescrições mágicas", mas hipóteses pedagógicas testáveis.
   - Toda intervenção registra o problema que a motivou, a atividade realizada, o tempo investido e a verificação empírica de seu resultado (imediato e posterior).

3. **Uso de Fixtures Sintéticas:**
   - Dados sintéticos de intervenção são restritos aos testes automatizados em `tests/fixtures/`.
   - É terminantemente proibido simular intervenções sintéticas como se fossem sessões reais de estudantes.

---

## 2. Esquema Tabular do Arquivo: `interventions_v1.csv`

| Coluna | Tipo R | Nulável? | Domínio / Valores Válidos | Descrição |
|---|---|---|---|---|
| `intervention_id` | `character` | Não | String não-vazia única (UUID) | Identificador imutável da intervenção pedagógica. |
| `session_id` | `character` | Não | String não-vazia | Sessão de estudo na qual a intervenção ocorreu. |
| `occurred_at` | `character` | Não | ISO-8601 UTC (ex: `2026-10-12T15:00:00Z`) | Momento exato em que a intervenção foi aplicada. |
| `observed_problem` | `character` | Não | Identificador do sinal motivador (ex: `SIG_OVERCONFIDENCE_ERROR`, `SIG_RECURRENT_ERROR_Q_q002`) | Causa analítica observada que disparou a recomendação. |
| `recommended_activity` | `character` | Não | `REVIEW_COMMENTED_SOLUTION`, `SPACED_PRACTICE_DRILL`, `THEORY_SUMMARY_READING`, `CONTRASTIVE_ANALYSIS`, `FLASHCARD_RECALL` | Tipo da atividade recomendada ao estudante. |
| `justification` | `character` | Não | Texto explicativo claro | Racional pedagógico documentado da recomendação. |
| `method_used` | `character` | Não | `ACTIVE_RECALL`, `ELABORATIVE_FEEDBACK`, `SPACED_PRACTICE`, `DESIRABLE_DIFFICULTY`, `STANDARD_FEEDBACK` | Princípio de aprendizagem metodológica empregado. |
| `consulted_material` | `character` | Não | Identificador ou URI do material (ex: `item:q002`, `art:ctn_150`, `doc:imunidades`) | Material de apoio ou item consultado pelo estudante. |
| `time_spent_ms` | `numeric` | Não | Inteiro $\ge 0$ e $\le 3.600.000$ (até 60 min) | Duração ativa do estudante na atividade interventiva (em milissegundos). |
| `immediate_outcome` | `character` | Não | `CORRECT`, `INCORRECT`, `COMPLETED`, `ABANDONED`, `NOT_APPLICABLE` | Resultado observado na checagem imediatamente após a atividade. |
| `post_assessment_event_id` | `character` | Sim | UUID ou `NA` | Identificador da tentativa posterior de teste no `events_v1.csv` que avaliou a retenção. |
| `post_assessment_type` | `character` | Não | `SAME_QUESTION`, `SAME_TOPIC_NEW_QUESTION`, `TRANSFER_ITEM`, `NONE` | Natureza do item de teste utilizado na reavaliação posterior. |
| `post_assessment_lag_hours` | `numeric` | Sim | Valor $\ge 0$ ou `NA` | Tempo decorrido em horas entre a intervenção e a avaliação posterior. |
| `post_outcome` | `character` | Não | `CORRECT`, `INCORRECT`, `PENDING_EVALUATION`, `SKIPPED` | Desfecho verificado na reavaliação posterior. |

---

## 3. Regras de Validação e Integridade

1. **Erros Bloqueantes (`BLOCKING_ERROR`):**
   - Ausência de colunas obrigatórias.
   - Timestamps em formato inválido que não possam ser interpretados via ISO-8601 UTC.
   - `time_spent_ms < 0` ou valor não-numérico.
   - Valores fora dos domínios permitidos em `recommended_activity`, `method_used`, `immediate_outcome`, `post_assessment_type` ou `post_outcome`.
   - Identificadores de intervenção duplicados.

2. **Avisos de Qualidade (`WARNING`):**
   - Intervenção com `time_spent_ms < 5000` (menos de 5 segundos, indicando leitura sumária ou cancelamento rápido).
   - `post_outcome == "PENDING_EVALUATION"` com atraso temporal superior a 14 dias (avaliação posterior possivelmente perdida).
   - `post_assessment_type == "SAME_QUESTION"` registrado como evidência de transferência conceitual (inconsistência metodológica).


## Extensão analítica compatível 1.1.0 — vínculo de acompanhamento

Entrada V1 permanece. Saída acrescenta evaluation_version, declared_evaluated_count, unverified_followup_count, followup_audit, inference_scope, assessment_type_status, intervention_origin_status, transfer_status e is_validated/can_apply/can_schedule=false.

evaluated_count agora significa tentativa avaliável com event_id único, estritamente posterior ao occurred_at da intervenção e coerente com o desfecho declarado. Sem attempts_df ou vínculo verificável, a declaração não entra no denominador. Avaliação compartilhada por intervenções é ambígua e não é contada. Intervalo declarado é preservado; intervalo observado usa os dois instantes.

Isso não verifica identidade conceitual, novidade, equivalência curricular, término da intervenção, confundidores ou causalidade. SAME_QUESTION, SAME_TOPIC_NEW_QUESTION e TRANSFER_ITEM permanecem rótulos declarados. A comparação continua observacional mesmo após atingir o mínimo operacional.
