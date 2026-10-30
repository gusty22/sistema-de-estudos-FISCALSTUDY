# Matriz de Mensuração dos Alvos Científicos de Aprendizagem (v1)

## Estado Verificado e Escopo Arquitetural

- **Módulo**: `analytics-engine/` (R >= 4.5.1 / Base R com `tools` e `jsonlite`).
- **Branch**: `feature/frente-c-learning-instruments`.
- **Papel**: Especificação contratual canônica e formal dos seis alvos científicos de previsão implementados no motor R (`lab/decision_scientific_evaluation.R`).
- **Natureza Operacional**: Somente leitura sobre o log de eventos append-only; zero escritas no SQLite operacional do Core App; zero autoridade de agendamento (`can_schedule = FALSE`) e aplicação (`can_apply = FALSE`).
- **Validação Empírica Pessoal**: `NOT_ESTABLISHED`. Zero observações pessoais auditadas foram registradas para estes alvos. As fixtures sintéticas demonstram o comportamento do software sob condições controladas e adversariais, nunca aprendizagem humana real.

---

## 1. Compromissos Epistemológicos Invioláveis

A mensuração da aprendizagem no FiscalStudy rejeita simplificações comportamentais rasas com base na literatura contemporânea de ciência cognitiva e psicometria (Bjork, Roediger & Karpicke, Cronbach, Messick):

1. **Acerto Imediato Não É Retenção Nem Compreensão**:
   O acerto de uma questão imediatamente após a leitura do material ou em revisão de curtíssimo prazo reflete apenas ativação temporária na memória de trabalho (*working memory*) ou reconhecimento passivo de superfície. A retenção duradoura exige intervalo de desativação temporal explícito e recuperação ativa esforçada (*desejáveis dificuldades*).
2. **Questão Repetida Não É Prova de Transferência**:
   Reapresentar a mesma questão (mesmo enunciado, mesma alternativa ou pequenas variações léxicas) afere apenas memória episódica do item. A transferência exige um instrumento com estrutura de superfície divergente e invariante estrutural/conceitual profunda mantida.
3. **Renomeação de Identificador Não Fabrica Independência**:
   Alterar o `unit_id` de uma questão sem comprovar divergência substantiva de família/gabarito (`template_id != UNKNOWN`, classificação confirmada por especialista ou comissão) constitui fraude psicométrica.
4. **Associação Observacional Pré/Pós Não É Efeito Causal**:
   Medir a pontuação antes e depois de uma atividade de estudo registra estritamente uma associação observacional descritiva condicionada à execução da política. Sem controle aleatorizado e contrabalanceamento, efeitos de maturação, histórico e regressão à média impedem a inferência de benefício causal contrafactual (*uplift* ou *Average Treatment Effect*).
5. **Preservação de Estados Não Estabelecidos**:
   Dados faltantes, abstenções de modelo, instrumentos não confirmados e históricos vazios são reportados com seus denominadores explícitos e estados `NOT_ESTABLISHED` ou `DESCRIPTIVE_ONLY`. É proibida qualquer imputação favorável fictícia.

---

## 2. Visão Geral dos Seis Alvos Científicos

O sistema avalia previsões congeladas prospectivas sobre seis desfechos futuros empiricamente distintos:

```
+---------------------------------------------------------------------------------------------------+
|                                 ALVOS CIENTÍFICOS DO FISCALSTUDY                                 |
+------------------------------------+--------------------------------------------------------------+
| 1. DELAYED_ITEM_RETRIEVAL          | Recuperação de item com intervalo de retenção mínimo         |
| 2. NOVEL_ITEM_CORRECTNESS          | Acerto na primeira apresentação de item em sessão formal     |
| 3. APPLICATION_SUCCESS             | Resolução de problema prático independente de aplicação     |
| 4. TRANSFER_SUCCESS                | Resolução de instrumento independente de transferência       |
| 5. ACTIVITY_DURATION_SECONDS       | Duração ativa observada de atividade pedagógica concluída    |
| 6. POST_INTERVENTION_SUCCESS       | Desfecho em instrumento pós-intervenção condicional à ação   |
+------------------------------------+--------------------------------------------------------------+
```

---

## 3. Matriz Científica Comparativa Completa (15 Dimensões)

