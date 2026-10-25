# Publicação sanitizada

Esta cópia substitui somente caminhos locais pessoais por placeholders. A linha de base original permanece preservada no snapshot local. SHA-256 do original: `5d7de9d0a3dc6705fd87fee0abee0dbe9331a384c9871e7621dc849f61478335`. Esta publicação não é uma cópia byte a byte do original.

# FiscalStudy — auditoria técnica e funcional do estado atual

**Data:** 23/10/2026, America/Sao_Paulo. **Modo:** diagnóstico somente; sem correções, exclusões, migrações, commits ou push. **Fonte principal:** código local e bancos consultados em leitura.

## 1. Visão geral, conclusão e limites

O FiscalStudy possui um monólito local com muitas funcionalidades concretas, mas sua amplitude é maior que a consistência comprovada entre módulos. A principal necessidade é consolidar dados, contratos e caminhos ativos. Não recomendo reescrita geral nem ampliar o catálogo de funcionalidades neste momento.

O bloqueio central da adaptação não é a ausência de mais modelos: **as 13.241 questões do banco principal estão sem assunto; as seis respostas existentes são de testes automatizados**. O edital tem 181 tópicos, mas o serviço de conhecimento descarta respostas a questões sem assunto. Portanto, a base atual não demonstra diagnóstico pessoal por tópico nem aprendizagem adaptativa validada.

Também foram confirmados defeitos em busca global, persistência de simulados e atualização parcial de progresso. Os resumos iniciais apresentam títulos e páginas semeados pelo próprio código; isso não comprova consulta ao material. As preferências existem, mas várias só são persistidas e exibidas no formulário.

### O que a auditoria abrangeu

- Inventário recursivo de arquivos, excluindo dependências instaladas, diretórios Git internos, caches convencionais e artefatos de build da varredura de fonte.
- Indexação textual de **519 arquivos próprios** selecionados por extensão/tamanho, consulta do grafo AST existente, cruzamento de imports frontend e análise dirigida dos caminhos críticos.
- Código principal Java: **155 arquivos** (38 de application, 39 de domain, 77 de infrastructure e a aplicação). Compilação de **43 classes de testes existentes**, sem incluir a correção isolada da entrega anterior.
- Bancos principal e staging em conexão readonly, query_only e transações de leitura para as inspeções iniciais; dados agregados e preparação de SQL. Duas reproduções adicionais ocorreram somente em memória/prepare.
- Seis projetos de referência, com manifests, licenças disponíveis e mecanismos selecionados. **Não houve leitura manual integral das 7.587 peças de referência nem auditoria exaustiva de cada linha do produto.** Inventário e varredura não equivalem a validação de todo comportamento.
- Frontend em cópia isolada: TypeScript, build e lint; backend: testes de domínio; R: executor completo de testes existente.

### Limites que impedem certificar funcionamento integral

O sistema original estava desligado nas portas usuais 8080 e 5173. Não o iniciei, porque startup contém alteração de schema, limpeza de pendências, seeds e sincronização Anki. A tentativa de prévia isolada no navegador falhou por cache de dependências compartilhado protegido; o navegador recebeu conexão recusada. Assim, **não há homologação visual/ponta a ponta, responsividade ou acessibilidade certificadas**. Não atribuo ao produto o EPERM do ambiente de auditoria.

O Git exibiu histórico, mas status retornou erro de worktree, mesmo com diretórios explícitos. HEAD aponta main e o log mais recente observado é c26ee20. Não atestei árvore limpa, arquivos rastreados, histórico completo nem equivalência com o GitHub. Não houve consulta remota bem-sucedida nesta etapa. Não foi executada auditoria de CVEs, teste de invasão ou validação de implantação.

A comparação final de fontes principais lidas não detectou alterações nos originais. Todo build/teste e seus artefatos ficaram na cópia de auditoria. **A correção preparada na entrega anterior não foi aplicada ao projeto original nem incorporada nesta nova cópia.**

### Maturidade por dimensão

| Dimensão | Diagnóstico baseado em evidências |
|---|---|
| Amplitude funcional | Alta para um projeto pessoal; muitos fluxos e serviços reais |
| Integração | Inconsistente: contratos de banco e gravação divergem entre módulos |
| Dados para adaptação | Insuficientes no estado observado: sem assunto e sem respostas reais |
| Ciência da aprendizagem | Mecanismos presentes, com confusão entre hipótese, estimativa e observação |
| Operação/recuperação | Precisa de revisão antes de confiar em backup/restauração pela interface |
| Personalização | Parcial; controles e armazenamento não garantem efeito funcional |
| Multiusuário | Não implementado de forma isolada no banco atual; não necessário ao uso pessoal enquanto escopo for explícito |
| Validação | Compilação/build passam, mas lint e testes R não estão limpos e integração completa não foi executada |

## 2. Inventário técnico e arquitetura

### Tecnologias

Backend: Java alvo 17; Spring Boot 3.3.4; Web, Data JPA, Validation, SQLite JDBC 3.46.1.0, Hibernate community dialect. Persistência concreta inclui bastante JdbcTemplate/SQL direto, não apenas JPA. Não foram encontradas dependências Spring Security ou Flyway no pom inspecionado.

Frontend: React/React DOM ^19.2.8, TypeScript ~6.0.2, Vite ^8.3.0, lucide-react e oxlint. Build usou Vite **8.3.4** instalado. Navegação é estado de abas em App.tsx com imports estáticos; há localStorage, sessionStorage e contexto de modo simplificado.

Ingestão: Python com extração textual/layout/imagens, pipeline em staging, curadoria e publicação. Existem caminhos parser/main.py, pipeline/pipeline_runner.py, batch_processor.py e publish_verified.py. Não classificar todos como duplicatas: há entradas manuais, de lote e integração via processo. Não foi encontrado manifesto Python no código próprio inventariado.

Analytics: Base R com módulos de validação, proveniência, descrição, retenção, perfil, intervenções e recomendações; Java exporta CSV e lê JSON. Há engine integrado, uma cópia irmã e scripts legados em analytics/. Anki é integração HTTP local com acionamento de sincronização AnkiWeb.

### Diretórios inventariados

As contagens excluem node_modules, target, dist, .git e caches convencionais da recursão; os tamanhos não representam o tamanho total ocupado no disco. Arquivos de instrução/ferramental também foram considerados internamente, sem serem confundidos com funcionalidades do produto.

