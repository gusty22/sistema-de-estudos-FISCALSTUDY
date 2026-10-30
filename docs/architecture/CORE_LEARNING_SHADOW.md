# Core App → orquestrador R: shadow v1

Base auditada inicialmente: `6489a1f6455161aec4cb581aeae14b76e64c19a3`. Base final após avanço de main e rebase: `b59041859d2c445cbfe5f4b8d5f581f7ef7f5096`, descendente da inicial. Branch: `feature/contextual-orchestrator-shadow`. Contratos e critérios: [OpenSpec](../../openspec/changes/core-learning-shadow/specs/core-learning-shadow/spec.md). Evidências de execução: [validação](CORE_LEARNING_SHADOW_VALIDATION.md). Mudanças upstream de retry e ferramentas preservadas.

## Diagnóstico da integração anterior

| Componente | Comportamento verificado e consequência |
|---|---|
| `AnalyticsProjectionService.exportPackageToDirectory/exportCsv` | Lê `EventStoreRepository.getEventsUpTo` com limite rowid, normaliza respostas/questões e entrega CSV + manifesto SHA-256. O próprio manifesto declara que integridade não autentica identidade pessoal. |
| `AnalyticsBridgeService.executeAnalyticsPipeline` | Exporta `REAL_STUDY`, chama `run_analytics.R` via `BoundedProcess`, lê métricas, sinais, perfil e pesos. Sucesso chama `cycle.injectWeights(weights)`; falha chama `injectWeights(null)`. **Não é uma execução shadow segura**. |
| `run_analytics.R` / `learning_profile.R` / `retention_analysis.R` | Perfil descritivo, calibração, análises temporais/retentivas, sinais heurísticos e pesos. Não chama `orchestrate_learning()`. Modelos legados não são autoridade de memória FSRS. |
| `run_learning_orchestrator.R` / `provenance.R` | CLI portátil anterior audita bytes CSV e ignora especialistas/autoridades importados. Falta um produtor operacional autenticado de inventário/autoridade. Flags JSON e atributos R não comprovam origem. CLI anterior preservada. |
| `learning_orchestrator.R` / `pedagogical_decision.R` | Admissão única, seis especialistas descritivos, três políticas, necessidades, rastro e replay já existentes. O novo adaptador os reutiliza. Correção pontual: inventário totalmente vazio retorna abstenção sem tentar ordenar colunas inexistentes. |
| `MaestroOrchestratorService.generateDailyPlan` | Constrói planejamento operacional Java a partir de rotina, edital, calendário e heurísticas. **Não é `orchestrate_learning()`**. Nenhuma ligação nova com ele. |
| `ProspectivePredictionService.prepare/exportSnapshot` | Compromissos prévios, snapshot delimitado e contexto curricular na criação da previsão. `ProspectiveExportAttestor` assina opcionalmente com chave previamente configurada, não criada automaticamente. Esse contrato de questões não autentica por si todo inventário/contexto do novo orquestrador. |
| `LearningEvidenceService` | Estado de item e recuperação pelo FSRS-6.0. `projectAttempt` também atualiza calendário: proibido no shadow. Reutilizado **somente** `preview(questionId, cutoff)`, nova sobrecarga pura com relógio explícito. |
| `StudentKnowledgeStateService` | Agregado legado inclui decaimento exponencial. Não exportado como recuperação FSRS nem domínio conceitual. |
| `QuestionSelectionService` / `QuestionRepositoryImpl` | Há leitura de lotes e registro separado de apresentação. Filtros por disciplina/assunto e fallbacks de concurso não comprovam associação conceitual. Shadow usa questão por ID, view `study_questions` e vínculo confirmado de `QuestionClassificationService.CURRENT_LINKS`; não apresenta ou escolhe próxima questão operacional. |
| `RevisionCalendarService` / `RobinHoodCycleService` | Possuem agendamento, conclusão e injeção de pesos. Não são dependências do caminho shadow. |
| `EventStoreRepositoryImpl` | Eventos append-only com identidade, tempos, versão e snapshot rowid. Novos resultados ficam em arquivos privados, sem tipos de eventos operacionais novos. |
| Edital/materiais/pré-requisitos | Repositórios `EditalRepository`, `StudyMaterialRepository` e links reais existem; `canonical_concept_prerequisites` e `edital_topico_concept_links` existem. Ausência de links não prova completude de pré-requisitos, disponibilidade física ou custo de leitura. Nenhum candidato de material é inventado. |
| Laboratório | `lab/decision_scientific_evaluation.R`: contratos de alvos, replay de políticas, registros de execução/previsão/desfecho com referências. Instrumentos prospectivos de aplicação/transferência e resultados futuros não aparecem automaticamente no log operacional. |

## Fronteira e responsabilidades

