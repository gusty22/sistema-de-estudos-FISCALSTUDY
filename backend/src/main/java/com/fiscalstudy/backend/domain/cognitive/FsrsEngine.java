package com.fiscalstudy.backend.domain.cognitive;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Motor Matemático do Algoritmo FSRS (v6 reference core).
 * Implementa o núcleo matemático de referência; estimativas requerem calibração.
 * Calcula os cálculos de Estabilidade (S),
 * Dificuldade (D), Recuperabilidade (R) e Intervalo Ótimo de Revisão.
 */
public class FsrsEngine {

    private final FsrsParameters params;

    public FsrsEngine() {
        this(new FsrsParameters());
    }

    public FsrsEngine(FsrsParameters params) {
        this.params = params;
    }

    public FsrsParameters getParams() {
        return params;
    }

    /**
     * Calcula a Recuperabilidade R(t) com base na fórmula exata do FSRS v5:
     * R(t) = (1 + factor * (t / S)) ^ (-w20)
     */
    public double calculateRetrievability(double stability, double elapsedDays) {
        if (!Double.isFinite(stability) || !Double.isFinite(elapsedDays)) throw new IllegalArgumentException("Non-finite FSRS state/time");
        if (stability <= 0.0) {
            return 0.0;
        }
        if (elapsedDays <= 0.0) {
            return 1.0;
        }
        double factor = FsrsParameters.RETRIEVABILITY_FACTOR;
        double decay = FsrsParameters.RETRIEVABILITY_DECAY;
        return Math.pow(1.0 + factor * (elapsedDays / stability), decay);
    }

    /**
     * Calcula o Intervalo Ótimo (em dias) para atingir a taxa de retenção solicitada (ex.: 90%).
     * I = (S * (R^(-1/decay) - 1)) / factor
     * Para decay = -0.5 e factor = 19/81, quando R = 0.90 => I = S.
     */
    public double calculateOptimalInterval(double stability, double requestRetention) {
        if (stability <= 0.0) {
            return 1.0;
        }
        double factor = FsrsParameters.RETRIEVABILITY_FACTOR;
        double decay = FsrsParameters.RETRIEVABILITY_DECAY;
        if (!Double.isFinite(requestRetention) || requestRetention <= 0 || requestRetention > 1) throw new IllegalArgumentException("Invalid retention");
        double targetR = requestRetention;
        double interval = (stability * (Math.pow(targetR, 1.0 / decay) - 1.0)) / factor;
        return Math.min(Math.max(Math.round(interval), 1.0), params.getMaximumInterval());
    }

    /**
     * Calibração Metacognitiva: avalia uma tentativa com base no acerto e nível de confiança.
     * Aplica a Regra do Falso Positivo (chute cego) e o Gatilho de Hipercorreção.
     */
    public FsrsEvaluationResult evaluateAttempt(boolean isCorrect, ConfidenceLevel confidence) {
        if (confidence == null) {
            confidence = ConfidenceLevel.DOUBT_BETWEEN_TWO;
        }

        if (!isCorrect) {
            // Erro
            if (confidence == ConfidenceLevel.CERTAIN) {
                // Hipercorreção: errou com certeza
                return new FsrsEvaluationResult(
                        FsrsRating.AGAIN,
                        false,
                        true,
                        true,
                        true,
                        "Hipercorreção: Erro cometido com certeza absoluta. Exige autoexplicação e agendamento de questão gêmea em 48h."
                );
            }
            return new FsrsEvaluationResult(
                    FsrsRating.AGAIN,
                    false,
                    false,
                    false,
                    false,
                    "Falha de retenção diagnosticada."
            );
        }

        // Acerto
        if (confidence == ConfidenceLevel.BLIND_GUESS) {
            // Regra do Falso Positivo: acerto por sorte é penalizado como falha de retenção
            return new FsrsEvaluationResult(
                    FsrsRating.AGAIN,
                    true,
                    false,
                    true,
                    false,
                    "Falso Positivo: Questão acertada por chute cego. Tratado como falha de retenção no FSRS."
            );
        }

        if (confidence == ConfidenceLevel.DOUBT_BETWEEN_TWO) {
            return new FsrsEvaluationResult(
                    FsrsRating.HARD,
                    false,
                    false,
                    false,
                    false,
                    "Acerto com dúvida (50/50). Estabilidade incrementada moderadamente."
            );
        }

        // CERTAIN
        return new FsrsEvaluationResult(
                FsrsRating.GOOD,
                false,
                false,
                false,
                false,
                "Acerto com certeza plena. Estabilidade expandida conforme curva FSRS."
        );
    }

    /**
     * Dificuldade inicial D0(G) para um novo item.
     */
    public double initDifficulty(FsrsRating rating) {
        int g = rating.getValue();
        double d = params.getW(4) - Math.exp((g - 1) * params.getW(5)) + 1.0;
        return clamp(d, 1.0, 10.0);
    }

