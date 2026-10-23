# FiscalStudy Analytics

Ambiente analítico independente e especializado para o **FiscalStudy** (plataforma de preparação adaptativa para concursos públicos), com foco em estatística aplicada, avaliação de desempenho, calibração metrológica de confiança, análise de retenção e experimentação científica em **R**.

---

## 1. Visão do Projeto

### Objetivo
Desenvolver métodos analíticos robustos, reproduzíveis e auditáveis para embasar pedagogicamente as decisões de estudo do FiscalStudy. O FiscalStudy Analytics atua como o **laboratório estatístico** do sistema, gerando evidências analíticas quando houver volume e qualidade de dados suficientes.

### O que o FiscalStudy Analytics É:
- Um ambiente independente de análise estatística baseado em **R**.
- Um validador rigoroso de dados de aprendizagem e resolução de questões.
- Um gerador de métricas descritivas com controle de incerteza e denominadores explícitos.
- Um espaço de pesquisa e experimentação controlada (calibração, curvas de retenção, modelos psicométricos).
- Um produtor de artefatos estruturados (CSV/JSON) para futura reinjeção no motor de decisão.

### O que o FiscalStudy Analytics NÃO É:
- Não é outro aplicativo com interface web ou dashboard em tempo real.
- Não é um backend de microsserviço ou API exposta permanentemente.
- Não é um ambiente de treinamento de Modelos de Linguagem (LLMs).
- Não é um banco de dados operacional concorrente.

---

## 2. Princípios Científicos Fundamentais

O projeto adota uma epistemologia rigorosa para evitar falácias pedagógicas e conclusões precipitadas:

1. **Separação Obrigatória dos Níveis Epistêmicos:**
   - **Observação:** Dado bruto inalterado (ex: o usuário marcou alternativa B em 45 segundos com confiança 4).
   - **Estimativa:** Parâmetro inferido com intervalo de incerteza (ex: taxa de acerto de 72% [IC 95%: 61% - 81%], com $N = 40$).
   - **Hipótese:** Proposição estatística ou pedagógica testável (ex: a confiança do estudante correlaciona positivamente com acerto).
   - **Conclusão:** Recomendação ou asserção justificada apenas por evidências estatisticamente significativas e reprodutíveis.
2. **Denominadores Explícitos:** Nenhuma taxa, probabilidade ou percentual pode ser reportado sem o tamanho da amostra e o denominador correspondente ($k / n$).
3. **Não-Causalidade:** Correlações entre tempo, confiança ou repetição não implicam causalidade pedagógica sem desenho experimental controlado.
4. **Isolamento de Dados Sintéticos:** Dados sintéticos são admitidos exclusivamente em testes unitários. Nunca são apresentados como dados reais do estudante.

---

## 3. Arquitetura e Fluxo de Dados

```text
+---------------------+
|     FiscalStudy     | (Java/Spring Boot + SQLite)
+---------------------+
           |
           | 1. Exportação Versionada (events_v1.csv, questions_v1.csv)
           v
+---------------------+
| FiscalStudy         |
| Analytics (R)       |
|                     |
|  - Validação        | (R/validation.R)
|  - Descritiva       | (R/descriptive_analysis.R)
|  - Retenção         | (R/retention_analysis.R)
|  - Perfil Aprender  | (R/learning_profile.R)
|  - Sinais Analíticos| (R/analytical_signals.R)
|  - Intervenções     | (R/intervention_analysis.R)
|  - Aval. Recomenda  | (R/recommendation_evaluation.R)
|  - Visualizações    | (R/visualization.R)
|  - Exportação       | (R/export_results.R)
+---------------------+
           |
           | 2. Resultados Estruturados (output/metrics/metrics_summary_v1.json, learning_profile_v1.json, etc.)
           v
+---------------------+
| Motor Adaptativo    | (Futura reinjeção após validação)
+---------------------+
```

---

## 4. Requisitos do Sistema e Execução Local

- **Linguagem:** R >= 4.0.0 (testado e homologado no R 4.5.1 no Windows).
- **Dependências externas:** Zero dependências obrigatórias para o core estatístico (utiliza Base R e bibliotecas padrão). Para serialização JSON complementar, utiliza o pacote embutido `jsonlite`.

### Executando o Pipeline Analítico:
```powershell
# Execução do pipeline completo com fixtures ou arquivos de entrada
& "C:\Program Files\R\R-4.5.1\bin\Rscript.exe" run_analytics.R

# Execução direta com arquivo de exportação operacional do FiscalStudy
& "C:\Program Files\R\R-4.5.1\bin\Rscript.exe" run_analytics.R data/raw/operational_export_v1.csv
```

### Executando a Avaliação de Amostras de Contrato:
```powershell
& "C:\Program Files\R\R-4.5.1\bin\Rscript.exe" R/evaluate_operational.R
```

### Executando a Suíte de Testes Automatizados (297 Testes):
```powershell
# Execução da suíte completa de testes
& "C:\Program Files\R\R-4.5.1\bin\Rscript.exe" tests/test_runner.R
```

---

## 5. Documentação Adicional

- [AGENTS.md](AGENTS.md): Regras operacionais fundamentais e limites arquiteturais.
- [docs/DATA_PROVENANCE_AUDIT.md](docs/DATA_PROVENANCE_AUDIT.md): Auditoria técnica de procedência e custódia de dados.
- [docs/ARCHITECTURAL_RULES.md](docs/ARCHITECTURAL_RULES.md): Limites técnicos e arquiteturais detalhados.
- [docs/INTEGRATION_CONTRACT_MATRIX.md](docs/INTEGRATION_CONTRACT_MATRIX.md): Matriz de correspondência entre a exportação operacional e o esquema canônico R.
- [docs/DATA_CONTRACT_V1.md](docs/DATA_CONTRACT_V1.md): Especificação do contrato de dados de eventos, catálogo e procedência.
- [docs/LEARNING_PROFILE_SPECIFICATION_V1.md](docs/LEARNING_PROFILE_SPECIFICATION_V1.md): Especificação do perfil multidimensional de aprendizagem.
- [docs/INTERVENTION_CONTRACT_V1.md](docs/INTERVENTION_CONTRACT_V1.md): Contrato de eventos de intervenção pedagógica.
- [docs/N_OF_1_EXPERIMENTATION_SPECIFICATION.md](docs/N_OF_1_EXPERIMENTATION_SPECIFICATION.md): Especificação de desenhos experimentais N-de-1.
- [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md): Inventário de status, testes homologados e histórico de execução.
- [docs/RESEARCH_SPECIFICATION.md](docs/RESEARCH_SPECIFICATION.md): Especificação científica e critérios de viabilidade de modelagens estatísticas.
- [docs/INTEGRATION_SPECIFICATION.md](docs/INTEGRATION_SPECIFICATION.md): Esquema estruturado para exportação e reinjeção.

