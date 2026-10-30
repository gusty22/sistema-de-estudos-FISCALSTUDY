# Decisões e Evidências — Memória Arquitetural e Empírica

Este diretório serve como ponte entre a memória navegável do Obsidian e os contratos canônicos definitivos do repositório.

---

## 1. Organização das Decisões e Evidências

- [[Mapeamento de Decisões Canônicas]]: Mapeamento estruturado das decisões arquiteturais (ADR-001 a ADR-011), seus invariantes, códigos de origem e vínculos canônicos em `docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md`.
- [[Evidências e Verificabilidade Científica]]: Critérios de rigor psicométrico, limites epistemológicos de modelos de retenção e vínculos com `analytics-engine/docs/`.

---

## 2. Invariantes Canônicos

1. **Prioridade do Código e Contratos**: Documentação antiga ou notas conceituais nunca prevalecem sobre código atual e contratos formais versionados.
2. **Rigor Científico**: Fixtures verificam software, não aprendizagem pessoal. Correlação não demonstra causalidade; acerto imediato não demonstra retenção a longo prazo.
3. **Imutabilidade Operacional**: O banco operacional SQLite nunca recebe escritas do motor estatístico R. O Event Store é estritamente append-only.
