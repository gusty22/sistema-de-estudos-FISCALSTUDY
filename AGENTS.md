# FiscalStudy — protocolo compartilhado
Leia este arquivo uma vez por tarefa. Agentes sem execução usam os arquivos acessíveis e declaram a limitação.

## Início e recuperação
1. Confira repositório, `git status --short`, HEAD, main remota e PRs pertinentes; preserve trabalho local. Use branch própria baseada na referência verificada. Nunca push direto para main, merge ou automerge.
2. Leia o índice compacto `.agents/memory/CONTEXT.md`; identifique o módulo e seu AGENTS.md antes de editar.
3. Execute `python scripts/context.py doctor` se houver shell. Para localizar código: `locate SIMBOLO --module backend`; para decisões: `decision TERMOS`; para trechos: `docs TERMOS --path ARQUIVO`. Veja `--help` apenas se necessário.
4. Grafo somente atualizado; homônimos exigem ID completo. Graphify é navegação estrutural, não compreensão semântica universal. Sem grafo, busca textual seletiva; sem Obsidian, documentos versionados. Confirme no código, contrato, chamadores e testes antes de implementar algo existente.
5. Abra somente trechos pertinentes. Não leia acervo, relatório inteiro do grafo ou todas as skills. Não repita consulta sem nova evidência; amplie apenas por motivo objetivo.

## Limites comuns
Backend Java/Spring Boot/SQLite; frontend React/TypeScript; ingestão Python; pesquisa em analytics-engine/R e lab.
Event store APPEND-ONLY; R nunca escreve no SQLite operacional. Mantenha local-first e fallback resiliente.
Não altere FSRS, calendário, modelos ou políticas científicas em manutenção de ferramentas. Não acesse dados pessoais para recuperar contexto; não versione credenciais, chaves, exportações ou índices.
Não use IA generativa para cálculos determinísticos ou regras de banca. Não instale ferramentas sem revisar procedência, licença, executáveis, dependências e permissões.
Fixtures verificam software, não aprendizagem pessoal. Correlação não demonstra causalidade; acerto não demonstra retenção; recuperação, aplicação e transferência são distintos. Incerteza e ausência de evidência permanecem explícitas.
Políticas experimentais mantêm `can_apply=false` e `can_schedule=false`. Não modifique captura, custódia ou origem dos dados para facilitar testes.

## Execução e conclusão
Reutilize serviços/contratos; faça o menor diff completo, sem abstrações ou infraestrutura especulativas.
Ative skills sob demanda: bug → systematic-debugging; implementação → implement/verificação; arquitetura → OpenSpec quando necessário; diff sensível → revisão/segurança. Catálogo: `docs/engineering/SKILLS.md`. Sem descoberta nativa, leia o SKILL.md específico; não copie todo o catálogo.
Execute testes pertinentes e `git diff --check`; backend alterado exige test-compile e suíte afetada. Não suprima falhas. Diferencie falhas herdadas usando a base.
Após mudança estrutural concluída: `python scripts/context.py update` uma vez. Ausência de índice opcional não bloqueia o produto.
Atualize documento canônico apenas por decisão, contrato, descoberta, evidência ou marco duradouro; nota por commit é desnecessária. Sync de conhecimento é explícito e nunca escreve no vault.
Informe arquivos, referência, comandos/resultados e limitações. Não declare economia de tokens, execução ou conclusão científica sem evidência.
Em marcos de trabalho longo, mantenha checkpoint próprio em `docs/engineering/checkpoints/`, distinguindo local, commitado e publicado.

## Escopo e precedência
As permissões e instruções de maior prioridade da plataforma continuam válidas. Este é o núcleo comum; AGENTS.md de módulo especializa seu escopo sem enfraquecer segurança/integridade. Adaptadores apenas descobrem este arquivo e não criam regras concorrentes. Respeite a ordem real da ferramenta; conflitos relevantes devem ser registrados, sem escolher silenciosamente uma regra permissiva. Detalhes: `docs/engineering/AGENT_COMPATIBILITY.md`.
