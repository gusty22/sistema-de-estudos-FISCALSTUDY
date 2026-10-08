# Matriz de Referência - FiscalStudy

| Projeto | Ideia | Valor | Classificação | Motivo |
|---------|-------|-------|---------------|--------|
| Docling | Parsing avançado de layout e tabelas via IA | Extração de elementos complexos onde regex e heurísticas falham. | ADOPT_LATER | Modelos de IA pesados são desnecessários para a ingestão inicial, mas vitais no futuro para layouts complexos. |
| Question_Extractor | Extração Dual-Path (PyMuPDF + OCR) | Permite tratar PDFs nativos com velocidade e delegar imagens ao Tesseract. | ADOPT_NOW | Acelera a extração e reduz dependência de OCR quando há texto nativo. |
| Question_Extractor | Algoritmo de "Boundary-Stitching" | Resolve o problema de questões que atravessam páginas. | ADOPT_NOW | Problema clássico em provas que precisamos resolver imediatamente. |
| Question_Extractor | Confidence Score e Review Queue | Previne corrupção da base apontando incertezas para validação humana. | ADOPT_NOW | Fundamental para manter a pureza do Golden Set e a confiança da base de dados. |
| Question_Extractor | Arquitetura FastAPI, Celery, PostgreSQL | Framework assíncrono para microsserviços. | REJECT | Conflita diametralmente com nossa arquitetura Java Spring Boot + SQLite local. |
| notebooklm-para-concursos | Estruturação de metadados ("Master Index") | Organização semântica da informação. | REFERENCE_ONLY | Útil como inspiração para guiar a modelagem do nosso próprio sistema de conhecimento. |
| notebooklm-para-concursos | Método MIT e Ciclo Ultradiano | Framework pedagógico rigoroso. | ADOPT_LATER | Servirá de base conceitual para o Decision Engine no futuro (planejamento adaptativo). |
| ts-fsrs | Algoritmo FSRS (Spaced Repetition) | Otimização do tempo de revisão com precisão matemática. | ADOPT_LATER | Essencial para a fase de retenção, mas irrelevante para a construção do Ingestor/Parser. |
| question-extractor (vikas186) | Indisponível | Projeto não encontrado. | UNKNOWN | Projeto ausente (MISSING_REFERENCE) em /references. |
