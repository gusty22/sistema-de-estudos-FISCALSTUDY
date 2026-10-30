# Contrato de Integração — Inventário Pedagógico Confiável (Frente B)

> **Status:** Arquitetura e Contrato de Integração (Modo Shadow v1.1)  
> **Data:** 30/10/2026  
> **Módulo:** Backend (Java / Spring Boot / SQLite) → Analytics Engine (R Orchestrator)  
> **Referência:** `TASK-2026-10-30-03` / Branch `feature/pedagogical-inventory-b`  

---

## 1. Princípios Epistêmicos do Inventário

O inventário pedagógico é o produtor de fatos que alimenta o orquestrador contextual de decisões. Para evitar inferências espúrias, alucinações de modelos e suposições não comprovadas, toda atividade proposta obedece aos seguintes princípios:

1. **Separação Epistêmica em 5 Estados**:
   - **Existente:** O registro físico ou relacional existe nas tabelas operacionais (`study_materials`, `questions`, etc.), mas suas pré-condições não foram todas confirmadas.
   - **Confirmado:** O recurso, seu vínculo curricular e sua integridade foram expressamente verificados por humano ou protocolo determinístico auditado (`confirmado_humano = 1` no edital; classificação `CONFIRMED` com revisor humano; arquivo local existente em disco; páginas válidas).
   - **Proposto:** Associação gerada por algoritmo ou heurística sem validação humana (ex: vínculos sugeridos por semelhança textual em `autoLinkMaterialToTopics`; classificações `SUGGESTED`; fatiamento proporcional arbitrário).
   - **Não verificado:** Dependências ausentes de validação empírica (ex: pré-requisitos conceituais na DAG sem registro de domínio pelo estudante; velocidade de leitura não calibrada).
   - **Indisponível:** Recurso inacessível ou inválido para execução (ex: arquivo físico ausente no caminho configurado; questão em quarentena diagnóstica; gabarito anulado).

2. **Proibição de Falsas Equivalências e Prioridades**:
   - Frequência bruta de questões de banca sem denominador amostral **não** gera prioridade estatística.
   - Ausência de anotação de erro **não** comprova compreensão conceitual.
   - Acerto em item de múltipla escolha **não** demonstra retenção duradoura ou transferência.
   - Tempo de leitura **não** é inventado; durações adotam timebox explícito configurado pelo host (`HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION`).

---

## 2. Matriz dos Tipos de Atividade Pedagógica

A tabela a seguir consolida o estado atual dos tipos de atividade no FiscalStudy:

| Tipo de Atividade | Escopo | Prioridade R | Estado Epistêmico Atual | Contrato Exigido para Admissão | Status no Shadow Atual |
|---|---|---|---|---|---|
| `DIAGNOSE_CONCEPT` | Questão (`qid`) | `DIAGNOSTIC_GAP` | **CONFIRMADO** | Tópico confirmado no edital; questão validada; gabarito definitivo; vínculo `CONFIRMED` com revisor humano; materiais de apoio (gráficos/textos) íntegros e presentes em disco. | **Admitido e Operacional** |
| `REVIEW_ITEM` | Questão (`qid`) | `MAINTENANCE_DUE` | **CONFIRMADO** | Item em `learning_memory_state` com modelo canônico `FSRS-6.0-default-core-no-fuzz`; `last_reviewed_at <= cutoff`; `due_at <= observedAt`; evento `ANSWER_SUBMITTED` correspondente no histórico. | **Admitido e Operacional** |
| `LEARN_NEW` | Tópico / Material (`topico_id`) | `NEW_CONTENT` | **CONFIRMADO** *(Auditado e Contratado)* | Tópico confirmado no edital; vínculo com material didático; arquivo físico verificado em disco; páginas `pagina_inicio > 0`, `fim >= inicio` e `<= total_paginas`; pré-requisitos canônicos satisfeitos ou sem dependências. | **Auditado / Interface Documentada** |
| `DEEPEN_APPLICATION` | Questão / Instrumento | `DEEPEN` | **INDISPONÍVEL** | Instrumento operacional independente para aferição de transferência e aplicação com isolamento de novidade e assistência. | **Rejeitado por ausência de instrumento** |
| `SUPPORT_READING` | Material de Apoio (`mat_id`) | N/A (Sub-item) | **CONFIRMADO** | Texto-base, tabela ou figura associada à questão em `question_support_materials`, com arquivo ou texto íntegro. | **Componente de Questão** |
| `SIMULADO_EXAM` | Caderno / Concurso | N/A (Macro) | **EXISTENTE** | Bloco de prova cronometrado para aferição diagnóstica transversal; não divisível em micro-timebox do orquestrador diário. | **Execução em lote isolada** |

