# Plano central de implementação FiscalStudy

## Estado e regras

Fonte original: <original-checkout>

Raiz editável: <implementation-checkout>

Auditoria imutável: docs/audit/AUDIT_2026-10-23_PUBLIC.md. Baseline de hashes: docs/audit/SOURCE_BASELINE_PUBLIC.json. Snapshots consistentes SQLite: db/recovery/*.db, quick_check=ok. Nunca escrever nos snapshots ou originais. Nenhum commit/push autorizado. Git da cópia operacional: branch codex/fiscalstudy-integration-20261023. Nenhum commit criado.

## Contratos compartilhados

- Single-user local; perfis acadêmicos não são contas SaaS.
- Separar observação, previsão de memória e decisão pedagógica. Erro inesperado não determina causa.
- FSRS oficial/versionado calcula item de memória; camada pedagógica externa seleciona investigação/intervenção. Curva por matéria somente agregação/calibração com evidência e incerteza.
- Persistence é único responsável por schema e migrações. Demais agentes enviam pedidos e não editam schema.sql.
- Attempts define attemptId e anotação append-only; adaptive integra callback e frontend consome o mesmo contrato.
- Fonte bibliográfica/trecho/página deve ser recuperável; template nunca representa extração confirmada.
- Nenhuma chamada real a AnkiWeb/Anki nas verificações. Integrações desligadas em isolamento.

## Equipe real e ownership

- persistence: F04, F05, F13, F14, F15, F22, F27, F29
- attempts: F02, F06, F07, F08
- content: F01, F21, F28, F30, F36
- adaptive: F09, F10, F18, F19, F20, F33
- frontend: F03, F11, F23, F24, F25
- integrations: F12, F16, F17, F31, F32, F34
- orchestrator: F26, F35

## Retomada após indisponibilidade

Em 23/10/2026 o acesso local foi restabelecido e os seis agentes foram iniciados novamente com sufixo `_resume`. As entregas anteriores não são presumidas validadas: o estado do Git confirma alterações parciais de persistência, configuração e documentação. Compilação e homologação integrada ainda pendentes. Nenhum commit/push nem migração dos bancos originais.

## Ondas e dependências

1. Paths/migrações/recuperação/segurança/subprocessos.
2. Persistência de fluxos, Hooks, tentativa/anotações, revisões/rotina.
3. Classificação/proveniência, projeção de aprendizagem, conformidade FSRS e raiz analítica.
4. Preferências, conteúdo rastreável, isolamento pessoal e métricas.
5. Integração, testes, manutenção e homologação.

## Registro por achado

### F01 — Banco sem classificação por assunto

- Responsável: content
- Estado: em andamento
- Evidência original: SQL somente leitura: 13.241/13.241 questions.assunto IS NULL. B/application/StudentKnowledgeStateService.java:318–320 ignora assunto vazio; B/infrastructure/out/persistence/QuestionRepositoryImpl.java:96–99 filtra esse campo.
- Correção/aceitação: Definir vínculo canônico questão→tópico com confiança, origem e revisão humana; preservar não classificado e medir cobertura antes de alimentar domínio.
- Dependências: Taxonomia, política de curadoria e conjunto rotulado de validação.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F02 — Histórico observado não comprova uso de estudo real

- Responsável: attempts
- Estado: em andamento
- Evidência original: Banco principal: 107 eventos; seis ANSWER_SUBMITTED, todos origin=AUTOMATED_TEST. StudentKnowledgeStateService.java:303–309 não filtra origin.
- Correção/aceitação: Centralizar elegibilidade de evidências por origem e finalidade; separar histórico desconhecido, demonstração e teste; não reclassificar eventos retroativamente como reais.
- Dependências: Contrato de proveniência e consumidores Java/R alinhados.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F03 — Hooks condicionais nos fluxos de abertura

- Responsável: frontend
- Estado: em andamento
- Evidência original: Lint: MotorParetoEditalModal.tsx:136 e AssistenteObjetivoWizard.tsx:231,236,241,254. Ambos possuem return por !isOpen antes desses Hooks.
- Correção/aceitação: Na fase de correção, preservar ordem incondicional de Hooks e validar abertura/fechamento com testes de interação.
- Dependências: Baseline da interface e teste automatizado de transições.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F04 — Cadernos e simulados usam DDLs incompatíveis

- Responsável: persistence
- Estado: em andamento
- Evidência original: QuestionBankService.java:533 e StrategicSimuladoService.java:46 criam study_notebooks com colunas distintas. Banco atual não possui tempo_minutos; INSERT do simulado em :196 exige essa coluna. O catch :199–201 não impede retorno de notebookId em :203–214.
- Correção/aceitação: Uma migração canônica e erro de API em falha de persistência; verificar esquema existente antes de migrar.
- Dependências: Snapshot consistente e migração testada em bancos novos e existentes.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F05 — Busca global incompatível com o schema real

- Responsável: persistence
- Estado: em andamento
- Evidência original: SystemSettingsService.java:534 usa questions.statement; :560 usa materials/title; :583 usa study_notebooks.title/mode/question_count. Preparação das consultas no SQLite reproduziu no such column/table, sem executar escrita.
- Correção/aceitação: Consumir repositórios canônicos e distinguir falha de fonte de zero resultados.
- Dependências: Contrato do banco e testes de integração da busca.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F06 — Causa do erro enviada pela interface não é registrada

- Responsável: attempts
- Estado: em andamento
- Evidência original: ResolucaoQuestaoModal.tsx:257–275 reenvia tentativa para registrar causaErro depois do feedback. AttemptSubmissionService.java:162–164 retorna antes da gravação quando a questão já existe na sessão.
- Correção/aceitação: Criar evento separado de anotação/correção da tentativa, ligado ao attemptId, preservando append-only.
- Dependências: Identificador estável da tentativa e contrato de anotação.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F07 — Sessão do banco reutilizada e tempo confundido com atividade

- Responsável: attempts
- Estado: em andamento
- Evidência original: ResolucaoQuestaoModal.tsx:72–78 persiste fiscalstudy_bank_session_id em sessionStorage; busca textual encontrou apenas leitura/escrita dessa chave. Mesmo sessionId ativa deduplicação por questão. Cronômetro :95–100 mede visibilidade da página, não interação.
- Correção/aceitação: Ciclo de vida explícito de sessão e attemptId por tentativa; documentar tempo de tela e medir atividade com critérios transparentes.
- Dependências: F06/F08 e política de sessão; sem inferir atenção neurológica.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F08 — Idempotência não atômica e JSON manual

- Responsável: attempts
- Estado: em andamento
- Evidência original: AttemptSubmissionService.java:162 usa hasEvent; EventStoreRepositoryImpl.java:46 consulta separadamente da inserção. Payload manual em AttemptSubmissionService.java:223.
- Correção/aceitação: Serialização estruturada, chave idempotente e retorno do resultado persistido; migração de unicidade apenas após inventário.
- Dependências: Contrato de tentativa e backup; a correção da entrega anterior permanece apenas na cópia isolada, não foi aplicada ao original.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F09 — Revisões podem ser adiadas e misturadas entre concursos

- Responsável: adaptive
- Estado: em andamento
- Evidência original: RevisionCalendarService.java:201 sobrescreve data_agendada mantendo MAX da prioridade. Deduplicação no startup :47 particiona só disciplina/topico; procura pendência sem concurso.
- Correção/aceitação: Estado de pendência por escopo canônico; transições explícitas e histórico de replanejamento.
- Dependências: Identidade de tópico/concurso, migração preservando histórico.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F10 — Duas rotinas para o mesmo concurso e fallback cruzado

- Responsável: adaptive
- Estado: em andamento
- Evidência original: SQL: duas student_routines para o mesmo concurso. StudentRoutineRepositoryImpl.java:63–66 pega list.get(0) sem ordenação; :70 retorna rotina global mais recente em ausência.
- Correção/aceitação: Definir uma rotina ativa por escopo, seleção explícita e restrição de integridade após resolver duplicatas.
- Dependências: Auditoria dos registros duplicados e semântica de versões de rotina.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F11 — Personalização configurável não é política efetivamente aplicada

- Responsável: frontend
- Estado: em andamento
- Evidência original: SystemSettingsService.java:110–158 define duração, fonte, limites de revisão, sono e privacidade. Buscas no código próprio encontraram essas chaves no serviço e formulário, não nos respectivos motores. App.tsx usa fiscalstudy_calm_theme separadamente.
- Correção/aceitação: Mapear cada preferência a consumidor, efeito e teste; retirar ou rotular controles ainda não conectados.
- Dependências: Contrato tipado de preferências e escopo por perfil.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F12 — Integração Anki pode sincronizar fora do controle de privacidade anunciado

- Responsável: integrations
- Estado: em andamento
- Evidência original: AnkiIntegrationService.java:45 autoSyncEnabled inicia true, :784 agenda 25s, :767–773 chama AnkiWeb após envio. Toggle :813–820 é estado em memória. Não se localizou consumo de armazenamentoLocalEstrito nessa integração.
- Correção/aceitação: Consentimento e opções independentes para fila local, Anki Desktop e AnkiWeb, persistidos e efetivamente consultados; impedir efeitos externos nos testes.
- Dependências: F11 e política de integração.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F13 — Restauração de backup não está confinada nem coordenada com conexões

- Responsável: persistence
- Estado: em andamento
- Evidência original: SystemSettingsService.java:315 combina pasta com filename sem normalização/containment; :334 substitui arquivo com pool JDBC ativo. Controller :61–67 aceita filename.
- Correção/aceitação: Restauração offline/coordenada, caminho validado por pertencimento, verificação de formato e ensaio de recuperação.
- Dependências: Fluxo de manutenção e segurança de API; não usar o recurso atual como recuperação comprovada.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F14 — Backup/overview usam caminho diferente do datasource e logam schema inválido

- Responsável: persistence
- Estado: em andamento
- Evidência original: application.yml usa ../db/fiscalstudy.db; SystemSettingsService.java:26 usa db/fiscalstudy.db. VACUUM INTO usa datasource, mas fallback Files.copy :230 usa caminho fixo. INSERTs de auditoria :242 e :344 usam payload/timestamp inexistentes; prepare reproduziu erro.
- Correção/aceitação: Derivar caminhos da configuração única; manter backup consistente e contrato canônico de eventos; falha no fallback deve ser explícita.
- Dependências: F13, definição do diretório de execução e teste de backup/restauração.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F15 — Staging possui sete violações referenciais

- Responsável: persistence
- Estado: em andamento
- Evidência original: PRAGMA foreign_key_check encontrou sete staging_support_materials órfãos de staging_documents. StagingDatabaseService.java:56 abre conexão sem ativar foreign_keys; deleteStagingFile :673–678 não apaga os materiais de apoio antes dos documentos.
- Correção/aceitação: Auditar/reconciliar órfãos e impor integridade em toda conexão; teste transacional de exclusão com materiais.
- Dependências: Backup do staging e política para evidências compartilhadas.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F16 — Dependências R ausentes e exportação JSON silenciosamente omitida

- Responsável: integrations
- Estado: em andamento
- Evidência original: Teste isolado: 291 verificações aprovadas, duas falhas. digest não instalado; export_metrics_package (R/export_results.R:171–174) simplesmente não escreve JSON sem jsonlite. Teste exige o arquivo.
- Correção/aceitação: Manifesto/checagem explícita de dependências e publicação de artefatos atômicos com runId; ausência de requisito não pode parecer sucesso completo.
- Dependências: Definir dependências mínimas e contrato de saída; sem instalar nada nesta auditoria.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F17 — Múltiplas raízes e saídas analíticas concorrentes

- Responsável: integrations
- Estado: em andamento
- Evidência original: Existem analytics/, core-app/analytics-engine e ../analytics-engine. Código textual das duas cópias do engine coincide normalizando CRLF; quatro JSON de saída diferem. AnalyticsBridgeService.java:40–45 e RobinHoodCycleService.java:116–128 escolhem locais relativos diferentes; também há fallback em Downloads.
- Correção/aceitação: Uma raiz analítica configurada; manifestos de execução e validação de dataset/model version antes do consumo. Não apagar cópias antes de migrar consumidores.
- Dependências: F14/F16 e mapa de leitores/escritores.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F18 — FSRS mistura declaração de versão e parâmetros

- Responsável: adaptive
- Estado: em andamento
- Evidência original: FsrsParameters declara v5 com primeiros 19 pesos do vetor v6; comparação direta com references/.../FSRS-5.test.ts:14 e FSRS-6.test.ts:15. FsrsEngine não aplica ramo específico de curto prazo.
- Correção/aceitação: Escolher versão, fixar origem e comparar sequências com vetores independentes; separar adaptação de confiança da implementação canônica.
- Dependências: Histórico elegível e critérios de rating.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F19 — Domínio cognitivo implementado, mas sem ligação produtiva demonstrada

- Responsável: adaptive
- Estado: em andamento
- Evidência original: TopicMastery.processAttempt aparece como declaração no código principal; consumidores de DynamicStudyCycleEngine estão no próprio domínio/testes, sem chamada de aplicação encontrada. Banco operacional não tem user_topic_mastery/question_attempts da migração PostgreSQL.
- Correção/aceitação: Rastrear e documentar caminho canônico resposta→estado→fila; integrar apenas depois de decidir qual autoridade manter.
- Dependências: F01/F08/F18; não remover domínio somente por ainda não estar conectado.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F20 — Estimativas apresentadas como realidade e sucesso de revisão presumido

- Responsável: adaptive
- Estado: em andamento
- Evidência original: StudentKnowledgeStateService.java:295 conta toda CONCLUIDA; :358 converte data inválida em now; :494–516 usa coeficientes fixos e quatro tentativas para CONSOLIDADO. RevisionCalendarService.java:102 atribui erro não classificado a lacuna teórica.
- Correção/aceitação: Separar observação, estimativa e hipótese; desconhecido não é zero; considerar diversidade/intervalo e preservar causa não classificada.
- Dependências: F01/F02/F06; calibração posterior com dados reais.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F21 — Resumos semeados com fontes/páginas literais e conteúdo por template

- Responsável: content
- Estado: em andamento
- Evidência original: StrategicSummaryService.java:76–78 semeia em banco vazio; :1232–1250 fixa títulos e páginas. Os dois registros do banco coincidem com esses seeds. :602–650 usa textos por domínio; :445–449 gera fichas/pegadinhas sem receber texto-fonte.
- Correção/aceitação: Separar demonstrações e material editorial de conteúdo extraído; exibir evidência recuperável por afirmação e bloquear falsa rastreabilidade.
- Dependências: Contrato de fontes e validação humana de conteúdo.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F22 — Atualização parcial de progresso pode falhar por campos obrigatórios

- Responsável: persistence
- Estado: em andamento
- Evidência original: StudyMaterialService.java:74–79 cria TopicMaterialLink somente com id/progresso/status. StudyMaterialRepositoryImpl.java:175–198 faz INSERT/UPSERT de todos campos, incluindo topico_id/material_id NOT NULL.
- Correção/aceitação: Atualização específica de progresso ou carregamento do objeto completo; testes contra schema real.
- Dependências: Contrato de update e teste de integração em banco descartável.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F23 — Componentes fora do fluxo atual, candidatos a legado

- Responsável: frontend
- Estado: em andamento
- Evidência original: Grafo de imports estáticos a partir de frontend/src/main.tsx: CadastroConcursoWizard.tsx, CronogramaSemanal.tsx, GerenciadorCadernos.tsx e CSS associados inalcançáveis. App.css e AnalyticsView.css também sem importação encontrada.
- Correção/aceitação: Comparar recursos exclusivos e histórico; retirar/arquivar somente após busca de carregamento dinâmico e teste de navegação.
- Dependências: Estado Git verificável e validação de equivalência funcional.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F24 — Componentes e serviços concentram responsabilidades

- Responsável: frontend
- Estado: em andamento
- Evidência original: ImportStudio 3.121 linhas; QuestionViewer 2.296; BibliotecaMateriais 2.282; EditalVerticalizado 2.256; StrategicSummaryService 1.256; StagingDatabaseService 1.037.
- Correção/aceitação: Extrair por responsabilidade somente durante correções com testes; evitar reescrita geral.
- Dependências: Fluxos críticos mapeados e contratos estabilizados.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F25 — Bundle inicial monolítico

- Responsável: frontend
- Estado: em andamento
- Evidência original: Build Vite isolado: JS 1.180,46 kB (gzip 295,16 kB); CSS 412,93 kB (gzip 60,75 kB); aviso de chunk acima de 500 kB. App importa telas estaticamente.
- Correção/aceitação: Medir carregamento e dividir telas pesadas por lazy import quando justificado.
- Dependências: Baseline de navegação e tamanho; não trocar framework.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F26 — Cobertura automática desigual entre camadas

- Responsável: orchestrator
- Estado: em andamento
- Evidência original: 43 classes Java de teste compiladas; 15 testes de domínio executados e aprovados. Frontend package.json não define script de testes nem framework de teste de UI; lint tem 5 erros e 115 avisos.
- Correção/aceitação: Conjunto enxuto de testes de fluxo e integração cobrindo achados prioritários; CI com build/lint/testes.
- Dependências: Isolamento de DB, arquivos, Anki e R antes de suíte completa Spring.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F27 — Índices e restrições insuficientes para regras atuais

- Responsável: persistence
- Estado: em andamento
- Evidência original: Banco principal não tem índices explícitos adicionais aos automáticos; EXPLAIN da consulta de tentativa mostra SCAN event_store. Somente três tabelas declaram FKs; rotina não é única por concurso; event_store não possui triggers append-only.
- Correção/aceitação: Índices baseados em planos e restrições coerentes após auditoria/migração; defesa de imutabilidade com manutenção documentada.
- Dependências: F08/F10, medição e compatibilidade de migração.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F28 — Conteúdo de questões repetido exige identidade conceitual

- Responsável: content
- Estado: em andamento
- Evidência original: GROUP BY enunciado,options_json,correct_option retornou 1.107 grupos com repetição e 3.511 ocorrências além da primeira.
- Correção/aceitação: Manter ocorrências e proveniência; vincular item canônico/família para não contar familiaridade como transferência. Não excluir em massa.
- Dependências: F01 e política de identidade de conteúdo.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F29 — Schema fragmentado e migração de outro banco sem aplicação comprovada

- Responsável: persistence
- Estado: em andamento
- Evidência original: CREATE/ALTER em serviços, repositórios e schema.sql; study_notebooks com DDL divergente. db/migration/V1__init_cognitive_platform_schema.sql contém construções PostgreSQL; pom não declara Flyway e tabelas correspondentes não existem no SQLite.
- Correção/aceitação: Inventário de schema real e migrações SQLite versionadas; classificar SQL PostgreSQL como projeto futuro/legado até decisão explícita.
- Dependências: F04/F14 e plano reversível de migração.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F30 — Portabilidade depende de máquina e intérpretes não declarados

- Responsável: content
- Estado: em andamento
- Evidência original: StagingDatabaseService.java:43 fixa <materials-directory>; publicação chama py em :601; não há requirements/pyproject/uv.lock no código próprio inventariado. Exportação escreve em Downloads por caminho literal.
- Correção/aceitação: Configuração única de diretórios e executáveis; manifesto de dependências e comando de diagnóstico somente leitura.
- Dependências: Definir ambiente suportado e F17.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F31 — Subprocessos podem bloquear e saídas não têm execução identificada

- Responsável: integrations
- Estado: em andamento
- Evidência original: AnalyticsBridgeService.java:131–138 lê até EOF e aguarda R sem timeout. StagingDatabaseService.java:615 lê stdout antes de stderr e waitFor.
- Correção/aceitação: Timeout, consumo concorrente dos streams e estado de execução com runId; manter fallback transparente.
- Dependências: F16/F17 e teste de processo com falha/timeout.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F32 — API administrativa sem proteção comprovada

- Responsável: integrations
- Estado: em andamento
- Evidência original: WebConfig permite qualquer origem/método; controllers têm @CrossOrigin(*); pom sem Spring Security. SystemSettingsController expõe restore, settings e diagnósticos; application.yml não restringe server.address.
- Correção/aceitação: Definir modo pessoal local e modo de rede; restringir origens/bind e proteger ações administrativas antes de compartilhar acesso.
- Dependências: Decisão de acesso pelo tablet, F13 e modelo de identidade.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F33 — Adaptabilidade por pessoa não equivale a multiusuário

- Responsável: adaptive
- Estado: em andamento
- Evidência original: system_settings usa setting_key global; principais tabelas/eventos não têm user_id e não há users no banco. localStorage/sessionStorage isolam navegador, não estudante autenticado.
- Correção/aceitação: Manter single-user explícito ou definir perfis com isolamento antes de múltiplos usuários; não introduzir infraestrutura multi-tenant por antecipação.
- Dependências: Decisão de produto: perfis locais ou serviço compartilhado.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F34 — Auditoria interna exagera garantias e confunde métricas

- Responsável: integrations
- Estado: em andamento
- Evidência original: SystemSettingsService.java:461 calcula duplicatas por event_id, que é PK, e :463 diz 100% íntegro. Status de extrator/OCR são constantes. R/export_results.R:92–93 coloca quartis como ci_lower/upper.
- Correção/aceitação: Definir testes de saúde reais e escopo de cada garantia; usar IQR para quartis e IC somente quando estimado como tal.
- Dependências: F05/F16/F27 e contrato de métricas.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F35 — Artefatos derivados e resíduos de execução sem política clara

- Responsável: orchestrator
- Estado: em andamento
- Evidência original: backend/hs_err_pid*.log, replay_pid20876.log, db vazio em backend/db, scratch/, ingestion/output, target/dist e backups coexistem com fontes. Grafo tem 22.759 nós, 16.027 de referências.
- Correção/aceitação: Classificar por fonte, fixture, cache, exportação e backup; retenção e regeneração documentadas. Não apagar backups/golden-set/refs por tamanho.
- Dependências: Validação do Git, consumidores e recuperação; limpeza só em etapa autorizada.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

### F36 — Restrições de referência e adoção precisam de matriz atualizada

- Responsável: content
- Estado: em andamento
- Evidência original: ts-fsrs/Docling/N.A.G. têm MIT nos arquivos locais. OpenViking declara AGPL-3.0. Track Concursos LICENSE restringe modificações/derivações sem autorização; Question_Extractor não possui LICENSE encontrada.
- Correção/aceitação: Registrar origem, licença local, trecho/padrão e decisão de uso; priorizar padrões e testes independentes. Verificar autorização antes de copiar referências restritas.
- Dependências: Decisão de reutilização e revisão das condições do projeto específico.
- Testes: pendentes nesta execução.
- Reversão: Código rastreável na cópia; recuperação db/recovery preservada; não migrar originais.

## Bloqueios e decisões

- Origem fora das raízes de escrita; trabalho integral em cópia executável.
- Não reclassificar dados de teste como estudo real.
- Não prometer curva individual por disciplina antes de dados longitudinais suficientes.

## Execução sequencial solicitada pelo usuário

A partir deste checkpoint, nenhuma nova delegação. Não há subagentes ativos. Etapa atual exclusiva: persistência e recuperação (F04/F05/F13/F14/F15/F22/F27/F29). As alterações das demais áreas permanecem na cópia para integração posterior; não são consideradas validadas. A última suíte global executou 247 testes, com 13 falhas e 37 erros, portanto o sistema não está homologado. A etapa atual será avaliada com PersistenceContractTest e StagingDatabaseServiceTest antes de avançar.

Checkpoint da etapa: bateria isolada de persistência/staging aprovada (11/11, zero ignorados); faltam revisão final dos contratos e registro individual dos achados antes de encerrar a área.

## Etapa sequencial 2 — tentativas e histórico

Solicitada passagem para a próxima área. Escopo F02/F06/F07/F08: identidade estável, concorrência, reenvio, reteste, anotações posteriores e proveniência. Validação iniciada com AttemptIdentityRegressionTest, QuestionHistoryServiceTest e ActiveTimeAndConfidenceIntegrationTest. Persistência tem bateria11/11 aprovada, mas seus limites históricos permanecem registrados.

## Etapa 2 — validação concluída do escopo direcionado

Corrigidos JSONPath literal no helper LearningEventEligibility e seleção da sobrecarga sem parâmetros. Fixtures legadas de sessões declaram REAL_STUDY apenas no ambiente descartável, com Anki network-allowed=false. Novo teste garante que AUTOMATED_TEST e origem ausente não sintetizam sessões pessoais. Mock de histórico atualizado para a consulta pessoal real.

Comando: node scripts/validate-backend.cjs -Dtest=AttemptIdentityRegressionTest,QuestionHistoryServiceTest,ActiveTimeAndConfidenceIntegrationTest test
Resultado: BUILD SUCCESS;17 testes,0 falhas,0 erros,0 ignorados. Tentativas10;histórico3;sessões/analytics4. Log target-attempts-stage-complete.log. Não houve homologação visual nem reexecução global; os demais consumidores e achados mantêm suas pendências.

## Etapa 3 — revisões e planejamento adaptativo

Corrigido fallback de StudentKnowledgeStateService que retornava tópicos globais para concurso explicitamente solicitado sem tópicos. Corrigido payload do dashboard: removida equação exponencial antiga e afirmações sinápticas incompatíveis com desempenho observado; FSRS permanece autoridade por item, com incerteza explícita.

Comando: node scripts/validate-backend.cjs -Dtest=LearningEvidenceServiceTest,FsrsReferenceConformanceTest,FsrsEngineTest,RevisionCalendarServiceTest,RoutineBudgetRegressionTest,StudentKnowledgeStateServiceTest,MaestroAdaptiveInterleavingIntegrationTest test

Resultado real: BUILD SUCCESS;28 testes,0 falhas,0 erros,0 ignorados. Cobertura: núcleo FSRS6 com vetores independentes ts-fsrs5.4.2; sinal pedagógico esperado/inesperado sem diagnóstico causal; projeção idempotente e concorrente; proteção contra evento fora de ordem; rotinas/zero orçamento; isolamento concursos; intercalação integrada. Log target-adaptive-stage.log.

Limites: conformidade do núcleo não equivale ao scheduler FSRS completo; não houve calibração individual, ensaio de eficácia pedagógica ou homologação visual. Projeções fora de ordem exigem reconstrução ordenada, ainda não automatizada. Não considerar F09/F10/F18/F19/F20/F33 globalmente encerrados só por esta bateria.

## Etapa 4 — classificação e rastreabilidade

Implementado filtro topicId em GET /api/v1/question-classification/questions?unclassified=false&topicId=<id>. Seleção consulta apenas último vínculo CONFIRMED; sugestões/rejeições excluídas. Combinação contraditória unclassified=true+topicId retorna erro explícito. Novos timestamps de classificação usam Instant ISO8601; registros anteriores preservados.

Validação: node scripts/validate-backend.cjs -Dtest=QuestionClassificationServiceTest,StrategicSummaryHybridPipelineTest,QuestionBankServiceTest,StudentKnowledgeStateServiceTest test. BUILD SUCCESS:16 testes,0 falhas,0 erros,0 ignorados. Log target-content-stage.log. Casos: sugestão/confirmado/rejeitado, preservação dos itens, proveniência de resumos, exclusão de vínculos não confirmados do estado de conhecimento.

Limites: teste de serviço/API implementada não equivale a homologação visual; nenhuma classificação em massa foi executada e qualidade/cobertura reais continuam dependendo da curadoria humana. Não foi validado todo pipeline Python nesta etapa.

## Execução por áreas — interface, segurança e analytics

Interface: TypeScript build aprovado; Vite build aprovado;6 testes de contratos aprovados antes da integração token;lint0 erros/118 avisos. Chunk inicial575.04kB (gzip154.65kB), ainda acima500kB. Validação visual não realizada.

Segurança: WebConfig resolve DatabasePaths a partir do Environment sem exigir bean de persistência em slices MVC. IngestionControllerTest agora usa token explícito e inclui rejeição sem token.30 testes Java aprovados,0 ignorados (LocalAccessFilter,AnkiPrivacyPolicy,AnkiIntegrationService,ConcursoController,IngestionController). Logs target-security-area.log. Fluxo frontend ingestão recebe token em memória por helper restrito à API; revalidação frontend ainda pendente após essa alteração.

Analytics R: executado tests/test_runner.R com R4.5.1 e bibliotecas existentes explicitamente configuradas.325 verificações aprovadas,0 falhas. Log target-r-area.log. Não houve instalação de dependências ou sincronização AnkiWeb.

## Área de ingestão e revalidação da interface

BatchProcessor rejeita múltiplos trechos PROVA com mensagem explícita, evitando processar apenas o primeiro e ignorar os demais. O fluxo de curadoria deve escolher intervalos; suporte automático multi-caderno segue pendente. Fixture IBGP define explicitamente intervalo completo e metadados conhecidos; testes fecham conexões SQLite com closing, incluindo backup temporário.11 testes Python aprovados (inclui nova proteção de múltiplos trechos).

Interface após token de ingestão: TypeScript aprovado, Vite build aprovado,7 testes aprovados (inclui restrição do segredo ao endpoint local e remoção em memória). Log target-frontend-tests.log e target-frontend-build.log. Não houve homologação visual.

Integração geral em andamento: testes antigos ajustados para origem explícita, identidade de tentativa e comparação estrutural JSON, sem depender de espaços de serialização. O modelo cognitivo unificado agora filtra eventos não pessoais. Texto da calibração atualizado para não anunciar curva exponencial removida. Resultado global ainda pendente.

## Integração final desta execução por áreas

Backend: node scripts/validate-backend.cjs test — BUILD SUCCESS,255 testes,0 falhas,0 erros,0 ignorados,43.509s. R executável e bibliotecas configurados explicitamente. Log target-backend-integrated-current.log.
Frontend: TypeScript aprovado;Vite build aprovado;7 testes de contratos aprovados;lint0 erros/118 avisos antes da última integração token (não presumir contagem pós-edição). Python11 testes aprovados;R325 verificações aprovadas.

Homologação HTTP real: aplicação iniciou em127.0.0.1:18080 com perfil isolated e diretório target/isolated-qa-* novo. GETsettings200;sem token backupoverview403;backup consistente200;restore200 RESTORE_PREPARED requiresRestart=true mainDatabaseUnchanged=true;Anki status200 com hardgatefalse;preferência temaPOST+GET confirmou persistência. Evidência target/isolated-api-checks.json. Processo isolado encerrado. Não houve troca de banco ativo, migração original ou sincronização externa.

Limitações: a suíte aprovada não demonstra eficácia pedagógica;sem homologação visual;sem calibração individual;classificação real exige curadoria;7órfãos staging históricos não foram apagados;projeções fora de ordem exigem rebuild;modelo unificado experimental ainda requer revisão da autoridade de retenção;componentes extensos/avisos e chunk inicial>500kB permanecem dívida técnica. Não declarar os36 achados resolvidos.

## Consolidação da inicialização do banco — F29

Configuração principal e testes usam spring.sql.init.mode=never. SchemaMigration é o único inicializador do baseline SQLite no startup Spring;JdbcTemplate aguarda migração. Novo SchemaBootstrapIntegrationTest inicia contexto com banco novo isolado e verifica3 migrações,staging criado,quick_check=ok e nenhum backup artificial before_migration em instalação vazia.

Validação direcionada:12 testes aprovados (SchemaBootstrapIntegrationTest,PersistenceContractTest,StagingDatabaseServiceTest),zero falhas/erros/ignorados. Validação completa posterior:256 testes Java aprovados,zero falhas/erros/ignorados;BUILD SUCCESS34.652s. Logs target-schema-authority.log e target-schema-full-regression.log. Não houve migração dos bancos originais. Reversão configuracional é possível;nenhuma nova migração de dados foi adicionada. Demais DDL legados em serviços continuam sujeitos à revisão individual;esta entrega consolida os dois inicializadores centrais.

## Atualização da fila FSRS após nova tentativa — F09/F19

LearningEvidenceService atualiza data_agendada,intervalo_dias e prioridade_score da revisão FSRS_ITEM com o estado mais recente. Antes,MIN(data) mantinha vencimento antigo e MAX(prioridade) mantinha prioridade de erro mesmo após recuperação correta. O histórico learning_evidence_projection preserva sinal de erro inesperado;reenvio idempotente não altera fila. IDs próprios isolam revisões manuais. Não foram alteradas equações FSRS nem migrados registros existentes em massa.

Dois testes de regressão adicionados: erro seguido de recuperação atualiza data/prioridade sem duplicar e replay antigo mantém estado;item concluído reabre após nova tentativa sem alterar revisão manual.

Comando: node scripts/validate-backend.cjs -Dtest=LearningEvidenceServiceTest,RevisionCalendarServiceTest,FsrsReferenceConformanceTest,AttemptIdentityRegressionTest test. Resultado BUILD SUCCESS24 testes,0 falhas,0 erros,0 ignorados. Log target-review-queue-stage.log. Suíte global256 aprovada na etapa anterior,não reexecutada nesta alteração. Homologação visual pendente.

## Fuso configurável nas revisões FSRS

LearningEvidenceService usa fiscalstudy.zone (ambiente FISCALSTUDY_ZONE) ao converter due_at para data_agendada. Default America/Sao_Paulo preservado;instantes de memória continuam UTC. Fuso inválido provoca falha explícita na inicialização,sem fallback silencioso. A mudança afeta novos agendamentos e novas respostas;datas históricas não são recalculadas em massa.

Testes novos com mesmo instante próximo da meia-noite em UTC e São Paulo comprovam mesma previsão de memória e dias locais diferentes;teste de fuso inválido. Validação LearningEvidenceServiceTest,FsrsReferenceConformanceTest,SchemaBootstrapIntegrationTest:14 testes aprovados,0 falhas/erros/ignorados;BUILD SUCCESS. Log target-timezone-stage.log. Nenhuma alteração das equações FSRS ou dos bancos originais. Outros serviços que usam datas devem ser revisados individualmente;esta entrega cobre agendamento FSRS.

## Calendário de revisões — dia local consistente

RevisionCalendarService usa Clock no fuso fiscalstudy.zone em todas as chamadas LocalDate.now:agendamento,agenda,contexto e conclusão/reagendamento. Antes dependia do fuso do computador,divergindo do FSRS configurado. Teste com instante2026-01-01T00:30Z comprova revisãoD1 em01/01para São Paulo e02/01para UTC. Instantes e datas históricas preservados.

Validação:RevisionCalendarServiceTest,LearningEvidenceServiceTest,SchemaBootstrapIntegrationTest —13 testes aprovados,0 falhas/erros/ignorados;BUILD SUCCESS. Log target-calendar-zone.log. Suíte global não reexecutada nesta alteração;outros módulos de planejamento ainda exigem inspeção individual.

## Rodada de produção — 25/10/2026

Registro incremental posterior à auditoria F01–F36, que permanece preservada. A autorização atual permite commits e publicação por área; referências históricas à ausência de autorização descrevem etapas anteriores. Nenhum merge na main foi realizado. A main remota foi reconfirmada em c26ee20352fc1b6ace0c58be4f24a41a1092fbf0.

| Área / achados relacionados | Agente real | Entrega e dependência | Estado final desta rodada |
| --- | --- | --- | --- |
| Justificativas pedagógicas / F20 | pedagogy_finish | fix/backend-pedagogical-reasons; base fix/backend-error-taxonomy; PR draft #9 | Publicada e validada em 17 testes direcionados. Observação, relato e hipótese separados; regras de agenda e FSRS preservadas. |
| Proveniência / F02, F17, F20 | analytics_finish | fix/analytics-learning-evidence; base feature/analytics-runtime; PR draft #8 | Publicada; 336 verificações R aprovadas. Perfil pessoal exige REAL_STUDY em todas as linhas; CSV Java já fornece origin_type. |
| Anotações e taxonomia / F07, F08 | taxonomy_review | fix/backend-annotation-order; base fix/backend-error-taxonomy; PR draft #10 | Publicada; 11 testes direcionados aprovados. Ordem por Instant preserva nanos, rowid desempata; eventos imutáveis. |
| Respostas não avaliáveis / F09, F20 | pedagogy_finish | fix/backend-ungraded-revisions; base fix/backend-pedagogical-reasons; PR draft #11 | Publicada; 19 testes direcionados aprovados. isCorrect=null não agenda revisão nem representa acerto. |
| Integração / F26 | integrated_validation | Cópia descartável FiscalStudy-round-validation, foundation e R externos apenas para testes | Suplemento de 25 testes aprovado. Suíte completa: 280 testes, uma falha ambiental, zero erros/ignorados; não aprovada integralmente. |
| Publicação | publication_access | Quatro branches e PRs draft via conector GitHub | Árvores equivalentes verificadas; mapas de seis commits locais/remotos em VALIDATION_REPORT.md. Nenhum merge. |
| Documentação | round_documentation | docs/production-round-20261025; base docs/execution-and-validation | Apenas plano central e relatório de validação; baseline preservada. |

Critérios, limites e recuperação:

- Uma área por branch, com dependências explícitas. Fontes emprestadas ao ambiente de teste não entram nos commits da área. Os testes direcionados e o suplemento de 25 se sobrepõem; não devem ser somados como casos distintos.
- O Git local foi bloqueado no gerenciador de credenciais. A publicação oficial pela API gerou commits remotos com metadados diferentes; igualdade da árvore foi conferida. Não se afirma push do commit local idêntico.
- Nenhuma migração ou escrita nos bancos originais, descarte de trabalho, sincronização AnkiWeb ou alteração das equações FSRS nesta rodada. Recuperação por branches e commits adicionais, sem reset destrutivo. A inspeção Git do caminho original foi inconclusiva; não se declara aquele checkout limpo.
- Primeira suíte completa: 280 testes, duas falhas e um ignorado; segunda: 280 testes, uma falha e zero ignorados, ambas sem erros. O bloqueio restante é a leitura nativa de arquivo pelo digest no ambiente. Base R c0f63c5 e nova f90574f rejeitam igualmente antes da regra de origem. Hash dos bytes via readBin coincide com manifesto e Get-FileHash; a auditoria não foi enfraquecida para aprovar o teste.
- Manifesto e SHA-256 demonstram integridade, não autoria, veracidade da origem ou aprendizagem. CSV sem origem permanece legível, porém inelegível como evidência pessoal.
- Não se encerram globalmente F01–F36. Curadoria, calibração individual, eficácia pedagógica, homologação visual e demais limitações anteriores permanecem. Evidências e mapas completos constam em VALIDATION_REPORT.md.
## Planejamento por concurso e checkpoint — retomada de 25/10/2026

A main remota avançou por outra frente para `fdd450c839c06e05379844b9a8f12edb2b438a5f` (`merge(wave-1)`). Esta equipe não executou esse merge. Os registros anteriores de main em c26ee20 são históricos. As branches abaixo partem de `13509e6` local / `e5320d05` remoto; a compatibilidade dos dois serviços-base e a ancestralidade foram conferidas antes de direcionar os PRs à main. Não se presume a resolução de todos os achados pela mensagem de merge.

| Área / relação com achados | Responsável real | Entrega e critério atendido | Estado |
| --- | --- | --- | --- |
| RobinHood / F09, F10, F20 | planning_finish | Concurso concreto sem tópicos permanece vazio; modo global legado preservado. Contagem de ciclos usa parâmetro SQL literal, incluindo identificadores com aspas. Serviço, regressões e contrato: três arquivos. | Publicada em [PR draft #13](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/13), duas alterações coesas, sem merge por esta equipe. |
| Maestro / F09, F10, F20 | maestro_finish | Tópicos, revisões, materiais e pendências de envio Anki respeitam concurso. Ausência de seleção/tópicos retorna estado vazio explícito, sem o tópico padrão Atos Administrativos. Pendência de envio não é anunciada como revisão vencida. Quatro arquivos. | Publicada em [PR draft #14](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/14), um commit, sem merge por esta equipe. |
| QA / F26 | planning_validation | test-compile e sete suítes: 30 testes, zero falhas/erros/ignorados; cinco hashes de fontes/testes iguais antes/depois. | Validação direcionada aprovada; log e limites em VALIDATION_REPORT.md. |
| Contexto e economia de leitura | planning_docs | [PROJECT_CHECKPOINT.md](PROJECT_CHECKPOINT.md), ponte no README e [nota importável](obsidian-sync/Estado-Atual.md). Obsidian e grafo são índices a conferir contra branch/commit. | Documentação do estado real; vault e índice originais não foram escritos. |

Riscos e recuperação: não houve migração ou escrita em bancos originais, mudança de FSRS, sincronização Anki ou descarte de backups/referências. Testes usam cópia mínima e bancos isolados; checkouts parciais evitaram duplicar referências volumosas. Alterações são recuperáveis por commits adicionais, sem reset destrutivo. A validação usa foundation externa ao checkout da área, não incorpora suas fontes aos commits e não comprova todos os commits atuais da main.

Pendências mantidas: elegibilidade de respostas em consumidores de planejamento, acerto imediato versus retenção, respeito ao tempo disponível, defaults de materiais/páginas, curadoria por tópico, homologação visual e calibração com dados reais. A correção do tópico padrão não autoriza afirmar que todo o plano deixou de conter valores presumidos. F01–F36 permanecem rastreados no baseline, sem encerramento global.

Reconsulta GitHub desta retomada: PRs #8–#12 estão fechados e integrados por outra frente em 25/10/2026; #13/#14 permanecem abertos como draft. Seus conteúdos anteriores são ancestrais da main fdd450c. Os estados draft registrados nas seções anteriores descrevem o momento da publicação, não o estado atual. Nenhum desses merges foi executado por esta equipe.
