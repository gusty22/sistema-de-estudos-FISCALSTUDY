# Compatibilidade de agentes
Política única: [AGENTS.md](../../AGENTS.md). Referências verificadas em 2026-10-29.
Nenhuma configuração aqui modifica permissões, autenticação, provedor ou MCP.

| Agente | Descoberta configurada | Skills | Estado da integração nesta execução |
|---|---|---|---|
| Codex | AGENTS.md raiz e por módulo | .agents/skills; catálogo sob demanda | VERIFIED apenas para a execução assistida desta tarefa e CLI; sem prova universal de obediência |
| Claude Code | CLAUDE.md com @AGENTS.md | leitura seletiva do SKILL.md; não se presume alias nativo .agents | CONFIGURED_NOT_TESTED |
| Gemini CLI | GEMINI.md com @AGENTS.md | .agents/skills é alias documentado; workspace deve ser confiado | CONFIGURED_NOT_TESTED |
| GitHub Copilot | .github/copilot-instructions.md aponta para AGENTS.md | varia por superfície/versão; leitura manual específica é fallback | CONFIGURED_NOT_TESTED |
| Cursor | .cursor/rules/fiscalstudy.mdc, alwaysApply; não reler se AGENTS já carregado | leitura seletiva, sem instalar cópias | CONFIGURED_NOT_TESTED |
| Cline | AGENTS.md reconhecido nas versões documentadas; sem arquivo extra | leitura seletiva como fallback | NOT_AVAILABLE para runtime local |
| Roo Code | formato .roo/rules documentado; nenhum adaptador instalado sem runtime para testar | não verificado | NOT_AVAILABLE |
| Windsurf/Cascade | AGENTS.md documentado; documentação atual redireciona a Devin Desktop | não verificado por versão local | NOT_AVAILABLE |

VERIFIED significa execução observada no escopo indicado; CONFIGURED_NOT_TESTED significa apenas arquivos/formato e referências testados. NOT_AVAILABLE é ausência de runtime identificável, não incompatibilidade intrínseca. NOT_SUPPORTED aplica-se a capacidade explicitamente ausente (ex.: CodeQL para R), não a um agente não executado.

A CLI e os testes determinísticos foram exercitados em Windows e Linux na CI do commit 328c40e: [Security controls 40976806901](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40976806901), todos aprovados. Isso não executa os modelos/agentes externos. Testes determinísticos verificam caminhos/imports/orçamento/fallback, não comportamento de modelos.

## Validação real por instalação
Sem chamar API paga nem instalar agente nesta operação. Em cada instalação futura, registrar versão, configuração ativa, instruções carregadas e respostas para:
1. Localizar ProspectivePredictionService pela CLI e confirmar arquivo/linha.
2. Identificar can_apply=false/can_schedule=false e a distinção acerto/retenção.
3. Localizar uma decisão e seu contrato; abrir somente o trecho necessário.
4. Simular PATH sem graphify e índice FTS ausente em diretório temporário: recuperar pelos fontes/docs sem sincronização.
5. Mostrar apenas a skill pertinente, sem importar todas.
Claude: inspecionar /memory; Gemini: /memory show e /skills list; Cursor: painel de regras aplicadas; Copilot: referências de instruções na superfície utilizada. Não executar nova tarefa de modelo como teste sem orçamento e credenciais disponíveis.

## Precedência
Não existe ordem universal de instruções no software de agentes. A plataforma/organização pode ter prioridade própria. Permissões reais nunca são concedidas por Markdown.
No projeto: raiz define núcleo; módulo especializa seu escopo; adaptador só importa/aponta. Não duplicar regras científicas em adaptadores.
Claude expande @ relativo ao arquivo; mantém import para versões sem AGENTS nativo. Configuração managed-only pode impedir o carregamento; observar /memory.
Gemini combina contexto global/workspace/subdiretórios conforme configuração; import relativo mantém a fonte única.
Copilot combina tipos de instruções conforme a superfície; link é instrução de leitura, não import automático garantido. Leitura de AGENTS de módulo é exigida pelo núcleo.
Cursor alwaysApply injeta só o ponteiro curto; AGENTS nativo, quando ativo, evita segunda leitura.
Sem shell, ler AGENTS e trechos acessíveis, usar os caminhos do índice e declarar ferramentas não executadas.

## Fontes oficiais
- [Claude imports e AGENTS](https://code.claude.com/docs/en/memory)
- [Gemini contexto](https://geminicli.com/docs/cli/gemini-md/), [skills/aliases](https://geminicli.com/docs/cli/skills/)
- [Copilot instruções](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)
- [Cursor regras](https://cursor.com/docs/rules)
- [Cline regras](https://docs.cline.bot/customization/cline-rules)
- [Roo regras](https://docs.roocode.com/features/custom-instructions)
- [Windsurf/Cascade AGENTS](https://docs.windsurf.com/windsurf/cascade/agents-md)
