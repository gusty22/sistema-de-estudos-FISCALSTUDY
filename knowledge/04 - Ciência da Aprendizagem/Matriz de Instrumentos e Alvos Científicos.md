# Matriz de Instrumentos e Alvos Científicos

Esta nota conecta os contratos psicométricos formais do Motor R (`analytics-engine/docs/LEARNING_TARGETS_MEASUREMENT_MATRIX_V1.md`) aos postulados epistemológicos e pedagógicos do FiscalStudy.

---

## 1. Princípios Científicos Invioláveis

1. **Acerto Imediato Não É Retenção**:
   Acertos em curto prazo refletem memória de trabalho; a retenção duradoura requer intervalo temporal de desativação e esforço de recuperação ativa.
2. **Questão Repetida Não É Transferência**:
   A repetição afere memória episódica do item; a transferência exige outro contexto superficial com invariante conceitual profunda.
3. **Identificador Não Cria Independência**:
   Renomear o `unit_id` de uma questão sem demonstrar independência substantiva (`template_id != UNKNOWN`) é metodologicamente inválido.
4. **Associação Observacional Não É Causalidade**:
   Diferença pré/pós é puramente descritiva; sem desenho aleatorizado contrabalanceado, o efeito causal contrafactual permanece estritamente `NOT_ESTABLISHED`.

---

## 2. Os Seis Alvos Canônicos

| Alvo | Instrumento | Unidade Observacional | Critério / Fonte |
| :--- | :--- | :--- | :--- |
| `DELAYED_ITEM_RETRIEVAL` | Sonda de recuperação ativa espaçada | Tentativa física de item | Gabarito definitivo ou rubrica cega; sem pistas |
| `NOVEL_ITEM_CORRECTNESS` | Item inédito em exame formal | Primeira resposta de item/template | Gabarito definitivo; zero exposição prévia |
| `APPLICATION_SUCCESS` | Problema prático independente | Problema de aplicação de regras | Classificação confirmada `INDEPENDENT_APPLICATION` |
| `TRANSFER_SUCCESS` | Instrumento independente de transferência | Resposta de transferência conceitual | Classificação confirmada `INDEPENDENT_TRANSFER` |
| `ACTIVITY_DURATION_SECONDS` | Telemetria ativa de sessão | Atividade pedagógica concluída | `ACTIVE_TIME_TELEMETRY` validada por relógio |
| `POST_INTERVENTION_SUCCESS` | Pós-avaliação independente | Desfecho pós-atividade | Condicional à intervenção executada e autorizada |

---

## 3. Especificação Técnica Detalhada

A especificação canônica completa em 15 dimensões, contendo equações de Wilson, escores de Brier, baselines temporais e taxonomia de exclusão, encontra-se documentada em:
- [LEARNING_TARGETS_MEASUREMENT_MATRIX_V1.md](file:///analytics-engine/docs/LEARNING_TARGETS_MEASUREMENT_MATRIX_V1.md)
- [SCIENTIFIC_DECISION_EVALUATION_V1.md](file:///analytics-engine/docs/SCIENTIFIC_DECISION_EVALUATION_V1.md)

---

## Vínculos Relacionados
- [[Evidências e Verificabilidade Científica]]
- [[Psicometria e Modelo R]]
- [[Recuperação Ativa]]
- [[Ciclo em 4 Estágios]]
