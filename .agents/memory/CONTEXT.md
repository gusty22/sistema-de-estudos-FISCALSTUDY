# Contexto e Estado Arquitetural — FiscalStudy (Índice Ativo)

## 1. Ambientes e Diretórios
- **Workspace Principal**: `C:\Users\washi\OneDrive\Área de Trabalho\fiscalstudy-platform\core-app`
- **Analytics Engine (R)**: `..\analytics-engine\R\digital_twin_engine.R`
- **Acervo de Provas**: `c:\Users\washi\Downloads\provas` (386 arquivos elegíveis processados)
- **Cofre de Conhecimento (Obsidian)**: `..\obsidian\FiscalStudy-Obsidian`

## 2. Decisões Arquiteturais Fundamentais
- **Princípio Central**: APPEND-ONLY EVENT LOG + MATERIALIZED PROJECTIONS. Eventos históricos nunca são alterados ou apagados.
- **Backend**: Java LTS + Spring Boot + SQLite local (`db/fiscalstudy.db` e `db/staging.db`).
- **Frontend**: React + TypeScript + Vite. Design Tokens de *Tecnologia Calma* (Paper `#f9f8f6` e Night `#0e0f11`).
- **Ingestão**: Python (`UniversalExtractor` com isolamento prévio de `SUPPORT_PATTERNS` e fusão multi-cargo de gabaritos).
- **Resiliência**: Falhas no motor R ou extratores nunca travam o estudo; o sistema opera em fallback local resiliente.

## 3. Estado Atual dos Bancos e Produção (v3.24)
- **Produção (`db/fiscalstudy.db`)**: 13.241 questões ativas publicadas com segurança atômica; 486 materiais vinculados.
- **Motor de Ingestão e Matriz de Pareto**: Módulo nativo ativo no Edital Verticalizado (`motorParetoEdital.ts` e `MotorParetoEditalModal.tsx`) para ingestão de edital bruto, classificação Pareto A/B/C histórica, cálculo de pesos da prova e diagnóstico do Quarteto de Alocação de Tempo.
- **Build & Testes**: Backend (`mvnw.cmd test-compile` -> SUCCESS) e Frontend (`tsc -b && vite build` -> SUCCESS).

## 4. Índice de Documentação Modular
Consulte pontualmente via `view_file` conforme o escopo da tarefa:
- **Detalhamento dos Módulos A a J**: [`docs/architecture/modules/MODULOS_ESPECIFICACOES.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/architecture/modules/MODULOS_ESPECIFICACOES.md)
- **Histórico Completo de Versões e Decisões**: [`docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/architecture/decisions/HISTORICO_ARQUITETURAL_COMPLETO.md)
- **Especificações Funcionais Ativas**: [`openspec/`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/openspec/) (gerenciadas via OpenSpec)
- **Integração com Motor R**: [`docs/ANALYTICS_R_INTEGRATION.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/ANALYTICS_R_INTEGRATION.md)
- **Arquitetura de Ingestão Documental**: [`docs/ARQUITETURA_INGESTAO_DOCUMENTAL.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/ARQUITETURA_INGESTAO_DOCUMENTAL.md)
- **Contrato de Dados V1**: [`docs/DATA_CONTRACT_V1.md`](file:///c:/Users/washi/OneDrive/%C3%81rea%20de%20Trabalho/fiscalstudy-platform/core-app/docs/DATA_CONTRACT_V1.md)

## 5. Ferramentas e Skills Ativas
- **OpenSpec (`openspec/`)**: Gestão de propostas (`/opsx-propose`) e tarefas (`/opsx-apply`).
- **Skills Sob Demanda (`.agents/skills/`)**: `implement` (TDD), `code-review` (diffs), `taste-skill` (UI anti-slop).
- **Obsidian**: Central de conhecimento e pesquisa em `..\obsidian\FiscalStudy-Obsidian\00 - Painel\Dashboard.md`.
