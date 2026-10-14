# Relatório Técnico: Arquitetura do Mecanismo Permanente de Ingestão Documental — FiscalStudy

> **Data:** 14 de Outubro de 2026  
> **Sistema:** FiscalStudy (Plataforma Pessoal Adaptativa de Preparação para Concursos)  
> **Repositório:** `C:\Users\washi\OneDrive\Área de Trabalho\sistema de estudos`  
> **Status:** Diagnóstico Arquitetural e Especificação Técnica (Fase 1 — Pré-Implementação)  

---

## Sumário Executivo

Este documento apresenta a auditoria técnica exaustiva do ecossistema do **FiscalStudy** e a especificação da arquitetura do **Mecanismo Permanente de Ingestão Documental**. 

O objetivo do mecanismo é transformar o acervo de centenas de arquivos PDF (provas, gabaritos, editais e retificações) em uma base de questões estruturada, pesquisável, rastreável e pedagogicamente integrada ao FiscalStudy, sem jamais inventar dados, garantindo fidelidade absoluta à fonte documental e operando em **total isolamento do banco operacional** (`db/fiscalstudy.db`).

---

## 1. Auditoria do Projeto Existente

### 1.1. Backend (Java 17 / Spring Boot 3.3.4)
* **Padrão Arquitetural:** Inspirado em Hexagonal / Clean Architecture (`domain`, `application`, `infrastructure/in/web`, `infrastructure/out/persistence`).
* **Princípio Fundamental:** *Append-Only Event Log + Materialized Projections*. A tabela `event_store` armazena eventos de negócios imutáveis (`occurred_at`, `payload_json`, `event_type`). O estado do estudante e as estatísticas são derivados por projeções.
* **Componentes de Ingestão Existentes:**
  * `IngestionController.java`: Expõe endpoints REST maduros para o ciclo de vida do staging:
    * `POST /api/v1/ingestion/sessions`: Criação de sessão de importação.
    * `POST /sessions/{id}/upload`: Upload de arquivos com sanitização de caminho.
    * `POST /sessions/{id}/process`: Execução assíncrona do pipeline via `CompletableFuture`.
    * `GET /sessions/{id}/questions`: Listagem de questões extraídas em staging.
    * `PUT /sessions/{id}/questions/{qId}`: Edição manual de questão com flag `modifiedByUser = true`.
    * `POST /sessions/{id}/questions/{qId}/verify`: Marcação de `SOURCE_VERIFIED`.
    * `POST /sessions/{id}/questions/{qId}/reject`: Rejeição justificada com categorização.
    * `GET /sessions/{id}/evidence/{file}`: Streaming seguro de imagens de prova/evidência.
    * `POST /sessions/{id}/simulate-import`: Dry-run preventivo verificando colisões com o banco operacional.
    * `POST /sessions/{id}/import-confirmed`: Persistência atômica das questões validadas e gravação do evento `IMPORT_RECEIVED` na `event_store`.
  * `IngestionPipelineService.java`:
    * Orquestra a chamada de subprocesso Python (`python -m src.pipeline.pipeline_runner`).
    * Realiza classificação automática contextualizada a partir dos tópicos do Edital Verticalizado (`classifyFromEdital`).
    * Detecta caracteres corrompidos (*mojibake* e anomalias de OCR) através do método `detectContextualSuspectChars`.
    * Atualmente armazena o estado das sessões em `target/staging_pipeline/{sessionId}/staging_state.json`.

### 1.2. Banco de Dados Operacional (`db/fiscalstudy.db`)
* **Mecanismo:** SQLite configurado com `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;`.
* **Total de Tabelas:** 17 tabelas criadas a partir de `schema.sql`.
* **Inventário de Dados Atuais:**
  * `questions`: **0 registros** (o banco operacional está íntegro e limpo, sem questões pendentes ou poluídas).
  * `concursos`: 1 registro (`prefeitura-municipal-de-araguari-auditor-fiscal-da-receita-municipal-2027`).
  * `editais`: 1 registro (Edital Verticalizado v1.0).
  * `edital_topicos`: 164 tópicos estruturados divididos entre Português, Raciocínio Lógico, Noções de Informática, Conhecimentos Gerais, Legislação e Conhecimentos Específicos.
  * `support_materials`: 0 registros (tabela modelada para textos-base compartilhados, figuras, tabelas e coordenadas geométricas).
  * `question_support_materials`: 0 registros (tabela de junção N:M entre questão e material de apoio).
  * `event_store`: 1 registro de inicialização.

