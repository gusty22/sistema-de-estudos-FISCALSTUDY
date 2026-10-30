# Event Store Imutável

## 1. Princípio Central
O FiscalStudy adota o padrão **Append-Only Event Log + Projeções Materializadas**:
- Eventos passados são fatos históricos imutáveis.
- **Nunca são alterados nem apagados**.

---

## 2. Como Funciona na Prática
Quando o estudante resolve uma questão, adia uma revisão ou adiciona uma anotação sobre uma sessão de estudo:
1. O backend grava um evento atômico na tabela `event_store` com timestamp UTC e payload JSON.
2. A projeção materializada correspondente (ex: tabela `questions`, `study_notebooks` ou contadores de acerto) é atualizada para leitura rápida.
3. Se o estudante corrigir uma anotação anterior, o sistema **não** faz `UPDATE` no registro histórico; em vez disso, insere um novo evento `STUDY_SESSION_ANNOTATION_ADDED`, preservando a trilha completa de auditoria.

---

## 3. Benefícios
- **Auditoria Psicométrica**: O motor em R consegue reconstruir a trajetória de aprendizagem sem risco de dados corrompidos.
- **Rastreabilidade**: Mudanças de gabarito ou retificações de bancas preservam o registro do que o estudante marcou na época.

---

## 4. Idempotência Estrita e Detecção de Replay Conflitante (Auditado 2026-10-30)
- **Inserção Única Concorrente:** A operação `appendEventOnce` utiliza a chave única do evento e a cláusula `ON CONFLICT(event_id) DO NOTHING`.
- **Replay com Evidência Divergente (HTTP 409):** Caso o cliente tente re-enviar uma tentativa já registrada sob o mesmo `attemptId`, mas alterando campos de evidência (ex: declaração de ajuda, causa de erro, opções marcadas), o backend rejeita com `409 Conflict`. Replays idempotentes legítimos (payloads equivalentes) retornam confirmação segura com os campos canônicos originalmente computados, garantindo a integridade dos dados para o motor analítico.
