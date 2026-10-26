# Contrato de evidencias do perfil individual

`build_learning_profile` conserva a interface e os campos legados da versao 1.0.0. A politica de evidencia e versionada como `evidence_policy_version=1.1.0`, inclusive em perfis vazios. Os novos campos sao aditivos; o resultado continua sendo um perfil analitico de evidencias, nao uma leitura psicologica completa do estudante.

## Elegibilidade e procedencia

`select_evaluable_attempts(raw, questions)` e a fronteira pura compartilhada pelo perfil e pelo pipeline. Retorna `attempts_df`, `evaluable_mask`, `original_count`, `excluded_count`, `missing_outcome_count` e `status_excluded_count`. O perfil recebe sempre as linhas originais para auditar procedencia e denominadores; outros calculos usam as linhas avaliaveis. O filtro nao concede nova procedencia nem modifica o historico.

- Resultados ausentes ou fora de TRUE/FALSE/1/0 nao sao avaliaveis. `ANULADA`, `AUSENTE`, `SOB_REVISAO` e `is_annulled=TRUE` excluem a tentativa das metricas mesmo quando `is_correct` contem um valor. A verificacao considera tanto a tentativa quanto o catalogo.
- `is_real_student_profile=TRUE` exige os tres sinais da auditoria (`is_proven_operational`, `is_real_student_data`, `can_generate_student_profile`), origem explicita `REAL_STUDY` em **todas as linhas originais**, pelo menos uma tentativa avaliavel e ausencia de validacao bloqueante.
- Filtrar uma linha automatizada anulada nao transforma um conjunto misto em historico pessoal. Atributos antigos ou inconsistentes nao substituem a origem por linha. Verificar origem e checksum nao comprova a veracidade de uma declaracao nem aprendizagem.
- Fixtures podem produzir estatisticas diagnosticas, mas nunca representam um perfil pessoal confirmado. Nenhum evento ou banco operacional e alterado.

## Campos aditivos

| Campo | Significado |
| --- | --- |
| `data_quality.excluded_non_evaluable_attempts` | Total original menos tentativas avaliaveis. Inclui itens sem resultado e itens anulados/nao avaliaveis. |
| `data_quality.missing_outcome_attempts` | Resultados ausentes ou nao reconhecidos; pode sobrepor-se ao total excluido. |
| `data_quality.personal_origin_rows` | Linhas originais cuja origem declarada e REAL_STUDY. |
| `data_quality.missingness` | Contagens de confianca, tempo ativo, data e sessao ausentes entre as tentativas avaliaveis; denominador `valid_attempts`. |
| `data_quality.classification_metadata_policy` | Valores registrados preservados; catalogo atual apenas preenche lacunas. |
| `data_quality.classification_temporal_validity` | NOT_ESTABLISHED: catalogo atual nao comprova a classificacao existente na data da resposta. |
| `retention.transfer_status` / `transfer_exposure.transfer_status` | NOT_ESTABLISHED: diferenca entre acuracia inicial e repetida nao demonstra transferencia conceitual. |
| `repeat_vs_initial_accuracy_delta` | Nome explicito da diferenca descritiva; `transfer_delta` permanece como alias de compatibilidade com o mesmo valor. |

Ausencia de tentativas avaliaveis resulta em NO_DATA e proporcoes desconhecidas (`NA`), nunca zero de dominio. Sessao ausente nao e contada como uma sessao inventada. Acerto observado nao mede automaticamente compreensao. A mapeacao de confianca ordinal para probabilidade e provisoria, e ECE em N<30 tem interpretacao descritiva instavel.

## Integridade das classificacoes

`join_question_metadata`, reutilizado pelas agregacoes por disciplina/topico e pelo historico, usa correspondencia por question_id sem multiplicar eventos. Duplicatas identicas do catalogo sao equivalentes; definicoes conflitantes geram erro explicito. Metadados registrados nao sao apagados por valores ausentes no catalogo. Essa politica preserva o historico disponivel, mas nao substitui proveniencia de classificacao ou validacao humana.

## Validacao e limites

As regressoes cobrem anuladas no catalogo e na tentativa, status nao avaliaveis, dados sem resultado, origem ausente/desconhecida/teste/mista com atributo antigo, auditoria bloqueada, dados contextuais ausentes, joins com formato do CSV Java, duplicatas e diferenca de acuracia rotulada corretamente. Execucao focal inicial: 90 verificacoes aprovadas, exit 0, em R 4.5.1; log local `r-profile-focused-final.log`. A validacao integrada final e registrada no relatorio da rodada; contagens focais e integradas podem se sobrepor.

Categorias de evidencia por volume amostral sao heuristicas provisorias; HIGH_EVIDENCE nao demonstra dominio nem eficacia pedagogica.

O perfil nao determina causa conceitual, eficacia de intervencao, personalidade, curva individual calibrada ou transferencia. FSRS permanece a autoridade de memoria; o backend decide as acoes conforme o edital, tempo e qualidade da evidencia. Catalogos incompletos, diversidade/dificuldade dos itens e avaliacoes futuras ainda limitam as conclusoes.
