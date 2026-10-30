# FiscalStudy — protocolo compartilhado
Leia uma vez por tarefa; execute da raiz. Sem execução, use arquivos acessíveis e declare a limitação.

## Ciclo universal dos agentes
1. **Ao iniciar**:
   - Verifique `git status --short`, HEAD, main remota e PRs; preserve mudanças locais e use branch própria baseada na referência confirmada. Proibidos push na main, merge e automerge.
   - Leia `.agents/memory/CONTEXT.md` e identifique o módulo e seu AGENTS.md antes de editar.
   - Consulte tarefas e código: execute `python scripts/context.py doctor` com shell. Tarefas: `python scripts/context.py task list` e `task show ID`; código: `locate SIMBOLO --module M`; decisões: `decision TERMOS`; trechos: `docs TERMOS --path ARQ`.
   - Sincronize grafo estrutural Graphify e Obsidian FTS5 semântico (`knowledge/`). Sem grafo, busque texto seletivamente; sem Obsidian, use fallback versionado. Confirme código, contrato e testes antes de implementar algo existente.
   - Leia trechos pertinentes com limite de linhas; não o acervo inteiro, relatórios completos do grafo ou todas as skills. Não repita consultas sem nova evidência.

2. **Durante a execução**:
   - Reutilize serviços/contratos e faça o menor diff completo, sem abstrações ou infraestrutura especulativas.
   - Registre descobertas e checkpoints importantes incrementalmente: `python scripts/context.py task update ID --discoveries "..." --changes "..." --pending "..."`.
   - Skills sob demanda: bug → systematic-debugging; implementação → implement/verificação; arquitetura → OpenSpec se necessário; diff sensível → revisão/segurança. Catálogo: `docs/engineering/SKILLS.md`; sem descoberta nativa, leia só o SKILL.md específico.
   - Em marcos longos, mantenha checkpoint em `docs/engineering/checkpoints/`, distinguindo local, commitado e publicado.

3. **Ao concluir**:
   - Execute testes pertinentes e `git diff --check`; alterações no backend exigem test-compile e suíte afetada. Não suprima falhas. Diferencie falhas herdadas usando a base.
   - Atualize tarefa via `python scripts/context.py task update ID`: status, testes, evidências, pendências e próxima ação. Nunca marque VALIDATED sem testes/evidências concretas nem MERGED sem confirmação expressa do GitHub/PR.
   - Após mudar código estrutural ou notas técnicas, sincronize índices aplicáveis com `python scripts/context.py update` uma vez.
   - Declare pendências, limitações verificadas e próxima ação antes de encerrar ou submeter PR.
   - Atualize documento canônico apenas por decisão, contrato, descoberta, evidência ou marco duradouro; nota por commit é desnecessária. Sync do Obsidian é explícito e nunca escreve no vault.
   - Informe arquivos, referência Git, comandos/resultados e limitações. Não declare economia de tokens, execução ou conclusão científica sem evidência.

## Limites comuns
Backend Java/Spring Boot/SQLite; frontend React/TypeScript; ingestão Python; pesquisa em analytics-engine/R e lab.
Event store APPEND-ONLY; R nunca escreve no SQLite operacional. Mantenha local-first e fallback resiliente.
Não altere FSRS, calendário, modelos ou políticas científicas em manutenção de ferramentas. Não acesse dados pessoais para recuperar contexto; não versione credenciais, chaves, exportações ou índices.
Não use IA generativa para cálculos determinísticos ou regras de banca. Não instale ferramentas sem revisar procedência, licença, executáveis, dependências e permissões.
Fixtures verificam software, não aprendizagem pessoal. Correlação não demonstra causalidade; acerto não demonstra retenção; recuperação, aplicação e transferência são distintos. Incerteza e ausência de evidência permanecem explícitas.
Políticas experimentais mantêm `can_apply=false` e `can_schedule=false`. Não modifique captura, custódia ou origem dos dados para facilitar testes.

## Escopo e precedência
Prevalecem permissões/instruções da plataforma. AGENTS.md de módulo especializa este núcleo sem enfraquecer segurança/integridade. Adaptadores descobrem este arquivo, sem regras concorrentes. Respeite a ordem real da ferramenta e registre conflitos relevantes, sem escolher silenciosamente regra permissiva. Detalhes: `docs/engineering/AGENT_COMPATIBILITY.md`.

## Publicação obrigatória
Leia e cumpra `docs/engineering/AGENT_PR_WORKFLOW.md`, contrato canônico da PR #70. Toda tarefa exige Issue, branch exclusiva, conta `gusty22` e PR draft no primeiro commit verificável; use `scripts/agent_pr.py`. Declare dependências e empilhe contra a PR-mãe; após merge confirmado, reconcilie, teste e atualize a base. Proibidos push na main, force-push e merge/automerge por agentes. Entregue link, Issue, base/HEAD, CI, testes, riscos e pendências. Se publicar falhar, preserve commits e registre bloqueio. O fluxo não amplia permissões ou autoridade científica.
