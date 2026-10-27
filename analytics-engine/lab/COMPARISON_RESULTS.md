# Incremento 2 — evidências, falhas e bloqueios

## Estado e alcance

Continuação da main f77b3a4a3faa3a9beecbc231be2eedbdc2790196, após merge dos PRs #25 e #26. Código do incremento preservado no commit 48196a180d689ac4fb33b81c24ad6258f8d98f20. Novas alterações limitadas ao laboratório, documentação e CI. Nenhum banco operacional, serviço Java, estado FSRS ou regra de autoridade foi modificado.

Isto não conclui um Cognitive Digital Twin validado. Resultados abaixo são sintéticos ou testes técnicos; não demonstram eficácia pessoal.

## Evidências efetivamente recuperadas

| Verificação | Resultado observado | Limite |
|---|---|---|
| Fontes R locais versus main | 14 blobs R idênticos | Verificação de código, não validação científica |
| Suíte R reexecutada | 574 passaram; 0 falhas; 161,310 s | Sem homologação Spring/SQLite |
| Suíte intermediária com pyBKT real | 20 testes passaram; 121,332 s | Anterior às últimas alterações e dois testes adicionais |
| Suíte final ampliada | Iniciada; saída final não recuperada | PENDING_ENVIRONMENT; não declarar 22 aprovados |
| Smoke real R + pyBKT, seed 13 | 204 eventos; 71 alvos; 426 escores | Uma seed; todos os contrastes INCONCLUSIVO |
| Auditoria de integridade do smoke | PASSED_INTEGRITY_ONLY; 13 artefatos | Hash não é assinatura nem validade científica |
| Ensaio ampliado inicial | FAILED na seed 431 | Probabilidade não finita da biblioteca, sem substituição |
| Ensaio corrigido com cinco seeds | Processo terminou com código 0 | Métricas e artefatos finais ainda não recuperados/verificados |
| Replay ampliado | NOT_EXECUTED | Ambiente indisponível antes de criar o processo |
| Validação visual do HTML | NOT_EXECUTED | Geração e teste estrutural não são homologação visual |
| Java / integração operacional | NOT_EXECUTED neste incremento | Java não foi alterado |
| CI remota | PENDENTE | Consultar execução vinculada ao PR; este texto não implica aprovação |

No smoke, diferença pyBKT menos média global: Brier +0,048370; log loss +3,642219. Para média móvel: Brier +0,026523; log loss +0,968746. Há cobertura igual de 71 eventos nesse smoke. Esses números não estabelecem superioridade ou inferioridade geral: são uma única realização, com ajuste BKT inicial pequeno e vulnerável a probabilidades extremas. Não usar a métrica de treino como validação.

A execução ampliada usa seeds 401,431,461,491,521 e 48 interações por perfil (o perfil sparse permanece com seis). Nenhuma tabela de métricas ampliadas é publicada aqui sem recuperar os arquivos. O código de saída 0 não substitui a auditoria dos resultados.

## Problemas encontrados e tratados

1. Temporário padrão do Windows sem permissão: instalação redirecionada para o workspace e dependências isoladas. Sem instalação global ou elevação.
2. pyBKT 1.4.3 com scikit-learn 1.9.1: AttributeError durante descoberta de métricas. scikit-learn 1.6.1 testado com chamadas reais; versão fixada e incompatibilidade documentada. Código da biblioteca não foi alterado.
3. Parâmetros/predições BKT não finitos em prefixos curtos: indisponibilidade explícita com IDs e warnings. Sem recorte artificial, fallback 0,5 ou reajuste usando dados posteriores. A comparação exige cobertura completa para declarar superioridade.
4. Caminhos de artefatos Windows: novos manifestos usam POSIX e o auditor reconhece separadores legados, rejeitando aliases ambíguos.
5. Perfis sem previsão ausentes do relatório: histórico observado completo agora é transportado para o HTML depois do término dos modelos. Verificação final/visual permanece pendente.
6. Ambiente de execução desconectado: fontes foram preservadas no GitHub; resultados locais não são presumidos recuperáveis. Nova CI deve reexecutar os gates e arquivar artefatos.

## Capacidades entregues e não entregues

| Dimensão | Implementado | Ainda pendente |
|---|---|---|
| Knowledge Twin | Baselines R e pyBKT comparáveis, avaliação temporal, auditoria de cobertura | Melhor previsão demonstrada, compreensão e transferência |
| Memory Twin | Estratos descritivos por intervalo registrado | Comparação oficial FSRS, identificação individual e calibração tardia |
| Learning Twin | Perfis quantitativos e histórico sintético independente | Eficácia causal e validação pessoal |
| Decision Intelligence | Abstenção e bloqueio de conclusões com cobertura incompleta | Política adaptativa empiricamente avaliada |

pyBKT não modela tempo de calendário neste protocolo. Parâmetros estimados não são traços pessoais validados. A média móvel não é equação de esquecimento. Nenhuma saída habilita can_apply ou can_schedule.

