package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class SessionSummaryDTO {
    private int totalAnswered;
    private int correctCount;
    private double accuracy;
    private double averageTimeMs;
    private int overconfidenceCount;
    private int concursoScore;
    private int anuladasCount;
    private java.util.Map<String, Integer> errorDistribution = new java.util.HashMap<>();

    public SessionSummaryDTO() {}

    public SessionSummaryDTO(int totalAnswered, int correctCount, double accuracy, double averageTimeMs, int overconfidenceCount) {
        this(totalAnswered, correctCount, accuracy, averageTimeMs, overconfidenceCount, correctCount, 0, new java.util.HashMap<>());
    }

    public SessionSummaryDTO(int totalAnswered, int correctCount, double accuracy, double averageTimeMs, int overconfidenceCount, int concursoScore, int anuladasCount) {
        this(totalAnswered, correctCount, accuracy, averageTimeMs, overconfidenceCount, concursoScore, anuladasCount, new java.util.HashMap<>());
    }

    public SessionSummaryDTO(int totalAnswered, int correctCount, double accuracy, double averageTimeMs, int overconfidenceCount, int concursoScore, int anuladasCount, java.util.Map<String, Integer> errorDistribution) {
        this.totalAnswered = totalAnswered;
        this.correctCount = correctCount;
        this.accuracy = accuracy;
        this.averageTimeMs = averageTimeMs;
        this.overconfidenceCount = overconfidenceCount;
        this.concursoScore = concursoScore;
        this.anuladasCount = anuladasCount;
        this.errorDistribution = errorDistribution != null ? errorDistribution : new java.util.HashMap<>();
    }

    public int getTotalAnswered() { return totalAnswered; }
    public void setTotalAnswered(int totalAnswered) { this.totalAnswered = totalAnswered; }
    
    public int getCorrectCount() { return correctCount; }
    public void setCorrectCount(int correctCount) { this.correctCount = correctCount; }
    
    public double getAccuracy() { return accuracy; }
    public void setAccuracy(double accuracy) { this.accuracy = accuracy; }
    
    public double getAverageTimeMs() { return averageTimeMs; }
    public void setAverageTimeMs(double averageTimeMs) { this.averageTimeMs = averageTimeMs; }
    
    public int getOverconfidenceCount() { return overconfidenceCount; }
    public void setOverconfidenceCount(int overconfidenceCount) { this.overconfidenceCount = overconfidenceCount; }

    public int getConcursoScore() { return concursoScore; }
    public void setConcursoScore(int concursoScore) { this.concursoScore = concursoScore; }

    public int getAnuladasCount() { return anuladasCount; }
    public void setAnuladasCount(int anuladasCount) { this.anuladasCount = anuladasCount; }

    public java.util.Map<String, Integer> getErrorDistribution() { return errorDistribution; }
    public void setErrorDistribution(java.util.Map<String, Integer> errorDistribution) { this.errorDistribution = errorDistribution; }
}

