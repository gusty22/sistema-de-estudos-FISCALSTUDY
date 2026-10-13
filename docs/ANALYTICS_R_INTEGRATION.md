# Integração da Camada Analítica com R e Especificação de Modelos Futuros

> **Status:** Concluído e Validado em Ambiente Local (R 4.5.1 Base)  
> **Data:** 2026-10-12  
> **Escopo:** Fase 5 do FiscalStudy

---

---

## 1. Princípios Arquiteturais e Divisão de Responsabilidades

Existe um projeto independente denominado **`fiscalstudy-analytics`**, dedicado exclusivamente às análises estatísticas e psicométricas. Em conformidade com o princípio de responsabilidade única e para evitar duplicidade arquitetural, as fronteiras entre os projetos são estritamente delimitadas:

### 1.1 Responsabilidades do FiscalStudy (Repositório Principal)
- **Regras Operacionais:** Gerenciamento do ciclo de vida das sessões de estudo, seleção determinística de itens, apresentação CQRS e registro imutável no `event_store`.
- **Integridade e Consistência:** Validação estrutural de itens (`isStructurallyValid`), expurgo de anomalias, tratamento de gabaritos e separação rigorosa entre pontuação de concurso e acurácia pedagógica.
- **Projeções Determinísticas:** Agregações aritméticas em tempo real (tempo ativo, total respondido, taxa de acerto por sessão, detecção de overconfidence).
- **Provedor de Contratos:** Geração e disponibilização de logs anonimizados e contratos de exportação analítica.
- **Interface com o Usuário:** Aplicação web responsiva (React + TypeScript).

### 1.2 Responsabilidades do `fiscalstudy-analytics` (Projeto R Independente)
- **Modelagem Psicométrica e Estatística Avançada:** Teoria de Resposta ao Item (TRI/IRT 1PL/2PL/3PL), Bayesian Knowledge Tracing (BKT), calibração bayesiana, modelagem de curvas de esquecimento e estimação de traço latente $\theta$.
- **Exploração e Relatórios Analíticos:** Gráficos longitudinais, matrizes de correlação, análise fatorial e testes de hipóteses estatísticas.
- **Geração de Artefatos Calibrados:** Produção de parâmetros de calibração para posterior consumo determinístico pelo FiscalStudy.
- **Isolamento Total:** Nenhuma modificação é realizada no projeto R externo a partir deste repositório principal.

### 1.3 Registro de Sobreposições Evitadas
1. **Não Implementar Plataforma Analítica Duplicada no Repositório Principal:** O backend Java não deve incorporar motores de inferência psicométrica ou bibliotecas de estimação latente. Permanece 100% determinístico e pragmático.
2. **Escopo do Script Local em R (`analytics/descriptive_analysis.R`):** Mantido exclusivamente como teste de integração do contrato de exportação (smoke test determinístico com R Base), sem evoluir para um segundo motor analítico concorrente.
3. **Desacoplamento em Runtime:** O FiscalStudy operacional nunca executa scripts em R de maneira síncrona nem depende de sua execução para operar as sessões do estudante.

---

## 2. Contratos Formais de Integração