---

## 3. Taxonomia Explícita de Rejeição (`PedagogicalRejectionReason`)

Quando um candidato em potencial é rejeitado durante a auditoria de inventário, o sistema emite um código estruturado e imutável:

### Escopo e Edital
- `SYLLABUS_SCOPE_MISMATCH`: O edital ou concurso não corresponde ao contexto solicitado pelo host.
- `TOPIC_NOT_CONFIRMED_HUMAN`: O tópico do edital possui `confirmado_humano = false`.
- `CONTEST_DISCIPLINE_MISMATCH`: O material didático pertence a disciplina ou concurso conflitante.

### Integridade de Questões
- `QUESTION_QUARANTINED_OR_INVALID`: Questão retida em `diagnostic_blocked_questions` ou com status != `VALIDADA`.
- `GABARITO_NOT_DEFINITIVE`: Gabarito nulo, pendente ou anulado (`ANULADA`).
- `QUESTION_STRUCTURALLY_INVALID`: Enunciado em branco ou menos de duas alternativas utilizáveis.
- `CLASSIFICATION_NOT_CONFIRMED`: Classificação questão-tópico com status `SUGGESTED` ou `REJECTED`.
- `CLASSIFICATION_AFTER_OBSERVED_AT`: Classificação registrada após o instante de observação do snapshot.

### Materiais de Apoio da Questão (`support_materials`)
- `SUPPORT_MATERIAL_MEDIA_MISSING`: O material de apoio referencia `media_path`, mas o arquivo físico inexiste no disco local.
- `SUPPORT_MATERIAL_TEXT_MISSING`: O material de apoio não contém nem texto utilizável nem mídia válida.

### Materiais Didáticos (`study_materials` e `topic_material_links`)
- `MATERIAL_RECORD_MISSING`: Vínculo aponta para `material_id` inexistente na tabela de materiais.
- `NO_MATERIAL_LOCATION`: O material não possui caminho físico ou URL registrado.
- `PHYSICAL_FILE_MISSING`: O caminho de arquivo (`url_ou_caminho`) não foi encontrado no sistema de arquivos local.
- `PAGE_RANGE_UNVERIFIED`: Intervalo de páginas nulo, invertido (`inicio > fim`) ou não positivo (`inicio <= 0`).
- `PAGES_EXCEED_TOTAL`: A página final excede o total de páginas verificado do material.

### Pré-requisitos Canônicos
- `PREREQUISITES_NOT_ESTABLISHED`: Existem conceitos pré-requisitos essenciais na DAG (`canonical_concept_prerequisites`), mas não há registro empírico de domínio pelo estudante.
- `PREREQUISITE_DEPENDENCY_CYCLE`: Dependência cíclica identificada na cadeia conceitual.

### Memória FSRS
- `MODEL_VERSION_INCOMPATIBLE`: Versão do modelo de memória difere de `FSRS-6.0-default-core-no-fuzz`.
- `MEMORY_NOT_DUE`: Data de vencimento do item (`due_at`) é futura em relação ao instante observado.
- `MEMORY_AFTER_CUTOFF`: Data de última revisão (`last_reviewed_at`) é posterior ao cutoff de evidências.
- `ABSENT_MEMORY_LINEAGE`: Registro em `learning_memory_state` sem histórico legítimo de evento `ANSWER_SUBMITTED`.

