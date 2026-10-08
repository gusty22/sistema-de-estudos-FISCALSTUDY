# Auditoria de Projetos de Referência - FiscalStudy

## 1. Resumo Executivo
A presente auditoria técnica avaliou projetos de referência fornecidos em `/references` para extrair ideias estruturais, arquiteturais e metodológicas, visando acelerar e melhorar o pipeline de ingestão e o ecossistema de aprendizagem do FiscalStudy. A análise focou estritamente em extrair padrões aplicáveis sem violar nossas premissas arquiteturais (Spring Boot, Java, Python, SQLite, Event Log). Constatou-se a presença de 4 projetos de referência válidos, além de um repositório classificado como ausente (`question-extractor` de vikas186). O principal ganho prático para esta fase imediata (Fase 2 - Ingestão) reside nas técnicas de `Dual-Path` e `Boundary-Stitching` extraídas do `Question_Extractor`.

## 2. Referências Ausentes
- **MISSING_REFERENCE**: `question-extractor` — vikas186. Este projeto não está disponível em `/references/question-extraction/`. É necessário disponibilizá-lo caso se deseje analisar suas técnicas específicas para extração de diagramas e equações.

## 3. Projeto por Projeto

### A. Docling
- **Função**: Processamento documental avançado de layout, tabelas e ordem de leitura.
- **Arquitetura**: Bibliotecas Python, integração com modelos VLMs, suporte a OCR, rodando via CLI ou biblioteca local, focado na reconstrução semântica da página em formatos unificados.
- **Licença**: MIT.
- **Técnicas Interessantes**: Parsing avançado de layout com AI que não depende de heurísticas ingênuas; extração inteligente de tabelas.
- **Limitações**: Muito pesado e complexo para uma pipeline heurística simples focada em provas textuais limpas; introduz modelos pesados localmente.

### B. Question_Extractor (Pardhu-Burle)
- **Função**: Serviço de inteligência para extrair questões, opções, multi-páginas e gabarito.
- **Arquitetura**: Gateway FastAPI, fila Celery via Redis, banco PostgreSQL via SQLAlchemy, frontend React.
- **Licença**: Não especificada (assignment técnico).
- **Técnicas Interessantes**: 
  - *Dual-Path Text & Image Extraction*: usa PyMuPDF para vetores, reserva OCR para imagens.
  - *Boundary-Stitching*: lógica preditiva para juntar uma questão que quebra ao fim de uma página e continua na próxima.
  - *Confidence Score*: equação simples ponderando vários fatores para dar certeza da extração e pareamento do gabarito.
  - *Review Queue Humana*: itens incertos não são descartados, mas enfileirados para revisão.
- **Limitações**: Arquitetura de microsserviços (Celery/Redis/PostgreSQL) totalmente incompatível e excessiva para os propósitos offline e monolíticos do FiscalStudy (SQLite).

### C. notebooklm-para-concursos (gilsonnogueira)
- **Função**: Metodologia (N.A.G.) para estudos, estruturação via NotebookLM e retenção via Anki.
- **Arquitetura**: Coleção de frameworks e prompts modulares (Markdown) para orquestrar IA genérica com ancoragem ("source-grounded").
- **Licença**: MIT.
- **Técnicas Interessantes**: 
  - Ciclo Ultradiano de Estudo (Método MIT de alta fricção).
  - Categorização do estudo por disciplina via frameworks.
  - Formato rigoroso de geração de outputs e controle biológico de pausas.
- **Limitações**: Sistema feito para condução humana e dependente de IA generativa no ciclo de leitura (enquanto o FiscalStudy busca automatizar a tomada de decisão no planejamento sem usar LLM para tudo).

### D. ts-fsrs
- **Função**: Scheduler para spaced repetition (FSRS v6).
- **Arquitetura**: Ferramental escrito em TypeScript com bindings e pacotes npm independentes.
- **Licença**: MIT.
- **Técnicas Interessantes**: Otimização algorítmica para retenção a longo prazo, definindo estados de repetição e previsibilidade da memória de trabalho.
- **Limitações**: Implementado em TypeScript, o que não se alinha diretamente com nosso backend Java caso o agendamento precise ser recalculado em batch no servidor local.

## 4. Comparação com o FiscalStudy e Classificação

As ideias úteis detectadas foram classificadas quanto à adoção no projeto.

| Projeto | Ideia | Valor | Classificação | Motivo |
|---------|-------|-------|---------------|--------|
| Question_Extractor | Extração Dual-Path (PyMuPDF + Tesseract) | Resolve texto limpo vs imagens scaneadas. | **ADOPT_NOW** | Otimiza performance e é perfeito para Python. |
| Question_Extractor | Boundary-Stitching | Questões que cruzam 2 páginas. | **ADOPT_NOW** | Critico para a correta importação de provas. |
| Question_Extractor | Review Queue e Confidence Score | Trata falhas na extração de gabarito ou OCR. | **ADOPT_NOW** | Garantirá a proveniência e qualidade do nosso Golden Set. |
| Question_Extractor | Fila com Celery, Redis, PostgreSQL | Microsserviços para ingestão. | **REJECT** | Nosso sistema será monolítico local, com Java, Spring Boot e SQLite. |
| Docling | Modelos IA para Parsing | Tabelas e leiautes mistos avançados. | **ADOPT_LATER** | Overhead desnecessário agora, mas no futuro lidará com PDFs difíceis. |
| ts-fsrs | Scheduler FSRS | Algoritmo matemático para determinar retenção. | **ADOPT_LATER** | Crucial para o planejamento, porém está fora de escopo para a Ingestão. |
| notebooklm... | Ciclo Ultradiano (MIT) e metadados. | Framework instrucional de estudo. | **REFERENCE_ONLY** | O conceito base alimentará o Decision Engine do FiscalStudy no futuro. |
| question-extractor | N/A | N/A | **UNKNOWN** | Projeto missing_reference. |

## 5. Foco na Ingestão (Impacto Imediato no Pipeline)

A análise indica que nosso pipeline em Python deve adotar a seguinte forma híbrida baseada nas referências:
1. `PDF -> Extractor`: Utilizar o conceito **Dual-Path** (PyMuPDF para digital, OpenCV/OCR fallback para imagens contidas).
2. `Question segmentation`: Integrar a heurística de **Boundary-Stitching** (monitorar quebras de página ativas).
3. `Answer-key association`: Desenvolver heurísticas que validem se o match foi bem-sucedido e calcular um **Confidence Score** simples.
4. `Validation`: Qualquer item com confidence baixa vai para o estado de incerteza (para posterior revisão via UI), mantendo a base confiável.

As decisões acima respeitam nossa escolha pelo Event Store e SQLite, pois o pipeline de ingestão Python (que gerará o ImportPayloadDTO) atuará apenas como produtor validado de eventos de importação de documentos para o Spring Boot processar. Não implementaremos o parser de maneira monolítica acoplada ao Celery/FastAPI.
