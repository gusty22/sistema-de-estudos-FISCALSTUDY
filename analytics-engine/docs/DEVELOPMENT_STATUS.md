## Provenance correction — 2026-10-25

`verify_data_provenance` now requires `origin_type == REAL_STUDY` in every row before granting personal-study/profile eligibility. Mixed, missing, unknown, automated and demonstration origins remain `UNVERIFIED_SOURCE`; their rows are preserved for diagnostics. The existing Java `AnalyticsProjectionService.exportCsv` already exports `origin_type`; no Java migration is needed. Legacy CSV files without this column remain readable but cannot establish personal learning evidence.

SHA-256 verifies file integrity, not authorship or the truth of a production/origin declaration. The operational provenance label is conditional on the recorded declarations and is not proof of learning. No FSRS equation or pedagogical model changed.

Regression tests cover an otherwise valid matching-checksum manifest with nonpersonal/missing origins and preserve the positive REAL_STUDY case. The checksum-mismatch regression uses a temporary fixture so it does not depend on native file-access checks for repository-managed files. Validation: Rscript 4.5.1 `tests/test_runner.R`, 336 passed, 0 failed, exit 0; elapsed suite time 8.211 seconds. Libraries were configured through FISCALSTUDY_R_LIBS; none installed. Log: analytics-origin-final2.log (local execution evidence, not published).

# FiscalStudy Analytics — Estado de Desenvolvimento e Registro de Execução
> **Retificação vigente em 26/10/2026:** a suíte atual executou 487 verificações, com 0 falhas (R 4.5.1; exit 0; 10.425 s; QA independente: 11.735 s). Este resultado substitui as contagens históricas abaixo. Os status antigos descrevem uma fotografia anterior do código e não são validação científica ou pedagógica. O modelo de decaimento e os pesos de redistribuição anteriores foram retirados como mecanismos acionáveis: o ajuste atual é exploratório, não estima uma curva individual calibrada, não agenda revisões e não altera pesos do backend. Consulte [LEARNER_MODEL_VALIDATION.md](LEARNER_MODEL_VALIDATION.md) para evidências atuais e limites.

> **Data da fotografia histórica:** 2026-10-12
> **Linguagem Principal:** R 4.5.1 (Windows x64)  
> **Status desta fotografia histórica:** rótulos de “consolidado/homologado” e contagens listados abaixo eram do registro antigo. Consulte a retificação vigente no início deste arquivo; aprovação de testes não valida o modelo cientificamente.

---

## 1. Inventário de Funcionalidades e Status

