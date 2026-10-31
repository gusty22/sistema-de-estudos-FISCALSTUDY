# Compatibilidade de agentes
Política única: [AGENTS.md](../../AGENTS.md). Referências verificadas em 2026-10-31.
Nenhuma configuração aqui modifica permissões, autenticação, provedor ou MCP.

| Agente | Descoberta configurada | Skills / Especialistas | Estado da integração nesta execução |
|---|---|---|---|
| Antigravity App / CLI (`agy`) | `AGENTS.md` raiz e por módulo; `.agents/agents/*.md` quando aberto na raiz do repositório (`.git`) | `.agents/skills` sob demanda; coordenador `cto-fiscalstudy` (`--agent cto-fiscalstudy` no CLI ou seletor de agente no App) + 6 especialistas persistentes via `invoke_subagent` | `VERIFIED` em duas conversas independentes: descoberta de 7 agentes, zero subagentes ociosos no bootstrap e invocação sob demanda com encerramento limpo |
| Codex | `AGENTS.md` raiz e por módulo | `.agents/skills`; catálogo sob demanda | `VERIFIED` apenas para a execução assistida desta tarefa e CLI; sem prova universal de obediência |
| Claude Code | `CLAUDE.md` com `@AGENTS.md` | leitura seletiva do `SKILL.md`; não se presume alias nativo `.agents` | `CONFIGURED_NOT_TESTED` |
| Gemini CLI | `GEMINI.md` com `@AGENTS.md` | `.agents/skills` é alias documentado; workspace deve ser confiado | `CONFIGURED_NOT_TESTED` |
| GitHub Copilot | `.github/copilot-instructions.md` aponta para `AGENTS.md` | varia por superfície/versão; leitura manual específica é fallback | `CONFIGURED_NOT_TESTED` |
| Cursor | `.cursor/rules/fiscalstudy.mdc`, `alwaysApply`; não reler se `AGENTS` já carregado | leitura seletiva, sem instalar cópias | `CONFIGURED_NOT_TESTED` |
| Cline | `AGENTS.md` reconhecido nas versões documentadas; sem arquivo extra | leitura seletiva como fallback | `NOT_AVAILABLE` para runtime local |
| Roo Code | formato `.roo/rules` documentado; nenhum adaptador instalado sem runtime para testar | não verificado | `NOT_AVAILABLE` |
| Windsurf/Cascade | `AGENTS.md` documentado; documentação atual redireciona a Devin Desktop | não verificado por versão local | `NOT_AVAILABLE` |

`VERIFIED` significa execução observada no escopo indicado; `CONFIGURED_NOT_TESTED` significa apenas arquivos/formato e referências testados. `NOT_AVAILABLE` é ausência de runtime identificável, não incompatibilidade intrínseca. `NOT_SUPPORTED` aplica-se a capacidade explicitamente ausente (ex.: CodeQL para R), não a um agente não executado.

A CLI e os testes determinísticos foram exercitados em Windows e Linux na CI do commit `328c40e`: [Security controls 40976806901](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40976806901), todos aprovados. Isso não executa os modelos/agentes externos. Testes determinísticos verificam caminhos/imports/orçamento/fallback, não comportamento de modelos.

## Descoberta e inicialização da equipe no Antigravity (`cto-fiscalstudy` + 6 especialistas)
1. **Requisito de raiz do workspace**: O Antigravity descobre `.agents/agents/*.md` e `AGENTS.md` caminhando do diretório de trabalho até a raiz do repositório (`.git`). Abra o projeto diretamente na raiz do checkout Git (ex.: `C:\Users\washi\workspaces\fiscalstudy-multiagent-foundation`), e não em uma pasta-mãe sem `.git`.
2. **Agentes persistentes descobertos (7 no total)**:
   - Coordenador principal (`mainAgent: true`, `subagent: false`): `cto-fiscalstudy`.
   - Especialistas invocáveis sob demanda (`mainAgent: true`, `subagent: true`): `adversarial-auditor`, `backend-java-specialist`, `github-integration-specialist`, `quality-supervisor`, `r-engine-specialist`, `scientific-director`.
