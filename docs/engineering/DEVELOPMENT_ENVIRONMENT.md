# Ambiente e recuperação seletiva
Base: main 091ccb89a08e549af8ccf3424160345f6a1a1187 em 2026-10-29; PRs #41–#46 mescladas, verificadas via GitHub. Não partir do checkpoint de 2026-10-25 como estado atual.

## Inventário recuperado
| Ferramenta | Estado observado |
|---|---|
| Git/GitHub | referências remotas consultadas; checkout original com falhas de acesso; cópia isolada preserva alterações |
| Graphify | graphifyy 0.9.94 via uv tool, executável graphify; Apache-2.0; origem Graphify-Labs/graphify confirmada em METADATA |
| Obsidian FTS5 | script Python stdlib existente; testes UTF-8/Windows, busca e incremental; cofre pessoal detectado apenas, sem ler conteúdo |
| OpenSpec | openspec/ e seis skills presentes; CLI não identificada no PATH observado; não reinstalada |
| Skills | 15 pastas prévias; nenhuma apagada; duas adições mínimas; rotas em SKILLS.md |
| Java/Maven | JDK17 e Maven offline em cache; ArchUnit test-only já em cache |
| Python/Node | runtime local já fornecido; nenhum serviço/API pago novo |
| Gitleaks | ausente inicialmente; 8.30.1 em diretório descartável, checksum validado |
| CodeQL/Dependabot | configuração adicionada; dependem de execução/habilitação no GitHub |
| Semgrep/Trivy | não instalados por sobreposição/manutenção sem benefício demonstrado |

AGENTS.md é a entrada compartilhada. CONTEXT.md é solicitado por ele, não importado por mecanismo mágico. Regras .agents/rules são específicas do host; não pressupor leitura em todos os agentes.
Skills são metadados de descoberta quando o agente suporta o diretório; seus corpos e referências não devem ser lidos em massa.

## Interface local — Python 3.10+ e Git
Mesmos comandos no PowerShell e Linux (substituir python por python3 conforme instalação):
- `python scripts/context.py doctor`: disponibilidade compacta, sem mostrar caminho do vault nem credenciais.
- `python scripts/context.py locate ProspectivePredictionService --module backend`: índice atualizado ou busca em fontes versionados.
- `python scripts/context.py locate ID_COMPLETO --relations`: subgrafo Graphify limitado; IDs aparecem na primeira localização.
- `python scripts/context.py docs NOT_ESTABLISHED --path analytics-engine/docs/SCIENTIFIC_DECISION_EVALUATION_V1.md`: trecho rastreável.
- `python scripts/context.py decision "contexto evidências"`: FTS5 somente leitura; sem índice, documentação versionada.
- `python scripts/context.py status`: frescor sem escrever.
- `python scripts/context.py update`: atualização após tarefa estrutural concluída.
- `python scripts/context.py sync --vault docs/obsidian-sync --db graphify-out/repository-notes.db`: indexar explicitamente notas técnicas versionadas. Esse corpus NÃO é um vault pessoal substituto.
- `python scripts/context.py decision "Contexto" --db graphify-out/repository-notes.db`: consulta sem sync.
Vault real opcional: --vault ou FISCALSTUDY_OBSIDIAN_VAULT no obsidian_kb.py. Não distribuir caminho pessoal. Nunca escrever nas notas; índice fica fora do vault.
Sem shell, os adaptadores apontam para política e mapa de arquivos; declarar ausência de execução, sem bloquear edição de fontes acessíveis.
Nenhum MCP novo: CLI resolve o caso local, sem inflar catálogo de ferramentas. Host sem shell usa os arquivos; eventual MCP só após benefício medido.

## Graphify: limites e atualização
Inventário usa git ls-files, hashes SHA-256 e whitelist de fontes; sem percorrer bancos, dependências, builds, caches, dados, references ou vault. Copia somente arquivos alterados ao espelho ignorado graphify-out/source.
Sem alteração: não inicia Graphify. Fontes novas só entram após git add; arquivos excluídos/renomeados são removidos individualmente do espelho.
Com alteração: graphify update ESPELHO --no-cluster, sem LLM/label/export/wiki. O CLI recompõe o grafo do corpus permitido; cache AST é da ferramenta. Não alegar que o comando público aceita uma lista de arquivos incrementais.
Status registra updated/error/unavailable e log local ignorado. Falha não bloqueia o desenvolvimento; não marca o índice como atual.
Primeira extração: 420 arquivos, 5190 nós, 13524 relações; Java, TS/TSX e Python produziram nós. 34 arquivos R entraram no inventário, mas NÃO produziram nós: falta a dependência opcional tree-sitter-language-pack. Ela não foi instalada; busca textual e contratos são o fallback. QuestionViewer.tsx e AssistenteImportacaoWizard.tsx tiveram erros de parsing e extração parcial; frontend/src/main.tsx não produziu símbolos. Contagens finais dependem dos novos scripts. Relações são estáticas, não contratos HTTP/SQL nem prova de fluxo em runtime.
Consulta PT “Onde a previsão prospectiva é registrada?” teve resultados irrelevantes; nomes/IDs do código são a alternativa determinística. explain por nome teve ambiguidade; usar ID completo. Não aumentar orçamento para compensar busca ruim.
Não afirma precisão completa das linguagens. R/dynamic dispatch/reflexão/Spring/injeção/JDBC/chamadas entre processos exigem validação nos fontes e contratos. Não criar arestas sem evidência.

## Conhecimento e manutenção
Estado atual: índice executivo e Git. Arquitetura: docs/architecture e contratos canônicos. Ciência: analytics-engine/docs com versão, evidência e incerteza. Histórico: docs/history e checkpoint de 2026-10-25 marcado superado.
Mudança pequena não exige nota. Decisão/contrato/marco ou evidência científica: atualizar fonte canônica e referências. Só depois sincronizar corpus autorizado; não nota por commit.
Obsidian: sincronização explícita, SHA-256 detecta mesmo timestamp preservado, exclusões de privados/temporários/symlinks, remoções refletidas no índice, vínculo do DB à origem impede mistura acidental. Buscar abre SQLite mode=ro, sem criação/sync.
Não há detecção perfeita de segredo dentro de nota técnica autorizada: selecionar corpus e exclusões é indispensável. Cofre pessoal não foi lido/sincronizado; sua integração permanece pendente de escopo seguro.

## Verificação e eficiência
Comandos/testes/resultados em VALIDATION.md. Benchmark em context-benchmark.json, reproduzido por `python scripts/benchmark_context.py`.
Compara procedimento declarado (contexto antigo + arquivo inteiro) com protocolo + recuperação; não reproduz sessão de modelo passada. Mede bytes retornados, arquivos de contexto, consultas e I/O interno; estimativa bytes/4 é aproximação, não medição de API.
Nenhuma afirmação de benefício científico ou obediência universal é derivada desses testes.