| Diretório/arquivo | Arquivos | MiB inventariados |
|---|---:|---:|
| AGENTS.md | 1 | 0.00 |
| analytics | 10 | 0.08 |
| analytics-engine | 61 | 0.49 |
| backend | 214 | 2.01 |
| db | 33 | 188.69 |
| docs | 13 | 0.25 |
| FiscalStudy_Kit_Retomada_2026-10-11 | 3 | 0.02 |
| frontend | 128 | 2.28 |
| graphify-out | 1697 | 74.84 |
| ingestion | 92 | 33.61 |
| openspec | 3 | 0.00 |
| output | 1 | 0.00 |
| README.md | 1 | 0.00 |
| references | 7587 | 324.28 |
| scratch | 77 | 4.57 |
| scripts | 5 | 0.03 |
| tests | 12 | 19.00 |

### Fluxos e módulos conectados

- App/Sidebar: concurso ativo, tema, abas e atalhos; fluxos de onboarding, questões, sessões, planejamento, desempenho, materiais, resumos e administração.
- Questões: QuestionController → AttemptSubmissionService → EventStoreRepository. Também há QuestionBankService e resolutor específico do banco, que convivem com QuestionViewer.
- Planejamento: StudentRoutineService, MaestroOrchestratorService, RobinHoodCycleService, SwotCycleCalibratorService e serviços de revisão. São responsabilidades sobrepostas, não automaticamente substitutos obsoletos.
- Conhecimento: StudentKnowledgeStateService e PerformanceIntelligenceService atuam na aplicação; TopicMastery/FsrsEngine/DynamicStudyCycleEngine formam outro conjunto de domínio cuja conexão produtiva completa não foi encontrada.
- Materiais: biblioteca, leitor, vínculos com tópicos, progresso e sessões. Tabelas study_materials e support_materials têm finalidades diferentes e **não são duplicatas**: biblioteca do aluno versus apoio ao enunciado.
- Ingestão: sessão/upload → Python/extrator → staging → curadoria → publicação → questions/support_materials. publish_verified.py usa backup SQLite e transação, mas outros caminhos de banco/backup não são igualmente consistentes.
- Integrações: exportação CSV → engine R → artefatos JSON → pesos/sinais; fila Anki → Desktop → possível AnkiWeb. As preferências de privacidade ainda não governam todo esse percurso.

**Legenda dos caminhos na seção 3:** B/ = backend/src/main/java/com/fiscalstudy/backend/. Caminhos de serviços sem prefixo repetido se referem ao mesmo diretório application; nomes de componentes se localizam em frontend/src/components. As referências de linhas apontam o conteúdo lido, não apenas nomes de arquivos.

## 3. Problemas, duplicidades, riscos e recomendações

São **36 registros de achados**, incluindo defeitos, limitações de produto e candidatos de manutenção. Prioridade considera o uso pessoal/local atual; risco de rede é explicitamente condicional. Ausência de ocorrência no banco não elimina risco de código, e risco de código não é apresentado como incidente já ocorrido.

### F01 — Banco sem classificação por assunto

**Prioridade:** Alta.

**Evidência:** SQL somente leitura: 13.241/13.241 questions.assunto IS NULL. B/application/StudentKnowledgeStateService.java:320–322 ignora assunto vazio; B/infrastructure/out/persistence/QuestionRepositoryImpl.java:96–99 filtra esse campo.

**Impacto:** Diagnóstico e seleção por tópico não têm os dados necessários. 181 tópicos do edital não equivalem a questões vinculadas.

**Recomendação para etapa futura:** Definir vínculo canônico questão→tópico com confiança, origem e revisão humana; preservar não classificado e medir cobertura antes de alimentar domínio.

**Dependências:** Taxonomia, política de curadoria e conjunto rotulado de validação.

**Reaproveitamento:** Question_Extractor: fatores de confiança e fila de revisão; adaptar o padrão para classificação, sem presumir que ele classifique assuntos.

### F02 — Histórico observado não comprova uso de estudo real

**Prioridade:** Alta.

**Evidência:** Banco principal: 107 eventos; seis ANSWER_SUBMITTED, todos origin=AUTOMATED_TEST. StudentKnowledgeStateService.java:303–309 não filtra origin.

**Impacto:** Os indicadores podem processar testes como se fossem resultados pessoais. Não existe aqui evidência de eficácia adaptativa individual.

**Recomendação para etapa futura:** Centralizar elegibilidade de evidências por origem e finalidade; separar histórico desconhecido, demonstração e teste; não reclassificar eventos retroativamente como reais.

**Dependências:** Contrato de proveniência e consumidores Java/R alinhados.

**Reaproveitamento:** analytics-engine/R/provenance.R e seus testes já oferecem separação mais cuidadosa.

### F03 — Hooks condicionais nos fluxos de abertura

**Prioridade:** Alta.

**Evidência:** Lint: MotorParetoEditalModal.tsx:136 e AssistenteObjetivoWizard.tsx:231,236,241,254. Ambos possuem return por !isOpen antes desses Hooks.

**Impacto:** Abrir/fechar componentes pode quebrar a ordem de Hooks. Cinco erros estáticos reais; reprodução visual não concluída.

**Recomendação para etapa futura:** Na fase de correção, preservar ordem incondicional de Hooks e validar abertura/fechamento com testes de interação.

**Dependências:** Baseline da interface e teste automatizado de transições.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F04 — Cadernos e simulados usam DDLs incompatíveis

**Prioridade:** Alta.

**Evidência:** QuestionBankService.java:533 e StrategicSimuladoService.java:46 criam study_notebooks com colunas distintas. Banco atual não possui tempo_minutos; INSERT do simulado em :196 exige essa coluna. O catch :199–201 não impede retorno de notebookId em :203–214.

**Impacto:** Simulado pode aparentar ter sido criado sem persistência; instalação nova depende da ordem de criação das tabelas.

**Recomendação para etapa futura:** Uma migração canônica e erro de API em falha de persistência; verificar esquema existente antes de migrar.

**Dependências:** Snapshot consistente e migração testada em bancos novos e existentes.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F05 — Busca global incompatível com o schema real

**Prioridade:** Alta.

**Evidência:** SystemSettingsService.java:534 usa questions.statement; :560 usa materials/title; :583 usa study_notebooks.title/mode/question_count. Preparação das consultas no SQLite reproduziu no such column/table, sem executar escrita.

**Impacto:** QUESTOES, MATERIAIS e ATIVIDADES podem parecer vazias por falha capturada.

**Recomendação para etapa futura:** Consumir repositórios canônicos e distinguir falha de fonte de zero resultados.

**Dependências:** Contrato do banco e testes de integração da busca.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F06 — Causa do erro enviada pela interface não é registrada

**Prioridade:** Alta.

**Evidência:** ResolucaoQuestaoModal.tsx:257–275 reenvia tentativa para registrar causaErro depois do feedback. AttemptSubmissionService.java:162–164 retorna antes da gravação quando a questão já existe na sessão.

**Impacto:** A taxonomia e as intervenções não recebem a informação que o estudante acredita ter salvo.

