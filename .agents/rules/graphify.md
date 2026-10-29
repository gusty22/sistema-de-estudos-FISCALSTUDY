---
trigger: model_decision
description: Localização estrutural com índice atualizado e fallback seletivo.
---
Execute `python scripts/context_index.py`. Se fresh, use o graph retornado:
`graphify query "ProspectivePredictionService" --budget 600 --graph graphify-out/source/graphify-out/graph.json`.
Confirme símbolos e relações nos arquivos reais. Não deduza contratos HTTP, SQL ou autoridade científica por arestas.
Sem grafo atualizado, use rg seletivo. Após uma tarefa com mudança estrutural:
`python scripts/context_index.py --update`. Não usar watch nem hooks por salvamento.
Artefatos permanecem ignorados. Não executar update na raiz com bancos/dados pessoais.
