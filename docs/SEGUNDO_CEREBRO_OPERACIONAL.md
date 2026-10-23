# Guia Operacional — Segundo Cérebro Técnico (FiscalStudy)

O Segundo Cérebro Técnico é uma arquitetura local-first de conhecimento persistente integrada ao Google Antigravity, Graphify e Obsidian. Seu objetivo é recuperar conhecimento com alta precisão e custo zero de API, economizando tokens e preservando decisões técnicas entre sessões.

---

## 1. Como Funciona a Arquitetura

1. **Grafo Estrutural (Graphify)**: Mapeia o código-fonte (AST via Tree-sitter) em `graphify-out/graph.json` (22.759 nós, 58.001 arestas). Permite localizar classes, funções, rotas e dependências sem ler arquivos inteiros.
2. **Cofre Semântico (Obsidian)**: Armazena em `..\obsidian\FiscalStudy-Obsidian` as decisões de engenharia, modelos cognitivos e regras pedagógicas.
3. **Busca Híbrida Local (FTS5 + BM25 + Boosts)**: O script `scripts/obsidian_kb.py` indexa incrementalmente as notas Markdown em `graphify-out/obsidian_fts.db`, ponderando títulos, aliases, seções e wikilinks.
4. **Ponte Cognitiva Unificada**: `scripts/second_brain_bridge.py` cruza um conceito (ex: "Robin Hood", "Event Store") simultaneamente com o Obsidian e o Graphify.
5. **Auditoria Real de Tokens**: `scripts/measure_tokens.py` inspeciona o log oficial `transcript.jsonl` da sessão ativa, segregando novos inputs e cache sem duplicações.

---

## 2. Protocolo de Decisão do Agente (Quando Usar Cada Ferramenta)

| Situação da Tarefa | Ferramenta Recomendada | Comando Operacional |
| :--- | :--- | :--- |
| **Dúvidas conceituais, decisões arquiteturais ou modelos pedagógicos** | Obsidian KB | `uv run python scripts/obsidian_kb.py --query "<pergunta>"` |
| **Localização de símbolos, classes, métodos ou callers no código** | Graphify CLI | `uv run graphify query "<termo>"` ou `uv run graphify explain "<nó>"` |
| **Investigação integrada (conceito de negócio $\leftrightarrow$ implementação)** | Ponte Cognitiva | `uv run python scripts/second_brain_bridge.py "<conceito>"` |
| **Tarefas simples (typos, css pontual, renomeação local)** | Nenhuma ferramenta externa | Edição direta do arquivo específico |
| **Continuidade entre sessões** | Memória Persistente | Leitura obrigatória de `.agents/memory/CONTEXT.md` |

---

## 3. Reconstrução e Manutenção dos Índices

### Obsidian KB (FTS5)
O índice é atualizado incrementalmente de forma automática em menos de 0,2s a cada busca. Se precisar forçar uma reconstrução limpa:
```bash
# Apagar banco local e forçar reindexação completa
rm graphify-out/obsidian_fts.db
uv run python scripts/obsidian_kb.py --sync
```

### Graphify (Grafo AST)
Para atualizar o grafo após modificações relevantes em arquivos de código (`backend/`, `frontend/`, `ingestion/`):
```bash
# Atualização incremental de AST (rápida, local, sem LLM)
uv run graphify update .
```

---

## 4. Testes e Validação Contínua

Para validar a integridade dos 3 scripts e o ranking de relevância:
```bash
uv run python scripts/test_second_brain.py
```
*(Executa 10 testes cobrindo ranking, busca conceitual, aliases em inglês, singular/plural, persistência, resiliência a símbolos inexistentes e ausência de banco/vault).*

---

## 5. Auditoria de Consumo de Tokens

Para auditar o consumo real auditado da sessão ativa:
```bash
uv run python scripts/measure_tokens.py
```
*Gera relatório segregando tokens novos de entrada, tokens lidos do cache de contexto e taxa real de cache hit.*

---

## 6. Como Desativar a Integração (Se Necessário)

Se em algum ambiente for necessário desativar a consulta automática do grafo e da base semântica:
1. No arquivo `.agents/rules/graphify.md`, altere `trigger: model_decision` para `trigger: manual` ou remova a regra.
2. Em `AGENTS.md`, comente as chamadas do Passo 2 e 3 do Protocolo de Inicialização.
3. Os diretórios `graphify-out/` e os arquivos `.py` em `scripts/` não interferem no build do Java nem do React.
