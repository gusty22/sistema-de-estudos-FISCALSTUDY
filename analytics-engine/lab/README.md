# FiscalStudy — laboratório sintético executável (MVP)

Este módulo avalia o Motor R real com dados sintéticos. Não é Cognitive Digital Twin validado, não é rotina de produção e não agenda estudo. Comece por AUDIT_AND_PLAN.md; fontes/licenças estão em SOURCES.md e source_inventory.json.

## Executar

Requisitos já usados nesta sessão: Python 3.13.7 (somente biblioteca padrão), R 4.5.1, jsonlite e digest previamente instalados. Não há servidor, banco analítico, Shiny, serviço externo ou download automático.

A partir de analytics-engine:

    python -m unittest discover -s lab -p "test_*.py" -v
    python lab/run_experiment.py --seeds 101,131,151,181,211 --output tests/fixtures/learner_lab/minha-execucao

No Windows, se necessário, defina FISCALSTUDY_RSCRIPT com o caminho do Rscript.exe e FISCALSTUDY_R_LIBS com a biblioteca R já existente. O adaptador não instala pacotes. Um alias python da Windows Store pode não funcionar no sandbox: utilize o executável real.

A saída deve estar estritamente dentro de tests/fixtures/learner_lab. Escolha uma pasta NOVA: o laboratório recusa sobrescrever execuções. Não aponte para produção. Os diretórios de execução são artefatos sintéticos ignorados pelo Git; um resultado compacto de referência pode ser versionado explicitamente.

Abra report.html gerado na pasta de execução. É um relatório HTML local, sem rede, com filtros de perfil/habilidade/modelo, diagrama de confiabilidade e inspeção das previsões avaliáveis. A tabela não substitui o histórico completo: observations.csv preserva todos os eventos. Perfis sem previsões constam nos status, não como zero de conhecimento. Estimativa R mnemônica e recomendações não são fabricadas quando indisponíveis.

Para testar o motor R existente separadamente:

    Rscript tests/test_runner.R

Os testes Java continuam pelo runner local scripts/validate-backend.cjs. Nenhum Java foi alterado nesta branch; os 22 testes da #24 são evidência histórica, não uma nova homologação Spring/SQLite.

## O que é executado

- simulator.py: gerador independente, sem importar o Motor R/FSRS. Doze perfis quantitativos, dois conteúdos/habilidades, aquisição, hipóteses exponencial e potência, efeitos de atividades, ruído, prática irregular e mudança de comportamento.
- PROFILES contém parâmetros numéricos; generate(..., profiles=[...]) permite configurar gain, half_life, efeitos, ruído e contagem. Isso não classifica pessoas reais em personalidades.
- event_contract.json: 28 variáveis com tipo epistemológico, unidade, origem, disponibilidade no produto, validade e uso permitido. Campos latentes são proibidos.
- engine_adapter.R: chama evaluate_baselines_temporally de R/baselines.R, por estudante, com janela expansiva e warmup operacional de 10 observações. Previsões usam somente timestamps anteriores.
- run_experiment.py: orquestra subprocessos R reais, calcula métricas por evento/perfil/modelo, compara por seed e gera relatório/manifesto.

O alvo é acerto objetivo avaliável sem ajuda, não recuperação livre nem domínio conceitual. Ajuda e eventos incompletos são excluídos com contagem para esse experimento, não por uma regra universal sobre aprendizagem.

## Separação da verdade

Pseudônimos/IDs não codificam nomes de perfis ou sementes. O R recebe apenas observações e manifesto sintético com SHA-256/contagem. Não recebe parâmetros, probabilidades verdadeiras ou estados latentes. Nenhum truth.json é persistido até TODOS os subprocessos R terminarem. Há teste da fronteira e teste de perturbação futura/separação entre estudantes.

Isso é separação de fluxo de dados com código R revisado e hasheado, não um sandbox de segurança para código malicioso. Não executar modelos externos não confiáveis nesse processo. A simulação possui sua própria hipótese de esquecimento somente para gerar a verdade experimental; não é uma segunda autoridade operacional de memória.

## Artefatos

- criteria.json: critérios escritos antes de gerar resultados.
- replicate-XX/input/observations.csv e manifest.json: somente observáveis, SHA-256 e origem sintética.
- predictions.csv: probabilidades do Motor R com event_id e suporte anterior.
- predictions.csv.status.json: elegibilidade, exclusões, cold start e versões R.
- truth.json: parâmetros e estados verdadeiros, exclusivamente do simulador.
- summary.json: Brier, log loss, bins, RMSE contra probabilidade verdadeira, resultados por perfil e comparações.
- identifiability.json: exemplo de equivalência observacional imediata, não estimador de parâmetros.
- run-manifest.json: versões, hashes de entrada, módulos R, scripts Python e artefatos.
- report.html: dashboard parcial dos resultados realmente executados.
- failure.json: erro explícito em futuras falhas do runner, sem falso sucesso.

Não confundir 4 previsões do mesmo evento com 4 observações independentes. Os intervalos de comparação reamostram seeds. Os intervalos de Wilson dos bins são descritivos e assumem binomialidade; não resolvem a dependência entre tentativas.

