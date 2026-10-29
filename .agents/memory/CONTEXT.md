# FiscalStudy — índice executivo
Objetivo: estudo local com evidências rastreáveis, sem confundir acerto, retenção, domínio e transferência.

Referência verificada em 2026-10-29: main `091ccb89a08e549af8ccf3424160345f6a1a1187`.
PRs #41–#46 mescladas: orquestração, avaliação prospectiva, autenticação e prontidão.
Confirme `git status --short`, `git log -3 --oneline` e referência remota antes de trabalhar.
A existência dos contratos não demonstra benefício pedagógico. Piloto pessoal não iniciado.

Mapa mínimo:
- Backend: `backend/src/main/java/com/fiscalstudy/backend` (application, domain, infrastructure).
- Interface: `frontend/src` (React/TypeScript).
- Pesquisa: `analytics-engine/R`, `analytics-engine/lab`; ler seu AGENTS.md.
- Ingestão: `ingestion/`; automação: `scripts/`.
- Contratos R: `analytics-engine/docs/INTEGRATION_CONTRACT_MATRIX.md`.
- Cadeia prospectiva: `analytics-engine/docs/AUTHENTIC_PROSPECTIVE_EVIDENCE_V1.md`.
- Prontidão: `analytics-engine/docs/PILOT_ACTIVATION_GATE_V1.md`.
- Arquitetura: `docs/architecture/`; especificações: `openspec/specs/`.
- Procedimento e evidências de ferramentas: `docs/engineering/DEVELOPMENT_ENVIRONMENT.md`.
- Contexto antigo: `docs/history/AGENT_CONTEXT_2026-10-29.md` (somente sob demanda).

Restrições: event_store append-only; R não escreve no SQLite operacional.
Não acessar dados pessoais, provisionar chaves, alterar FSRS ou regras científicas nesta manutenção.
Políticas experimentais: `can_apply = false`, `can_schedule = false`.
Fixtures demonstram comportamento de software, nunca aprendizagem real.

Recuperação: identificar módulo → verificar índice com `python scripts/context_index.py` →
se atualizado, Graphify com orçamento curto e caminho indicado pelo helper →
decisões históricas via Obsidian somente se necessário → arquivos reais e testes pertinentes.
Sem índice, usar `rg -n` em diretórios selecionados. Código e Git prevalecem.
Skills são carregadas por tarefa, conforme `docs/engineering/SKILLS.md`.
