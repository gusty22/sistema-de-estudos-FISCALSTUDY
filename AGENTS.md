# AGENTS.md — Diretrizes Operacionais e Arquitetura do FiscalStudy

## 1. Protocolo de Inicialização e Contexto Mínimo
- **Passo 1 (Obrigatório ao iniciar)**: Consulte o índice executivo em `.agents/memory/CONTEXT.md` para recuperar o estado do projeto, stack, ferramentas ativas e localização das especificações.
- **Passo 2 (Leitura seletiva)**: NÃO leia documentação extensa (`PROMPT_MESTRE.md` ou histórico completo). Acesse pontualmente apenas o módulo correspondente à tarefa em `docs/architecture/modules/MODULOS_ESPECIFICACOES.md`.

## 2. Postura de Engenharia Pragmática (Diretrizes Ponytail / YAGNI)
- **O melhor código é o que não precisou ser escrito**: Reutilize sempre componentes, utilitários e serviços existentes antes de criar novos.
- **Escopo estrito**: Entregue apenas a menor mudança completa necessária para atender à solicitação. Não adicione abstrações genéricas ou antecipações especulativas.
- **Sem dependências supérfluas**: Não introduza microsserviços, message brokers (Kafka/RabbitMQ) ou bancos em memória (Redis) nesta fase. Mantenha a arquitetura simples e local-first.

## 3. Stack e Restrições Arquiteturais
- **Backend:** Java LTS + Spring Boot + SQLite local.
- **Frontend:** React + TypeScript + Vite (Tecnologia Calma: tema ardósia/paper, tipografia relaxante, responsivo para desktop/tablet).
- **Ingestão:** Python com PyMuPDF/Docling (isolamento de staging em `db/staging.db` vs produção em `db/fiscalstudy.db`).
- **Analytics:** Motor R (`digital_twin_engine.R`) com comunicação assíncrona; R nunca escreve diretamente no SQLite.
- **Imutabilidade:** O log de eventos (`event_store`) é estritamente **APPEND-ONLY**. Eventos históricos nunca são alterados ou apagados.
- **IA Generativa:** Proibido utilizar IA generativa para lógica determinística, cálculos de notas ou regras de bancas examinadoras.

## 4. Eficiência de Tokens e Execução de Comandos
- **Comandos compactos**: Sempre adicione limitadores de saída (ex: `git log -n 5`, `Select-Object -First 20`, `--quiet`).
- **Edições cirúrgicas**: Prefira substituições de blocos (`replace_file_content`) em vez de reescrever arquivos completos.
- **Erros pontuais**: Reporte apenas o stack trace relevante e o arquivo/linha exata da falha.

## 5. Protocolo de Testes e Validação Obrigatória
- Testes automatizados são rigorosamente obrigatórios antes de considerar uma tarefa pronta (`mvnw.cmd test-compile` e suítes específicas do módulo).
- Commits devem ser orgânicos, atômicos e com mensagens objetivas de engenharia.