    /**
     * Estabilidade inicial S0(G) para um novo item.
     */
    public double initStability(FsrsRating rating) {
        int g = rating.getValue();
        return Math.max(params.getW(g - 1), 0.1);
    }

    /**
     * Próxima dificuldade D' com amortecimento linear e reversão à média.
     */
    public double nextDifficulty(double currentD, FsrsRating rating) {
        int g = rating.getValue();
        double deltaD = -params.getW(6) * (g - 3);
        double dampedDelta = (deltaD * (10.0 - currentD)) / 9.0;
        double nextD = currentD + dampedDelta;
        double initD4 = params.getW(4) - Math.exp(3 * params.getW(5)) + 1.0;
        double meanReverted = params.getW(7) * initD4 + (1.0 - params.getW(7)) * nextD;
        return clamp(meanReverted, 1.0, 10.0);
    }

    /**
     * Nova estabilidade após lembrança bem-sucedida (Grade >= HARD).
     */
    public double nextRecallStability(double d, double s, double r, FsrsRating rating) {
        int g = rating.getValue();
        double hardPenalty = (rating == FsrsRating.HARD) ? params.getW(15) : 1.0;
        double easyBonus = (rating == FsrsRating.EASY) ? params.getW(16) : 1.0;

        double factor = Math.exp(params.getW(8)) *
                (11.0 - d) *
                Math.pow(s, -params.getW(9)) *
                (Math.exp((1.0 - r) * params.getW(10)) - 1.0) *
                hardPenalty *
                easyBonus;

        double nextS = s * (1.0 + factor);
        return clamp(nextS, FsrsParameters.MIN_STABILITY, params.getMaximumInterval());
    }

    /**
     * Nova estabilidade após esquecimento ou falso positivo (Grade == AGAIN).
     */
    public double nextForgetStability(double d, double s, double r) {
        double nextS = params.getW(11) *
                Math.pow(d, -params.getW(12)) *
                (Math.pow(s + 1.0, params.getW(13)) - 1.0) *
                Math.exp((1.0 - r) * params.getW(14));

        // Por segurança, a estabilidade após esquecimento não deve ultrapassar a estabilidade anterior
        nextS = Math.min(nextS, s / Math.exp(params.getW(17) * params.getW(18)));
        return clamp(nextS, FsrsParameters.MIN_STABILITY, params.getMaximumInterval());
    }

    /**
     * Calcula a transição completa de estado FSRS dado o estado anterior, o rating e o instante atual.
     */
    public FsrsCardState calculateNextState(FsrsCardState current, FsrsRating rating, Instant now) {
        if (rating == null || now == null) throw new IllegalArgumentException("Rating and review instant are required");
        if (current != null && (!Double.isFinite(current.getStability()) || !Double.isFinite(current.getDifficulty()))) throw new IllegalArgumentException("Invalid memory state");
        if (current == null || current.getLastReviewedAt() == null || current.getStability() <= 0.0) {
            // Primeiro aprendizado do item
            double initS = initStability(rating);
            double initD = initDifficulty(rating);
            int reps = (rating == FsrsRating.AGAIN) ? 0 : 1;
            int lapses = (rating == FsrsRating.AGAIN) ? 1 : 0;
            double interval = calculateOptimalInterval(initS, params.getRequestRetention());
            Instant due = now.plus((long) interval, ChronoUnit.DAYS);
            return FsrsCardState.of(initS, initD, reps, lapses, now, due);
        }

        if (now.isBefore(current.getLastReviewedAt())) throw new IllegalArgumentException("Review predates current state");
        double elapsedDays = Math.floor(current.getElapsedDays(now));
        double r = calculateRetrievability(current.getStability(), elapsedDays);
        double nextD = nextDifficulty(current.getDifficulty(), rating);

        double nextS;
        int nextReps = current.getReps();
        int nextLapses = current.getLapses();

        if (elapsedDays < 1.0) {
            double factor = Math.pow(current.getStability(), -params.getW(19)) * Math.exp(params.getW(17) * (rating.getValue() - 3 + params.getW(18)));
            if (rating != FsrsRating.AGAIN) factor = Math.max(factor, 1.0);
            nextS = clamp(current.getStability() * factor, FsrsParameters.MIN_STABILITY, 36500.0);
            if (rating == FsrsRating.AGAIN) nextLapses++; else nextReps++;
        } else if (rating == FsrsRating.AGAIN) {
            nextS = nextForgetStability(current.getDifficulty(), current.getStability(), r);
            nextLapses++;
        } else {
            nextS = nextRecallStability(current.getDifficulty(), current.getStability(), r, rating);
            nextReps++;
        }

        double interval = calculateOptimalInterval(nextS, params.getRequestRetention());
        Instant due = now.plus((long) interval, ChronoUnit.DAYS);

        return FsrsCardState.of(nextS, nextD, nextReps, nextLapses, now, due);
    }

    private double clamp(double value, double min, double max) {
        return Math.min(Math.max(value, min), max);
    }
}
