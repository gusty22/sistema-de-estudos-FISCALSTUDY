# Consolidação da main — resultado em revisão

Estado original auditado: main@789f9053f3e90a366a9f09542a0f7331b9d8348b. Nenhuma alteração direta ou merge na main por esta missão. As contribuições históricas válidas examinadas já estão incorporadas ou possuem equivalência demonstrada; main ainda não é declarada totalmente consolidada, pois há correções obrigatórias em revisão e validações em andamento.

## Já integrado

64 branches iniciais: 53 INTEGRATED,10 EQUIVALENT,1 REJECTED. 70 PRs históricas inventariadas por API paginada e HEADs Git. Suíte backend #61 efetivamente recuperada por #65; memória #28 por #31; evidência R #67 por #68. Governança #70 e definições de agentes #71 presentes. Nenhuma reaplicação histórica justificada até este checkpoint.

## Preparado para revisão

#74 corrige triagem por metadados merged e congela comparações em SHAs. #76 restaura o limite de contexto requerido pelo próprio projeto, preservando contrato canônico. Relatórios desta branch são uma unidade documental separada. FSRS, armazenamento append-only, custódia/origem dos dados e autoridade observacional do R permanecem intactos.

## Testes e limitações verificadas

- Governança auditor:19 testes aprovados; duas regressões reproduzidas antes do ajuste.
- Protocolo compacto:37 testes distintos aprovados; protocolo6/6 repetido pelo orquestrador; CI Linux/Windows aprovados.
- Ingestão:9 testes aprovados.
- Backend/frontend/R/laboratório: validação em andamento; resultados finais serão registrados antes da entrega final. Tentativas no OneDrive encontraram criação de arquivos bloqueada; falhas não são suprimidas nem atribuídas a código sem reprodução em ambiente apto.
- context.py doctor: Python/FTS5 disponíveis; grafo stale e índice Obsidian ausente na cópia. context update/task create retornaram unavailable/FileNotFoundError. Busca textual/Git e checkpoint versionado usados como fallback. Vault original não foi lido ou escrito.

## Não promover / não restaurar

Dependabot #51/#52/#55/#56/#57: fechadas pelo mantenedor; motivo técnico não documentado. Não restaurar .github/dependabot.yml. Experimentos integrados continuam observacionais; não há evidência nova que autorize can_apply ou can_schedule.

## Backlog distinto de recuperação

TASK-2026-10-30-02 ainda IN_PROGRESS e sem commit/PR registrado; branch remota excluída. Isso é pendência de execução/evidência, não prova de contribuição perdida. Robustez futura: CI de contrato valida formato de Issue e dependência direta, não existência da Issue nem ciclos indiretos; registrar para evolução sem inventar implementação. Piloto pessoal, eficácia pedagógica, calibração individual e homologação operacional não foram demonstrados por esta auditoria.

## Condições para aprovação

Revisar diffs das PRs, priorizar #76 para remover bloqueio herdado, repetir checks nas bases atualizadas e concluir revisão manual. Manter qualquer falha científica/ambiental explicitamente pendente. Nunca marcar MERGED sem confirmação GitHub. Ver inventário e DAG associados.
