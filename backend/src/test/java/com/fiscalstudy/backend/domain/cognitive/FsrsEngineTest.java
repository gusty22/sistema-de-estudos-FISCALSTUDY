package com.fiscalstudy.backend.domain.cognitive;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes do Motor FSRS v5 e Calibração Metacognitiva")
class FsrsEngineTest {

    private FsrsEngine engine;

    @BeforeEach
    void setUp() {
        engine = new FsrsEngine();
    }

    @Test
    @DisplayName("Cálculo exato da fórmula de Recuperabilidade R(t) = (1 + (19/81) * (t/S)) ^ (-0.5)")
    void testRetrievabilityCalculation() {
        double stability = 10.0; // 10 dias
        // t = 0 dias -> R = 1.0 (100%)
        assertEquals(1.0, engine.calculateRetrievability(stability, 0.0), 0.0001);

        // t = S (10 dias) com decay = -0.5 e factor = 19/81:
        // R(10, 10) = (1 + 19/81 * 1)^(-0.5) = (100/81)^(-0.5) = (10/9)^(-1) = 9/10 = 0.90!
        double rAtTequalsS = engine.calculateRetrievability(stability, 10.0);
        assertEquals(0.90, rAtTequalsS, 0.0001, "Quando t = S, a recuperabilidade R deve ser exatamente 0.90 (90%)");

        // t = 20 dias (2 * S):
        // (1 + (19/81)*2)^(-0.5) = (1 + 38/81)^(-0.5) = (119/81)^(-0.5) = 9 / sqrt(119) ~= 9 / 10.9087 ~= 0.825
        double rAtT2S = engine.calculateRetrievability(stability, 20.0);
        assertTrue(rAtT2S < 0.90 && rAtT2S > 0.80, "Recuperabilidade deve decair suavemente com o tempo");
    }

    @Test
    @DisplayName("Cálculo do Intervalo Ótimo para retenção de 90% deve ser igual à estabilidade S")
    void testOptimalIntervalCalculation() {
        double stability = 14.0;
        double interval = engine.calculateOptimalInterval(stability, 0.90);
        assertEquals(14.0, interval, 0.001, "Com R=0.90, o intervalo ótimo deve coincidir perfeitamente com S");
    }

    @Test
    @DisplayName("Regra do Falso Positivo: Chute cego que acertou por sorte é penalizado como falha de retenção (AGAIN)")
    void testFalsePositiveBlindGuessHandling() {
        FsrsEvaluationResult eval = engine.evaluateAttempt(true, ConfidenceLevel.BLIND_GUESS);

        assertEquals(FsrsRating.AGAIN, eval.getEffectiveRating(), "Chute cego deve ser rebaixado para AGAIN");
        assertTrue(eval.isFalsePositive(), "Deve sinalizar como falso positivo");
        assertTrue(eval.isRequiresSelfExplanation(), "Deve exigir diagnóstico no caderno de erros");
    }

    @Test
    @DisplayName("Gatilho de Hipercorreção: Erro cometido com certeza absoluta dispara autoexplicação e questão gêmea")
    void testHypercorrectionEffect() {
        FsrsEvaluationResult eval = engine.evaluateAttempt(false, ConfidenceLevel.CERTAIN);

        assertEquals(FsrsRating.AGAIN, eval.getEffectiveRating());
        assertTrue(eval.isHypercorrectionTriggered(), "Deve ativar gatilho de hipercorreção");
        assertTrue(eval.isRequiresSelfExplanation(), "Deve exigir autoexplicação da premissa incorreta");
        assertTrue(eval.isScheduleTwinIn48Hours(), "Deve agendar questão gêmea para 48h depois");
    }

    @Test
    @DisplayName("Resolução com Certeza incrementa estabilidade e programa próximo intervalo")
    void testCertainCorrectAnswerExpandsStability() {
        Instant now = Instant.now();
        FsrsEvaluationResult eval = engine.evaluateAttempt(true, ConfidenceLevel.CERTAIN);
        assertEquals(FsrsRating.GOOD, eval.getEffectiveRating());

        // Primeira tentativa
        FsrsCardState state1 = engine.calculateNextState(FsrsCardState.initial(), eval.getEffectiveRating(), now);
        assertTrue(state1.getStability() > 1.0, "Estabilidade inicial deve ser positiva");
        assertEquals(1, state1.getReps());
        assertEquals(0, state1.getLapses());
        assertNotNull(state1.getDue());

        // Segunda tentativa após 5 dias
        Instant fiveDaysLater = now.plus(5, ChronoUnit.DAYS);
        FsrsCardState state2 = engine.calculateNextState(state1, FsrsRating.GOOD, fiveDaysLater);
        assertTrue(state2.getStability() > state1.getStability(), "Estabilidade deve expandir na repetição bem-sucedida");
        assertEquals(2, state2.getReps());
    }

    @Test
    @DisplayName("Esquecimento (Lapse) reduz a estabilidade S")
    void testLapseReducesStability() {
        Instant now = Instant.now();
        // Estado consolidado com estabilidade de 20 dias
        FsrsCardState strongState = FsrsCardState.of(20.0, 4.0, 5, 0, now.minus(25, ChronoUnit.DAYS), now);

        FsrsCardState postLapseState = engine.calculateNextState(strongState, FsrsRating.AGAIN, now);
        assertTrue(postLapseState.getStability() < strongState.getStability(), "Lapse deve reduzir a estabilidade");
        assertEquals(1, postLapseState.getLapses(), "Contador de lapses deve ser incrementado");
    }
}