### 1.3. Pipeline Documental Python (`ingestion/`)
* **Ambiente:** Python 3.13 com ambiente virtual configurado em `ingestion/venv` e dependência nativa do `PyMuPDF` (fitz).
* **Módulos Centrais:**
  * `document_inspector.py`: Cálculo de SHA-256 em blocos de 1MB, contagem de páginas e dimensões, classificação digital vs. escaneado e inferência de papel documental (`PROVA`, `GABARITO`, `EDITAL`).
  * `layout_engine.py`: Motor geométrico de alto desempenho. Executa remoção de cabeçalhos/rodapés marginais, ordenação de leitura por colunas (x0/y0), filtro de anotações e rabiscos manuscritos de candidatos, suporte a alternativas em coluna única ou em linha (grades 2x2: A/C e B/D) e segmentação por regex estruturado.
  * `answer_key_service.py`: Extração tabular de gabaritos em PDF por alinhamento vertical e filtragem por código de cargo, registrando status explícitos (`PRELIMINAR`, `DEFINITIVO`, `RETIFICADO`, `ANULADA`, `AUSENTE`).
  * `evidence_renderer.py`: Renderização de páginas originais em PNG (140 DPI) para conferência visual.
  * `pipeline_runner.py`: Orquestrador de ponta a ponta que emite `pipeline_result.json`.

### 1.4. Frontend (`frontend/src/`)
* **`ImportStudio.tsx` (1.390 linhas):**
  * Interface rica em modo *Split-Screen* (tela dividida):
    * **Painel Esquerdo:** Visualizador interativo da página/recorte original com zoom, paginação e navegação por coordenadas.
    * **Painel Direito:** Formulário de conferência da questão extraída (enunciado, alternativas formatadas, gabarito oficial com status, disciplina sugerida, assunto do edital, flags de risco).
  * Filtros de triagem por estado: `ALL`, `NEEDS_REVIEW`, `STRUCTURALLY_VALID`, `SOURCE_VERIFIED`, `REJECTED`.
  * Modal de simulação pré-importação (*Dry-Run*) que lista colisões potenciais de ID e inconsistências antes de qualquer gravação no banco operacional.

---

## 2. Identificação e Inventário do Acervo

### 2.1. Localização do Acervo
O acervo de provas localiza-se em:
```text
c:\Users\washi\Downloads\provas
```
Contém duas coleções principais:
1. `QConcursos_IBGP`: Concursos organizados pelo Instituto IBGP (2019 a 2026).
2. `Auditor_Fiscal_2019+`: Concursos de Auditoria Fiscal de diversos órgãos e bancas do Brasil (2019 a 2026).

### 2.2. Regra Especial de Exclusão da Pasta `processados`
> [!IMPORTANT]
> **Conformidade Estrita com a Regra Especial:**  
> A exclusão foi implementada por comparação normalizada de componentes de diretório (`os.path.normpath(path).lower().split(os.sep)`). Qualquer diretório ou subdiretório cujo nome seja exatamente `processados` (insensível a maiúsculas/minúsculas no Windows) é sumariamente ignorado pela rotina de descoberta. Esses arquivos **não serão lidos, não sofrerão OCR, não serão movidos e não participarão da extração**.

### 2.3. Censo Quantitativo do Acervo

| Categoria | `QConcursos_IBGP` | `Auditor_Fiscal_2019+` | Total no Acervo |
| :--- | :---: | :---: | :---: |
| **PDFs Excluídos (`processados`)** | 299 | 470 | **769** |
| **PDFs Elegíveis para Ingestão** | 119 | 268 | **387** |
| **Total de Arquivos no Acervo** | **418** | **738** | **1.156** |

#### Detalhamento dos 387 PDFs Elegíveis:
1. **Documentos Unificados com Bookmarks/TOC:**
   * 113 PDFs em `QConcursos_IBGP` (contendo Edital + Prova + Gabarito ou Prova + Gabarito).
   * 235 PDFs em `Auditor_Fiscal_2019+` (contendo Prova + Gabarito).
   * **Total de Provas Consolidadas:** **348 cadernos completos**.
