# Incremento 2 — comparação temporal e integridade

Base: main f77b3a4a3faa3a9beecbc231be2eedbdc2790196, após merge dos PRs #25 e #26. Branch experiment/learner-baseline-comparison. Sem alteração do banco, FSRS, Java ou autoridade decisória.

## Hipótese e critérios antes dos novos resultados

Comparar MOVING_AVERAGE_5 e PYBKT_FROZEN_WARMUP à GLOBAL_HISTORICAL_MEAN. Alvo: acerto objetivo sem ajuda em evento futuro, não conhecimento latente nem recordação livre. Novas sementes de avaliação: 401,431,461,491,521. Semente 13 reservada ao smoke test técnico. Nenhum parâmetro será selecionado pelos resultados de avaliação.

Mesmos eventos, mesma elegibilidade e mesma regra de warmup (dez respostas elegíveis). Comparações são pareadas por evento e seed. Reportar cobertura dos dois modelos e interseção; cobertura incompleta impede classificação de superioridade. Critério conjunto: limites superiores dos intervalos bootstrap para diferenças de Brier E log loss menores que zero; conclusões restritas ao simulador. Cinco seeds é convenção do protocolo, não garantia de potência. Nenhuma decisão operacional resulta deste teste.

## Modelos executáveis

- Média global e média por tópico: funções reais de R/baselines.R.
- Média móvel: calculate_baseline_moving_average existente, janela de cinco observações anteriores, sem ajustar janela pelos resultados. Extensão somente no laboratório.
- pyBKT 1.4.3: biblioteca externa real e opcional, MIT, distribuição PyPI. A referência GitHub auditada anteriormente é outra revisão; não presumir equivalência byte a byte. Sem reimplementação aproximada ou fallback.
- pyBKT ajusta três inicializações, seed 709, parallel=False e forgets=False no prefixo inicial individual. Parâmetros ficam congelados; apenas o histórico de estados avança. R usa janela expansiva: essa diferença é explícita e impede chamar o experimento de comparação equivalente de treinamento.
- Predição pyBKT recebe o prefixo estritamente anterior e uma consulta com resultado fictício constante 0, sem receber o resultado verdadeiro do alvo. Testes de perturbação verificam a previsão antes do resultado. A consulta é entrada técnica do algoritmo, nunca evento persistido ou evidência observada.
- Habilidade ausente no treino não recebe a previsão default 0,5 da biblioteca. Retorna indisponibilidade contabilizada.
- Apenas dez respostas para múltiplas habilidades não identificam bem os parâmetros BKT. Resultados são baseline exploratório, não estimação confiável de traços pessoais.
- BKT sem esquecimento não representa tempo de calendário; seu estado não é uma curva FSRS nem agendamento.
- Modelos externos ausentes ou execução inválida produzem erro explícito. Sem instalação automática pelo runner.

## Instalação e isolamento

requirements-lab.txt contém dependências diretas com versões fixadas. Instalar em ambiente virtual ou diretório target exclusivo. Não incluir dependências no Git nem substituir o Python do produto. Em Windows restrito, utilizar TEMP e TMP dentro do workspace se o temporário padrão for inacessível. A primeira tentativa desta entrega falhou por permissão no temporário padrão; a alternativa é confinada, sem elevação.

Executar a partir de analytics-engine:

    python -m unittest discover -s lab -p "test_*.py" -v
    python lab/run_experiment.py --with-pybkt --seeds 401,431,461,491,521 --output tests/fixtures/learner_lab/run-comparison
    python lab/audit_run.py tests/fixtures/learner_lab/run-comparison

Sem --with-pybkt, executa somente o R e referências fixas. Dependências externas não afetam o fluxo básico.

Cada execução preserva manifesto, hashes, origem sintética, status e parâmetros exploratórios do modelo externo. O verificador é somente leitura. Hash consistente detecta divergência interna, não autentica autoria nem valida inferência científica.

## Quatro dimensões e gates restantes

| Dimensão | Entrega deste incremento | Não demonstrado |
|---|---|---|
| Knowledge Twin | Previsões futuras comparáveis, exposição e intervalo registrados | Domínio conceitual, compreensão e transferência |
| Memory Twin | Diagnóstico de desempenho por intervalo observado | Estimador individual, política FSRS e curva calibrada |
| Learning Twin | Gerador independente e variação entre perfis | Eficácia causal de atividades para pessoas |
| Decision Intelligence | Cobertura e incerteza limitam conclusões | Escolha adaptativa eficaz ou can_apply |

O FSRS segue única autoridade operacional. A conversão de resposta objetiva em rating de recordação exige contrato justificado antes de comparar políticas FSRS e fixas. Não fabricar um agendador R para preencher essa lacuna.

Depois deste gate: avaliações tardias e identificabilidade; política de revisão comparável e teste de intervenções; amostras públicas autorizadas e inspeção real dos dados; integração Spring/SQLite isolada; validação prospectiva pessoal. Acesso a dados públicos não equivale a autorização para redistribuição. Nenhum desses gates pode ser declarado aprovado pelos testes sintéticos deste incremento.

## Falhas observadas e correções de integridade

A instalação opcional foi efetivamente realizada em diretórios isolados. A combinação inicial pyBKT 1.4.3 / scikit-learn 1.9.1 falhou na descoberta de métricas durante importação. A versão 1.6.1 do scikit-learn permite a execução real; nenhum código da biblioteca foi alterado.

O primeiro ensaio ampliado falhou na seed 431 porque a biblioteca produziu probabilidade não finita em um prefixo com parâmetros extremos. O adaptador agora registra NON_FINITE_FIT_UNAVAILABLE ou PARTIAL_NUMERICAL_UNAVAILABILITY, com IDs dos alvos indisponíveis, contagem e mensagens de warnings. Não recorta probabilidades inválidas, não insere 0,5 e não reajusta com dados futuros. A regra de cobertura já prevista impede declarar superioridade nesses casos. A execução interrompida permanece como FAILED; não foi sobrescrita.

Também foi detectada divergência de separadores de caminhos no verificador Windows: os manifestos antigos registravam barra invertida. Novos manifestos usam POSIX; o verificador aceita o formato legado, rejeita aliases ambíguos e verifica os mesmos arquivos. Isso é uma correção de portabilidade, não evidência científica.

O relatório agora preserva observações de perfis sem previsão (como sparse). A ausência de previsão permanece explícita. Homologação visual é independente da geração do HTML.