**Recomendação para etapa futura:** Criar evento separado de anotação/correção da tentativa, ligado ao attemptId, preservando append-only.

**Dependências:** Identificador estável da tentativa e contrato de anotação.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F07 — Sessão do banco reutilizada e tempo confundido com atividade

**Prioridade:** Alta.

**Evidência:** ResolucaoQuestaoModal.tsx:72–78 persiste fiscalstudy_bank_session_id em sessionStorage; busca textual encontrou apenas leitura/escrita dessa chave. Mesmo sessionId ativa deduplicação por questão. Cronômetro :95–100 mede visibilidade da página, não interação.

**Impacto:** Retestes na mesma aba podem ser ignorados; ficar com a aba visível infla tempo dito ativo.

**Recomendação para etapa futura:** Ciclo de vida explícito de sessão e attemptId por tentativa; documentar tempo de tela e medir atividade com critérios transparentes.

**Dependências:** F06/F08 e política de sessão; sem inferir atenção neurológica.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F08 — Idempotência não atômica e JSON manual

**Prioridade:** Alta.

**Evidência:** AttemptSubmissionService.java:162 usa hasEvent; EventStoreRepositoryImpl.java:46 consulta separadamente da inserção. Payload manual em AttemptSubmissionService.java:223.

**Impacto:** Concorrência pode duplicar eventos; replay calcula resultado usando a alternativa reenviada; textos podem gerar JSON inválido. No banco observado não havia duplicatas de resposta nem JSON inválido.

**Recomendação para etapa futura:** Serialização estruturada, chave idempotente e retorno do resultado persistido; migração de unicidade apenas após inventário.

**Dependências:** Contrato de tentativa e backup; a correção da entrega anterior permanece apenas na cópia isolada, não foi aplicada ao original.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F09 — Revisões podem ser adiadas e misturadas entre concursos

**Prioridade:** Alta.

**Evidência:** RevisionCalendarService.java:201 sobrescreve data_agendada mantendo MAX da prioridade. Deduplicação no startup :47 particiona só disciplina/topico; procura pendência sem concurso.

**Impacto:** Acerto posterior pode adiar revisão motivada por erro; concursos podem compartilhar ou perder pendências indevidamente.

**Recomendação para etapa futura:** Estado de pendência por escopo canônico; transições explícitas e histórico de replanejamento.

**Dependências:** Identidade de tópico/concurso, migração preservando histórico.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F10 — Duas rotinas para o mesmo concurso e fallback cruzado

**Prioridade:** Alta.

**Evidência:** SQL: duas student_routines para o mesmo concurso. StudentRoutineRepositoryImpl.java:63–66 pega list.get(0) sem ordenação; :70 retorna rotina global mais recente em ausência.

**Impacto:** Planejamento pode escolher rotina não determinística ou de outro objetivo.

**Recomendação para etapa futura:** Definir uma rotina ativa por escopo, seleção explícita e restrição de integridade após resolver duplicatas.

**Dependências:** Auditoria dos registros duplicados e semântica de versões de rotina.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F11 — Personalização configurável não é política efetivamente aplicada

**Prioridade:** Alta.

**Evidência:** SystemSettingsService.java:110–158 define duração, fonte, limites de revisão, sono e privacidade. Buscas no código próprio encontraram essas chaves no serviço e formulário, não nos respectivos motores. App.tsx usa fiscalstudy_calm_theme separadamente.

**Impacto:** Salvar preferências não garante alteração do comportamento; duas fontes de tema podem discordar.

**Recomendação para etapa futura:** Mapear cada preferência a consumidor, efeito e teste; retirar ou rotular controles ainda não conectados.

**Dependências:** Contrato tipado de preferências e escopo por perfil.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F12 — Integração Anki pode sincronizar fora do controle de privacidade anunciado

**Prioridade:** Alta.

**Evidência:** AnkiIntegrationService.java:45 autoSyncEnabled inicia true, :784 agenda 25s, :767–773 chama AnkiWeb após envio. Toggle :813–820 é estado em memória. Não se localizou consumo de armazenamentoLocalEstrito nessa integração.

**Impacto:** Preferência visual de armazenamento local não governa o fluxo de sincronização; reinício retorna ao padrão.

**Recomendação para etapa futura:** Consentimento e opções independentes para fila local, Anki Desktop e AnkiWeb, persistidos e efetivamente consultados; impedir efeitos externos nos testes.

**Dependências:** F11 e política de integração.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F13 — Restauração de backup não está confinada nem coordenada com conexões

**Prioridade:** Alta.

**Evidência:** SystemSettingsService.java:315 combina pasta com filename sem normalização/containment; :334 substitui arquivo com pool JDBC ativo. Controller :61–67 aceita filename.

**Impacto:** Risco de restaurar caminho fora da pasta e inconsistência com WAL/conexões existentes. Exploração não executada; exposição depende da rede.

**Recomendação para etapa futura:** Restauração offline/coordenada, caminho validado por pertencimento, verificação de formato e ensaio de recuperação.

**Dependências:** Fluxo de manutenção e segurança de API; não usar o recurso atual como recuperação comprovada.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F14 — Backup/overview usam caminho diferente do datasource e logam schema inválido

**Prioridade:** Alta.

**Evidência:** application.yml usa ../db/fiscalstudy.db; SystemSettingsService.java:26 usa db/fiscalstudy.db. VACUUM INTO usa datasource, mas fallback Files.copy :230 usa caminho fixo. INSERTs de auditoria :242 e :344 usam payload/timestamp inexistentes; prepare reproduziu erro.

**Impacto:** Overview e fallback podem mirar banco vazio/errado ao iniciar no backend; criação/restauração não registra evento esperado.

**Recomendação para etapa futura:** Derivar caminhos da configuração única; manter backup consistente e contrato canônico de eventos; falha no fallback deve ser explícita.

**Dependências:** F13, definição do diretório de execução e teste de backup/restauração.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F15 — Staging possui sete violações referenciais

**Prioridade:** Alta.

**Evidência:** PRAGMA foreign_key_check encontrou sete staging_support_materials órfãos de staging_documents. StagingDatabaseService.java:56 abre conexão sem ativar foreign_keys; deleteStagingFile :673–678 não apaga os materiais de apoio antes dos documentos.

**Impacto:** Acervo e evidências ficam inconsistentes. A relação com esse caminho de exclusão é inferência plausível, não reconstituição histórica provada.

**Recomendação para etapa futura:** Auditar/reconciliar órfãos e impor integridade em toda conexão; teste transacional de exclusão com materiais.

**Dependências:** Backup do staging e política para evidências compartilhadas.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F16 — Dependências R ausentes e exportação JSON silenciosamente omitida

**Prioridade:** Alta.

