package com.fiscalstudy.backend.domain.cognitive;

import java.time.Instant;
import java.util.UUID;

/**
 * Representa um bloco prescrito de estudos dentro do Ciclo Dinâmico,
 * contendo as metas de tempo, questões, modalidade pedagógica e justificativa algorítmica.
 */
public class StudyCycleBlock {

    private UUID id;
    private UUID cycleId;
    private int sequenceOrder;
    private UUID canonicalTopicId;
    private String topicName;
    private String subjectName;
    private StudyBlockModality modality;
    private int targetMinutes;
    private int targetQuestionsCount;
    private double priorityScore;
    private int pretestingQuestionsCount; // 3 questões sonda para Stage 1
    private int maxTheoryMinutes;         // Máx 25 min de teoria / lei seca quente para Stage 1
    private String prescriptionRationale; // Explicação pedagógica transparente
    private boolean completed;
    private Instant completedAt;

    public StudyCycleBlock() {
        this.id = UUID.randomUUID();
        this.completed = false;
    }

    public static StudyCycleBlock createSpacedReviewBlock(
            int sequenceOrder,
            UUID topicId,
            String topicName,
            String subjectName,
            int targetMinutes,
            double retrievability,
            double priorityScore
    ) {
        StudyCycleBlock block = new StudyCycleBlock();
        block.setSequenceOrder(sequenceOrder);
        block.setCanonicalTopicId(topicId);
        block.setTopicName(topicName);
        block.setSubjectName(subjectName);
        block.setModality(StudyBlockModality.SPACED_REVIEW_BATTERY);
        block.setTargetMinutes(targetMinutes);
        block.setTargetQuestionsCount(12); // Bateria de recuperação ativa (5 a 15 questões)
        block.setPriorityScore(priorityScore);
        block.setPretestingQuestionsCount(0);
        block.setMaxTheoryMinutes(0);
        block.setPrescriptionRationale(String.format(
                "Bateria de Recuperação Ativa FSRS: R(t) = %.1f%% (< 88%% limiar de retenção). Foco em retenção duradoura.",
                retrievability * 100.0
        ));
        return block;
    }

    public static StudyCycleBlock createPedagogicalBlock(
            int sequenceOrder,
            UUID topicId,
            String topicName,
            String subjectName,
            ProficiencyStage stage,
            int targetMinutes,
            double priorityScore
    ) {
        StudyCycleBlock block = new StudyCycleBlock();
        block.setSequenceOrder(sequenceOrder);
        block.setCanonicalTopicId(topicId);
        block.setTopicName(topicName);
        block.setSubjectName(subjectName);
        block.setTargetMinutes(targetMinutes);
        block.setPriorityScore(priorityScore);

        switch (stage) {
            case STAGE_1_BEGINNER:
                block.setModality(StudyBlockModality.BLOCKED_PRACTICE);
                block.setPretestingQuestionsCount(3);
                block.setMaxTheoryMinutes(Math.min(25, targetMinutes / 2));
                block.setTargetQuestionsCount(10);
                block.setPrescriptionRationale("Estágio 1 (Iniciante): 3 questões-sonda (Pretesting) -> Leitura cirúrgica de teoria/lei seca (máx 25 min) -> 10 questões de fixação em bloco.");
                break;
            case STAGE_2_CONSOLIDATION:
                block.setModality(StudyBlockModality.REVERSE_STUDY_QUESTIONS);
                block.setPretestingQuestionsCount(0);
                block.setMaxTheoryMinutes(0);
                block.setTargetQuestionsCount(18); // 15 a 20 questões
                block.setPrescriptionRationale("Estágio 2 (Consolidação): Estudo Reverso Direto por questões da banca. Teoria e lei seca consultadas apenas sob demanda nos erros.");
                break;
            case STAGE_3_MASTERY:
                block.setModality(StudyBlockModality.INTERLEAVED_PRACTICE);
                block.setPretestingQuestionsCount(0);
                block.setMaxTheoryMinutes(0);
                block.setTargetQuestionsCount(20);
                block.setPrescriptionRationale("Estágio 3 (Domínio): Prática Intercalada misturando 3 a 5 subtópicos para treinar discriminação conceitual e velocidade de prova.");
                break;
        }

        return block;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCycleId() {
        return cycleId;
    }

    public void setCycleId(UUID cycleId) {
        this.cycleId = cycleId;
    }

    public int getSequenceOrder() {
        return sequenceOrder;
    }

    public void setSequenceOrder(int sequenceOrder) {
        this.sequenceOrder = sequenceOrder;
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

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        this.subjectName = subjectName;
    }

    public StudyBlockModality getModality() {
        return modality;
    }

    public void setModality(StudyBlockModality modality) {
        this.modality = modality;
    }

    public int getTargetMinutes() {
        return targetMinutes;
    }

    public void setTargetMinutes(int targetMinutes) {
        this.targetMinutes = targetMinutes;
    }

    public int getTargetQuestionsCount() {
        return targetQuestionsCount;
    }

    public void setTargetQuestionsCount(int targetQuestionsCount) {
        this.targetQuestionsCount = targetQuestionsCount;
    }

    public double getPriorityScore() {
        return priorityScore;
    }

    public void setPriorityScore(double priorityScore) {
        this.priorityScore = priorityScore;
    }

    public int getPretestingQuestionsCount() {
        return pretestingQuestionsCount;
    }

    public void setPretestingQuestionsCount(int pretestingQuestionsCount) {
        this.pretestingQuestionsCount = pretestingQuestionsCount;
    }

    public int getMaxTheoryMinutes() {
        return maxTheoryMinutes;
    }

    public void setMaxTheoryMinutes(int maxTheoryMinutes) {
        this.maxTheoryMinutes = maxTheoryMinutes;
    }

    public String getPrescriptionRationale() {
        return prescriptionRationale;
    }

    public void setPrescriptionRationale(String prescriptionRationale) {
        this.prescriptionRationale = prescriptionRationale;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }
}
