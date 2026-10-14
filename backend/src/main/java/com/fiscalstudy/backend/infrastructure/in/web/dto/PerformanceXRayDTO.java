package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;

public class PerformanceXRayDTO {
    private int totalAttempts;
    private int uniqueQuestions;
    private int totalCorrect;
    private int totalIncorrect;
    private int totalAnuladas;
    private double accuracyRate;
    private long totalActiveTimeMs;
    private double averageTimePerQuestionMs;
    private List<DisciplineStat> disciplineBreakdown;
    private List<TopicStat> topicBreakdown;
    private List<TopicStat> topErrorAreas;
    private List<TopicStat> masteredAreas;
    private int unansweredQuestionsCount;
    private int totalQuestionsInBank;
    private List<DailyEvolution> recentEvolution;

    public PerformanceXRayDTO() {}

    public static class DisciplineStat {
        private String disciplina;
        private int totalAttempts;
        private int uniqueQuestions;
        private int correctCount;
        private double accuracyRate;
        private String status; // DOMINADO, EM_EVOLUCAO, ATENCAO
        private double averageTimeMs;

        public DisciplineStat() {}

        public DisciplineStat(String disciplina, int totalAttempts, int uniqueQuestions,
                              int correctCount, double accuracyRate, String status, double averageTimeMs) {
            this.disciplina = disciplina;
            this.totalAttempts = totalAttempts;
            this.uniqueQuestions = uniqueQuestions;
            this.correctCount = correctCount;
            this.accuracyRate = accuracyRate;
            this.status = status;
            this.averageTimeMs = averageTimeMs;
        }

        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

        public int getTotalAttempts() { return totalAttempts; }
        public void setTotalAttempts(int totalAttempts) { this.totalAttempts = totalAttempts; }

        public int getUniqueQuestions() { return uniqueQuestions; }
        public void setUniqueQuestions(int uniqueQuestions) { this.uniqueQuestions = uniqueQuestions; }

        public int getCorrectCount() { return correctCount; }
        public void setCorrectCount(int correctCount) { this.correctCount = correctCount; }

        public double getAccuracyRate() { return accuracyRate; }
        public void setAccuracyRate(double accuracyRate) { this.accuracyRate = accuracyRate; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public double getAverageTimeMs() { return averageTimeMs; }
        public void setAverageTimeMs(double averageTimeMs) { this.averageTimeMs = averageTimeMs; }
    }

    public static class TopicStat {
        private String disciplina;
        private String topic;
        private int totalAttempts;
        private int correctCount;
        private int incorrectCount;
        private double accuracyRate;

        public TopicStat() {}

        public TopicStat(String disciplina, String topic, int totalAttempts, int correctCount, int incorrectCount, double accuracyRate) {
            this.disciplina = disciplina;
            this.topic = topic;
            this.totalAttempts = totalAttempts;
            this.correctCount = correctCount;
            this.incorrectCount = incorrectCount;
            this.accuracyRate = accuracyRate;
        }

        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

        public String getTopic() { return topic; }
        public void setTopic(String topic) { this.topic = topic; }

        public int getTotalAttempts() { return totalAttempts; }
        public void setTotalAttempts(int totalAttempts) { this.totalAttempts = totalAttempts; }

        public int getCorrectCount() { return correctCount; }
        public void setCorrectCount(int correctCount) { this.correctCount = correctCount; }

        public int getIncorrectCount() { return incorrectCount; }
        public void setIncorrectCount(int incorrectCount) { this.incorrectCount = incorrectCount; }

        public double getAccuracyRate() { return accuracyRate; }
        public void setAccuracyRate(double accuracyRate) { this.accuracyRate = accuracyRate; }
    }

    public static class DailyEvolution {
        private String date;
        private int attempts;
        private int correct;
        private double accuracyRate;

        public DailyEvolution() {}

        public DailyEvolution(String date, int attempts, int correct, double accuracyRate) {
            this.date = date;
            this.attempts = attempts;
            this.correct = correct;
            this.accuracyRate = accuracyRate;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public int getAttempts() { return attempts; }
        public void setAttempts(int attempts) { this.attempts = attempts; }

        public int getCorrect() { return correct; }
        public void setCorrect(int correct) { this.correct = correct; }

        public double getAccuracyRate() { return accuracyRate; }
        public void setAccuracyRate(double accuracyRate) { this.accuracyRate = accuracyRate; }
    }

    // Getters and Setters for main class
    public int getTotalAttempts() { return totalAttempts; }
    public void setTotalAttempts(int totalAttempts) { this.totalAttempts = totalAttempts; }

    public int getUniqueQuestions() { return uniqueQuestions; }
    public void setUniqueQuestions(int uniqueQuestions) { this.uniqueQuestions = uniqueQuestions; }

    public int getTotalCorrect() { return totalCorrect; }
    public void setTotalCorrect(int totalCorrect) { this.totalCorrect = totalCorrect; }

    public int getTotalIncorrect() { return totalIncorrect; }
    public void setTotalIncorrect(int totalIncorrect) { this.totalIncorrect = totalIncorrect; }

    public int getTotalAnuladas() { return totalAnuladas; }
    public void setTotalAnuladas(int totalAnuladas) { this.totalAnuladas = totalAnuladas; }

    public double getAccuracyRate() { return accuracyRate; }
    public void setAccuracyRate(double accuracyRate) { this.accuracyRate = accuracyRate; }

    public long getTotalActiveTimeMs() { return totalActiveTimeMs; }
    public void setTotalActiveTimeMs(long totalActiveTimeMs) { this.totalActiveTimeMs = totalActiveTimeMs; }

    public double getAverageTimePerQuestionMs() { return averageTimePerQuestionMs; }
    public void setAverageTimePerQuestionMs(double averageTimePerQuestionMs) { this.averageTimePerQuestionMs = averageTimePerQuestionMs; }

    public List<DisciplineStat> getDisciplineBreakdown() { return disciplineBreakdown; }
    public void setDisciplineBreakdown(List<DisciplineStat> disciplineBreakdown) { this.disciplineBreakdown = disciplineBreakdown; }

    public List<TopicStat> getTopicBreakdown() { return topicBreakdown; }
    public void setTopicBreakdown(List<TopicStat> topicBreakdown) { this.topicBreakdown = topicBreakdown; }

    public List<TopicStat> getTopErrorAreas() { return topErrorAreas; }
    public void setTopErrorAreas(List<TopicStat> topErrorAreas) { this.topErrorAreas = topErrorAreas; }

    public List<TopicStat> getMasteredAreas() { return masteredAreas; }
    public void setMasteredAreas(List<TopicStat> masteredAreas) { this.masteredAreas = masteredAreas; }

    public int getUnansweredQuestionsCount() { return unansweredQuestionsCount; }
    public void setUnansweredQuestionsCount(int unansweredQuestionsCount) { this.unansweredQuestionsCount = unansweredQuestionsCount; }

    public int getTotalQuestionsInBank() { return totalQuestionsInBank; }
    public void setTotalQuestionsInBank(int totalQuestionsInBank) { this.totalQuestionsInBank = totalQuestionsInBank; }

    public List<DailyEvolution> getRecentEvolution() { return recentEvolution; }
    public void setRecentEvolution(List<DailyEvolution> recentEvolution) { this.recentEvolution = recentEvolution; }
}
