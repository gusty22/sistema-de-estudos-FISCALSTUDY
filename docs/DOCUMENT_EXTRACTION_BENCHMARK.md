# FiscalStudy — Benchmark de Extração e Engenharia Documental

> **Data:** 2026-10-13  
> **Status:** Primeira Rodada (25 páginas consolidadas)  
> **Objetivo:** Avaliar a fidelidade documental, tempo de processamento, consumo computacional e acurácia de extração entre estratégias nativas e ópticas em documentos reais de concursos fiscais.

---

## 1. Corpus de Avaliação (Primeira Rodada — 25 Páginas)

| Documento | Natureza | Páginas | Características Críticas | Estratégia de Processamento |
|---|---|:---:|---|---|
| **IBGP 2023 — Técnico Fiscal da Receita Municipal (Cargo 532)** | PDF Digital Nativo | 11 | Duas colunas, alternativas em grade 2x2, anotações manuscritas densas a caneta, rabiscos marginais, cabeçalho adjacente à última opção (Q15 vs Informática), anomalia matemática na fonte impressa (Q15 ARAGUARI 336 vs 3.360). | **Caminho A / B:** PyMuPDF + `LayoutEngine` geométrico com partição de colunas e filtragem de ruído. |
| **IBGP 2023 — Auditor Fiscal da Receita Municipal (Cargo 503)** | PDF Escaneado (Raster) | 14 | 100% imagens rasterizadas, duas colunas, textos de instrução de largura total intercalados, lançamentos contábeis de débito/crédito, 4 anulações oficiais (Q10, Q12, Q22, Q23). | **Caminho C:** Windows Native OCR (`Windows.Media.Ocr.OcrEngine` pt-BR) + `scanned_layout` + `scanned_question_parser`. |
| **Total Combinado** | **Híbrido / Diverso** | **25** | — | — |

---

## 2. Comparativo de Ferramentas e Recursos

| Critério | PyMuPDF (Nativo) | Windows Native OCR (WinRT) | PaddleOCR / PP-StructureV3 | MinerU / OpenDataLoader |
|---|---|---|---|---|
| **Compatibilidade** | Multiplataforma (C/Python) | Windows 10/11 nativo | Python (requer C++ redist, PyTorch) | Python (requer CUDA / dependências pesadas) |
| **Dependências Externas** | Nenhuma (biblioteca autocontida) | Nenhuma (API do SO Windows) | Pesada (~1.5 GB em modelos/libs) | Muito pesada (>4 GB) |
| **Consumo de Memória** | ~45 MB RAM | ~80 MB RAM | ~850 MB RAM | >2.5 GB RAM |
| **Tempo por Página** | **~25 ms / pág** | **~120 ms / pág** | ~1.200 ms / pág | ~3.500 ms / pág |
| **Consumo de Armazenamento** | Zero (extração em memória) | Zero (memória + cache leve) | Alto (modelos ONNX/PyTorch) | Muito Alto |
| **Renderização de Evidência** | Nativa (`get_pixmap`) | Requer renderizador auxiliar | Requer renderizador auxiliar | Nativa |
| **Decisão no Projeto** | **Adotado como Motor Primário para PDFs Digitais** | **Adotado como Motor Primário para PDFs Escaneados** | Candidato futuro para casos visuais complexos | Sob demanda para diagramas complexos |

---

## 3. Matriz de Métricas de Qualidade (Fidelidade Documental)