2. **Documentos Preservados em Quarentena (Incompletos na Origem):**
   * 6 arquivos em `QConcursos_IBGP` (5 editais de Itabira sem prova correspondente).
   * 33 arquivos em `Auditor_Fiscal_2019+` (25 cadernos de prova solitários sem gabarito disponível e 2 concursos multicaderno/turnos para conferência manual: Tijucas e SEFAZ-AM).
3. **Duplicidades Criptográficas (SHA-256) entre Elegíveis:**
   * Identificados apenas 2 grupos de duplicatas de arquivo físico (3 cópias redundantes), correspondentes ao mesmo edital de Itabira 2020 e 2021 baixado para múltiplos cargos.
4. **Integridade Estrutural:**
   * **100% dos 387 PDFs elegíveis** possuem integridade básica confirmada (0 corrompidos).

---

## 3. Diagnóstico Arquitetural e Gaps do Pipeline Atual

1. **Documentos Compostos Concatenados:** O `pipeline_runner.py` atual espera obrigatoriamente caminhos separados para `--exam` e `--answer-key`. Os 348 PDFs elegíveis consolidados possuem Prova e Gabarito (e Edital) unificados no mesmo PDF com marcadores de TOC. O pipeline precisa identificar e segmentar as faixas de páginas (*page spans*) de cada documento lógico.
2. **Dependência de Código de Cargo Rígido:** O runner utiliza `--cargo-code` (padrão 532/503). Provas de outras bancas (FGV, CESPE, FCC) não utilizam essa convenção. O identificador deve extrair o cargo e a especialidade diretamente do cabeçalho da prova ou dos marcadores.
3. **Staging Volátil no Diretório `target/`:** O `IngestionPipelineService` grava metadados em `target/staging_pipeline/`. Execuções de `mvn clean` apagam todas as sessões pendentes. O staging deve residir em um banco SQLite isolado e durável (`db/staging.db`).
4. **Ausência de Processamento em Lote com Checkpoints:** A arquitetura atual é centrada em upload único manual pelo navegador. O processamento de centenas de arquivos exige um executor em lote em linha de comando / worker com salvamento de progresso (*checkpoints*), idempotência e retomada transparente após reinicialização.
5. **Integração de Recursos Visuais e Textos Compartilhados:** A tabela `support_materials` existe no banco, mas o pipeline ainda não persiste os recortes de gráficos e textos de apoio associados às questões.

---

## 4. Arquitetura Proposta: Mecanismo Permanente de Ingestão

### 4.1. Topologia de Isolamento de Dados

Para cumprir o princípio inegociável de **Segurança do Banco Operacional**:
* O banco operacional `db/fiscalstudy.db` permanece **estritamente em modo de leitura** durante toda a descoberta, extração, classificação e revisão.
* Toda a área intermediária, filas de execução, blocos brutos, evidências e questões pendentes residem em um banco SQLite dedicado: `db/staging.db`.

---

## 5. Estratégia de Identidade e Deduplicação Multinível

1. **Nível 1 — Arquivo Físico:** Identificação por `sha256`. Evita reler arquivos idênticos no mesmo lote.
2. **Nível 2 — Documento Lógico:** Em PDFs compostos, define `document_type` (`EDITAL`, `PROVA`, `GABARITO`), `page_start` e `page_end`.
3. **Nível 3 — Prova Canônica:** Identificada pela tupla normalizada:
   `ID Prova = slug(banca) + "-" + ano + "-" + slug(orgao) + "-" + slug(cargo)`
4. **Nível 4 — Questão:**
   `ID Questão = ID Prova + "-q" + numero_original`
   *Garante idempotência estrita:* se a mesma prova for reprocessada, a questão atualizará seus dados sem duplicar registros no banco.
5. **Detecção de Conteúdo Semelhante (*Cross-Exam Reuse*):**
   * Um hash semântico do enunciado normalizado identificará se a questão da banca X em 2024 é idêntica a uma questão de 2021.
   * **Regra Inegociável:** As duas questões serão preservadas independentemente em suas respectivas provas de origem, gerando apenas um vínculo de referência cruzada para alimentar o motor de Raio-X da Banca.

---