**Evidência:** Teste isolado: 291 verificações aprovadas, duas falhas. digest não instalado; export_metrics_package (R/export_results.R:171–174) simplesmente não escreve JSON sem jsonlite. Teste exige o arquivo.

**Impacto:** Pipeline pode produzir apenas CSV e preservar JSON antigo no disco; ambiente não é reproduzível como descrito no README.

**Recomendação para etapa futura:** Manifesto/checagem explícita de dependências e publicação de artefatos atômicos com runId; ausência de requisito não pode parecer sucesso completo.

**Dependências:** Definir dependências mínimas e contrato de saída; sem instalar nada nesta auditoria.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F17 — Múltiplas raízes e saídas analíticas concorrentes

**Prioridade:** Alta.

**Evidência:** Existem analytics/, core-app/analytics-engine e ../analytics-engine. Código textual das duas cópias do engine coincide normalizando CRLF; quatro JSON de saída diferem. AnalyticsBridgeService.java:40–45 e RobinHoodCycleService.java:116–128 escolhem locais relativos diferentes; também há fallback em Downloads.

**Impacto:** Mesmo código pode consumir resultados de execuções diferentes conforme cwd, sem garantir procedência ou atualidade.

**Recomendação para etapa futura:** Uma raiz analítica configurada; manifestos de execução e validação de dataset/model version antes do consumo. Não apagar cópias antes de migrar consumidores.

**Dependências:** F14/F16 e mapa de leitores/escritores.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F18 — FSRS mistura declaração de versão e parâmetros

**Prioridade:** Alta.

**Evidência:** FsrsParameters declara v5 com primeiros 19 pesos do vetor v6; comparação direta com references/.../FSRS-5.test.ts:14 e FSRS-6.test.ts:15. FsrsEngine não aplica ramo específico de curto prazo.

**Impacto:** Não há conformidade demonstrada com versão oficial; testes existentes verificam propriedades do motor próprio.

**Recomendação para etapa futura:** Escolher versão, fixar origem e comparar sequências com vetores independentes; separar adaptação de confiança da implementação canônica.

**Dependências:** Histórico elegível e critérios de rating.

**Reaproveitamento:** ts-fsrs/packages/fsrs/src/algorithm.ts:329,390 e testes FSRS-5/6, MIT.

### F19 — Domínio cognitivo implementado, mas sem ligação produtiva demonstrada

**Prioridade:** Alta.

**Evidência:** TopicMastery.processAttempt aparece como declaração no código principal; consumidores de DynamicStudyCycleEngine estão no próprio domínio/testes, sem chamada de aplicação encontrada. Banco operacional não tem user_topic_mastery/question_attempts da migração PostgreSQL.

**Impacto:** Existência de classes/testes é confundível com capacidade adaptativa ativa. O caminho real usa outros serviços e heurísticas.

**Recomendação para etapa futura:** Rastrear e documentar caminho canônico resposta→estado→fila; integrar apenas depois de decidir qual autoridade manter.

**Dependências:** F01/F08/F18; não remover domínio somente por ainda não estar conectado.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F20 — Estimativas apresentadas como realidade e sucesso de revisão presumido

**Prioridade:** Alta.

**Evidência:** StudentKnowledgeStateService.java:295 conta toda CONCLUIDA; :358 converte data inválida em now; :494–516 usa coeficientes fixos e quatro tentativas para CONSOLIDADO. RevisionCalendarService.java:102 atribui erro não classificado a lacuna teórica.

**Impacto:** O sistema pode exibir certeza ou causa que os dados não sustentam.

**Recomendação para etapa futura:** Separar observação, estimativa e hipótese; desconhecido não é zero; considerar diversidade/intervalo e preservar causa não classificada.

**Dependências:** F01/F02/F06; calibração posterior com dados reais.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F21 — Resumos semeados com fontes/páginas literais e conteúdo por template

**Prioridade:** Alta.

**Evidência:** StrategicSummaryService.java:76–78 semeia em banco vazio; :1232–1250 fixa títulos e páginas. Os dois registros do banco coincidem com esses seeds. :602–650 usa textos por domínio; :445–449 gera fichas/pegadinhas sem receber texto-fonte.

**Impacto:** Proveniência aparente não comprova que as páginas foram consultadas; conteúdo genérico pode ser apresentado como síntese específica.

**Recomendação para etapa futura:** Separar demonstrações e material editorial de conteúdo extraído; exibir evidência recuperável por afirmação e bloquear falsa rastreabilidade.

**Dependências:** Contrato de fontes e validação humana de conteúdo.

**Reaproveitamento:** NotebookLM referência inspira ancoragem, não valida os templates nem as alegações de banca.

### F22 — Atualização parcial de progresso pode falhar por campos obrigatórios

**Prioridade:** Alta.

**Evidência:** StudyMaterialService.java:74–79 cria TopicMaterialLink somente com id/progresso/status. StudyMaterialRepositoryImpl.java:175–198 faz INSERT/UPSERT de todos campos, incluindo topico_id/material_id NOT NULL. Reproduzido em SQLite em memória usando DDL da tabela real: NOT NULL constraint failed: topic_material_links.topico_id.

**Impacto:** O caminho de atualização parcial falha por NOT NULL antes do UPSERT. Reprodução isolada confirma o mecanismo; endpoint não foi acionado.

**Recomendação para etapa futura:** Atualização específica de progresso ou carregamento do objeto completo; testes contra schema real.

**Dependências:** Contrato de update e teste de integração em banco descartável.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F23 — Componentes fora do fluxo atual, candidatos a legado

**Prioridade:** Média.

**Evidência:** Grafo de imports estáticos a partir de frontend/src/main.tsx: CadastroConcursoWizard.tsx, CronogramaSemanal.tsx, GerenciadorCadernos.tsx e CSS associados inalcançáveis. App.css e AnalyticsView.css também sem importação encontrada.

**Impacto:** Manutenção e lint abrangem recursos que a aplicação atual não expõe; possível duplicação de fluxos.

**Recomendação para etapa futura:** Comparar recursos exclusivos e histórico; retirar/arquivar somente após busca de carregamento dinâmico e teste de navegação.

**Dependências:** Estado Git verificável e validação de equivalência funcional.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F24 — Componentes e serviços concentram responsabilidades

**Prioridade:** Média.

**Evidência:** ImportStudio 3.121 linhas; QuestionViewer 2.296; BibliotecaMateriais 2.282; EditalVerticalizado 2.256; StrategicSummaryService 1.256; StagingDatabaseService 1.037.

**Impacto:** Mudanças pequenas atingem estado, requisições, regras e apresentação no mesmo arquivo. Tamanho é indício de custo, não prova de bug.

**Recomendação para etapa futura:** Extrair por responsabilidade somente durante correções com testes; evitar reescrita geral.