A tabela a seguir consolida a matriz formal das 15 dimensões requeridas para cada um dos 6 alvos:

| Dimensão Contratual | 1. DELAYED_ITEM_RETRIEVAL | 2. NOVEL_ITEM_CORRECTNESS | 3. APPLICATION_SUCCESS | 4. TRANSFER_SUCCESS | 5. ACTIVITY_DURATION_SECONDS | 6. POST_INTERVENTION_SUCCESS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Instrumento Necessário** | Sonda de recuperação ativa espaçada sem pistas (`RECORDED_ITEM`). | Item inédito em exame formal representativo ou simulado sem exposição. | Instrumento independente de aplicação prática (`INDEPENDENT_APPLICATION`). | Instrumento independente de transferência conceitual (`INDEPENDENT_TRANSFER`). | Telemetria ativa de sessão com detecção de pausas e relógio verificado. | Pós-avaliação independente (`INDEPENDENT_POST_ASSESSMENT`) pós-estudo. |
| **2. Unidade Observacional** | Tentativa física de recuperação de um item específico (`attempt_id`, `unit_id`). | Primeira resposta observada para o par (`unit_id`, `template_id`). | Resposta a problema independente de aplicação (`unit_id`, `template_id`). | Resposta a instrumento independente de transferência (`unit_id`, `template_id`). | Atividade pedagógica autorizada e concluída (`execution_id`, `unit_id`). | Desfecho pós-intervenção vinculado à execução (`execution_id`, `outcome_id`). |
| **3. Evento de Preparação** | `DEFINITION_REGISTERED` com `min_retention_seconds > 0`. | `DEFINITION_REGISTERED`; blueprint opcional com pesos iguais. | `DEFINITION_REGISTERED` com `classification=INDEPENDENT_APPLICATION` e status `CONFIRMED`. | `DEFINITION_REGISTERED` com `classification=INDEPENDENT_TRANSFER` e status `CONFIRMED`. | `DEFINITION_REGISTERED` com `scoring_source=ACTIVE_TIME_TELEMETRY`. | `DEFINITION_REGISTERED` com janela pós-término `[min_delay, max_delay]`. |
| **4. Previsão Congelada** | `FORECAST_COMMITTED` com cutoffs de treino/dados <= emissão < desfecho. | `FORECAST_COMMITTED` emitido antes de qualquer apresentação do item. | `FORECAST_COMMITTED` emitido antes da tentativa de aplicação. | `FORECAST_COMMITTED` emitido antes da tentativa de transferência. | `FORECAST_COMMITTED` em segundos >= 0 emitido antes do `started_at`. | `FORECAST_COMMITTED` vinculado à política executada antes do desfecho. |
| **5. Resultado Futuro** | `OUTCOME_OBSERVED` com `value` binário em `{0, 1}`. | `OUTCOME_OBSERVED` com `value` binário em `{0, 1}`. | `OUTCOME_OBSERVED` com `value` binário em `{0, 1}`. | `OUTCOME_OBSERVED` com `value` binário em `{0, 1}`. | `OUTCOME_OBSERVED` com `value == active_seconds` (segundos ativos). | `OUTCOME_OBSERVED` com `value` binário pós-conclusão da atividade. |
| **6. Critério de Pontuação** | `DEFINITIVE_ANSWER_KEY` ou `INDEPENDENT_BLINDED_RUBRIC`. | `DEFINITIVE_ANSWER_KEY` ou `INDEPENDENT_BLINDED_RUBRIC`. | `DEFINITIVE_ANSWER_KEY` ou `INDEPENDENT_BLINDED_RUBRIC`. | `DEFINITIVE_ANSWER_KEY` ou `INDEPENDENT_BLINDED_RUBRIC`. | `ACTIVE_TIME_TELEMETRY` igual a `executions$active_seconds`. | `DEFINITIVE_ANSWER_KEY` ou `INDEPENDENT_BLINDED_RUBRIC`. |
| **7. Procedência** | Registro append-only com hash SHA-256; origem homogênea. | Origem única auditada (`REAL_STUDY` com custódia ou `SYNTHETIC_FIXTURE`). | Hash canônico de transporte; origem e estudante únicos. | Registro append-only; pseudônimo único e custódia rastreada. | Telemetria de relógio de interação gravada no fluxo append-only. | Vínculo de acompanhamento (`followups`) com hash de integridade. |
| **8. Evidência de Independência** | Intervalo específico do item; templates compartilhados não provam retenção. | Zero contatos prévios com `unit_id` e zero com `template_id`. | Classificação confirmada de aplicação; template_id conhecido != UNKNOWN. | Template distinto dos templates já estudados; classificação confirmada. | Validação de relógio: `started_at <= ended_at <= et[event]`, tempo ativo <= delta. | Classificação independente confirmada; pré-medida registrada antes do início. |
| **9. Assistência** | `assistance == "NONE"` e `answer_exposed == FALSE`. | `assistance == "NONE"` e `answer_exposed == FALSE`. | `assistance == "NONE"` e `answer_exposed == FALSE`. | `assistance == "NONE"` e `answer_exposed == FALSE`. | `assistance == "NONE"` e `answer_exposed == FALSE`. | `assistance == "NONE"` e `answer_exposed == FALSE`. |
| **10. Exposição Anterior** | Pelo menos um contato prévio antes do cutoff; ZERO contatos intervenientes. | ZERO contatos anteriores (estudo, apresentação ou resolução). | ZERO contatos anteriores com a unidade de aplicação ou seu template. | ZERO contatos anteriores com a unidade de transferência ou seu template. | Execuções prévias da mesma definição formam prefixo histórico. | ZERO contatos prévios com o item ou template do pós-teste. |
| **11. Intervalo Temporal** | `retention_lag_seconds >= min_retention_seconds`; janela delay válida. | `delay_seconds` em `[min_delay, max_delay]`. | `delay_seconds` em `[min_delay, max_delay]`. | `delay_seconds` em `[min_delay, max_delay]`. | Previsão antes de `started_at`; tempo decorrido > 0. | `post_lag = occurred_at - ended_at` em `[min_delay, max_delay]`. |
| **12. Elegibilidade** | Lag de retenção atingido, sem ajuda, sem gabarito exposto, sem intervenção. | Ineditismo estrito de item e template, sem ajuda, sem gabarito exposto. | Classificação confirmada, template válido, sem exposição prévia nem ajuda. | Classificação confirmada, template divergente inédito, sem ajuda. | Execução autorizada e completada, relógio consistente, tempo coincidente. | Execução autorizada e completada, pós-lag na janela, política compatível. |
| **13. Motivos de Exclusão** | `DELAYED_RETRIEVAL_INTERVAL_NOT_ESTABLISHED`, `INTERVENING_ITEM_CONTACT`, etc. | `PRIOR_ITEM_OR_TEMPLATE_EXPOSURE`, `ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT`. | `INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED`, `TEMPLATE_INDEPENDENCE_UNKNOWN`, etc. | `INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED`, `TEMPLATE_INDEPENDENCE_UNKNOWN`, etc. | `NO_COMPLETED_AUTHORIZED_EXECUTION`, `DURATION_EXECUTION_DISAGREEMENT`, etc. | `NO_COMPLETED_AUTHORIZED_EXECUTION`, `POST_ASSESSMENT_OUTSIDE_REGISTERED_WINDOW`. |
| **14. Limitações** | Acesso ao traço não prova maestria conceitual nem retenção vitalícia. | Ineditismo no log não prova ineditismo semântico na vida pregressa. | Sucesso em caso concreto não garante generalização para outros casos. | Não prova transferência espontânea sob alta pressão psicológica de prova. | Tempo ativo não mede profundidade cognitiva ou atenção sustentada. | Associação observacional pré/pós NÃO é efeito causal contrafactual. |
| **15. Capacidade Atual** | `SYNTHETIC_CONTRACT_ONLY`; piloto pessoal `NOT_ESTABLISHED`. | `SYNTHETIC_CONTRACT_ONLY`; piloto pessoal `NOT_ESTABLISHED`. | `SYNTHETIC_CONTRACT_ONLY`; piloto pessoal `NOT_ESTABLISHED`. | `SYNTHETIC_CONTRACT_ONLY`; piloto pessoal `NOT_ESTABLISHED`. | `SYNTHETIC_CONTRACT_ONLY`; piloto pessoal `NOT_ESTABLISHED`. | `SYNTHETIC_CONTRACT_ONLY`; piloto pessoal `NOT_ESTABLISHED`. |

