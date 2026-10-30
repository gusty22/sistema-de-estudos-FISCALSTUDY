# FiscalStudy — protocolo compartilhado
Leia este arquivo uma vez por tarefa. Execute os comandos a partir da raiz do repositório. Agentes sem execução usam os arquivos acessíveis e declaram a limitação.

## Ciclo universal dos agentes
1. **Ao iniciar**:
   - Confira o repositório: `git status --short`, HEAD, main remota e PRs pertinentes; preserve o trabalho local. Use branch própria baseada na referência verificada. Nunca faça push direto para main, merge ou automerge.
   - Consulte o contexto mínimo: leia o índice executivo `.agents/memory/CONTEXT.md`; identifique o módulo e seu AGENTS.md específico antes de editar.
   - Consulte tarefas ativas e código real: execute `python scripts/context.py doctor` se houver shell. Para tarefas ativas: `python scripts/context.py task list` e `task show ID`; para código real: `locate SIMBOLO --module M`; para decisões: `decision TERMOS`; para trechos: `docs TERMOS --path ARQ`.
   - Mantenha grafo e Obsidian sincronizados: Graphify é estrutural; Obsidian FTS5 é semântico (`knowledge/`). Sem grafo, faça busca textual seletiva; sem Obsidian, use fallback versionado. Confirme no código, contrato e testes antes de implementar algo existente.
   - Abra somente trechos pertinentes com limites de linhas. Não leia o acervo inteiro, relatórios completos do grafo ou todas as skills. Não repita consultas sem nova evidência.

2. **Durante a execução**:
   - Reutilize serviços e contratos existentes; faça o menor diff completo, sem abstrações ou infraestrutura especulativas.
   - Registre descobertas e checkpoints importantes incrementalmente: `python scripts/context.py task update ID --discoveries "..." --changes "..." --pending "..."`.
   - Ative skills estritamente sob demanda: bug → systematic-debugging; implementação → implement/verificação; arquitetura → OpenSpec quando necessário; diff sensível → revisão/segurança. Catálogo: `docs/engineering/SKILLS.md`. Sem descoberta nativa, consulte apenas o SKILL.md específico.
   - Em marcos de trabalho longo, mantenha checkpoint próprio em `docs/engineering/checkpoints/`, distinguindo local, commitado e publicado.

3. **Ao concluir**:
   - Execute testes pertinentes e `git diff --check`; alterações no backend exigem test-compile e suíte afetada. Não suprima falhas. Diferencie falhas herdadas usando a base.
   - Atualize registros da tarefa: `python scripts/context.py task update ID --status VALIDATED --tests ... --evidence ... --pending ... --next ...`. Invariantes obrigatórias: nunca marque VALIDATED sem testes/evidências concretas nem MERGED sem confirmação expressa do GitHub/PR.
   - Sincronize índices aplicáveis: após alteração de código estrutural ou modificação de notas técnicas, execute `python scripts/context.py update` uma vez.
   - Declare pendências ativas, limitações verificadas e próxima ação objetiva antes de encerrar o turno ou submeter PR.
   - Atualize documento canônico apenas por decisão, contrato, descoberta, evidência ou marco duradouro; nota por commit é desnecessária. Sync do Obsidian é explícito e nunca escreve no vault.
   - Informe arquivos modificados, referência Git, comandos/resultados e limitações. Não declare economia de tokens, execução ou conclusão científica sem evidência.

## Limites comuns
Backend Java/Spring Boot/SQLite; frontend React/TypeScript; ingestão Python; pesquisa em analytics-engine/R e lab.
Event store APPEND-ONLY; R nunca escreve no SQLite operacional. Mantenha local-first e fallback resiliente.
Não altere FSRS, calendário, modelos ou políticas científicas em manutenção de ferramentas. Não acesse dados pessoais para recuperar contexto; não versione credenciais, chaves, exportações ou índices.
Não use IA generativa para cálculos determinísticos ou regras de banca. Não instale ferramentas sem revisar procedência, licença, executáveis, dependências e permissões.
Fixtures verificam software, não aprendizagem pessoal. Correlação não demonstra causalidade; acerto não demonstra retenção; recuperação, aplicação e transferência são distintos. Incerteza e ausência de evidência permanecem explícitas.
Políticas experimentais mantêm `can_apply=false` e `can_schedule=false`. Não modifique captura, custódia ou origem dos dados para facilitar testes.

## Escopo e precedência
As permissões e instruções de maior prioridade da plataforma continuam válidas. Este é o núcleo comum; AGENTS.md de módulo especializa seu escopo sem enfraquecer segurança/integridade. Adaptadores apenas descobrem este arquivo e não criam regras concorrentes. Respeite a ordem real da ferramenta; conflitos relevantes devem ser registrados, sem escolher silenciosamente uma regra permissiva. Detalhes: `docs/engineering/AGENT_COMPATIBILITY.md`.


## Publicacao obrigatoria de cada tarefa (Antigravity, Codex e outros agentes)
- Cada tarefa independente deve ter Issue (criada pelo proprio agente com a conta conectada do mantenedor), branch exclusiva e PR **draft publicado assim que houver o primeiro commit verificavel**, nao apenas ao final. Nao encerre a tarefa com commits locais sem PR.
- Antes de criar a branch, confirme `gh api user` = `gusty22`; se nao estiver autenticado assim, pare e solicite reconexao, em vez de publicar em nome de um bot. Credenciais jamais sao versionadas.
- Para tarefa independente, baseie a branch na `origin/main` atual. Para tarefa dependente, crie branch a partir da branch da PR-mae ainda aberta, declare `Depends-on: #NUMERO` e abra PR empilhada **contra essa branch**, nunca diretamente na main ate a dependente estar pronta.
- Execute `python scripts/agent_pr.py --issue NUM --title "..." --summary "..." --tests "..." --risks "..."` apos o primeiro commit e novamente ao atualizar os resultados. Adicione `--depends-on NUM_DA_PR_MAE` quando necessario. O script faz push sem force e cria/atualiza o PR draft na conta do proprietario.
- Ao abrir ou atualizar PR: examine o diff, status dos workflows, `PR contract and dependencies`, testes de modulo, conflitos e versao da base. Corrija falhas; nao anuncie conclusao, prontidao nem merge sem evidencia.
- Se a PR-mae for mesclada, o proprio agente deve reconciliar sua branch com a nova main, resolver conflitos com revisao semantica, reexecutar testes e retarget da PR-filha para main. Se a PR-mae for rejeitada, nao promova automaticamente a filha.
- **Nao chamar merge/automerge, nao fazer push direto na main, nao usar force-push para contornar revisao.** A aprovacao e integracao final pertencem ao mantenedor.
- Todo trabalho termina com link de PR, numero da Issue, base/HEAD, CI, testes, riscos, dependencias e pendencias. Se a publicacao falhar, reportar o erro, reter commits e nao declarar entregue.
- Documentacao e comando operacional: `docs/engineering/AGENT_PR_WORKFLOW.md`. A automacao de PR nao amplia permissoes de acesso ou autoridade cientifica do Motor R.
