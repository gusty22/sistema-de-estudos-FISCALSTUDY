# Validação de implementação

## Linha de base preservada
Auditoria original em docs/audit/AUDIT_2026-10-23_PUBLIC.md. Baseline anterior: 15 testes de domínio Java aprovados; TypeScript/build aprovados; lint5 erros115avisos; R291 aprovados2falhas. Esses resultados não são validação das alterações desta execução.

## Recuperação
Snapshots criados via SQLite backup API em db/recovery/fiscalstudy.db e staging.db. Ambos quick_check=ok. Originais não modificados.

## Em andamento
Aguardar entregas de módulos e integração antes de relatar novos resultados. Nenhuma homologação visual executada nesta execução até o momento.

## Retomada sequencial — persistência

Comando: node scripts/validate-backend.cjs -Dtest=PersistenceContractTest,StagingDatabaseServiceTest test

Resultado real: BUILD SUCCESS, 11 testes, 0 falhas, 0 erros, 0 ignorados. PersistenceContractTest: 7; StagingDatabaseServiceTest: 4. Log: target-persistence-stage.log. Estes testes não homologam a aplicação inteira nem resolvem os órfãos históricos de staging.

## Etapa 2 — tentativas e histórico (em andamento)

Primeira rodada:16 testes,3 falhas e4 erros. Corrigida interpretação indevida de $ em JSONPath na substituição SQL (Matcher.quoteReplacement). Reexecução direcionada em target-attempts-stage-fixed.log. Testes legados de sessões ainda fornecem eventos sem origin e esperam métricas pessoais; precisam ser atualizados com cenários explícitos de elegibilidade, sem reclassificar histórico real. Etapa não concluída.

## Etapa 2 — validação concluída do escopo direcionado

Corrigidos JSONPath literal no helper LearningEventEligibility e seleção da sobrecarga sem parâmetros. Fixtures legadas de sessões declaram REAL_STUDY apenas no ambiente descartável, com Anki network-allowed=false. Novo teste garante que AUTOMATED_TEST e origem ausente não sintetizam sessões pessoais. Mock de histórico atualizado para a consulta pessoal real.

Comando: node scripts/validate-backend.cjs -Dtest=AttemptIdentityRegressionTest,QuestionHistoryServiceTest,ActiveTimeAndConfidenceIntegrationTest test
Resultado: BUILD SUCCESS;17 testes,0 falhas,0 erros,0 ignorados. Tentativas10;histórico3;sessões/analytics4. Log target-attempts-stage-complete.log. Não houve homologação visual nem reexecução global; os demais consumidores e achados mantêm suas pendências.

## Etapa 3 — revisões e planejamento adaptativo

Corrigido fallback de StudentKnowledgeStateService que retornava tópicos globais para concurso explicitamente solicitado sem tópicos. Corrigido payload do dashboard: removida equação exponencial antiga e afirmações sinápticas incompatíveis com desempenho observado; FSRS permanece autoridade por item, com incerteza explícita.

Comando: node scripts/validate-backend.cjs -Dtest=LearningEvidenceServiceTest,FsrsReferenceConformanceTest,FsrsEngineTest,RevisionCalendarServiceTest,RoutineBudgetRegressionTest,StudentKnowledgeStateServiceTest,MaestroAdaptiveInterleavingIntegrationTest test

Resultado real: BUILD SUCCESS;28 testes,0 falhas,0 erros,0 ignorados. Cobertura: núcleo FSRS6 com vetores independentes ts-fsrs5.4.2; sinal pedagógico esperado/inesperado sem diagnóstico causal; projeção idempotente e concorrente; proteção contra evento fora de ordem; rotinas/zero orçamento; isolamento concursos; intercalação integrada. Log target-adaptive-stage.log.

Limites: conformidade do núcleo não equivale ao scheduler FSRS completo; não houve calibração individual, ensaio de eficácia pedagógica ou homologação visual. Projeções fora de ordem exigem reconstrução ordenada, ainda não automatizada. Não considerar F09/F10/F18/F19/F20/F33 globalmente encerrados só por esta bateria.

