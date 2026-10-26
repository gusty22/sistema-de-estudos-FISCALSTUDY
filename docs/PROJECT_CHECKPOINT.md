# FiscalStudy — checkpoint de retomada

Atualizado em 25/10/2026. Índice de evidências; não substitui testes nem encerra F01–F36.

## Onde paramos

As entregas anteriores foram separadas por área. A reconsulta GitHub confirmou os PRs #8–#12 fechados e integrados por outra frente em 25/10/2026; #13/#14 estão abertos como draft. Na retomada de 25/10/2026, a consulta remota encontrou `main` em `fdd450c839c06e05379844b9a8f12edb2b438a5f` (`merge(wave-1)`), avançada por outra frente. Esta equipe não executou esse merge. Revalidar ancestralidade e conteúdo antes de integrar novas branches; não presumir quais achados foram resolvidos apenas pela mensagem do commit.

| Área | Branch e PR | Evidência da rodada |
| --- | --- | --- |
| Proveniência R | `fix/analytics-learning-evidence`, [#8](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/8) — integrado | Perfil pessoal exige REAL_STUDY explícito; 336 verificações R aprovadas. |
| Justificativas pedagógicas | `fix/backend-pedagogical-reasons`, [#9](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/9) — integrado | Relato não é diagnóstico; 17 testes direcionados aprovados. |
| Anotações | `fix/backend-annotation-order`, [#10](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/10) — integrado | Ordem por Instant, nanos e rowid; 11 testes aprovados. |
| Resultado não avaliável | `fix/backend-ungraded-revisions`, [#11](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/11) — integrado | Resultado nulo não cria revisão; 19 testes direcionados aprovados. |
| Documentação | `docs/production-round-20261025`, [#12](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/12) — integrado | Plano, testes e correspondências de commits locais/remotos. |
| Planejamento RobinHood | `fix/planning-contest-scope`, [#13](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/13) | Concurso vazio não usa outro edital; consulta de ciclos parametrizada. |
| Planejamento Maestro | `fix/maestro-contest-scope`, [#14](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/14) | Tópicos, revisões, materiais e pendências Anki respeitam concurso; estados vazios explícitos. |

Integração isolada: suplemento de **25 testes aprovado**, sobreposto às baterias direcionadas. Suíte completa: **280 testes, uma falha, zero erros/ignorados**; não aprovada integralmente. R `digest(file=TRUE)` rejeita o acesso ao CSV neste ambiente; base e versão nova reproduzem a falha, embora o SHA-256 dos bytes lidos coincida com o manifesto. Verificação não foi relaxada. Sem homologação visual ou eficácia pedagógica comprovada.

Planejamento: `test-compile` e **30 testes aprovados**, zero falhas/erros/ignorados, em cópia isolada com foundation externa. Os 13 testes anteriores do RobinHood se sobrepõem. Log `planning-combined-tests.log`, resumo `planning-combined-summary.json` e cinco hashes antes/depois conferidos. PRs #13/#14 são draft direcionados à main; branches partem do parent remoto `e5320d05`, equivalente à base local `13509e6`, sem rebase. Essa bateria não valida todas as mudanças atuais da main nem substitui a suíte completa ou a homologação visual.

## Próximas etapas e pendências

1. **Planejamento:** validar o orçamento de tempo e a origem das métricas usadas na priorização. O isolamento por concurso foi corrigido e publicado nos PRs #13/#14, mas defaults de materiais/páginas e métricas legadas permanecem; não considerar todo o plano livre de dados presumidos.
2. **Ciclo de aprendizagem:** revisar elegibilidade das tentativas em cada consumidor e distinguir acerto imediato de retenção. Correções anteriores não comprovam todos os consumidores.
3. **Conteúdo:** curadoria questão–tópico, identidade/proveniência e fontes recuperáveis. Preservar itens não classificados; cobertura cadastrada não comprova cobertura validada.
4. **Validação:** resolver o impedimento ambiental da suíte completa e homologar interface/sessões em ambiente controlado. Build não substitui ponta a ponta.
5. **Modelos e produto:** avaliar retenção tardia e transferência em questões inéditas, calibrar com dados suficientes e reduzir administração manual. Personalização e eficácia ainda precisam de evidência.

## Três responsabilidades

- **Memória:** FSRS oficial/versionado estima recuperação do item e agenda revisão; não mede compreensão ou causa do erro.
- **Pedagogia:** evidências, relatos e hipóteses orientam investigações/intervenções. Erro inesperado não identifica automaticamente a causa.
- **Planejamento:** tempo disponível, edital e evidências definem prioridades explicáveis. Não fabricar desempenho ou itens para preencher estado vazio.

## Retomada com leitura mínima

| Necessidade | Consultar primeiro | Confirmar depois |
| --- | --- | --- |
| Próxima tarefa e F01–F36 | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), seção da área/última rodada | Branch, commit, diff e critérios. |
| Validação | [VALIDATION_REPORT.md](VALIDATION_REPORT.md) | Logs/XML e hashes das fontes testadas. |
| Contratos e decisões | [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md) | Implementação e consumidores na branch correta. |
| Localizar código | [Especificações por módulo](architecture/modules/MODULOS_ESPECIFICACOES.md), Obsidian e Graphify direcionados | Símbolos, caminhos e chamadores atuais. |

O Obsidian `Roadmap Geral` ainda declara v3.23 estável e módulos completos: não representa esta rodada. `PROJECT_CONTEXT.md` e `.agents/memory/CONTEXT.md` contêm afirmações históricas; usar como navegação, não prova atual. O grafo pode representar outro commit; conferir procedência. A bridge retorna vazio também após falha de ferramenta; vazio não comprova ausência de função.

Não sincronizar/reindexar vault ou junction sem conferir destino e permissão. `obsidian_kb.py` abre/cria SQLite mesmo no caminho de consulta; não apontar uma investigação somente leitura ao índice original como destino gravável. Preservar originais/snapshots/referências; testar em cópias isoladas, integrações externas desligadas. A [nota importável](obsidian-sync/Estado-Atual.md) foi preparada para atualização manual; o vault original não foi alterado.
