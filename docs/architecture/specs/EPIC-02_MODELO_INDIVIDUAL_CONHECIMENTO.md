# Especificação de Arquitetura: EPIC 02 — Modelo Individual de Conhecimento

> **Status:** ESPECIFICAÇÃO PRÉVIA / PRONTO PARA IMPLEMENTAÇÃO INCREMENTAL  
> **Versão:** 1.0.0  
> **Módulo:** Core App / Backend Domain & Intelligence  
> **Dependências:** EPIC 08 (Banco de Questões e Tentativas Legítimas), EPIC 14 (Event Store e Persistência SQLite)  
> **Consumidores:** EPIC 01 (Mentor Cognitivo Adaptativo), EPIC 05 (Planejamento / Ciclo Robin Hood)  

---

## 1. Visão Geral e Princípios Fundamentais

O **Modelo Individual de Conhecimento** é o componente responsável por mapear, de forma determinística, auditável e fundamentada em dados empíricos reais de estudo, o estado cognitivo do estudante ao longo do currículo verticalizado.

### 1.1. Princípios Inegociáveis de Governança
1. **Desacoplamento Estrito do Motor FSRS-4.5:**
   - O agendamento mnemônico de repetição espaçada é de responsabilidade exclusiva do `FsrsEngine` (EPIC 03).
   - O FSRS nunca recebe pesos arbitrários de transferência ou fatores modificadores.
   - O Modelo Individual de Conhecimento consome a recuperabilidade calculada pelo FSRS ($R$), mas não altera a formulação matemática interna do FSRS.
2. **Anti-Alucinação Probabilística:**
   - Proibido inferir domínio pleno sem suporte amostral empírico. Toda probabilidade de acerto ou proficiência deve decorrer estritamente de dados observados no `event_store` com `origin = 'REAL_STUDY'`.
   - Eventos de origem sintética (`AUTOMATED_TEST`, `BENCHMARK`) são rigorosamente segregados e descartados das estimativas cognitivas do aluno.
3. **Simplicidade Pragmática (YAGNI / Ponytail):**
   - Não utilizar redes neurais, redes bayesianas complexas de crença ou modelos generativos caixa-preta.
   - Utilizar métricas estatísticas transparentes: médias ponderadas por tempo, decaimento exponencial determinístico, Brier Score e intervalos de confiança baseados no tamanho amostral ($n$).
4. **Segregação Epistêmica Tripartite:**
   - Toda saída do modelo deve explicitar claramente o que é **Fato Observado**, o que é **Estimativa Matemática** e o que é **Hipótese Pedagógica**.

---

## 2. As 7 Dimensões Cognitivas do Estudante

| # | Dimensão | Natureza Epistêmica | Métrica / Formulação | Fonte Primária |
|---|---|---|---|---|
| 1 | **Desempenho por Tópico** | Fato Observado & Média Móvel | Taxa de acerto observada no tópico $k$: $Acc_k = \frac{\sum y_i}{N_k}$, ponderada por tempo recente. | Eventos `ANSWER_SUBMITTED` |
| 2 | **Histórico de Tentativas** | Fato Histórico Imutável | Série temporal de tentativas no nó curricular: $N_k$ total, sequência de acertos/erros, tempo gasto ($activeTimeMs$). | Tabela `event_store` |
| 3 | **Confiança e Calibração** | Estimativa Estatística | **Brier Score:** $BS_k = \frac{1}{N}\sum (p_i - y_i)^2$<br>Mapeamento de escala ordinal ($1..5 \to p \in [0.20, 0.95]$). Distingue "chute certo" de "certeza errada". | `confidenceLevel` (1 a 5) pré-gabarito |
| 4 | **Familiaridade com a Questão** | Classificação Estrutural | Categorização da questão para o aluno: `UNSEEN` ($n=0$), `REPEATED` ($n \ge 1$, mesmo `questionId`), ou `VARIANT` ($n \ge 1$ em `parent_question_id`). | Histórico agregado por `questionId` |
| 5 | **Recuperabilidade Temporal** | Estimativa do FSRS-4.5 | Retentabilidade mnemônica $R(t) = (1 + F \cdot \frac{t}{S})^{-w}$, fornecida pelo `FsrsEngine`. Indica probabilidade de evocar a resposta no instante $t$. | Estado do card FSRS vinculado ao tópico/questão |
| 6 | **Compreensão e Transferência** | Inferência Pedagógica Baseada em Dados | Consistência de acerto em questões variantes e entre bancas examinadoras distintas (ex: FGV vs Cebraspe) sobre o mesmo núcleo normativo. | Cruzamento de acertos em `VARIANT` / bancas distintas |
| 7 | **Incerteza da Estimativa** | Indicador de Confiabilidade Estatística | Função do tamanho amostral ($N_k$):<br>- Amostra Crítica ($N_k < 5$): Alta incerteza (flag `UNCERTAIN_LOW_DATA`).<br>- Amostra Média ($5 \le N_k < 20$): Incerteza moderada.<br>- Amostra Robusta ($N_k \ge 20$): Estimativa estável. | Contagem de amostras legítimas $N_k$ |

