package com.fiscalstudy.backend.domain.cognitive;

import java.util.List;

/**
 * Resultado da geração dinâmica do ciclo de estudos,
 * contendo os blocos prescritos e telemetria sobre o regulador anti-bola de neve.
 */
public class StudyCycleGenerationResult {

    private final List<StudyCycleBlock> blocks;
    private final int totalReviewBlocks;
    private final int totalAdvancementBlocks;
    private final double reviewTimePercentage;
    private final boolean antiSnowballGovernorTriggered;
    private final int pausedLowIncidenceTopicsCount;

    public StudyCycleGenerationResult(
            List<StudyCycleBlock> blocks,
            int totalReviewBlocks,
            int totalAdvancementBlocks,
            double reviewTimePercentage,
            boolean antiSnowballGovernorTriggered,
            int pausedLowIncidenceTopicsCount
    ) {
        this.blocks = blocks;
        this.totalReviewBlocks = totalReviewBlocks;
        this.totalAdvancementBlocks = totalAdvancementBlocks;
        this.reviewTimePercentage = reviewTimePercentage;
        this.antiSnowballGovernorTriggered = antiSnowballGovernorTriggered;
        this.pausedLowIncidenceTopicsCount = pausedLowIncidenceTopicsCount;
    }

    public List<StudyCycleBlock> getBlocks() {
        return blocks;
    }

    public int getTotalReviewBlocks() {
        return totalReviewBlocks;
    }

    public int getTotalAdvancementBlocks() {
        return totalAdvancementBlocks;
    }

    public double getReviewTimePercentage() {
        return reviewTimePercentage;
    }

    public boolean isAntiSnowballGovernorTriggered() {
        return antiSnowballGovernorTriggered;
    }

    public int getPausedLowIncidenceTopicsCount() {
        return pausedLowIncidenceTopicsCount;
    }
}
