# Validação do modelo individual: rodada de 26/10/2026

## Origem e ambiente

A base de código foi materializada seletivamente do commit remoto `90c26af0c67e5745e84080792d687dad200b4f49`. O repositório local é um snapshot de trabalho, não um clone completo do histórico remoto. A sessão anterior Linux ficou indisponível; alterações não publicadas não foram consideradas entregues nem portadas. As correções desta rodada são reimplementadas e verificadas no Windows.

Runtime: R 4.5.1 existente, com bibliotecas previamente instaladas configuradas por `R_LIBS_USER`/`FISCALSTUDY_R_LIBS`. Nenhuma instalação de dependência de produto é requisito novo destas correções. Testes são isolados dos bancos, Anki e integrações externas.

## Linha de base executada

Comando a partir de `analytics-engine/`:

```powershell
$env:R_LIBS_USER = 'C:\Users\washi\AppData\Local\R\win-library\4.5'
$env:FISCALSTUDY_R_LIBS = $env:R_LIBS_USER
& 'C:\Program Files\R\R-4.5.1\bin\Rscript.exe' tests/test_runner.R
```

Resultado observado antes das correções: **342 verificações aprovadas, zero falhas**, exit 0, 2.623 segundos. Log local: `C:/workspace/r-evidence-baseline.log`.

Esse resultado mostra que a base executava seus testes; não demonstra ausência de problemas. Parte dos testes antigos aceitava comportamentos que estão sendo corrigidos, incluindo inferências sem dados suficientes.

## Validações da alteração

Validação final desta rodada: R 4.5.1, suíte executada em 26/10/2026, **487 verificações aprovadas, 0 falhas**, exit 0, 10.425 segundos. Log local: `C:/workspace/r-evidence-full-final2.log`. Revisão QA independente após o último ajuste: 487/0, exit 0, 11.735 s; log `C:/workspace/r-qa-delta-final.log`. A linha de base anterior de 342 verificações não deve ser atribuída às novas alterações.

| Área | Critério verificável | Evidência final |
| --- | --- | --- |
| Perfil | Exclusão de resultados não avaliáveis; origem pessoal consistente; vazio não é zero; novidade não comprova transferência | Suíte completa: asserções de perfil e contratos integrados; inclui anuladas, resultados sem avaliação, origem mista e limites de transferência. |
| Histórico e memória | Cardinalidade; tópicos homônimos; ajuste insuficiente/falho explícito; invariância ao nome da disciplina; sem previsão/redistribuição fabricadas | Suíte completa: ajuste exploratório sem coeficientes sintéticos, estimativa não agendável e pesos não aplicáveis. |
| Adaptador e pipeline | Preservar identidade/datas/origem; validar qualidade temporal; cold start e proveniência na saída | Testes E2E incluídos: identidade/data/origem, fixture não produção, checksum inválido, origens mistas, cold start sem artefato antigo e manifesto configurado ausente. |
| Executor e integração | Arquivo de teste ausente/erro não gera falso sucesso; cenários entre módulos e serialização JSON | 487 aprovações na suíte; os testes específicos do executor cobrem arquivo obrigatório ausente e erro de execução como falhas. Harness fail-closed isolado: `C:/workspace/r-runner-harness-missing.log` e `C:/workspace/r-runner-harness-error.log`, exit 1. |

## Limites e recuperação

Nenhum banco original ou evento append-only foi alterado. Sem implantação, merge na main ou sincronização externa por este trabalho documental. As alterações de código continuam rastreáveis por diff e commits da área após revisão do orquestrador. Testes R não executam Java/Bridge nem homologam a aplicação integrada.

Não se declara homologação visual, integração Java executada, curva individual calibrada, eficácia pedagógica ou resolução de todas as lacunas do modelo do estudante. Os critérios de evolução estão em [LEARNER_MODEL_EXECUTION_PLAN.md](LEARNER_MODEL_EXECUTION_PLAN.md).


## Onda 0 — gate de decisões cognitivas (26/10/2026)

Branch: `fix/wave0-cognitive-action-gates`, base `db8bf3d72646d22c62f7339d82a466ff1b66fcb8`.