| Componente / Módulo | Implementado | Testado | Validado | Status | Evidência / Referência |
|---|---|---|---|---|---|
| **Ambiente R e Reconhecimento** | Sim | Sim | Sim | CONCLUÍDO | Rscript 4.5.1 em `C:\Program Files\R\R-4.5.1\bin\Rscript.exe` |
| **Arquitetura e Governança** | Sim | Sim | Sim | CONCLUÍDO | `AGENTS.md`, `README.md`, `docs/ARCHITECTURAL_RULES.md` |
| **Auditoria de Procedência de Dados** | Sim | Sim | Sim | CONCLUÍDO | `R/provenance.R`, `docs/DATA_PROVENANCE_AUDIT.md`, 38 testes em `test_provenance.R` |
| **Matriz e Adaptador de Integração** | Sim | Sim | Sim | CONCLUÍDO | `docs/INTEGRATION_CONTRACT_MATRIX.md`, `R/adapter.R` com 25 testes em `test_adapter.R` |
| **Validação e Integridade de Dados** | Sim | Sim | Sim | CONCLUÍDO | `R/validation.R` com 27 testes em `test_validation.R` |
| **Estatística Descritiva & Calibração** | Sim | Sim | Sim | CONCLUÍDO | `R/descriptive_analysis.R` (hipótese explícita Likert-probabilidade, viés de ECE) com 43 testes |
| **Retenção & 5 Níveis Epistêmicos** | Sim | Sim | Sim | CONCLUÍDO | `R/retention_analysis.R` (distinção entre memória imediata de item e transferência) |
| **Modelos de Referência (Baselines)** | Sim | Sim | Sim | CONCLUÍDO | `R/baselines.R` (Média Histórica, Bayes/Laplace por Tópico, Média Móvel, Brier Skill Score) |
| **Auditoria de Modelos Avançados** | Sim | Sim | Sim | CONCLUÍDO | `R/baselines.R` (`assess_advanced_model_viability` para BKT, IRT e Retenção Espaçada) |
| **Perfil Multidimensional de Aprendizagem** | Sim | Sim | Sim | CONCLUÍDO | `R/learning_profile.R`, `docs/LEARNING_PROFILE_SPECIFICATION_V1.md` (10 dimensões, bloqueio sem dados reais) |
| **Sinais Analíticos Observáveis** | Sim | Sim | Sim | CONCLUÍDO | `R/analytical_signals.R` (nomenclatura puramente metrológica, sem diagnósticos psicológicos) |
| **Contrato e Validação de Intervenções** | Sim | Sim | Sim | CONCLUÍDO | `R/intervention_analysis.R`, `docs/INTERVENTION_CONTRACT_V1.md` |
| **Avaliação Analítica de Recomendações** | Sim | Sim | Sim | CONCLUÍDO | `R/recommendation_evaluation.R` (estratificação mesma questão vs inédita, $N < 5 \implies$ `INSUFFICIENT_EVIDENCE`) |
| **Desenhos Experimentais N-de-1** | Sim | Sim | Sim | CONCLUÍDO | `docs/N_OF_1_EXPERIMENTATION_SPECIFICATION.md` |
| **Avaliação de Amostras de Contrato** | Sim | Sim | Sim | CONCLUÍDO | `R/evaluate_operational.R` executado sobre amostra demonstrativa de contrato (`operational_export_v1.csv` / `sample_export_v1.csv`) |
| **Suíte de Testes Automatizados** | Sim | Sim | Sim | CONCLUÍDO | `tests/test_runner.R` executado com código 0: **325 testes aprovados**, 0 falhas (100% PASS) |
| **Pipeline Analítico Integrado** | Sim | Sim | Sim | CONCLUÍDO | `run_analytics.R` compatível com exportação operacional e fixtures de transporte |
| **Modelo Empírico de Decaimento e Ponto Crítico (legado)** | Substituído | Não aplicável | Não validado | DESATIVADO PARA DECISÕES | A implementação anterior usava projeções/pesos não sustentados pelos dados. A versão atual em `R/retention_analysis.R` é exploratória e bloqueia agendamento/redistribuição; o FSRS permanece responsável pela memória operacional. |

---

## 2. Reutilização de Módulos e Não Redundância

| Módulo Novo / Atualizado | Funções Reutilizadas | Justificativa Arquitetural |
|---|---|---|
| `R/retention_analysis.R` | `calculate_wilson_ci`, `classify_attempt_history` | Estende análise de retenção com regressão logística empírica $\ln(\Delta t)$, projeção no limite inferior de Wilson e geração de pesos Robin Hood |
| `R/provenance.R` | `verify_data_provenance`, `create_operational_manifest` | Garante que nenhuma amostra ou fixture alimente conclusões de estudante real sem cadeia de custódia |
| `R/adapter.R` | `verify_data_provenance`, validação de tipos | Identifica procedência no ato da adaptação e anexa metadados/bloqueios |
| `R/learning_profile.R` | `verify_data_provenance` | Bloqueia atribuição pessoal (`is_real_student_profile = FALSE`) para dados não autenticados |
| `R/evaluate_operational.R` | `adapter.R`, `descriptive_analysis.R`, `baselines.R` | Executa avaliação técnica da amostra de contrato rotulando-a transparentemente como demonstração |
| `run_analytics.R` | Todos os módulos | Detecta procedência de dados, preserva salvaguarda epistêmica e serializa `robin_hood_weights.json` |

---

## 3. Evidências de Execução dos Testes Automatizados

Comando de verificação:
```powershell
& "C:\Program Files\R\R-4.5.1\bin\Rscript.exe" tests/test_runner.R
```

Resultado da execução:
```text
=========================================================
FISCALSTUDY ANALYTICS — SUITE DE TESTES AUTOMATIZADOS (R)
=========================================================
Passaram:  325
Falharam:  0
Tempo:     3.461 segundos
=========================================================
TODOS OS TESTES FORAM APROVADOS COM SUCESSO! (100% PASS)
```

