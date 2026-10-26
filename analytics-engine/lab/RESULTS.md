# Primeiro experimento — resultados sintéticos

Base de continuação: main d2b798684ba4708c02b3e393d39696bf77f7d517 (PR #25 integrado). Nenhuma alteração de banco, agendador ou autoridade decisória.

## Execução efetiva

Motor R real, baselines temporais existentes, R 4.5.1, jsonlite 2.0.0, Python 3.13.7. Cinco sementes de avaliação: 101, 131, 151, 181, 211. Os ensaios de desenvolvimento usaram outras sementes. Critérios gravados antes das execuções finais; a comparação forte com média global foi definida após exploração inicial, sem ajustar parâmetros dos modelos.

2670 eventos sintéticos; 1880 eventos avaliados; 7520 linhas de escores para quatro modelos. As quatro previsões do mesmo evento não são observações independentes. Cinco estudantes com histórico curto retornaram INSUFFICIENT_HISTORY, sem previsões.

| Modelo | Brier | Log loss |
|---|---:|---:|
| Constante 0,20 | 0,435106 | 1,136033 |
| Constante 0,50 | 0,250000 | 0,693147 |
| Média histórica global | 0,235850 | 0,664842 |
| Média suavizada por tópico | 0,238064 | 0,672908 |

Menor é melhor. A média global supera as duas constantes neste gerador. Isso não demonstra diagnóstico conceitual, retenção individual ou eficácia pedagógica.

Tópico menos global: intervalo bootstrap de 95% entre sementes para diferença Brier [-0,000105; 0,004068]; log loss [0,003405; 0,011544]. Pelo critério conjunto previamente gravado, resultado INCONCLUSIVO quanto à vantagem do modelo por tópico. Não promover personalização com estes resultados.

## Reprodutibilidade verificada

run-004 e run-005, mesmas sementes e fontes: 35 arquivos comparados byte a byte, zero diferenças, incluindo manifestos, previsões, resultados e relatório. As execuções estão em tests/fixtures/learner_lab, ignoradas pelo Git. O comando do README reproduz os artefatos em um diretório novo. Valores de referência não substituem uma nova execução.

11 testes do laboratório aprovados (76,517 s), incluindo chamadas reais ao R, rejeição de entradas inválidas e perturbação futura. Suíte R existente: 574 verificações, zero falhas (21,057 s). Estes resultados foram executados na etapa anterior desta mesma entrega; não são uma nova execução após o merge. Fontes do laboratório foram integradas pelo PR #25 sem novas alterações funcionais nesta entrega documental.

## Matriz de avaliação

| Capacidade | Estado | Limitação |
|---|---|---|
| Previsão temporal de acerto | Parcialmente aprovado, sintético | Dois baselines; não estima domínio latente |
| Calibração | Parcial | Brier, log loss e faixas descritivas; cinco sementes |
| Retenção individual | Inconclusivo | Motor não estima parâmetros individuais neste experimento |
| Conhecimento versus esquecimento | Inconclusivo | Sonda de equivalência observacional, não recuperação de parâmetros |
| Benefício de revisões / decisões adaptativas | Inconclusivo; NOT_EXECUTED | Sem comparação de políticas FSRS ou intervenção |
| Incerteza / histórico curto | Parcialmente aprovado | Abstenção técnica verificada; cobertura estatística não demonstrada |
| Robustez e vazamento temporal | Parcialmente aprovado | Testes sintéticos limitados ao contrato e adapter |
| Generalização | Parcial | Avaliação futura dentro de cada estudante; novos estudantes não avaliados |
| Dashboard | Parcial | HTML gerado; sem homologação visual; histórico completo no CSV |
| Dados públicos / estudantes reais | NOT_EXECUTED | Sem download, acesso autorizado ou experimento pessoal |
| pyBKT e demais modelos externos | NOT_EXECUTED | Apenas inventário e análise de requisitos |

A verdade latente somente é persistida após os subprocessos R. Essa separação é um limite de fluxo de dados revisado, não sandbox de segurança contra código malicioso. As curvas do gerador são hipóteses experimentais; não são alternativas operacionais ao FSRS.

## Próximo incremento

Adicionar baseline pyBKT isolado, com versão fixada, compatibilidade verificada e o mesmo conjunto de eventos avaliáveis. Depois estudar um desenho de avaliações tardias que identifique parâmetros confundidos. Não habilitar can_apply, pesos, agendamento ou recomendações de produção. Integração Spring/SQLite, política FSRS experimental, validação retrospectiva e eficácia pessoal permanecem pendentes.