3. **Seleção do coordenador principal**:
   - No CLI: `agy --add-dir <raiz-do-repo> --agent cto-fiscalstudy` (ou selecione `cto-fiscalstudy` na UI do Antigravity App ao abrir uma conversa). A seleção de um agente customizado como agente principal não é automática por padrão sem `--agent` ou escolha explícita no seletor da UI; porém, mesmo com o agente padrão, `AGENTS.md` e `.agents/memory/CONTEXT.md` são carregados e os 6 especialistas ficam disponíveis em `invoke_subagent`.
4. **Diferença entre agentes disponíveis e sessões ativas**: A presença dos especialistas em `agy agents` / `Available subagents` não cria processos em background. Subagentes só são instanciados quando `invoke_subagent` é chamado para uma tarefa concreta e devem ser encerrados com `manage_subagents(Action="kill")`.

## Validação real por instalação
Sem chamar API paga nem instalar agente sem necessidade. Em cada instalação futura, registrar versão, configuração ativa, instruções carregadas e respostas para:
1. Localizar `ProspectivePredictionService` pela CLI e confirmar arquivo/linha.
2. Identificar `can_apply=false`/`can_schedule=false` e a distinção acerto/retenção.
3. Localizar uma decisão e seu contrato; abrir somente o trecho necessário.
4. Simular PATH sem graphify e índice FTS ausente em diretório temporário: recuperar pelos fontes/docs sem sincronização.
5. Mostrar apenas a skill pertinente, sem importar todas.
6. No Antigravity: validar `agy --add-dir <repo> agents` (7 agentes), iniciar duas conversas novas independentes com `--agent cto-fiscalstudy`, comprovar `0` subagentes ativos sem tarefa e validar o acionamento sob demanda e encerramento (`kill`) de um único especialista de leitura.
Claude: inspecionar `/memory`; Gemini: `/memory show` e `/skills list`; Cursor: painel de regras aplicadas; Copilot: referências de instruções na superfície utilizada.

## Precedência
Não existe ordem universal de instruções no software de agentes. A plataforma/organização pode ter prioridade própria. Permissões reais nunca são concedidas por Markdown.
No projeto: raiz define núcleo; módulo especializa seu escopo; adaptador só importa/aponta. Não duplicar regras científicas em adaptadores.
Claude expande `@` relativo ao arquivo; mantém import para versões sem `AGENTS` nativo. Configuração managed-only pode impedir o carregamento; observar `/memory`.
Gemini combina contexto global/workspace/subdiretórios conforme configuração; import relativo mantém a fonte única.
Copilot combina tipos de instruções conforme a superfície; link é instrução de leitura, não import automático garantido. Leitura de `AGENTS` de módulo é exigida pelo núcleo.
Cursor `alwaysApply` injeta só o ponteiro curto; `AGENTS` nativo, quando ativo, evita segunda leitura.
Sem shell, ler `AGENTS` e trechos acessíveis, usar os caminhos do índice e declarar ferramentas não executadas.

## Fontes oficiais
- [Antigravity Subagents & Customizations](https://antigravity.google/docs/subagents)
- [Claude imports e AGENTS](https://code.claude.com/docs/en/memory)
- [Gemini contexto](https://geminicli.com/docs/cli/gemini-md/), [skills/aliases](https://geminicli.com/docs/cli/skills/)
- [Copilot instruções](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)
- [Cursor regras](https://cursor.com/docs/rules)
- [Cline regras](https://docs.cline.bot/customization/cline-rules)
- [Roo regras](https://docs.roocode.com/features/custom-instructions)
- [Windsurf/Cascade AGENTS](https://docs.windsurf.com/windsurf/cascade/agents-md)
