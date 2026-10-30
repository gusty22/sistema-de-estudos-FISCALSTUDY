# Dependências de integração

Snapshot histórico789f905; main atual confirmada e877e46 após merge humano da #76. Nenhuma recuperação histórica funcional permanece sem equivalente demonstrado. DAG atual de PRs independentes:

```mermaid
graph TD
 M["main e877e46"] --> A["PR74: auditor por SHAs"]
 M --> R["PR79: portabilidade de fixtures R"]
 M --> D["PR78: inventário e evidências"]
 R -. "limitação de validação local" .-> X["Issue80: ACL e crash R"]
```

Não há dependência de imports/commits entre as três PRs; todas usam main como base. A seta pontilhada é bloqueio de validação, não pré-requisito de código. #76 já foi mesclada pelo mantenedor e eliminou o bloqueio anterior de CI; #74 foi reconciliada e revalidada. Ordem recomendada de revisão: governança#74, fixtures#79, inventário#78 (que registra os estados no instante de captura). Não há ciclo de implementação identificado. Depois de qualquer merge humano, atualizar referências, reconciliar sem force e reexecutar checks afetados.

## Cadeia histórica já integrada

Persistência SQLite: SqlitePersistenceConfiguration.schemaMigration(DataSource, DatabasePaths) → SchemaMigration → EventStoreRepository append-only. AttemptSubmissionService importa o repositório e LearningEvidenceService (FSRS canônico). LearningShadowSnapshotService consome EventStoreRepository e LearningEvidenceService.MODEL_VERSION; LearningShadowService consome snapshot/AnalyticsPaths e nega capabilities recursivamente. AnalyticsProjectionService.exportPackageToDirectory captura getMaxRowid e gera manifesto do mesmo snapshot. Essa cadeia exige validação conjunta, já não há PR predecessora pendente.

Frontend QuestionViewer consome AttemptSubmission, ProspectivePreparation e prospectiveCaptureEnabled; preparação usa POST /api/v1/questions/{id}/predictions com contractVersion prospective-question-v1, e estado GET /api/v1/learning-lab/prospective-status. Ingestão: StagingDatabase → InventoryManager → BatchProcessor; publicação após curadoria. São dependências inspecionadas em imports/APIs/testes, não inferidas dos nomes das branches.

Ordem histórica especial: #59→#61 (base intermediária)→#65(main); #27/#28→#31(recuperação memória); #67→#68(substituição documental). #70 governança e #71 definições já integradas; não duplicar.

## Limites científicos

Java→exportação/manifesto→R é observacional. Experimentos não autorizam agendamento: can_apply=false/can_schedule=false. Fixtures não evidenciam aprendizagem pessoal. Não há proposta de promover modelo experimental nem modificar FSRS.
