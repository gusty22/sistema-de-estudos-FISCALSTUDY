# Memória — experimento de referência oficial FSRS

Branch experiment/fsrs-memory-lab, empilhada sobre experiment/learner-baseline-comparison (PR #27). Não fazer merge automático ou alegar equivalência byte a byte com Java-FSRS.

## Hipótese e limite

Avaliar a previsão de recordação do FSRS oficial e o diagnóstico R existente num gerador independente. Não converter acerto de múltipla escolha em recordação. Este experimento usa recordação binária sem chute, conhecimento adquirido fixado em 1 e hipóteses de esquecimento controladas. Isso isola memória no simulador; não demonstra compreensão humana.

Referência: py-fsrs 6.3.2, release v6.3.2, commit upstream 9446cb06605c597a063aeee49f7d188d42e34dc2, MIT. O algoritmo FSRS-6 usa os 21 parâmetros oficiais fornecidos pela biblioteca, sem otimização pessoal ou reimplementação das equações. learning_steps e relearning_steps vazios; fuzzing desligado para reprodutibilidade. Datas e IDs fornecidos explicitamente; sem relógio atual.

A equivalência com a implementação Java do produto não é presumida nem homologada por estes testes.

## Protocolo registrado antes dos resultados

Seeds 601,631,661,691,721. Quatro combinações de meia-vida hipotética inicial (1,5/18 dias) e função (exponencial/potência), oito itens por estudante sintético. Avaliações nos dias 0,1,3,7,14,28,42. Depois de cada observação há reapresentação; o gerador multiplica sua meia-vida por 1,12. Esses parâmetros são hipóteses geradoras, não propriedades psicológicas do estudante.

O dia zero é aprendizado inicial padronizado bem-sucedido, conhecido por construção. O FSRS ainda não possui estado anterior: não usar seu retorno default 0 como previsão científica. Exportar COLD_START_NO_PREVIOUS_REVIEW, sem recuperabilidade. Previsões posteriores são coletadas antes de gerar/observar o resultado. Recall observado mapeia para Good; falha observada para Again, convenção restrita a este laboratório, sem fabricar julgamentos Hard/Easy.

Comparador principal: taxa histórica por estudante suavizada Beta(1,1), atualizada somente depois de todo o batch temporal. Comparador secundário: constante 0,5. Mesmos alvos e calendário para todos. Desempenho: Brier, log loss, confiabilidade descritiva e RMSE contra probabilidade verdadeira; diferenças e bootstrap por seed. Superioridade exige ambos os limites superiores negativos em cinco seeds; apenas neste gerador. Não usar um único p-valor ou AUC como aprovação do produto.

Não há comparação de políticas, otimização de parâmetros, teste humano ou efeito causal. O calendário é fixo, não comandado pelas datas propostas pelo FSRS.

## Fluxo e isolamento

memory_simulator.py não importa FSRS nem R: usa a hipótese geradora independente. FSRSReference recebe somente IDs, instantes e resultados observados. O R recebe observações e previsões oficiais por CSV, nunca h verdadeiro ou recuperabilidade verdadeira. truth.json somente é persistido após o processo R terminar.

memory_adapter.R chama calculate_retrieval_surprise de R/retrieval_diagnostics.R existente. Sem alterar o módulo ou as equações FSRS. Exige SHA-256, contagem, origem sintética, schema exato, identidades e timestamps válidos. Compara Brier/log loss R versus cálculo Python independente, com tolerância numérica declarada de 1e-10.

Caminhos confinados a tests/fixtures/learner_lab; recusa sobrescrever execução. Nenhum SQLite, Java, Anki ou serviço externo é iniciado. can_apply e can_schedule permanecem false. Modelos externos são referências experimentais, não autoridades operacionais adicionais.

## Contrato memory_lab_events_v1

| Campo | Natureza / unidade | Regra e uso |
|---|---|---|
| event_id, student_id, question_id | Identidades pseudonimizadas | Não vazias; evento único; sem perfil codificado |
| occurred_at | Observação; ISO-8601 com timezone | Tempo do teste de recordação |
| origin_type | Procedência | Somente SYNTHETIC_BENCHMARK |
| gabarito_status, is_correct | Resultado observado binário | DEFINITIVO e true/false; recordação experimental |
| fsrs_model_version | Procedência de modelo | Identifica biblioteca/referência; não implica calibração |
| fsrs_prediction_timestamp | Instante da estimativa | Anterior ou igual ao evento; captura antes do resultado |
| fsrs_evidence_status | Estado do modelo | UNCALIBRATED_ITEM_ESTIMATE ou COLD_START_NO_PREVIOUS_REVIEW |
| fsrs_retrievability_pre_update | Estimativa oficial [0,1] | Ausente no cold start; nunca igualar a domínio |
| fsrs_stability_pre_update | Estimativa oficial; dias | Ausente no cold start; não é meia-vida verdadeira do gerador |
| fsrs_difficulty_pre_update | Estimativa oficial; escala FSRS | Ausente no cold start; não é dificuldade conceitual medida |

O contrato é apenas de fixtures experimentais e não adiciona campos ao banco de produção. Conhecimento=1, meia-vida e probabilidade verdadeiras são estados latentes conhecidos apenas no gerador. Ausência é vazia/NA, não zero inventado.

## Executar

    python -m pip install -r lab/requirements-memory-lab.txt
    python -m unittest discover -s lab -p "test_*.py" -v
    python lab/memory_benchmark.py --output tests/fixtures/learner_lab/run-memory
    python -c "import sys;sys.path.insert(0,'lab');from memory_benchmark import audit_memory;print(audit_memory('tests/fixtures/learner_lab/run-memory')))"

Requer R/jsonlite/digest existentes, como o restante do laboratório. O runner não instala dependências. Manifesto registra versão, parâmetros FSRS, hashes de código/pacote, entrada e artefatos; isso garante consistência interna, não assinatura ou validade científica.

Saídas: criteria.json, observations.csv, input-manifest.json, r-diagnostics.json (inclui diagnósticos por estudante), truth.json, summary.json, manifest.json. Falhas não se convertem em sucesso. Investigações R são candidatas, jamais diagnósticos causais.

## Critérios técnicos e pendências

Validar determinismo, cold start, exclusão da verdade latente, tempo pré-atualização, batches, igualdade dos escores R/Python, integridade e replay. CI deve executar e preservar os dados sintéticos antes de relatar métricas.

Permanecem separados: otimização pessoal, comparação de políticas com orçamento equivalente, identificação de aquisição versus esquecimento, dados públicos licenciados, validação pessoal prospectiva, integração Java e homologação visual. Um FSRS bem-sucedido no gerador não demonstra eficácia pessoal.

## Resultado efetivamente executado

[CI 40432790113](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40432790113), commit f9849b29f7d3184fbda3adf7e7307e29bef26d96: todos os gates passaram. 30 testes do laboratório, sem skips ou falhas; 600 verificações R, zero falhas. Os oito arquivos de memória foram reproduzidos byte a byte. A regressão do laboratório de questões também passou, com 50 arquivos reproduzidos.

Foram gerados 1120 eventos de recordação: 160 estados iniciais sem previsão e 960 alvos maduros avaliados. Escores R/Python concordaram pela tolerância 1e-10.

| Modelo | N | Brier | Log loss | RMSE contra R verdadeiro do gerador |
|---|---:|---:|---:|---:|
| FSRS oficial, parâmetros padrão | 960 | 0,275057 | 0,870704 | 0,357872 |
| Histórico Beta(1,1) | 960 | 0,217010 | 0,642642 | 0,270352 |
| Constante 0,5 | 960 | 0,250000 | 0,693147 | 0,321427 |

Diferença pareada FSRS menos histórico: intervalo por seed Brier [0,051405;0,064690] e log loss [0,202051;0,255214]. Não foi estabelecida superioridade; neste desenho ambos os escores foram piores. Viés médio previsto menos observado do FSRS: +0,270110. Isso evidencia incompatibilidade/calibração insuficiente para esta população gerada e seus intervalos, não uma conclusão universal sobre o FSRS nem sobre o estudante real.

Não alterar os parâmetros padrão para vencer estas seeds ou substituir a fórmula oficial. Um novo protocolo de otimização/calibração deve separar treino, escolha e teste antes de avaliar benefícios individuais. Não comparar estabilidade FSRS (R=0,9) diretamente com meia-vida geradora (R=0,5): são quantidades diferentes.

Bins de confiabilidade e seus intervalos de Wilson são descritivos; tentativas repetidas não são independentes. O bootstrap usa cinco seeds e é condicionado ao gerador, não à população humana. Não foram otimizados parâmetros, comparadas políticas, medido efeito pedagógico ou estimada compreensão.

Resultado compacto permanente: tests/fixtures/learner_lab/memory_reference_result.json. Artefato de CI 12702842479, SHA-256 120ac8183467e550d50f3b7b05d497c7b2913a9cf10300f46392243cef46b1ee, disponível até 03/11/2026. Os comandos acima reproduzem os dados; o hash do artefato não é assinatura científica.

Próxima etapa: desenho de calibração temporal e identificabilidade antes de comparar políticas. Os quatro perfis são condições geradoras conhecidas, não uma personalidade atribuída ao estudante. Este resultado não modifica o planejador, os modelos operacionais ou os controles de autoridade.


## Incremento experimental: calibração individual e identificabilidade

**Protocolo registrado antes de executar as seeds 811,839,863,887,911.** O gerador de memória e a implementação oficial FSRS permanecem inalterados. Esta avaliação não otimiza os parâmetros FSRS, não calcula outra curva operacional e não habilita o planejador.

### Perguntas e métodos

1. Um ajuste individual da probabilidade prevista melhora previsões futuras em relação a um ajuste global?
2. Históricos imediatos idênticos permitem identificar diferenças de retenção? Quanto avaliações tardias em itens distintos ajudam?

O primeiro experimento reaproveita generate_memory, FSRSReference e o diagnóstico R existente. O R experimental recebe somente observações. A partir de seis lotes maduros por estudante, os três primeiros são treino (dias 1,3,7), o quarto é seleção (dia 14) e os dois últimos são teste (dias 28,42). Lotes com mesmo timestamp permanecem juntos. Janelas globais sobrepostas são rejeitadas; históricos mais curtos retornam insuficiência.

A hipótese de calibração é logit(p_cal)=logit(p_FSRS)+a. O intercepto global minimiza a soma de log losses mais a²/2. Interceptos individuais minimizam essa soma mais lambda*(a_i-a_global)²/2. lambda pertence a {1,4,16}, escolhido pela menor log loss de validação, sem refazer ajuste sobre validação ou teste. Penalidades são hipóteses numéricas experimentais, não propriedades psicológicas. Otimização unidimensional limitada a [-12,12]; o logit de entrada usa guarda 1e-6 e os escores usam guarda 1e-15, como o avaliador Python existente. Não há estimativa de incerteza dos coeficientes; isso consta como NOT_ESTIMATED.

Comparadores no mesmo conjunto futuro: FSRS oficial sem ajustes, intercepto global, interceptos individuais com encolhimento e médias Beta(1,1) global e por estudante congeladas do treino. Brier, log loss, confiabilidade, viés e RMSE contra a probabilidade verdadeira são calculados fora do ajuste. A alegação de melhora exige limites superiores negativos para diferenças de Brier E log loss no bootstrap pareado por seed, com pelo menos cinco seeds. A comparação primária é individual versus global: melhorar só contra o FSRS padrão não demonstra ganho individual.

Os intervalos reamostram seeds, não tratam eventos repetidos como independentes. Cinco seeds não garantem precisão; intervalos de bins de confiabilidade são descritivos. Diferenças entre as duas formas de esquecimento e entre intervalos não demonstram generalização humana.

### Gerador independente de sondagens

identifiability_simulator.py não importa R, FSRS nem o calibrador. Reutiliza somente as hipóteses geradoras já declaradas em simulator.forgetting. Para cada forma exponencial/potência e intervalo de 1,7,28 dias, quatro pares por seed recebem aquisição conhecida=1, half-lives geradoras 1,5/18 dias, 64 itens distintos e resultados imediatos idênticos. Cada item tem somente UMA sondagem tardia; não há revisão entre as avaliações. Os intervalos usam estudantes/coortes diferentes, sem fingir que o teste anterior não alterou a aprendizagem. Papéis e pseudônimos são embaralhados; parâmetros e pares verdadeiros nunca entram no R.

O R produz taxas observadas e intervalos Wilson95 existentes em prefixos de 2,8,32,64 itens por fase. O avaliador externo mede separação correta e separação errada contra a verdade oculta, por forma, intervalo e tamanho da amostra, com bootstrap de seeds. O critério de detecção é não sobreposição dos intervalos com ordenação correta. Históricos imediatos devem permanecer indistinguíveis. Esta é uma análise de identificabilidade da probabilidade observada nas condições do simulador, NÃO uma estimação de half-life, domínio, causa do erro ou conhecimento versus esquecimento. O diagnóstico expõe explicitamente essas limitações.

### Integridade, execução e autoridade

    python lab/calibration_experiment.py --output tests/fixtures/learner_lab/run-calibration

O diretório deve ser novo e confinado às fixtures. criteria.json precede os dados. Dois processos R reais terminam antes de truth.json e probe-truth.json serem persistidos. O adapter valida schemas fechados, origem, IDs, timestamps, resultados e hashes do snapshot. Testes perturbam os resultados de teste para comprovar invariância dos ajustes/predições, invertem a ordem das linhas, exercitam cold start, probabilidades extremas e rejeitam colunas latentes, duplicatas, origem real e previsões posteriores.

manifest.json registra hashes de fontes e artefatos, versões e can_apply=false/can_schedule=false. audit() confere a integridade em leitura; checksum não autentica veracidade. O replay compara todos os artefatos byte a byte.

**Estado inicial deste incremento:** implementação sujeita aos gates da PR. Resultados pessoais, dados públicos, benefício causal das revisões e intervenções, autoridade Java e equivalência com Java-FSRS continuam NOT_EXECUTED. Resultados sintéticos observados devem ser acrescentados somente depois da execução.
