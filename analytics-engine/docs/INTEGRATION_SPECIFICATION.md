# Especificação de Integração Futura com o FiscalStudy
# FiscalStudy Analytics

> **Documento:** `docs/INTEGRATION_SPECIFICATION.md`  
> **Versão do Contrato:** 1.0.0  
> **Natureza:** Interface desacoplada e assíncrona entre o ambiente analítico em R e o motor adaptativo operacional do FiscalStudy.

---

## 1. Topologia e Fluxo de Integração

A integração entre os sistemas ocorre estritamente por meio de arquivos estruturados, mantendo o isolamento de processos e a auditabilidade de cada decisão:

```text
+-----------------------------------------------------------+
|                      FiscalStudy                          |
|             (Java 17 / Spring Boot / SQLite)              |
+-----------------------------------------------------------+
                              |
                              | 1. Exportação Periódica Versionada
                              |    - data/raw/events_v1.csv
                              |    - data/raw/questions_v1.csv
                              v
+-----------------------------------------------------------+
|                 FiscalStudy Analytics                     |
|                      (Ambiente R)                         |
|                                                           |
|  1. Validação & Integridade (R/validation.R)             |
|  2. Análise Descritiva & Calibração                      |
|  3. Modelagem Empírica de Retenção                        |
|  4. Produção de Relatórios e Figuras                      |
+-----------------------------------------------------------+
                              |
                              | 2. Saída Estruturada com Metadados & Incerteza
                              |    - output/metrics/metrics_summary_v1.json
                              |    - output/metrics/metrics_summary_v1.csv
                              v
+-----------------------------------------------------------+
|                   Motor Adaptativo                        |
|            (Consumo assíncrono condicionado               |
|              a validação humana e técnica)                |
+-----------------------------------------------------------+
```

---

## 2. Esquema Canônico de Cada Métrica Produzida

Cada métrica exportada deve satisfazer o seguinte contrato estruturado:

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `metric_name` | `character` | Identificador único da métrica no catálogo analítico. | `"overall_accuracy"` |
| `definition` | `character` | Definição formal matemática e operacional do indicador. | `"Proporção de acertos em relação ao total de tentativas válidas."` |
| `value` | `numeric` ou `object` | Valor numérico central pontual calculado. | `0.7250` |
| `ci_lower` | `numeric` | Limite inferior do intervalo de confiança (95%). | `0.5823` |
| `ci_upper` | `numeric` | Limite superior do intervalo de confiança (95%). | `0.8341` |
| `n_observations` | `integer` | Quantidade exata de observações ($N$). | `40` |
| `period_start` | `character` | Data/hora UTC de início da janela analisada (ISO-8601). | `"2026-10-12T00:00:00Z"` |
| `period_end` | `character` | Data/hora UTC de término da janela analisada (ISO-8601). | `"2026-10-12T23:59:59Z"` |
| `method_version` | `character` | Versão do algoritmo analítico empregado. | `"v1.0.0-wilson_score"` |
| `limitations` | `list[character]` | Advertências e restrições metodológicas associadas. | `["Amostra moderada (N=40); intervalo de confiança amplo."]` |
| `quality_flags` | `list[character]` | Indicadores de saúde e integridade dos dados brutos. | `["VALID_DATA", "NO_BLOCKING_ERRORS", "2_SUB_SECOND_TIMES_FLAGGED"]` |

---

## 3. Diretrizes de Governança para Reinjeção

1. **Sem Integração Automática Direta sem Homologação:**
   - O motor adaptativo nunca deve consumir métricas que possuam a flag `BLOCKING_ERRORS_PRESENT`.
   - Métricas baseadas em $N < 15$ tentativas devem ser rotuladas como `INSUFFICIENT_POWER` e não podem alterar pesos pedagógicos de forma permanente.
2. **Auditabilidade Total:**
   - Todo arquivo exportado em `output/metrics/` recebe timestamp de geração e hash de integridade dos arquivos brutos de entrada.
