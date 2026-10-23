# Especificação de Desenhos Experimentais Individuais (N-de-1)
# FiscalStudy Analytics

> **Documento:** `docs/N_OF_1_EXPERIMENTATION_SPECIFICATION.md`  
> **Versão do Documento:** 1.0.0  
> **Status:** Especificação Científica e Ética para Ensaios Controlados de Aprendizagem Individual  
> **Princípio Central Inviolável:** A preparação do estudante para o concurso público de Auditor Fiscal tem primazia ética absoluta sobre qualquer coleta de dados experimentais. Não é permitido aplicar métodos degradados ou placebos que sacrifiquem o rendimento do usuário.

---

## 1. Fundamentos Científicos do Desenho N-de-1 (Single-Case)

Em contextos educacionais individualizados, ensaios clínicos randomizados de grupo (com milhares de alunos) são inaplicáveis ou irrelevantes para a tomada de decisão adaptativa de um estudante singular. Métodos N-de-1 (*Single-Case Experimental Designs* — SCED) fornecem validade interna robusta quando estruturados com rigor metrológico.

### 1.1 Premissas Científicas
1. **O estudante atua como seu próprio controle:** Comparações são realizadas intra-sujeito entre blocos pareados de tópicos equivalentes de uma mesma disciplina.
2. **Alternância Contrabalançada (ATD — Alternating Treatments Design):** Duas estratégias ativas com forte suporte prévio na literatura de ciências cognitivas (ex: Prática Espaçada vs Feedback Elaborativo Contrastivo) são alternadas entre tópicos irmãos.
3. **Sem Braço de Controle Negativo:** Não se testa "ausência de estudo" ou "leitura passiva propositalmente ineficiente"; comparam-se variantes ativas de alto rendimento para descobrir qual produz melhor retenção no perfil específico daquele estudante.

---

## 2. Hipóteses Experimentais Testáveis

### Hipótese A: Retenção Espaçada em Regras Literais
- **Enunciado:** Para conteúdos com alta densidade de prazos, alíquotas e prescrições literais (ex: CTN arts. 150 a 174), a estratégia de *Recuperação Ativa Espaçada* (duas revisões com intervalos de 48h e 7 dias) produz acurácia em itens inéditos significativamente superior à *Revisão Comentada Massificada* (leitura densa com resolução imediata no mesmo dia).
- **Justificativa Teórica:** Efeito de espaçamento (*spacing effect* de Cepeda et al., 2006) e efeito de teste (*testing effect* de Roediger & Karpicke, 2006).

### Hipótese B: Feedback Contrastivo em Superconfiança Jurisprudencial
- **Enunciado:** Para tópicos de jurisprudência e súmulas vinculantes com pegadinhas conceituais recorrentes, a intervenção de *Análise Contrastiva Imediata* (exibição de por que o distrator plausível difere da tese fixada pelo tribunal) reduz a reincidência de erros com superconfiança em maior proporção do que a simples exibição do gabarito oficial com transcrição literal da tese.
- **Justificativa Teórica:** Eliminação de equívocos consolidados (*misconception refutation text* de Tippett, 2010).

---

## 3. Protocolo Experimental e Variáveis

### 3.1 Variáveis
- **Variável Independente ($X$):** Estratégia pedagógica de revisão atribuída ao tópico pareado ($E_A$ vs $E_B$).
- **Variável Dependente Primária ($Y_1$):** Taxa de acertos em itens inéditos do tópico ($k_{\text{inédito}} / n_{\text{inédito}}$) em teste cego após intervalo de maturação de 7 a 14 dias.
- **Variáveis Dependentes Secundárias ($Y_2, Y_3$):**
  - Calibração metacognitiva (Brier Score no pós-teste).
  - Tempo mediano de resolução (segundos ativos de tela).
- **Variáveis de Controle e Confundimento:**
  - Dificuldade dos itens (controlada por equiparação de banca examinadora e ano).
  - Fadiga do estudante (balanceamento de turnos manhã/tarde/noite e posição na sessão).
  - Histórico prévio de acertos no tópico antes do bloco de estudo.

### 3.2 Critérios de Inclusão e Emparelhamento de Tópicos
1. Ambos os tópicos pertencem à mesma disciplina (ex: Direito Tributário).
2. Cada tópico possui catálogo de pelo menos 10 questões inéditas não respondidas.
3. Taxa inicial de acerto nos itens de linha de base difere por menos de 15 pontos percentuais entre os tópicos do par.

---

## 4. Procedimentos de Comparação Estatística

1. **Testes de Permutação / Randomization Tests (Edgington & Onghena):**
   - Dados seriais de um único estudante apresentam autocorrelação temporal, invalidando pressupostos clássicos de testes t de Student ou ANOVA.
   - O teste de permutação calcula a distribuição exata da estatística de teste sob a hipótese nula de indiferença de alocação de blocos.
2. **Índice Não-Paramétrico Tau-U (Parker et al., 2011):**
   - Quantifica a proporção de não-sobreposição entre as fases ou tratamentos, controlando pela tendência de tendência linear da linha de base ($Tau-U \in [-1, +1]$).
3. **Tamanho de Efeito e Intervalo de Confiança:**
   - Efeito medido por $d$ não-paramétrico com intervalo de confiança a 95% via bootstrap de blocos.

---

## 5. Riscos Estatísticos e Mitigações Científicas

| Risco Estatístico | Mecanismo de Interferência | Mitigação Obrigatória |
|---|---|---|
| **Autocorrelação Temporal** | Respostas em sessões consecutivas são correlacionadas serialmente. | Uso de testes de permutação e modelagem de resíduos com termo autorregressivo AR(1). |
| **Efeito de Transferência (Carryover)** | O aprendizado do tópico A contamina a resposta no tópico B. | Emparelhamento de micro-tópicos conceituais independentes sem interdependência direta. |
| **Regressão à Média** | Tópicos errados tendem a melhorar casualmente em nova tentativa. | A avaliação de desfecho utiliza exclusivamente **questões inéditas** do mesmo tópico, nunca a mesma questão repetida. |
| **Fadiga / Ordem Temporal** | A segunda atividade de uma sessão pode sofrer com menor energia mental. | Ordem de aplicação contrabalanceada (AB em uma semana, BA na semana seguinte). |

---

## 6. Condições de Interrupção Ética e Critérios de Inconclusividade

### 6.1 Condições de Interrupção Imediata (Safety Stopping Rules)
1. **Déficit Significativo de Desempenho:** Se uma das estratégias apresentar acurácia inferior à linha de base por $\ge 20$ pontos percentuais em 3 blocos consecutivos, o experimento é sumariamente interrompido e o tópico é revertido para o método consolidado.
2. **Proximidade de Concurso:** Faltando menos de 30 dias para a data prevista da prova oficial do estudante, quaisquer testes comparativos são suspensos para garantir dedicação irrestrita ao cronograma padrão livre.
3. **Fadiga ou Desmotivação Declarada:** Sinalização explícita de sobrecarga interrompe o desenho.

### 6.2 Critérios para Declarar uma Hipótese INCONCLUSIVA
Uma comparação entre estratégias é classificada obrigatoriamente como `INCONCLUSIVE_HYPOTHESIS` quando:
- O valor de $p$ do teste de permutação for superior a $0.10$.
- O intervalo de confiança de 95% do tamanho de efeito contiver o valor zero.
- O volume total de pares completados for inferior a 6 blocos pareados ($N < 6$).
- **Regra inviolável:** É proibido declarar superioridade pedagógica sem suporte estatístico que ultrapasse o ruído natural de amostragem.