**Dependências:** Fluxos críticos mapeados e contratos estabilizados.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F25 — Bundle inicial monolítico

**Prioridade:** Média.

**Evidência:** Build Vite isolado: JS 1.180,46 kB (gzip 295,16 kB); CSS 412,93 kB (gzip 60,75 kB); aviso de chunk acima de 500 kB. App importa telas estaticamente.

**Impacto:** Carga inicial inclui fluxos administrativos e de ingestão; pode afetar tablet/dispositivos modestos, sem benchmark de UX realizado.

**Recomendação para etapa futura:** Medir carregamento e dividir telas pesadas por lazy import quando justificado.

**Dependências:** Baseline de navegação e tamanho; não trocar framework.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F26 — Cobertura automática desigual entre camadas

**Prioridade:** Média.

**Evidência:** 43 classes Java de teste compiladas; 15 testes de domínio executados e aprovados. Frontend package.json não define script de testes nem framework de teste de UI; lint tem 5 erros e 115 avisos.

**Impacto:** Build aprovado não protege fluxo de abrir modal, salvar causa do erro, criar simulado ou aplicar preferências.

**Recomendação para etapa futura:** Conjunto enxuto de testes de fluxo e integração cobrindo achados prioritários; CI com build/lint/testes.

**Dependências:** Isolamento de DB, arquivos, Anki e R antes de suíte completa Spring.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F27 — Índices e restrições insuficientes para regras atuais

**Prioridade:** Média.

**Evidência:** Banco principal não tem índices explícitos adicionais aos automáticos; EXPLAIN da consulta de tentativa mostra SCAN event_store. Somente três tabelas declaram FKs; rotina não é única por concurso; event_store não possui triggers append-only.

**Impacto:** Proteção depende da aplicação e crescimento do histórico amplia varreduras. 107 eventos não demonstram gargalo atual.

**Recomendação para etapa futura:** Índices baseados em planos e restrições coerentes após auditoria/migração; defesa de imutabilidade com manutenção documentada.

**Dependências:** F08/F10, medição e compatibilidade de migração.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F28 — Conteúdo de questões repetido exige identidade conceitual

**Prioridade:** Média.

**Evidência:** GROUP BY enunciado,options_json,correct_option retornou 1.107 grupos com repetição e 3.511 ocorrências além da primeira.

**Impacto:** Questão repetida em cargos/provas pode parecer item inédito; não é prova de registro inválido.

**Recomendação para etapa futura:** Manter ocorrências e proveniência; vincular item canônico/família para não contar familiaridade como transferência. Não excluir em massa.

**Dependências:** F01 e política de identidade de conteúdo.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F29 — Schema fragmentado e migração de outro banco sem aplicação comprovada

**Prioridade:** Alta.

**Evidência:** CREATE/ALTER em serviços, repositórios e schema.sql; study_notebooks com DDL divergente. db/migration/V1__init_cognitive_platform_schema.sql contém construções PostgreSQL; pom não declara Flyway e tabelas correspondentes não existem no SQLite.

**Impacto:** Schema depende da história e ordem de startup; documentação pode descrever arquitetura futura como ativa.

**Recomendação para etapa futura:** Inventário de schema real e migrações SQLite versionadas; classificar SQL PostgreSQL como projeto futuro/legado até decisão explícita.

**Dependências:** F04/F14 e plano reversível de migração.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F30 — Portabilidade depende de máquina e intérpretes não declarados

**Prioridade:** Média.

**Evidência:** StagingDatabaseService.java:43 fixa <materials-directory>; publicação chama py em :601; não há requirements/pyproject/uv.lock no código próprio inventariado. Exportação escreve em Downloads por caminho literal.

**Impacto:** Outro usuário ou instalação limpa não reproduz ingestão/integração com segurança.

**Recomendação para etapa futura:** Configuração única de diretórios e executáveis; manifesto de dependências e comando de diagnóstico somente leitura.

**Dependências:** Definir ambiente suportado e F17.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F31 — Subprocessos podem bloquear e saídas não têm execução identificada

**Prioridade:** Média.

**Evidência:** AnalyticsBridgeService.java:131–138 lê até EOF e aguarda R sem timeout. StagingDatabaseService.java:615 lê stdout antes de stderr e waitFor.

**Impacto:** Processo travado ou stderr cheio pode bloquear requisição/thread; saída antiga pode ser reutilizada.

**Recomendação para etapa futura:** Timeout, consumo concorrente dos streams e estado de execução com runId; manter fallback transparente.

**Dependências:** F16/F17 e teste de processo com falha/timeout.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F32 — API administrativa sem proteção comprovada

**Prioridade:** Alta se exposto à rede; média no uso local.

**Evidência:** WebConfig permite qualquer origem/método; controllers têm @CrossOrigin(*); pom sem Spring Security. SystemSettingsController expõe restore, settings e diagnósticos; application.yml não restringe server.address.

**Impacto:** Acesso de outros dispositivos/processos pode alcançar operações sensíveis. Aplicação estava desligada; não houve teste de exposição ou exploração.

**Recomendação para etapa futura:** Definir modo pessoal local e modo de rede; restringir origens/bind e proteger ações administrativas antes de compartilhar acesso.

**Dependências:** Decisão de acesso pelo tablet, F13 e modelo de identidade.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F33 — Adaptabilidade por pessoa não equivale a multiusuário

**Prioridade:** Média.

**Evidência:** system_settings usa setting_key global; principais tabelas/eventos não têm user_id e não há users no banco. localStorage/sessionStorage isolam navegador, não estudante autenticado.

**Impacto:** Perfis de pessoas diferentes compartilhariam dados na mesma instância. Para uso pessoal atual, é limitação de escopo, não obrigação de SaaS.

**Recomendação para etapa futura:** Manter single-user explícito ou definir perfis com isolamento antes de múltiplos usuários; não introduzir infraestrutura multi-tenant por antecipação.

**Dependências:** Decisão de produto: perfis locais ou serviço compartilhado.

**Reaproveitamento:** OpenViking/server/identity.py ilustra contexto de identidade; não importar a stack completa.

### F34 — Auditoria interna exagera garantias e confunde métricas

**Prioridade:** Média.

**Evidência:** SystemSettingsService.java:461 calcula duplicatas por event_id, que é PK, e :463 diz 100% íntegro. Status de extrator/OCR são constantes. R/export_results.R:92–93 coloca quartis como ci_lower/upper.

**Impacto:** Diagnóstico pode passar com duplicatas semânticas, falhas de integração ou intervalo estatístico rotulado incorretamente.

**Recomendação para etapa futura:** Definir testes de saúde reais e escopo de cada garantia; usar IQR para quartis e IC somente quando estimado como tal.

