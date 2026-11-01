# FiscalStudy — índice executivo
Objetivo: estudo local com evidências rastreáveis, sem confundir acerto, retenção, domínio e transferência.

Snapshot histórico (2026-11-01): main `4cc67f3` (PRs #93,#95,#97,#98 `MERGED`; Issues #92,#94,#96 `CLOSED`; FS-01 homologada; FS-02 na PR #100 / Issue #99, 100/100 testes PASS; Issue #87 `IN_PROGRESS` Codex; Issue #80 `BLOCKED`).
Sempre consulte `git status --short`, `origin/main` e Issues/PRs atuais no GitHub para verificar a fila ou editar.
A existência dos contratos não demonstra benefício pedagógico. Piloto pessoal não iniciado.

Organização multiagente (`.agents/agents/`, descoberta nativa na raiz do repositório):
- Coordenador: `cto-fiscalstudy` (modos `ANALYSIS`, `PLANNING`, `APPROVED_EXECUTION`; ondas <=2 subagentes sob demanda).
- Especialistas: `backend-java-specialist`, `r-engine-specialist`, `scientific-director`, `quality-supervisor`, `adversarial-auditor`, `github-integration-specialist`.
- Coordenação Antigravity + Codex: responsabilidade e `Depends-on` verificados via GitHub Issues/PRs e `scripts/context.py task list` (Issue #87 reservada ao Codex). Não edite escopo da outra plataforma; merge na `main` é exclusivo de `gusty22`.

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
