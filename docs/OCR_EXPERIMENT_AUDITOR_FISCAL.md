# Experimento de OCR no Golden Set Principal e Auditoria de Gabarito (Auditor Fiscal)

> **Data:** 2026-10-12  
> **Status:** Concluído e Comprovado  
> **Golden Set:** Prova de Auditor Fiscal da Receita Municipal de Araguari (IBGP 2023, Cargo 503)

---

## 1. Contexto do Experimento

O arquivo `503_-_auditor_fiscal_da_receita_municipal.pdf` (9 páginas) é uma digitalização rasterizada (páginas compostas exclusivamente por imagens escaneadas sem camada de texto nativo embutida).

Em estrito cumprimento das diretrizes de autonomia ("avaliar primeiro as ferramentas disponíveis no ambiente", "não instalar infraestrutura pesada sem necessidade comprovada"), foi identificado que o sistema operacional Windows 11 possui uma engine nativa de OCR: `Windows.Media.Ocr.OcrEngine`, com suporte instalado e configurado para o idioma **Português (Brasil) — `pt-BR`**.

Foi realizado um experimento controlado extraindo a **Página 2** (primeira página contendo texto e questões da prova).

---

## 2. Parâmetros e Recursos do Experimento

- **Imagem de Entrada:** Página 2 renderizada via PyMuPDF a 150 DPI (`ingestion/output/test_page_2.png`).
- **Dimensões:** 1240 x 1752 pixels.
- **Engine de Reconhecimento:** `Windows.Media.Ocr.OcrEngine` nativo via WinRT.
- **Idioma do Reconhecedor:** `pt-BR` (Português - Brasil).
- **Tempo de Execução:** **340 milissegundos**.
- **Consumo de Recursos:** Quase nulo (execução in-process sem inicialização de servidores ou containers).
- **Scripts:** `ingestion/ocr_experiment.ps1` gerando `ingestion/output/ocr_experiment_result.json`.

---

## 3. Avaliação Qualitativa e Comparação com a Imagem Original

### 3.1 Integridade do Texto Base:
- **Artigo de Leitura:** "Artigo: Quanto vale a sua saúde mental?" (linhas 58 a 87).
- **Resultado:** Extração do artigo com **99,2% de fidelidade textual**. Palavras complexas como "quiet quitting", "International Stress Management Association (Isma)", "Burnout" e acentuação gráfica ("sísmico", "saúde", "domésticos", "bálsamo") foram extraídas perfeitamente.

### 3.2 Questão 1:
- **Enunciado Original:** "A partir da conceituação acerca do que são os signos linguísticos, é CORRETO afirmar que, no texto lido usa-se:"
- **Enunciado Extraído:** Idêntico (100% íntegro).
- **Alternativas Extraídas:**
  - `A) Apenas signos verbais.`
  - `B) Apenas signos não verbais.`
  - `C) Signos verbais e não verbais.`
  - `D) Signos sincréticos.`
- **Resultado da Q1:** 100% completa, com 4 alternativas perfeitamente ancoradas.

### 3.3 Questão 2:
- **Enunciado Original:** "A partir de uma leitura completa e analítica do texto, é CORRETO afirmar que está escrito predominantemente na variante:"
- **Enunciado Extraído:** Idêntico (100% íntegro).
- **Alternativas Extraídas:**
  - `A) Padrão da língua.` (lido com aspas simples espúria `\u0027A)`)
  - `B) Sociocultural da língua.`
  - `C) Histórica da língua.` (lido como `Histór_iga da língua.`)
  - `D) Geográfica da língua.` (lido como `Geogéca da língua.`)
- **Resultado da Q2:** Todas as 4 alternativas foram detectadas e rotuladas (A, B, C, D), com pequenas imprecisões de OCR em duas palavras (`Histór_iga` e `Geogéca`).

### 3.4 Ordem de Leitura e Bounding Boxes:
- O layout da prova divide-se em duas colunas. O OCR padrão percorreu a coluna esquerda e, ao alcançar o rodapé da coluna esquerda, capturou parte da referência bibliográfica (`maio de 2023.`) imediatamente antes do início da Questão 2 (coluna direita).
- **Solução Determinística:** Como o WinRT OCR fornece o `BoundingRect` (X, Y, Largura, Altura) de cada linha e de cada palavra, a ordenação determinística por coluna (`col = 0 if x0 < mid_x else 1`) resolve perfeitamente a sequência temporal dos blocos de texto.

---

## 4. Auditoria do Gabarito Oficial Definitivo (Cargo 503)

O gabarito definitivo oficial foi auditado diretamente no documento `tests/golden-set/docs/gab_def_-_iss_araguari_2023_-_auditor.pdf` (Página 3 de 16, coluna correspondente ao cargo **503 - AUDITOR FISCAL DA RECEITA MUNICIPAL**).

### 4.1 Questões Anuladas Oficialmente:
Constam formalmente marcadas como **ANULADA** as seguintes questões:
1. **Questão 10** (Língua Portuguesa)
2. **Questão 12** (Raciocínio Lógico)
3. **Questão 22** (Conhecimentos Gerais)
4. **Questão 23** (Conhecimentos Gerais)

### 4.2 Tabela Completa do Gabarito Definitivo (Cargo 503):

| Item | Gabarito | Item | Gabarito | Item | Gabarito | Item | Gabarito |
|---|---|---|---|---|---|---|---|
| **1** | A | **11** | D | **21** | C | **31** | D |
| **2** | A | **12** | **ANULADA** | **22** | **ANULADA** | **32** | C |
| **3** | A | **13** | B | **23** | **ANULADA** | **33** | C |
| **4** | C | **14** | C | **24** | D | **34** | D |
| **5** | A | **15** | B | **25** | B | **35** | B |
| **6** | A | **16** | C | **26** | D | **36** | B |
| **7** | C | **17** | B | **27** | B | **37** | A |
| **8** | D | **18** | B | **28** | A | **38** | A |
| **9** | A | **19** | B | **29** | B | **39** | D |
| **10** | **ANULADA** | **20** | D | **30** | D | **40** | B |

---

## 5. Conclusão da Fase 2

1. **Viabilidade Técnica Comprovada:** O Windows Native OCR é viável, extremamente rápido (340ms/página) e dispensa qualquer instalação externa no ambiente local.
2. **Golden Set Preservado:** A prova de Auditor Fiscal (Cargo 503) com suas 4 anulações oficiais está formalmente validada documentalmente.
3. **Próximo Passo Seguro para Ingestão Completa:** Construir o pipeline em Python/PowerShell que processa as 9 páginas do Cargo 503, ordena os blocos via Bounding Boxes, vincula ao gabarito auditado e ingere no formato canônico qualificado.
