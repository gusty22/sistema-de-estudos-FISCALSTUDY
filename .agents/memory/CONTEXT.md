# FiscalStudy — índice executivo
Objetivo: estudo local com evidências rastreáveis, sem confundir acerto, retenção, domínio e transferência.

Referência verificada em 2026-10-29: main `6489a1f6455161aec4cb581aeae14b76e64c19a3`.
PRs #41–#47 mescladas: orquestração, avaliação prospectiva, autenticação, prontidão e cobertura de captura.
Confirme `git status --short`, `git log -3 --oneline` e referência remota antes de trabalhar.
A existência dos contratos não demonstra benefício pedagógico. Piloto pessoal não iniciado.

Mapa mínimo:
- Shadow Core Java → orquestrador R: `docs/architecture/CORE_LEARNING_SHADOW.md` (contrato/auditoria) e `CORE_LEARNING_SHADOW_VALIDATION.md` (gates). Desligado por padrão, sem efeitos no planejamento ou validação pessoal.
- Backend: `backend/src/main/java/com/fiscalstudy/backend` (application, domain, infrastructure).
- Interface: `frontend/src` (React/TypeScript).
- Pesquisa: `analytics-engine/R`, `analytics-engine/lab`; ler seu AGENTS.md.
- Ingestão: `ingestion/`; automação: `scripts/`.
- Contratos R: `analytics-engine/docs/INTEGRATION_CONTRACT_MATRIX.md`.
- Cadeia prospectiva: `analytics-engine/docs/AUTHENTIC_PROSPECTIVE_EVIDENCE_V1.md`.
- Prontidão: `analytics-engine/docs/PILOT_ACTIVATION_GATE_V1.md`.
- Arquitetura: `docs/architecture/`; especificações: `openspec/specs/`.
- Memória técnica e tarefas: `knowledge/` (Obsidian técnico; diário em `07 - Diário de Desenvolvimento/`).
- Procedimento e evidências de ferramentas: `docs/engineering/DEVELOPMENT_ENVIRONMENT.md`.
- Contexto antigo: `docs/history/AGENT_CONTEXT_2026-10-29.md` (somente sob demanda).

Restrições: event_store append-only; R não escreve no SQLite operacional.
Não acessar dados pessoais, provisionar chaves, alterar FSRS ou regras científicas nesta manutenção.
Políticas experimentais: `can_apply = false`, `can_schedule = false`.
Fixtures demonstram comportamento de software, nunca aprendizagem real.

Recuperação: identificar módulo → verificar tarefas ativas via `task list` → verificar índice →
Graphify com orçamento curto e Obsidian FTS5 (`knowledge/`) sob demanda → arquivos reais e testes.
Sem índice, usar `rg -n` em diretórios selecionados. Código e Git prevalecem.
Skills são carregadas por tarefa, conforme `docs/engineering/SKILLS.md`.
