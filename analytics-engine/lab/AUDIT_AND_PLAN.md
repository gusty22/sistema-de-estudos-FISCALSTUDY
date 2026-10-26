# Auditoria atualizada e plano do primeiro experimento

Verificado em 26/10/2026. main=4ec0343100baf389ceb615c2307354a64f99c296; PR #23 aberta/não mesclada, head=4db0ac08c70e0c651b9bc345e6e9d6b634b2a6e7; PR #24 aberta/não mesclada, head=d5e4ba99a4fb21f594d5bf84b7f68dc206d820bb. Os heads são os mesmos da auditoria histórica. Nenhum merge foi feito. A branch do laboratório parte da #23 e não contém as alterações Java da #24; o PR do laboratório é empilhado sobre #23, sem remover ou substituir #24.

Revalidação de código: AGENTS raiz/analytics, índice de contexto, baselines R e contratos Java de tentativas/classificação/exportação. Graphify não possui grafo no workspace e não foi usado como evidência. A matriz abaixo distingue presença em branch de validação científica. Suíte R da base foi repetida: 574 verificações, 0 falhas, R 4.5.1 (21.057s). Os 22 testes Java anteriores são HISTÓRICOS; Java não foi alterado nem reexecutado nesta etapa.

## Matriz de achados

| Achado | Estado atual / evidência | Impacto | Correção / dependência / critério de conclusão |
|---|---|---|---|
| R01 scores | Presente #23, R/baselines.R; suíte R repetida | Probabilidades inválidas não viram scores válidos | Manter vetores independentes e rejeição de p inválida; não refazer. |
| R02 fuso | Presente #23, parse_evidence_timestamp/backtest/retrieval | Evita precedência fictícia | Lab exige instante absoluto; parsers legados fora deste caminho continuam pendentes. |
| R03 identidade | Presente #23, retrieval_diagnostics.R | Duplicatas não sustentam diagnósticos | Lab rejeita duplicatas globais; manter origem e IDs. |
| R04 vínculo posterior | Presente #23, recommendation_evaluation.R | Declaração não vira efeito observado | Intervenção causal ainda exige desenho; lab MVP não avalia política. |
| R05 evento compartilhado | Presente #23, followup_audit | Evita contar o mesmo teste duas vezes | Manter rejeição de ambiguidade, sem inferir causalidade. |
| R06 contagens inventadas | Presente #23, analytical_signals.R | Ausência permanece ausência | Não refazer; testes de regressão preservados. |
| R07 manifesto Bridge | Somente #24, AnalyticsBridgeService | Automação sem manifesto não atesta procedência | Integrar #24 com revisão; lab tem manifesto sintético próprio e não usa Bridge operacional. |
| R08 currículo histórico | Pendente, AnalyticsProjectionService.exportCsv consulta catálogo atual | Taxonomia atual pode ser atribuída ao passado | Exportar classificação realmente registrada/versão; depende de evento; concluir com teste de mudança curricular sem reescrever histórico. |
| R09 ajuda/variantes/causas | Parcial: AttemptSubmissionService grava usedHelp/helpType/causaErro; CSV não transporta; ATTEMPT_ANNOTATED separado | Sem condições não há interpretação segura | Contrato campo-a-campo; ausência explícita. Não preencher banco de produção. |
| R10 DigitalTwinService | Pendente; getKnowledgeGraph usa exp(-dias/S) e heurísticas | Retenção/projeção concorrente não validada | Rastrear consumidores e remover autoridade; fora do modelo sintético independente. |
| R11 UnifiedCognitiveArchitectureService | Pendente; pL heurístico, S=1+15*pL+.5*N, exp(-dias/S) | Não equivale a FSRS/BKT validado | Revisar consumidores Java antes de migração; não importado pelo laboratório. |
| R12 confiança | Hipótese ordinal/5 permanece explícita | Não é probabilidade subjetiva medida | Baselines do lab não usam confiança; futura calibração requer treino temporal separado. |
| R13 independência | Pendente em comparações descritivas | Wilson/Fisher não corrigem repetições | Lab separa seeds, usa bootstrap por seed e explicita limite de bins binomiais; não generaliza a humanos. |
| R14 média móvel | Ordem de entrada no helper legado | Não garante cronologia | MVP usa somente backtest com timestamps estritamente anteriores; não chama média móvel. |
| R15 viabilidade | Limiares operacionais permanecem | Tamanho amostral não prova identificabilidade | Nenhum modelo avançado é promovido por esse gate. |
| R16 empates/exposição | Parser/desempate legado permanece | Ordem de entrada não prova exposição | MVP usa backtest por lotes temporais e IDs; transferência não estabelecida. |
| R17 configs/sinais | Pendente | Configuração pode divergir de contador pronto | Lab não executa sinais como políticas; resolver consumidor antes de uso decisório. |
| R18 documentação | Atualizada na #23; contexto antigo ainda contém estados históricos | Risco de alegação por nome | Este plano fixa hashes, estágios e testes reais. |
| R19 custo/hash | Pendente no produto; lab hasheia módulos R e código Python | Um hash de entrypoint não identifica todo o modelo | Escala limitada a 12 perfis/500 eventos por estudante; sem benchmark de produção. |
| R20 autoridade | Somente #24: DTO/service/engine/controller bloqueados | Flags descartadas não autorizam ação | Lab é exclusivamente offline: can_apply/can_schedule=false, sem API, SQL ou saída consumida por Java. |
| R21 amostra unitária | Presente #23, visualization.R | Primeiro estudo não pode abortar pipeline | Suíte R repetida; não refazer. |
| R22 SHA-256 | Presente #23, provenance.R, leitura limitada | Mesmos bytes, nunca hash inventado | Lab reutiliza compute_file_sha256 e verifica checksum/contagem; sem downgrade. |

