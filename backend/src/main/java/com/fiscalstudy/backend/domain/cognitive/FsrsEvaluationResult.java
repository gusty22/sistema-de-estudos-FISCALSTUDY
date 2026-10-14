package com.fiscalstudy.backend.domain.cognitive;

/**
 * Resultado da calibração metacognitiva de uma resolução de questão,
 * mapeando acerto/erro e nível de certeza para o rating FSRS e gatilhos pedagógicos.
 */
public class FsrsEvaluationResult {

    private final FsrsRating effectiveRating;
    private final boolean falsePositive;         // Chute que acertou por sorte (penalizado como AGAIN)
    private final boolean hypercorrectionTriggered;// Errou tendo certeza (requer autoexplicação e questão gêmea em 48h)
    private final boolean requiresSelfExplanation;
    private final boolean scheduleTwinIn48Hours;
    private final String diagnosticRationale;

    public FsrsEvaluationResult(
            FsrsRating effectiveRating,
            boolean falsePositive,
            boolean hypercorrectionTriggered,
            boolean requiresSelfExplanation,
            boolean scheduleTwinIn48Hours,
            String diagnosticRationale
    ) {
        this.effectiveRating = effectiveRating;
        this.falsePositive = falsePositive;
        this.hypercorrectionTriggered = hypercorrectionTriggered;
        this.requiresSelfExplanation = requiresSelfExplanation;
        this.scheduleTwinIn48Hours = scheduleTwinIn48Hours;
        this.diagnosticRationale = diagnosticRationale;
    }

    public FsrsRating getEffectiveRating() {
        return effectiveRating;
    }

    public boolean isFalsePositive() {
        return falsePositive;
    }

    public boolean isHypercorrectionTriggered() {
        return hypercorrectionTriggered;
    }

    public boolean isRequiresSelfExplanation() {
        return requiresSelfExplanation;
    }

    public boolean isScheduleTwinIn48Hours() {
        return scheduleTwinIn48Hours;
    }

    public String getDiagnosticRationale() {
        return diagnosticRationale;
    }
}
