# Avaliação científica das decisões — contrato experimental v1

## Estado verificado e escopo

A PR #43 (`6b1e3bf`) já estava mesclada quando esta operação começou. Base desta branch: `abf91929bdc847c47400cec04d90acf6e66ad065`, main remota. A CI da PR, [Learner laboratory / synthetic-integrity](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40892602527), terminou em sucesso; não havia execução adicional de CI associada ao SHA do merge na consulta inicial. Nenhum merge foi realizado nesta operação.

O gate original foi novamente executado na base: 968 verificações aprovadas em UTF-8; 964 aprovadas e quatro falhas herdadas em locale C. O exemplo `contextual_gate/expected-memory.json` foi reproduzido byte a byte. As quatro falhas, contagens finais e logs completos ficam no [registro de validação](validation/scientific-decisions/results.txt). Falhas esperadas de subprocessos negativos não são falhas ocultadas do runner.

A mudança fica no Motor R/laboratório: `lab/decision_scientific_evaluation.R`, CLI analítica, extensão aditiva do protocolo pessoal e fixtures/testes. Reutiliza `orchestrate_learning()`, identidade canônica, bundles inertes, Wilson, métricas de calibração e baseline recent20. Não adiciona modelos, ajustadores, banco, interface, scheduler ou gerador de conteúdo. FSRS, SQLite operacional, Core App e calendário permanecem intactos.

## Alvos e o que está implementado

Cada definição identifica instrumento, critério de sucesso, fonte de correção, versão, escopo, classificação/dificuldade e janela temporal **antes** da previsão. A janela de previsão é `[min_delay_seconds,max_delay_seconds]`, em segundos desde o compromisso. Para retenção, exige-se também `min_retention_seconds > 0` desde o último contato observado com aquele item; o intervalo realizado é exportado separadamente de `delay_seconds`.

| Alvo implementado | Unidade e dados mínimos | Elegibilidade/horizonte adicional | Referências e avaliação |
|---|---|---|---|
| `DELAYED_ITEM_RETRIEVAL` | Tentativa identificada de recuperar um item; contatos, timestamps e resultado objetivo/critério independente | Último contato conhecido, intervalo mínimo registrado, nenhuma aprendizagem intermediária; sem ajuda/resposta exposta | Beta(1,1) do prefixo e recent20 da mesma definição; Brier, log loss, frequência, bins/Wilson |
| `NOVEL_ITEM_CORRECTNESS` | Primeira resposta observada na janela exportada; item e família/template | Sem contato anterior registrado com item/template; previsão anterior ao resultado; não prova novidade vitalícia/semântica | Mesmas referências binárias e métricas, separadas por definição |
| `APPLICATION_SUCCESS` | Problema independente de aplicação, instrumento e critério fixos | Classificação confirmada `INDEPENDENT_APPLICATION`, instrumento independente, template conhecido e não exposto | Referências de prefixo do próprio alvo; métricas binárias, não acerto imediato genérico |
| `TRANSFER_SUCCESS` | Instrumento independente de transferência e critério fixo | Classificação `INDEPENDENT_TRANSFER`, ausência de exposição ao item/template e ajuda | Referências/avaliação próprias; sem inferir transferência de questões comuns |
| `ACTIVITY_DURATION_SECONDS` | Atividade concluída, relógios e segundos ativos observados | Previsão anterior ao início, execução autorizada/concluída, tempo ativo consistente e limitado pelo relógio | Média/mediana do prefixo da mesma definição; MAE, RMSE e erro assinado em segundos |
| `POST_INTERVENTION_SUCCESS` | Resultado independente posterior à atividade efetivamente executada | Instrumento `INDEPENDENT_POST_ASSESSMENT`, execução concluída, escopo/identidade/política e janela compatíveis | Prediz **desfecho pós-condicional à execução**. Alteração pré/pós comparável é calculada separadamente, como associação observacional |

Critérios binários vêm de gabarito definitivo ou rubrica independente e cega, identificados antes dos resultados. O avaliador não cria rubricas ou corrige respostas com um modelo generativo. Notas parciais/ordinais não são convertidas automaticamente em probabilidades ou “domínio”; precisam de outro alvo registrado. Dificuldade `UNKNOWN` é preservada em estrato explícito, sem fingir calibração de dificuldade.

