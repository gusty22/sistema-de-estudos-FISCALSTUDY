# Plano de separação e publicação por área — aguarda aprovação

## Estado verificado

Cópia: <implementation-checkout>. Branch codex/fiscalstudy-integration-20261023. HEAD/main/origin-main locais: c26ee20352fc1b6ace0c58be4f24a41a1092fbf0. Nenhum commit novo nesta branch; índice vazio.70 arquivos modificados,46 novos,0 excluídos antes dos dois documentos deste planejamento. Original core-app no mesmo HEAD com status rastreado limpo; os70 arquivos modificados diferem do original. Arquivos novos do original não foram inventariados, portanto não afirmar ausência de trabalho original não rastreado. Estado remoto atual ainda não consultado;origin/main é referência local.

## Estratégia proposta

Aprovação necessária antes de criar branches/commits/push, conforme pedido do usuário. Agentes abaixo são propostos,não iniciados. Cada agente atuará somente em uma área, em checkout isolado novo a partir da base aprovada. Não trocar a branch nem fazer stash/reset/clean na cópia que contém as alterações. Antes da separação, criar snapshot de recuperação fora das branches,com patch de arquivos rastreados,cópias dos novos arquivos,hashes e referências Git;verificar integridade. Bancos/snapshots/references não serão publicados.

Cada branch conterá somente seu delta;dependências não serão copiadas para branches consumidoras. Validar branches dependentes em integração temporária com pré-requisitos, além das verificações independentes possíveis. PRs dependentes permanecerão draft até pré-requisitos integrarem main com autorização. Se preferir PRs que compilem isoladamente imediatamente, a alternativa é uma branch backend maior;não simular independência inexistente.

## Áreas e responsáveis propostos

| Área | Branch proposta | Agente proposto | Objetivo | Dependências |
|---|---|---|---|---|
| Dados e bootstrap | feature/database-contracts | agente-dados | Paths SQLite,baseline,migrações,backup/restore,configuração isolada e testes próprios | base aprovada |
| Analytics e subprocessos | feature/analytics-runtime | agente-analytics | Exportação R,execução e resolução explícita de bibliotecas | base;backend para homologação Java/R |
| Backend de aprendizagem | feature/learning-backend | agente-backend | Tentativas,curadoria,FSRS,rotinas,segurança e adaptadores Java/R | dados;analytics R para homologação |
| Ingestão documental | feature/document-ingestion | agente-ingestao | Inventário seguro,proteção contra reprocessamento e testes documentais | staging-schema de dados |
| Interface e preferências | feature/study-frontend | agente-frontend | Hooks,cliente idempotente,curadoria,preferências,Anki e token administrativo | contratos backend para homologação |
| Documentação e execução | docs/execution-and-validation | agente-documentacao | Arquitetura,decisões,relatórios,scripts portáveis e política de artefatos | resultados das demais áreas |

Não há alterações Docker/CI/CD identificadas;nenhuma branch DevOps artificial. Testes pertencem à mesma área da mudança,sem branch de qualidade que deixe correções desprotegidas.

## Pontos compartilhados e ordem

application.yml,application-isolated.yml,config teste e schema.sql têm dono único dados. Parâmetros de segurança/Anki/R devem ser revistos em conjunto sem edição concorrente. SystemSettingsService mistura recuperação/preferências/auditoria: permanece backend;SqliteRecovery é dados. QuestionBankService/StrategicSimuladoService misturam SQL/taxonomia: permanecem backend,consumindo schema da área dados. RevisionCalendarService inclui fuso e regras pedagógicas: pertence backend. Frontend tests e package.json ficam juntos.

Decisão após inspeção de imports/construtores: todos os adaptadores Java de analytics (AnalyticsBridgeService,AnalyticsProjectionService,DigitalTwinService,AnalyticsPaths,BoundedProcess e AnalyticsExportIntegrationTest) ficam na área backend. Isso elimina a dependência circular criada por separação superficial por nome. A área analytics contém somente os três arquivos R alterados. Ordem: dados → analytics R → backend → ingestão/interface → documentação. Backend é um conjunto coeso maior porque seus serviços já estão acoplados;divisões adicionais exigiriam mudanças estruturais fora do objetivo de organizar publicação.

## Critérios de conclusão e publicação