## Fontes efetivas dos dados

- Tentativa: UUID solicitado/gerado, event_id=attempt:UUID, appendEventOnce e replay idempotente em AttemptSubmissionService.
- Tempo: Instant.now no backend / event_store.occurred_at. O laboratório registra UTC; não usa relógio de resposta como traço psicológico.
- Resultado: payload.isCorrect/gabarito; ausentes/anulados não são erros.
- Classificação: QuestionClassificationService mantém histórico com origem/confiança/revisor; CURRENT_LINKS resolve vínculo atual. O exportador atual não fornece snapshot curricular histórico.
- Família: EXACT_CONTENT_V1; conceptualEquivalenceVerified=false. Não tratar família como variante conceitualmente equivalente.
- Causa: payload e anotações posteriores existem, mas não chegam integralmente ao R.
- Identidade pessoal: produto inicialmente single-user; não inventar cadastro multialuno no SQLite para o laboratório.

## Primeiro experimento e ordem

1. Contrato exclusivo de laboratório, com mapa de disponibilidade real, validação e ausência explícita.
2. Simulador Python independente, 12 perfis quantitativos, aquisição/recuperação/ruído e duas hipóteses de esquecimento. Não é mecanismo operacional de memória do produto.
3. Adaptador R chama evaluate_baselines_temporally real, por estudante, sem estados latentes.
4. Separação observações/verdade/previsões/métricas; verdade só é persistida após TODOS os subprocessos R. Critérios gravados antes dos resultados.
5. Desenvolvimento com seeds 11,23,37,53,71. Comparação adicional com baseline global motivada pelo resultado de desenvolvimento, sem ajustar parâmetros do Motor.
6. Replicação com seeds novas 101,131,151,181,211. Comparadores: global versus fixos .50/.20; tópico suavizado versus global. Ambos Brier e log loss precisam apoiar melhora nos intervalos por seed para classificar superioridade somente neste simulador.
7. pyBKT/FSRS oficial, políticas de revisão, eficácia adaptativa, datasets e modelos complementares são gates posteriores separados, não resultados inventados do MVP.

A média histórica pode vencer um baseline fraco sem demonstrar aprendizagem individual. Melhor previsão não equivale a melhor intervenção. Não comparar P(acerto) do baseline com R mnemônico como se fossem a mesma grandeza.
