# Reconciliação das referências e limites de integração

Inspeção em 28/10/2026 sobre `930141fe54bf9ac99643442cec1f666e59c94260`. Este registro descreve código e documentos consultados; não substitui testes executados nem demonstra eficácia pessoal. Graphify não estava instalado; foram usadas buscas seletivas nos componentes abaixo. Nenhum código externo foi copiado.

## Estado efetivo no repositório

| Componente | Evidência encontrada | Consequência para o orquestrador |
| --- | --- | --- |
| `backend/.../domain/cognitive/FsrsParameters.java` | Perfil padrão FSRS-6 com 21 coeficientes; retenção solicitada 0,90; construtor exige `w[20]=0.1542`. | Parâmetros de referência, não ajuste individual. Não foi encontrado otimizador pessoal integrado no caminho operacional inspecionado. |
| `FsrsEngine.java` / `FsrsCardState.java` | Curva de potência compartilha constantes FSRS-6; comentários ainda mencionam v5 e constantes antigas. `FsrsReferenceConformanceTest` contém referências independentes de transição. | Preservar equações e testes. Comentário histórico não prova que a implementação atual seja v5. Os testes existentes não foram executados nesta revisão. |
| `application/LearningEvidenceService.java` | Estado por `question_id`; apenas `REAL_STUDY`, resultado conhecido, sem ajuda e confiança diferente de 1. Usa GOOD/AGAIN binário. Deduplica por `attempt_id`, `INSERT OR IGNORE` e transação; rejeita atualização anterior à última revisão. | Item e tópico continuam distintos. A política de conversão do resultado é uma convenção operacional, não uma medida direta de recordação livre. |
| `AttemptSubmissionService.java:251` | `preview(questionId)` ocorre no envio da resposta, antes da captura de `occurredAt` e da atualização do estado. | Snapshot pré-atualização, não previsão comprovadamente anterior à exposição ao item. Para predição prospectiva da resposta, usar o ledger de preparação separado. |
| `LearningEvidenceService.java` | Calendário usa identidade `fsrs-question-topic`, com upsert por ID. | Evita duplicação dessa mesma identidade; uma questão com vários tópicos pode gerar vários registros. Não demonstra ausência de sobreposição com todos os agendadores legados. O novo orquestrador não agenda. |
| `knowledge/TopicKnowledgeAggregatorService.java:438` | `loadMemoryStates()` calcula média de `EXP(-elapsed/stability)` e a publica como `fsrsRetrievalRate`. | **Divergência concreta:** essa projeção exponencial não é a curva FSRS-6. Não importar como memória FSRS validada; bloquear com `LEGACY_MEMORY_PROJECTION_NOT_FSRS6`. Correção Java e teste de regressão ficam pendentes desta rodada. |
| `TopicKnowledgeAggregatorService.java:320` | Parser preenche resultado ausente com false, confiança ausente com 3; usa catálogo atual e última anotação. Deduplicação por event ID existe no rebuild. | Não reutilizar essa projeção como evidência temporal original. O novo caminho deve preservar ausências, procedência e data de corte. |
| `FsrsEngine.evaluateAttempt()` | Caminho legado converte confiança em ratings, com mensagens que afirmam falha de retenção ou exigem intervenção. `LearningEvidenceService` usa outro mapeamento. | Não tratar mensagens legadas como diagnóstico causal ou autorização para intervenção. Confiança alta e erro não identificam causa. |
| `R/retrieval_diagnostics.R` | Filtra elegibilidade, identidade, duplicatas, tempo pré-atualização, probabilidade finita e versão não vazia; compara resultado com faixas operacionais. | Reutilizar como descrição separada. Versão não vazia não equivale a versão registrada/aprovada; o contrato comum deve impor autoridade adicional. Não estima causa nem altera FSRS. |
| `R/intervention_analysis.R`, `R/recommendation_evaluation.R` | Contratos de intervenção/follow-up já existem; saída declara observações associadas, não efeito causal; aplicação/agendamento false. | Reutilizar registros e validação. Não criar um segundo sistema de experimentação nem promover preferência a eficácia. |
| `lab/prospective_evaluation.R` | Verifica forecasts comprometidos, cutoffs, evidências estritamente anteriores, origem, autoridade e vínculo posterior. | Reutilizar para avaliação futura. A nova recomendação não pode ser retroativamente apresentada como previsão comprometida. |