- Todos os caminhos do inventário atribuídos exatamente uma vez;novos arquivos de planejamento também atribuídos.
- Comparar união dos deltas finais com snapshot;diferenças apenas justificadas documentalmente. Git diff --check,scan de segredos e revisão de caminhos pessoais antes de publicação pública.
- Dados/backend: test-compile e testes de schema novo,cópia existente,staging,backup,tentativas,FSRS,rotinas e controladores. Suíte integrada completa com Anki rede desligada.
- Analytics: R tests/test_runner.R + testes Java de exportação,origem,timeouts;libs explícitas,resultados por execução. Nenhuma sincronização real.
- Ingestão: unittest discover tests em diretórios descartáveis;fixtures protegidas por direitos autorais não subir.
- Frontend: tsc-b,Vite build,node tests,lint;avisos e limite visual explícitos.
- Docs: comandos e contagens correspondem a logs reais;remover/sanitizar detalhes pessoais de documentação pública sem perder evidências locais.
- Testes anteriores:256 Java na última suíte completa;13 direcionados após último ajuste de calendário;11 Python;7 frontend;325 R;lint118avisos/0erros. São evidências anteriores,não testes das futuras branches.
- Após aprovação e validação: commits pequenos sem amend/rebase do histórico existente,push normal por branch,verificar SHA remoto contra local e abrir PRs draft com dependências/testes/limites. Não force-push,não merge main.

## Elementos preservados fora dos PRs

work-persistence.cjs: roteiro temporário local;preservar como evidência até inspeção,sem publicar automaticamente. db/,backups,recovery,outputs,logs,node_modules,venv,junções references/graphify-out ficam fora da publicação;nenhuma exclusão autorizada. Não afirmar que o Git sozinho protege arquivos ignorados.

## Inventário por arquivo

### analytics

- modified — analytics-engine/R/export_results.R
- modified — analytics-engine/run_analytics.R
- modified — analytics-engine/tests/test_runner.R

### backend

- modified — backend/src/main/java/com/fiscalstudy/backend/application/AnalyticsBridgeService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/AnalyticsProjectionService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/AnkiIntegrationService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/AttemptSubmissionService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/DigitalTwinService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/PerformanceIntelligenceService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/QuestionBankService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/QuestionHistoryService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/RevisionCalendarService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/RobinHoodCycleService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StagingDatabaseService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StrategicSimuladoService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StrategicSummaryService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StudentKnowledgeStateService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StudentRoutineService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StudyAnomalyDetectionService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StudyMaterialService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/StudySessionService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/SystemSettingsService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/application/cognitive/UnifiedCognitiveArchitectureService.java
- modified — backend/src/main/java/com/fiscalstudy/backend/domain/AttemptResult.java
- modified — backend/src/main/java/com/fiscalstudy/backend/domain/EventStoreRepository.java
- modified — backend/src/main/java/com/fiscalstudy/backend/domain/cognitive/FsrsEngine.java
- modified — backend/src/main/java/com/fiscalstudy/backend/domain/cognitive/FsrsParameters.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/AnkiController.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/QuestionController.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/SessionController.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/WebConfig.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/out/persistence/EventStoreRepositoryImpl.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/out/persistence/QuestionRepositoryImpl.java
- modified — backend/src/main/java/com/fiscalstudy/backend/infrastructure/out/persistence/StudentRoutineRepositoryImpl.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/AnkiIntegrationServiceTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/QuestionHistoryServiceTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/RevisionCalendarServiceTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/StagingDatabaseServiceTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/StrategicSummaryHybridPipelineTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/StudentKnowledgeStateServiceTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/StudyAnomalyDetectionServiceTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/application/cognitive/UnifiedCognitiveArchitectureTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/ActiveTimeAndConfidenceIntegrationTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/AnalyticsControllerTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/AnalyticsExportIntegrationTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/IngestionControllerTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/QuestionControllerTest.java
- modified — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/RoutineAndStudyIntegrationTest.java
- new — backend/src/main/java/com/fiscalstudy/backend/application/AttemptAnnotationView.java
- new — backend/src/main/java/com/fiscalstudy/backend/application/LearningEventEligibility.java
- new — backend/src/main/java/com/fiscalstudy/backend/application/LearningEvidenceService.java
- new — backend/src/main/java/com/fiscalstudy/backend/application/QuestionClassificationService.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/AnalyticsPaths.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/LocalAccessFilter.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/QuestionClassificationController.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/process/BoundedProcess.java
- new — backend/src/test/java/com/fiscalstudy/backend/application/AnkiPrivacyPolicyTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/application/AttemptIdentityRegressionTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/application/LearningEvidenceServiceTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/application/QuestionClassificationServiceTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/application/RoutineBudgetRegressionTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/domain/cognitive/FsrsReferenceConformanceTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/infrastructure/in/web/LocalAccessFilterTest.java
- new — backend/src/test/resources/fsrs/REFERENCE.md

