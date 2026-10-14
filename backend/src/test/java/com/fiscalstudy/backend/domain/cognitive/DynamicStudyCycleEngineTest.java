package com.fiscalstudy.backend.domain.cognitive;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes do Motor do Ciclo de Estudos Dinâmico (P x V x I)")
class DynamicStudyCycleEngineTest {

    private DynamicStudyCycleEngine cycleEngine;
    private FsrsEngine fsrsEngine;

    @BeforeEach
    void setUp() {
        fsrsEngine = new FsrsEngine();
        cycleEngine = new DynamicStudyCycleEngine(fsrsEngine);
    }

    @Test
    @DisplayName("Cálculo exato da fórmula de Prioridade: PriorityScore = (Peso^1.2) * (1.1 - Madj) * (0.5 + Incidencia)")
    void testPriorityScoreFormula() {
        UUID topicId = UUID.randomUUID();
        TopicMastery mastery = new TopicMastery(UUID.randomUUID(), topicId, "Direito Tributário - Crédito Tributário");
        mastery.setConfidenceAdjustedMastery(0.20); // 20% domínio

        double weight = 2.0;
        double incidence = 0.30;
        TopicStudyProfile profile = new TopicStudyProfile(topicId, "Crédito Tributário", "Direito Tributário", weight, incidence, mastery);

        double score = cycleEngine.calculatePriorityScore(profile);

        // Esperado: (2.0 ^ 1.2) * (1.1 - 0.20) * (0.5 + 0.30)
        // 2.0 ^ 1.2 ~= 2.2973967
        // 1.1 - 0.20 = 0.90
        // 0.5 + 0.30 = 0.80
        // 2.2973967 * 0.90 * 0.80 ~= 1.654125
        double expected = Math.pow(2.0, 1.2) * 0.90 * 0.80;
        assertEquals(expected, score, 0.0001);
    }

    @Test
    @DisplayName("Tópico de alta incidência e baixo domínio deve ter prioridade muito superior a tópico dominado")
    void testPriorityRanking() {
        TopicMastery urgentMastery = new TopicMastery();
        urgentMastery.setConfidenceAdjustedMastery(0.10);

        TopicMastery masteredMastery = new TopicMastery();
        masteredMastery.setConfidenceAdjustedMastery(0.95);

        TopicStudyProfile urgentTopic = new TopicStudyProfile(UUID.randomUUID(), "ICMS - Substituição", "Legislação Tributária", 3.0, 0.40, urgentMastery);
        TopicStudyProfile masteredTopic = new TopicStudyProfile(UUID.randomUUID(), "Noções de Arquivologia", "Administração Geral", 1.0, 0.05, masteredMastery);

        double urgentScore = cycleEngine.calculatePriorityScore(urgentTopic);
        double masteredScore = cycleEngine.calculatePriorityScore(masteredTopic);

        assertTrue(urgentScore > masteredScore * 5.0, "Tópico urgente deve ter pontuação muito mais alta");
    }

    @Test
    @DisplayName("Injeção automática de Bateria de Recuperação Ativa quando R(t) < 0.88")
    void testSpacedReviewInjectionWhenRetrievabilityBelowThreshold() {
        Instant now = Instant.now();
        UUID topicId = UUID.randomUUID();

        TopicMastery mastery = new TopicMastery(UUID.randomUUID(), topicId, "Contabilidade - DFC");
        mastery.setFsrsStability(10.0);
        mastery.setLastReviewedAt(now.minus(15, ChronoUnit.DAYS)); // t = 15 dias para S = 10 -> R ~ 0.85 < 0.88
        mastery.setConfidenceAdjustedMastery(0.60);
        mastery.setProficiencyStage(ProficiencyStage.STAGE_2_CONSOLIDATION);

        TopicStudyProfile topic = new TopicStudyProfile(topicId, "DFC", "Contabilidade Geral", 2.0, 0.25, mastery);

        StudyCycleGenerationResult result = cycleEngine.generateCycle(List.of(topic), 20.0, 50, now);

        assertEquals(1, result.getTotalReviewBlocks(), "Deve conter 1 bloco de revisão espaçada");
        StudyCycleBlock reviewBlock = result.getBlocks().get(0);
        assertEquals(StudyBlockModality.SPACED_REVIEW_BATTERY, reviewBlock.getModality());
        assertTrue(reviewBlock.getPrescriptionRationale().contains("Bateria de Recuperação Ativa FSRS"));
    }

