# FiscalStudy — índice executivo
Objetivo: estudo local com evidências rastreáveis, sem confundir acerto, retenção, domínio e transferência.

Snapshot histórico (2026-10-31): main `5eae86b06dc88a9e8a50d04817ce578b6fca287f` (PRs #41–#47, #59–#65, #68, #70–#71, #74, #76, #78–#79, #82, #84, #86 integradas).
Sempre confirme `git status --short`, `git log -3 --oneline`, `origin/main` e Issues/PRs abertas no GitHub antes de editar.
A existência dos contratos não demonstra benefício pedagógico. Piloto pessoal não iniciado.

Organização multiagente (`.agents/agents/`, descoberta nativa na raiz do repositório):
- Coordenador principal selecionável: `cto-fiscalstudy` (orquestra ondas de até 2 subagentes sob demanda, sem iniciar sessões ociosas).
- Especialistas persistentes: `backend-java-specialist`, `r-engine-specialist`, `scientific-director`, `quality-supervisor`, `adversarial-auditor`, `github-integration-specialist`.
- Coordenação Antigravity + Codex: responsabilidade por tarefa e dependências (`Depends-on`) são estado dinâmico verificado via GitHub Issues/PRs e `scripts/context.py task list` (ex.: no snapshot atual, a Issue #87 pertence à Frente B / Codex). Não edite escopo atribuído à outra plataforma sem autorização do proprietário; merge na `main` é exclusivo de `gusty22`.

Mapa mínimo:
- Shadow Core Java → R: `docs/architecture/CORE_LEARNING_SHADOW.md`, `CORE_LEARNING_SHADOW_VALIDATION.md` e `PEDAGOGICAL_INVENTORY_CONTRACT.md`. Desligado por padrão.
- Backend: `backend/src/main/java/com/fiscalstudy/backend` (application, domain, infrastructure).
- Interface: `frontend/src` (React/TypeScript).
- Pesquisa: `analytics-engine/R`, `analytics-engine/lab`; ler seu `AGENTS.md`.
- Contratos R e piloto: `analytics-engine/docs/INTEGRATION_CONTRACT_MATRIX.md`, `AUTHENTIC_PROSPECTIVE_EVIDENCE_V1.md`, `PILOT_ACTIVATION_GATE_V1.md`.
- Arquitetura/specs: `docs/architecture/`, `openspec/specs/`. Memória/tarefas: `knowledge/`.
- Governança e compatibilidade: `docs/engineering/AGENT_PR_WORKFLOW.md`, `AGENT_COMPATIBILITY.md`, `DEVELOPMENT_ENVIRONMENT.md`.

Restrições: `event_store` append-only; R não escreve no SQLite operacional; FSRS é autoridade exclusiva de agendamento de item.
Políticas experimentais: `can_apply = false`, `can_schedule = false`. Fixtures validam software, nunca aprendizagem real.
Recuperação enxuta: módulo → `task list` / GitHub Issues → índice/grafo/FTS5 sob demanda → leitura pontual (`StartLine`/`EndLine`). Código e Git prevalecem.