### Instrumentação e Evidência
- `APPLICATION_INSTRUMENT_UNAVAILABLE`: Ausência de instrumento operacional de teste de transferência e novidade.
- `DURATION_UNVERIFIED_HEURISTIC`: Tentativa de estimar duração sem calibração ou timebox explícito do host.
- `FREQUENCY_WITHOUT_DENOMINATOR`: Frequência de questões sem base amostral de banca.

---

## 4. Interface Necessária para Coordenação entre Frentes (R Adapter)

Atualmente, `core_shadow_adapter.R` (integrado na PR #60) restringe os tipos de atividade admitidos em seu gate de entrada:

```r
# analytics-engine/R/core_shadow_adapter.R:29
if (nrow(candidates) && (anyDuplicated(candidates$candidate_id) || any(candidates$contest_id != request$context$contest_id) ||
    any(!candidates$activity_type %in% c('DIAGNOSE_CONCEPT','REVIEW_ITEM')) ||
    !'inventory_observed_at' %in% names(candidates) || any(candidates$inventory_observed_at != request$cutoff))) stop('INVALID_HOST_INVENTORY')
```

Além disso, o registro de autoridade do host é gerado apenas para `DIAGNOSE_CONCEPT`:

```r
# analytics-engine/R/core_shadow_adapter.R:44-49
for (row in request$candidates) if (identical(row$activity_type,'DIAGNOSE_CONCEPT')) {
  registry[[length(registry)+1L]] <- c(row[c('inventory_id','inventory_version','curriculum_source_id','scope_id','contest_id',
    'activity_type','material_available','in_syllabus','prerequisites_status','estimated_minutes','risk')],
    list(target='CURRICULUM_INVENTORY',validation_status='CONFIGURED_POLICY',can_propose=TRUE,
      valid_from=request$cutoff,valid_until=request$cutoff))
}
```

O orquestrador central em R (`R/learning_orchestrator.R` e `R/pedagogical_decision.R`) já possui suporte completo para `LEARN_NEW` sob `.pd_inventory_authority`.

### Solicitação de Coordenação (Frente B → Frente C / Motor R):
Para que candidatos verificados de `LEARN_NEW` (estudo de materiais confirmados) sejam ingeridos no snapshot sem erro `INVALID_HOST_INVENTORY`, a interface do adaptador `core_shadow_adapter.R` deverá ser estendida para:
1. Permitir `LEARN_NEW` em `core_shadow_adapter.R:29`:
   ```r
   any(!candidates$activity_type %in% c('DIAGNOSE_CONCEPT','REVIEW_ITEM','LEARN_NEW'))
   ```
2. Registrar autoridade curricular para `LEARN_NEW` em `core_shadow_adapter.R:44`:
   ```r
   for (row in request$candidates) if (row$activity_type %in% c('DIAGNOSE_CONCEPT','LEARN_NEW')) {
       # ...
   }
   ```

Essa coordenação é mantida explícita para preservar estritamente os limites de responsabilidade de cada frente, sem adulteração não acordada dos arquivos do motor R.

---

## 5. Garantia de Não Interferência Operacional

1. **Leitura Pura (SELECTs only)**:
   - `LearningShadowSnapshotService.capture` e `auditInventory` são anotados com `@Transactional(readOnly=true)`.
   - Nenhuma linha é inserida, alterada ou removida em `questions`, `editais`, `study_materials` ou `event_store`.
   - Teste de integridade em `PedagogicalInventoryAuditTest.auditInventoryProducesFullMatrixAndConfirmedCandidates` comprova byte a byte que o SHA-256 do arquivo SQLite antes e após a execução permanece idêntico.

2. **Políticas Experimentais Inalteradas**:
   - `can_apply = false` e `can_schedule = false` em todas as instâncias.
   - O agendamento FSRS operacional do usuário permanece intocado.
