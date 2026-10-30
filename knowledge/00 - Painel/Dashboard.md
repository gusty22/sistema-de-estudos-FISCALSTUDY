# Dashboard — FiscalStudy

Central de inteligência, modelos mentais, arquitetura e ciência da aprendizagem do **FiscalStudy**.

---

## 🧭 Mapa de Navegação

### 1. Visão Geral
- [[Proposta de Valor]]: Filosofia do projeto e objetivos prioritários (Auditor Fiscal Araguari, SEFAZ-MG, Receita Federal).
- [[Glossário do Domínio]]: Conceitos canônicos (Categorias de Erro E1..E6, Falsa Fluência, Chute Educado, Foco Adaptativo).

### 2. Arquitetura & Engenharia
- [[Visão Sistêmica]]: Stack tecnológica (Spring Boot + SQLite + React/Vite + Python + R).
- [[Event Store Imutável]]: Princípio append-only e projeções materializadas sem mutação de eventos históricos.
- [[Isolamento Staging]]: Segregação estrita entre `db/staging.db` e `db/fiscalstudy.db`.
- [[Mapa Estrutural do Código]]: Ponte bidirecional Graphify ↔ Obsidian ↔ OpenSpec com rastreabilidade de código.

### 3. Funcionalidades & Interfaces
- [[Módulos A a E (Execução)]]: Início, rotina, sessões de foco, biblioteca de materiais e banco de questões.
- [[Módulos F a J (Inteligência)]]: Revisões em 4 estágios, psicometria, staging e resumos estratégicos.
- [[Tecnologia Calma]]: Design tokens (Paper creme `#f9f8f6`, Night ardósia `#0e0f11`) e redução de carga cognitiva.

### 4. Ciência da Aprendizagem
- [[Psicometria e Modelo R]]: Integração R, telemetria e calibração de retenção individualizada.
- [[Recuperação Ativa]]: Retrieval practice vs reconhecimento passivo.
- [[Ciclo em 4 Estágios]]: Intervenção, Transferência, Recuperação Ativa e Manutenção Preventiva.

### 5. Planejamento & Estado
- [[Estado Atual]]: Estado consolidado da main (PRs #41 a #49), auditoria e integridade.
- [[Roadmap Geral]]: Marcos de evolução da plataforma e objetivos consolidados.
- [[Problemas Conhecidos]]: Edge cases mapeados e tópicos de pesquisa pendentes.

### 6. Documentação Externa
- [[Índice de Documentos]]: Referências aos arquivos do repositório em `core-app/docs/` e `openspec/`.
