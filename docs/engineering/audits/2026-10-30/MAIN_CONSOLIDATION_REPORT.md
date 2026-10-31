# Consolidação da main — auditoria publicada, integração sob revisão

Snapshot histórico: main@789f9053f3e90a366a9f09542a0f7331b9d8348b. Main confirmada após merge manual de #76: e877e468fb4e77d143137cee3a6c97eb488ffb85. Nenhum agente executou merge/automerge ou push direto na main.

## Cobertura e resultado histórico

64 branches iniciais e 70 PRs históricas examinadas com paginação completa, incluindo todos os HEADs Git das PRs. Classificação das branches:53 INTEGRATED(inclui main),10 EQUIVALENT,1 REJECTED. Classificação dos HEADs históricos das PRs:61 INTEGRATED,4 EQUIVALENT,5 REJECTED. Foram registrados952 arquivos de PRs, árvores, merge-bases, commits, patches e checks.

Não foi identificada contribuição histórica válida ainda ausente que justificasse nova recuperação. Backend #61 foi efetivamente recuperado por #65; memória #28 por #31; evidência R #67 por #68. As propostas duplicadas/substituídas #66/#67 não foram reabertas. #70/#71 estão integradas e sua infraestrutura foi reutilizada.

Foram criadas quatro PRs nesta missão: três correções novas descobertas pela auditoria e uma PR documental. Isso é diferente de recuperar uma implementação histórica ainda ausente. Na atualização remota foram encontradas68 branches:64 iniciais+4 desta missão; cada nova branch é examinada no apêndice do inventário.

## Alterações efetivas propostas

| Unidade | PR | Alteração em relação à base | Estado confirmado |
|---|---|---|---|
| Detector histórico | #74 | Comparação por SHAs capturados; remove dispensa por merged; regressões | Draft,10 checks do HEAD b2a4a86 aprovados |
| Contexto dos agentes | #76 | Compacta AGENTS para4930 bytesLF/4968CRLF preservando contrato completo | MERGED pelo mantenedor em e877e46, confirmado GitHub |
| Fixtures R | #79 | Transporte UTF-8 binário e hash canônico em fixtures; produção intacta | Draft; R completo e 7/7 checks CI aprovados; limitação Python #80 |
| Inventário e evidências | #78 | Cinco relatórios pedidos, dados estruturados, DAG, patches e resultados | Esta PR, para revisão manual |

Os três trabalhos de implementação são independentes. O bloqueio de CI causado pelo tamanho do AGENTS foi removido com o merge humano de #76; #74 foi reconciliada sem force e seus checks repetidos. Nenhum modelo experimental foi promovido.

## Validação executada

| Área | Resultado | Limites |
|---|---|---|
| Backend completo |443 testes,0 falhas/erros/skips,81 suítes,BUILD SUCCESS,303s | Java17,Maven3.10.0,R4.5.1 obrigatório; configuração explícita de PATH/R_LIBS_USER/locale |
| Frontend |35 testes aprovados; TypeScript/Vite build aprovado | Sem Playwright/axe/homologação visual; warning existente de chunk591.73kB |
| Ingestão |9 testes aprovados,0 skips | Fixtures sintéticas; nenhum acervo real/OCR pessoal acessado |
| Motor R completo |1112 verificações aprovadas,0 falhas,194.043s | Depois das correções de fixtures da #79; software, não eficácia pedagógica |
| Auditor de branches |19 testes;2regressões reproduzidas antes da correção | Não detecta automaticamente reversões de código ancestral |
| Protocolo compacto |37 testes distintos aprovados;6/6protocolo repetidos independentemente | CI Linux/Windows aprovado; #76 integrada |
| Laboratório Python local |63 testes:38aprovados,5 falhas,20 skips opcionais |4falhas ACL/SeSecurityPrivilege;1crash nativo R0xC0000005 de causa desconhecida; Issue#80 |

A primeira execução backend foi443/7falhas/1erro/0 skips, causada por Rscript fora do PATH e warnings de locale. A repetição completa com ambiente correto passou sem alterar fontes/asertivas. A suíte R intermediária passou1080 e falhou1 por fixture de hash; o helper canônico resolveu o defeito após prova de igualdade dos12 hashes. Nenhuma suíte foi suprimida. As falhas locais Python não foram convertidas artificialmente em skips; persistem registradas.

[TEST_EVIDENCE.json](TEST_EVIDENCE.json), [BACKEND_LOG_HASHES.json](BACKEND_LOG_HASHES.json) e [SCIENTIFIC_LOG_HASHES.json](SCIENTIFIC_LOG_HASHES.json) registram comandos, contagens e hashes. Logs brutos ficam locais por conterem caminhos de máquina. Os módulos de produto entre789f905 e e877e46 são idênticos; somente AGENTS mudou.

## Bloqueios, exclusões e backlog

- [Issue#80](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/issues/80): validar ACL em runner apto e diagnosticar crash R com repro sintético mínimo; causa raiz não presumida. Sem afrouxar custódia ou promover ciência por um CI verde.
- Dependabot#51/#52/#55/#56/#57 foram fechadas pelo mantenedor; motivo técnico específico não documentado. Não reaplicar nem restaurar .github/dependabot.yml.
- TASK-2026-10-30-02 segue intenção ampla sem commit/PR histórico identificado. #79 cobre somente portabilidade de fixtures; não encerra toda confiabilidade do Motor R.
- Melhorias futuras do verificador de PR: existência da Issue e ciclos indiretos. São backlog, não recuperação histórica implementada.
- context doctor executado; grafo stale e índice Obsidian ausente na cópia. context update/task create falharam FileNotFoundError no ambiente OneDrive. Busca seletiva/Git e estes checkpoints versionados foram usados; vault original não foi escrito.

## Aprovação pendente

A main não está declarada totalmente consolidada enquanto #74/#79/#78 aguardarem revisão e persistir a limitação local #80. Rever os diffs e o CI no HEAD atual, reconciliar qualquer avanço humano da main sem force e integrar manualmente. Sem dados reais, segredos, mudança de FSRS ou escrita R no SQLite operacional.
