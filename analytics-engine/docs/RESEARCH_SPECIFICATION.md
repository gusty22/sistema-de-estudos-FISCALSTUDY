# Especificação de Pesquisa e Modelagem Futura
# FiscalStudy Analytics

> **Documento:** `docs/RESEARCH_SPECIFICATION.md`  
> **Versão:** 2.0.0 (Revisão Científica e Critérios Específicos de Viabilidade)  
> **Status:** Especificação Científica para Modelagens Estatísticas, Psicométricas e Adaptativas  
> **Regra Fundamental:** Modelos complexos não devem ser treinados ou promovidos a decisores adaptativos sem critérios de viabilidade matematicamente comprovados, controle de identificabilidade paramétrica e superioridade empírica demonstrada sobre referências (baselines) simples.

---

## 1. Princípios Gerais de Seleção e Avaliação de Modelos

1. **Eliminação de Exigências Universais Arbitrárias:**
   - O volume amostral necessário não é uma constante universal abstrata (ex: "sempre N = 500"), mas uma função direta do número de parâmetros livres a estimar, da identificabilidade estrutural do modelo e do nível de ruído dos dados.
2. **Prioridade para Baselines Simples e Interpretáveis:**
   - Nenhum modelo preditivo complexo é justificado se não superar com significância estatística ($p < 0.05$) uma referência basal simples (como a taxa empírica de acertos com IC de Wilson, a média móvel exponencial ou a seleção round-robin).
3. **Não Proliferação de Complexidade sem Dados:**
   - Não se ajustam redes neurais, modelos com dezenas de coeficientes ou cadeias markovianas densas sobre históricos curtos de estudantes.
   - Quando as condições de viabilidade não forem satisfeitas, o sistema emite explicitamente `INSUFFICIENT_EVIDENCE` e recorre aos estimadores basais não-paramétricos.

---

## 2. Família 1: Regressão Logística de Probabilidade de Acerto

### 2.1 Pergunta de Pesquisa
Quais fatores observáveis do estudante (tempo ativo de resolução, nível de confiança declarado, disciplina da questão e histórico de exposição prévia) explicam e predizem a probabilidade de acerto em uma tentativa?

### 2.2 Variável de Resultado
$Y \in \{0, 1\}$ (variável binária observada: 0 = erro, 1 = acerto na questão).

### 2.3 Dados Necessários
- Identificador da tentativa e da questão (`event_id`, `question_id`).
- `active_time_ms` (transformação logarítmica: $\log(\text{tempo})$ para estabilizar assimetria).
- `confidence_level` (escala ordinal 1 a 5).
- `disciplina` (fator categórico).
- `attempt_sequence` (tentativa inicial vs repetição $k > 1$).

### 2.4 Hipóteses do Modelo
- A função de ligação logit $\log\left(\frac{p}{1-p}\right) = \beta_0 + \sum \beta_j X_j$ relaciona monotonicamente as covariáveis com a razão de chances.
- Ausência de colinearidade severa entre preditores ($VIF < 5.0$).

### 2.5 Riscos de Confundimento
- **Viés de seleção de questões:** Disciplinas com itens difíceis podem aparentar menor proficiência.
- **Não-linearidade temporal:** Tempos extremos (chute rápido ou bloqueio prolongado) associados a menor taxa de acerto.

### 2.6 Critérios de Viabilidade Específicos
- **Viabilidade Padrão (MLE):** Mínimo de 10 a 15 eventos da classe minoritária ($\min(\sum Y, \sum (1-Y))$) por preditor livre estimado.
- **Viabilidade com Pequenas Amostras ($N < 50$ ou eventos raros):** Utilizar obrigatoriamente regressão logística penalizada de Firth (*penalized likelihood*) ou priors informativos de contração (*shrinkage*), restringindo o modelo a no máximo 2 preditores principais ($\log(\text{tempo})$ e `confidence_level`).
- **Inviabilidade:** Se $\min(\text{erros}, \text{acertos}) < 5$, o modelo é declarado inviável.

