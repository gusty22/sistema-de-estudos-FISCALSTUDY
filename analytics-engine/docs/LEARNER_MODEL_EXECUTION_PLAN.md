# Modelo individual de aprendizagem: execução orientada a evidências

Atualização: 26/10/2026. Base remota desta rodada: `90c26af0c67e5745e84080792d687dad200b4f49`. Este plano complementa as especificações anteriores; não declara concluída a auditoria F01–F36 nem comprova eficácia pedagógica.

## Objetivo operacional

O R deve produzir um retrato corrigível das evidências de aprendizagem disponíveis, por questão, tópico e disciplina. O backend usa essas evidências junto do edital, prazo e tempo disponível para decidir a próxima atividade. “Leitura do estudante” não significa diagnóstico psicológico, estilo fixo ou reprodução exata de sua memória.

A cadeia é: tentativa com origem e contexto → validação → evidência avaliável → perfil e incerteza → hipótese/intervenção proposta → decisão do backend → avaliação posterior. Observações, estimativas e hipóteses permanecem separadas.

## Responsabilidades e requisitos verificáveis

| Requisito | Dados necessários | Mecanismo existente e trabalho desta rodada | Critério de conclusão / limite |
| --- | --- | --- | --- |
| Desempenho por conteúdo | Questão, resultado avaliável, vínculo ao tópico, disciplina, origem | `build_learning_profile`; filtro de resultado e estado do gabarito, contagens de exclusão e ausências | Denominadores explícitos, proporções com incerteza; nenhuma questão anulada convertida em evidência de erro ou acerto. Taxa observada não é domínio conceitual comprovado. |
| Proveniência pessoal | `origin_type`, manifesto e validação, identificadores de eventos | `adapt_operational_attempts`, `verify_data_provenance`, guarda adicional do perfil | Atributo de proveniência obsoleto não autoriza perfil pessoal se houver origem de teste/desconhecida. Fixture continua identificada como diagnóstico sintético. |
| Histórico temporal real | `event_id`, `session_id`, `occurred_at` e origem exportados pelo Java | Adaptador e pipeline passam a preservar os campos em vez de substituí-los | Datas/identidades reais preservadas; ausência explícita em CSV legado; não fabricar sessão ou histórico para permitir análise. |
| Memória do item | Revisões e resultados elegíveis; estado FSRS e versão de referência | FSRS permanece autoridade operacional; `fit_empirical_decay_model` é exploratório | Falta de dados não gera coeficientes padrão fingidos; ajuste exploratório não agenda revisão nem substitui FSRS. |
| Retenção observada | Repetições identificadas, intervalos, resultado após intervalo, ajuda recebida | `classify_attempt_history`, `calculate_retention_metrics` | Preservar cardinalidade dos eventos e separar tópicos homônimos entre disciplinas; ausência de pares não equivale a 0% de retenção. |
| Novidade e transferência | Identidade conceitual, questão inédita/variante/repetida, exposição anterior e tarefa posterior | Perfil distingue exposição e diferença entre repetição e primeira tentativa | Diferença de acerto entre grupos não comprova transferência. Necessária avaliação inédita adequada ao mesmo conceito e posterior à aprendizagem. |
| Confiança e calibração | Confiança antes do feedback, resultado e escala declarada | Métricas existentes Brier/ECE e contagens por nível | Mapeamento 1–5 para probabilidades é convenção/proxy; não probabilidade individual comprovada. Amostra e ausências acompanham o resultado. |
| Diagnóstico dos erros | Causa relatada, confiança, tempo contextualizado, item e evidências anteriores | Perfil/sinais analíticos existentes; causas continuam relatos | Erro com alta confiança ou recuperação inesperada abre investigação, não confirma incompreensão. Causa desconhecida permanece desconhecida. |
| Intervenção e eficácia | Intervenção identificada, condições, exposição, avaliação tardia/inédita e comparação | `evaluate_intervention_recommendations` e especificação N-of-1 existentes | Acerto imediato/conclusão não comprovam eficácia. Comparação sem controle contemporâneo não identifica efeito causal. |
| Decisão diária | Estado confiável, prioridades do edital, prova, duração e preferências | JSON assíncrono; backend decide e executa | R não inventa orçamento/atraso para ativar redistribuição. Pesos de memória não validados permanecem não aplicáveis. |
| Início sem dados | Qualidade/cobertura do catálogo e zero tentativas | Estados `NO_DATA`/cold start existentes, saída explícita | Pedir evidência diagnóstica adequada sem penalizar ausência de dados. Não criar perfil pessoal ou curva fictícia. |
| Rastreabilidade | Entrada, execução identificada, versão e estado de publicação | Pipeline e contrato de artefatos | Saída deve distinguir a execução corrente e dados sintéticos; não reutilizar silenciosamente avaliação antiga como atual. |

