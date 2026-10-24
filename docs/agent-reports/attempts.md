# Tentativas, eventos e histórico — checkpoint

Responsável real: attempts_resume. Cópia: <implementation-checkout>. Originais e recovery não modificados.

## Implementado
- F06/F07: attemptId UUID por tentativa; PK event_id=attempt:<UUID>, INSERT ON CONFLICT(event_id) DO NOTHING atômico. Novo ID permite reteste; mesmo ID retorna gabarito/resultado persistidos. Divergência question/session/option/confidence/activeTime/usedHelp rejeita409.
- Compatibilidade: clientes antigos sem ID recebem UUID gerado pelo servidor, mas precisam atualizar para retries idempotentes. Não se promete idempotência sem chave enviada.
- F08: POST /api/v1/questions/{id}/attempts/{attemptId}/annotations, annotationId UUID e causaErro self-reported. Novo evento ATTEMPT_ANNOTATED, sem UPDATE da resposta. Reenvio idêntico é idempotente; colisão409. Texto normalizado trim, conteúdo interno serializado Jackson.
- Anotação posterior consumida por SessionController resumo, QuestionHistoryService histórico e taxonomia em PerformanceIntelligenceService via AttemptAnnotationView read-only; última por occurred_at,rowid.
- JSON de resposta via Jackson, incluindo memória PRÉ-resposta, origem, attemptId e snapshot gabarito.
- Projeção LearningEvidenceService integrada após insert exclusivo; retry recupera projeção idempotente. Falha explícita503 PROJECTION_PENDING e header X-FiscalStudy-Attempt-Persisted=true; histórico não apagado.
- F02 parcial: origem da instância prevalece; cliente só downgrade; prefixos teste/demo. Anki/media/legacy revision não acionados por evidência não elegível. Histórico anterior de exposição só REAL_STUDY. Legacy revision desativado quando LearningEvidenceService presente (autoridade adaptive).

## Testes
AttemptIdentityRegressionTest contém8 testes SQLite @TempDir, sem Spring startup/Anki real: retry+novo reteste; gabarito persistido; escapes JSON+anotação; concorrência12envios; downgrade origem; falha projeção+retry; ausência chamadas externas de teste; anotação no resumo.
Root executou primeira bateria:7 testes anteriores,1 falha na expectativa de whitespace trim. Expectativa corrigida para contrato trim; adicionado oitavo teste. Resultado da nova execução ainda pendente neste checkpoint. Não declarar validado até root coletar saída.

## Contratos e limites
- Payload de retry congelado pelo frontend, inclusive tempo/confiança/usedHelp. Anotações posteriores usam endpoint próprio.
- Resta auditar/filtrar todos os consumidores legados de analytics por finalidade; este agente não alterou indiscriminadamente todos SQLs históricos.
- Histórico desconhecido não promovido a REAL_STUDY.
- Não houve migração necessária para identidade: PK existente suficiente.
- Reversão: diff de código na branch, sem commit/push; originais preservados. Não apagar eventos coletados para reverter código.
