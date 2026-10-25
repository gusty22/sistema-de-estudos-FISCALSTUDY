package com.fiscalstudy.backend.domain.knowledge;

/**
 * Calculadora pura e determinística de métricas cognitivas e calibração de confiança.
 * Não utiliza IA generativa nem redes probabilísticas não-auditáveis.
 */
public final class CognitiveMetricsCalculator {

    private CognitiveMetricsCalculator() {}

    /**
     * Converte nível ordinal de confiança (1 a 5) antes do gabarito em probabilidade subjetiva auditável:
     * 1 (Chute cego) -> 0.20
     * 2 (Inseguro / eliminou 1) -> 0.35
     * 3 (Dúvida entre duas) -> 0.50
     * 4 (Confiante) -> 0.75
     * 5 (Certeza absoluta) -> 0.95
     */
    public static double mapConfidenceToProbability(int confidenceLevel) {
        return switch (confidenceLevel) {
            case 1 -> 0.20;
            case 2 -> 0.35;
            case 3 -> 0.50;
            case 4 -> 0.75;
            case 5 -> 0.95;
            default -> 0.50;
        };
    }

    /**
     * Calcula o erro quadrático individual de calibração (termo do Brier Score).
     * @param confidenceLevel Nível 1 a 5 informado
     * @param isCorrect Se a resposta foi correta
     * @return (p_i - y_i)^2
     */
    public static double computeSingleBrierLoss(int confidenceLevel, boolean isCorrect) {
        double p = mapConfidenceToProbability(confidenceLevel);
        double y = isCorrect ? 1.0 : 0.0;
        double diff = p - y;
        return diff * diff;
    }

    /**
     * Determina a classificação da calibração a partir do Brier Score acumulado.
     */
    public static String classifyCalibrationStatus(int sampleSize, double brierScore) {
        if (sampleSize < 5) {
            return "INSUFFICIENT_DATA";
        }
        if (brierScore <= 0.15) {
            return "WELL_CALIBRATED";
        } else if (brierScore <= 0.25) {
            return "MODERATELY_CALIBRATED";
        } else {
            return "POORLY_CALIBRATED";
        }
    }

    /**
     * Determina o nível de incerteza da estimativa baseado no tamanho amostral empírico legítimo.
     */
    public static String classifySampleConfidence(int sampleSize) {
        if (sampleSize < 5) {
            return "UNCERTAIN_LOW_DATA";
        } else if (sampleSize < 20) {
            return "MODERATE_DATA";
        } else {
            return "ROBUST_DATA";
        }
    }
}
