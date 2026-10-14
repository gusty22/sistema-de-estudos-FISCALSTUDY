package com.fiscalstudy.backend.domain.cognitive;

public enum ProficiencyStage {
    STAGE_1_BEGINNER,      // Mastery < 40%
    STAGE_2_CONSOLIDATION, // 40% <= Mastery < 75%
    STAGE_3_MASTERY;       // Mastery >= 75% e >= 3 reaprendizagens consecutivas

    public static ProficiencyStage fromMastery(double confidenceAdjustedMastery, int consecutiveRelearningSuccesses) {
        if (confidenceAdjustedMastery >= 0.75 && consecutiveRelearningSuccesses >= 3) {
            return STAGE_3_MASTERY;
        }
        if (confidenceAdjustedMastery >= 0.40) {
            return STAGE_2_CONSOLIDATION;
        }
        return STAGE_1_BEGINNER;
    }
}
