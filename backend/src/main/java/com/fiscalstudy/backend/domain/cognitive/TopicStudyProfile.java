package com.fiscalstudy.backend.domain.cognitive;

import java.util.UUID;

/**
 * Perfil consolidado de um tópico no edital verticalizado para alimentação
 * do motor de ciclo de estudos dinâmico (P x V x I).
 */
public class TopicStudyProfile {

    private final UUID topicId;
    private final String topicName;
    private final String subjectName;
    private final double subjectWeight;      // Peso no edital (ex: 1.0, 2.0, 3.0)
    private final double historicalIncidence; // Incidência na banca (0.0 a 1.0)
    private final TopicMastery mastery;

    public TopicStudyProfile(
            UUID topicId,
            String topicName,
            String subjectName,
            double subjectWeight,
            double historicalIncidence,
            TopicMastery mastery
    ) {
        this.topicId = topicId;
        this.topicName = topicName;
        this.subjectName = subjectName;
        this.subjectWeight = Math.max(subjectWeight, 0.1);
        this.historicalIncidence = Math.max(historicalIncidence, 0.0);
        this.mastery = mastery != null ? mastery : new TopicMastery(UUID.randomUUID(), topicId, topicName);
    }

    public UUID getTopicId() {
        return topicId;
    }

    public String getTopicName() {
        return topicName;
    }

    public String getSubjectName() {
        return subjectName;
    }

    public double getSubjectWeight() {
        return subjectWeight;
    }

    public double getHistoricalIncidence() {
        return historicalIncidence;
    }

    public TopicMastery getMastery() {
        return mastery;
    }

    public double getConfidenceAdjustedMastery() {
        return mastery.getConfidenceAdjustedMastery();
    }
}