---

## 3. Contratos de Dados e Estruturas de Eventos

### 3.1. DTO de Consulta: `StudentTopicMasteryDTO`
```json
{
  "topicId": "dir_tributario_imunidades_reciproca",
  "topicName": "Imunidade Tributária Recíproca (Art. 150, VI, 'a')",
  "disciplineId": "direito_tributario",
  "observedMetrics": {
    "totalAttempts": 18,
    "correctAttempts": 14,
    "accuracyRate": 0.7778,
    "averageActiveTimeMs": 64200,
    "lastAttemptAt": "2026-10-24T14:30:00Z"
  },
  "familiarityDistribution": {
    "unseenCount": 12,
    "repeatedCount": 4,
    "variantCount": 2
  },
  "metacognition": {
    "brierScore": 0.125,
    "calibrationStatus": "WELL_CALIBRATED",
    "overconfidenceCount": 1,
    "underconfidenceCount": 0
  },
  "memoryRetention": {
    "averageStabilityDays": 14.2,
    "currentEstimatedRecallRate": 0.84
  },
  "transferEvidence": {
    "crossBankConsistency": 0.80,
    "variantAccuracy": 0.85,
    "transferIndex": 0.82
  },
  "uncertainty": {
    "sampleConfidence": "MEDIUM",
    "standardError": 0.098,
    "isSufficientSample": true
  }
}
```

### 3.2. Projeção Read-Model: `topic_knowledge_projections` (SQLite)
Tabela materializada atualizada de forma assíncrona/reativa via eventos de estudo:
```sql
CREATE TABLE IF NOT EXISTS topic_knowledge_projections (
    topic_id VARCHAR(120) NOT NULL PRIMARY KEY,
    discipline_id VARCHAR(80) NOT NULL,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    correct_attempts INTEGER NOT NULL DEFAULT 0,
    accuracy_rate REAL NOT NULL DEFAULT 0.0,
    brier_score REAL,
    brier_calibration_status VARCHAR(30) DEFAULT 'INSUFFICIENT_DATA',
    avg_stability_days REAL,
    current_retrieval_rate REAL,
    transfer_index REAL,
    sample_confidence_level VARCHAR(20) NOT NULL DEFAULT 'UNCERTAIN_LOW_DATA',
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topic_knowledge_discipline ON topic_knowledge_projections(discipline_id);
CREATE INDEX IF NOT EXISTS idx_topic_knowledge_updated ON topic_knowledge_projections(updated_at);
```

---

## 4. Critérios de Aceitação e Validação Verificável

1. **Determinismo:**
   - Dado um conjunto idêntico de eventos em `event_store`, o cálculo de proficiência por tópico deve produzir resultados bit a bit idênticos em qualquer ambiente.
2. **Segregação de Origem:**
   - Tentativas com `origin != 'REAL_STUDY'` (ex: `AUTOMATED_TEST`, `DIAGNOSTIC_SYNTHETIC`) jamais afetam os contadores de `total_attempts` ou `accuracy_rate` do aluno.
3. **Resiliência a Poucos Dados (Cold Start):**
   - Tópicos com 0 tentativas retornam estado neutro com flag `sample_confidence_level = 'UNCERTAIN_LOW_DATA'` sem gerar exceções de divisão por zero ou `NullPointerException`.
4. **Cálculo Auditável do Brier Score:**
   - O Brier Score é calculado estritamente sobre as probabilidades mapeadas $p \in [0.20, 0.95]$ e os resultados reais $y \in \{0, 1\}$.
5. **Preservação de Desacoplamento:**
   - Nenhuma classe do pacote `com.fiscalstudy.backend.domain.knowledge` importa ou instancia modificadores no `FsrsEngine`.

---

## 5. Roteiro de Implementação Incremental

- **Etapa 2.1 — Modelo de Dados e Projeção:**
  - Migração de banco `V8__create_topic_knowledge_projections.sql`.
  - Entidade `TopicKnowledgeProjection` e Repositório Spring Data.
- **Etapa 2.2 — Agregador de Eventos (`KnowledgeProjectionService`):**
  - Listener reativo ao evento `ANSWER_SUBMITTED` com `origin = REAL_STUDY`.
  - Atualização idempotente da projeção com recálculo de médias móveis e Brier Score.
- **Etapa 2.3 — Suíte de Testes de Conformidade Epistêmica:**
  - Testes unitários para Brier Score, matriz de incerteza e cálculo de transferência.
  - Testes de integração de repositório e eventos.
- **Etapa 2.4 — Exposição REST e Visualização:**
  - Endpoint `GET /api/v1/knowledge/topics/{topicId}/mastery`.
  - Integração com a aba de desempenho no frontend (`CalibracaoRetencaoAbas.tsx`).
