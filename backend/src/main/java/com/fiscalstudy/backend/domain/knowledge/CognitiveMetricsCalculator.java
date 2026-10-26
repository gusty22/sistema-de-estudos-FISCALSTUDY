package com.fiscalstudy.backend.domain.knowledge;

import java.util.ArrayList;
import java.util.List;

/**
 * Calculadora pura e determinística de métricas observáveis de conhecimento e governança epistêmica.
 * 
 * Regras Científicas Rigorosas:
 * 1. Não converte escala ordinal 1-5 em probabilidades artificiais (20%, 50%, 95%).
 * 2. Não calcula Brier Score sobre probabilidades inventadas.
 * 3. Trata insuficiência amostral sem assumir que N=5 garante suficiência universal.
 * 4. Separa categoricamente fatos observados, métricas ordinais e hipóteses pedagógicas.
 */
public final class CognitiveMetricsCalculator {

    private CognitiveMetricsCalculator() {}

    /**
     * Determina o status da evidência considerando volume de tentativas e diversidade de questões.
     */
    public static String classifyEvidenceStatus(int totalAttempts, int uniqueQuestionsCount) {
        if (totalAttempts <= 0) {
            return "SEM_EVIDENCIAS";
        }
        if (totalAttempts < 10 || uniqueQuestionsCount < 5) {
            return "PRELIMINAR";
        }
        if (totalAttempts < 25 || uniqueQuestionsCount < 10) {
            return "EM_CONSTRUCAO";
        }
        return "CONSOLIDADA";
    }

    /**
     * Denominador explícito de acertos observados.
     */
    public static String formatAccuracyDenominator(int correctAttempts, int totalAttempts) {
        if (totalAttempts <= 0) {
            return "SEM_EVIDENCIAS";
        }
        return correctAttempts + "/" + totalAttempts;
    }

    /**
     * Identifica acerto com baixa confiança declarada (nível ordinal 1 ou 2).
     * Caracteriza acerto inseguro, dúvida resolvida favoravelmente ou chute.
     */
    public static boolean isLowConfidenceSuccess(int confidenceLevel, boolean isCorrect) {
        return isCorrect && confidenceLevel >= 1 && confidenceLevel <= 2;
    }

    /**
     * Identifica erro com alta confiança declarada (nível ordinal 4 ou 5).
     * Caracteriza falsa fluência, ilusão de competência ou pegadinha de banca.
     */
    public static boolean isHighConfidenceError(int confidenceLevel, boolean isCorrect) {
        return !isCorrect && confidenceLevel >= 4 && confidenceLevel <= 5;
    }

    /**
     * Calcula a média aritmética da escala ordinal de confiança (1.0 a 5.0).
     * Deve ser documentada como valor ordinal médio, não probabilidade.
     */
    public static Double computeOrdinalConfidenceMean(List<Integer> confidenceLevels) {
        if (confidenceLevels == null || confidenceLevels.isEmpty()) {
            return null;
        }
        double sum = 0;
        int validCount = 0;
        for (Integer lvl : confidenceLevels) {
            if (lvl != null && lvl >= 1 && lvl <= 5) {
                sum += lvl;
                validCount++;
            }
        }
        if (validCount == 0) return null;
        return Math.round((sum / validCount) * 100.0) / 100.0;
    }

    /**
     * Gera lista estruturada de limitações epistemológicas da amostra.
     */
    public static List<String> buildEpistemicLimitations(
            int totalAttempts,
            int uniqueQuestionsCount,
            int repeatedQuestions,
            int lowConfidenceSuccesses,
            int highConfidenceErrors,
            String evidenceStatus
    ) {
        List<String> limitations = new ArrayList<>();

        limitations.add("Escala de confiança 1-5 tratada como puramente ordinal; Brier Score desativado por ausência de calibração empírica probabilística.");
        limitations.add("Estimativas temporais de memória (FSRS) desvinculadas de nota de domínio conceitual.");
        limitations.add("Tentativas em simulados e retestes registradas como metadado contextual, sem pesos multiplicadores arbitrários.");

        if ("SEM_EVIDENCIAS".equals(evidenceStatus)) {
            limitations.add("Ausência total de tentativas legítimas no tópico. Nenhuma inferência de domínio permitida.");
            return limitations;
        }

        if ("PRELIMINAR".equals(evidenceStatus)) {
            limitations.add(String.format("Amostra preliminar (N=%d em %d questões únicas). Elevada incerteza amostral e suscetibilidade a variância pontual.", totalAttempts, uniqueQuestionsCount));
        }

        if (totalAttempts > 0 && uniqueQuestionsCount > 0 && repeatedQuestions >= uniqueQuestionsCount) {
            limitations.add(String.format("Elevada taxa de repetição (%d tentativas repetidas). Risco de viés de memorização de gabarito específico em detrimento de transferência conceitual.", repeatedQuestions));
        }

        if (highConfidenceErrors > 0) {
            limitations.add(String.format("Detecção de %d erro(s) com alta confiança declarada (nível 4-5), indicando potenciais armadilhas de banca ou ilusão de competência.", highConfidenceErrors));
        }

        if (lowConfidenceSuccesses > 0) {
            limitations.add(String.format("Detecção de %d acerto(s) com baixa confiança (nível 1-2). Sugere consolidação frágil ou acerto casual.", lowConfidenceSuccesses));
        }

        return limitations;
    }

    /**
     * Gera hipóteses pedagógicas honestas com base no padrão observado.
     */
    public static List<String> buildPedagogicalHypotheses(
            int totalAttempts,
            int correctAttempts,
            int uniqueQuestionsCount,
            int highConfidenceErrors,
            int lowConfidenceSuccesses,
            int repeatedQuestions
    ) {
        List<String> hypotheses = new ArrayList<>();
        if (totalAttempts == 0) {
            hypotheses.add("HIPOTESE: Tópico ainda não explorado. Recomenda-se bloco de estudo com questões inéditas de fixação.");
            return hypotheses;
        }

        double acc = (double) correctAttempts / totalAttempts;
        if (acc < 0.60) {
            hypotheses.add("HIPOTESE: Lacuna estrutural de compreensão conceitual ou jurisprudencial. Recomendada revisão de conceitos base.");
        } else if (acc >= 0.85 && uniqueQuestionsCount >= 8) {
            hypotheses.add("HIPOTESE: Domínio consistente demonstrado no conjunto de questões praticadas.");
        }

        if (highConfidenceErrors >= 2) {
            hypotheses.add("HIPOTESE: Ponto cego persistente. O aluno expressa certeza em alternativas incorretas; provável distorção semântica ou pegadinha recorrente.");
        }

        if (lowConfidenceSuccesses >= 2) {
            hypotheses.add("HIPOTESE: Insegurança metaconscienciosa. O aluno acerta mas duvida de seu raciocínio; recomenda-se consolidar a justificativa técnica das assertivas.");
        }

        if (repeatedQuestions > totalAttempts / 2 && totalAttempts >= 6) {
            hypotheses.add("HIPOTESE: Falsa proficiência por reconhecimento de gabarito. Recomendável praticar questões inéditas ou de bancas examinadoras alternativas.");
        }

        return hypotheses;
    }
}
