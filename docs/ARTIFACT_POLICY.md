# Política de artefatos e recuperação

Fontes, migrações, contratos e testes são versionados. Saídas reproduzíveis pertencem a target/, dist/, ingestion/output/ e diretórios por execução analítica. Uma saída antiga nunca comprova uma execução nova.

Bancos e snapshots não são fontes: db/recovery contém cópias verificadas e não deve ser modificado por testes. Backups devem conservar data, integridade e origem. A exclusão exige confirmação de recuperação alternativa.

references/ e graphify-out/ nesta cópia são junções para leitura da origem. Não editar, atualizar o grafo nem executar limpeza recursiva nesses caminhos. As licenças de cada referência governam reaproveitamento.

Arquivos já rastreados não deixam de ser rastreados por .gitignore. Nenhum artefato histórico, fixture, banco ou repositório de referência foi removido nesta entrega. Limpeza futura requer referências estáticas/dinâmicas, consumidor migrado e teste de proteção.

Ambientes Python locais (venv/), caches e logs são reproduzíveis; não incorporá-los como código de produto. O manifesto da auditoria preserva a linha de base, inclusive resíduos, para não perder evidências.
