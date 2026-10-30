# Matriz de Inventário Pedagógico Confiável

> **Status:** Arquitetura Técnica Canônica — Frente B  
> **Data:** 30/10/2026  
> **Referência:** `TASK-2026-10-30-03` / PR #60  

---

## 1. Contexto e Motivação

O orquestrador R opera em modo shadow para propor decisões pedagógicas contextuais sem interferir na operação do estudante. Para que as decisões sejam fundamentadas em evidências confiáveis e não em artefatos espúrios ou dados inventados, foi formalizado o inventário pedagógico auditado.

---

## 2. Separação Epistêmica em Cinco Estados

Qualquer recurso pedagógico (questão, item de memória, material didático, tópico de edital) é classificado segundo cinco estados mutuamente exclusivos:

1. **`EXISTENTE`**: Registro presente nas tabelas relacionais do SQLite (`questions`, `study_materials`, `support_materials`, etc.), porém com validação pendente.
2. **`CONFIRMADO`**: Vínculo e integridade chancelados por revisão humana ou teste determinístico comprovado (`confirmado_humano = 1`, classificação `CONFIRMED` com revisor, arquivo físico existente, páginas verificadas).
3. **`PROPOSTO`**: Vínculo sugerido por rotina algorítmica ou heurística sem supervisão humana (`autoLinkMaterialToTopics`, classificação `SUGGESTED`, fatiamento matemático de páginas).
4. **`NAO_VERIFICADO`**: Recurso com dependências não comprovadas (pré-requisitos canônicos sem registro de domínio, velocidade de leitura estimada sem calibração).
5. **`INDISPONIVEL`**: Recurso inacessível ou inválido para execução imediata (arquivo físico inexistente no caminho informado, questão retida em quarentena diagnóstica, gabarito anulado).

---

## 3. Matriz Consolidada de Tipos de Atividade

| Tipo de Atividade | Estado Atual | Regra Canônica de Admissão | Rejeição Típica |
|---|---|---|---|
| `DIAGNOSE_CONCEPT` | **CONFIRMADO** | Questão em `study_questions`, gabarito definitivo, enunciado e opções válidos, classificação `CONFIRMED` com revisor, tópico confirmado, mídias de apoio locais existentes. | `GABARITO_NOT_DEFINITIVE`, `SUPPORT_MATERIAL_MEDIA_MISSING`, `CLASSIFICATION_NOT_CONFIRMED` |
| `REVIEW_ITEM` | **CONFIRMADO** | Item em `learning_memory_state` com modelo `FSRS-6.0-default-core-no-fuzz`, `due_at <= observedAt`, `last_reviewed_at <= cutoff`, evento `ANSWER_SUBMITTED` correspondente. | `MEMORY_NOT_DUE`, `ABSENT_MEMORY_LINEAGE`, `MODEL_VERSION_INCOMPATIBLE` |
| `LEARN_NEW` | **CONFIRMADO** *(Auditado)* | Material em `study_materials`, arquivo físico verificado no disco local, páginas válidas (`inicio > 0`, `fim >= inicio`), tópico confirmado, pré-requisitos sem dependências pendentes. | `PHYSICAL_FILE_MISSING`, `PAGE_RANGE_UNVERIFIED`, `PREREQUISITES_NOT_ESTABLISHED` |
| `DEEPEN_APPLICATION` | **INDISPONÍVEL** | Exige instrumento operacional independente para medição de novidade, independência e transferência. | `APPLICATION_INSTRUMENT_UNAVAILABLE` |
| `SUPPORT_READING` | **CONFIRMADO** | Material auxiliar da questão (texto/figura) em `support_materials`. | `SUPPORT_MATERIAL_MEDIA_MISSING` |
| `SIMULADO_EXAM` | **EXISTENTE** | Bloco de prova extenso; incompatível com micro-timebox do orquestrador. | `DURATION_UNVERIFIED_HEURISTIC` |

---

## 4. Auditoria Determinística e Não Interferência

O serviço `LearningShadowSnapshotService` foi ampliado com o método `auditInventory(...)`, que executa auditoria exaustiva do inventário sob `@Transactional(readOnly=true)`.

- **Zero mutação**: SHA-256 do arquivo SQLite permanece estritamente idêntico antes e depois da auditoria.
- **Isolamento**: Nenhuma política de aplicação ou agendamento é acionada (`can_apply = false`, `can_schedule = false`).
- **Compatibilidade do Shadow**: O método `capture(...)` mantém o payload canônico para o adaptador R (`core-learning-shadow-v1`), com a salvaguarda de rejeitar questões com materiais de apoio com arquivos físicos faltantes.

---

## 5. Interface com Frente C (Motor R)

Para a inclusão de candidatos `LEARN_NEW` no payload ativo do R, a interface de `core_shadow_adapter.R` requer atualização coordenada entre Frente B e Frente C nos pontos:
1. `core_shadow_adapter.R:29`: inclusão de `LEARN_NEW` no vetor de tipos permitidos.
2. `core_shadow_adapter.R:44`: registro de autoridade `CURRICULUM_INVENTORY` para candidatos `LEARN_NEW`.