### database

- modified — backend/src/main/resources/application.yml
- modified — backend/src/main/resources/schema.sql
- modified — backend/src/test/resources/application.yml
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/DatabasePaths.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/SchemaMigration.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/SqlitePersistenceConfiguration.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/SqliteRecovery.java
- new — backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/StagingSchemaMigration.java
- new — backend/src/main/resources/application-isolated.yml
- new — backend/src/main/resources/staging-schema.sql
- new — backend/src/test/java/com/fiscalstudy/backend/infrastructure/config/PersistenceContractTest.java
- new — backend/src/test/java/com/fiscalstudy/backend/infrastructure/config/SchemaBootstrapIntegrationTest.java

### frontend

- modified — frontend/package.json
- modified — frontend/src/App.tsx
- modified — frontend/src/components/QuestionViewer.tsx
- modified — frontend/src/components/anki/CuradoriaAnki.tsx
- modified — frontend/src/components/configuracoes/ConfiguracoesAdminView.tsx
- modified — frontend/src/components/edital/MotorParetoEditalModal.tsx
- modified — frontend/src/components/ingestion/AssistenteImportacaoWizard.tsx
- modified — frontend/src/components/ingestion/AuditCockpit.tsx
- modified — frontend/src/components/ingestion/ImportStudio.tsx
- modified — frontend/src/components/ingestion/QualidadeBancoQuestoes.tsx
- modified — frontend/src/components/onboarding/AssistenteObjetivoWizard.tsx
- modified — frontend/src/components/questoes/BancoQuestoes.tsx
- modified — frontend/src/components/questoes/ResolucaoQuestaoModal.tsx
- modified — frontend/src/components/timer/StudyTimerFab.tsx
- modified — frontend/src/index.css
- new — frontend/src/components/questoes/QuestionClassificationPanel.tsx
- new — frontend/src/utils/attemptSubmission.ts
- new — frontend/src/utils/ingestionAccess.ts
- new — frontend/src/utils/studyPreferences.ts
- new — frontend/tests/learning-contracts.test.mjs

### ingestion

- modified — ingestion/src/pipeline/batch_processor.py
- modified — ingestion/src/pipeline/inventory_manager.py
- modified — tests/test_golden_set_q15.py
- modified — tests/test_pipeline_resilience.py
- new — tests/test_inventory_integrity.py

### docs-tooling

- new — docs/ARCHITECTURE.md
- new — docs/ARTIFACT_POLICY.md
- new — docs/CONTENT_CLASSIFICATION.md
- new — docs/DECISIONS.md
- new — docs/IMPLEMENTATION_PLAN.md
- new — docs/IMPLEMENTATION_STATE.json
- new — docs/REFERENCE_REUSE_POLICY.md
- new — docs/VALIDATION_REPORT.md
- new — docs/agent-reports/attempts.md
- new — docs/audit/AUDIT_2026-10-23_PUBLIC.md
- new — docs/audit/SOURCE_BASELINE_PUBLIC.json
- new — scripts/start-isolated.ps1
- new — scripts/validate-backend.cjs
- new — scripts/validate.ps1

### local-evidence

- new — work-persistence.cjs

docs/GIT_AREA_PLAN.md e docs/GIT_AREA_INVENTORY.json também pertencem à documentação.

## Atualização de publicação após aprovação

Divisão aprovada com ressalvas; fetch confirmou main remota em c26ee20352fc1b6ace0c58be4f24a41a1092fbf0. Snapshot118arquivos preservado localmente. PersistenceContractTest e SchemaBootstrapIntegrationTest transferidos para backend por dependerem de serviços dessa área;dados recebe teste próprio DatabaseFoundationTest. Auditoria e manifesto originais permanecem local-only,com cópias públicas sanitizadas de nomes PUBLIC e SHA-256 de origem. Os hashes do inventário são os da fonte antes da sanitização/publicação;comparar com o relatório externo da publicação para transformações justificadas. Resultados de validação das novas branches serão registrados no relatório de publicação do orquestrador.