---

## 4. Contratos Formais e Invariantes do Motor R

### 4.1 Registro de Alvos (`scientific_target_matrix()`)
No arquivo `analytics-engine/lab/decision_scientific_evaluation.R`, a função pura `scientific_target_matrix()` exporta as 15 dimensões em estrutura canônica de lista, servindo como fonte de verdade programática para validação de definições e composição do relatório final.

### 4.2 Barreira Temporal e Prevenção de Vazamento (*Data Leakage*)
Para cada previsão $f$ com corte de dados $t_{data}$, corte de treino $t_{train}$, instante de ocorrência $t_{occ}(f)$ e instante de registro $t_{rec}(f)$, o motor impõe:
$$t_{train} \le t_{data} \le t_{occ}(f) \le t_{rec}(f) < t_{occ}(y)$$
Onde $t_{occ}(y)$ é o instante do desfecho futuro. Qualquer evidência citada no compromisso de previsão deve ter ocorrido e sido registrada estritamente antes de $t_{data}$.

### 4.3 Separação de Atraso e Intervalo de Retenção
Para `DELAYED_ITEM_RETRIEVAL`, o sistema mantém duas variáveis temporais rigorosamente separadas:
1. `delay_seconds`: $t_{occ}(y) - t_{occ}(f)$ (tempo decorrido entre o compromisso da previsão e a observação do resultado).
2. `retention_lag_seconds`: $t_{occ}(y) - \max_{e \in \text{prior}}(t_{occ}(e))$ (tempo decorrido desde o último contato real com aquele item específico).

