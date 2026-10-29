# Cobertura prospectiva dos fluxos de questões

Estado pessoal: **NOT_STARTED**, ativação não autorizada. Base main `091ccb89a08e549af8ccf3424160345f6a1a1187`, PR #46 integrada pelo mantenedor; CIs Linux/Windows de `0f3af68` aprovadas antes desta branch. Nenhum merge/automerge realizado nesta operação.

## Habilitação e funcionamento desligado

A captura exige **três condições simultâneas**, todas desligadas por padrão:

1. Frontend executado/compilado com `VITE_FISCALSTUDY_PROSPECTIVE_CAPTURE=true`.
2. Host Java com `fiscalstudy.prospective.capture-authorized=true`.
3. Host Java com `fiscalstudy.prospective.capture-enabled=true`.

Essas condições são habilitação técnica, não prova de consentimento pessoal: qualquer configuração operacional futura depende de autorização explícita posterior. Nesta operação são usadas **somente nas fixtures isoladas**. Nenhuma opção foi ativada na instalação pessoal; nenhuma chave operacional foi criada.

[prospectiveCapture.ts](../../frontend/src/utils/prospectiveCapture.ts) retorna desligado sem consulta experimental quando o opt-in do frontend está ausente. Quando solicitado, consulta estado tipado/no-store do host; JSON/localStorage não alteram configuração do backend. [ProspectivePredictionService](../../backend/src/main/java/com/fiscalstudy/backend/application/ProspectivePredictionService.java) recusa preparação sem as duas flags do host, inclusive se um cliente chamar diretamente a API. O endpoint de estado é somente leitura e não ativa nada. Exportação e recuperação de registros existentes não criam compromissos.

Desligado, os componentes usam submissão normal, identidade mantida em memória para retry e nenhum novo `PREDICTION_COMMITTED`. Não leem o journal experimental para congelar/reclassificar essa resposta; entradas antigas não são apagadas. O cache preexistente de navegação da sessão não é uma previsão. Ajuda ausente é omitida no cliente: o campo operacional legado pode continuar `usedHelp=false` por compatibilidade interna, mas `helpDeclarationProvided=false` preserva o desconhecido e exclui a observação do alvo prospectivo. A lógica FSRS não foi alterada.

## Matriz de chamadores e fronteiras

Inventário do código desta árvore, por busca de apresentações, submissões, recuperações, feedback e exportações. Clientes externos desconhecidos não são considerados cobertos só porque usam uma API compartilhada.

