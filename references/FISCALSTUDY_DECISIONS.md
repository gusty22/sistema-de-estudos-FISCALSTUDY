# Decisões para o FiscalStudy (Inspiradas nas Referências)

Com base na auditoria dos repositórios locais, aprovam-se as seguintes decisões para o projeto. 

## Implementar Agora (Fase Ingestão - ADOPT_NOW)

1. **Estratégia Dual-Path (PyMuPDF Principal + OCR Fallback)**
   O uso exclusivo do Tesseract/OCR para todo PDF é um desperdício. Implementaremos o parser em Python para tentar primeiramente a extração vetorial nativa via PyMuPDF. Imagens contidas nas páginas e PDFs puramente escaneados utilizarão OCR como contingência.

2. **Lógica de Boundary-Stitching (Questões Multi-page)**
   O parser Python deve manter contexto de continuidade. Se a "Questão 4" começar ao fim da página 1, o texto da página 2 deve ser acoplado à Questão 4 até que a indicação da "Questão 5" ou opções "A, B, C" sejam detectadas.

3. **Validação e Pontuação de Confiança (Confidence Score)**
   O script gerador de `ImportPayloadDTO` não tomará decisões silenciosas sobre incertezas. A associação de gabaritos e a qualidade da extração de cada questão devem receber uma pontuação (ex: de 0.0 a 1.0).

4. **Quarentena / Review Queue**
   Qualquer extração com métrica de confiança duvidosa (e.g. abaixo de 0.6) deve ser marcada no DTO. O Spring Boot as tratará para caírem numa tela de "Revisão Manual" no frontend, blindando a integridade da Event Store.

## Implementar Depois (Fase Aprendizagem e Analytics - ADOPT_LATER)

1. **Agendador de Retenção (Spaced Repetition)**
   Adoção do algoritmo FSRS (inspiração do repositório `ts-fsrs`) como pilar mecânico da etapa de retenção.
   
2. **Ciclo de Planejamento Ativo (Decision Engine)**
   Conceitos como o Ciclo Ultradiano e pausas fisiológicas (inspirados na metodologia do `notebooklm-para-concursos`) servirão de input para a lógica de quando o "Terceiro Observador" mandará o usuário parar, avançar ou revisar.

3. **Parsing IA de Alto Desempenho (Docling)**
   Implementação de reconhecimento via modelos de IA focada em documentos extremamente hostis e repletos de tabelas/matemática avançada.

## Ideias Rejeitadas (REJECT)

1. **Arquitetura de Filas e Microsserviços para Backend**
   Em detrimento do `Question_Extractor`, rejeita-se o uso de FastAPI, Redis e Celery para gerenciar a aplicação. O sistema adotará a estratégia pragmática já validada: Java Spring Boot monolítico com SQLite.

2. **Armazenamento de Estado em PDF**
   PDFs completos não comporão a Event Store local. O parser extrai e descarta o corpo. Apenas dados estruturados (e recortes de imagens precisos referenciados como `media_assets`) devem ser armazenados, garantindo a leveza do SQLite.