`CONTEXT.md` contém descrições históricas de domínio com decaimento exponencial, pesos e HEAD antigo. O estado de código e os contratos científicos atuais prevalecem; não foi feita refatoração geral do Core App para reconciliar toda a documentação histórica.

## Referências externas verificadas

Arquivos foram consultados pelo plugin GitHub; hashes abaixo são **blob SHA** dos arquivos, não commit SHA do projeto externo.

| Referência | Arquivo e SHA | Uso e restrição |
| --- | --- | --- |
| [Anki](https://github.com/ankitects/anki) | README `29168e81d09162f5c157933ebafe8ee0a3b60608`; LICENSE `6aa37a76547f179fec9893a6f4b6064b2681bacb` | Referência operacional de repetição espaçada. Licença principal AGPL-3.0 ou posterior, com exceções por componente. Nenhum transplante de código. |
| [FSRS4Anki](https://github.com/open-spaced-repetition/fsrs4anki) | README `f0c3fa105b4146734e7d9131c5f5d69396bc8871`; LICENSE `200c20b56e6bb4aa6739450acf1fb9ba26d082c1` | Distingue scheduler e optimizer; referência MIT. Reutilizar o FSRS existente, não introduzir nova curva. |
| [Engram](https://github.com/nagisanzenin/engram) | README `a932735f0e5a71753ad26451230d8f9c3a0aeda3`; LICENSE `8bcfcd1a2de104111dc22bb414ba1f44ccd8dece` | Inspira mapa conceitual e recibos de avaliação independente. README declara FSRS-4.5 e avaliador separado; essas declarações e contagens de selftest não validam desempenho pedagógico nem calibração pessoal do FiscalStudy. MIT, sem código copiado. |
| [Track Concursos](https://github.com/michel-softwares/track-concursos) | README `3e346de3a12d837ef6ee884e0392ce76bd2d5369`; LICENSE `5bee841103f658e2502be1345cc55a39f72a5f9b` | Referência funcional de concurso, tópicos, materiais e portabilidade. Licença proprietária pessoal/não comercial restringe modificação, derivados e redistribuição sem autorização escrita. Nenhum componente reutilizado. |
| [Tópico FSRS](https://github.com/topics/fsrs) | Página dinâmica consultada via ferramenta web após GitHub fetch retornar 404 para a rota de tópico. | Índice de descoberta, não especificação científica nem prova de compatibilidade. Não justifica dependência adicional. |

O [manual oficial do Anki, seção FSRS Parameters](https://docs.ankiweb.net/manual/deck-options#fsrs-parameters), consultado nesta revisão, informa ajuste pelo histórico de revisões, alertando para poucos registros e uso incorreto dos ratings. Não fornece um limiar universal de suficiência científica pessoal. A opção de otimizar não equivale a autorização para reagendar toda a coleção.

## Otimização e integração mínima

Não integrar otimizador nesta rodada: faltam evidências pessoais suficientes, contrato de ratings/exposição consistente, objetivo temporal definido e validação prospectiva. Preparar futuramente uma proposta contendo versão do SDK/otimizador, parâmetros anteriores/candidatos, IDs e hash dos dados de treino, corte temporal, unidades de intervalo, exclusões, avaliação fora do treino e comparação com o perfil padrão. Um ganho nominal isolado não promove os parâmetros. O artefato candidato deve permanecer separado e `can_apply=false`, `can_schedule=false` até autorização e validação apropriadas.

O caminho mínimo desta rodada é: evidências exportadas → especialistas descritivos existentes/novos → contrato comum com capacidades explícitas → admissibilidade → proposta determinística em observação. Não consumir médias legadas como probabilidades de domínio, inventar causa do erro, distribuir acerto por todos os conceitos, nem criar outro calendário.
