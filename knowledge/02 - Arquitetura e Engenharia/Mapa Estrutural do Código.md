---
tipo: ponte_conhecimento
projeto: FiscalStudy
status: ativo
ultima_atualizacao: 2026-10-23
---

# Mapa Estrutural do Código (Ponte Graphify ↔ Obsidian ↔ OpenSpec)

Esta nota estabelece a ponte bidirecional e verificável entre os conceitos de negócio, especificações funcionais e a topologia real do código-fonte mapeada pelo **Graphify**.

---

## 🗺️ Matriz de Rastreabilidade

| Conceito / Domínio | Nota Obsidian | Especificação OpenSpec / Docs | Componentes de Código (Graphify AST) | Arquivos Principais |
| :--- | :--- | :--- | :--- | :--- |
| **Revisões Adaptativas em 4 Estágios** | [[Ciclo em 4 Estágios]] | `docs/architecture/modules/MODULOS_ESPECIFICACOES.md#módulo-f` | `RevisionCalendarService`, `RevisionCalendarController`, `AttemptSubmissionService` | `backend/src/main/java/com/fiscalstudy/backend/application/RevisionCalendarService.java` |
| **Resolução de Questões & Diagnóstico** | [[Glossário do Domínio]] | `docs/architecture/modules/MODULOS_ESPECIFICACOES.md#módulo-e` | `QuestionViewer`, `QuestionBankService`, `QuestionController`, `DiagnosticoComportamental` | `frontend/src/components/QuestionViewer.tsx`, `backend/src/main/java/com/fiscalstudy/backend/application/QuestionBankService.java` |
| **Event Store Append-Only** | [[Event Store Imutável]] | `docs/DATA_CONTRACT_V1.md` | `EventStoreRepository`, `EventStoreRepositoryImpl` | `backend/src/main/java/com/fiscalstudy/backend/infrastructure/out/persistence/EventStoreRepositoryImpl.java` |
| **Ingestão & Extração de PDFs** | [[Isolamento Staging]] | `docs/ARQUITETURA_INGESTAO_DOCUMENTAL.md` | `UniversalExtractor`, `LayoutEngine`, `batch_processor.py` | `ingestion/src/pipeline/universal_extractor.py`, `ingestion/src/pipeline/layout_engine.py` |
| **Tecnologia Calma & Interface** | [[Tecnologia Calma]] | `taste-skill` / Design Tokens | `App.tsx`, `Sidebar.tsx`, `Dashboard.tsx`, `index.css` | `frontend/src/App.tsx`, `frontend/src/index.css` |
| **Analytics Psicométrico & R** | [[Psicometria e Modelo R]] | `docs/ANALYTICS_R_INTEGRATION.md` | `AnalyticsBridgeService`, `digital_twin_engine.R` | `analytics-engine/R/adapter.R`, `analytics-engine/R/digital_twin_engine.R` |

---

## 🔍 Como Consultar o Grafo Estrutural (Graphify)

Quando precisar localizar implementações ou avaliar raio de impacto no terminal ou via Antigravity:

```powershell
# 1. Localizar onde um conceito está implementado:
graphify query "Onde está implementado o agendamento de revisões?"

# 2. Explicar um componente e suas conexões imediatas:
graphify explain "backend_src_main_java_com_fiscalstudy_backend_application_revisioncalendarservice_revisioncalendarservice"

# 3. Descobrir caminho/dependência entre dois nós:
graphify path "AttemptSubmissionService" "RevisionCalendarService"
```
