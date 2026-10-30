# Recuperação da suíte completa do Core App

Base auditada: main `b590418` (PR #49 integrada). Este incremento depende explicitamente da [PR #59 de sessões](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/59), referência `642e2c8`, e usa branch/worktree próprios `fix/backend-suite-recovery` / `/workspace/fiscalstudy-suite`. Não houve merge ou automerge, alteração do Motor R/FSRS ou acesso a banco pessoal.

## Causas confirmadas

A main atual reproduziu **408 testes, 10 falhas, 42 erros e cinco skips**. Os nomes/estados estão na [evidência estruturada](validation/backend-suite-recovery.json).

| Grupo | Ocorrências anteriores | Causa demonstrada e correção |
| --- | ---: | --- |
| Inicialização MVC | 31 erros | Sete slices carregavam o filtro real de acesso a fontes sem fornecer `QuarantineSourceExposureService`. Adicionada a dependência mockada; os filtros continuam ativos. Não foram usados `addFilters=false` nem desativação da quarentena. |
| Schema de fixtures | 11 erros e 2 falhas | Aceitação multi-concurso/engenharia reversa/mídia criavam apenas parte do schema, sem `study_questions` ou reservas diagnósticas. Agora executam `SchemaMigration.migrate`; engenharia reversa recebe cinco itens sintéticos explícitos. A compatibilidade legada `question_attempts` continua exercitada pelo teste de mídia. Nenhuma regra de mídia foi modificada. |
| Migrations | 2 falhas | Testes esperavam três versões, mas a main já possuía sete. Corrigidos no incremento de sessões para a versão declarada atual; fundação e recuperação verificam idempotência/preservação. CI adicional encontrou outra expectativa fixa em sete após a nova migration 8; também corrigida na PR #59. |
| Stubs SQL obsoletos | 2 falhas | Contagem esperava `FROM questions`, enquanto a implementação usa a view operacional `study_questions`. Os stubs passaram a corresponder à consulta real; contagens esperadas 229/100 foram mantidas. |
| CSV evoluído | 1 falha | O teste supunha `concurso_point` como última coluna, antes das colunas FSRS já existentes. Agora verifica a coluna pelo cabeçalho e mantém `is_correct=NA`, pontos de concurso e os dois itens originais. Formato exportado não foi alterado. |
| Autoridade analítica | 3 falhas | Dois testes HTTP e a última asserção de aplicação SWOT exigiam execução automática. Isso contradiz `RobinHoodWeightsDTO.supportsAutomaticPlanning()==false`, deliberado na produção e coberto por `AnalyticsDecisionGateTest`. Agora verificam 422/headers, ausência de pesos aplicáveis e de emergência aplicada. Toda a aritmética da prévia SWOT continua testada. Nenhuma autoridade foi habilitada para obter verde. |
| Imagem de recuperação ausente | 1 skip | Um teste buscava `../db/recovery/fiscalstudy.db`. Foi substituído por imagem v7 sintética em `@TempDir`, migrada e conferida por contagens/payload histórico e verificação física. Não há mais descoberta oportunista de base pessoal. |
| Runtime R externo | 4 skips | R não está instalado no executor local. Além disso, dois testes verificavam apenas `Files.isRegularFile("Rscript")`, omitindo um comando válido no PATH. O probe agora executa `--version`; o gate de CI com `fiscalstudy.tests.require-r=true` falha se R não puder ser executado. A integração continua real; não foi substituída por mocks. |

## Defeito adicional de isolamento da exportação

A investigação encontrou `exportSyncToLocal` escolhendo `../analytics` por existência de diretório e acrescentando incondicionalmente `C:\Users\washi\Downloads\fiscalstudy-analytics`. Um teste HTTP reproduziu saída diferente de `AnalyticsPaths.output()` antes da implementação: um teste, uma falha. Isso também permitia que testes Windows tentassem escrever fora da saída isolada.

A correção reutiliza `AnalyticsPaths`: a saída padrão é exclusivamente `fiscalstudy.analytics-dir`; não há cópia implícita para diretório pessoal. Destino adicional continua possível pelo parâmetro explícito `targetDir`. Os testes verificam ambos os percursos. Esta é a única alteração de produção deste incremento.

### Compatibilidade e migração de consumidores

A URL `/api/v1/analytics/export/sync-to-local`, nomes `questions_v1.csv`/`events_v1.csv`, formatos CSV, filtros e chaves principais de resposta foram preservados. Mudou a **colocação padrão dos arquivos**, não o contrato analítico. A cópia implícita adicional foi removida; sua chave dinâmica de resposta deixa de existir se nenhum destino adicional foi solicitado.

Consumidores que liam o antigo `<projeto>/analytics` ou o caminho pessoal fixo devem usar os caminhos absolutos retornados pela API. Para manter conscientemente uma localização anterior, configure `FISCALSTUDY_ANALYTICS_DIR` para ela ou passe `targetDir` explicitamente para a cópia adicional. Não há migração/apagamento de arquivos antigos. A busca em `frontend/src` e `scripts` não encontrou consumidor versionado desse endpoint, das chaves principais ou de `questions_v1.csv`; consumidores externos não podem ser presumidos ausentes. Instâncias diretas que precisem escrever exportações devem fornecer `AnalyticsPaths` no construtor; o construtor legado de projeções sem escrita permanece disponível.

`AnalyticsBridgeService` já usa pacotes por execução e `AnalyticsPaths`; o fluxo de transporte R não depende da cópia pessoal removida. Nenhum CSV, manifest, snapshot ou identificador compartilhado foi reclassificado para permitir testes.

## Resultados reais

| Execução | Testes | Falhas | Erros | Skips |
| --- | ---: | ---: | ---: | ---: |
| main atual, antes | 408 | 10 | 42 | 5 |
| Grupo de infraestrutura corrigido | 52 | 0 | 0 | 0 |
| Grupo de contratos corrigido | 30 | 0 | 0 | 2 (R) |
| Reprodução do destino indevido | 1 | 1 | 0 | 0 |
| `clean test-compile test`, Java 17/Maven 3.9.9/Linux | 422 | 0 | 0 | 4 (R) |

O build limpo foi executado depois de todos os ajustes de produção e das correções da suíte original. A retificação posterior de isolamento de uma fixture é descrita abaixo. Uma tentativa intermediária sem permissão de rede falhou nos servidores HTTP loopback de Anki/quarentena e na expectativa de migration ainda não trazida da PR #59; a execução final permitiu a rede das fixtures, sem enfraquecer ou omitir esses testes. Falhas de compilação de uma primeira versão da nova fixture de exportação foram corrigidas antes da reprodução válida; não foram apresentadas como defeito de produto.

```sh
cd backend
sh mvnw -B -ntp clean test-compile test
# Em ambiente com R/jsonlite/digest: ausência de R passa a ser erro, não skip.
sh mvnw -B -ntp -Dfiscalstudy.tests.require-r=true test
```

O workflow `Full backend suite with R transport` usa Java 17 e R 4.5.1 em Linux e Windows Server 2022, roda toda a suíte e arquiva JUnit. Seu resultado remoto deve ser conferido no commit exato; a aprovação local com quatro skips não o substitui. O gate de sessões da PR #59 já foi conferido nos logs de `642e2c8`: [Linux e Windows](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/41046249051), 35 testes por job, sem falhas/erros/skips. Isso não homologa a instalação Windows pessoal.

## Revisão e limites

Revisões independentes da skill `code-review`: Standards, zero violações materiais; uma observação editorial de comentário de saída foi atendida. Spec, zero violações funcionais; estratégia de compatibilidade documentada acima e evidência final devem acompanhar a entrega. Revisores não executaram os testes e não substituem a validação.

O helper de contexto foi executado uma vez por worktree; grafo opcional indisponível/stale, sem sincronização de cofre pessoal. Não se mediu desempenho nem se iniciou coleta. Os impedimentos operacionais e os gates científicos separados estão em [WINDOWS_STUDY_PILOT_READINESS.md](WINDOWS_STUDY_PILOT_READINESS.md).

## Retificação a partir da suíte completa nativa

No head `64d84b2`, [run41047191188](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/41047191188), Linux aprovou **422 testes sem falhas/erros/skips**, incluindo as quatro integrações R reais. Windows executou os mesmos 422, sem skips, mas um teste esperava 422 e recebeu 400: um teste R anterior deixara `SUCCEEDED` em `target/test-data/analytics/current-run.json`. A API corretamente recusou carregar um caminho fora do artefato dessa execução.

A contaminação foi reproduzida em Linux ao apontar a fixture para um diretório com manifesto anterior: dois testes, uma falha. A classe `RobinHoodWeightsIntegrationTest` agora tem saída analítica exclusiva via `DynamicPropertySource` e descarte de contexto; o mesmo comando com diretório global contaminado passou, dois testes sem falhas/erros/skips. Status/headers esperados e código de produção não foram afrouxados. Revisão suplementar Standards/Spec: zero achados materiais. Conferir a repetição nativa no novo head antes de declarar Windows completo aprovado.
