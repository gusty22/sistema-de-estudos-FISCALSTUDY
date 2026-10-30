# Mapeamento de Decisões Canônicas e Contratos de Arquitetura

Esta nota mapeia os Registros de Decisões Arquiteturais (ADRs) consolidados do FiscalStudy, com ponte direta para a fonte canônica em `docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md`.

---

## Tabela de Decisões Canônicas

| ADR | Título / Decisão | Justificativa Técnica | Invariante Central | Contrato Canônico / Código de Origem |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Event Store Append-Only | Auditabilidade e reprodução de estado | Proibido `UPDATE` ou `DELETE` na tabela de eventos | `backend/src/main/java/com/fiscalstudy/backend/domain/EventStore.java` |
| **ADR-002** | Isolamento Staging vs Produção | Integridade de dados de bancas e questões | Quarentena estrita antes de ingestão no catálogo | `docs/ARQUITETURA_INGESTAO_DOCUMENTAL.md` |
| **ADR-003** | Motor R Isolado (Analytics) | Separação de cálculo estatístico complexo | Motor R nunca escreve no banco SQLite operacional | `docs/ANALYTICS_R_INTEGRATION.md` |
| **ADR-004** | Bloqueio Prévio de Gabaritos | Eliminação da "falsa fluência" do estudante | Resposta e confiança registradas antes de exibir solução | `backend/src/main/java/com/fiscalstudy/backend/application/StudySessionService.java` |
| **ADR-005** | Tecnologia Calma & Design Tokens | Redução de fadiga cognitiva em sessões longas | Paleta restrita (Paper `#f9f8f6`, Night `#0e0f11`), sem alertas gritantes | `frontend/src/index.css` |
| **ADR-006** | Identidade Estável de Questões | Migração segura sem colisão de hashes | Identificador canônico baseado em banca/ano/órgão | `docs/QUESTION_IDENTITY_MIGRATION_PROPOSAL.md` |
| **ADR-007** | FSRS 4.5 e Calibração Local | Otimização científica de repetição espaçada | Parâmetros calibrados localmente; fallback resiliente | `analytics-engine/R/retention_analysis.R` |
| **ADR-008** | Projeções Materializadas Derivadas | Performance de leitura no frontend | Projeções podem ser reconstruídas via replay dos eventos | `backend/src/main/java/com/fiscalstudy/backend/domain/projection/` |
| **ADR-009** | Governança de Memória dos Agentes | Continuidade entre sessões e custo mínimo | Índices locais (FTS5 + Graphify), sem leitura exaustiva do repositório | `.agents/memory/CONTEXT.md`, `AGENTS.md` |
| **ADR-010** | Cofre Técnico Versionado (`knowledge/`) | Conhecimento persistente e rastreável | Vault Obsidian versionado no Git; `.obsidian/` ignorado | `knowledge/README.md` |
| **ADR-011** | Registro Padronizado de Atividades | Rastreabilidade verificável do ciclo de vida | Invariantes: sem VALIDATED sem teste; sem MERGED sem GitHub | `knowledge/07 - Diário de Desenvolvimento/README.md` |

---

## Vínculos Relacionados
- [[Event Store Imutável]]
- [[Isolamento Staging]]
- [[Psicometria e Modelo R]]
- [[Ciclo em 4 Estágios]]
- [[Tecnologia Calma]]