Apenas $t_{occ}(y) - \max(t_{occ}(\text{prior})) \ge \text{min\_retention\_seconds}$ qualifica a tentativa como retenção tardia.

### 4.4 Isolamento de Contatos Intervenientes (`INTERVENING_ITEM_CONTACT`)
Se houver qualquer contato de estudo (`LEARNING`), apresentação de questão (`ASSESSMENT_PROMPT` não reservada) ou resolução prévia entre $t_{occ}(f)$ e $t_{occ}(y)$, a tentativa é desqualificada com o código `INTERVENING_ITEM_CONTACT`, pois o traço de memória foi reativado no intervalo, invalidando a previsão de decaimento espontâneo.

---

## 5. Baselines Psicométricos e Comparação Pareada

### 5.1 Alvos Binários (1, 2, 3, 4, 6)
- **Métricas**: Brier Score ($BS = \frac{1}{n} \sum (p_i - y_i)^2$), Log Loss / Cross-Entropy, Intervalo de Wilson para a taxa observada, Bins de Calibração (decis de probabilidade).
- **Referências Temporais de Prefixo**:
  - `PREFIX_BETA11`: $\frac{\sum_{i=1}^n y_i + 1}{n + 2}$ (estimativa de Laplace / prior conjugado Beta(1,1) calculada apenas sobre desfechos elegíveis do mesmo `definition_id` registrados estritamente antes do corte).
  - `PREFIX_RECENT20_BETA11`: Estimativa Beta(1,1) restrita aos últimos 20 desfechos históricos elegíveis.
- **Comparação Pareada**: Pontuada exatamente nos mesmos IDs de previsão. Diferença pareada $\Delta = \text{Loss}(\text{Modelo}) - \text{Loss}(\text{Baseline})$. Sinal negativo indica perda inferior (vantagem descritiva do modelo no subconjunto pareado), sem inferência de superioridade universal.

### 5.2 Alvo Contínuo de Duração (5)
- **Métricas**: Erro Médio Absoluto (MAE em segundos), Raiz do Erro Quadrático Médio (RMSE em segundos), Erro Assinado Médio ($\bar{p} - \bar{y}$).
- **Referências Temporais de Prefixo**:
  - `PREFIX_MEAN_SECONDS`: Média aritmética dos segundos ativos observados no prefixo da mesma definição.
  - `PREFIX_MEDIAN_SECONDS`: Mediana dos segundos ativos observados no prefixo.
  - Se o prefixo for vazio ($n=0$), a comparação permanece `NOT_ESTABLISHED`.

---

## 6. Taxonomia de Códigos de Exclusão