| Caminho real | Apresentação / envio / feedback | Preparação, journal e identidade | Evidência e escopo |
|---|---|---|---|
| [App → QuestionViewer](../../frontend/src/App.tsx), sessão normal | `/questions/batch` ou `/next`; recibo `/presented`; `AttemptSubmission` → `/attempts`; feedback do servidor | Condicional às três flags; `ProspectivePreparation`, journal por questão/sessão, UUID imutável. GET recupera antes de confiar em sucesso local. | PASS de software do caminho ordinário: browser real, Java/SQLite/R, off/on. Suite browser anterior mantém perda de ack, reload, reinício e troca rápida. Não prova prontidão pessoal. |
| Dashboard, busca, cadernos/simulados, caderno de erros → `App.handleNavigateToStudy` / `handleStartSimulado` / `handleStartErrorNotebook` | Delegam ao QuestionViewer; não há um segundo emissor ordinário nessas telas | Herdam o fluxo **quando a resolução efetivamente passa pelo viewer** | Handoff identificado no código. Variações completas de configuração de cada caderno/simulado não foram homologadas separadamente; não alegar cobertura integral dessas modalidades. |
| [BancoQuestoes → ResolucaoQuestaoModal](../../frontend/src/components/questoes/BancoQuestoes.tsx) | `/bank/questions`; modal usa a mesma questão carregada; recibo `/presented` quando capturado; `/attempts`; feedback confirmado | Agora condicional, com contexto persistente por banco/concurso, preparação confirmada, journal e UUID. Fechar/reabrir/reload recuperam o mesmo intento. | PASS de software, **rota de produto real** no browser: falha/ack perdido, retry, clique concorrente, desconhecido, fechamento/reabertura/reload, nova tentativa explícita e troca de questão. |
| [SessaoEstudoAtiva no App](../../frontend/src/components/timer/SessaoEstudoAtiva.tsx) | O App passa `onOpenQuestions`; a ação encaminha ao QuestionViewer | A resolução real segue o viewer; não presumir que sempre abre modal embutido | Wiring inspecionado. Destino viewer exercitado; handoff completo com todas as configurações de sessão não reivindicado como PASS independente. |
| SessaoEstudoAtiva **sem** `onOpenQuestions` → modal embutido | Fallback existente consulta banco, agora lê `questions` (contrato real), mantendo alias `items` para compatibilidade | Mesmo modal, contexto separado por origem/disciplina/tópico, sem compartilhar UUID do banco | PASS em **fixture do componente pai real** + backend/R reais. A entrada HTML existe só em tests/fixtures e recusa conteúdo sem prefixo sintético; não é rota nova de produto nem evidência da instalação pessoal. |
| [AttemptSubmission](../../frontend/src/utils/attemptSubmission.ts) | Único helper encontrado enviando `/questions/{id}/attempts`; confirma UUID e deduplica Promise por instância | Sozinho **não garante preparação**. `useJournal=false` isola modo normal; helpers capturados congelam payload e recuperam pelo servidor | Não promover qualquer chamador futuro apenas por compartilhar essa classe. Backend mantém idempotência/append-only; testes contam cada desfecho físico pelo UUID. |
| [QuestionController](../../backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/QuestionController.java), chamadas diretas | Permite resposta normal sem forecast, deliberadamente | Sem preparação não há vínculo prospectivo. Preparação posterior ao mesmo `attemptId` é recusada | Teste real HTTP com flags ligadas: resposta sem previsão, backfill 409, resposta preservada no denominador. **Não coberto como coleta prospectiva de clientes arbitrários.** |
| [ReverseEngineeringModal](../../frontend/src/components/cognitive/ReverseEngineeringModal.tsx) → ReverseEngineeringController/Service | `/cognitive/reverse-engineering/answer`, evento `REVERSE_ENGINEERING_ANSWER_SUBMITTED`; alvo/feedback próprios | Não usa preparação/journal ordinários. Não converter seu resultado em `ANSWER_SUBMITTED` ou forecast retrospectivo | **FORA DO ESCOPO prospectivo ordinário / FAIL de cobertura integral**. Exportador do piloto não seleciona esse tipo de evento. Nenhuma mudança nessa lógica. |
| `QuestionHistoryModal`, `RelatorioSessaoQuestoes`, `DiagnosticoComportamental`, revisão de erros | Exibem resultados/alternativas já conhecidos, usando histórico e feedback | Leitura/diagnóstico, não novo desfecho independente. Anotações usam `ATTEMPT_ANNOTATED` com UUID, sem reescrever resposta | Não geram previsão para explicar retrospectivamente um resultado; não são prova de novidade/transferência. |
| `ImportStudio`, `AuditCockpit`, `QuestionPreviewModal`, classificação | Preview e curadoria podem exibir gabarito; são rotas administrativas | Sem coleta ordinária prospectiva | Exposição incompleta permanece desconhecida. Não classificar “primeira tentativa registrada” como item novo. Não criar experiências nessas telas. |
| Calendário/recuperação, Anki e telemetria cognitiva | Tipos especializados como `RECOVERY_ATTEMPT_RECORDED`, `ANSWER_SWITCHED`; exportações próprias | Não são compromissos do contrato ordinary-question; não foram alterados | Não contam como outcomes deste alvo. Preservar FSRS/calendário e autoridades existentes. |

**Cobertura integral permanece FAIL.** A lacuna do modal ordinário foi corrigida; a autorização futura poderia ser restrita à sessão normal de questões e ao modal do banco, após os demais gates. Simulados completos, clientes externos e alvos especializados não recebem PASS por transitividade ou por teste isolado de um componente.

## Semântica do modal e ajuda