**Dependências:** F05/F16/F27 e contrato de métricas.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F35 — Artefatos derivados e resíduos de execução sem política clara

**Prioridade:** Baixa.

**Evidência:** backend/hs_err_pid*.log, replay_pid20876.log, db vazio em backend/db, scratch/, ingestion/output, target/dist e backups coexistem com fontes. Grafo tem 22.759 nós, 16.027 de referências.

**Impacto:** Ruído de navegação, armazenamento e risco de remover evidências úteis por engano.

**Recomendação para etapa futura:** Classificar por fonte, fixture, cache, exportação e backup; retenção e regeneração documentadas. Não apagar backups/golden-set/refs por tamanho.

**Dependências:** Validação do Git, consumidores e recuperação; limpeza só em etapa autorizada.

**Reaproveitamento:** Nenhum reaproveitamento necessário.

### F36 — Restrições de referência e adoção precisam de matriz atualizada

**Prioridade:** Média.

**Evidência:** ts-fsrs/Docling/N.A.G. têm MIT nos arquivos locais. OpenViking declara AGPL-3.0. Track Concursos LICENSE restringe modificações/derivações sem autorização; Question_Extractor não possui LICENSE encontrada.

**Impacto:** Disponibilidade do código não comprova permissão para incorporar trechos; adoção integral pode aumentar dependências e conflitos de arquitetura.

**Recomendação para etapa futura:** Registrar origem, licença local, trecho/padrão e decisão de uso; priorizar padrões e testes independentes. Verificar autorização antes de copiar referências restritas.

**Dependências:** Decisão de reutilização e revisão das condições do projeto específico.

**Reaproveitamento:** Nenhum reaproveitamento necessário.


## 4. Avaliação funcional e dados observados

### Banco principal

| Medida | Resultado observado |
|---|---:|
| Questões | 13.241 |
| Questões com status VALIDADA | 13.241 |
| Gabaritos definitivos | 13.006 |
| Gabaritos anulados | 235 |
| Assunto nulo | **13.241** |
| Enunciado vazio | 0 |
| options_json inválido | 0 |
| Questões com menos de 2 alternativas | 0 |
| Eventos | 107 |
| Respostas ANSWER_SUBMITTED | 6, todas AUTOMATED_TEST |
| Eventos com JSON inválido | 0 |
| Duplicatas de resposta por questão/sessão | 0 grupos observados |
| Editais / tópicos / concursos | 2 / 181 / 1 |
| Materiais de apoio da questão | 486 |
| Materiais na biblioteca do aluno | 1 |
| Vínculos tópico/material | 5 |
| Rotinas | 3; duas no mesmo concurso |
| Revisões / cards Anki | 2 / 12 |
| Execuções de simulado / cadernos | 0 / 0 |
| Resumos estratégicos | 2, coincidentes com seeds do código |

quick_check retornou ok no principal e no staging. foreign_key_check não apontou violações no principal e apontou **sete no staging**. Esse teste somente verifica relações declaradas: o principal só tem três tabelas com cláusulas de FK, portanto não comprova integridade semântica de todas as relações. Vínculos de apoio e de tópico/material consultados manualmente não apresentaram órfãos.

A duplicidade exata de enunciado/opções/gabarito forma 1.107 grupos e 3.511 ocorrências adicionais; podem ser repetições legítimas entre provas/cargos. O próximo passo é identidade canônica e proveniência, não exclusão.

### Funcionalidades por nível de evidência

| Área | O que existe | Verificação e limite |
|---|---|---|
| Questões e correção | Alternativas, status de gabarito, confiança, tempo, ajuda, eventos | Caminho de código inspecionado; persistência/anotação/idempotência com falhas F06–F08 |
| Banco e resolutores | Dois fluxos de resolução e filtros | Não presumir duplicidade total; sessão, taxonomia e anuladas precisam de regras equivalentes |
| Onboarding e Pareto | Componentes e lógica reais | Cinco erros de Hooks; abrir/fechar não homologado visualmente |
| Simulados/cadernos | Seleção, geração e schema | Defeito concreto de coluna ausente e retorno após falha de INSERT |
| Revisões | Regras de agendamento, pendências e conclusão | Heurísticas reais; conflitos de escopo e adiamento |
| Rotina/planejamento | Disponibilidade por dia e exceções; ciclo de edital | Rotina duplicada, fallback cruzado e fallback de 24h para total não positivo (StudentRoutineService:98); mínimos por disciplina podem ultrapassar orçamento |
| Domínio/FSRS | Classes e funções matemáticas executáveis | 15 testes de domínio passam; ligação persistida e validade científica não demonstradas |
| Materiais | Biblioteca, apoio, leitor e vínculos | Estrutura real; atualização parcial de progresso falha em reprodução SQLite isolada |
| Resumos e cards | Geração por templates e metadados de material | Seeds e referências literais não demonstram ancoragem; não considerar síntese comprovada dos PDFs |
| Configuração | Persistência de preferências em mapa | Diversos controles sem consumidor funcional identificado |
| Busca global | Endpoint e UI | Três categorias usam schema incompatível; erro capturado pode parecer vazio |
| Backups/diagnóstico | Interface e serviços concretos | Caminhos, restauração e eventos de auditoria inconsistentes; não executar como recuperação confiável sem correção/ensaio |
| Ingestão | Pipeline, lote, inspeção, curadoria e publicação | Inspeção estática e bancos; OCR/extração de PDFs não executados nesta rodada |
| R | Análises, contratos, proveniência e testes | 291 aprovações, duas falhas; outputs e dependências precisam de controle |
| Anki | Fila, descoberta de modelos e sincronização | Inspecionado, não acionado; sincronização automática pode alcançar AnkiWeb |
| Experiência visual/acessibilidade | Modo simplificado, tema e atalhos | Código presente; sem certificação de foco, leitores de tela, contraste ou tablet |

A listagem de aproximadamente 187 anotações de handlers e 243 referências literais de API serviu como triagem. Mapeamentos Java com arrays, URLs construídas e fragmentos de PDF geram falsos desencontros nessa análise; **não transformei essa contagem em número de endpoints quebrados**. Os defeitos relatados foram confirmados em código/schema.

## 5. Projetos de referência e reaproveitamento concreto

