# Contrato das estatísticas de causas de erro

`RevisionCalendarService.getErrorTaxonomyStats(concursoId)` mantém counts e totalErrors e acrescenta causeSource=SELF_REPORTED e scope (ALL_PERSONAL ou concurso solicitado).

## Semântica

Somente ANSWER_SUBMITTED com JSON válido,origin REAL_STUDY e isCorrect booleano false compõe totalErrors. Isso mede erros observados de uso pessoal,não domínio ou retenção. Eventos de teste,demonstração,origem ausente e itens não avaliáveis ficam fora.

counts preserva E1–E5 e aliases legados;NAO_CLASSIFICADO contém causa ausente ou não reconhecida. Os aliases representam os mesmos eventos,não devem ser somados com E1–E5. Para um total por categoria,somar E1–E5+NAO_CLASSIFICADO. Causa desconhecida jamais é convertida automaticamente em E1. Texto em outros campos não atribui causa.

A última anotação por attemptId substitui a causa na projeção de leitura. O evento original permanece intacto. SELF_REPORTED indica relato do estudante,não diagnóstico causal verificado.

Com concurso solicitado,concursoId explícito no payload tem precedência;sem essa informação,aceita apenas questão vinculada atualmente a tópico confirmado desse concurso. Vínculos sugeridos ou rejeitados não entram. Sem atribuição verificável,o evento permanece no histórico global pessoal e fica fora do recorte por concurso. Esse fallback usa curadoria atual,não prova o contexto histórico da tentativa.

## Compatibilidade e dependências

Resposta é aditiva para clientes existentes. Interface deve apresentar NAO_CLASSIFICADO como Causa não informada/não classificada e nunca como lacuna teórica demonstrada. Não modificar FSRS ou inferir causa a partir de erro inesperado.

Branch fix/backend-error-taxonomy deriva de feature/learning-backend. Fundação SQLite permanece dependência externa;validação usa diretório temporário com schema/migrações,sem copiar seus arquivos para esta branch. Nenhum dado histórico é migrado.

## Mini tarefas validadas

1. Causa explícita+origem:7 testes direcionados aprovados.
2. Anotações posteriores:8 testes direcionados aprovados.
3. Isolamento de concurso:9 testes direcionados aprovados.

Comando Maven:test -Dtest=ErrorTaxonomyRegressionTest,RevisionCalendarServiceTest. Resultado global será registrado após conclusão.

Validação global posterior:266 testes,0 falhas,0 erros,0 ignorados;BUILD SUCCESS57.273s. Execução em integração temporária com fundação de dados e R;sem chamadas Anki ou alteração dos bancos originais. Log local externo taxonomy-full-tests.log. Sem homologação visual neste ciclo.
