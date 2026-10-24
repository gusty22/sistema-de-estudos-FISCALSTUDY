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