| Referência disponível | Evidência examinada | O que aproveitar | Comparação e restrição |
|---|---|---|---|
| ts-fsrs | packages/fsrs/src/algorithm.ts, default.ts, testes FSRS-5/6 e licença MIT | Vetores de conformidade, curto prazo, limites de parâmetros e log de review | FiscalStudy já tem motor próprio; maior ganho é referência independente para corrigir conformidade. Não duplicar autoridade entre browser e Java |
| Question_Extractor | confidence_service.py, review_service.py, pdf_service.py, modelos/API e manifests | Razões estruturadas de incerteza, revisão humana e extração direta com fallback OCR | FiscalStudy já tem layout/extrator/evidências/curadoria: medir lacuna específica antes de portar. Stack FastAPI/Celery/Redis/SQLAlchemy não é necessária ao monólito local; licença não encontrada |
| Docling | pyproject, licença MIT, datamodel/pipeline_options.py e estrutura de backends/pipelines | Opções explícitas de OCR/tabelas e adaptador de representação documental para casos difíceis | Não foi comprovado uso efetivo no pipeline atual; priorizar corpus de PDFs difíceis e comparação de qualidade/custo. Não instalar toda a stack por existir na referência |
| notebooklm-para-concursos | Documento de banco de questões, frameworks/prompts e licença MIT | Ancoragem em fonte, material sem distração e organização por disciplina | É metodologia, não scheduler nem validação científica dos seus limiares. Não importar alegações de estilos/ritmos como regras universais |
| OpenViking | pyproject, licença AGPL-3.0 e openviking/server/identity.py | Separação explícita de contexto/identidade; organização de memória recuperável | Não resolve as lacunas centrais de classificação, persistência e revisão. Alto custo para necessidade atual; manter referência, não nova dependência |
| Track Concursos | README, requisitos pywebview e LICENSE local | Benchmark funcional de pré/pós-edital, rotina e portabilidade | Licença local restringe modificação/adaptação sem autorização; tratar como comparação, não fonte de trechos a incorporar |

As condições acima são observações dos arquivos locais, não parecer jurídico. A existência pública de um repositório não autoriza assumir licença permissiva. Não foi copiado código de nenhuma referência.

## 6. Adaptabilidade e experiência por pessoa

**Já existe:** escolha de concurso, tema local, modo simplificado, disponibilidade por dia/exceções, confiança, tempo, registro de respostas, regras de revisão e recomendações determinísticas.

**Existe parcialmente:** preferências persistidas, plano por rotina, estimativa de conhecimento e integração de sinais R. O estado atual não garante que cada opção altere a experiência. As regras operacionais de fadiga, pesos e retestes não são parâmetros pessoais estimados.

**Não foi encontrado no caminho produtivo/banco atual:** identidade de estudante isolando os registros; estado FSRS persistido e atualizado pelo endpoint de tentativa; cobertura de assunto para as questões importadas; validação de efeito das políticas em retenção tardia.

A arquitetura pode evoluir incrementalmente para um bom assistente pessoal. Para atender pessoas diferentes na mesma instância, precisa primeiro decidir entre perfis locais e multiusuário autenticado. Não recomendo transformar agora o projeto pessoal em SaaS; explicitar a decisão evita confundir preferências de navegador com isolamento de dados.

### Requisitos mínimos de adaptação confiável

1. Questão ligada a tópico/família e fonte, preservando incerteza de classificação.
2. Tentativa identificada, anotável por evento separado e com origem elegível.
3. Domínio, retenção e prioridade tratados como saídas diferentes.
4. Uma autoridade de revisão e uma configuração de rotina/preferências aplicada pelos consumidores.
5. Recomendação com motivo, dados usados, versão e orçamento de tempo.
6. Transferência em itens inéditos e retestes tardios, sem confundir repetição imediata com domínio.
7. Privacidade e integrações governadas por opções reais, inclusive AnkiWeb.

## 7. Mapa de lacunas e política de legado

| Lacuna | Achados relacionados | Consequência |
|---|---|---|
| Evidência por tópico | F01, F02, F06, F07, F28 | Não sustenta personalização fina |
| Contrato de persistência | F04, F05, F08, F14, F22, F29 | UI pode aparentar êxito sem dado correto |
| Revisão e rotina canônicas | F09, F10, F17–F20 | Recomendações podem discordar entre módulos |
| Preferências e privacidade aplicadas | F11, F12, F32, F33 | Controles não garantem comportamento/isolamento |
| Conteúdo rastreável | F21, F28, F34 | Confiança indevida em fonte, domínio ou métricas |
| Operação reproduzível | F13–F17, F26, F30, F31 | Recuperação/testes/integrações dependem do ambiente |
| Manutenção | F23–F27, F29, F35, F36 | Custo de evolução desnecessário |

### O que fazer com candidatos a remoção — somente após validação

| Item | Classificação atual | Condição para retirada futura |
|---|---|---|
| CadastroConcursoWizard + CSS | Fora do grafo de imports de main.tsx | Comparar com AssistenteObjetivoWizard e validar todas as entradas |
| CronogramaSemanal + CSS | Fora do fluxo de importação atual | Conferir diferença para PlanejamentoAdaptativo/rotina e referências dinâmicas |
| GerenciadorCadernos + CSS | Fora do fluxo atual | Conferir recursos únicos em CadernosSimulados/BancoQuestoes |
| App.css / AnalyticsView.css | Sem importação encontrada | Confirmar que nenhum carregamento externo depende deles |
| Migração PostgreSQL | Projeto/esboço sem aplicação comprovada | Decidir arquivamento como especificação; não executar contra SQLite |
| analytics-engine irmão/integrado | Código equivalente com EOL diferente e outputs distintos | Mapear todos os consumidores antes de consolidar caminho |
| Logs de crash/replay e scratch | Artefatos de execução/investigação | Extrair decisões/evidências relevantes e definir retenção |
| db vazio no backend | Artefato/caminho alternativo observado | Corrigir resolução de path antes de apagar, para não recriá-lo |
| Imagens de evidência / golden-set | Potencial fixture ou rastreabilidade | Não apagar por tamanho ou falta de importação TS/Java |
| Backups .db | Recuperação, não lixo presumido | Restaurabilidade ensaiada e política de retenção definida |
| references e grafo | Ferramentas/terceiros, não app embarcada automaticamente | Escopo de indexação e localização podem ser melhorados; não excluir acervo sem decisão |

No conjunto de textos próprios comparado por hash exato, apareceu um par idêntico de pesos JSON em analytics/robin_hood_weights.json e output/metrics/robin_hood_weights.json. Isso não prova duplicação ampla de fontes: cópias analíticas com CRLF diferente foram verificadas separadamente. Duplicação funcional exige análise de responsabilidade, não só hash.

## 8. Sequência recomendada de melhorias — não executada