## Etapa 4 — classificação e rastreabilidade

Implementado filtro topicId em GET /api/v1/question-classification/questions?unclassified=false&topicId=<id>. Seleção consulta apenas último vínculo CONFIRMED; sugestões/rejeições excluídas. Combinação contraditória unclassified=true+topicId retorna erro explícito. Novos timestamps de classificação usam Instant ISO8601; registros anteriores preservados.

Validação: node scripts/validate-backend.cjs -Dtest=QuestionClassificationServiceTest,StrategicSummaryHybridPipelineTest,QuestionBankServiceTest,StudentKnowledgeStateServiceTest test. BUILD SUCCESS:16 testes,0 falhas,0 erros,0 ignorados. Log target-content-stage.log. Casos: sugestão/confirmado/rejeitado, preservação dos itens, proveniência de resumos, exclusão de vínculos não confirmados do estado de conhecimento.

Limites: teste de serviço/API implementada não equivale a homologação visual; nenhuma classificação em massa foi executada e qualidade/cobertura reais continuam dependendo da curadoria humana. Não foi validado todo pipeline Python nesta etapa.

## Execução por áreas — interface, segurança e analytics

Interface: TypeScript build aprovado; Vite build aprovado;6 testes de contratos aprovados antes da integração token;lint0 erros/118 avisos. Chunk inicial575.04kB (gzip154.65kB), ainda acima500kB. Validação visual não realizada.

Segurança: WebConfig resolve DatabasePaths a partir do Environment sem exigir bean de persistência em slices MVC. IngestionControllerTest agora usa token explícito e inclui rejeição sem token.30 testes Java aprovados,0 ignorados (LocalAccessFilter,AnkiPrivacyPolicy,AnkiIntegrationService,ConcursoController,IngestionController). Logs target-security-area.log. Fluxo frontend ingestão recebe token em memória por helper restrito à API; revalidação frontend ainda pendente após essa alteração.

Analytics R: executado tests/test_runner.R com R4.5.1 e bibliotecas existentes explicitamente configuradas.325 verificações aprovadas,0 falhas. Log target-r-area.log. Não houve instalação de dependências ou sincronização AnkiWeb.

## Área de ingestão e revalidação da interface

BatchProcessor rejeita múltiplos trechos PROVA com mensagem explícita, evitando processar apenas o primeiro e ignorar os demais. O fluxo de curadoria deve escolher intervalos; suporte automático multi-caderno segue pendente. Fixture IBGP define explicitamente intervalo completo e metadados conhecidos; testes fecham conexões SQLite com closing, incluindo backup temporário.11 testes Python aprovados (inclui nova proteção de múltiplos trechos).

Interface após token de ingestão: TypeScript aprovado, Vite build aprovado,7 testes aprovados (inclui restrição do segredo ao endpoint local e remoção em memória). Log target-frontend-tests.log e target-frontend-build.log. Não houve homologação visual.

Integração geral em andamento: testes antigos ajustados para origem explícita, identidade de tentativa e comparação estrutural JSON, sem depender de espaços de serialização. O modelo cognitivo unificado agora filtra eventos não pessoais. Texto da calibração atualizado para não anunciar curva exponencial removida. Resultado global ainda pendente.

## Integração final desta execução por áreas

Backend: node scripts/validate-backend.cjs test — BUILD SUCCESS,255 testes,0 falhas,0 erros,0 ignorados,43.509s. R executável e bibliotecas configurados explicitamente. Log target-backend-integrated-current.log.
Frontend: TypeScript aprovado;Vite build aprovado;7 testes de contratos aprovados;lint0 erros/118 avisos antes da última integração token (não presumir contagem pós-edição). Python11 testes aprovados;R325 verificações aprovadas.

Homologação HTTP real: aplicação iniciou em127.0.0.1:18080 com perfil isolated e diretório target/isolated-qa-* novo. GETsettings200;sem token backupoverview403;backup consistente200;restore200 RESTORE_PREPARED requiresRestart=true mainDatabaseUnchanged=true;Anki status200 com hardgatefalse;preferência temaPOST+GET confirmou persistência. Evidência target/isolated-api-checks.json. Processo isolado encerrado. Não houve troca de banco ativo, migração original ou sincronização externa.