### 2.7 Modelo de Referência Simples (Baseline)
Modelo nulo (intercept-only): probabilidade constante igual à taxa observada com IC de Wilson ($\hat{p} = \bar{Y}$).

### 2.8 Procedimento de Avaliação
- Validação temporal (*time-series split* ou *rolling origin*) 80% treino / 20% teste.
- Métricas: Brier Score, AUC-ROC e teste de calibração Hosmer-Lemeshow.

### 2.9 Critérios de Aceitação e Rejeição
- **Aceitação:** $\text{AUC-ROC} \ge 0.70$ no conjunto de teste e Brier Score estatisticamente inferior ao baseline ($p < 0.05$).
- **Rejeição:** AUC no teste inferior a 0.60 ou sobreajuste extremo ($\Delta \text{AUC}_{\text{treino}-\text{teste}} > 0.20$).

---

## 3. Família 2: Bayesian Knowledge Tracing (BKT)

### 3.1 Pergunta de Pesquisa
Como o estado latente de conhecimento binário ($L \in \{0, 1\}$) do estudante sobre um conceito específico evolui a cada oportunidade sequencial de prática?

### 3.2 Variável de Resultado
Série temporal binária de acertos e erros no mesmo conceito ($Y_t \in \{0, 1\}$).

### 3.3 Dados Necessários
- Mapeamento unívoco questão $\to$ micro-habilidade/conceito (*Q-matrix* validada).
- Sequência temporal de pelo menos 5 oportunidades de aplicação do mesmo conceito.

### 3.4 Hipóteses do Modelo
- O conhecimento é um estado latente binário (não dominado $L=0$, dominado $L=1$).
- Quatro parâmetros por micro-habilidade:
  1. $P(L_0)$: probabilidade a priori de domínio.
  2. $P(T)$: probabilidade de transição (aprendizagem a cada tentativa).
  3. $P(G)$: probabilidade de adivinhação (*guess*).
  4. $P(S)$: probabilidade de escorregão (*slip*).

### 3.5 Riscos de Confundimento e Degenerescência
- **Identificabilidade dos parâmetros:** Risco severo de *degeneracy* matemática, onde $P(G) + P(S) \ge 1.0$, invertendo o sentido pedagógico do modelo.
- **Granularidade da habilidade:** Se aplicada a disciplinas amplas em vez de regras pontuais, o pressuposto de estado latente homogêneo é categoricamente falso.

### 3.6 Critérios de Viabilidade Específicos
- **Viabilidade:** Taxonomia granular de tópicos disponível, restrições obrigatórias de domínio ($P(G) \le 0.30$ em questões de 5 alternativas, $P(S) \le 0.20$, $P(G) + P(S) < 0.50$) e pelo menos 5 tentativas observadas na mesma micro-habilidade.
- **Inviabilidade:** Tópicos genéricos não-especificados ou histórico $< 5$ tentativas no conceito.

### 3.7 Modelo de Referência Simples (Baseline)
Média móvel exponencial (EMA com $\alpha = 0.30$) dos últimos 3 a 5 resultados observados na micro-habilidade.

### 3.8 Procedimento de Avaliação e Critérios
- Predição *one-step-ahead* ($Y_{t+1}$ dado histórico até $t$).
- Brier Score e Log-Loss. Rejeitar BKT se parâmetros convergirem para os limites impostos ou se não superar o Brier da EMA.

---

## 4. Família 3: Teoria da Resposta ao Item (IRT — Rasch / 1PL / 2PL)

### 4.1 Pergunta de Pesquisa
Qual é o nível de proficiência latente do estudante ($\theta$) na escala da disciplina, controlando pela dificuldade ($b_i$) e poder de discriminação ($a_i$) dos itens?

### 4.2 Variável de Resultado
Matriz de respostas aos itens $Y_{u, i} \in \{0, 1\}$.

### 4.3 Dados Necessários
- Dificuldades dos itens ($b_i$) ancoradas de bancos normativos históricos OU matriz de respostas calibrada.
- Sequência de respostas do estudante na escala unificada.