[ResolucaoQuestaoModal](../../frontend/src/components/questoes/ResolucaoQuestaoModal.tsx) só libera resposta após confirmação do servidor quando capturado. O contexto persistente permite retomar uma tentativa após fechamento ou reload, sem gerar outro UUID. Resposta já confirmada é recuperada, sem nova submissão. “Nova tentativa” aparece somente nesse modo após feedback e cria contexto novo explícito, mantendo journals antigos; evita interpretar reabertura como novo desfecho. Contextos de banco e sessão ativa são distintos.

Payload pendente é congelado antes do POST. Reenvio usa os mesmos campos, tempo e UUID. Escopo atual protege contra resposta atrasada de outra questão, revisão ou modal desmontado. Cliques concorrentes compartilham a mesma Promise; servidor mantém unicidade/idempotência. Journal danificado ou recuperação sem compromisso válido falha sem apagar dados ou fabricar forecast.

Ajuda começa em “Não informada”. Sem declaração, o cliente omite `usedHelp`/`helpType`; R exclui por `MISSING_HELP_DECLARATION`. “Não usei ajuda” registra falso explícito, “Usei ajuda” registra verdadeiro; apoio conhecido aberto no viewer também registra ajuda. Isso não prova ausência de ajuda invisível. Nenhum acerto imediato se transforma em retenção tardia, transferência ou conhecimento conceitual.

## Exportadores: compatibilidade sem alegação indevida

| Exportador | Tipo inequívoco | Limite |
|---|---|---|
| [AnalyticsController](../../backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/AnalyticsController.java) `/export`, `/questions-v1`, `/events-v1`; AnalyticsBridge `/export-csv`; sincronização local | CSV descritivo; cabeçalho HTTP `X-FiscalStudy-Export-Kind: DESCRIPTIVE_CSV` nos downloads AnalyticsController | Dados/colunas/ETag preservados. Hash/manifesto são integridade, não autenticação pessoal. Bridge/sync são consumidores descritivos, não snapshots prospectivos assinados. |
| `/analytics/export/manifest` | `DESCRIPTIVE_CHECKSUM_MANIFEST` | Não compromete previsões nem comprova anterioridade. |
| [PainelDesempenho](../../frontend/src/components/analytics/PainelDesempenho.tsx), [export_pilot_session.ps1](../../scripts/export_pilot_session.ps1) | Rótulos corrigidos para **CSV descritivo**; removida mensagem de “piloto validado” | Mantidos URLs/formato/uso descritivo; não executar como prova prospectiva autenticada. |
| [ProspectivePredictionController](../../backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/ProspectivePredictionController.java) `/learning-lab/prospective-export` | `PROSPECTIVE_EVENT_SNAPSHOT` | Pode estar unsigned quando não há chave. Só a assinatura verificada com raiz externa pelo CLI da PR #46 estabelece custódia condicional. Cabeçalho/rótulo não concede confiança. |

Sem migração, alteração de histórico ou previsões retroativas. As flags de captura não provisionam assinatura, não iniciam sessão e não alteram autoridade do Motor R (`can_apply=false`, `can_schedule=false`).

## Evidências e reprodução

Ver [harness sintético](../../frontend/tests/fixtures/question_flow_coverage/README.md), [resultados locais](validation/question-flow-coverage/results.txt) e CI prospectiva, que preserva os gates anteriores e acrescenta browser real nos dois modos e regressões frontend no Windows nativo. O teste novo inicia somente Java/Vite/SQLite isolados em diretório temporário autorizado; nenhum banco pessoal é aberto. O fallback do pai é declarado como fixture, distinguindo-o das rotas de produto reais.

Uma execução local final: desligado, **0 previsões e 2 respostas sem previsão**; ligado, **7 previsões, 2 scores, 5 exclusões/pendências e 1 resposta sem previsão**. R avaliou o JSON exportado pelo Java, não um registro reconstituído manualmente; replay do mesmo arquivo idêntico. Contagem de pendências pode variar entre novas gerações por requisições em voo, sempre preservadas no snapshot/cutoff; o teste valida identidades e denominadores, sem apagar pendências para ajustar números.

Testes sintéticos validam software. Instalação pessoal, relógio, chave, armazenamento e autorização continuam **NOT_VERIFIED/FAIL** no [checklist](results/pilot_activation_gate_v1.json). Estado final **NOT_STARTED**. Seis novos alvos e benefício pedagógico/causal permanecem `NOT_ESTABLISHED`.
