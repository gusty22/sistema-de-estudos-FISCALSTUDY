# Validação da integração shadow — 30/10/2026

Referência inicial: `6489a1f6455161aec4cb581aeae14b76e64c19a3`. Durante o trabalho, main avançou pelas PRs #48/#49; a branch foi rebaseada sobre `b59041859d2c445cbfe5f4b8d5f581f7ef7f5096`, descendente da referência inicial, sem merge em main. Gates Java repetidos nessa base final. [Auditoria, contrato e limites](CORE_LEARNING_SHADOW.md). Dados exclusivamente sintéticos, SQLite isolado, sem piloto pessoal.

## Gates executados

Gates finais: Linux x86_64, JDK 17.0.18-internal, Maven 3.10.0, R 4.5.2, jsonlite/digest, SQLite JDBC do projeto. Também houve execução inicial em JVM 21 com compilador separado e release 17. Ferramentas inicialmente em `/tmp`, restauradas em `/workspace/scratch/fs-tools` após reinicialização do ambiente. Maven direto; o wrapper, ausente na base inicial, foi restaurado upstream e preservado pelo rebase. Windows: workflow proposto, não executado localmente nem homologado pessoalmente.

| Gate | Resultado |
|---|---|
| Java: classes pertinentes abaixo, base final b590418 | **100 testes, 0 falhas, 0 erros, 0 skips**, incluindo os 13 testes novos shadow e gates upstream de arquitetura/retry. |
| R completo UTF-8 | **1.090 aprovadas, 0 falhas**; base antes da mudança: 1.058/0. |
| Laboratório prequential | Exit 0; gates metamórficos/numéricos aprovados. Validade científica permanece não estabelecida. |
| Laboratório científico | Reutilizado nas suítes e no subprocesso; JSON reimportado, replay e relatório conferidos pelo avaliador original. |
| R locale C: base isolada | **1.054 aprovadas, 4 falhas**, exit não zero. |
| R locale C: branch | **1.086 aprovadas, 4 falhas**, exit não zero. **Suíte não aprovada**. Código R upstream inalterado entre 6489a1f e b590418. |
| Backend completo: base final b590418 isolada | **408 testes, 10 falhas, 44 erros, 4 skips**. |
| Backend completo: branch sobre b590418 | **421 testes, 10 falhas, 44 erros, 4 skips**. Mesmas identidades de testes com falha/erro; nenhuma nova. **Suíte não aprovada**. |
| `git diff --check` | Exit 0. |

Comandos portáveis (R/Maven no PATH, instalação sintética):

```sh
cd backend
mvn test-compile
FISCALSTUDY_RSCRIPT=/caminho/absoluto/Rscript mvn \
  -Dtest=LearningShadowIntegrationTest,LearningEvidenceServiceTest,FsrsReferenceConformanceTest,AnalyticsBridgeProvenanceContractTest,AnalyticsBridgeIntegrationTest,ProspectivePredictionIntegrationTest,AttemptIdentityRegressionTest,AttemptRetryIntegrityIntegrationTest,DevelopmentArchitectureTest,QuestionControllerTest,ProspectiveExportSecurityTest \
  -Dfiscalstudy.shadow.test.rscript=/caminho/absoluto/Rscript \
  -Dfiscalstudy.rscript-executable=/caminho/absoluto/Rscript test
mvn -Dfiscalstudy.shadow.test.rscript=/caminho/absoluto/Rscript \
  -Dfiscalstudy.rscript-executable=/caminho/absoluto/Rscript test
cd ../analytics-engine
LC_ALL=C.UTF-8 Rscript --vanilla tests/test_runner.R
Rscript --vanilla lab/test_contextual_prequential.R
LC_ALL=C Rscript --vanilla tests/test_runner.R
```

Na fase inicial foram necessários compilador separado e release 17. Na validação final, `JAVA_HOME=/workspace/scratch/fs-tools/lib/jvm`, repositório Maven em `/workspace/scratch/fs-m2`, proxy configurado e truststore público do sistema para downloads, sem desabilitar TLS. Gates completos finais usaram cache offline. `test-compile` foi executado na fase anterior aos testes. A base final foi extraída por `git archive origin/main` em diretório separado; relatórios Surefire comparados por `(classe, método, failure/error)`, com diferenças vazias. Comparação anterior em 6489a1f: 388 testes na base e 401 na branch, também com as mesmas 10 falhas/44 erros/4 skips.

As quatro falhas herdadas de locale C são: `UTF-8 curriculum labels survive CSV decoding`; `Optional UTF-8 BOM preserves header identity`; `Locale C preserves recorded discipline labels through the full pipeline`; `Locale C preserves recorded topic labels through the full pipeline`. Testes anteriores não foram relaxados.

O backend completo já falha na base em contratos antigos de schema/contagens, fixtures/views de questões, mídia, pesos e contextos MVC. Dois testes tentam sockets não permitidos pelo sandbox. Classes afetadas: `FiscalStudyMultiConcursoAcceptanceTest`, `MediaRoutingServiceTest`, `QuestionBankServiceTest`, `QuestionHistoryServiceTest`, `ReverseEngineeringServiceTest`, `SwotCycleCalibratorServiceTest`, `PersistenceContractTest`, `SchemaBootstrapIntegrationTest`, `AnalyticsExportIntegrationTest`, `RobinHoodWeightsIntegrationTest`, `AnkiPrivacyPolicyTest`, `QuarantineSourceExposureIntegrationTest` e controllers `Concurso`, `DigitalTwin`, `Edital`, `Ingestion`, `RobinHoodCycle`, `Simulado`, `StrategicSummary`. Não modificadas nesta PR.