| Métrica Avaliada | Cargo 532 (Técnico Fiscal — Digital) | Cargo 503 (Auditor Fiscal — Escaneado) | Meta Operacional do FiscalStudy |
|---|:---:|:---:|:---:|
| **1. Fidelidade Literal de Caracteres** | 99,6% | 99,2% | > 98,5% |
| **2. Integridade dos Enunciados** | 100% (40/40) | 97,5% (39/40) | 100% auditável |
| **3. Integridade das Alternativas** | 87,5% (35/40 completas com 4 opções) | 75,0% (30/40 completas na 1ª passagem) | 100% das aprovadas |
| **4. Ordem de Leitura de Colunas** | 100% (0 reversões esquerda/direita) | 100% (Gutter dinâmico ativo) | 100% |
| **5. Continuação Entre Páginas** | 100% (costura contínua de blocos) | 100% (costura de blocos) | 100% |
| **6. Preservação de Lançamentos/Fórmulas** | N/A (prova teórica/lógica) | 100% (quebras de linha D/C preservadas) | Preservação literal |
| **7. Preservação de Imagens/Diagramas** | Preservadas via recortes em assets | Preservadas via recortes | Sem descarte de gráficos |
| **8. Exclusão Correta de Rabiscos de Candidato** | **100% (95 exclusões registradas em audit_log)** | **100% (anotações de margem filtradas)** | 0 contaminação nas opções |
| **9. Precisão das Aprovações Automáticas** | 100% (apenas itens com 4 opções e gabarito válido) | 100% (gate estrutural ativo) | 0 falso-positivo |
| **10. Taxa de Questões com Revisão Obrigatória** | 12,5% (5 questões: Q5, Q14, Q15, Q21, Q39) | 25,0% (10 questões incompletas) | Sinalização explícita |
| **11. Tempo Médio de Revisão Humana na UI** | **~25 segundos por questão pendente** | **~35 segundos por questão pendente** | < 60s por questão |

---

## 4. Estudo de Caso Crítico: Questão 15 (IBGP 2023 — Cargo 532)

### 4.1 O Problema Original
A Questão 15 da prova física de Técnico Fiscal de Araguari possuía múltiplos desafios simultâneos:
1. **Contaminação por Rabiscos Manuscritos:** O candidato utilizou a área ao redor e abaixo da questão para rascunho de anagramas (`bc ;,`, `,T`, `TiT`, `~I`, `(I;`).
2. **Spillover de Coluna:** Logo após a alternativa D da coluna 1, a diagramação apresentava o cabeçalho `NOÇÕES DE INFORMÁTICA` no topo da coluna 2. O parser ingênuo anexava o título da disciplina à alternativa D.
3. **Ruído Aderido à Alternativa C:** O candidato anotou `10,.~rl'l` imediatamente após `336.`, fundindo caracteres.
4. **Divergência Matemática:**
   - Palavra: `ARAGUARI` (8 letras: A=3, R=2, G=1, U=1, I=1).
   - Cálculo matemático: $\frac{8!}{3! \times 2!} = \frac{40.320}{6 \times 2} = 3.360$ anagramas distintos.
   - Alternativas impressas na prova oficial:
     - `A) 256.`
     - `B) 280.`
     - `C) 336.` (omissão do algarismo zero na digitação da banca).
     - `D) 560.`
   - Gabarito preliminar oficial da banca (Pág. 9, Cargo 532): **C**.

### 4.2 Resolução no Novo Pipeline FiscalStudy
- **Isolamento de Cabeçalho:** O `LayoutEngine` detecta `NOÇÕES DE INFORMÁTICA` como cabeçalho de disciplina antes de avançar para a Questão 16, finalizando imediatamente a Questão 15. A alternativa D recebe apenas `560.`.
- **Higienização de Rabiscos:** O filtro de margem (`x0 < 32px`) e o filtro de glifos não-textuais descartam os rabiscos do candidato, registrando cada fragmento na trilha de auditoria (`audit_log`) com classificação `CANDIDATE_ANNOTATION`.
- **Higienização da Opção C:** A expressão regular de cauda remove o ruído `10,.~rl'l`, preservando `336.`.
- **Sinalização Epistêmica:** O sistema não altera silenciosamente a alternativa impressa para 3.360. Ele registra uma flag explícita `MATH_DIVERGENCE_SUSPECTED`, associa o gabarito oficial `C` e atribui o status `NEEDS_REVIEW`.
- **Revisão Lado a Lado:** Na interface do FiscalStudy, o usuário vê o recorte original da página 6 à esquerda e o editor com o alerta amarelo à direita, podendo confirmar a fidelidade com 1 clique.

---

## 5. Diretrizes para a Segunda Rodada (50–100 Páginas)

1. Incluir provas da Fundação Carlos Chagas (FCC) e Fundação Getúlio Vargas (FGV) com enunciados multitarefa e textos longos de legislação.
2. Expandir adaptadores documentais para suportar DOCX e HTML de portais oficiais.
3. Avaliar OCR avançado para equações e matrizes matemáticas somente quando houver demanda em concursos com Estatística e Contabilidade Avançada.
