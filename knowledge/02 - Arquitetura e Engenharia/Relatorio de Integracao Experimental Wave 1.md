# Relatório de Integração Experimental — Wave 1

> **Data:** 25/10/2026
> **Branch de Integração:** `integration/wave-1`
> **Ambiente:** Worktree isolada em `target/worktrees/integration-wave-1`
> **Base Canônica:** `c26ee20` (`main` / `origin/main`)
> **Topo da Integração:** `0dab1c9`

---

## 1. Topologia de Merges e SHAs Integrados

A integração experimental foi executada em sequência estrita de dependências arquiteturais, com validação de build e testes a cada etapa:

```mermaid
gitgraph
    commit id: "c26ee20 (main)"
    commit id: "a6e2fec (feature/database-contracts)"
    commit id: "2b1df2b (feature/learning-backend)"
    commit id: "f99b212 (PR #10: backend-annotation-order)"
    commit id: "c771fec (PR #9: backend-pedagogical-reasons)"
    commit id: "0bd4740 (PR #11: backend-ungraded-revisions)"
    commit id: "810adc0 (PR #8: analytics-learning-evidence)"
    commit id: "0dab1c9 (fix/frontend-accessibility-flows)"
```

| Ordem | Ramo / PR Integrado | SHA de Origem | SHA do Merge | Status dos Testes |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `origin/feature/database-contracts` | `c4bccac` | `a6e2fec` | `DatabaseFoundationTest`: 5 testes aprovados |
| **2** | `origin/feature/learning-backend` | `fbca00b` | `2b1df2b` | `PersistenceContractTest`, `AttemptIdentityRegressionTest`, `FsrsReferenceConformanceTest`: 22 testes aprovados |
| **3** | `origin/fix/backend-annotation-order` (PR #10) | `d180e6c` | `f99b212` | `AnnotationOrderingRegressionTest`, `ErrorTaxonomyRegressionTest` aprovados |
| **4** | `origin/fix/backend-pedagogical-reasons` (PR #9) | `959bfd3` | `c771fec` | `PedagogicalReasonRegressionTest` aprovado |
| **5** | `origin/fix/backend-ungraded-revisions` (PR #11) | `e5320d0` | `0bd4740` | `UngradedRevisionRegressionTest` aprovado |
| **6** | `origin/fix/analytics-learning-evidence` (PR #8) | `0398e52` | `810adc0` | Merge limpo sem conflitos; 336 verificações R |
| **7** | `fix/frontend-accessibility-flows` | `f144626` | `0dab1c9` | Frontend build (`tsc -b && vite build`) e 12 testes node unitários aprovados |

---

## 2. Garantias e Isolamento Operacional

1. **Zero Escrita em Bancos Reais:** Testes executados em diretórios temporários (`target/test-data`) e instâncias voláteis SQLite.
2. **Main Intacta:** `origin/main` e `main` local preservadas no commit `c26ee20`.
3. **Sem Perda de Código:** Todos os merges executados com estratégia `ort` sem sobrescrita destrutiva.
