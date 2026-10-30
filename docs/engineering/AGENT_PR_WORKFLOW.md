# FiscalStudy — fluxo obrigatório de branches, agentes e PRs

## Responsabilidade e objetivo

O GitHub é a fonte de verdade: a main contém somente integrações verificadas. Antigravity, Codex e demais agentes publicam o trabalho com a conta autorizada do mantenedor (`gusty22`), em PR rastreável e revisável. Nenhum agente está autorizado a mesclar na main, aprovar em nome do mantenedor, fazer force-push ou ocultar falhas.

O script `scripts/agent_pr.py` **não é um serviço em background**: cada agente deve executá-lo no primeiro checkpoint com commit e sempre que atualizar a entrega. Não há criação de PR por GitHub Actions/bot para evitar atribuição da proposta a outro usuário.

## Abertura (responsabilidade do agente, não do usuário)

1. Verificar `gh auth status`, `gh api user --jq .login` (precisa retornar `gusty22`) e `git status --short`. Não publicar com outra identidade.
2. Buscar `git fetch origin main` e inspecionar PRs abertos e tarefas próximas. Reaproveitar trabalho já entregue; nunca iniciar outro PR equivalente.
3. Criar uma Issue, se não existir: `gh issue create --repo gusty22/sistema-de-estudos-FISCALSTUDY --title "TASK: ..." --body "Objetivo, escopo, critérios de aceite e dependências"`. Guardar seu número no contexto da tarefa.
4. Tarefa independente: `git switch -c feature/NOME origin/main`. Tarefa dependente: consultar a PR-mãe, buscar sua branch e criar a filha a partir da branch da mãe (por exemplo, `git switch -c feature/FILHA origin/feature/MAE`). Não criar filha diretamente na main se depende de código ainda não integrado.
5. Implementar um primeiro checkpoint verificável; fazer commit e invocar `scripts/agent_pr.py`. O PR nasce como **draft**, sem aprovação automática. Se o agente ainda não tiver commits, registrar Issue/branch e não inventar alterações para produzir PR vazio.

## Publicação idempotente

Exemplo de tarefa independente:

```bash
python scripts/agent_pr.py --issue 100 --title "feat: registrar telemetria de tentativa" --summary "Expõe contrato observado e testes" --tests "17 testes passaram" --risks "Sem alteração no FSRS"
```

Exemplo de tarefa dependente da PR #101, ainda aberta:

```bash
python scripts/agent_pr.py --issue 102 --depends-on 101 --title "feat: consumir contrato da PR 101" --summary "Integra consumidor após contrato-base" --tests "12 testes passaram" --risks "Bloqueado pela PR 101"
```

Repetir o comando após novos commits para atualizar o mesmo PR. Ele usa `gh` e `git` já autenticados, recusa main, branch suja, conta diferente, base desatualizada e dependência fechada sem merge. Não armazena token nem executa automerge.

## Dependências e integração sequencial

```text
main (estável)
  |
  +-- PR #101 (base main) --------> revisão humana e CI ----> merge na main
         |
         +-- PR #102 (base feature/PR101) -- atualização da base para main --> revisão e CI --> merge
                |
                +-- PR #103 (base feature/PR102) -- atualização após merge de #102 --> revisão e CI
```

Ao mesclar uma mãe, as PRs filhas não entram automaticamente. O agente da filha rebaseia/mescla a main conscientemente, trata conflitos de conteúdo, roda testes, atualiza a descrição e a base para main. Prefira `git merge origin/main` sem reescrever commits publicados; quando a política exigir rebase, coordene explicitamente a atualização sem force-push. Evite PRs empilhadas gigantes e mantenha escopo reduzido.

Se tarefas independentes se sobrepuserem em arquivos ou contratos, suspenda a integração da segunda até validar o diff na main atualizada. Não mescle uma composição experimental inteira quando só faltarem documentos ou testes.

## Contrato mínimo de PR

A descrição exige `Issue: #N`, `Depends-on: none` ou `#N`, `Testes: ...` e `Riscos: ...`. A Action read-only `PR contract` valida autoria, vínculo, base, estado da dependência e atualização da branch. Os testes de backend/frontend/laboratório continuam independentes; um check verde de metadados **não equivale** à validação do software.

Ao concluir, entregar link da PR, Issue, base, SHA, CI, testes, riscos, conflitos e limitações. Se o CI estiver pendente ou falhar, manter o PR draft e indicar a pendência.

## Proteção no GitHub — configuração necessária do proprietário

Em **Settings → Rules → Rulesets** (ou Branch protection rules, quando disponível), configurar regra para `main`:
- Exigir PR e bloquear pushes diretos e exclusão da main.
- Exigir verificações relevantes da área e `PR contract and dependencies`; quando alguma verificação usa filtro de paths, use checks estáveis para não bloquear PR sem aquele módulo.
- Impedir bypass não autorizado e force push. Exigir conversa resolvida; em trabalho individual, configurar aprovação humana de acordo com os recursos de plano do GitHub, sem presumir que a própria aprovação satisfaça todas as regras.
- Não habilitar auto-merge nem autoaplicação de PRs de dependências.
- Desabilitar configurações de Dependabot que criem PRs automáticas se isso for a opção do mantenedor. `dependabot.yml` não deve ser reintroduzido por agentes.

**Importante:** só documentação e workflows versionados não substituem essa proteção administrativa. Se as Rulesets não estiverem ativas, a API ainda pode permitir merge direto na main.

## Preservação científica e segurança

- Event Store append-only e dados pessoais/segredos fora do Git.
- R experimental é observacional, sem alterar FSRS ou agendamento, salvo PR específica aprovada e validada.
- Usar fixtures sintéticas isoladas; nem logs nem artefatos do CI devem conter histórico pessoal.
- Revisar conflitos semanticamente em contratos, migrations, testes e métricas antes do merge.

## Auditoria periodica de branches esquecidas

O workflow `.github/workflows/branch-integration-audit.yml` roda semanalmente (e permite execucao manual). Ele consulta as branches e PRs de forma **somente-leitura**, publica tabela de candidatas no resumo do GitHub Actions e gera avisos para branches sem integracao comprovada pelo historico. Nao cria commits, Issues ou PRs por bot e nao faz merges. Historico divergente pode ser squash/cherry-pick; cada candidata requer revisao semantica, nunca merge automatico. O resultado e um mecanismo de detecao complementar ao PR obrigatorio, nao certificacao de que todo codigo historico chegou a main.

Uma PR marcada como merged nao dispensa a comparacao de ancestralidade: o detector compara os SHAs da main e das branches capturados no inventario. Branches com PR aberta ja estao rastreadas; entre as demais, commits nao ancestrais continuam candidatos mesmo se o HEAD corresponder a uma PR mesclada por squash/rebase. Um HEAD ancestral nao gera alerta, inclusive apos reversoes intencionais posteriores. A revisao semantica permanece necessaria para distinguir equivalencia, substituicao e perdas reais; o detector nao audita reversoes de codigo ancestral.
