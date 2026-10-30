# PRs publicadas e estado de revisão

Issue principal [#72](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/issues/72). Foram publicadas quatro PRs; nenhuma contribuição histórica foi reaplicada sem necessidade. As três correções são defeitos novos descobertos pela auditoria. Nenhum agente executou merge/automerge na main; #76 foi mesclada pelo mantenedor e confirmada na API.

| PR | Issue | Escopo e proveniência | Testes executados | Estado |
|---|---|---|---|---|
| [#74](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/74) | #73 | Auditor da #70/8976660: remover dispensa por merged, congelar SHAs | 19 testes, duas regressões red/green; após reconciliação 6 protocolo+19 scripts | Draft, todos os 10 checks aprovados no HEAD b2a4a86 |
| [#76](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/76) | #75 | Restaurar limite de contexto sem perder contrato canônico | 37 testes distintos; CI Linux/Windows aprovado | MERGED pelo mantenedor em e877e46,20:53:17Z de30/10/2026 |
| [#79](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/79) | #77 | Fixtures UTF-8 e hash canônico; somente testes/documentação | R completo1112/0; equivalência dos12 hashes; Python local63 testes/5 falhas/20 skips | Draft; 7/7 checks CI aprovados no HEAD e4ef48d; bloqueio local [#80](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/issues/80) |
| [#78](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/78) | #72 | Cinco relatórios obrigatórios e evidências estruturadas | Git/API/patches/blobs, resultados por módulo, consistência dos artefatos e diffcheck | Esta PR; HEAD final e CI consultáveis na própria PR |

## Bases, commits e dependências

Todas usam main como base e são independentes por código. Main histórica789f905; atuale877e46. #74: d6fb57925e4d7cd96788c4770a6d9aa14ca362b5 e reconciliação b2a4a864e7298b6a79520098e46d8014cb9afbbc. #76: c1688b4e1dc15a91c05aaca39c035f01802fcfe5, merge e877e468fb4e77d143137cee3a6c97eb488ffb85. #79:477bf441097b2c76c40be86eb043967bd60cb958 e e4ef48d89a02c1357e935a5ea55999b806cb2f37. Nenhum force-push. O bloqueio comum anterior do protocolo foi removido pela #76; não permanece uma dependência de implementação aberta.

#78 foi reconciliada com a main depois do merge humano de #76. Seu primeiro check de contrato falhou pela base antiga; o HEAD atualizado corrige a ancestralidade e deve ser avaliado por seu próprio CI. Resultados de checkpoints anteriores não são atribuídos ao HEAD final sem observar a API. Não há conflitos de conteúdo conhecidos entre as unidades, mas novos avanços da main exigem nova conferência.

## Aprovação e bloqueios

Revisar as alterações e os checks no HEAD atual. #79 tem R completo aprovado e validação local Python explicitamente bloqueada: quatro restrições de ACL e um crash nativo R de causa não estabelecida;20 skips refletem dependências opcionais ausentes. A Issue80 define o diagnóstico/runner necessário sem enfraquecer custódia. Não declarar certificação científica ou consolidação operacional por testes sintéticos.

Conta conectada confirmada gusty22. gh não está disponível; git push e conector GitHub foram usados como fallback explícito, preservando conta, Issue, draft e revisão manual. Isso não demonstra execução do script agent_pr contra o serviço real. Rulesets retornou []; metadados indicaram protected=false; proteção detalhada retornou403. Configuração administrativa permanece ação do mantenedor.

Recuperações anteriores confirmadas: #31,#65,#68 já integradas; #66/#67 continuam fechadas por duplicidade/substituição. Não reabrir. Os relatórios finais e evidências estão nesta mesma PR, e logs brutos permanecem locais para não publicar caminhos de máquina.
