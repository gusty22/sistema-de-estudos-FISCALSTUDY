package com.fiscalstudy.backend.domain.cognitive;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Motor Algorítmico do Ciclo de Estudos Dinâmico (P x V x I).
 * Implementa:
 * 1. Priorização dinâmica: PriorityScore = (PesoEdital ^ 1.2) * (1.1 - Madj) * (0.5 + IncidenciaBanca)
 * 2. Injeção automática de baterias de recuperação ativa FSRS quando R(t) < 0.88.
 * 3. Prevenção da bola de neve (Anti-snowball governor) limitando revisões a 35% do tempo semanal.
 * 4. Prescrição pedagógica por estágio de proficiência (Iniciante, Consolidação, Domínio).
 * 5. Intercalação (Interleaving) inteligente de disciplinas.
 */
public class DynamicStudyCycleEngine {

    public static final double MAX_REVIEW_PERCENTAGE = 0.35; // 35% do tempo semanal
    public static final double REVIEW_RETENTION_THRESHOLD = 0.88; // R < 88%

    private final FsrsEngine fsrsEngine;

    public DynamicStudyCycleEngine() {
        this(new FsrsEngine());
    }

    public DynamicStudyCycleEngine(FsrsEngine fsrsEngine) {
        this.fsrsEngine = fsrsEngine;
    }

    /**
     * Calcula a pontuação de prioridade P x V x I de um tópico no edital:
     * PriorityScore(i) = (PesoEdital_i ^ 1.2) * (1.1 - MasteryAjustado_i) * (0.5 + IncidenciaBanca_i)
     */
    public double calculatePriorityScore(TopicStudyProfile topic) {
        double weightFactor = Math.pow(topic.getSubjectWeight(), 1.2);
        double masteryFactor = Math.max(1.1 - topic.getConfidenceAdjustedMastery(), 0.05);
        double incidenceFactor = 0.5 + topic.getHistoricalIncidence();
        return weightFactor * masteryFactor * incidenceFactor;
    }

