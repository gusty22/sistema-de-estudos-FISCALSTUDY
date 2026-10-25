# Publicação por áreas

Base remota conferida por git fetch origin:c26ee20352fc1b6ace0c58be4f24a41a1092fbf0. Todos os118arquivos originais do trabalho (70modificados+46novos+2planejamento) foram preservados e conferidos por SHA256 no snapshot local. Nenhum deles foi alterado na cópia referência durante a separação.

|Área|Branch|Commit|PR|Validação|
|---|---|---|---|---|
|database|feature/database-contracts|c4bccac|[PR 1](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/1)|5 testes isolados + test-compile|
|analytics|feature/analytics-runtime|c0f63c5|[PR 2](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/2)|325 verificações R + pipeline fixtures|
|backend|feature/learning-backend|fbca00b|[PR 5](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/5)|261 testes em integração temporária dados+R|
|ingestion|feature/document-ingestion|4064099|[PR 3](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/3)|11 testes Python; schema externo|
|frontend|feature/study-frontend|a5febc7|[PR 4](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/4)|tsc,build,7 testes;lint118avisos0erros|

Documentação:branch docs/execution-and-validation,commit/PR registrados no GitHub após este documento. Nenhum merge main autorizado ou executado. Todos os PRs criados draft.

## Agentes efetivamente usados

publish_data:fundaçãoSQLite;publish_analytics:R;publish_backend:Java/APIs e integração temporária;publish_ingestion:Python;publish_frontend:React/contratos;publish_docs:documentação e scripts. Orquestrador revisou hashes,logs,escopos e controlou commits/push/PR. Cada agente atuou em uma área;nenhum agente fez commit/push.

## Dependências e recuperação

Dois testes originalmente atribuídos a dados foram transferidos para backend,pois dependem de seus serviços. Fundação ganhou teste novo isolado DatabaseFoundationTest. Backend+dados+R foram validados apenas em diretório temporário,sem copiar pré-requisitos para branch consumidora. Ingestão usou FISCALSTUDY_STAGING_SCHEMA externo. Interface mocka APIs e depende do backend para homologação real.

Ordem proposta de integração,diante de nova autorização:dados,analyticsR,backend,ingestão/interface,documentação. Branches partem da mesma base e têm deltas disjuntos;homologação integrada/visual permanece requisito antes de liberar produto.

work-persistence.cjs fica somente local. Auditoria bruta e manifesto bruto permanecem imutáveis no snapshot e têm cópiasPUBLIC sanitizadas no PR docs. PDFs,DBs,backups,outputs,logs,junctions,node_modules e refs não foram incluídos. FILE_ACCOUNTING.json contabiliza cada caminho original.

## Limites

Builds aprovados não demonstram eficácia pedagógica. Sem homologação visual nesta publicação. Frontend ainda118avisoslint e chunkinicial575.04kB. Curadoria de questões,calibração individual e pendências dos36achados seguem no plano;publicar não significa resolver todas.
