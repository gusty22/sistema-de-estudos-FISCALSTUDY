# Ordem cronológica das anotações de tentativa

AttemptAnnotationView.latest(JdbcTemplate) compara occurred_at como java.time.Instant, preservando nanossegundos. Textos ISO com frações ou offsets diferentes não são ordenados lexicalmente. O maior Instant por tentativa prevalece; Instants iguais são desempatados pelo maior rowid SQLite (ordem de anexação).

O log permanece append-only. Nenhuma migração ou atualização de eventos é realizada. Timestamp ausente/inválido produz IllegalStateException explícita, assim como payload inválido já produzia. A sobrecarga latest(List<String>) continua recebendo payloads previamente ordenados.

Teste AnnotationOrderingRegressionTest usa SQLite em memória e cobre fração após segundo inteiro, nanossegundos em ordem de inserção inversa, offsets equivalentes, desempate por anexação e timestamps inválidos/ausentes.

Validação isolada: test-compile concluído; seis testes AnnotationOrderingRegressionTest aprovados (zero falhas/erros/ignorados). Execução conjunta ErrorTaxonomyRegressionTest encontrou problema operacional de attach ByteBuddy no pipe Windows; resultado dessa suíte ainda pendente. Log local externo: C:/workspace/annotation-order-tests.log. Nenhum banco original ou integração externa utilizado.
