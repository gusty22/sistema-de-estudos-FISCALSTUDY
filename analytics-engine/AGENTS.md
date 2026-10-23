# AGENTS.md — Regras de Desenvolvimento Autônomo
# Projeto: FiscalStudy Analytics

> **Papel:** Diretrizes fundamentais e invioláveis para agentes e desenvolvedores operando no repositório `fiscalstudy-analytics`.

---

## 1. Princípios e Limites Arquiteturais

1. **Isolamento Estrito do Banco Operacional:**
   - O projeto `FiscalStudy Analytics` é **somente leitura** em relação aos dados de origem.
   - Nenhuma escrita, modificação de schema ou operação concorrente é permitida sobre o banco SQLite operacional do FiscalStudy (`db/fiscalstudy.db`).
   - Não copie o banco operacional de forma indiscriminada. Trabalhe com exportações versionadas e estruturadas.

2. **Natureza do Ambiente:**
   - `R` (versão 4.5.1+) é a linguagem analítica central.
   - Não construa APIs REST, microsserviços, daemons contínuos ou servidores web nesta etapa.
   - Não adicione bancos de dados adicionais (PostgreSQL, MongoDB, Redis, etc.).
   - Não exija conexão com a internet para rotinas e análises básicas.

3. **Dependências Mínimas e Justificadas:**
   - Priorize Base R para estatística matemática, transformações e gráficos.
   - Utilize bibliotecas já instaladas no ambiente (como `jsonlite`, `tools`) somente quando houver benefício concreto e comprovado.
   - Não instale pacotes adicionais sem autorização ou necessidade estrita.

4. **Separação Científica Obrigatória:**
   - **Observações:** O que foi diretamente registrado (ex: `is_correct`, `confidence_level`, `active_time_ms`).
   - **Estimativas:** Quantidades calculadas a partir das observações com incerteza associada (ex: taxa de acerto com intervalo de confiança, calibração ECE).
   - **Hipóteses:** Modelos e pressupostos teóricos testáveis (ex: modelo de retenção exponencial vs lei de potência).
   - **Conclusões:** Decisões sustentadas por evidências empíricas com amostra estatística suficiente.
   - **Nunca apresente percentuais sem denominadores.**
   - **Nunca atribua causalidade a meras correlações.**

5. **Dados Sintéticos e Integridade:**
   - Dados sintéticos são permitidos **exclusivamente como fixtures de teste automatizado** (armazenados em `tests/fixtures/`).
   - É terminantemente proibido utilizar dados fictícios em análises ou relatórios apresentados como reais.
   - Nunca invente evidências de aprendizagem ou progresso.

6. **Não Proliferação de Ferramental:**
   - Não crie dashboards Shiny prematuros.
   - Não treine modelos de linguagem (LLMs).
   - Não invente contratos de dados como definitivos sem validação empírica.

---

## 2. Estrutura do Repositório

```text
fiscalstudy-analytics/
├── AGENTS.md                          # Este documento (regras operacionais)
├── README.md                          # Visão geral, arquitetura e execução
├── docs/
│   ├── ARCHITECTURAL_RULES.md         # Regras e limites detalhados
│   ├── DATA_CONTRACT_V1.md            # Contrato de dados versionado (v1)
│   ├── RESEARCH_SPECIFICATION.md      # Especificações de modelagem e experimentação
│   ├── INTEGRATION_SPECIFICATION.md   # Contrato de saída para reinjeção no FiscalStudy
│   └── DEVELOPMENT_STATUS.md          # Inventário de status, testes e pendências
├── R/
│   ├── validation.R                   # Funções de validação e integridade
│   ├── descriptive_analysis.R         # Funções de estatística descritiva e calibração
│   ├── retention_analysis.R           # Modelagem empírica de retenção e recuperação
│   ├── visualization.R                # Gráficos em Base R com contexto e denominadores
│   └── export_results.R               # Serialização padronizada de métricas analíticas
├── tests/
│   ├── test_runner.R                  # Executor de testes automatizados
│   ├── test_validation.R              # Testes unitários de validação de dados
│   ├── test_descriptive.R             # Testes unitários de estatística descritiva
│   ├── test_retention.R               # Testes unitários de retenção
│   ├── test_export.R                  # Testes de serialização e contratos
│   └── fixtures/                      # Conjuntos de dados sintéticos controlados
├── output/                            # Diretório de relatórios e saídas estruturadas
└── run_analytics.R                    # Pipeline de execução analítica
```

---

## 3. Protocolo de Modificação e Teste

Ao implementar qualquer rotina em R:
1. Escreva funções puras e determinísticas quando possível.
2. Não ignore valores ausentes (`NA`) silenciosamente; trate-os de forma explícita.
3. Garanta que testes unitários cubram: entradas vazias, campos ausentes, tipos inválidos, limites numéricos (tempos negativos, escalas fora de 1-5) e amostras pequenas.
4. Execute os testes via `Rscript tests/test_runner.R` e assegure saída com código de erro `0`.
5. Atualize `docs/DEVELOPMENT_STATUS.md` após cada marco de implementação.
