# Regras e Limites Arquiteturais
# FiscalStudy Analytics

Este documento detalha os limites arquiteturais formais estabelecidos para o projeto `fiscalstudy-analytics`. O respeito a estas regras é mandatório para qualquer modificação ou expansão do código.

---

## 1. Integridade e Isolamento de Dados

1. **Acesso Somente de Leitura ao Banco Operacional:**
   - O projeto `fiscalstudy-analytics` nunca deve abrir conexões com permissão de escrita (`readwrite`) no banco operacional do FiscalStudy (`db/fiscalstudy.db`).
   - Toda comunicação entre sistemas deve se dar por meio de **arquivos de exportação versionados** (ex: `data/raw/events_v1.csv` e `data/raw/questions_v1.csv`).
   - Não é permitido criar triggers, views ou tabelas adicionais no SQLite operacional para atender a fins analíticos.

2. **Imutabilidade dos Dados Originais:**
   - As funções de validação e limpeza nunca alteram dados originais in-place nem removem registros de forma silenciosa.
   - Registros com inconsistências ou campos ausentes devem ser sinalizados com códigos de severidade (`BLOCKING_ERROR`, `WARNING`, `INFO`) e preservados para fins de auditoria.

3. **Isolamento de Dados Sintéticos:**
   - Dados gerados artificialmente para testes ou validação de algoritmos devem residir exclusivamente no diretório `tests/fixtures/`.
   - Nenhuma métrica gerada a partir de dados sintéticos pode ser apresentada como representativa do aprendizado do estudante.

---

## 2. Simplicidade Operacional e Infraestrutura

1. **Sem APIs ou Serviços Permanentes:**
   - O ambiente analítico opera como uma suíte de rotinas em lote (*batch analytics*), executadas sob demanda via linha de comando (`Rscript`).
   - É vedado o desenvolvimento de servidores HTTP persistentes (Plumber, Shiny Server, Express, FastAPI) nesta fase.

2. **Sem Bancos de Dados Adicionais:**
   - A persistência analítica é estritamente baseada em sistema de arquivos versionados (CSV para dados tabulares, JSON para metadados e saídas estruturadas).
   - Não introduza PostgreSQL, MySQL, DuckDB, MongoDB ou Redis.

3. **Independência de Rede:**
   - Todas as análises básicas, validações estatísticas e renderizações gráficas devem funcionar em ambiente estritamente offline (*air-gapped*).
   - Nenhuma chamada de API externa (OpenAI, HuggingFace, serviços de telemetria) é permitida.

4. **Zero Dashboards Prematuros:**
   - Não crie interfaces gráficas reativas (Shiny, Dash, etc.) antes que os métodos de inferência e calibração estejam completamente consolidados e validados por testes.
   - Gráficos devem ser gerados como artefatos estáticos (PNG/PDF) em `output/figures/` via Base R.

---

## 3. Filosofia Estatística e Científica

1. **Separação Epistêmica Rigorosa:**
   - Métricas reportadas devem distinguir categoricamente o que é **fato observado** (ex: 28 acertos em 40 tentativas), o que é **estimativa** (taxa estimada de 70% com intervalo de confiança Wilson a 95%), e o que é **hipótese teórica** (ex: suposição de esquecimento exponencial).

2. **Denominadores Obrigatórios:**
   - Todo indicador relativo (porcentagem, razão, taxa) deve ser acompanhado pelo numerador e pelo denominador observados ($k$ acertos em $n$ tentativas).
   - Nunca compare períodos de tempo sem exibir o tamanho da amostra de cada período.

3. **Proibição de Inferência Causal Indevida:**
   - Correlações observadas (ex: menor tempo de resolução associado a maior taxa de acerto) não autorizam inferências causais diretas ("estudar mais rápido faz acertar mais").
   - Limitações metodológicas e variáveis de confusão (dificuldade da questão, tópico, banca) devem ser formalmente explicitadas.

4. **Sem Proliferação de Dependências:**
   - A biblioteca base do R fornece capacidades matemáticas, estatísticas e gráficas maduras.
   - O uso de bibliotecas adicionais só é justificado se trouxer funcionalidade crítica ausente no Base R e homologada no ambiente local.