O que está implementado para os seis alvos é o contrato, a elegibilidade, o scoring prospectivo e a comparação com referências simples. Não são seis modelos pessoais treinados, nem um produtor operacional novo de previsões: os compromissos válidos precisam ser fornecidos pelo fluxo confiável de coleta futuro.

Não há preditor de efeito causal, uplift ou benefício contrafactual da intervenção. Prever um resultado posterior e observar mudança pré/pós são tarefas distintas desse efeito.

## Evidência real disponível

Nenhum export pessoal autenticado foi fornecido ou coletado nesta operação. Para os seis novos contratos, **zero observações pessoais auditadas foram avaliadas**; `real_evidence_sufficiency` e `personal_validation` permanecem `NOT_ESTABLISHED`. As fixtures validam software, não precisão humana ou superioridade de política.

Há resultados humanos públicos **anteriores**, preservados e não reanalisados nesta rodada:

- [contextual_human_v1.json](results/contextual_human_v1.json): amostra ASSISTMENTS, 12 estudantes, 342 desfechos no bloco temporal final; reconstrução prequential retrospectiva de acerto com o protocolo próprio de ajuda. As comparações registram `INCONCLUSIVE` e amostra previamente examinada. Não é previsão pessoal prospectiva nem instrumento fiscal independente de aplicação/transferência.
- [public_human_reference_v1.json](results/public_human_reference_v1.json): referência pública de recordação e calibração, com incompatibilidades entre relógio UTC e intervalo reportado documentadas no próprio arquivo. Não foi promovida a retenção pessoal independente.
- [recorded_day_validation_v1.json](results/recorded_day_validation_v1.json): avaliação posterior com relógio de dias registrado, separando coordenada derivada de timestamp observado; escopo declarado de recordação humana pública autorrelatada retrospectiva. Não estabelece independência de recuperação, ausência de assistência, transferência, política executada ou validade pessoal.

Esses arquivos sustentam discussões exploratórias nos seus alvos originais. Não fornecem os contatos/instrumentos/execuções autenticados exigidos para reclassificar seus desfechos como os seis novos alvos, nem efeitos das três políticas. Não foram baixados novos dados humanos nem acessado o banco pessoal.

## Entrada, procedência e temporalidade

Envelope inerte `scientific-decision-evaluation-v1` dentro de `analytical-bundle-v1`, com `evaluation_cutoff` UTC explícito. As tabelas e tipos estão em `.se_specs`; campos opcionais ausentes/null viram desconhecidos tipados, sem coerção de string para booleano. Identidades, versões e definições temporais essenciais inválidas interrompem a avaliação. Falta de desfecho, ajuda desconhecida, instrumento não confirmado ou tempo ausente produz exclusão/`NOT_ESTABLISHED`, preservando denominadores.

| Tabela | Papel |
|---|---|
| `events` | Registro append-only: evento/estudante pseudônimo/sessão, ocorrência, registro, ordem, origem/fonte/versão e hash do payload |
| `definitions` | Um alvo/horizonte/critério/instrumento versionado por `definition_id`; inclui dificuldade, classificação, independência e blueprint, quando conhecidos |
| `forecasts` | Compromisso: definição, unidade/template, versão/estado do modelo, política, cutoffs de dados/treino, previsão ou abstenção, IDs de evidências |
| `outcomes` | Tentativa física única, unidade/template, valor, ajuda/resposta exposta, critério, execução e tempo ativo, quando aplicáveis |
| `exposures` | Contatos reais de aprendizagem, revelação ou apresentação de questão; apresentações do próprio assessment são reservadas pelo ID da previsão |
| `decisions` | Entradas originais e resultado do orquestrador, registrados antes da execução; `scientific_policy_record()` prepara esse registro analítico |
| `executions` | Ação/política realmente executada ou substituída, autorização observada, status, início/fim, tempo ativo e identidade exata da decisão |
| `followups` | Vínculos entre execução e resultados posteriores, com pré-medida comparável opcional |
| `curriculum` | Catálogo explícito de escopos, fonte, versão e registro; não se usa o conjunto de candidatos como se fosse o edital completo |

