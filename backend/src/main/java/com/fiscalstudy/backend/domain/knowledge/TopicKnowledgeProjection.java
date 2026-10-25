package com.fiscalstudy.backend.domain.knowledge;

import java.time.Instant;
import java.util.Objects;

/**
 * Entidade de domínio / Read-Model para o Modelo Individual de Conhecimento (EPIC 02).
 * Mapeia o estado cognitivo e evidências estatísticas agregadas por tópico curricular.
 */
public class TopicKnowledgeProjection {

    private String topicId;
    private String disciplineId;
    private int totalAttempts;
    private int correctAttempts;
    private double accuracyRate;
    private Double brierScore;
    private String brierCalibrationStatus;
    private Double avgStabilityDays;
    private Double currentRetrievalRate;
    private Double transferIndex;
    private String sampleConfidenceLevel;
    private Instant updatedAt;

    public TopicKnowledgeProjection() {
        this.totalAttempts = 0;
        this.correctAttempts = 0;
        this.accuracyRate = 0.0;
        this.brierCalibrationStatus = "INSUFFICIENT_DATA";
        this.sampleConfidenceLevel = "UNCERTAIN_LOW_DATA";
        this.updatedAt = Instant.now();
    }

    public TopicKnowledgeProjection(String topicId, String disciplineId) {
        this();
        this.topicId = Objects.requireNonNull(topicId, "topicId cannot be null");
        this.disciplineId = Objects.requireNonNull(disciplineId, "disciplineId cannot be null");
    }

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getDisciplineId() {
        return disciplineId;
    }

    public void setDisciplineId(String disciplineId) {
        this.disciplineId = disciplineId;
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

    public double getAccuracyRate() {
        return accuracyRate;
    }

    public void setAccuracyRate(double accuracyRate) {
        this.accuracyRate = accuracyRate;
    }

    public Double getBrierScore() {
        return brierScore;
    }

    public void setBrierScore(Double brierScore) {
        this.brierScore = brierScore;
    }

    public String getBrierCalibrationStatus() {
        return brierCalibrationStatus;
    }

    public void setBrierCalibrationStatus(String brierCalibrationStatus) {
        this.brierCalibrationStatus = brierCalibrationStatus;
    }

    public Double getAvgStabilityDays() {
        return avgStabilityDays;
    }

    public void setAvgStabilityDays(Double avgStabilityDays) {
        this.avgStabilityDays = avgStabilityDays;
    }

    public Double getCurrentRetrievalRate() {
        return currentRetrievalRate;
    }

    public void setCurrentRetrievalRate(Double currentRetrievalRate) {
        this.currentRetrievalRate = currentRetrievalRate;
    }

    public Double getTransferIndex() {
        return transferIndex;
    }

    public void setTransferIndex(Double transferIndex) {
        this.transferIndex = transferIndex;
    }

    public String getSampleConfidenceLevel() {
        return sampleConfidenceLevel;
    }

    public void setSampleConfidenceLevel(String sampleConfidenceLevel) {
        this.sampleConfidenceLevel = sampleConfidenceLevel;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
