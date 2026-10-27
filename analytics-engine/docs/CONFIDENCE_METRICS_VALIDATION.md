# Contrato estatístico de confiança ordinal

Branch fix/r-ordinal-confidence-contract, PR #30, empilhada sobre #27. Independente dos experimentos de memória do #28 e da correção textual do #29.

## Achados verificados

- calculate_confidence_metrics truncava níveis fracionários para inteiros, aceitando 4,9 como 4.
- Mapeamentos inválidos podiam retornar ao padrão silenciosamente ou gerar NA sem erro explícito.
- Ausência de respostas na faixa máxima/baixa retornava taxa zero, confundindo falta de evidência com taxa medida.
- O CSV/JSON exportava a taxa condicional de erro em nível 5 com o denominador total de respostas confiantes.
- Metadados da hipótese de conversão não eram preservados no pacote/perfil. A limitação textual falava em detectar ilusões de competência sem evidência causal.

## Correção e compatibilidade

Validar níveis inteiros 1..5 e resultados avaliáveis, reutilizando select_evaluable_attempts no fluxo canônico. A compatibilidade standalone usa as mesmas regras binárias e de gabaritos bloqueados. Registros excluídos são contabilizados; não se atribui nível por truncamento.

Mapeamentos personalizados devem ser numéricos, nomeados por 1..5, finitos, em [0,1] e preservar a ordem ordinal. O padrão legado permanece uma hipótese técnica. Mapeamentos inválidos falham explicitamente; não há substituição silenciosa.

Taxas usam denominadores próprios: n_level5 e n_low_confidence. Sem observações na faixa, contagem conhecida zero e taxa NA. O Brier e o ECE usam somente pares válidos de confiança/resultado. O ECE agrega proporções empíricas sem arredondamento intermediário.

Nomes legados de métricas e tipos permanecem; aliases vazios e não vazios são consistentes. Os novos campos são aditivos. O envelope mantém contrato principal 1.0.0 e identifica confidence_metrics_version=1.1.0-ordinal-mapping. O campo n_observations da taxa condicional agora expressa seu denominador real.

O perfil e o pacote preservam measurement_scale=ORDINAL_1_TO_5, probability_mapping_validated=false, confidence_timing_status=NOT_ESTABLISHED e a hipótese utilizada. Não reconstruir retrospectivamente o instante da confiança nem apresentar essas métricas como previsões probabilísticas pessoais validadas.

## Consumidores revisados

build_learning_profile preserva os novos metadados. detect_analytical_signals verifica as contagens antes de usar as taxas condicionais, de modo que a ausência da faixa não cria um sinal. AnalyticsBridgeService lê o pacote com readTree; o DTO de pesos não foi modificado. Não houve teste Java/E2E ou homologação visual neste incremento; a revisão estática não os substitui.

Nenhuma fórmula de memória, estado FSRS, personalidade, domínio latente ou autoridade decisória foi criada.

## Evidências executadas

[CI 40437888763](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40437888763), commit 68dea9037e34bc2b36b3f9599aec1149ed20871e: sucesso; 23 testes do laboratório, 626 verificações R, zero falhas. O experimento de cinco seeds e o replay de 50 arquivos passaram.

Casos testados: vetor independente Brier 0,6 / ECE 0,7333 para três observações; denominadores condicionais 1/1; nível fracionário, ausente e fora da faixa; gabarito anulado; cinco classes de mapeamento inválido; sensibilidade ao mapeamento alternativo; ausência da faixa como NA; propagação de hipótese no perfil/pacote e denominador na integração do pipeline.

A antiga asserção do pipeline assumia o mesmo denominador para todas as métricas. Foi corrigida para exigir exatamente dois eventos avaliáveis nas métricas globais e um evento na taxa condicional de nível 5 daquela fixture.

## Limitações e recuperação

Confiança ordinal não é probabilidade contínua declarada. Os escores dependem do mapeamento assumido; não são prova de calibração, personalidade ou falsa aprendizagem. Intervalos binomiais são descritivos com repetições dependentes. A origem real/sintética continua governada pelos contratos existentes, sem reclassificação histórica.

Mudança somente de código e testes; nenhum banco, evento ou arquivo do estudante foi alterado. Reverter o commit restaura a implementação anterior sem migração de dados, mas também restaura os defeitos descritos. Integrar depois de #27 e revisar junto da correção UTF-8 #29, preservando as duas adições de testes; não fazer merge automático.