## 6. Modelo de Rastreabilidade e Máquina de Estados

### Critérios de Transição de Estado:
* **`DISCOVERED`:** PDF localizado no acervo, hash SHA-256 gerado, caminho validado fora de `processados`.
* **`CLASSIFIED_DOCUMENT`:** Intervalos de páginas do caderno de prova e do gabarito mapeados.
* **`EXTRACTED`:** Blocos de texto associados a números de questão, alternativas (A-D, A-E ou C/E) e gabarito preliminar/definitivo.
* **`STRUCTURALLY_VALID`:** Questão possui enunciado não vazio, todas as alternativas identificadas, gabarito válido (`A`–`E`, `C`, `E` ou `ANULADA`), sem quebras suspeitas de coluna.
* **`NEEDS_REVIEW`:** Atribuído automaticamente se houver flags de risco (`SUSPECT_OCR`, `MISSING_OPTIONS`, `DISCIPLINE_HEADER_COLLISION`, `UNMATCHED_ANSWER_KEY`, `MULTI_CARGO_AMBIGUITY`).
* **`SOURCE_VERIFIED`:** Questão inspecionada visualmente contra o recorte da página no ImportStudio, com registro de data, usuário e notas.
* **`PUBLISHED`:** Questão persistida transacionalmente em `db/fiscalstudy.db` com evento registrado na `event_store`.

---

## 7. Modelagem do Armazenamento de Staging (`db/staging.db`)

Para garantir persistência e retomada sem poluir o banco operacional, o schema de staging conterá:
* `staging_files`: Metadados dos arquivos físicos, hashes SHA-256 e contagem de páginas.
* `staging_documents`: Documentos lógicos e intervalos de páginas (caderno de prova vs gabarito).
* `staging_questions`: Questões em triagem, status de validação, flags e evidências visuais.
* `staging_support_materials`: Textos-base compartilhados, imagens de gráficos e tabelas.

---

## 8. Plano de Implementação Progressivo por Etapas

* **ETAPA 1 — Auditoria e Arquitetura:** Concluída e detalhada neste relatório.
* **ETAPA 2 — Inventário Automatizado & Descoberta Segura:** População da tabela de arquivos em `db/staging.db` com filtro estrito da pasta `processados`.
* **ETAPA 3 — Prova de Conceito em Amostra Representativa:** Validação em 5 tipos documentais desafiadores (composto, multicoluna, certo/errado, texto compartilhado e figuras).
* **ETAPA 4 — Pipeline Completo & Motor de Lotes:** Implementação de processador em lote com checkpoints e tolerância a falhas.
* **ETAPA 5 — Auditoria Visual no ImportStudio:** Integração das filas de revisão orientadas por risco na interface web.
* **ETAPA 6 — Testes de Integração e Resiliência:** Validação com o Golden Set e testes de recuperação de interrupções.
* **ETAPA 7 — Processamento Controlado do Acervo:** Execução supervisionada dos 387 PDFs elegíveis.
* **ETAPA 8 — Publicação Transacional:** Backup verificado e importação atômica das questões validadas para o `db/fiscalstudy.db`.

---

## 9. Matriz de Riscos e Estratégias de Mitigação

1. **Risco de Corrupção do Banco Operacional:** Isolamento estrito em `db/staging.db`. O banco `fiscalstudy.db` opera em modo somente-leitura até a Etapa 8.
2. **Risco de Processamento Indevido de `processados`:** Algoritmo por componentes de diretório (`os.path.normpath`), excluindo 100% dos 769 arquivos já arquivados.
3. **Risco de Associação Incorreta de Gabaritos:** Associação exigente por código/denominação do cargo e número. Em caso de divergência, quarentena automática em `NEEDS_REVIEW`.
4. **Risco de Colisão de Identificadores:** Identificador canônico qualificado por banca, ano, órgão, cargo e número original.

---

## 10. Conclusão e Próximos Passos

O banco operacional `db/fiscalstudy.db` permanece intacto e preservado. Os 769 arquivos da pasta `processados` foram mapeados e rigorosamente excluídos. Os **387 PDFs elegíveis** estão catalogados e com integridade confirmada.

Solicito sua validação desta arquitetura para darmos início à **ETAPA 2 (Inventário Automatizado e Criação do Staging Database Isolado)**.
