# Auditoria incremental do Core App — 2026-10-30

## Referência e isolamento

- Repositório: `gusty22/sistema-de-estudos-FISCALSTUDY`.
- `main` remota conferida por `git ls-remote`: `6489a1f6455161aec4cb581aeae14b76e64c19a3`.
- Branch: `fix/backend-operational-integrity`; worktree exclusivo `/workspace/fiscalstudy-backend`.
- Comparação independente em `/workspace/fiscalstudy-backend-baseline`, detached no mesmo SHA.
- PRs consultadas: #45 (assinatura/exportação), #46 (fronteira de ativação/Windows) e #47 (captura ordinária), integradas; #48 (contexto/ferramentas/segurança de desenvolvimento), aberta em draft. Não foram incorporadas mudanças da #48.
- Lidos `AGENTS.md` e `.agents/memory/CONTEXT.md`. Este último contém estados históricos; a referência Git e os testes atuais prevalecem sobre suas contagens antigas. Graphify não está instalado neste executor; localização feita com `rg` e leituras seletivas.
- Nenhum Motor R, parâmetro de aprendizagem, política adaptativa, banco pessoal ou contrato analítico foi alterado. Não houve merge/automerge, ativação de piloto ou sincronização Anki.

## Arquitetura observada

183 fontes Java e 75 fontes de teste na base: Spring Boot 3.3.4/Java 17, API MVC, serviços de aplicação, domínio e adapters JDBC. Dependências incluem SQLite JDBC 3.46.1.0, JPA e dialect comunitário SQLite; não há starter Spring Security. Isso é uma aplicação local de usuário único, não uma arquitetura autenticada multiusuário.

`application.yml` vincula por padrão a `127.0.0.1`, configura WAL, foreign keys e busy timeout. `DatabasePaths` centraliza caminhos; `SchemaMigration` faz bootstrap aditivo/transacional, com snapshot verificado antes de migrar uma base existente; há sete versões na base atual. Staging possui migração separada. O event store é append-only; `appendEventOnce` usa a chave do evento e `ON CONFLICT(event_id) DO NOTHING` para reservar a identidade sem duplicação concorrente.

O percurso auditado foi API de questões → `AttemptSubmissionService` → `EventStoreRepositoryImpl` → projeção de evidência/revisões. A gravação da resposta precede a projeção; se esta falhar, a API retorna 503 com identificação da tentativa persistida, permitindo recuperação com o mesmo ID. A projeção tem transação própria e deduplicação por tentativa. Não foram alteradas sua elegibilidade, fórmulas ou decisões.

Na fronteira R, `AnalyticsProjectionService` exporta usando limite de rowid e manifest/hash; `AnalyticsBridgeService` isola diretório por execução e executa processo limitado. Há exportação prospectiva assinada e preparação prévia de previsão. Os testes Java existentes de previsão/exportação foram executados; isso não substitui execução do R ou homologação browser.

## Defeitos reproduzidos e correções

### P0/P4 — sucesso falso em replay com evidência diferente

Antes da correção, repetir o mesmo `attemptId` comparava questão, sessão, opção, confiança, duração e o booleano de ajuda. Ignorava origem efetiva, declaração desconhecida versus explícita de ajuda, tipo de ajuda/intervenção, causa de erro e outros campos enviados. Quatorze casos HTTP/SQLite reproduziram HTTP 200 para dados diferentes; esperavam 409. O evento não era sobrescrito, mas o cliente recebia confirmação incompatível com o que persistiu, inclusive sobre evidência de ajuda consumida pela análise.

Agora os mesmos valores padrão/normalizações constroem os campos enviados que serão gravados e comparados no replay. Isso também protege o perdedor da inserção concorrente. Questão, sessão e tipo de evento precisam corresponder. Campos calculados pelo servidor (gabarito, previsão, exposição e timestamps) continuam recuperados do evento original, sem recálculo no retry.

Compatibilidade: submissões novas válidas e repetições equivalentes mantêm comportamento e formato. Mudanças de evidência sob a mesma identidade passam a retornar o 409 já previsto pela API. A causa de erro posterior deve usar a rota append-only de anotações. Ausência histórica de `helpDeclarationProvided` continua desconhecida; não se converte em declaração explícita. Não há migração ou reescrita histórica. A ordenação das chaves de novos JSONs pode diferir; o esquema é o mesmo e hashes continuam calculados sobre os bytes efetivamente exportados.

Testes adicionais cobrem defaults equivalentes, espaços/capitalização, concorrência de payloads diferentes com um único vencedor, ausência histórica da flag e aplicação Spring completa com migrations, filtros e repositórios reais. Os casos existentes de falha/recuperação da projeção e concorrência de retries iguais continuam passando.

Hipótese descartada: a inspeção inicial sugeriu divergência de normalização da opção. O código já preservava a opção enviada em maiúsculas e o replay aparava espaços/ignorava capitalização; não foi tratado como defeito demonstrado.

### P2 — wrapper Maven impossível de iniciar em checkout limpo

