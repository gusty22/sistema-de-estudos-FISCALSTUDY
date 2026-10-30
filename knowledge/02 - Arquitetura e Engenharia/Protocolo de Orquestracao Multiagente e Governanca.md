# Protocolo de Orquestração Multiagente e Governança Técnica

> **Status:** Ativo
> **Data:** 25/10/2026
> **Atores:** Google Antigravity (Orquestrador, Frontend, UX & QA), OpenAI Codex (Backend Especializado, Persistência & Algoritmos), Engenheiro Humano (Aprovação e Autoridade Central).

---

## 1. Topologia de Responsabilidades

| Agente | Escopo Principal | Critério de Sucesso |
| :--- | :--- | :--- |
| **OpenAI Codex** | Backend Spring Boot, DDLs/Migrações SQLite, Motor Estatístico R, Scripts de Ingestão Python | Testes unitários de domínio e contratos de persistência passando (`BUILD SUCCESS`). |
| **Google Antigravity** | Frontend React/TypeScript, Design Tecnologia Calma, Modais & Acessibilidade, Integração e Reconciliação Git, Homologação E2E Visual, Documentação Duradoura no Obsidian | Homologação visual em navegador real, ausência de regressões e coerência arquitetural. |
| **Engenheiro Humano** | Revisão final de PRs, autorização de migração em dados reais e merge na branch `main` | Aprovação explícita antes de qualquer alteração destrutiva ou merge em produção. |

---

## 2. Regras de Ouro de Integração

1. **Nunca realizar Push Direto na `main`**:
   - Todo código passa por branch dedicada e Pull Request vinculado a uma Issue.
2. **Event Store Estritamente Append-Only**:
   - Nenhuma operação de UPDATE ou DELETE sobre a tabela `event_store` ou sobre eventos históricos de tentativas.
3. **Isolamento de Origem do Estudo (`origin_type`)**:
   - Apenas eventos com `origin_type = 'REAL_STUDY'` alimentam o modelo do estudante e o FSRS. Eventos com `origin_type = 'AUTOMATED_TEST'` ou `SYNTHETIC_FIXTURE` são sumariamente ignorados nas projeções de conhecimento pessoal.
4. **Respeito ao FSRS Canônico**:
   - Proibido inventar heurísticas ad-hoc de decaimento de memória que conflitem com o modelo FSRS oficial. A camada pedagógica externa atua na qualificação diagnóstica e seleção de intervenção, nunca distorcendo as variáveis da memória.
5. **Comunicação Baseada em Evidências**:
   - Uma tarefa só é declarada "Concluída" (`Done`) se houver teste automatizado executado com sucesso e evidência de conformidade registrada no PR.
