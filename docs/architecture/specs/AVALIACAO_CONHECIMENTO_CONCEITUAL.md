# Especificação Técnica: Avaliação de Conhecimento Conceitual e Taxonomia de Variantes

**Documento:** `docs/architecture/specs/AVALIACAO_CONHECIMENTO_CONCEITUAL.md`  
**Status:** ESPECIFICAÇÃO CONCEITUAL / PROPOSTA ARQUITETURAL  
**Versão:** 1.0.0 (Wave 1)  
**Autor:** Orquestrador Técnico (FiscalStudy Multiagent Architecture)  
**Princípio Reitor:** Preservação estrita do algoritmo FSRS oficial; desacoplamento entre modelo de repetição espaçada e modelo de domínio conceitual.

---

## 1. Desacoplamento Arquitetural: FSRS vs. Domínio Conceitual

O FiscalStudy adota o princípio de **separação estrita de preocupações cognitivas**:

1. **Motor FSRS (Free Spaced Repetition Scheduler):**
   - **Objeto de Modelagem:** Estabilidade ($S$), Dificuldade ($D$) e Retentabilidade ($R$) de itens específicos de memória na recuperação espaçada.
   - **Regra de Ouro:** O algoritmo FSRS oficial e canônico **NÃO pode ser modificado** com fatores multiplicativos ad-hoc ou heurísticas arbitrárias de transferência. Sua formulação matemática oficial e seus casos de teste de referência em `FsrsReferenceConformanceTest` permanecem 100% preservados.
   - **Entrada:** Nota de recordação discrete ($G \in \{1, 2, 3, 4\}$) e intervalo temporal ($\Delta t$).

2. **Modelo de Conhecimento Conceitual (Cognitive Mastery):**
   - **Objeto de Modelagem:** Capacidade do estudante de generalizar princípios jurídicos, contábeis e fiscais para situações inéditas.
   - **Localização:** Camada independente de inteligência pedagógica (`StudentKnowledgeStateService`), externa ao agendador de revisões FSRS.

---

## 2. As Sete Dimensões Independentes da Avaliação Cognitiva

Para evitar a confusão epistemológica entre recordação e domínio, o sistema modela formalmente sete dimensões ortogonais:

| Dimensão | Definição Operacional | Métrica Observada | O que NÃO representa |
| :--- | :--- | :--- | :--- |
| **1. Recuperação de Memória** | Capacidade de evocar a informação quando submetido a uma deixa (retrieval strength). | Sucesso na resolução sob agendamento FSRS ($\text{Acerto} \in \{0, 1\}$). | Não mede se o aluno compreendeu a fundamentação da lei ou apenas decorou a assertiva. |
| **2. Familiaridade com a Questão** | Reconhecimento do enunciado ou das opções por exposição anterior (efeito de mera exposição). | Quantidade e proximidade temporal de tentativas anteriores na mesma questão física (`attempt_count`, `last_attempt_at`). | Não indica retenção de longo prazo nem capacidade de resolver variações. |
| **3. Compreensão Conceitual** | Apreensão das relações lógicas, hipóteses legais e princípios subjacentes. | Capacidade de justificar assertivas e identificar o vício em distratores de alta complexidade. | Não se confunde com velocidade de leitura ou certeza subjetiva. |
| **4. Aplicação** | Resolução correta de um problema prático que exige cálculo ou subsunção formal da norma aos fatos. | Resolução de questões de cálculo contábil/tributário e casos concretos práticos. | Não é mera recordação da literalidade de lei. |
| **5. Transferência para Novos Contextos** | Capacidade de transferir o conhecimento para questões com estrutura fática diferente ou banca distinta. | Desempenho em questões variantes (`VARIANT`) e questões inéditas (`UNSEEN`) de um mesmo tópico. | Jamais deve ser inferida a partir de repetições idênticas da mesma questão. |
| **6. Calibração de Confiança** | Correspondência entre a certeza subjetiva declarada e o acerto real verificado. | Brier Score e correlação da escala metacognitiva (1 a 5) informada antes do gabarito. | Alta confiança não garante domínio real; mede calibração metacognitiva. |
| **7. Incerteza das Estimativas** | Grau de dispersão estatística e suporte amostral sobre a estimativa de domínio. | Tamanho amostral de tentativas legítimas ($n$), intervalo temporal decorrido e variância de acertos. | Uma estimativa com $n=2$ tentativas possui incerteza radicalmente maior que $n=30$. |

---

## 3. Taxonomia de Relacionamento entre Questões