Limitações: a suíte aprovada não demonstra eficácia pedagógica;sem homologação visual;sem calibração individual;classificação real exige curadoria;7órfãos staging históricos não foram apagados;projeções fora de ordem exigem rebuild;modelo unificado experimental ainda requer revisão da autoridade de retenção;componentes extensos/avisos e chunk inicial>500kB permanecem dívida técnica. Não declarar os36 achados resolvidos.

## Consolidação da inicialização do banco — F29

Configuração principal e testes usam spring.sql.init.mode=never. SchemaMigration é o único inicializador do baseline SQLite no startup Spring;JdbcTemplate aguarda migração. Novo SchemaBootstrapIntegrationTest inicia contexto com banco novo isolado e verifica3 migrações,staging criado,quick_check=ok e nenhum backup artificial before_migration em instalação vazia.

Validação direcionada:12 testes aprovados (SchemaBootstrapIntegrationTest,PersistenceContractTest,StagingDatabaseServiceTest),zero falhas/erros/ignorados. Validação completa posterior:256 testes Java aprovados,zero falhas/erros/ignorados;BUILD SUCCESS34.652s. Logs target-schema-authority.log e target-schema-full-regression.log. Não houve migração dos bancos originais. Reversão configuracional é possível;nenhuma nova migração de dados foi adicionada. Demais DDL legados em serviços continuam sujeitos à revisão individual;esta entrega consolida os dois inicializadores centrais.

## Atualização da fila FSRS após nova tentativa — F09/F19

LearningEvidenceService atualiza data_agendada,intervalo_dias e prioridade_score da revisão FSRS_ITEM com o estado mais recente. Antes,MIN(data) mantinha vencimento antigo e MAX(prioridade) mantinha prioridade de erro mesmo após recuperação correta. O histórico learning_evidence_projection preserva sinal de erro inesperado;reenvio idempotente não altera fila. IDs próprios isolam revisões manuais. Não foram alteradas equações FSRS nem migrados registros existentes em massa.

Dois testes de regressão adicionados: erro seguido de recuperação atualiza data/prioridade sem duplicar e replay antigo mantém estado;item concluído reabre após nova tentativa sem alterar revisão manual.

Comando: node scripts/validate-backend.cjs -Dtest=LearningEvidenceServiceTest,RevisionCalendarServiceTest,FsrsReferenceConformanceTest,AttemptIdentityRegressionTest test. Resultado BUILD SUCCESS24 testes,0 falhas,0 erros,0 ignorados. Log target-review-queue-stage.log. Suíte global256 aprovada na etapa anterior,não reexecutada nesta alteração. Homologação visual pendente.

## Fuso configurável nas revisões FSRS

LearningEvidenceService usa fiscalstudy.zone (ambiente FISCALSTUDY_ZONE) ao converter due_at para data_agendada. Default America/Sao_Paulo preservado;instantes de memória continuam UTC. Fuso inválido provoca falha explícita na inicialização,sem fallback silencioso. A mudança afeta novos agendamentos e novas respostas;datas históricas não são recalculadas em massa.

Testes novos com mesmo instante próximo da meia-noite em UTC e São Paulo comprovam mesma previsão de memória e dias locais diferentes;teste de fuso inválido. Validação LearningEvidenceServiceTest,FsrsReferenceConformanceTest,SchemaBootstrapIntegrationTest:14 testes aprovados,0 falhas/erros/ignorados;BUILD SUCCESS. Log target-timezone-stage.log. Nenhuma alteração das equações FSRS ou dos bancos originais. Outros serviços que usam datas devem ser revisados individualmente;esta entrega cobre agendamento FSRS.

## Calendário de revisões — dia local consistente

