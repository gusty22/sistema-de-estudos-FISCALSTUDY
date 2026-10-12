package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.Map;

public class AnalyticsOverviewDTO {
    private int totalAnswered;
    private int evaluatedCount;
    private int correctCount;
    private int errorCount;
    private double globalAccuracy;
    private long totalActiveTimeMs;
    private double averageTimePerQuestionMs;
    private int overconfidenceCount;
    private int underconfidenceCount;
    private int wellCalibratedCount;
    private Map<String, DisciplineStatDTO> byDiscipline;
    private DiagnosticGuidanceDTO guidance;

    public AnalyticsOverviewDTO() {}

    public AnalyticsOverviewDTO(int totalAnswered, int evaluatedCount, int correctCount, int errorCount,
                                double globalAccuracy, long totalActiveTimeMs, double averageTimePerQuestionMs,
                                int overconfidenceCount, int underconfidenceCount, int wellCalibratedCount,
                                Map<String, DisciplineStatDTO> byDiscipline, DiagnosticGuidanceDTO guidance) {
        this.totalAnswered = totalAnswered;
        this.evaluatedCount = evaluatedCount;
        this.correctCount = correctCount;
        this.errorCount = errorCount;
        this.globalAccuracy = globalAccuracy;
        this.totalActiveTimeMs = totalActiveTimeMs;
        this.averageTimePerQuestionMs = averageTimePerQuestionMs;
        this.overconfidenceCount = overconfidenceCount;
        this.underconfidenceCount = underconfidenceCount;
        this.wellCalibratedCount = wellCalibratedCount;
        this.byDiscipline = byDiscipline;
        this.guidance = guidance;
    }

    public int getTotalAnswered() { return totalAnswered; }
    public int getEvaluatedCount() { return evaluatedCount; }
    public int getCorrectCount() { return correctCount; }
    public int getErrorCount() { return errorCount; }
    public double getGlobalAccuracy() { return globalAccuracy; }
    public long getTotalActiveTimeMs() { return totalActiveTimeMs; }
    public double getAverageTimePerQuestionMs() { return averageTimePerQuestionMs; }
    public int getOverconfidenceCount() { return overconfidenceCount; }
    public int getUnderconfidenceCount() { return underconfidenceCount; }
    public int getWellCalibratedCount() { return wellCalibratedCount; }
    public Map<String, DisciplineStatDTO> getByDiscipline() { return byDiscipline; }
    public DiagnosticGuidanceDTO getGuidance() { return guidance; }

    public static class DisciplineStatDTO {
        public int total;
        public int evaluated;
        public int correct;
        public double accuracy;
        public double avgTimeMs;
        public int overconfidenceCount;

        public DisciplineStatDTO(int total, int evaluated, int correct, double accuracy, double avgTimeMs, int overconfidenceCount) {
            this.total = total;
            this.evaluated = evaluated;
            this.correct = correct;
            this.accuracy = accuracy;
            this.avgTimeMs = avgTimeMs;
            this.overconfidenceCount = overconfidenceCount;
        }
    }

    public static class DiagnosticGuidanceDTO {
        public String observacao;
        public String indicador;
        public String hipotese;
        public String diagnostico;
        public String intervencao;

        public DiagnosticGuidanceDTO(String observacao, String indicador, String hipotese, String diagnostico, String intervencao) {
            this.observacao = observacao;
            this.indicador = indicador;
            this.hipotese = hipotese;
            this.diagnostico = diagnostico;
            this.intervencao = intervencao;
        }
    }
}
