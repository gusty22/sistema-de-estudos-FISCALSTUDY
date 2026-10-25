# Arquitetura atual da implementação

Raiz editável <implementation-checkout>. Frontend React/TypeScript/Vite;backend Java17+ SpringBoot3.3.4;SQLite;ingestão Python;analytics R. Aplicação single-user local em loopback. Sem commits/push nesta execução.

## Contratos

DatabasePaths deriva o banco principal do datasource e centraliza staging,acervo,backups. SchemaMigration versiona alterações aditivas;staging-schema.sql é compartilhado com Python. A inicialização SQL automática do Spring está desabilitada (spring.sql.init.mode=never); SchemaMigration executa o baseline e as migrações antes do JdbcTemplate. Backups usam SQLite online;restauração prepara arquivo novo verificado e exige reinício/troca offline explícita.

Tentativas usam attemptId UUID e event_id único. Retry devolve snapshot persistido;novo UUID admite reteste. Anotações são novos eventos ligados à tentativa. Consultas pessoais filtram REAL_STUDY;histórico bruto preserva origem. Evidência de domínio requer condições adicionais e tópico confirmado.

LearningEvidenceService mantém projeção por questão transacional e idempotente. Núcleo FSRS6 confrontado com vetores ts-fsrs5.4.2;Good/Again por resposta é política de produto, sem alegação de scheduler completo. Previsão anterior integra evento;erro inesperado é sinal para investigação e não causa diagnosticada. Estado de tópico apresenta desempenho observado com incerteza;serviços experimentais remanescentes não equivalem a autoridade FSRS validada.

Curadoria question_topic_classifications preserva histórico de sugestões,confirmações,rejeições. Somente vínculo atual confirmado alimenta seleção por tópico. Famílias identificam conteúdo exato e não equivalência conceitual. Resumos distinguem templates/trechos fornecidos e não comprovam fonte consultada automaticamente.

Integrações Anki defaultoff,consentimento persistido e hardgate de rede nos testes. Operações administrativas exigem loopback+token;CORS tem lista de origens. Token de ingestão fica em memória. Analytics usa paths separados fonte/saída e subprocessos limitados.

## Validação e limites

Ver docs/VALIDATION_REPORT.md e IMPLEMENTATION_PLAN.md para evidências por área.255 testes Java,11Python,7frontend e325verificaçõesR aprovados nesta execução. Homologação HTTP isolada realizada;visual e eficácia pedagógica pendentes. Não há dados suficientes para afirmar curva individual por matéria.