`LearningShadowSnapshotService.capture` executa leituras em transação Spring. Concurso e edital são explícitos, sem fallback; tópico exige confirmação registrada, vínculo questão-tópico exige última classificação confirmada, questão exige ausência de quarentena, status `VALIDADA`, enunciado e alternativas utilizáveis e gabarito definitivo. Status ausente permanece sem autoridade para inclusão. Não há entrada para JSON de candidatos, especialista ou registro de autoridade. `source-id` é configuração do host, não prova isolada de autoridade.

`LearningShadowService.observe(contest, edital, cutoff, availableMinutes, timeboxMinutes)` é API interna Java, sem endpoint, startup hook, cron ou consumidor operacional. Configuração padrão: `fiscalstudy.learning-shadow.enabled=false`. Exige `fiscalstudy.learning-shadow.source-id` não vazio. Executável: `fiscalstudy.learning-shadow.rscript` (padrão `Rscript`); timeout: `fiscalstudy.learning-shadow.timeout-seconds` (padrão 30, máximo 300). Não habilitar na instalação pessoal nesta rodada.

Disponibilidade de tempo e timebox são parâmetros deliberados do host. Não são estimativas aprendidas nem extração automática da rotina. A duração do candidato é um limite de execução configurado para diagnóstico/recuperação, identificado por `HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION`. Não há inferência numérica de ganho. Edital escolhido explicitamente não comprova sozinho que uma retificação posterior foi integralmente conciliada.

O Java identifica snapshot por SHA-256 de conteúdo com ordenação recursiva dos mapas (inclui rowid, instante da captura, cutoff das evidências, origem configurada, versões e hashes das doze fontes do fecho de dependências executadas); não inclui caminho temporário ou horário de serialização. Esse hash é identidade/integridade, **não assinatura**. Mudanças de fonte mudam a identidade. Mesma entrada arquivada produz a mesma decisão; uma nova captura em outro instante é uma nova entrada. Os testes usam relógio congelado para repetir capturas equivalentes. Versões efetivas de R/jsonlite/digest integram o snapshot decisório e a identidade do rastro. Pasta física é exclusiva por tentativa.

Segredo aleatório de 256 bits **efêmero por processo**, sem arquivo ou chave operacional persistente. Java calcula HMAC-SHA256 sobre bytes exatos da requisição e entrega segredo/MAC em ambiente herdado do filho. `run_core_shadow.R` autentica bytes antes de desserializar; confere fontes centrais; só então constrói especialistas e registro de autoridade em código. R autentica bytes da resposta com o mesmo segredo. Java verifica MAC em tempo constante, limites, versão, identidade/cutoff/contexto, partição de candidatos, escolha, comparação, replay e proibição recursiva de capacidades operacionais. MAC de saída é removido após validação: não serve como assinatura duradoura. Segredo não entra nos artefatos nem nos argumentos da linha de comando.

Hipótese de confiança: backend, fontes e executável R configurados e conta local íntegros. Um processo malicioso com acesso à memória/ambiente da mesma conta ou administrador está fora dessa fronteira. Não há sandbox de SO impedindo um executável comprometido de ler arquivos do usuário. O protocolo não entrega endereço/credenciais SQLite ao R e o código R não acessa SQLite. No Linux a pasta é 0700; no Windows aplica ACL do proprietário com herança aos arquivos (sem alegação de homologação pessoal). Os artefatos contêm evidências e exigem privacidade e retenção controlada pelo operador.

Falha, timeout, ausência do R, saída incompleta ou adulterada → `FAILED` com decisão nula; desativado → `DISABLED`. Diagnóstico privado em `process.log`/`failure.txt` quando possível. Não há fallback para outro motor nem chamada ao bridge que injeta pesos. O estudo normal não depende do resultado.

## Inventário mínimo e desconhecidos

Identidades: `diagnostic:<topic_id>:<question_id>` e `review:<topic_id>:<question_id>`. Escopo pedagógico do especialista de memória é **item**, não tópico. Cada candidato carrega questão, tópico, classificação, versão do inventário e fonte edital/versão. View publicada exclui itens bloqueados. Não se usam Pareto, frequência sem denominador, pesos default do tópico, similaridade textual ou primeira tentativa como prova de novidade cognitiva.

Diagnóstico com questões existentes não exige afirmar domínio dos pré-requisitos: `NOT_APPLICABLE` apenas para executar o diagnóstico. Aprendizagem de material e prática de aplicação permanecem bloqueadas até haver contratos de disponibilidade, vínculo, pré-requisitos e custo. Não foram criados tipos novos. Revisão exige estado canônico FSRS devido, versão compatível, contato anterior ao cutoff e evento correspondente. R constrói suporte de memória com referências ao estado e ao evento, sem escrever no histórico. O risco é a recuperação FSRS comparada ao alvo operacional 0,9 já usado pelo agendamento; não é limiar aprendido nem comprovação de previsão individual calibrada.

