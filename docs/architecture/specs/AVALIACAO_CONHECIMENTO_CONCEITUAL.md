# Especificação Técnica: Avaliação de Conhecimento Conceitual e Taxonomia de Variantes

> **Documento:** `docs/architecture/specs/AVALIACAO_CONHECIMENTO_CONCEITUAL.md`  
> **Status:** ESPECIFICAÇÃO CONCEITUAL / PROPOSTA ARQUITETURAL  
> **Versão:** 1.1.0 (Wave 1 Estabilizada)  
> **Autor:** Orquestrador Técnico (FiscalStudy Multiagent Architecture)  
> **Princípio Reitor:** Preservação estrita do algoritmo FSRS oficial; desacoplamento entre modelo de repetição espaçada e modelo de domínio conceitual; segregação tripartite entre fatos observados, inferências do modelo e hipóteses pedagógicas.

---

## 1. Desacoplamento Arquitetural: FSRS vs. Domínio Conceitual

O FiscalStudy adota o princípio de **separação estrita de responsabilidades cognitivas**:

### 1.1. Motor FSRS (Free Spaced Repetition Scheduler — Versão 4.5)
- **Versão Exata Implementada:** **FSRS-4.5** (implementado em `com.fiscalstudy.backend.domain.fsrs.FsrsEngine`).
- **Testes de Referência Correspondentes:** `FsrsReferenceConformanceTest` e `FSRSTest`, que validam a fidelidade contra os 17 parâmetros oficiais da formulação canônica do FSRS-4.5.
- **Objeto de Modelagem:** Estabilidade ($S$), Dificuldade ($D$) e Recuperabilidade ($R$) de itens específicos de memória na repetição espaçada.
- **Regra de Ouro Inegociável:** O FSRS oficial **NÃO pode ser modificado** com fatores de transferência ($S \times f_{transfer}$) ou pesos arbitrários de variantes. Seu código permanece puramente determinístico e em conformidade matemática estrita.
- **Entrada do FSRS:** Nota de recordação discreta ($G \in \{1, 2, 3, 4\}$: Again, Hard, Good, Easy) e intervalo decorrido ($\Delta t$).

### 1.2. Camada de Diagnóstico Conceitual (Cognitive Mastery)
- **Objeto de Modelagem:** Avaliação de proficiência temática do estudante em disciplinas jurídicas, contábeis e fiscais.
- **Localização:** Camada de serviço externa (`StudentKnowledgeStateService`), completamente desacoplada do agendador FSRS.
- **Não Introdução de Algoritmos Não-Autorizados:** Fica terminantemente proibida a introdução de redes bayesianas complexas, novos scores sintéticos ou algoritmos cognitivos especulativos nesta fase.

---

## 2. Segregação Tripartite Epistêmica

Para garantir rigor científico e rastreabilidade nos logs e relatórios, toda informação do sistema pertence a uma e apenas uma das três categorias:

```
[1. EVIDÊNCIA OBSERVADA]  --->  [2. ESTIMATIVA DO MODELO]  --->  [3. HIPÓTESE PEDAGÓGICA]
(Fatos Brutos Auditáveis)       (Inferências Estatísticas)         (Prescrições & Ações)
```

1. **Evidência Observada (Fatos Brutos Auditáveis):**
   - Dados gravados imutavelmente no `event_store` com carimbo de tempo.
   - Exemplos: `attemptId`, `questionId`, `timestamp`, `isCorrect` ($\in \{true, false, null\}$), alternativa selecionada, tempo ativo (`activeTimeMs`), nível de confiança ordinal informado pré-gabarito ($1$ a $5$), causa de erro anotada (`attempt_annotations`).
2. **Estimativa do Modelo (Inferências Matemáticas/Estatísticas):**
   - Valores calculados pelas formulações declaradas a partir dos fatos observados.
   - Exemplos: Estabilidade $S$ e Retentabilidade $R$ (do FSRS-4.5), Dificuldade $D$, Taxa de acerto acumulada no tópico, Brier Score de calibração de confiança.
3. **Hipótese Pedagógica (Prescrições e Regras de Estudo):**
   - Suposições provisórias adotadas para direcionar a rotina do concurseiro.
   - Exemplos: Suposição de que o erro decorreu de lacuna teórica pura recomendando retorno à teoria; heurística de priorização no ciclo Robin Hood; pressuposto de que resolver uma questão variante reforça a generalização.

---

## 3. As Dimensões da Avaliação Cognitiva e Interdependência Estatística

O sistema reconhece que as dimensões cognitivas **NÃO são estatisticamente independentes**. Há forte dependência hierárquica e correlações latentes (por exemplo: sem a retenção mnemônica de uma regra legal básica, a aplicação prática falha; a familiaridade com um enunciado reduz a carga cognitiva exigida na interpretação).

