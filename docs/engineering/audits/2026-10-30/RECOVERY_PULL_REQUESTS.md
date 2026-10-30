# PRs desta auditoria

Issue principal [#72](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/issues/72). Nenhum merge foi executado. Não houve recuperação histórica adicional porque os candidatos têm equivalência demonstrada; as PRs abaixo corrigem defeitos descobertos durante a auditoria.

| PR | Issue | Escopo / origem | Validação | Situação |
|---|---|---|---|---|
| [#74](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/74) | #73 | Auditor PR #70/8976660: remover dispensa por merged, comparar SHAs | 19 testes; duas regressões reproduzidas; diff limpo | Draft; contrato/segredos/CodeQL aprovados; context-tools herdado bloqueado pelo protocolo corrigido em #76 |
| [#76](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/76) | #75 | Compactar AGENTS sem perder regras nem aumentar limite | 37 testes distintos; red/green; 4930 bytes LF / 4968 CRLF | Draft; contrato, segurança e context-tools Linux/Windows aprovados |
| PR documental desta branch | #72 | Inventário completo, evidências, DAG e consolidação | Comparações Git/API; validação dos artefatos pendente no checkpoint inicial | Publicação/atualização nesta mesma branch |

Bases: main@789f905. HEAD #74 d6fb57925e4d7cd96788c4770a6d9aa14ca362b5; #76 c1688b4e1dc15a91c05aaca39c035f01802fcfe5. Sem conflitos de conteúdo conhecidos entre as duas. São unidades independentes, com bloqueio comum de CI herdado até aprovação de #76. Não adicionar seu commit às outras PRs por cópia duplicada.

## Publicação e revisão

Conta conectada confirmada como gusty22. gh não disponível; git push e conector GitHub foram usados como fallback explícito, preservando conta, Issue, draft, base e aprovação manual. Isso não constitui teste do script agent_pr contra serviço real. Repetir/reconciliar checks após merge manual de #76; manter draft qualquer PR com falha/bloqueio. Proteção: API rulesets retornou []; branches indicou protected=false; inspeção administrativa detalhada retornou403. Habilitação de regras permanece ação do mantenedor, sem inferir acesso administrativo.

Recuperações anteriores confirmadas: #31, #65 e #68 já integradas; #66/#67 permanecem fechadas por duplicidade/substituição. Não reabrir nem criar cópias.