O snapshot usa **estado curricular/memória atual lido**, não reconstrução histórica. `evidence_cutoff` limita o histórico; `cutoff` decisório e `inventory_observed_at` vêm do relógio do produtor no instante de captura. A autoridade curricular vale apenas nesse instante observado: nunca é retroagida ao cutoff histórico. Eventos posteriores ao cutoff de evidências, classificações posteriores à observação e memória atualizada após o limite histórico falham de forma controlada. Respostas sem estudante/concurso explícitos são omitidas com motivo `HISTORICAL_STUDENT_OR_CONTEST_SCOPE_UNKNOWN`, sem copiar escopo do candidato para a tentativa. Não há histórico completo da confirmação de edital/pré-requisitos. Alterações concorrentes são delimitadas pela transação; atualizações posteriores não mudam artefatos anteriores. Reexecutar depois de mudar banco ou instante de captura é uma nova entrada, não replay da antiga.

## Especialistas e evidência pessoal

| Dimensão | Fonte adaptada / estado conservado |
|---|---|
| Conhecimento | Respostas, identidade, resultado avaliável e gabarito; ausência de relações conceituais temporalmente confirmadas preserva domínio desconhecido. |
| Aplicação | Sem instrumento operacional independente identificado, permanece `NOT_ESTABLISHED`. |
| Transferência | Sem instrumento/novidade/assistência comprovados, permanece `NOT_ESTABLISHED`. |
| Memória | Especialista descritivo de exposição não agenda. Suporte separado lê estado/recuperação canônicos FSRS; calibração pessoal permanece não estabelecida. |
| Metacognição | Confiança ordinal é transportada quando presente; não vira probabilidade ou causa psicológica. |
| Execução | Tempo ativo e intervenção registrados, quando presentes; assistência/exposição desconhecidas não viram independência. |

Os seis especialistas existentes sempre executam e conservam bloqueios/capacidades. Não ganham autoridade por receber JSON autenticado. Origem humana das respostas ainda não está independentemente comprovada por `REAL_STUDY`: o adaptador **não** cria atributos de proveniência pessoal nem converte fixtures em perfil pessoal. Consequentemente, personalização baseada nessas respostas permanece bloqueada. FSRS fornece estado operacional de item, não compreensão, aplicação ou transferência. Fixtures sintéticas podem testar o suporte FSRS e a seleção contextual sem alegar aprendizagem pessoal.

## Replay e laboratório

Resultado conserva `decision_trace`, `decision_inputs`, especialistas, admitidos/rejeitados/motivos, necessidades, regras/desempates, comparação e ledger pendente. As três políticas recebem a mesma admissão original; principal `EVIDENCE_CONTEXTUAL_V1`. Não há números de ganho esperado.

`scientific_policy_record` e `.se_replay_policy` são reutilizados sem duplicar avaliador. `scientific_record` preserva a decisão e o replay. `scientific_input`/`scientific_report` são produzidos **apenas na seam interna de instalação de fixture sintética dos testes**, autenticada no transporte. O construtor Spring operacional fixa esse modo em `false`; frontend, configuração pessoal, origem autodeclarada ou histórico vazio não podem habilitá-lo. Nos testes, `DECISION_COMMITTED` é registro privado do laboratório, não evento SQLite, sem previsão/desfecho fabricado. Em toda instalação operacional, inclusive cold-start sem respostas, entrada/relatório científicos ficam nulos e a avaliação fica pendente. Uma assinatura/custódia duradoura e cronologia independente de compromisso ainda serão necessárias para uso científico pessoal.

Pendências explícitas: execução autorizada, instrumento/alvo/previsão previamente comprometidos e resultado futuro. Comparação de escolhas não é qualidade preditiva, associação não é causalidade, política não executada não recebe crédito. Piloto `NOT_STARTED`, cobertura prospectiva global `FAIL`, seis alvos `NOT_ESTABLISHED` e instalação pessoal não homologada permanecem inalterados.

## Recuperação de contexto

Graphify e OpenSpec CLI ausentes no PATH. Após incorporar o helper upstream, `context.py doctor/status` indicou grafo desatualizado; `update` foi tentado uma vez e retornou indisponibilidade. Busca seletiva convencional e fallback do helper usados; contratos OpenSpec registrados em arquivos, sem alegar validação pelo CLI. Obsidian sem vault configurado ou índice disponível; nada foi escrito nele. Skills locais utilizadas: `implement`, `verification-before-completion`, `systematic-debugging`, `code-review` e `fiscalstudy-context-and-evidence`. Notas antigas do índice não prevaleceram sobre Git, código e testes da base atual.
