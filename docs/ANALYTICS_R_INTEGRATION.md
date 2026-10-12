# Integração da Camada Analítica com R e Especificação de Modelos Futuros

> **Status:** Concluído e Validado em Ambiente Local (R 4.5.1 Base)  
> **Data:** 2026-10-12  
> **Escopo:** Fase 5 do FiscalStudy

---

## 1. Princípios Arquiteturais da Integração

1. **Desacoplamento Estrito:** A linguagem **R** atua como ambiente de experimentação, auditoria estatística e modelagem longitudinal. Ela **NÃO** é dependência em tempo de execução (*runtime dependency*) do backend Spring Boot nem do frontend React.
2. **Zero Dependências Pesadas:** O script principal utiliza exclusivamente o **R Base**, não exigindo instalação de bibliotecas pesadas (como `tidyverse`, `caret`, `rstan`, etc.) para operações descritivas e determinísticas.
3. **Imutabilidade e Segurança:** A exportação de dados é estritamente analítica e anonimizada. Não expõe senhas, chaves, dados pessoais ou segredos.
4. **Isolamento de Ambientes:** Testes automatizados do backend operam em banco isolado (`target/test-fiscalstudy.db`). A análise estatística consome o contrato analítico oficial.

---

## 2. Contrato de Dados (Exportação Analítica)

### Endpoint Oficial:
`GET /api/v1/analytics/export`  
**Content-Type:** `text/csv; charset=UTF-8`  
**Content-Disposition:** `attachment; filename="fiscalstudy_attempts.csv"`

### Estrutura do Esquema de Dados:

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `question_id` | String | Identificador canônico da questão | `"1"` ou `"ibgp-2023-auditor-q1"` |
| `selected_option` | String | Alternativa selecionada pelo estudante | `"A"` |
| `is_correct` | Boolean / NA | Resultado da tentativa (NA se gabarito ausente) | `true`, `false`, `NA` |
| `gabarito_status` | String | Status do gabarito oficial | `"DEFINITIVO"`, `"PRELIMINAR"`, `"ANULADA"`, `"AUSENTE"` |
| `confidence_level` | Integer (1..5) | Nível subjetivo de certeza informado pelo estudante | `5` |
| `active_time_ms` | Long | Tempo em milissegundos com a tela em foco | `18500` |
| `discipline` | String | Disciplina do concurso | `"Direito Tributário"` |
| `board` | String | Banca examinadora | `"IBGP"` |
| `year` | Integer | Ano de realização da prova | `2023` |

---

## 3. Execução do Script R

### Localização:
`analytics/descriptive_analysis.R`

### Comando de Execução:
```powershell
& "C:\Program Files\R\R-4.5.1\bin\x64\Rscript.exe" analytics/descriptive_analysis.R analytics/sample_data.csv
```

### Capacidades Implementadas:
- Filtragem e expurgo determinístico de itens sem gabarito oficial do denominador de acurácia.
- Cálculo de Acurácia Global e estratificada por Disciplina.
- Média, Desvio Padrão e Mediana do tempo ativo de resolução.
- Tabela de Contingência (Nível de Confiança x Acerto/Erro).
- Curva Empírica de Calibração (acurácia observada para cada nível de confiança).
- Cálculo do **Brier Score** ($BS = \frac{1}{N} \sum (f_i - y_i)^2$) para quantificar a calibração probabilística do aluno.
- Detecção e contagem de **Overconfidence** (Confiança máxima 5 em erro — indicador crítico de falsa fluência) e **Underconfidence** (Confiança $\le 2$ em acerto — indício de chute ou insegurança).
- Emissão de advertências amostrais quando $N < 30$.

---

## 4. Avaliação Rigorosa de Famílias de Modelos Futuros

Em consonância com o princípio de não introduzir modelos prematuros sem volume e qualidade de dados suficientes, a seguir documenta-se o inventário técnico de modelos candidatos para fases posteriores:

