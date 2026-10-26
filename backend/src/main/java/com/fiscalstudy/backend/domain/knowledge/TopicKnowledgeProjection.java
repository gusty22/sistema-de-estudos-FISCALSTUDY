package com.fiscalstudy.backend.domain.knowledge;

import java.time.Instant;
import java.util.Objects;

/**
 * Entidade de domínio / Read-Model canônico para o Modelo Individual de Conhecimento (EPIC 02).
 * Preserva a segregação estrita entre fatos observados, métricas ordinais de confiança,
 * evidências de familiaridade/transferência e estimativas temporais de recuperação (FSRS).
 * 
 * Não utiliza pesos arbitrários nem scores agregados opacos.
 */
public class TopicKnowledgeProjection {

    private String topicId;
    private String disciplineId;
    private String topicName;

    // 1. Desempenho Observado (Fatos verificáveis)
    private int totalAttempts;
    private int correctAttempts;
    private int errorAttempts;
    private double accuracyRate;
    private String accuracyDenominatorText; // Ex: "14/18" ou "SEM_EVIDENCIAS"
    private long totalActiveTimeMs;
    private long averageActiveTimeMs;
    private Instant lastAttemptAt;

    // 2. Familiaridade e Cobertura Curricular
    private int uniqueQuestionsCount;
    private int newQuestionsAttempts;       // Inéditas (exposicaoAnteriorCount == 0)
    private int repeatedQuestionsAttempts;  // Repetidas (exposicaoAnteriorCount > 0)
    private int variantQuestionsAttempts;   // Variantes (família identificada)

    // 3. Confiança Declarada & Metacognição (Escala ordinal pura 1 a 5)
    private Double avgConfidenceOrdinal;
    private int lowConfidenceSuccesses;     // Acertos com baixa confiança (nível 1 ou 2)
    private int highConfidenceErrors;       // Erros com alta confiança (nível 4 ou 5)
    private String confidenceDistributionJson; // Contagem por nível ordinal: {"1": c1, "2": c2, ...}

    // 4. Metadados e Contextos Observados (Sem pesos arbitrários)
    private String contextDistributionJson;    // {"REGULAR": c1, "SIMULADO": c2, "RETESTE": c3, ...}
    private String errorCausesDistributionJson;// {"FALTA_ATENCAO": c1, "LACUNA_TEORICA": c2, ...}

    // 5. Mnemônica / Memória FSRS (Desacoplada de avaliação de domínio)
    private Double fsrsStabilityDays;
    private Double fsrsRetrievalRate;

    // 6. Governança Epistêmica e Hipóteses
    private String evidenceStatus;             // SEM_EVIDENCIAS, PRELIMINAR, EM_CONSTRUCAO, SUFICIENTE_OPERACIONAL
    private String epistemicLimitationsJson;   // Limitações científicas transparentes da amostra
    private String pedagogicalHypothesesJson;  // Hipóteses pedagógicas (não fatos dogmáticos)

    private Instant updatedAt;

    public TopicKnowledgeProjection() {
        this.totalAttempts = 0;
        this.correctAttempts = 0;
        this.errorAttempts = 0;
        this.accuracyRate = 0.0;
        this.accuracyDenominatorText = "SEM_EVIDENCIAS";
        this.totalActiveTimeMs = 0;
        this.averageActiveTimeMs = 0;
        this.uniqueQuestionsCount = 0;
        this.newQuestionsAttempts = 0;
        this.repeatedQuestionsAttempts = 0;
        this.variantQuestionsAttempts = 0;
        this.lowConfidenceSuccesses = 0;
        this.highConfidenceErrors = 0;
        this.confidenceDistributionJson = "{\"1\":0,\"2\":0,\"3\":0,\"4\":0,\"5\":0}";
        this.contextDistributionJson = "{}";
        this.errorCausesDistributionJson = "{}";
        this.evidenceStatus = "SEM_EVIDENCIAS";
        this.epistemicLimitationsJson = "[]";
        this.pedagogicalHypothesesJson = "[]";
        this.updatedAt = Instant.now();
    }

    public TopicKnowledgeProjection(String topicId, String disciplineId, String topicName) {
        this();
        this.topicId = Objects.requireNonNull(topicId, "topicId cannot be null");
        this.disciplineId = Objects.requireNonNull(disciplineId, "disciplineId cannot be null");
        this.topicName = topicName != null ? topicName : topicId;
    }

    // Getters e Setters
    public String getTopicId() { return topicId; }
    public void setTopicId(String topicId) { this.topicId = topicId; }

    public String getDisciplineId() { return disciplineId; }
    public void setDisciplineId(String disciplineId) { this.disciplineId = disciplineId; }

    public String getTopicName() { return topicName; }
    public void setTopicName(String topicName) { this.topicName = topicName; }

