# Revisão semântica e limites das conclusões

Base histórica: main@789f9053f3e90a366a9f09542a0f7331b9d8348b. Ancestralidade confirma alcance no histórico; não comprova sozinha retenção de comportamento. Arquivos, contratos, patches e testes foram usados adicionalmente. Não se afirma que todas as linhas antigas devam permanecer: melhorias posteriores e remoções deliberadas são preservadas.

## Backend, SQLite, frontend e ingestão

`git diff origin/fix/backend-suite-recovery-rebased 789f905 -- backend .github/workflows/backend-full-suite.yml` vazio. Todos os 26 caminhos recuperados da suíte antiga também foram comparados, sem divergência de conteúdo. Seis commits retornam `-` em `git cherry`. Cinco pares de patches de implementação/testes têm IDs estáveis idênticos, registrados integralmente em [PATCH_EQUIVALENCE.json](PATCH_EQUIVALENCE.json); documentação final é o sexto commit equivalente. Assim, não reaplicar #61/#66: #65 já recuperou a intenção e os testes.

Branches learning-backend, backend-error-taxonomy, backend-pedagogical-reasons e study-session-integrity têm merges intermediários exclusivos, mas suas implementações foram incorporadas. Os commits de implementação dos pais, contratos e testes foram examinados; não basta contar esses commits de merge. Demais branches de backend/frontend/ingestão têm HEADs ancestrais e nenhum arquivo desses módulos desaparecido.

Contratos inspecionados:

- `backend/src/main/java/com/fiscalstudy/backend/infrastructure/config/SqlitePersistenceConfiguration.java`: migration ligada a DataSource/DatabasePaths.
- `backend/src/main/java/com/fiscalstudy/backend/application/AttemptSubmissionService.java`: EventStoreRepository e LearningEvidenceService; captura e persistência não foram substituídas por uma implementação antiga.
- `LearningShadowSnapshotService.java` e `LearningShadowService.java` no mesmo diretório: snapshot do Event Store, versão canônica de modelo, capabilities negadas e autoridade observacional.
- `AnalyticsProjectionService.java`: limite de rowid e manifesto do mesmo snapshot; restrição de diretórios da recuperação #65 preservada.
- `frontend/src/components/QuestionViewer.tsx`: submissão/preparação prospectiva e gate de captura; APIs registradas no DAG.
- Ingestão: StagingDatabase/InventoryManager/BatchProcessor e testes de integridade/resiliência; preservação de curadoria e rejeição de extração parcial/path traversal.

Esses achados não equivalem a homologação visual, teste de todos os PDFs/OCR reais, aprovação do piloto pessoal ou demonstração de aprendizagem.

## Motor R e laboratório

25 branches selecionadas por conteúdo científico/analítico: 21 ancestrais e quatro divergentes equivalentes (memória, comparação-base, runtime e integração R). Nenhum path científico presente nessas árvores está ausente da main.

Memória #28→#31: blobs idênticos nos dois estados comparados:

| Caminho | Prefixo do blob Git |
|---|---|
| analytics-engine/lab/memory_adapter.R | 1b98ac37 |
| analytics-engine/lab/memory_benchmark.py | d83d73ac |
| analytics-engine/lab/memory_simulator.py | 1e1caaa7 |
| analytics-engine/lab/requirements-memory-lab.txt | 7d624df4 |
| analytics-engine/lab/test_memory_lab.py | 46b4e879 |
| analytics-engine/tests/fixtures/learner_lab/memory_reference_result.json | 4fe491c7 |

`MEMORY_PROTOCOL.md` conserva as 85 linhas históricas com 78 linhas posteriores. Recuperação em 3b5942bc5b7c3479cb7a438cd91bd379e8c42ebd, ancestral da main. Workflows evoluíram; não restaurar a composição antiga indiscriminadamente.

#67→#68: nove paths de fontes/testes R foram comparados com diff vazio: descriptive_analysis, export_results, learning_profile, validation, visualization, run_analytics e testes descriptive/export/pipeline_evidence. Manifesto e síntese histórica estão em `analytics-engine/docs/INTEGRATION_SOURCES.json` e `R_LAB_INTEGRATION_VALIDATION.md`, recuperados por 2cc9667/4adf56a. Um trigger de workflow exclusivo da branch antiga é obsoleto, não contribuição funcional pendente.

`analytics-engine/R/core_shadow_adapter.R` declara OBSERVATION_ONLY e capabilities falsas; adaptadores/manifests experimentais mantêm can_apply=false/can_schedule=false. A correção nova #79 altera apenas geração de fixtures UTF-8 e documentação; não promove modelo nem altera produção. Resultados sintéticos/replay não estabelecem benefício pedagógico humano.

## Documentação, governança, dependências rejeitadas

Revisão de paths ausentes em docs/references/.agents/.github/knowledge e arquivos de instrução para todas as branches e 70 HEADs históricos encontrou somente `.github/dependabot.yml`, removido deliberadamente por f28cdcfdd6f9c7e50a7b61e0d9f990a9dd631e6d. Os dois documentos de #12 conservam sua seção original e recebem adições posteriores; merge exclusivo em docs/execution-and-validation não justifica recuperação.

#70/#71 têm HEADs ancestrais e zero commits posteriores exclusivos. O detector semanal foi reutilizado e corrigido em #74; a duplicação de contexto foi corrigida em #76. PRs #51/#52/#55/#56/#57 foram fechadas pelo mantenedor sem merge; comentários não documentam motivo técnico específico. Classificação REJECTED é decisão de não reintroduzir, não alegação de incompatibilidade demonstrada.

## Reproduzir a evidência

Em cópia isolada, buscar origin e refs de PRs, sem modificar a main:

```text
git fetch origin --prune
git fetch origin refs/pull/*/head:refs/audit/pull/*
git merge-base MAIN_SHA BRANCH_SHA
git log --left-right --cherry-pick --oneline MAIN_SHA...BRANCH_SHA
git cherry MAIN_SHA BRANCH_SHA
git diff --name-status MERGE_BASE..BRANCH_SHA
git ls-tree -r BRANCH_SHA
git show --format= COMMIT_SHA | git patch-id --stable
```

API: `branches?per_page=100&page=N`, `pulls?state=all&per_page=100&page=N`, arquivos de cada PR paginados e check-runs de cada HEAD. Parar só em página incompleta/vazia; registrar limites e SHA capturado. Git não conhece a branch de criação nem o instante de atualização da ref remota. Inventário por arquivo/PR permite revisar as conclusões sem confiar em nomes ou mensagens de merge.
