# AGENTS.md

## Regra Fundamental de Contexto
- **LEITURA OBRIGATÓRIA**: Antes de iniciar qualquer tarefa nova em uma conversa, sugerir arquiteturas, definir banco de dados ou começar a codificar, você **DEVE** ler o arquivo `docs/PROMPT_MESTRE.md` (utilizando a ferramenta `view_file`). Este documento dita toda a filosofia do projeto, as restrições arquiteturais e o **formato estruturado** que suas respostas devem ter. Não inicie o trabalho sem ler o conteúdo de `docs/PROMPT_MESTRE.md`.


## Stack
- **Backend:** Java + Spring Boot + Java LTS.
- **Banco:** SQLite.
- **Ingestão:** Python.
- **Frontend:** React + TypeScript + Vite.

## Arquitetura
- **Princípio Central:** APPEND-ONLY EVENT LOG + MATERIALIZED PROJECTIONS. Eventos históricos nunca são alterados ou apagados. Não usamos Event Sourcing puro para reconstrução de toda a aplicação.
- **Event Store:** Armazena eventos de resolução e interação do usuário. O estado atual e estatísticas podem ser derivados dos eventos.
- **Extração de PDF:** Ingestão em Python compatível com Docling/PyMuPDF. Os arquivos em PDF originais não devem ser armazenados permanentemente no banco local, somente os dados estruturados e recortes de imagens essenciais, através de media_assets.

## Regras de Código
- Desenvolver passos pequenos e validar.
- O frontend inicial deve ser WEB/RESPONSIVE (foco em desktop e tablet). Não utilizar React Native.

## Regras de Dados
- **Proveniência:** Toda questão deve rastrear fielmente sua origem (documento fonte, banca, órgão, páginas, etc).
- **Imutabilidade:** Eventos no banco (`event_store`) são estritamente append-only e nunca podem ser alterados ou apagados.
- **Golden Set:** Utilizar as provas em `/tests/golden-set/` para validar a precisão da extração.

## Regras de Escopo
- **NÃO ADICIONAR ESCOPO.** Entregar estritamente o que foi solicitado.
- **NÃO MODIFICAR DECISÕES ARQUITETURAIS** sem autorização explícita.
- **NÃO INTRODUZIR DEPENDÊNCIAS DESNECESSÁRIAS** (sem microserviços, Kafka, Redis, etc, nesta fase inicial).
- **NÃO UTILIZAR IA GENERATIVA PARA LÓGICA DETERMINÍSTICA.**

## Funcionalidades Proibidas Nesta Etapa
- BKT, IRT, FSRS, integração com Spark, Anki, Google Drive, dashbords complexos, modelos de fadiga, Knowledge Graph completo, Material Library completa.

## Regra de Testes Obrigatórios
- Testes são rigorosamente exigidos.
- Testar: criação de schemas, persistência de banco, importação da fixture, leitura de API, registro e resposta de eventos.
- Requer pelo menos um teste de aceitação end-to-end (E2E). O passo só é dado como concluído quando os testes passam.

## Protocolo de Versionamento (Git)
- Avalie as alterações antes de comitar. Commits devem ser orgânicos e granulares (separe alterações de naturezas diferentes).
- NÃO crie mensagens robóticas ou genéricas como 'update', 'fixes' ou descrições excessivamente detalhadas que pareçam criadas por IA. Aja como um mantenedor humano mantendo o próprio projeto.
- NUNCA suba arquivos sensíveis (DBs locais, credenciais, proofs originais em /tests/golden-set/docs/ ou a pasta de /references/).
