# FiscalStudy

## Descrição do Produto
O FiscalStudy é um sistema pessoal adaptativo de preparação para concursos, baseado em captura de eventos de telemetria cognitiva. O objetivo é atuar como um "terceiro observador", analisando continuamente o desempenho, a fluência, e as tendências do estudante para definir a melhor estratégia de estudo diária (avançar, revisar ou aprofundar).

## Arquitetura
A arquitetura do FiscalStudy foi desenhada para garantir escalabilidade e rastreabilidade absoluta de dados:
- **Append-Only Event Store:** Histórico de interações (como `QUESTION_PRESENTED`, `ANSWER_SUBMITTED`, etc.) gravado em formato imutável. Eventos nunca são editados ou apagados. As projeções materializadas (Analytics) leem este log para inferir estado.
- **Backend (Java / Spring Boot):** Implementação baseada em Arquitetura Hexagonal, com divisão clara de domínios (estudos, questões, ingestão, histórico).
- **Banco de Dados (SQLite):** Armazenamento relacional de rápida configuração, focado na utilização local, suportando logs de eventos e projeções materializadas.
- **Frontend (React / Vite):** Interface web responsiva para desktop e tablet com excelente usabilidade.
- **Ingestão (Python):** Processamento e *Boundary Stitching* de PDFs utilizando PyMuPDF para segmentar provas e gabaritos, separando conteúdo estruturado (questões, alternativas) e recortes visuais (Media Assets).

## Instruções de Uso

### Pré-requisitos
- Java 21+
- Node.js 20+
- Python 3.12+
- Maven

### Subindo o Backend (API)
```bash
cd backend/fiscalstudy-api
mvn clean install
mvn spring-boot:run
```
A API ficará disponível em `http://localhost:8080`.

### Subindo o Frontend (Aplicação Web)
```bash
cd frontend/fiscalstudy-web
npm install
npm run dev
```
O Frontend ficará disponível na porta configurada pelo Vite (ex: `http://localhost:5173`).