### 4.4 Hipóteses do Modelo
- Unidimensionalidade dominante da escala de avaliação.
- Independência local dos itens condicional a $\theta$.
- Curva Característica do Item: $P(Y_i = 1 | \theta) = \frac{1}{1 + e^{-a_i (\theta - b_i)}}$.

### 4.5 Riscos de Confundimento
- **Impossibilidade Matemática de Calibração Concomitante Unilateral:** É categoricamente impossível estimar simultaneamente a proficiência do usuário e a dificuldade de centenas de itens inéditos com dados de apenas 1 estudante (indeterminação de escala de Neyman-Scott).

### 4.6 Critérios de Viabilidade Específicos
- **Cenário A (Itens com Dificuldade Conhecida/Ancorada a Priori):**
  - **Viabilidade:** Se os parâmetros $b_i$ forem fornecidos previamente pelo catálogo oficial de concursos ou estatísticas de banca, a proficiência $\theta$ do estudante pode ser confiavelmente estimada via Máxima Verossimilhança ou EAP Bayesiano com apenas **15 a 25 itens respondidos**, alcançando erro padrão de mensuração condicional $SE(\theta) \le 0.40$.
- **Cenário B (Calibração Conjunta de Itens Inéditos sem Ancoragem):**
  - **Inviabilidade:** Declarado estritamente inviável no ambiente individual sem amostras normativas de centenas de respondentes por item. Utilizar Teoria Clássica dos Testes (TCT: proporção de acertos com IC de Wilson).

### 4.7 Modelo de Referência Simples (Baseline)
Proporção clássica de acertos observados ponderada por pesos declarados de banca ($TCT = \sum Y_i / K$).

### 4.8 Critérios de Aceitação e Rejeição
- **Aceitação:** Erro padrão $SE(\theta) \le 0.40$ na faixa central $[-1, +1]$; resíduos Infit/Outfit dentro da faixa $[0.7, 1.3]$.
- **Rejeição:** Violação severa de ajuste do modelo ou tentativa espúria de estimar parâmetros de itens a partir de um único usuário.

---

## 5. Família 4: Modelos de Retenção e Curvas de Esquecimento

### 5.1 Pergunta de Pesquisa
Qual modelo funcional de esquecimento (Decaimento Exponencial $R(t) = e^{-t/S}$ vs Lei de Potência $R(t) = (1 + \alpha t)^{-\beta}$ vs Modelo com Assíntota Residual $R(t) = c + (1-c)e^{-t/S}$) melhor descreve a probabilidade empírica de recuperação ao longo do tempo?

### 5.2 Variável de Resultado
Probabilidade observada de acerto na repetição $R(\Delta t) \in [0, 1]$ em função do atraso temporal decorrido $\Delta t$.

### 5.3 Dados Necessários
- Repetições de itens com registros precisos de timestamps.
- Dispersão longitudinal de intervalos temporais.

### 5.4 Riscos de Confundimento
- **Efeito de teste (*testing effect*):** A repetição sucessiva aumenta a estabilidade da memória ($S$).
- **Heterogeneidade de dificuldade:** Itens fáceis decaem mais lentamente que itens complexos.

### 5.5 Critérios de Viabilidade Específicos
- **Viabilidade:** Presença de repetições em pelo menos **3 faixas temporais distintas** (ex: $< 24\text{h}$, $1\text{ a }7\text{ dias}$, $> 7\text{ dias}$), com no mínimo **5 observações por faixa temporal** ($N_{\text{repetições}} \ge 15$ bem distribuídas).
- **Inviabilidade:** Repetições concentradas em um único dia ou em uma única faixa horária. Nesses casos, utilizar taxa empírica de retenção tabular por faixa sem extrapolação paramétrica.

### 5.6 Modelo de Referência Simples (Baseline)
Taxa constante de retenção média em repetições ($\hat{R} = \bar{Y}_{\text{repetições}}$).