## Próxima sequência e critérios

1. CI: recuperar 22 testes do laboratório, 574 verificações R, cinco seeds, auditoria e replay; se falhar, corrigir a causa e repetir, sem promover resultados antigos.
2. Revisar cobertura e falhas numéricas do pyBKT antes de discutir modelos complexos; parâmetros individuais com dez respostas não estão identificados adequadamente.
3. Definir experimento de recordação tardia com rating legítimo e referência FSRS oficial, separando acerto objetivo de recordação.
4. Comparar políticas sob orçamento e avaliações posteriores equivalentes; nunca transformar associação em eficácia causal.
5. Amostras públicas somente após confirmar acesso/licença e mapear dados reais; modelos adicionais somente com hipótese e baselines adequados.
6. Validar integração Java/R em ambiente isolado; dados pessoais e autoridade decisória dependem de critérios próprios.

Não fazer merge automático. A indisponibilidade local foi contornada pela CI abaixo; validação científica pessoal e homologação visual continuam pendentes.

## Homologação técnica remota recuperada

Execução [40430980241](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40430980241), commit dfed9359010f93ad68853bfa20522fe29ae2a361: SUCESSO. A tabela anterior preserva o estado durante a desconexão local; esta seção a atualiza com evidência remota efetivamente recuperada.

- 23 testes do laboratório passaram, sem skips ou falhas, em 4,921 s.
- 600 verificações R passaram, zero falhas, em 9,387 s. O total local anterior de 574 não substitui essa execução do checkout completo; contagens dependem de fixtures/provedores disponíveis e não são número de capacidades científicas independentes.
- Cinco seeds: 2670 eventos gerados, 1904 alvos avaliáveis futuros. Cada alvo recebe previsões de vários modelos; não contar escores como observações independentes.
- Auditoria de 49 artefatos passou nas duas execuções; 50 arquivos, incluindo manifestos, foram comparados byte a byte, zero diferenças.
- SHA-256 do manifesto: 07af6256fe87a9cb9a1f0ddfb44c26e38c31bdf842a09a8bb53371ca63b0e9ba.
- Artefato 12701638935 (2.278.542 bytes), SHA-256 794805f19b5c0ca2d01ce1cbd2b1ca4d8648a9a15dd768b7d35d1e63dba38a82, retenção até 03/11/2026. Resultado compacto permanente em tests/fixtures/learner_lab/baseline_reference_result.json.

| Modelo | N de previsões | Brier | Log loss |
|---|---:|---:|---:|
| Fixo 0,20 | 1904 | 0,433277 | 1,131807 |
| Fixo 0,50 | 1904 | 0,250000 | 0,693147 |
| Média histórica global | 1904 | 0,237096 | 0,667704 |
| Média suavizada por tópico | 1904 | 0,238754 | 0,673842 |
| Média móvel de cinco | 1904 | 0,252521 | 1,784988 |
| pyBKT com warmup congelado | 1902 | 0,320949 | 4,159896 |

A linha pyBKT tem cobertura diferente: não ordenar diretamente as médias como comparação completa. Os contrastes abaixo são calculados em pares nos mesmos eventos.

- Tópico menos global: intervalo bootstrap Brier [0,000484;0,003427], log loss [0,002988;0,010099]. REPROVADO_NESTE_SIMULADOR.
- Móvel menos global: Brier [0,008273;0,022046], log loss [0,880330;1,346320]. REPROVADO_NESTE_SIMULADOR.
- pyBKT menos global, somente pares disponíveis: Brier [0,065793;0,108641], log loss [2,549907;4,226872]. Duas indisponibilidades na seed 431; critério de cobertura retorna INCONCLUSIVO e impede declarar superioridade.
- A média global supera as duas constantes pelos critérios condicionais registrados. Isso não transforma média de acertos em domínio conceitual.

Conclusão: os modelos mais específicos não mostraram ganho neste desenho. Não promover pyBKT ou média móvel à produção. Investigar suporte inicial, identificação e temporalidade com um novo protocolo antes de alterar parâmetros ou selecionar modelos. Intervalos cobrem somente a população sintética escolhida, com cinco seeds; não validam eficácia humana.

A revisão identificou e corrigiu no laboratório outra distinção: exposição prévia com ajuda continua sendo exposição. item_exposure usa prior_exposures registrado; model_history_item_exposure preserva a visão restrita às respostas elegíveis. Um teste real R verifica essa diferença.

Permanecem: comparação FSRS em atividade de recordação com rating legítimo, eficácia de políticas, dados públicos, validação pessoal, Java/Spring/SQLite e inspeção visual. O log R também contém aviso de conversão de caracteres no teste do pipeline sob locale C; testes aprovados não homologam fidelidade textual completa nessa condição. Os avisos de depreciação das Actions Node 20 foram registrados; ações executaram com Node 24. Esses avisos não foram omitidos nem usados como alegação de falha numérica do modelo.