Cada registro, incluindo catálogo e estado da decisão, deve ter um evento de tipo correspondente e hash canônico. Há rejeição de registros não vinculados, duplicados, tentativas físicas duplicadas, ordens contraditórias e mistura real/sintética. Um artefato analisa um único pseudônimo; diferentes pessoas devem ser avaliadas separadamente.

Para cada previsão: treino <= cutoff dos dados <= criação; evidências declaradas ocorreram estritamente antes do cutoff e já estavam registradas. O compromisso foi registrado estritamente antes do resultado e precede sua ordem append-only. Resultado, instrumento e execução precisam estar disponíveis no cutoff de avaliação. Metadados posteriores não entram na elegibilidade histórica.

As referências são reconstruídas apenas com desfechos elegíveis e já disponíveis do **mesmo `definition_id`**, portanto mesmo alvo, instrumento, critério e janela. Um resultado tardio de ingestão não entra retroativamente num prefixo. A previsão em si não é refeita depois de ver o resultado. Isso avalia registros de previsões comprometidas; difere do laboratório antigo que reconstrói previsões retrospectivamente.

SHA e timestamps em JSON não autenticam autoria, captura completa ou compromisso real. Interpretação pessoal requer a auditoria existente de procedência, vinculada ao registro original completo, com atestação de custódia pelo host confiável (`trusted_source_authorized`). O registro, por sua vez, vincula todos os payloads. A CLI nunca importa tal autoridade do JSON. Declarações de ausência de ajuda, classificação e independência continuam condicionadas à qualidade da captura/curadoria; não são provas psicológicas.

A janela de histórico exportada deve ser descrita pelo operador: ausência no arquivo não prova ausência de exposição fora dele. Para piloto real com replay de decisão pessoal, o host precisa reauditar as entradas originais; os atributos de custódia não sobrevivem a JSON, nem são recriados pelo avaliador. Uma decisão sintética ou mista aninhada em um registro “real” é rejeitada.

## Métricas e inferência

- Previsões: Brier/log loss/calibração e frequência binomial com numerador, denominador e Wilson; AUC/AP quando identificáveis. Tempo: MAE/RMSE/erro assinado. Agrupamento por definição/modelo/política e estrato de dificuldade; não há pooling de horizontes ou rubricas.
- Comparações: modelo e baseline são pontuados nos **mesmos IDs**. Se o tempo não tem prefixo, a comparação fica `NOT_ESTABLISHED`; não se inventa uma duração inicial. São publicados `paired_n`, IDs, perdas de ambos e diferença pareada (perda do modelo menos perda da referência; sinal negativo favorece o modelo apenas descritivamente nesse subconjunto).
- Incerteza: Wilson descreve frequências condicionais, não independência dos itens, parâmetros calibrados ou superioridade. Intervalo dependente do tempo/modelo/política não é inventado. Um único estudante com tentativas repetidas exige um plano temporal apropriado antes de inferência confirmatória.
- Aprendizagem: recuperação, aplicação, transferência e desfecho pós permanecem separados por definição, com auditoria de todas as exclusões; desconhecidos não viram falhas/acertos.
- Manutenção: recuperação tardia em escopos do catálogo relevante. Cobertura: escopos com atividade concluída / escopos registrados no edital, explicitamente cobertura de atividade, não domínio.
- Tempo investido: subtotal conhecido, contagem de tempos ausentes e total desconhecido se faltar medida. Pausas não viram estudo por diferença simples entre relógios; atividade parcial ainda pode ter tempo efetivamente investido.
- Oportunidade: consumo observado do orçamento, diferença entre duração e estimativa e custos **estimados** das alternativas são calculáveis. Ganho de aprendizagem perdido numa alternativa não executada é `NOT_ESTABLISHED`.
- Prova: resultado por sessão/definição exige blueprint completo de IDs, sem duplicação, critério binário de pesos iguais predeclarado e metadados de representatividade. Amostra incompleta/ponderação desconhecida fica `NOT_ESTABLISHED`. Não se generaliza automaticamente para a prova do concurso.

## Comparação das políticas e vínculo aos resultados