## Critérios e interpretação

A comparação de desenvolvimento com seeds 11,23,37,53,71 motivou incluir o comparador forte GLOBAL_HISTORICAL_MEAN, sem ajustar parâmetros do Motor R. A replicação usa outras seeds: 101,131,151,181,211.

O modelo por tópico é comparado à média histórica individual, não somente a probabilidades constantes. A regra é exigir limites superiores negativos tanto para diferença de Brier como de log loss no bootstrap por seed. Cinco seeds são um mínimo deste experimento, não uma lei de validade estatística. Mesmo APROVADO_SOMENTE_NESTE_SIMULADOR não aprova o produto ou sua eficácia em humanos.

O simulador tem populações e parâmetros escolhidos, apenas duas habilidades e política de atividades aleatória. Não há matriz Q calibrada, dificuldade de itens estimada, ensaio causal, transferência validada ou avaliação de novas pessoas fora dessa população sintética. O Motor atual não estima half-life individual neste adaptador. Não comparar P(acerto) com R mnemônico como se fossem iguais.

## Próximos gates

1. Baselines externos pyBKT e FSRS com versões/licenças e ambientes isolados, sem substituir resultados quando faltarem dependências.
2. Protocolo de avaliações tardias/identificabilidade e políticas comparáveis antes de experimentos C–F/J.
3. Amostras públicas autorizadas, mapeamento e inspeção de duplicatas/ausência antes de validação retrospectiva.
4. Somente depois: modelos complementares e validação futura pessoal.

Os PRs #25 e #26 foram integrados à main; a continuação parte de f77b3a4. Não fazer merge automático das novas alterações. O laboratório não habilita autoridade decisória nem depende de injetar pesos no planejador.

## Comparação ampliada (incremento 2)

Consulte BASELINE_PROTOCOL.md para hipóteses, treinamento, cobertura e limites. A extensão R inclui a média móvel existente de cinco observações. pybkt_adapter.py usa a biblioteca pyBKT real com parâmetros congelados no warmup individual e histórico estritamente anterior. Não interpreta esse estado como domínio conceitual ou retenção.

Instalação opcional, em ambiente virtual exclusivo:

    python -m pip install -r lab/requirements-lab-lock.txt
    python lab/run_experiment.py --with-pybkt --seeds 401,431,461,491,521 --output tests/fixtures/learner_lab/run-comparison
    python lab/audit_run.py tests/fixtures/learner_lab/run-comparison

Não há download ou instalação automática ao rodar experimentos. O lock registra o ambiente efetivamente usado; requirements-lab.txt registra as dependências diretas. pyBKT 1.4.3 falhou com scikit-learn 1.9.1 durante importação, por AttributeError na descoberta de métricas. O protocolo fixa scikit-learn 1.6.1 e não altera o código da biblioteca para ocultar a incompatibilidade.

O manifesto inclui os arquivos da extensão R; o status externo inclui versões e hashes das fontes pyBKT instaladas. audit_run.py verifica arquivos e vínculos dos eventos em modo somente leitura. Não confundir integridade de hashes com autenticidade ou validade científica. Os dois adapters recusam saídas existentes e caminhos fora das fixtures sintéticas. A comparação informa cobertura e usa pares de eventos; cobertura incompleta impede declarar superioridade. summary.json inclui estratos de intervalo registrado e de familiaridade por identidade do item, sem alegar transferência.

## Referência de memória oficial

MEMORY_PROTOCOL.md documenta um experimento separado de recordação, sem chute e com aquisição conhecida no simulador. Instale apenas no ambiente experimental:

    python -m pip install -r lab/requirements-memory-lab.txt
    python lab/memory_benchmark.py --output tests/fixtures/learner_lab/run-memory

O gerador é independente do FSRS. O R usa seu diagnóstico de recuperação existente e os escores são conferidos por Python. A biblioteca FSRS 6.3.2 oficial permanece inalterada; não há novo agendador no R ou consumo operacional. Resultados sintéticos, inclusive a ausência de superioridade do FSRS padrão neste gerador, estão documentados com CI, métricas e replay. O HTML do laboratório de questões não é apresentado como dashboard de memória; os artefatos de memória são JSON/CSV. Homologação visual permanece pendente.


## Calibração individual e sondagens de identificabilidade

Execute, no mesmo ambiente experimental com FSRS 6.3.2 já instalado:

    python lab/calibration_experiment.py --output tests/fixtures/learner_lab/run-calibration

O protocolo e critérios prévios estão em MEMORY_PROTOCOL.md. O R ajusta candidatos de calibração exclusivamente em treino, seleciona a penalidade em validação e avalia em teste futuro. Outro gerador independente compara históricos imediatos idênticos com sondagens tardias. Os artefatos distinguem observações, predições e verdade sintética; não fornecem autoridade ao planejador. Não há novo dashboard ou dependência. Incerteza dos parâmetros, eficácia pedagógica e validação humana permanecem explicitamente indisponíveis.
