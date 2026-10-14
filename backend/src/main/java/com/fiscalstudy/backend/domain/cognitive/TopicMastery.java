package com.fiscalstudy.backend.domain.cognitive;

import java.time.Instant;
import java.util.UUID;

/**
 * Entidade de domínio representando o domínio de um tópico canônico pelo estudante
 * (tabela user_topic_mastery), combinando FSRS v5 e calibração de proficiência.
 */
public class TopicMastery {

    private UUID id;
    private UUID userId;
    private UUID canonicalTopicId;
    private String topicName;
    private ProficiencyStage proficiencyStage;
    private double fsrsDifficulty;
    private double fsrsStability;
    private Instant lastReviewedAt;
    private Instant nextReviewDueAt;
    private int consecutiveRelearningSuccesses;
    private double rawAccuracy;                 // 0.0 a 1.0 (ou 0% a 100%)
    private double confidenceAdjustedMastery;   // Madj: 0.0 a 1.0
    private int totalAttempts;
    private int correctAttempts;
    private double weightedScoreAccumulator;

    public TopicMastery() {
        this.id = UUID.randomUUID();
        this.proficiencyStage = ProficiencyStage.STAGE_1_BEGINNER;
        this.fsrsDifficulty = 5.0;
        this.fsrsStability = 0.0;
        this.consecutiveRelearningSuccesses = 0;
        this.rawAccuracy = 0.0;
        this.confidenceAdjustedMastery = 0.0;
        this.totalAttempts = 0;
        this.correctAttempts = 0;
        this.weightedScoreAccumulator = 0.0;
    }

    public TopicMastery(UUID userId, UUID canonicalTopicId, String topicName) {
        this();
        this.userId = userId;
        this.canonicalTopicId = canonicalTopicId;
        this.topicName = topicName;
    }

    /**
     * Retorna o estado cognitivo FSRS atual encapsulado.
     */
    public FsrsCardState toFsrsCardState() {
        return FsrsCardState.of(
                fsrsStability,
                fsrsDifficulty,
                consecutiveRelearningSuccesses,
                0,
                lastReviewedAt,
                nextReviewDueAt
        );
    }

    /**
     * Atualiza o domínio do tópico após a resolução de uma questão, aplicando o motor FSRS
     * e recalculando o estágio pedagógico.
     */
    public FsrsEvaluationResult processAttempt(boolean isCorrect, ConfidenceLevel confidence, Instant attemptedAt, FsrsEngine engine) {
        FsrsEvaluationResult eval = engine.evaluateAttempt(isCorrect, confidence);
        FsrsCardState currentState = toFsrsCardState();
        FsrsCardState nextState = engine.calculateNextState(currentState, eval.getEffectiveRating(), attemptedAt);

        this.fsrsStability = nextState.getStability();
        this.fsrsDifficulty = nextState.getDifficulty();
        this.lastReviewedAt = nextState.getLastReviewedAt();
        this.nextReviewDueAt = nextState.getDue();

        this.totalAttempts++;
        if (isCorrect) {
            this.correctAttempts++;
        }
        this.rawAccuracy = (double) this.correctAttempts / this.totalAttempts;

        // Cálculo de Mastery Ajustado (Madj) com penalização de chute e dúvida
        double attemptWeight;
        if (!isCorrect) {
            attemptWeight = 0.0;
        } else if (confidence == ConfidenceLevel.CERTAIN) {
            attemptWeight = 1.0;
        } else if (confidence == ConfidenceLevel.DOUBT_BETWEEN_TWO) {
            attemptWeight = 0.60;
        } else {
            // Chute cego
            attemptWeight = 0.0;
        }

        // Média móvel ponderada com suavização exponencial para refletir aprendizado recente
        if (this.totalAttempts == 1) {
            this.confidenceAdjustedMastery = attemptWeight;
            this.weightedScoreAccumulator = attemptWeight;
        } else {
            double alpha = 0.20; // 20% peso para a tentativa mais recente
            this.confidenceAdjustedMastery = (alpha * attemptWeight) + ((1.0 - alpha) * this.confidenceAdjustedMastery);
        }

        // Reaprendizagens consecutivas espaçadas
        if (eval.getEffectiveRating() == FsrsRating.AGAIN) {
            this.consecutiveRelearningSuccesses = 0;
        } else {
            this.consecutiveRelearningSuccesses++;
        }

        // Atualização da Máquina de Estados de Proficiência
        this.proficiencyStage = ProficiencyStage.fromMastery(this.confidenceAdjustedMastery, this.consecutiveRelearningSuccesses);

        return eval;
    }

    // Getters e Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getCanonicalTopicId() {
        return canonicalTopicId;
    }

    public void setCanonicalTopicId(UUID canonicalTopicId) {
        this.canonicalTopicId = canonicalTopicId;
    }

    public String getTopicName() {
        return topicName;
    }

    public void setTopicName(String topicName) {
        this.topicName = topicName;
    }

    public ProficiencyStage getProficiencyStage() {
        return proficiencyStage;
    }

    public void setProficiencyStage(ProficiencyStage proficiencyStage) {
        this.proficiencyStage = proficiencyStage;
    }

    public double getFsrsDifficulty() {
        return fsrsDifficulty;
    }

    public void setFsrsDifficulty(double fsrsDifficulty) {
        this.fsrsDifficulty = fsrsDifficulty;
    }

    public double getFsrsStability() {
        return fsrsStability;
    }

    public void setFsrsStability(double fsrsStability) {
        this.fsrsStability = fsrsStability;
    }

    public Instant getLastReviewedAt() {
        return lastReviewedAt;
    }

    public void setLastReviewedAt(Instant lastReviewedAt) {
        this.lastReviewedAt = lastReviewedAt;
    }

    public Instant getNextReviewDueAt() {
        return nextReviewDueAt;
    }

    public void setNextReviewDueAt(Instant nextReviewDueAt) {
        this.nextReviewDueAt = nextReviewDueAt;
    }

    public int getConsecutiveRelearningSuccesses() {
        return consecutiveRelearningSuccesses;
    }

    public void setConsecutiveRelearningSuccesses(int consecutiveRelearningSuccesses) {
        this.consecutiveRelearningSuccesses = consecutiveRelearningSuccesses;
    }

    public double getRawAccuracy() {
        return rawAccuracy;
    }

    public void setRawAccuracy(double rawAccuracy) {
        this.rawAccuracy = rawAccuracy;
    }

    public double getConfidenceAdjustedMastery() {
        return confidenceAdjustedMastery;
    }

    public void setConfidenceAdjustedMastery(double confidenceAdjustedMastery) {
        this.confidenceAdjustedMastery = confidenceAdjustedMastery;
    }

    public int getTotalAttempts() {
        return totalAttempts;
    }

    public void setTotalAttempts(int totalAttempts) {
        this.totalAttempts = totalAttempts;
    }

    public int getCorrectAttempts() {
        return correctAttempts;
    }

    public void setCorrectAttempts(int correctAttempts) {
        this.correctAttempts = correctAttempts;
    }
}