| Dimensão Cognitiva | Definição Operacional | Natureza Epistêmica | Dependência / Correlação |
| :--- | :--- | :--- | :--- |
| **1. Recuperação de Memória** | Capacidade de evocar a assertiva quando estimulado por deixa temporal. | Estimativa do FSRS-4.5 ($R$). | Base estruturante para a aplicação prática. |
| **2. Familiaridade com a Questão** | Efeito de reconhecimento superficial do enunciado ou distratores específicos. | Fato Observado (tentativas anteriores). | Reduz a validade de acerto como prova de domínio inédito. |
| **3. Compreensão Conceitual** | Apreensão das hipóteses normativas e princípios subjacentes. | Inferência Pedagógica. | Correlacionada à consistência de acerto entre bancas diferentes. |
| **4. Aplicação** | Resolução correta de problema numérico ou subsunção formal fato-norma. | Fato Observado (acerto em questão prática). | Depende conjuntamente de memória ($R$) e interpretação. |
| **5. Transferência** | Capacidade de acertar questões inéditas (`UNSEEN`) ou variantes (`VARIANT`). | Inferência Pedagógica. | Oposta à familiaridade; teste de robustez do aprendizado. |
| **6. Calibração de Confiança** | Acurácia entre certeza declarada (1 a 5) e probabilidade empírica de acerto. | Estimativa Estatística (Brier Score). | Mede a metacognição e imunidade à ilusão de competência. |
| **7. Incerteza da Estimativa** | Grau de dispersão e suporte amostral sobre a proficiência inferida. | Medida Estatística (tamanho amostral $n$, variância). | $n=3$ tentativas carrega altíssima incerteza frente a $n=40$. |

---

## 4. Calibração de Confiança: Conversão de Escala Ordinal para Probabilidade

A escala metacognitiva coletada antes da revelação do gabarito é estritamente ordinal ($1$ a $5$):
- $1$: Chute Total (ausência de pista)
- $2$: Inseguro (eliminação de 1 alternativa fraca)
- $3$: Dúvida Moderada (hesitação entre 2 alternativas plausíveis)
- $4$: Confiante (convicção fundada)
- $5$: Certeza Absoluta (domínio categórico da regra)

### 4.1. Mapeamento Operacional Provisório
Para o cômputo formal do **Brier Score** ($Brier = \frac{1}{N}\sum_{i=1}^N (p_i - y_i)^2$, onde $y_i \in \{0, 1\}$ é o acerto real), a escala ordinal deve ser mapeada em probabilidades de crença subjetiva $p_i \in [0, 1]$.

Adota-se como **hipótese operacional provisória e explicável** o seguinte vetor de probabilidades de referência:
- $p(1) = 0.20$ (equivalente ao acerto estocástico aleatório em 5 alternativas A/B/C/D/E)
- $p(2) = 0.35$ (eliminação parcial de alternativas)
- $p(3) = 0.50$ (bifurcação entre 2 alternativas finais)
- $p(4) = 0.75$ (alta convicção com margem residual de incerteza)
- $p(5) = 0.95$ (quase-certeza sem presunção de infalibilidade absoluta $1.0$)

> [!NOTE]
> Este mapeamento é uma hipótese de calibração operacional preliminar. Em fases posteriores com volume suficiente de dados empíricos, os valores de $p_i$ poderão ser substituídos por curvas empíricas de calibração isotônica ou regressão logística. O Brier Score não pode ser calculado diretamente sobre o inteiro $1..5$.

---

## 5. Taxonomia de Relacionamento entre Questões e Tratamento de Variantes

Toda questão é classificada segundo o histórico do estudante em:

### 5.1. Questão Inédita (`UNSEEN`)
- **Critério:** Questão sem nenhuma tentativa anterior registrada no `event_store` com `origin = REAL_STUDY`.
- **Papel Pedagógico:** Evidência primária de competência e capacidade de resolução sob incerteza.

### 5.2. Questão Repetida (`REPEATED`)
- **Critério:** Mesma questão física resolvida anteriormente (`question_id` coincidente).
- **Papel Pedagógico:** Alimenta exclusivamente o FSRS-4.5 para cálculo de retenção mnemônica. **Não é acumulada** linearmente como evidência de compreensão conceitual transferível.

### 5.3. Questão Variante (`VARIANT`)
- **Critério:** Questão que compartilha o mesmo núcleo normativo de uma questão conhecida, variando valores, contexto fático ou banca examinadora.
- **Rastreabilidade e Proveniência Obrigatórias:**
  - `parent_question_id`: Questão originária de referência.
  - `classification_source`: `HUMAN_CURATED` (revisão de professor/curador), `STAGING_PROVEN` (metadados documentais oficiais) ou `RULE_BASED` (regras léxicas).
  - `confidence_score`: Grau de certeza da relação de variante ($c \in [0.0, 1.0]$).
- **Limiar de Confiança $0.85$ como Hipótese Operacional:**
  - O patamar de $c \ge 0.85$ para aceitação automática de uma relação de variante é estabelecido estritamente como **hipótese operacional provisória de triagem**, e **NÃO como limiar cientificamente validado**.
  - Relações com $c < 0.85$ não podem ser consideradas no diagnóstico pedagógico sem validação humana manual (*human-in-the-loop*).

---

## 6. Proibição de Pesos Fixos Arbitrários

1. Fica expressamente vedada a adoção de pesos fixos (como $1.0$ para inéditas, $0.4$ para repetidas e $0.8$ para variantes) apresentados como se fossem coeficientes neurocientíficos consolidados.
2. Caso heurísticas provisórias sejam necessárias para priorização de exibição na interface, elas devem:
   - Residir em arquivos de configuração externa (YAML/JSON).
   - Ser rotuladas no código e na interface como parâmetros heurísticos provisórios.
   - Jamais serem injetadas ou multiplicadas na formulação do agendamento FSRS.