### Contrato A: Exportação de Tentativas para o `fiscalstudy-analytics` (Data Lake Analítico)
- **Endpoint Principal:** `GET /api/v1/analytics/export[?origin=REAL_STUDY|ALL]`  
- **Endpoint do Manifesto:** `GET /api/v1/analytics/export/manifest[?origin=REAL_STUDY|ALL]`  
- **Formato:** `text/csv; charset=UTF-8`  
- **Cabeçalho Content-Disposition:** `attachment; filename="fiscalstudy_attempts.csv"`
- **Garantias do Contrato:**
  - Imutabilidade histórica garantida pelo `event_store` append-only.
  - Expurgo estrito de itens anulados e sem gabarito oficial do denominador de acurácia pedagógica (`is_correct = NA`).
  - Campo `gabarito_status` explicita o estado do gabarito oficial (`DEFINITIVO`, `PRELIMINAR`, `RETIFICADO`, `ANULADA`, `AUSENTE`, `SOB_REVISAO`).
  - Campo `concurso_point` reflete a pontuação oficial do edital (1 para acerto válido ou item anulado; 0 para erro ou item sem gabarito).
  - Cadeia de custódia temporal preservada com `occurred_at` (ISO-8601 UTC) e `session_id` reais do banco SQLite, sem invenção de datas artificiais.
  - Segregação de proveniência (`origin_type`): `REAL_STUDY` (estudo efetivo do aluno), `AUTOMATED_TEST` (testes automatizados), `DEMONSTRATION` (amostras ilustrativas) e `UNVERIFIED_HISTORICAL` (registros legados sem comprovação). Não há atribuição retroativa fictícia de autenticidade.
  - Manifesto estruturado em JSON com integridade criptográfica SHA-256 de arquivo, contagens, critérios de inclusão/exclusão e declaração expressa de limitações de rastreabilidade (sistema local pessoal sem assinatura digital centralizada).

### Contrato B: Ingestão de Parâmetros Calibrados (Futuro)
- Caso o `fiscalstudy-analytics` calibre parâmetros de dificuldade ($b_i$) ou discriminação ($a_i$), a comunicação com o FiscalStudy dar-se-á exclusivamente via arquivos estáticos versionados (`calibrated_parameters_v1.json`), consumidos de modo somente-leitura.

### Detalhamento do Esquema da Exportação Analítica (Contrato A):
- **Endpoint Oficial:** `GET /api/v1/analytics/export`  
- **Content-Type:** `text/csv; charset=UTF-8`  
- **Content-Disposition:** `attachment; filename="fiscalstudy_attempts.csv"`

### Estrutura do Esquema de Dados:

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `question_id` | String | Identificador canônico da questão | `"1"` ou `"ibgp-2023-tecnico-q1"` |
| `selected_option` | String | Alternativa selecionada pelo estudante | `"A"` |
| `is_correct` | Boolean / NA | Resultado pedagógico da tentativa (NA se gabarito ausente ou anulada) | `true`, `false`, `NA` |
| `gabarito_status` | String | Status do gabarito oficial | `"DEFINITIVO"`, `"PRELIMINAR"`, `"ANULADA"`, `"AUSENTE"`, `"SOB_REVISAO"` |
| `confidence_level` | Integer (1..5) | Nível subjetivo de certeza informado pelo estudante | `5` |
| `active_time_ms` | Long | Tempo ativo de tela em foco na resolução, em milissegundos | `18500` |
| `discipline` | String | Disciplina do concurso | `"Direito Tributário"` |
| `board` | String | Banca examinadora | `"IBGP"` |
| `year` | Integer | Ano de realização da prova | `2023` |
| `topic` | String / NA | Tópico/assunto específico | `"Imunidades"` ou `"NA"` |
| `assunto` | String / NA | Espelho do tópico para consumo direto pelo adaptador R | `"Imunidades"` ou `"NA"` |
| `orgao` | String / NA | Órgão demandante da prova | `"Prefeitura de Araguari"` ou `"NA"` |
| `cargo` | String / NA | Cargo do concurso | `"Auditor Fiscal"` ou `"NA"` |
| `event_id` | String | Identificador UUID único e imutável do evento de tentativa | `"e7a1b2c3-..."` |
| `session_id` | String | Identificador da sessão de estudo | `"sess-2026-10-13-01"` |
| `occurred_at` | String | Timestamp ISO-8601 UTC exato de ocorrência no cliente | `"2026-10-13T10:15:30Z"` |
| `origin_type` | String | Classificação formal de proveniência | `"REAL_STUDY"`, `"AUTOMATED_TEST"`, `"DEMONSTRATION"`, `"UNVERIFIED_HISTORICAL"` |
| `concurso_point` | Integer (0..1) | Pontuação formal de concurso conforme regras de edital | `1` ou `0` |

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