    public int getTotalAttempts() { return totalAttempts; }
    public void setTotalAttempts(int totalAttempts) { this.totalAttempts = totalAttempts; }

    public int getCorrectAttempts() { return correctAttempts; }
    public void setCorrectAttempts(int correctAttempts) { this.correctAttempts = correctAttempts; }

    public int getErrorAttempts() { return errorAttempts; }
    public void setErrorAttempts(int errorAttempts) { this.errorAttempts = errorAttempts; }

    public double getAccuracyRate() { return accuracyRate; }
    public void setAccuracyRate(double accuracyRate) { this.accuracyRate = accuracyRate; }

    public String getAccuracyDenominatorText() { return accuracyDenominatorText; }
    public void setAccuracyDenominatorText(String accuracyDenominatorText) { this.accuracyDenominatorText = accuracyDenominatorText; }

    public long getTotalActiveTimeMs() { return totalActiveTimeMs; }
    public void setTotalActiveTimeMs(long totalActiveTimeMs) { this.totalActiveTimeMs = totalActiveTimeMs; }

    public long getAverageActiveTimeMs() { return averageActiveTimeMs; }
    public void setAverageActiveTimeMs(long averageActiveTimeMs) { this.averageActiveTimeMs = averageActiveTimeMs; }

    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(Instant lastAttemptAt) { this.lastAttemptAt = lastAttemptAt; }

    public int getUniqueQuestionsCount() { return uniqueQuestionsCount; }
    public void setUniqueQuestionsCount(int uniqueQuestionsCount) { this.uniqueQuestionsCount = uniqueQuestionsCount; }

    public int getNewQuestionsAttempts() { return newQuestionsAttempts; }
    public void setNewQuestionsAttempts(int newQuestionsAttempts) { this.newQuestionsAttempts = newQuestionsAttempts; }

    public int getRepeatedQuestionsAttempts() { return repeatedQuestionsAttempts; }
    public void setRepeatedQuestionsAttempts(int repeatedQuestionsAttempts) { this.repeatedQuestionsAttempts = repeatedQuestionsAttempts; }

    public int getVariantQuestionsAttempts() { return variantQuestionsAttempts; }
    public void setVariantQuestionsAttempts(int variantQuestionsAttempts) { this.variantQuestionsAttempts = variantQuestionsAttempts; }

    public Double getAvgConfidenceOrdinal() { return avgConfidenceOrdinal; }
    public void setAvgConfidenceOrdinal(Double avgConfidenceOrdinal) { this.avgConfidenceOrdinal = avgConfidenceOrdinal; }

    public int getLowConfidenceSuccesses() { return lowConfidenceSuccesses; }
    public void setLowConfidenceSuccesses(int lowConfidenceSuccesses) { this.lowConfidenceSuccesses = lowConfidenceSuccesses; }

    public int getHighConfidenceErrors() { return highConfidenceErrors; }
    public void setHighConfidenceErrors(int highConfidenceErrors) { this.highConfidenceErrors = highConfidenceErrors; }

    public String getConfidenceDistributionJson() { return confidenceDistributionJson; }
    public void setConfidenceDistributionJson(String confidenceDistributionJson) { this.confidenceDistributionJson = confidenceDistributionJson; }

    public String getContextDistributionJson() { return contextDistributionJson; }
    public void setContextDistributionJson(String contextDistributionJson) { this.contextDistributionJson = contextDistributionJson; }

    public String getErrorCausesDistributionJson() { return errorCausesDistributionJson; }
    public void setErrorCausesDistributionJson(String errorCausesDistributionJson) { this.errorCausesDistributionJson = errorCausesDistributionJson; }

    public Double getFsrsStabilityDays() { return fsrsStabilityDays; }
    public void setFsrsStabilityDays(Double fsrsStabilityDays) { this.fsrsStabilityDays = fsrsStabilityDays; }

    public Double getFsrsRetrievalRate() { return fsrsRetrievalRate; }
    public void setFsrsRetrievalRate(Double fsrsRetrievalRate) { this.fsrsRetrievalRate = fsrsRetrievalRate; }

    public String getEvidenceStatus() { return evidenceStatus; }
    public void setEvidenceStatus(String evidenceStatus) { this.evidenceStatus = evidenceStatus; }

    public String getEpistemicLimitationsJson() { return epistemicLimitationsJson; }
    public void setEpistemicLimitationsJson(String epistemicLimitationsJson) { this.epistemicLimitationsJson = epistemicLimitationsJson; }

    public String getPedagogicalHypothesesJson() { return pedagogicalHypothesesJson; }
    public void setPedagogicalHypothesesJson(String pedagogicalHypothesesJson) { this.pedagogicalHypothesesJson = pedagogicalHypothesesJson; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