## Sequência e responsáveis reais

1. `r_profile_win`: perfil avaliável, proveniência pessoal e limites de transferência; arquivos de perfil e seus testes.
2. `r_memory_win`: classificação com identidade consistente, ajuste exploratório sem parâmetros inventados e bloqueio de previsão/pesos não validados; retenção e seus testes.
3. `r_pipeline_win`: preservação do CSV operacional, validação e integração/exportação dos resultados; adaptador, pipeline e testes específicos.
4. `r_qa_win`: regressões entre módulos e executor que falha explicitamente quando falta um teste ou sua execução dá erro.
5. `r_docs_win`: este plano, registro de validação e atualização incremental de desenvolvimento. O orquestrador integra e revisa antes de publicar.

Os nomes acima descrevem agentes efetivamente iniciados nesta sessão. Arquivos compartilhados têm um único responsável. Testes usam fixtures identificadas; o R não lê nem altera bancos operacionais nesta rodada.

## Interpretação dos indicadores

Contagens e proporções descrevem o conjunto observado. Intervalos de Wilson são resumos binomiais condicionais; tentativas repetidas do mesmo item podem ser dependentes e não equivalem a igual número de evidências conceituais independentes. Os limiares operacionais de tamanho amostral não garantem precisão, validade causal ou domínio. Brier/ECE sobre o mapeamento convencionado da confiança avaliam essa convenção e devem acompanhar o denominador; especialmente em amostras pequenas, não autorizam traços de personalidade ou um diagnóstico individual definitivo.
## Contrato de memória implementado nesta rodada, sujeito à validação final

- `fit_empirical_decay_model`: `EXPLORATORY_FIT` só é permitido para ajuste numérico identificável/convergente; outros estados incluem `INSUFFICIENT_EVIDENCE`, `UNIDENTIFIABLE_MODEL` e `FIT_FAILED`. O modelo `exploratory_interval_logistic_v2` mantém `is_validated=FALSE` e `can_schedule=FALSE`; a confiança da resposta atual não entra como preditor prévio e seu coeficiente legado permanece ausente (`NA`).
- `project_critical_intervention_point`: contagens, acurácia e intervalo calculado sobre resultados observados podem ser informados; não há data crítica, curva projetada ou suposto intervalo de confiança de previsão. O retorno explicita `FSRS_REQUIRED` e `UNVALIDATED_MODEL`.
- `calculate_robin_hood_weights`: `can_apply=FALSE`, `status=UNVALIDATED_MEMORY_MODEL`, mapa de pesos vazio e nenhuma lista de doadores, tópicos críticos ou disciplinas hiperconsolidadas baseada na curva exploratória. Orçamento e atraso não observados não são preenchidos com valores fictícios.

Esses estados impedem que um ajuste exploratório seja apresentado como uma curva individual comprovada. Não significam abandono da análise: as observações por intervalo continuam disponíveis e a calibração futura requer validação temporal e comparação com o modelo de referência.
## Onda 0 — bloqueio de inferências cognitivas não validadas

Incremento de proteção preparado na branch `fix/wave0-cognitive-action-gates` a partir da `main` em `db8bf3d`:

- `AdaptiveReviewDecisionEngine.evaluateDecisions` retorna `BLOCKED_UNVALIDATED_MODEL`, `canApply=false` e nenhuma decisão executável; o endpoint não consulta o modelo determinístico BKT/exponencial. Revisões FSRS continuam no calendário canônico.
- `handleReviewFailure` registra contexto relatado em evento append-only e devolve somente candidato de investigação. Não infere causa, não atribui domínio/estabilidade, não agenda revisão e não preenche ausência com zero ou defaults.
- Testes de regressão foram atualizados para cobrir o bloqueio, causas não resolvidas e valores ausentes. **Os testes ainda não foram executados nesta sessão**; validar em checkout com Maven/CI antes de aprovar integração.

Este incremento não neutraliza ainda a apresentação/uso dos modelos legados em `StudentKnowledgeStateService`, `UnifiedCognitiveArchitectureService` (endpoint direto), `DigitalTwinService` e seus consumidores de interface/planejamento. Esses caminhos permanecem achados Onda 0 pendentes; não tratar o bloqueio desta API como correção global da arquitetura cognitiva.

## Lacunas que exigem próxima etapa

- Propagar recuperabilidade FSRS prevista **antes** da resposta e o estado do item (estabilidade, dificuldade e última revisão) em exportação versionada, com contrato a validar, para medir erros esperados/inesperados sem vazamento temporal. Registrar também novidade/exposição, ajuda recebida e dificuldade contextual do item; não inferir esses dados ausentes a partir do resultado atual.
- Validar estimativas em janelas futuras separadas do ajuste, comparando baseline simples; Brier/log loss/calibração avaliam previsão, não compreensão.
- Confirmar classificação questão–tópico, sua proveniência/qualidade e identidade de variantes antes de inferir conhecimento por conceito ou pré-requisitos. Histórico observado limita-se às tentativas registradas, não a todas as exposições anteriores do estudante.
- Registrar a decisão/intervenção com instante, contexto e desfecho tardio em item repetido ou inédito; quando a pergunta for causal, estabelecer comparação/controle apropriado. Acumular histórico pessoal suficiente antes de calibrar curvas por disciplina. Essas necessidades não definem novas colunas de CSV como contrato implementado nesta rodada.
- Auditar consumidores do backend e homologar aplicação efetiva dos estados/limitações. O sidecar de proveniência associado ao CSV do Bridge Java continua pendente de entrega/validação no backend, mesmo que o R aceite pacotes manuais com manifesto. Produzir JSON válido não prova integração automática com o plano de estudos nem benefício ao estudante.
- Usar sono, fadiga e preferências apenas quando dados e consentimento forem adequados; não inferir traços clínicos ou eficácia de um método por preferência declarada.

## Fundamentação e alcance

Pan, S. C.; Rickard, T. C. (2018), *Transfer of test-enhanced learning: Meta-analytic review and synthesis*, Psychological Bulletin 144(7), 710–756. DOI: [10.1037/bul0000151](https://doi.org/10.1037/bul0000151), [registro PubMed](https://pubmed.ncbi.nlm.nih.gov/29733621/). A meta-análise encontra transferência dependente de características das tarefas e da prática; isso sustenta exigir avaliação apropriada, não rotular automaticamente um acerto inédito como generalização. A evidência agregada não valida o FiscalStudy individualmente.

[Documentação oficial FSRS — The Algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm), consultada em 26/10/2026: o modelo estima estados de memória, incluindo dificuldade, estabilidade e recuperabilidade. A decisão arquitetural desta rodada é preservar essa responsabilidade no FSRS e manter análises pedagógicas externas. Nenhuma equação FSRS é modificada pelo trabalho R.

O status factual de implementação e os comandos/resultados encontram-se em [LEARNER_MODEL_VALIDATION.md](LEARNER_MODEL_VALIDATION.md). Teste automatizado valida comportamento de software; não é validação empírica de aprendizagem.