Cada questão no banco de dados operacional é classificada epistemologicamente em relação ao histórico do aluno:

### 3.1. Questão Inédita (`UNSEEN`)
- **Definição:** Questão em que o estudante não registrou nenhuma tentativa anterior em seu histórico pessoal (`event_store` com `origin = REAL_STUDY`).
- **Valor Probatório:** Evidência primária de competência e capacidade de resolução sob incerteza.

### 3.2. Questão Repetida (`REPEATED`)
- **Definição:** Apresentação subsequente exatamente idêntica da mesma questão (`question_id` coincidente ou hash de enunciado/opções idêntico).
- **Tratamento Pedagógico:**
  - O FSRS agenda e pontua a repetição estritamente segundo as leis de decaimento de memória.
  - A camada de diagnóstico conceitual trata acertos em questões repetidas como evidência primária de **reforço de recuperação e familiaridade**, e **NÃO** como evidência cumulativa linear de transferência conceitual.

### 3.3. Questão Variante (`VARIANT`)
- **Definição:** Questão que compartilha o mesmo núcleo conceitual e mesma armadilha doutrinária/legal de outra questão conhecida, mas apresenta:
  1. *Variação Numérica:* Valores ou alíquotas alteradas no problema.
  2. *Variação Fática/Contextual:* Enunciado hipotético diferente com a mesma regra de subsunção.
  3. *Inversão de Polaridade:* Alteração de "assinale a correta" para "assinale a incorreta", exigindo reavaliação de todos os distratores.
- **Rastreabilidade e Proveniência da Variante:**
  - Toda variante deve declarar:
    * `parent_question_id`: Identificador da questão original de referência.
    * `variation_type`: `NUMERICAL`, `FACTUAL_CONTEXT`, `POLARITY_INVERSION`, ou `CROSS_BOARD`.
    * `classification_source`: `HUMAN_CURATED` (curadoria pedagógica manual), `RULE_BASED` (regras léxicas determinísticas), ou `STAGING_PROVEN` (proveniência documental).
    * `confidence_score`: Nível de certeza da classificação da variante (0.0 a 1.0). Se `< 0.80`, exige validação humana antes de influenciar diagnósticos.

---

## 4. Declaração Formal sobre Heurísticas Pedagógicas

> [!IMPORTANT]
> **Heurísticas e Pesos Pedagógicos:**  
> Quaisquer pesos numéricos ou fatores de ponderação adotados na interface ou no cálculo do `StudentKnowledgeStateService` (como multiplicadores provisórios para simulados vs. questões soltas) são:
> 1. **Provisórios e Configuráveis:** Parametrizados externamente e nunca hardcoded em fórmulas centrais de persistência.
> 2. **Explicáveis:** A interface deve expor a justificativa clara ao estudante no Modo Avançado, sem alegar falsamente status de constante neurocientífica.
> 3. **Totalmente Isolados do FSRS:** O FSRS opera puramente sobre seus 17 parâmetros oficiais de agendamento intervalado.

---

## 5. Critérios de Aceitação de Contrato (Gherkin)

```gherkin
Funcionalidade: Rastreabilidade Epistêmica de Questões Variantes

  Cenário: Registro de Tentativa em Questão Variante com Proveniência Auditada
    Dado que existe uma questão "q_icms_01" sobre "Fato Gerador do ICMS" resolvida previamente
    E existe uma questão variante "q_icms_02" vinculada com parent_question_id = "q_icms_01"
    E a variante possui classification_source = "HUMAN_CURATED" e confidence_score = 1.0
    Quando o estudante submete uma tentativa em "q_icms_02"
    Então o evento persistido no event_store deve registrar aggregate_id = "q_icms_02"
    E o payload da tentativa deve preservar origin = "REAL_STUDY"
    E o agendador FSRS deve tratar "q_icms_02" como seu próprio item de revisão independente
    E o diagnóstico conceitual deve computar o acerto como evidência de transferência próxima
    E não deve modificar os parâmetros matemáticos internos do FSRS.

  Cenário: Rejeição de Variantes com Baixa Confiança sem Curadoria
    Dado que um algoritmo automatizado sugeriu que "q_trib_99" é variante de "q_trib_01"
    Mas o confidence_score atribuído é 0.65 (abaixo da tolerância de 0.80)
    Quando o motor de diagnóstico processa o histórico
    Então a questão deve ser tratada como UNSEEN independente
    E deve ser enfileirada para revisão humana de curadoria.
```
