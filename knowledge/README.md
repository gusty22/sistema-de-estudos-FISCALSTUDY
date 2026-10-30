# FiscalStudy — Cofre Técnico Obsidian (Knowledge Base)

Este diretório constitui o **Cofre Técnico Oficial** do FiscalStudy, versionado e integrado ao Git, ao Graphify e aos utilitários de contexto da plataforma.

---

## 1. Princípio da Fonte Única de Verdade (Single Source of Truth)

Para evitar documentações paralelas e divergências semânticas, a responsabilidade sobre cada camada do conhecimento está estritamente delimitada:

| Camada | Localização Canônica | Responsabilidade e Natureza |
| :--- | :--- | :--- |
| **Implementação e Histórico Verificável** | Git / GitHub (Commits, PRs) | Código real executável, histórico de alterações e tags de lançamento. |
| **Contratos e Decisões Arquiteturais** | `docs/architecture/` | Especificações canônicas, ADRs de engenharia e contratos de interfaces. |
| **Contratos Científicos e Psicometria** | `analytics-engine/docs/` | Modelos de retenção, contratos de evidência de aprendizagem e validações empíricas. |
| **Memória Navegável e Diário dos Agentes** | `knowledge/` (Obsidian Vault) | Explicações conceituais, tarefas, descobertas entre sessões e navegação por wikilinks. |
| **Índice Estrutural do Código (AST)** | `graphify-out/` (Local / Regenerável) | Grafo sintático de classes, métodos, rotas e dependências (fora do Git). |
| **Índice Textual Rápido (FTS5)** | `graphify-out/obsidian_fts.db` (Local) | Busca textual BM25 de alta velocidade com boosts e expansão morfológica. |

> [!NOTE]
> As notas no Obsidian não duplicam contratos integrais; elas contêm resumos conceituais, justificativas e links diretos para os arquivos canônicos do repositório.

---

## 2. Estrutura de Categorias do Cofre

O cofre técnico é composto pelas categorias fundacionais e pelas pastas de continuidade de agentes:

```
knowledge/
├── 00 - Painel/                      # Dashboards, fluxos principais e navegação inicial
├── 01 - Visão Geral/                 # Glossário do domínio e proposta de valor
├── 02 - Arquitetura e Engenharia/    # Visão sistêmica, Event Store, isolamento e mapa estrutural
├── 03 - Funcionalidades e Telas/     # Especificação funcional dos módulos (A a J) e Tecnologia Calma
├── 04 - Ciência da Aprendizagem/     # Ciclos cognitivos, modelos FSRS, recuperação ativa e psicometria
├── 05 - Planejamento e Roadmap/      # Catálogo de Epics, estado atual e problemas conhecidos
├── 06 - Referências e Fontes/        # Índice remissivo para a documentação técnica oficial
├── 07 - Diário de Desenvolvimento/   # Registro padronizado de tarefas e continuidade entre agentes
└── 08 - Decisões e Evidências/       # Mapeamento de decisões de arquitetura e evidências de testes
```

---

## 3. Diretrizes de Versionamento e Segurança

- **Somente Conhecimento Técnico**: Não versionar credenciais, chaves, bancos SQLite operacionais, exportações de dados ou dados pessoais.
- **Configurações Pessoais Fora do Git**: O diretório `knowledge/.obsidian/` está explicitamente ignorado no `.gitignore` para preservar layouts e plugins individuais sem poluir o repositório.
- **Sem Links Simbólicos ou Junctions**: Arquivos do cofre são versionados diretamente na árvore do Git, sem junctions que causem ambiguidade.
- **UTF-8 Universal**: Todas as notas são codificadas em UTF-8 com quebras de linha compatíveis com Windows e Unix.