Distribuição da Cobertura de Testes:
- `tests/test_validation.R`: 27 testes (esquemas, integridade referencial, datas ISO-8601 e cronologia).
- `tests/test_descriptive.R`: 43 testes (Wilson CI, denominadores observados, métricas Tukey, Brier Score e calibração ECE).
- `tests/test_retention.R`: 10 testes (sequenciamento temporal, lag time, matriz de transição Erro $\to$ Acerto e advertências).
- `tests/test_visualization.R`: 15 testes (integridade de renderização gráfica em Base R sem dependências de GUI).
- `tests/test_export.R`: 14 testes (serialização JSON e CSV conforme contrato canônico).
- `tests/test_learning_profile.R`: 31 testes (perfil multidimensional, 10 dimensões epistêmicas, salvaguarda de tópicos `NO_DATA` e resiliência a itens anulados).
- `tests/test_analytical_signals.R`: 35 testes (contrato canônico, superconfiança, tempos sub-segundo e limiares configuráveis).
- `tests/test_interventions.R`: 34 testes (validação de contratos de intervenção, rejeição de fixtures anômalas e salvaguarda $N < 5$).
- `tests/test_adapter.R`: 25 testes (validação estrutural de `fiscalstudy_attempts.csv`, segregação de itens sem gabarito e pontuação de concurso).
- `tests/test_baselines_and_rigor.R`: 25 testes (verificação analítica manual de Wilson CI nos limites [0, 1], Brier Score analítico, BSS e baselines).
- `tests/test_provenance.R`: 38 testes (classificação das 4 tiers de procedência, rejeição de declarações operacionais falsas, salvaguardas epistêmicas em perfis e adaptadores, e hipótese de conversão paramétrica de calibração).

---

## 4. Auditoria de Procedência e Retificação de Resultados

Conforme auditado em `docs/DATA_PROVENANCE_AUDIT.md`, o arquivo `data/raw/operational_export_v1.csv` foi identificado tecnicamente como uma **amostra demonstrativa de contrato (`DEMONSTRATION_SAMPLE`)**, originada de `analytics/sample_data.csv`.

Portanto:
1. **Acurácia de 68.42% (13/19 acertos):** É uma métrica de validação do adaptador e do pipeline em Base R sobre dados ilustrativos. **NÃO representa a capacidade ou histórico real do estudante.**
2. **Superconfiança (3 erros sob confiança 5):** Observada na massa de teste ilustrativa.
3. **Status de Aprendizagem do Estudante:** Formalmente catalogado como:
   $$\mathbf{PENDING\_AUTHENTICATED\_OPERATIONAL\_DATA}$$

Resultado da execução de `R/evaluate_operational.R` sobre a amostra demonstrativa:
```text
========================================================================
                    RESULTADO DA AVALIACAO                              
========================================================================
Procedencia dos Dados:  DEMONSTRATION_SAMPLE (AMOSTRA / DEMO (NAO E ESTUDANTE REAL))
Status de Aprendizado:  PENDING_AUTHENTICATED_OPERATIONAL_DATA
Status Amostral:        UNVERIFIED_DATA_PROVENANCE (DEMONSTRATION_SAMPLE)
Acuracia da Amostra:    68.42% [IC 95% Wilson: 46.0% - 84.6%]
Denominador Efetivo:    13 acertos em 19 tentativas (N = 19, taxa = 68.4% [IC 95%: 46.0% - 84.6%])
Pontuacao Concurso:     13 pontos
Tempo Mediano Ativo:    28.0 segundos (Med: 28.2s | Max: 52.0s)
Indice Brier:           0.2232 (sob hipotese parametrica {1:0.20..5:0.95})
Erro Calibracao ECE:    0.2737 (com vies amostral positivo para N < 30)
Superconfianca (Conf 5):3 erro(s) em questoes respondidas com confianca 5 (37.5%)
Baseline Historico:     p_base = 0.6842 | Brier Skill Score = -0.0328
Modelos Avancados:      NENHUM VIAVEL (BKT: Requer N>=30 por habilidade; IRT: N=1 inviavel sem parâmetros fixos)
Relatório Estruturado:  output/metrics/operational_data_evaluation_v1.json
========================================================================
```