RevisionCalendarService usa Clock no fuso fiscalstudy.zone em todas as chamadas LocalDate.now:agendamento,agenda,contexto e conclusão/reagendamento. Antes dependia do fuso do computador,divergindo do FSRS configurado. Teste com instante2026-01-01T00:30Z comprova revisãoD1 em01/01para São Paulo e02/01para UTC. Instantes e datas históricas preservados.

Validação:RevisionCalendarServiceTest,LearningEvidenceServiceTest,SchemaBootstrapIntegrationTest —13 testes aprovados,0 falhas/erros/ignorados;BUILD SUCCESS. Log target-calendar-zone.log. Suíte global não reexecutada nesta alteração;outros módulos de planejamento ainda exigem inspeção individual.

## Validação da rodada de produção — 25/10/2026

### Resultados finais

| Área | Versão local validada | Resultado real | Evidência local |
| --- | --- | --- | --- |
| Justificativas pedagógicas | b0d44a261e7e584aa0adb572c38772957846b921 | test-compile e 17 testes aprovados, zero falhas/erros/ignorados | C:/workspace/pedagogy-tests-final.log |
| Proveniência R | f90574fbe59f13156b16a2f379139cb851c0f5fb | R 4.5.1: 336 verificações aprovadas, zero falhas, exit 0, 8.211 segundos | C:/workspace/analytics-origin-final2.log |
| Ordenação das anotações | 72022057f8658c34003acf62a92547be92a2b1c1 | test-compile e 11 testes aprovados, zero falhas/erros/ignorados | C:/workspace/annotation-order-tests.log |
| Respostas não avaliáveis | 13509e69479f13f1dd77e1ce7c0b02ddf08d95ee | test-compile e 19 testes aprovados, zero falhas/erros/ignorados, 46.834 segundos | C:/workspace/ungraded-revision-tests.log |
| Suplemento integrado após guard de null | Mesma versão null, demais fontes desta tabela | 25 testes aprovados, zero falhas/erros/ignorados, BUILD SUCCESS, 41.110 segundos | C:/workspace/round-ungraded-supplement.log |
| Suíte backend completa | Pedagogia, anotações e R acima; anterior ao guard de null | 280 testes, uma falha ambiental, zero erros/ignorados, BUILD FAILURE | C:/workspace/round-backend-tests-final.log |

As baterias direcionadas e o suplemento se sobrepõem; não são somados como casos distintos. Ambiente Java 21.0.7/Maven 3.9.16 offline, ByteBuddy 1.14.19 já instalado. A primeira tentativa pedagógica de autoattach falhou; a execução final pré-carregou o agente existente, sem instalar dependências.

### Histórico da validação integrada e bloqueio

1. Primeira execução: 280 testes, duas falhas, zero erros e um ignorado, BUILD FAILURE. O R herdava C.UTF-8 inválido no Windows, contaminando stdout com warnings; a fixture de recuperação estava ausente. Log C:/workspace/round-backend-tests.log.
2. Segunda execução: LANG=C e LC_ALL=C, fixture copiada e hashes verificados; 280 testes, uma falha, zero erros e zero ignorados, BUILD FAILURE após 71 segundos. XML em C:/workspace/FiscalStudy-round-validation/full-suite-reports; resumo full-suite-summary.json no mesmo checkout de validação.
3. Falha restante: AnalyticsExportIntegrationTest.integratedLifecycle_StudySessionToRValidation_SegregatedAsTest esperava SYNTHETIC_FIXTURE e recebeu UNVERIFIED_SOURCE. A auditoria retorna REJEITADO_FALHA_VERIFICACAO_CRIPTOGRAFICA / CRYPTO_VERIFICATION_UNAVAILABLE antes da nova regra de origem.
4. Comparação controlada base R c0f63c5 versus nova f90574f reproduziu o mesmo erro do digest: The specified file is not readable. file.exists=TRUE e file.access(path,4)=-1, embora read.csv leia o CSV. readBin leu 458 bytes; seu SHA-256 ab5591f5c6c3a06b53c0a25a25ca635ff15c9612e9154af87bd3a5d460674965 coincide com manifesto e Get-FileHash. Logs C:/workspace/provenance-compare.log e C:/workspace/provenance-readbin-check.log. Bloqueio localizado no acesso nativo de arquivo/runtime/ACL deste ambiente, não regressão demonstrada da checagem REAL_STUDY. A validação criptográfica de produção foi mantida estrita.