Cada `decisions` é reproduzido pelo orquestrador real com suas entradas originais; o resultado inteiro precisa coincidir. Assim se preservam o validador, candidatos admissíveis, três escolhas, divergências, rastro e SHA dos insumos. Não se valida uma comparação só porque o texto de justificativa parece coerente.

Uma execução precisa corresponder à escolha daquela política, ao mesmo `run_id`, SHA de entradas, escopo e estudante, depois do registro da decisão. Somente execução autorizada e concluída pode receber follow-up elegível. Ignorada, parcial, interrompida ou substituída não recebe crédito como aplicação completa da política. Se duas políticas escolheram a mesma atividade e apenas uma foi executada, apenas essa recebe a associação observada.

Resultados posteriores precisam vir depois da conclusão, dentro da janela registrada, vinculados à execução e ao escopo. Uma tentativa não recebe crédito duas vezes. A pré-medida, se existente, deve ter sido registrada antes da intervenção e ter definição/critério comparáveis. Saídas separam: **decisão**, **qualidade preditiva**, **associação observacional** e **efeito causal `NOT_ESTABLISHED`**. Não há preenchimento de recompensas contrafactuais.

## Piloto individual futuro

A extensão `decision_scientific_extension` foi acrescentada a [PERSONAL_PILOT_PROTOCOL.json](../lab/PERSONAL_PILOT_PROTOCOL.json). O protocolo comum v2, seu alvo de acerto normal e seu scoring v1 permanecem preservados. A extensão científica está `NOT_STARTED`, sem início automático, aplicação ou agendamento. O [runbook](PERSONAL_PILOT_RUNBOOK.md) distingue os dois escopos.

Mínimo futuro: pseudônimo; IDs já usuais de item/tentativa/sessão/atividade; timestamps e contatos; ajuda/exposição à resposta; critério e versão; compromisso anterior da previsão; ação realmente executada e seus segundos ativos; avaliação posterior independente quando disponível. Definições de instrumento/template/blueprint e sua curadoria são metadados do sistema/especialista, não formulários repetidos para o estudante. Respostas textuais/nomes não são necessários para correção por gabarito.

A coleta deve acompanhar estudo normal por um exportador confiável futuro, com sondagens independentes breves e opcionais quando forem válidas. Não exige flashcards manuais nem gerenciamento manual de revisões. A instalação pessoal atual **não** é declarada pronta para capturar todos esses campos ou proteger instrumentos inéditos. Não foram implementados UI, reservas, captura nova no Core App ou agendamentos nesta operação.

Janelas de análise/encerramento e critérios de precisão devem ser escolhidos antes de examinar os resultados, registrando pendências, perdas e desistências. Não existe N universal que prove suficiência. Avaliação causal futura exigirá protocolo separado, consentimento explícito e desenho aleatorizado/contrabalanceado adequado; não foi iniciada nem automatizada.

## Reprodução e estados experimentais

De `analytics-engine`, com R >=4.5.1 e as dependências existentes:

```sh
Rscript tests/test_runner.R
LC_ALL=C Rscript tests/test_runner.R
Rscript lab/test_contextual_prequential.R
Rscript tests/test_prospective_ledger.R  # exige fixtures Java sintéticas existentes em backend/target
Rscript tests/fixtures/scientific_evaluation/reproduce.R NEW-input.json NEW-report.json
Rscript lab/run_decision_evaluation.R NEW-input.json NEW-replay.json
cmp NEW-report.json NEW-replay.json
```

A saída recusa sobrescrever arquivos. O exemplo e suas definições ficam exclusivamente em `tests/fixtures/scientific_evaluation`, com origem sintética explícita. CLI e testes usam o orquestrador real e verificam corrupção, vazamento, metadados tardios, ajuda, exposição, relógios, abstenção, dados ausentes, associação e reprodução. Nenhum resultado de fixture é benefício de um estudante.

Beta11/recent20, shrinkage por conteúdo, ridge online e calibrações individuais continuam experimentais para validade pessoal e novos alvos. Nenhuma deficiência nova justificou maior complexidade; por isso não foi criado ou treinado modelo novo nesta implementação. A implementação oficial de FSRS não foi alterada; calibração individual e interpretações de retenção/transferência não ganham validação por usar essa referência.