---

## 5. Bloqueios Ativos e Próximos Passos Seguros

1. **Bloqueio de Ingestão de Histórico Real:**
   - O backend operacional principal (`FiscalStudy`) ainda não fornece exportação auditável com carimbo temporal ISO-8601 (`occurred_at`), identificador de sessão (`session_id`), identificador de estudante e flag de segregação de execuções de teste.
   - Qualquer inferência sobre proficiência real do usuário permanece **BLOQUEADA** até fornecimento de exportação acompanhada de manifesto formal (`PROVEN_OPERATIONAL`).
2. **Hipótese Metodológica de Calibração Parametrizada:**
   - Todos os cálculos de Brier Score e ECE explicitam que a escala Likert [1..5] é convertida para probabilidades discretas $\{0.20, 0.40, 0.60, 0.80, 0.95\}$ via hipótese teórica assumida, e não via observação contínua de crenças subjetivas.
3. **Isolamento de Produção Preservado:**
   - O banco `db/fiscalstudy.db` permaneceu estritamente isolado sem nenhuma escrita ou alteração concorrente.

## Rodada do modelo individual — 26/10/2026

A base remota desta rodada é `90c26af0c67e5745e84080792d687dad200b4f49`. As afirmações históricas acima descrevem marcos anteriores e não significam que todos os componentes ou modelos estejam validados no uso pessoal.

Foram iniciadas correções coordenadas do perfil avaliável/proveniência, preservação do histórico operacional no adaptador, classificação de exposição e modelos exploratórios sem parâmetros inventados. O FSRS continua responsável pela memória operacional; o R não atribui causa conceitual automaticamente nem trata ausência de dados como incompetência.

Linha de base executada no Windows: R 4.5.1, 342 verificações aprovadas, zero falhas, exit 0, 2.623 segundos (`r-evidence-baseline.log`). A execução final das alterações permanece em andamento; esse resultado não é atribuído ao código novo.

Plano, responsabilidades, critérios e lacunas: [LEARNER_MODEL_EXECUTION_PLAN.md](LEARNER_MODEL_EXECUTION_PLAN.md). Evidências e limites: [LEARNER_MODEL_VALIDATION.md](LEARNER_MODEL_VALIDATION.md).

## Diagnóstico de discrepância FSRS × resultado — 2026-10-26

O R agora consome os campos opcionais `fsrs_retrievability_pre_update`, `fsrs_prediction_timestamp`, `fsrs_model_version` e `fsrs_evidence_status` quando presentes. A camada separa erro com baixa recuperação prevista de erro com alta recuperação prevista (candidato a investigação), exclui estados sem evidência elegível e produz Brier/log-loss descritivos por versão, sem recalibrar nem alterar o FSRS. A fila não diagnostica causa, não recomenda ação e não altera agendamento. Ausência de campos em exports antigos permanece ausente.

Também foi removida a atribuição causal de erro de conceito, leitura precipitada, impulsividade ou desatenção a partir apenas de confiança máxima ou tempo sub-segundo. Os sinais passam a nomear a observação e explicitar causa desconhecida.

Validação R local em R 4.5.1: `tests/test_runner.R`, 529 verificações aprovadas, 0 falhas. Os campos ainda precisam ser adicionados e versionados no exportador Java para a análise receber previsões reais; o teste local do backend Java não foi executado neste checkout.


## Atualização factual — 26/10/2026

As tabelas históricas não representam validação científica global. Base atual: main 4ec0343100baf389ceb615c2307354a64f99c296. O motor permanece descritivo/exploratório, com baseline temporal e diagnóstico de discrepâncias FSRS; compreensão/transferência pessoal não foram empiricamente validadas. N-de-1 continua especificação, não ensaio executado.

Suíte R 4.5.1 em snapshot isolado: main 526/0; incremento 566/0 (verificações/falhas), incluindo pipeline/fixtures e regressões de scores, temporalidade, IDs e vínculos de intervenção. Isso não demonstra eficácia pedagógica. Achados R01–R20 e pendências estão em LEARNER_MODEL_VALIDATION.md. Transporte do manifesto do Bridge é frente específica.