### 5.7 Critérios de Aceitação e Rejeição
- **Aceitação:** Redução estatisticamente significativa do AIC ($\Delta AIC > 4.0$) em relação ao modelo de retenção constante e parâmetro de estabilidade $S > 0$.
- **Rejeição:** Curva plana, gradiente nulo ou inclinação espúria positiva decorrente de viés de seleção de itens fáceis em revisões tardias.

---

## 6. Família 5: Modelos de Recomendação Ótima da Próxima Ação

### 6.1 Pergunta de Pesquisa
Qual política de recomendação adaptativa (baseada em *Desafio Cognitivo Ótimo* na Zona de Desenvolvimento Proximal — ZPD, com probabilidade estimada de sucesso entre 70% e 80%) maximiza a consolidação da aprendizagem em comparação à seleção sequencial ou estocástica por disciplina?

### 6.2 Variável de Resultado
Ganho de retenção em testes cegos com itens inéditos e eficiência temporal de estudo.

### 6.3 Dados Necessários
- Estimativas confiáveis de proficiência ou acurácia por tópico com IC definido.
- Catálogo de questões com pelo menos 10 itens inéditos por tópico prioritário.

### 6.4 Hipóteses do Modelo
- Itens excessivamente triviais ($p > 0.95$) geram redundância sem ganho mnemônico duradouro.
- Itens de extrema dificuldade ($p < 0.40$) sem base consolidada geram bloqueio e sobrecarga.
- A faixa de desafio ótimo situa-se entre 70% e 80% de chance de acerto.

### 6.5 Critérios de Viabilidade Específicos
- **Viabilidade:** Tópico com pelo menos 10 questões inéditas cadastradas e sinal analítico ativo indicando necessidade de estudo (ex: `SIG_RECURRENT_ERROR`, `SIG_INSUFFICIENT_EVIDENCE` ou `SIG_RETENTION_DECAY`).
- **Inviabilidade:** Catálogo esgotado no tópico ($< 3$ questões inéditas) ou ausência de dados de disciplina/assunto. Nesses casos, manter seleção de catálogo sequencial padrão.

### 6.6 Modelo de Referência Simples (Baseline)
Seleção sequencial ou round-robin entre disciplinas (mecanismo determinístico da V1).

### 6.7 Critérios de Aceitação e Rejeição
- **Aceitação:** Aumento demonstrado na retenção em pós-testes com itens inéditos ($p < 0.05$) em ensaio N-de-1 contrabalanceado.
- **Rejeição:** Aumento no tempo de resposta com quebra de calibração ou sequências de frustração repetida ($> 3$ erros consecutivos em itens recomendados).

---

## 7. Matriz Sintética de Decisão de Modelagem

| Família de Modelos | Cenário de Viabilidade | Baseline Obrigatório | Critério de Rejeição Imediata |
|---|---|---|---|
| **Regressão Logística** | $\min(\text{erros}, \text{acertos}) \ge 10 \times p$ (MLE) ou $N \ge 20$ com Firth/Priors e $p \le 2$ | Proporção média histórica ($\bar{Y}$) | $\text{AUC-teste} < 0.60$ ou falha severa Hosmer-Lemeshow |
| **BKT** | Q-matrix granular validada e $\ge 5$ oportunidades na micro-habilidade | Média móvel exponencial (EMA $\alpha=0.3$) | $P(G) > 0.30$, $P(S) > 0.20$ ou degenerescência |
| **IRT (1PL/Rasch)** | Parâmetros de itens ($b_i$) conhecidos/ancorados e $\ge 15$ itens respondidos | Proporção TCT clássica ponderada | Tentativa de calibrar itens inéditos com único usuário |
| **Retenção Empírica** | Repetições distribuídas em $\ge 3$ faixas temporais com $n \ge 5$ por faixa | Taxa constante de retenção histórica | Sem dispersão de intervalos temporais ($\Delta AIC \le 4$) |
| **Recomendação Adaptativa** | Catálogo com $\ge 10$ itens inéditos e sinais analíticos ativos | Seleção round-robin determinística | Frustração repetida ($>3$ erros seguidos) ou catálogo esparso |