### 4.1 Bayesian Knowledge Tracing (BKT)
- **Objetivo:** Rastrear a probabilidade latente $P(L_t)$ de que o estudante tenha dominado determinado conceito/assunto ao longo de uma sequência temporal de tentativas.
- **Parâmetros:**
  - $P(L_0)$: Domínio inicial a priori.
  - $P(T)$: Probabilidade de transição de não-aprendido para aprendido após prática.
  - $P(G)$: Probabilidade de acerto por chute (*Guess*).
  - $P(S)$: Probabilidade de erro por distração (*Slip*).
- **Dados Necessários:** Sequências temporais longas de tentativas associadas a nós de conhecimento (*Knowledge Components* / tags de micro-conteúdo) bem delimitados.
- **Requisitos de Volume:** Mínimo de 30 a 50 tentativas por estudante em cada habilidade específica para calibração estável.
- **Modelo de Referência Mais Simples:** Média móvel ponderada exponencial dos últimos 5 itens daquele assunto.
- **Riscos de Inferências Incorretas:** Com poucas observações, o BKT sofre de degeneração de parâmetros (*identifiability issue*, ex: $P(G) + P(S) \ge 1$), atribuindo falsamente domínio absoluto ou ignorando lacunas graves.

### 4.2 Teoria de Resposta ao Item (IRT / TRI)
- **Modelos:**
  - **1PL (Rasch):** Modela probabilidade de acerto unicamente pela proficiência do estudante $\theta$ e dificuldade do item $b_i$: $P(Y=1) = \frac{1}{1 + e^{-(\theta - b_i)}}$.
  - **2PL:** Acrescenta discriminação do item $a_i$.
  - **3PL:** Acrescenta parâmetro de pseudo-chute $c_i$.
- **Dados Necessários:** Matriz esparsa de respostas de múltiplos estudantes resolvendo o mesmo banco calibrado de itens.
- **Requisitos de Volume:**
  - Rasch/1PL: Mínimo de 200 a 500 resoluções por item.
  - 2PL/3PL: Mínimo de 1.000 resoluções por item com dezenas de respondedores.
- **Modelo de Referência Mais Simples:** Taxa empírica de acerto do item na amostra e acurácia histórica do estudante.
- **Riscos de Inferências Incorretas:** Em uso individual inicial (apenas 1 estudante), **calibrar IRT é matematicamente impossível** sem fixar os parâmetros de dificuldade dos itens a partir de dados históricos externos da banca. Tentar estimar $\theta$ e $b_i$ simultaneamente com um único usuário gera superajuste (*overfitting*) total e estimativas espúrias.

### 4.3 Modelos de Retenção Espaçada (FSRS / DHP)
- **Objetivo:** Estimar a probabilidade de recordação $R(t) = (1 + \text{factor} \cdot \frac{t}{S})^{-1}$ em função do tempo decorrido $t$ e da estabilidade de memória $S$.
- **Dados Necessários:** Histórico de repetições espaçadas com logs de intervalos de dias e classificação de esforço de recuperação (*again, hard, good, easy*).
- **Requisitos de Volume:** Requer dezenas de repetições do mesmo conceito ao longo de semanas/meses.
- **Modelo de Referência Mais Simples:** Leitão/SuperMemo clássico (SM-2 determinístico) com intervalos fixos multiplicativos (1d, 3d, 7d, 15d).
- **Riscos de Inferências Incorretas:** Assumir estabilidade alta sem testes de recuperação após 15+ dias confunde memória de curto prazo (recência) com retenção duradoura de longo prazo.

### 4.4 Análise Causal de Intervenções (MVT Loop)
- **Objetivo:** Avaliar se uma alteração no método de estudo (ex: leitura de teoria antes vs. estudo reverso por questões) causou melhoria real de retenção e acurácia.
- **Dados Necessários:** Dados de pré-teste, intervenção registrada como evento, e pós-teste pareado em contexto similar após intervalo de tempo controlado.
- **Modelo de Referência Mais Simples:** Comparação antes/depois de acurácia com teste de postos de Wilcoxon pareado.
- **Riscos de Inferências Incorretas:** Confundir efeito de regressão à média ou fadiga circadiana com eficácia pedagógica da intervenção.
