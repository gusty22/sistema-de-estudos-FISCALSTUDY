package com.fiscalstudy.backend.domain.cognitive;

import java.time.Duration;
import java.time.Instant;

/**
 * Estado cognitivo de um item no modelo FSRS (Estabilidade, Dificuldade, Recuperabilidade).
 */
public class FsrsCardState {

    private final double stability;      // S em dias
    private final double difficulty;     // D entre 1.0 e 10.0
    private final int reps;              // Número de revisões bem-sucedidas
    private final int lapses;            // Número de esquecimentos / falhas
    private final Instant lastReviewedAt;// Data da última resolução / revisão
    private final Instant due;           // Data prevista para a próxima revisão

    public FsrsCardState(double stability, double difficulty, int reps, int lapses, Instant lastReviewedAt, Instant due) {
        this.stability = Math.max(stability, 0.0);
        this.difficulty = Math.min(Math.max(difficulty, 1.0), 10.0);
        this.reps = reps;
        this.lapses = lapses;
        this.lastReviewedAt = lastReviewedAt;
        this.due = due;
    }

    public static FsrsCardState initial() {
        return new FsrsCardState(0.0, 5.0, 0, 0, null, null);
    }

    public static FsrsCardState of(double stability, double difficulty, int reps, int lapses, Instant lastReviewedAt, Instant due) {
        return new FsrsCardState(stability, difficulty, reps, lapses, lastReviewedAt, due);
    }

    public double getStability() {
        return stability;
    }

    public double getDifficulty() {
        return difficulty;
    }

    public int getReps() {
        return reps;
    }

    public int getLapses() {
        return lapses;
    }

    public Instant getLastReviewedAt() {
        return lastReviewedAt;
    }

    public Instant getDue() {
        return due;
    }

    /**
     * Calcula o tempo decorrido em dias fracionários desde a última revisão.
     */
    public double getElapsedDays(Instant now) {
        if (lastReviewedAt == null) {
            return 0.0;
        }
        long seconds = Duration.between(lastReviewedAt, now).getSeconds();
        return Math.max(0.0, seconds / 86400.0);
    }

    /**
     * Calcula a recuperabilidade R(t) atual utilizando a fórmula exata do FSRS v5:
     * R(t) = (1 + (19/81) * (t / S)) ^ (-0.5)
     */
    public double getRetrievability(Instant now) {
        if (stability <= 0.0 || lastReviewedAt == null) {
            return 0.0;
        }
        double t = getElapsedDays(now);
        return Math.pow(1.0 + FsrsParameters.RETRIEVABILITY_FACTOR * (t / stability), FsrsParameters.RETRIEVABILITY_DECAY);
    }

    @Override
    public String toString() {
        return "FsrsCardState{" +
                "S=" + String.format("%.2f", stability) +
                ", D=" + String.format("%.2f", difficulty) +
                ", reps=" + reps +
                ", lapses=" + lapses +
                ", due=" + due +
                '}';
    }
}