Quando uma tentativa ou previsão é inspecionada por `outcome_issues()`, qualquer desvio das invariantes gera um código de exclusão explícito, alterando o status para `NOT_SCORED` (previsão) ou `NOT_ATTRIBUTABLE` (associação de política), sem descartar a tentativa do denominador global:

1. `DELAYED_RETRIEVAL_INTERVAL_NOT_ESTABLISHED`: Intervalo desde o último contato é inferior a `min_retention_seconds` ou contato anterior ausente.
2. `INTERVENING_ITEM_CONTACT`: Contato intermediário com o item ocorreu entre o compromisso da previsão e o resultado.
3. `PRIOR_ITEM_OR_TEMPLATE_EXPOSURE`: Contato anterior observado em item ou template que exigia ineditismo estrito.
4. `TEMPLATE_INDEPENDENCE_UNKNOWN`: Identificador de template desconhecido (`UNKNOWN`) ou não textual em alvos que exigem independência.
5. `INDEPENDENT_INSTRUMENT_NOT_ESTABLISHED`: Classificação do instrumento não confirmada como independente pelo especialista.
6. `ASSISTANCE_OR_EXPOSURE_UNKNOWN_OR_PRESENT`: Presença de dicas, gabarito exposto ou status de assistência não estritamente `NONE`.
7. `BINARY_CRITERION_REQUIRED`: Valor de desfecho não binário em alvo que requer gabarito dicotômico `{0, 1}`.
8. `OUTCOME_OUTSIDE_PREDECLARED_HORIZON`: Atraso entre previsão e desfecho fora da janela registrada `[min_delay, max_delay]`.
9. `NO_COMPLETED_AUTHORIZED_EXECUTION`: Atividade vinculada não possui status `COMPLETED` com autorização `AUTHORIZED`.
10. `ACTIVE_DURATION_NOT_ESTABLISHED`: Segundos ativos ausentes, negativos ou não finitos na telemetria.
11. `DURATION_EXECUTION_DISAGREEMENT`: Divergência entre segundos ativos reportados na execução e no desfecho.
12. `POST_ASSESSMENT_OUTSIDE_REGISTERED_WINDOW`: Desfecho pós-intervenção ocorreu fora da janela registrada após o término da execução.
13. `FOLLOWUP_BEFORE_EXECUTION_COMPLETED`: Pós-avaliação ocorreu antes do término registrado da intervenção.
14. `INCOMPARABLE_OR_LATE_PRE_MEASURE`: Pré-medida registrada após o início da atividade ou com definição divergente.
15. `DEFINITION_NOT_AVAILABLE_AT_CUTOFF`: Definição registrada após o corte de dados da previsão.
16. `MODEL_ABSTAINED`: Modelo acionou abstenção explícita (`forecast_status == "ABSTAIN"`).
17. `PENDING_OUTCOME`: Previsão comprometida sem desfecho correspondente no corte de avaliação.

---

## 7. Replay das Políticas e Limite Causal

1. **Replay Canônico Obrigatório**:
   Cada decisão em `decisions` é re-executada pelo orquestrador analítico com suas entradas exatas. Se o resultado Divergir em 1 byte do rastro original, a avaliação é imediatamente interrompida com `POLICY_STATE_OR_COMPARISON_REPLAY_MISMATCH`.
2. **Execução Real vs Substituição**:
   Somente a ação efetivamente executada e concluída conforme autorizado recebe associação com desfechos posteriores. Atividades ignoradas, parciais ou substituídas externamente têm seu desfecho classificado como `NOT_ATTRIBUTABLE`.
3. **Causalidade Não Estabelecida**:
   Em todas as saídas analíticas, os campos `causal_effect` e `personal_validation` permanecem fixados em `NOT_ESTABLISHED`. A existência dos contratos e a passagem em 100% dos testes sintéticos verificam o software, mas não autorizam reivindicar ganho pedagógico ou eficácia de intervenção.

---

## 8. Verificação e Reprodutibilidade

Para reproduzir a suíte completa de verificação dos contratos científicos e alvos no ambiente de desenvolvimento:

```powershell
# A partir da raiz do analytics-engine
& "C:\Program Files\R\R-4.5.1\bin\Rscript.exe" tests/test_runner.R
```

Invariante esperada: Código de saída `0`, 100% dos testes aprovados, zero falhas.
