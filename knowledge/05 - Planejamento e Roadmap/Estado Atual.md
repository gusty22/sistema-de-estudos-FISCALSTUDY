# Estado Atual — FiscalStudy

> **Data de Atualização:** 30/10/2026
> **Referência Canônica Verificada:** `main` commit `b590418` (após mesclagem de PRs #41 a #49)
> **Documentação de Referência:** `.agents/memory/CONTEXT.md` e `docs/engineering/BACKEND_INTEGRITY_AUDIT.md`

---

## 1. Resumo Executivo da Versão Corrente
A plataforma FiscalStudy consolidou uma série de melhorias focadas em integridade operacional, validação prospectiva e robustez do ambiente multi-camadas:

- **Integridade Operacional de Tentativas (PR #49):**
  - Correção no replay de submissões idempotentes (`AttemptSubmissionService`): envio de evidência conflitante com o mesmo `attemptId` agora retorna estritamente `HTTP 409 Conflict` em vez de sucesso falso (200).
  - Preservação estrita dos valores enviados e normalizações padronizadas sem recálculo indevido de campos do servidor (gabarito, previsão, timestamps) em retries.
  - Fixação do Maven Wrapper 3.9.9 com verificação de SHA-256 e SHA-512 oficiais do Maven Central.
- **Ambiente de Desenvolvimento & Governança (PR #48):**
  - Unificação de ferramentas de contexto e evidências de auditoria (`scripts/context.py`, `scripts/obsidian_kb.py`).
  - Atualização dos limites de segurança em `docs/engineering/DEVELOPMENT_ENVIRONMENT.md`.
  - Protocolo universal estrito de leitura cirúrgica e contexto mínimo suficiente.
- **Fluxo Prospectivo & Cobertura de Captura (PRs #41–#47):**
  - Cadeia de avaliação prospectiva validada (`AUTHENTIC_PROSPECTIVE_EVIDENCE_V1.md`).
  - Portão de ativação do piloto (`PILOT_ACTIVATION_GATE_V1.md`). Nota: Piloto pessoal ainda **não iniciado**; políticas adaptativas experimentais mantidas como `can_apply = false`, `can_schedule = false`.

---

## 2. Status dos Componentes e Camadas

| Camada / Componente | Status Atual | Detalhes de Verificação |
| :--- | :--- | :--- |
| **Backend (Spring Boot + SQLite)** | Estável e Auditado | Suítes críticas de integridade, idempotência e persistência de tentativas aprovadas; Event Store strictly append-only. |
| **Engine Psicométrica (R)** | Em Validação de Contrato | Scripts de pesquisa em `analytics-engine/R` com contratos em `INTEGRATION_CONTRACT_MATRIX.md`. Não grava diretamente no SQLite operacional. |
| **Frontend (React + Vite)** | Operacional | Conforme padrões de [[Tecnologia Calma]] e componentes de revisão e auditoria. |
| **Ingestão e Staging (Python)** | Isolamento Atômico | Ingestão isolada em `db/staging.db`; migrações independentes. |
| **Segundo Cérebro & Obsidian** | Sincronizado | Indexação híbrida FTS5 via SQLite (`graphify-out/obsidian_fts.db`) com busca vetorial/semântica local e custo zero de tokens. |

---

## 3. Diretrizes de Continuidade Técnica
1. **Regra de Ouro da Memória:** Manter `.agents/memory/CONTEXT.md` como única fonte de verdade concisa e atualizada para continuidade entre sessões.
2. **Event Store Append-Only:** Nenhuma operação de correção de respostas ou anotações pode efetuar `UPDATE` ou `DELETE` em eventos históricos já registrados.
3. **Validação de Evidências Reais:** Fixtures demonstram comportamento de software, nunca aprendizado cognitivo real de concurseiro.