    @Test
    @DisplayName("Prevenção da Bola de Neve: limita revisões a no máximo 35% do tempo e pausa tópicos frios")
    void testAntiSnowballGovernorLimitsReviewsTo35Percent() {
        Instant now = Instant.now();
        List<TopicStudyProfile> topics = new ArrayList<>();

        // Cria 12 tópicos com R(t) < 0.88
        for (int i = 0; i < 12; i++) {
            UUID id = UUID.randomUUID();
            TopicMastery m = new TopicMastery(UUID.randomUUID(), id, "Tópico " + i);
            m.setFsrsStability(5.0);
            m.setLastReviewedAt(now.minus(10, ChronoUnit.DAYS)); // R < 0.88
            m.setConfidenceAdjustedMastery(0.50);

            double incidence = (i % 2 == 0) ? 0.35 : 0.02; // Tópicos quentes e tópicos frios
            topics.add(new TopicStudyProfile(id, "Tópico " + i, "Matéria " + (i % 3), 1.5, incidence, m));
        }

        // Disponibilidade: 10 horas semanais = 600 min. Com blocos de 50 min => 12 blocos semanais no total.
        // 35% de 600 min = 210 min => máx 4 blocos de revisão (210 / 50 = 4.2 -> 4 blocos).
        StudyCycleGenerationResult result = cycleEngine.generateCycle(topics, 10.0, 50, now);

        assertTrue(result.isAntiSnowballGovernorTriggered(), "Regulador anti-bola de neve deve ser ativado");
        assertEquals(4, result.getTotalReviewBlocks(), "Revisões devem ser limitadas ao teto de 35% (4 blocos)");
        assertTrue(result.getReviewTimePercentage() <= 0.35 + 0.05, "Tempo de revisão deve respeitar o limite de 35%");
        assertTrue(result.getPausedLowIncidenceTopicsCount() > 0, "Tópicos de baixa incidência devem ser pausados");
    }

    @Test
    @DisplayName("Prescrições pedagógicas respeitam os 3 estágios de proficiência")
    void testPedagogicalModalityPrescriptionsByStage() {
        Instant now = Instant.now();

        // 1. Iniciante (< 40%)
        TopicMastery beginnerMastery = new TopicMastery();
        beginnerMastery.setConfidenceAdjustedMastery(0.30);
        beginnerMastery.setProficiencyStage(ProficiencyStage.STAGE_1_BEGINNER);
        TopicStudyProfile beginner = new TopicStudyProfile(UUID.randomUUID(), "Atos Administrativos", "Direito Administrativo", 2.0, 0.20, beginnerMastery);

        // 2. Consolidação (40% <= M < 75%)
        TopicMastery consolidationMastery = new TopicMastery();
        consolidationMastery.setConfidenceAdjustedMastery(0.65);
        consolidationMastery.setProficiencyStage(ProficiencyStage.STAGE_2_CONSOLIDATION);
        TopicStudyProfile consolidation = new TopicStudyProfile(UUID.randomUUID(), "Poderes da Administração", "Direito Administrativo", 2.0, 0.20, consolidationMastery);

        // 3. Domínio (>= 75% e >= 3 sucessos)
        TopicMastery masteryMastery = new TopicMastery();
        masteryMastery.setConfidenceAdjustedMastery(0.85);
        masteryMastery.setConsecutiveRelearningSuccesses(3);
        masteryMastery.setProficiencyStage(ProficiencyStage.STAGE_3_MASTERY);
        TopicStudyProfile mastery = new TopicStudyProfile(UUID.randomUUID(), "Princípios da Administração", "Direito Administrativo", 2.0, 0.20, masteryMastery);

        StudyCycleGenerationResult result = cycleEngine.generateCycle(List.of(beginner, consolidation, mastery), 20.0, 50, now);

        List<StudyCycleBlock> blocks = result.getBlocks();
        assertEquals(3, blocks.size());

        // Verificar prescrição de cada bloco
        StudyCycleBlock b1 = blocks.stream().filter(b -> b.getTopicName().equals("Atos Administrativos")).findFirst().orElseThrow();
        assertEquals(StudyBlockModality.BLOCKED_PRACTICE, b1.getModality());
        assertEquals(3, b1.getPretestingQuestionsCount(), "Iniciante deve ter 3 questões sonda");
        assertEquals(25, b1.getMaxTheoryMinutes(), "Iniciante deve ter máx 25 min de teoria");
        assertEquals(10, b1.getTargetQuestionsCount(), "Iniciante deve ter 10 questões de fixação");

        StudyCycleBlock b2 = blocks.stream().filter(b -> b.getTopicName().equals("Poderes da Administração")).findFirst().orElseThrow();
        assertEquals(StudyBlockModality.REVERSE_STUDY_QUESTIONS, b2.getModality());
        assertEquals(0, b2.getPretestingQuestionsCount());
        assertEquals(0, b2.getMaxTheoryMinutes());

        StudyCycleBlock b3 = blocks.stream().filter(b -> b.getTopicName().equals("Princípios da Administração")).findFirst().orElseThrow();
        assertEquals(StudyBlockModality.INTERLEAVED_PRACTICE, b3.getModality());
        assertEquals(20, b3.getTargetQuestionsCount());
    }
}