## Cobertura e preservação

`LearningShadowIntegrationTest` cria SQLite pelo schema do projeto, usa repositórios reais e processo R real. Cobre partida sem histórico, seleção contextual de item FSRS devido, três políticas, seis especialistas, igualdade de duas respostas, abstenção por tempo/inventário ausente, item inexistente/anulado/não confirmado/rejeitado/rascunho/incompleto, versões/estudante/concurso/cutoff, origem não autenticada, falha/timeout/saída incompleta/MAC adulterado e permissões fabricadas na raiz e na proposta. Regressões da revisão cobrem cold-start operacional sem rótulo sintético, captura atual separada do cutoff histórico, omissão de escopo desconhecido e canonização de mapas aninhados.

SHA-256 do **arquivo SQLite inteiro** é comparado antes/depois nos caminhos positivo e negativo: FSRS, calendário, eventos, pesos persistidos e demais tabelas permanecem idênticos. O shadow não depende de bridge, Maestro, calendário, seleção de questões ou Robin Hood; não há injeção de pesos em memória ou consumidor de proposta. Do serviço FSRS só chama `preview`.

`tests/test_core_shadow.R` cobre duplicatas, origem autodeclarada, especialistas importados, inventário indisponível/adulterado, permissões forjadas, versões, dependência transitiva adulterada, escopo temporal/individual, replay adulterado, HMAC de bytes e reimportação de JSON no laboratório. Fixture em `tests/fixtures/core_shadow/request.R`. Nenhuma execução/desfecho/propensão é fabricada. Resultado experimental não ganha efeito operacional por estar em arquivo; apenas respostas validadas recebem recibo `validation.json`.

Revisão `code-review`: os eixos Standards e Spec identificaram seis problemas de proveniência, tempo, escopo, ordenação, disponibilidade e dependências; todos corrigidos com regressões e revisão estática repetida sem bloqueador novo. `python scripts/context.py doctor/status/update` confirmou Graphify ausente/grafo desatualizado e atualização indisponível, Obsidian sem vault/índice, OpenSpec CLI ausente. Três testes do wrapper de secrets passaram; o scanner efetivo depende de Gitleaks e variáveis GitHub Actions indisponíveis localmente, portanto não declarado aprovado. A CI versionada é o gate desse scanner.

## Doze critérios de entrega

| Critério | Resposta e limite |
|---|---|
| 1. Java chama R contextual? | Sim: `LearningShadowService.observe` → processo limitado → `orchestrate_learning()`. Desligado por padrão. |
| 2. Origem/escopo verificáveis? | Produtor local autenticado entre processos; concurso/edital/item/cutoff/versões explícitos. Origem humana das respostas não comprovada. |
| 3. Apenas atividades reais? | Questões publicadas e vínculos confirmados de repositórios; nenhum material inventado. Testes exclusivamente sintéticos. |
| 4. Especialistas participam? | Seis descritivos executam e preservam desconhecidos/bloqueios. Suporte FSRS separado de item. Sem diagnóstico causal. |
| 5. Mesmos candidatos nas três políticas? | Sim: admissão original única, conjunto conferido na resposta Java. |
| 6. Rastro reconstrói? | Inputs, fonte, versões, cutoff, evidências, especialistas, rejeições, regras/desempates, escolhas e pendências preservados. |
| 7. Replay determinístico? | Sim nas entradas sintéticas verificadas, incluindo JSON persistido e duas execuções Java/R iguais. Não reconstrói estado histórico não versionado. |
| 8. Laboratório consome? | Sim para registros sintéticos, pelo avaliador existente; nenhuma previsão/desfecho fabricado. Custódia científica pessoal duradoura ainda pendente. |
| 9. Estado operacional preservado? | Sim nos testes byte a byte, positivos e falhas; nenhuma intervenção ou estudo pessoal. |
| 10. Dados faltantes? | Origem pessoal independente; relações/instrumentos conceituais temporalmente versionados; assistência/exposição; transferência; frequência representativa com denominador; duração/pré-requisitos de materiais; desfechos futuros. |
| 11. Modelos faltantes? | Previsões individuais validadas de compreensão/aplicação/transferência/tempo, calibração pessoal de memória e modelo de efeito/ganho de intervenções. |
| 12. Planejamento supervisionado? | Exige resolver custódia/evidências, avaliação prospectiva, critérios objetivos de validação/autorização, plataformas/instalação e desenho explícito de supervisão. Não autorizado nesta PR. |

Piloto **NOT_STARTED**, cobertura prospectiva global **FAIL**, seis alvos **NOT_ESTABLISHED**, instalação pessoal não homologada. Nenhum dado pessoal coletado/analisado, chave operacional criada ou teste apresentado como eficácia pedagógica. Graphify/Obsidian/OpenSpec CLI indisponíveis; limites registrados no contrato.