Relatório consolidado: C:/workspace/round-validation-report.md. Seis hashes das fontes/testes conferidos antes e após a suíte completa, sem divergência, em C:/workspace/FiscalStudy-round-validation/source-hashes-before.json e source-hashes-after.json. O guard de null foi incorporado depois; seus hashes constam em C:/workspace/FiscalStudy-round-validation/null-source-hashes.json, matches=true. Artefatos diagnósticos em C:/workspace/FiscalStudy-round-validation/backend/target/provenance-diagnostic. A instrumentação temporária não alterou produto ou asserções; o teste original foi restaurado.

### Publicação e rastreabilidade

Publicação pelo conector oficial GitHub, pois o Git local não conseguiu executar o gerenciador de credenciais. Os metadados de commit da API diferem dos locais; todas as árvores abaixo foram conferidas como idênticas. Não se afirma push de commits locais com o mesmo SHA.

| PR draft / branch / base | Commit local | Commit remoto | Árvore idêntica |
| --- | --- | --- | --- |
| [#8](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/8), fix/analytics-learning-evidence, base feature/analytics-runtime | f90574fbe59f13156b16a2f379139cb851c0f5fb | 0398e526f520ec6c992898511eaa262267a06a9c | c228a22f4b5a882e581e499ab2c71b4be4f005e1 |
| [#9](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/9), fix/backend-pedagogical-reasons, base fix/backend-error-taxonomy | b0d44a261e7e584aa0adb572c38772957846b921 | 959bfd3a739c6d19dfb9ffa0f5822be9d5070e6d | 983166fe527237e26a41fe9e3a7511673b087c98 |
| [#10](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/10), fix/backend-annotation-order, base fix/backend-error-taxonomy | bd023655308229529f9a8ffb45aef1cc29af44d9 | 235d34752c7635c4cebd9e812ba306f7d46cf51c | 46ccd7fd631da98d9efb538ebf4512ee9621395b |
| #10, segundo commit | 72022057f8658c34003acf62a92547be92a2b1c1 | d180e6c7e76b0862790c4c840f9247111aa08e3c | 989d927649cc8aae239ed5d9b0fce08368276a9f |
| [#11](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/11), fix/backend-ungraded-revisions, base fix/backend-pedagogical-reasons | 604845ab893459db305603ed52635156b574fec1 | 33d85b4ef412c0e42050cc5599839c5c1e7f0779 | 409caaaec789518a7f1f3c0d0a2b3d7d66aaf538 |
| #11, segundo commit | 13509e69479f13f1dd77e1ce7c0b02ddf08d95ee | e5320d055bc288ff590b33a9ce65e772f56890c9 | 9ffd1cce5571054cbf83e9da79b15b2028165a0b |

PR #8 tem parent c0f63c547ba1db61e9415cb0b000c2ff582d1be5; #9 e #10 partem de 1033f8348daa937eb81af5ffbdb643dae851d1c6; #11 parte do parent remoto 959bfd3a739c6d19dfb9ffa0f5822be9d5070e6d. Os quatro heads remotos e main foram reconfirmados; main permanece c26ee20352fc1b6ace0c58be4f24a41a1092fbf0. Nenhum merge.

### Limites da entrega

Nenhuma escrita ou migração nos bancos originais, sincronização AnkiWeb, homologação visual ou demonstração de eficácia pedagógica nesta rodada. Testes usam AUTOMATED_TEST, SQLite em target/test-data e integrações externas desabilitadas. A migração testa cópia descartável da fixture, não o original. Consulta Git ao caminho original core-app retornou must be run in work tree e HEAD da5bc26; portanto, não se declara o checkout original limpo ou idêntico ao baseline. A rodada não escreveu ali.

Estado final: quatro áreas publicadas em PRs draft, validações direcionadas e suplemento aprovados; suíte completa explicitamente não aprovada por uma falha ambiental reproduzida também na base. Isso não encerra globalmente F01–F36 nem comprova aprendizagem.
## Validação do planejamento por concurso — retomada de 25/10/2026

Resultado: `test-compile` e sete suítes, **30 testes, zero falhas, erros ou ignorados**, BUILD SUCCESS em 2:02 minutos, exit 0. Ambiente mínimo isolado, com foundation externa apenas para validar contratos. Nenhuma cópia de banco original ou integração externa ativa.

| Suíte | Testes |
| --- | ---: |
| MaestroContestScopeRegressionTest | 10 |
| MaestroOrchestratorServiceTest | 2 |
| MaestroAdaptiveInterleavingIntegrationTest | 2 |
| RobinHoodContestScopeRegressionTest | 7 |
| RobinHoodCycleEngineTest | 4 |
| RobinHoodCycleControllerTest | 3 |
| RobinHoodWeightsIntegrationTest | 2 |

Evidência local: `C:/workspace/planning-combined-tests.log`, `planning-combined-summary.json`, `planning-source-hashes-before.json` e `planning-source-hashes-after.json`. Cinco hashes de fontes/testes conferidos, sem divergência. O teste-compile e os 13 testes anteriores de RobinHood (`planning-robinhood-tests.log`, 35.990 segundos) se sobrepõem a esta bateria; não somar como casos distintos.

| Publicação | Commit local | Commit remoto | Árvore Git idêntica |
| --- | --- | --- | --- |
| [PR draft #13](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/13), escopo RobinHood | b4682918a8f30c8225c364ef458b684ea6f7ca2b | 2853b78e00791de4533cff09fab44f7a8871e2ea | 191910b8766efcc041235a2a120d46125f3a1702 |
| #13, parâmetro SQL | fea0d3398f1e592dd42c016c65044bf7c28db12c | 70bd415b6d8af3746c13500c7bdbc97306708bb6 | 57147146b8d637b65044f65dc348dd8c068e202d |
| [PR draft #14](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/14), Maestro | 54a374b21070f5a54b085793d57105cb669ac09d | aeb4ff0da54b8216f7c9cf81ee51f78260d71c6d | 35801c19f93caf23c7bf4594a26378d68deec6da |

Publicação pelo conector GitHub com novos metadados de commit; não se afirma push dos SHAs locais idênticos. As branches mantêm parent remoto `e5320d055bc288ff590b33a9ce65e772f56890c9`, equivalente à base local `13509e69479f13f1dd77e1ce7c0b02ddf08d95ee`; não houve rebase. Os PRs são direcionados à main, e seus diffs foram conferidos: três arquivos em #13 e quatro em #14, sem fontes de outras áreas. Heads e main reconsultados: main `fdd450c839c06e05379844b9a8f12edb2b438a5f`, avançada por outra frente. Esta equipe não executou merge.

Limites: a bateria foi executada na base isolada 13509e6 com foundation externa, não em todos os commits atuais da main. Não houve nova suíte completa, execução R, sincronização externa, homologação visual ou demonstração de eficácia pedagógica nesta etapa. A falha ambiental documentada da suíte completa anterior de 280 testes continua registrada; estes 30 testes não a apagam. Métricas legadas de desempenho, orçamento de tempo e defaults de materiais/páginas permanecem pendências explícitas.

Validação desta documentação: links locais dos cinco arquivos do checkpoint, nota, plano, relatório e README verificados; git diff --check aprovado. Nenhum teste de produto foi criado para a alteração documental. A nota para Obsidian foi preparada no repositório; o vault original e seus índices não foram sincronizados.

Reconsulta GitHub desta retomada: PRs #8–#12 estão fechados e integrados por outra frente em 25/10/2026; #13/#14 permanecem abertos como draft. Seus conteúdos anteriores são ancestrais da main fdd450c. Os estados draft registrados nas seções anteriores descrevem o momento da publicação, não o estado atual. Nenhum desses merges foi executado por esta equipe.