`sh mvnw -version` falhava porque `.mvn/wrapper/maven-wrapper.properties` não estava versionado e `.mvn/` é ignorado. Foi incluído explicitamente o arquivo exigido pelos scripts existentes, com Maven 3.9.9 e SHA-256 da distribuição ZIP fixados. Os arquivos TAR/ZIP baixados foram confrontados com os SHA-512 publicados pelo Maven Central. Nenhuma dependência da aplicação foi atualizada.

Bootstrap em cache vazio passou; o gate final foi executado pelo próprio `mvnw`. Windows não foi executado localmente. O workflow novo `Backend attempt integrity` usa o wrapper/Java 17 e nove suítes selecionadas; ele não representa aprovação da suíte completa.

## Validação executada

Resultados estruturados e IDs dos testes herdados: [validation/backend-integrity-2026-10-30.json](validation/backend-integrity-2026-10-30.json).

| Execução | Testes | Falhas | Erros | Ignorados |
| --- | ---: | ---: | ---: | ---: |
| Reprodução antes da correção | 24 | 14 | 0 | 0 |
| Primeira suíte completa da branch | 405 | 10 | 42 | 5 |
| Suíte completa da main limpa | 388 | 10 | 42 | 5 |
| Seleção inicial com exportação legada | 104 | 1 | 0 | 2 |
| Gate final de integridade, incluindo Spring completo | 90 | 0 | 0 | 0 |

`test-compile` passou no Java 17.0.21 com Maven 3.9.9. A primeira suíte completa antecede o novo caso Spring, executado depois no gate final. Os 52 resultados de falha/erro e cinco skips foram comparados por nome e estado com a main limpa e são os mesmos. Não se declara a suíte completa aprovada.

Entre os problemas herdados: testes ainda esperam três migrations embora existam sete; contextos MVC não carregam dependências; fixtures de aceitação falham; expectativas de proveniência/elegibilidade e de pesos analíticos estão divergentes. A causa de cada falha ainda exige investigação individual; igualdade dos resultados entre branches não prova prontidão do produto.

Reprodução em checkout limpo com JDK 17:

```sh
cd backend
sh mvnw -B -ntp test-compile
sh mvnw -B -ntp -Dtest=AttemptIdentityRegressionTest,AttemptRetryIntegrityIntegrationTest,ProspectivePredictionIntegrationTest,LearningEvidenceServiceTest,QuestionControllerTest,ProspectiveExportSecurityTest,LocalAccessFilterTest,DatabaseFoundationTest,FsrsReferenceConformanceTest test
# Diagnóstico amplo: atualmente falha também na main.
sh mvnw -B -ntp test
```

No executor foi necessário preparar Maven/JDK e usar proxy e truststore de sistema. A tentativa inicial com o runtime sem compilador e a primeira tentativa do JDK baixado sem o CA do proxy falharam antes dos testes; foram corrigidas no ambiente, sem relaxar TLS. Os testes usaram SQLite temporário/`target`; as instâncias sintéticas desabilitam rede Anki. Não houve benchmark, teste browser local, execução R local ou validação de instalação pessoal.

## Pendências priorizadas e limites da auditoria

| Prioridade | Observação e classificação | Próximo incremento verificável |
| --- | --- | --- |
| P0 | `StudySessionService.recordStudySession` atualiza progresso de material antes de anexar um evento com UUID novo, sem unidade transacional abrangendo ambos. Risco estático de duplicidade/atualização parcial; falha e concorrência ainda não foram injetadas nesta auditoria. | Reproduzir retry/falha intermediária em SQLite e definir identidade compatível para a operação, preservando sessões históricas e contadores. |
| P0 | A suíte global está vermelha na base e na branch. Defeito demonstrado da validação; não prova que todos os fluxos operacionais correspondentes falham. | Separar fixtures/contextos obsoletos de falhas de produto; reparar por módulo, sem alterar expectativas pedagógicas para obter verde. |
| P1 | `LocalAccessFilter` restringe Origins/Referers e operações administrativas com token/loopback; o bind local é a fronteira padrão. Alterar `FISCALSTUDY_BIND` pode expor rotas ordinárias sem autenticação multiusuário. Risco condicionado à configuração. | Testar matriz de bind/Host/acesso antes de oferecer execução remota; não assumir isolamento por usuário. |
| P1 | Handlers gerais de `IllegalArgumentException`/`IllegalStateException` devolvem a mensagem da exceção. Potencial exposição se ela contiver detalhes internos; exploração em rota concreta ainda não reproduzida. | Catalogar mensagens de entrada versus internas e criar teste de fronteira antes de mudar respostas públicas. |
| P2 | Wrapper corrigido; demais falhas de bootstrap/testes listadas no JSON. | Tornar a execução ampla reproduzível sem diminuir cobertura ou esconder skips. |
| P3 | Índices e limites SQLite existem; não houve medição de carga/latência ou múltiplos processos. | Medir com fixtures representativas antes de afirmar ganho de desempenho ou alterar pool/índices. |
| P4 | Contratos existentes preservados e verificados em Java; runtime R indisponível localmente. | Conferir o gate Java→R da PR; qualquer nova identidade de sessão/exportação exige proposta de compatibilidade separada. |

Este é um incremento de integridade auditável, não certificação integral de segurança nem declaração de prontidão para estudo diário. A frente analítica permanece independente. Não há dependência de código da PR #48; nenhuma fonte pertencente ao Motor R foi modificada.