| Ordem | Iniciativa | Impacto / esforço / risco | Dependências | Critério de conclusão |
|---:|---|---|---|---|
| 1 | Garantir caminho de dados e recuperação segura | Muito alto / médio / alto se migrar errado | F13–F15, F29, modo de acesso | Backup consistente e restauração ensaiada em cópia; sem caminho ambíguo; staging reconciliado |
| 2 | Corrigir contratos que já quebram fluxos atuais | Alto / baixo–médio / controlável | Baseline e isolamento de testes | Wizard abre/fecha; simulado persiste; busca encontra; progresso atualiza sem perder vínculo |
| 3 | Corrigir contrato de tentativa e anotações | Muito alto / médio / médio | Identidade estável, versão de eventos | Reenvio/concorrência idempotentes; causa salva por evento; reteste legítimo não é descartado |
| 4 | Classificação e proveniência do banco | Muito alto / médio–alto / risco de rotular errado | Taxonomia e conjunto revisado | Cobertura por assunto medida e validada; desconhecido preservado; testes excluídos do perfil |
| 5 | Unificar revisão, rotina e fonte analítica | Muito alto / médio / médio | Etapas 1, 3 e 4 | Uma fila e rotina ativa; sem adiar urgência indevida; artefatos do run correto |
| 6 | Fazer preferências e privacidade terem efeito | Alto / médio / baixo–médio | Contrato tipado e decisão de perfis | Cada controle tem consumidor/teste; AnkiWeb sob opção efetiva e persistida |
| 7 | Conformidade FSRS e transparência científica | Alto / médio / médio | Dados elegíveis e versão definida | Vetores externos passam; estado persistido; linguagem de estimativa e limites explícitos |
| 8 | Retirar legado comprovado e modularizar pontos críticos | Médio / baixo–médio / médio se remover cedo | Testes dos fluxos equivalentes | Nenhuma entrada perde capacidade necessária; documentação e imports coerentes |
| 9 | Otimizar bundle, consultas e observabilidade | Médio / médio / baixo | Baseline de uso e gargalos medidos | Tamanho/latência medidos; falhas explícitas; sem prometer ganho por estética |
| 10 | Medir resultado de aprendizagem | Muito alto no objetivo final / contínuo / inferência enviesada | Histórico real, itens inéditos e política estável | Retenção tardia/transferência por tempo de estudo, com incerteza e sem confundir uso com aprendizagem |

Essa ordem não significa esperar semanas para um bug pequeno: após validar o diagnóstico, correções isoladas de Hooks/schema podem ocorrer em paralelo lógico ao desenho da recuperação, desde que não impliquem migração arriscada. Nesta auditoria nenhuma delas foi implementada.

## 9. Recomendações arquiteturais e validação final

### Arquitetura

- Preservar Java/Spring, SQLite, React/TypeScript e R em lote. O projeto não precisa de novos microsserviços, Redis, Kafka ou banco distribuído para resolver os achados.
- Convergir o schema para migrações explícitas. Serviços/repositórios não devem competir para criar versões diferentes da mesma tabela.
- Manter eventos históricos e corrigir por novos eventos/projeções. Imutabilidade declarada precisa de defesa operacional; apagar perguntas por clean-slate também exige considerar relações com eventos.
- Concentrar resolução de diretórios, banco e executáveis em configuração. Eliminar precedência invisível entre cópias/exports.
- Dar nomes distintos a desempenho observado, retenção prevista, domínio estimado e prioridade de estudo. Não atribuir capacidade neurológica à telemetria de cursor ou à aba visível.
- Separar origem da observação e finalidade analítica. Estudos reais, automação e demonstração não devem alimentar o mesmo perfil sem seleção explícita.
- Aplicar preferências em consumidores reais e manter single-user como decisão consciente enquanto for o escopo; acrescentar identidade somente quando o requisito existir.
- Integrar o que já existe antes de ampliar: classificação, tentativa, anotação, revisão, rotina, evidência e plano diário compõem o fluxo essencial.

### Resultados reais das verificações

| Verificação executada | Resultado |
|---|---|
| Backend em cópia isolada, Maven offline/JDK21 alvo17 | Compilou 155 arquivos produtivos e 43 classes de testes |
| FsrsEngineTest | 6 testes aprovados |
| DynamicStudyCycleEngineTest | 5 testes aprovados |
| RobinHoodCycleEngineTest | 4 testes aprovados |
| Total de testes Java executados nesta rodada | 15; zero falhas/erros |
| TypeScript app/node | Aprovados, com buildinfo redirecionado para cópia isolada |
| Vite build | Aprovado usando configLoader runner; aviso de chunk grande |
| oxlint | 5 erros / 115 avisos |
| R tests/test_runner.R | 291 verificações aprovadas / 2 falhas; código de saída 1 |
| SQLite principal/staging quick_check | ok / ok |
| SQLite staging foreign_key_check | 7 violações observadas |
| Prepare de SQL da busca e log de backup | Reproduziu colunas/tabelas incompatíveis; nenhuma escrita executada |
| Prepare INSERT de simulado | Falhou por coluna tempo_minutos ausente |
| Atualização parcial de vínculo em SQLite de memória | Falhou por NOT NULL em topico_id, com DDL da tabela real |
| Comparação final das fontes principais lidas | Nenhuma alteração detectada nos originais |
| Navegador/ponta a ponta | Não concluído; backend original desligado e prévia bloqueada por cache protegido |

Os erros EPERM iniciais de TypeScript/Vite vieram do reaproveitamento readonly de node_modules: TypeScript tentou gravar buildinfo e Vite tentou gravar cache/config temporária. A verificação de tipos foi repetida com caminhos próprios e o build com loader runner; ambos passaram. O servidor de desenvolvimento ainda tentou reorganizar cache compartilhado, falhou, e foi encerrado. Esses problemas de ambiente não foram contabilizados como bugs do produto.

As duas falhas R têm causas identificadas: exportação JSON não criada quando jsonlite não está disponível e execução de teste de proveniência que requer digest. Nenhuma dependência foi instalada ou atualizada para esconder a falha. A primeira revela também que o contrato de exportação silenciosamente incompleto não corresponde à expectativa do consumidor.

Não executei a suíte Spring completa porque o contexto agenda integração Anki e serviços resolvem caminhos fora do datasource de teste. É necessário primeiro garantir isolamento de todos os efeitos externos, não somente trocar a URL JDBC. Testes passarem em domínio não comprovam experiência ponta a ponta nem fidelidade científica.

### Métricas para aceitar a evolução futura

Técnicas: criação persistida de simulado, round-trip de anotações, idempotência concorrente, restauração íntegra, zero órfãos, conformidade de schema em instalação nova, falhas explícitas e latência com volume declarado. Pedagógicas: retenção tardia sem ajuda, itens inéditos por família, calibração probabilística válida, erros recorrentes e resultado por minuto de estudo. Contagens de sessões, cards ou engajamento não comprovam ganho de aprendizagem.

**Decisão pendente para a próxima etapa:** validar este diagnóstico e escolher o primeiro conjunto de correções. O projeto original permanece preservado. A conclusão desta auditoria é um mapa verificável do estado acessível, com limitações explícitas, e não uma certificação de que todos os fluxos do sistema funcionam.