    /**
     * Gera o ciclo circular completo de blocos de estudos com base nos perfis dos tópicos e disponibilidade.
     */
    public StudyCycleGenerationResult generateCycle(
            List<TopicStudyProfile> topics,
            double weeklyHoursAvailable,
            int standardBlockMinutes,
            Instant now
    ) {
        if (topics == null || topics.isEmpty()) {
            return new StudyCycleGenerationResult(Collections.emptyList(), 0, 0, 0.0, false, 0);
        }

        int blockDuration = standardBlockMinutes > 0 ? standardBlockMinutes : 50;
        double weeklyMinutes = Math.max(weeklyHoursAvailable, 5.0) * 60.0;
        int totalWeeklyBlocks = (int) Math.round(weeklyMinutes / blockDuration);
        int maxReviewBlocksAllowed = (int) Math.floor((weeklyMinutes * MAX_REVIEW_PERCENTAGE) / blockDuration);

        // 1. Identificar tópicos necessitando de revisão espaçada (R(t) < 0.88)
        List<ReviewCandidate> reviewCandidates = new ArrayList<>();
        for (TopicStudyProfile topic : topics) {
            TopicMastery mastery = topic.getMastery();
            if (mastery != null && mastery.getFsrsStability() > 0.0 && mastery.getLastReviewedAt() != null) {
                double r = mastery.toFsrsCardState().getRetrievability(now);
                if (r < REVIEW_RETENTION_THRESHOLD) {
                    double priority = calculatePriorityScore(topic);
                    reviewCandidates.add(new ReviewCandidate(topic, r, priority));
                }
            }
        }

        // Ordenar candidatos a revisão: menor recuperabilidade primeiro, desempate por maior prioridade
        reviewCandidates.sort(Comparator
                .comparingDouble(ReviewCandidate::getRetrievability)
                .thenComparing((a, b) -> Double.compare(b.getPriority(), a.getPriority())));

        // 2. Prevenção da Bola de Neve (Anti-Snowball Governor)
        boolean governorTriggered = false;
        int pausedLowIncidenceCount = 0;
        List<ReviewCandidate> approvedReviews;

        if (reviewCandidates.size() > maxReviewBlocksAllowed) {
            governorTriggered = true;
            approvedReviews = reviewCandidates.subList(0, maxReviewBlocksAllowed);
        } else {
            approvedReviews = reviewCandidates;
        }

        // 3. Seleção e ordenação dos blocos de avanço pedagógico
        List<TopicStudyProfile> advancementTopics = new ArrayList<>(topics);

        // Se o regulador estiver ativado, pausa a abertura de tópicos de baixa incidência (Pareto)
        if (governorTriggered) {
            double medianIncidence = calculateMedianIncidence(topics);
            List<TopicStudyProfile> filtered = advancementTopics.stream()
                    .filter(t -> t.getHistoricalIncidence() >= medianIncidence || t.getMastery().getTotalAttempts() > 0)
                    .collect(Collectors.toList());
            pausedLowIncidenceCount = advancementTopics.size() - filtered.size();
            advancementTopics = filtered;
        }

        // Ordenar tópicos de avanço pela fórmula P x V x I (maior prioridade primeiro)
        advancementTopics.sort((a, b) -> Double.compare(calculatePriorityScore(b), calculatePriorityScore(a)));

        // 4. Montar os blocos do ciclo com intercalação (Interleaving)
        List<StudyCycleBlock> cycleBlocks = new ArrayList<>();
        int sequence = 1;

        // Injetar primeiro as revisões aprovadas (Recuperação Ativa prioritária)
        for (ReviewCandidate rev : approvedReviews) {
            StudyCycleBlock block = StudyCycleBlock.createSpacedReviewBlock(
                    sequence++,
                    rev.getTopic().getTopicId(),
                    rev.getTopic().getTopicName(),
                    rev.getTopic().getSubjectName(),
                    blockDuration,
                    rev.getRetrievability(),
                    rev.getPriority()
            );
            cycleBlocks.add(block);
        }

        // Intercalar blocos de avanço entre as matérias para evitar blocos consecutivos da mesma matéria
        List<TopicStudyProfile> interleavedAdvancement = interleaveSubjects(advancementTopics);

        for (TopicStudyProfile topic : interleavedAdvancement) {
            double priority = calculatePriorityScore(topic);
            ProficiencyStage stage = topic.getMastery().getProficiencyStage();
            StudyCycleBlock block = StudyCycleBlock.createPedagogicalBlock(
                    sequence++,
                    topic.getTopicId(),
                    topic.getTopicName(),
                    topic.getSubjectName(),
                    stage,
                    blockDuration,
                    priority
            );
            cycleBlocks.add(block);
        }

        int totalReviewCount = approvedReviews.size();
        int totalAdvancementCount = cycleBlocks.size() - totalReviewCount;
        double totalReviewMinutes = totalReviewCount * blockDuration;
        double reviewTimePercentage = weeklyMinutes > 0.0 ? totalReviewMinutes / weeklyMinutes : 0.0;

        return new StudyCycleGenerationResult(
                cycleBlocks,
                totalReviewCount,
                totalAdvancementCount,
                reviewTimePercentage,
                governorTriggered,
                pausedLowIncidenceCount
        );
    }

    /**
     * Intercala os tópicos para que disciplinas diferentes alternem suavemente.
     */
    private List<TopicStudyProfile> interleaveSubjects(List<TopicStudyProfile> topics) {
        if (topics.size() <= 2) {
            return new ArrayList<>(topics);
        }

        Map<String, List<TopicStudyProfile>> bySubject = new LinkedHashMap<>();
        for (TopicStudyProfile t : topics) {
            bySubject.computeIfAbsent(t.getSubjectName(), k -> new ArrayList<>()).add(t);
        }

        List<TopicStudyProfile> result = new ArrayList<>(topics.size());
        boolean hasRemaining = true;
        while (hasRemaining) {
            hasRemaining = false;
            for (List<TopicStudyProfile> subList : bySubject.values()) {
                if (!subList.isEmpty()) {
                    result.add(subList.remove(0));
                    hasRemaining = true;
                }
            }
        }
        return result;
    }

    private double calculateMedianIncidence(List<TopicStudyProfile> topics) {
        if (topics.isEmpty()) return 0.0;
        List<Double> incidences = topics.stream()
                .map(TopicStudyProfile::getHistoricalIncidence)
                .sorted()
                .collect(Collectors.toList());
        return incidences.get(incidences.size() / 2);
    }

    private static class ReviewCandidate {
        private final TopicStudyProfile topic;
        private final double retrievability;
        private final double priority;

        public ReviewCandidate(TopicStudyProfile topic, double retrievability, double priority) {
            this.topic = topic;
            this.retrievability = retrievability;
            this.priority = priority;
        }

        public TopicStudyProfile getTopic() {
            return topic;
        }

        public double getRetrievability() {
            return retrievability;
        }

        public double getPriority() {
            return priority;
        }
    }
}