- Foram adicionados estados explícitos `BLOCKED_UNVALIDATED_MODEL` e `CAUSE_UNRESOLVED`; a API de decisão não deve emitir revisões adaptativas executáveis nem chamar o modelo de tópico ainda não validado.
- A falha de revisão passa a registrar os campos relatados pelo estudante sem converter intervalo, confiança ou ajuda em causa, domínio ajustado ou estabilidade. O evento append-only recebe novo tipo de investigação; eventos históricos não são reescritos.
- Testes de regressão foram escritos/atualizados para o bloqueio e a ausência de estimativas. **Status: NOT_EXECUTED nesta sessão**, pois este ambiente não tem checkout local do FiscalStudy nem executável Maven do projeto. O PR/CI remoto ainda precisa fornecer evidência.
- Esta mudança não valida FSRS, o motor R, a integração Java → R ou o sistema completo. Os endpoints/modelos legados identificados em `StudentKnowledgeStateService`, `UnifiedCognitiveArchitectureService` e `DigitalTwinService` continuam fora do escopo deste incremento e precisam ser bloqueados ou corrigidos com revisão de consumidores.



## Backtest temporal de baselines — incremento em revisão

Base remota desta frente: `dbf00bf1ce3fdc5ef4b455fa84619414a3251bad` (main após os PRs #19, #20 e #21). Branch: `feature/r-temporal-baseline-audit`.

- `evaluate_baselines_temporally` executa uma avaliação prequential com janela expansiva. Cada lote com timestamp igual é previsto antes de qualquer resultado do lote entrar no histórico; portanto, resultados futuros e eventos simultâneos não vazam para aquela previsão.
- Compara a média histórica global e a média suavizada por tópico, registra tamanho do histórico usado, exposição anterior da mesma questão e métricas descritivas Brier/log loss. O tópico usa apenas rótulos presentes na linha da tentativa; sua procedência temporal não é confirmada pelo helper.
- O backtest distingue questão já vista de primeira exposição registrada. Essa distinção não demonstra transferência conceitual; tentativas do mesmo item/estudante continuam dependentes.
- O helper de comparação de vetores `evaluate_model_vs_baseline` agora retorna `DESCRIPTIVE_SCORE_ONLY`; como recebe vetores sem desenho de validação, já não classifica amostras de N≥20 como comparação válida nem como desempenho fora da amostra.
- O artefato `temporal_baseline_backtest_v1.json` é integrado ao pipeline e à avaliação operacional, inclusive em cold start. Toda saída tem `can_apply=false`, não altera FSRS e não alimenta o planejador.
- Validação local R nesta sessão: **NOT_EXECUTED** (não há checkout executável do repositório neste ambiente). CI remota desta branch: pendente de execução após PR draft. Testes e dados sintéticos especificam o comportamento esperado, não validam previsões pessoais nem eficácia de aprendizagem.


## Auditoria atual do motor R — 26/10/2026

Base: main 4ec0343100baf389ceb615c2307354a64f99c296, após merge #22.
Escopo: 14 módulos R, pipeline, runner/fixtures, contratos e consumidores Java relevantes. Não é auditoria completa de todos os consumidores Java nem homologação visual. Nenhum banco operacional foi aberto ou alterado.

### Conclusão

O motor é uma camada descritiva com backtest temporal de baselines e auditoria de previsões FSRS. Ainda não é um Cognitive Digital Twin empiricamente validado. A segurança de não executar pesos exploratórios está mais madura que a previsão pessoal. Testes de fixtures não provam compreensão, transferência, eficácia pedagógica ou calibração individual.

### Matriz de capacidades

| Dimensão/capacidade | Estado | Evidência e limite |
|---|---|---|
| Knowledge: desempenho por disciplina/tópico | IMPLEMENTADO_E_VALIDADO_TECNICAMENTE | descriptive_analysis.R: k/n e Wilson. Não mede domínio latente. |
| Knowledge: baselines temporais | IMPLEMENTADO_E_VALIDADO_TECNICAMENTE | baselines.R: global e suavizado por tópico com histórico anterior ao lote. Validação pessoal BLOQUEADO_POR_DADOS. |
| Knowledge: compreensão, pré-requisitos, variantes e transferência | PARCIAL | Há separação de exposição/repetição, mas faltam desenho diagnóstico, equivalência validada e cobertura por habilidade. |
| Memory: snapshots FSRS anteriores | IMPLEMENTADO_E_VALIDADO_TECNICAMENTE | retrieval_diagnostics.R pontua previsões declaradas pré-atualização e separa versões; não ajusta FSRS. |
| Memory: calibração prospectiva pessoal/deriva | PARCIAL | Brier/log loss por versão são descritivos; não houve avaliação pessoal independente. |
| Memory: curvas por disciplina | BLOQUEADO_POR_DADOS | Exportação contém R anterior, mas não S/D/lastReview/due suficientes para agregações verificáveis. Não criar curva alternativa. |
| Learning: confiança, exposição e erros | PARCIAL | Descritivos existem; faltam metadados de ajuda, momento da confiança, anotações e condições comparáveis de avaliação. |
| Learning: resultados pós-intervenção | PARCIAL | Vínculo e ordem do evento agora são verificados; tipo/novidade/equivalência e término da intervenção não são comprovados. |
| Learning: eficácia N-de-1 | SOMENTE_DOCUMENTADO | Existe especificação; resumo posterior não é experimento randomizado ou efeito causal. |
| Decision: evidência versionada ao planejador | PARCIAL | run_id/procedência/can_apply=false existem; backtest não tem contrato decisório homologado no Java. |
| Simulador pessoal validado | AUSENTE | Nenhum ganho hipotético foi promovido a previsão pessoal. |

### Achados priorizados

| ID | Prioridade | Evidência | Situação e impacto |
|---|---|---|---|
| R01 | Alta | baselines.R/evaluate_model_vs_baseline clipava probabilidades antes do Brier e aceitava valores inválidos | CORRIGIDO: entradas binárias/finitas, Brier com p original, clipping só para log loss; BSS contra baseline perfeito = NA. |
| R02 | Alta | Parsers do backtest/diagnóstico aceitavam horário sem fuso como UTC | CORRIGIDO nesses caminhos: parser de instante explícito com offsets e rejeição de datas inválidas. Outros parsers legados ainda pendentes. |
| R03 | Alta | retrieval_diagnostics.R podia pontuar IDs ausentes/duplicados fora do pipeline | CORRIGIDO: exige identidade evento/item; todas as ocorrências duplicadas são excluídas de scores e investigações. |
| R04 | Alta | recommendation_evaluation.R ignorava attempts_df ao contar post_outcome | CORRIGIDO: confere evento único, resposta avaliável, ordem estritamente posterior e resultado coerente. |
| R05 | Alta | Um evento posterior podia sustentar múltiplas intervenções | CORRIGIDO: links compartilhados são ambíguos e não contados; intervalo declarado é preservado e o observado é calculado. |
| R06 | Alta | analytical_signals.R fabricava n=2/k=0 sem linhas de tentativas | CORRIGIDO: não emite sinal sustentado por contagem inventada. |
| R07 | Alta | AnalyticsBridgeService.executeAnalyticsPipeline entregava CSV sem manifesto | Frente separada fix/analytics-bridge-provenance reutiliza exportPackageToDirectory e informa manifesto explícito ao R. Sem isso, execução automática não estabelece procedência operacional. |
| R08 | Alta | AnalyticsProjectionService.exportCsv consulta catálogo atual; adapter conserva rótulos sem prova temporal | PENDENTE: exportar IDs/classificações realmente registrados no evento e suas versões/origens; não reconstruir passado pelo resultado posterior. |
| R09 | Alta | Exportação não transporta ajuda, variantes válidas, causas anotadas e contexto completo de intervenção | PENDENTE: completar transporte campo-a-campo. Não chamar acerto objetivo de recuperação livre ou transferência. |
| R10 | Alta | DigitalTwinService.getKnowledgeGraph usa estabilidade heurística, exp(-dias/S), prazo de 70% e pAcertoHoje; getExamProjection agrega esses números | PENDENTE Java: retirar autoridade científica/decisória e rastrear consumidores. Correções R não legitimam esse motor paralelo. |
| R11 | Alta | application/cognitive/UnifiedCognitiveArchitectureService usa pL heurístico, S=1+15*pL+.5*N e exp(-dias/S) | PENDENTE: separar heurística de FSRS e bloquear decisões não validadas. StudentKnowledgeStateService conserva cálculos de compatibilidade; conferir saídas/consumidores antes de remover. |
| R12 | Média | descriptive_analysis.R converte confiança/5 e calcula ECE/Brier | Hipótese explícita, não medição de probabilidade subjetiva. Preservar ordinal; ajuste individual requer treino temporal separado e dados. |
| R13 | Média | Wilson e Fisher/prop.test assumem observações binomiais/independentes; compare_performance_periods retorna is_significant | PENDENTE: não interpretar como progresso confirmado; tratar repetição, sobreposição, sessão e dificuldade antes de inferência. |
| R14 | Média | calculate_baseline_moving_average usa ordem de entrada | PENDENTE: exigir cronologia ou declarar ordem de entrada; current_estimate não é previsão pessoal calibrada. |
| R15 | Média | assess_advanced_model_viability usa limiares 20/30/200 e VIABLE | São triagens operacionais, não provas universais de identificabilidade/validade; requer especificação e holdout. |
| R16 | Média | classify_attempt_history desempata pela ordem de entrada e categoriza intervalos <24h | PENDENTE: empates não provam precedência; faixas não identificam mecanismos cognitivos. |
| R17 | Média | Configuração de analytical_signals pode divergir dos contadores prontos do perfil | PENDENTE: calcular com a configuração efetiva ou restringir parâmetros não suportados. |
| R18 | Média | DEVELOPMENT_STATUS/contexto antigo afirmam conclusão ampla e citam digital_twin_engine.R ausente | Este registro atualiza o estado, preservando histórico. Especificação N-de-1 não é implementação. |
| R19 | Média | Backtest varre timestamps por lote; manifesto Java hasheia entrypoint, não todos os módulos | PENDENTE: medir custo antes de otimizar e versionar/hash do conjunto completo. Não há benchmark de desempenho nesta rodada. |
| R20 | Alta | RobinHoodWeightsDTO ignorava can_apply/is_validated; injectWeights, recarga de arquivo e generateCycle podiam aceitar pesos exploratórios | CORREÇÃO em fix/analytics-bridge-provenance: o contrato legado permanece observacional, sem autoridade de alocação; novos testes protegem injeção, recarga e consumo direto. Uma versão executável futura exige homologação explícita. |

O achado R20 foi identificado ao rastrear o consumidor após a primeira publicação da auditoria. O bloqueio preserva o cálculo do ciclo configurado e FSRS, mas impede que DTOs analíticos legados alterem pesos ou criem blocos emergenciais. Não é suficiente confiar em flags desconhecidas descartadas pelo deserializador.

### Equações e fronteiras verificadas

- Acurácia é k/n. Wilson é intervalo da proporção sob hipótese binomial, não intervalo de domínio conceitual; não corrige dependência entre repetições.
- Baseline por tópico: (k_t + m*p_global)/(n_t + m). m=2 é suavização operacional. No backtest, p_global e k_t usam apenas instantes anteriores ao lote.
- Brier = mean((p-y)^2). Log loss = -mean(y*log(p)+(1-y)*log(1-p)). A estabilização numérica dos logs não pode alterar o Brier.
- retention_analysis.R ajusta logit(P(acerto))=b0+b1*log(intervalo_dias): associação in-sample com prática selecionada, não curva pessoal causal/calibrada. can_schedule=false e pesos vazios foram preservados.
- LearningEvidenceService.MODEL_VERSION identifica FSRS-6.0-default-core-no-fuzz, com 21 coeficientes em FsrsParameters. Existem vetores em FsrsReferenceConformanceTest; comentários antigos “v5”/“4.5” não definem a versão executada.
- GOOD/AGAIN por resultado objetivo é política de produto, não equivalência demonstrada com recuperação livre. R não modifica as equações FSRS.
- Nem uma avaliação posterior vinculada comprova causa, compreensão ou eficácia. Não foi criado escore global de personalidade/conhecimento.

### Validação executada

Snapshot analítico isolado do SHA acima. Rscript 4.5.1 em C:/Program Files/R/R-4.5.1/bin/Rscript.exe; jsonlite/digest já instalados, sem adicionar dependências.

| Gate | Resultado real |
|---|---|
| main: Rscript tests/test_runner.R | 526 verificações, 0 falhas, 13.251s |
| Correções R: mesmo comando | 566 verificações, 0 falhas, 21.524s |
| Casos acrescentados | Timestamp sem fuso/inválido/com offset, previsão posterior, IDs duplicados, anulado, desfecho divergente, avaliação compartilhada/simultânea, evento ausente, probabilidades inválidas e BSS indefinido |
| Integração do pipeline R | Incluída na suíte, via subprocessos/diretórios temporários; sem Anki ou serviços externos |
| Validade preditiva pessoal/causalidade/uso longitudinal | NOT_EXECUTED: nenhum histórico pessoal elegível foi analisado nesta rodada |
| Homologação visual | NOT_EXECUTED |

Os números contam verificações do runner, não evidências de aprendizagem independentes. Para o teste Java do Bridge, consultar o relatório da branch específica: não somar testes Java às verificações R.

### Próximos gates, em ordem

1. Transportar e conferir pacote/manifesto no fluxo Java → R → artefatos do run, em ambiente isolado.
2. Confinar consumidores Java legados com retenção paralela, rastreando chamadas antes de remover contratos.
3. Completar origem/ajuda/classificação/versionamento/anotações/variantes e medir cobertura real.
4. Backtest por primeira exposição/repetição e escopo curricular válido, com dependência e incerteza explícitas.
5. Só então avaliar modelos mais complexos, auditoria diagnóstica ativa e consumo pelo planejador. can_apply depende da homologação do contrato decisório, não da quantidade de testes.
