package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;

public class QuestionHistoryDTO {

    public static class Item {
        private String eventId;
        private String questionId;
        private String statement;
        private List<String> options;
        private String selectedOption;
        private String correctOption;
        private Boolean isCorrect;
        private String gabaritoStatus;
        private int concursoPoint;
        private int confidenceLevel;
        private long activeTimeMs;
        private String causaErro;
        private String discipline;
        private String topic;
        private String board;
        private Integer year;
        private String orgao;
        private String cargo;
        private String occurredAt;
        private int attemptNumber;
        private int totalAttemptsForQuestion;

        public Item() {}

        public Item(String eventId, String questionId, String statement, List<String> options,
                    String selectedOption, String correctOption, Boolean isCorrect, String gabaritoStatus,
                    int concursoPoint, int confidenceLevel, long activeTimeMs, String causaErro,
                    String discipline, String topic, String board, Integer year, String orgao,
                    String cargo, String occurredAt, int attemptNumber, int totalAttemptsForQuestion) {
            this.eventId = eventId;
            this.questionId = questionId;
            this.statement = statement;
            this.options = options;
            this.selectedOption = selectedOption;
            this.correctOption = correctOption;
            this.isCorrect = isCorrect;
            this.gabaritoStatus = gabaritoStatus;
            this.concursoPoint = concursoPoint;
            this.confidenceLevel = confidenceLevel;
            this.activeTimeMs = activeTimeMs;
            this.causaErro = causaErro;
            this.discipline = discipline;
            this.topic = topic;
            this.board = board;
            this.year = year;
            this.orgao = orgao;
            this.cargo = cargo;
            this.occurredAt = occurredAt;
            this.attemptNumber = attemptNumber;
            this.totalAttemptsForQuestion = totalAttemptsForQuestion;
        }

        public String getEventId() { return eventId; }
        public void setEventId(String eventId) { this.eventId = eventId; }

        public String getQuestionId() { return questionId; }
        public void setQuestionId(String questionId) { this.questionId = questionId; }

        public String getStatement() { return statement; }
        public void setStatement(String statement) { this.statement = statement; }

        public List<String> getOptions() { return options; }
        public void setOptions(List<String> options) { this.options = options; }

        public String getSelectedOption() { return selectedOption; }
        public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }

        public String getCorrectOption() { return correctOption; }
        public void setCorrectOption(String correctOption) { this.correctOption = correctOption; }

        public Boolean getIsCorrect() { return isCorrect; }
        public void setIsCorrect(Boolean isCorrect) { this.isCorrect = isCorrect; }

        public String getGabaritoStatus() { return gabaritoStatus; }
        public void setGabaritoStatus(String gabaritoStatus) { this.gabaritoStatus = gabaritoStatus; }

        public int getConcursoPoint() { return concursoPoint; }
        public void setConcursoPoint(int concursoPoint) { this.concursoPoint = concursoPoint; }

        public int getConfidenceLevel() { return confidenceLevel; }
        public void setConfidenceLevel(int confidenceLevel) { this.confidenceLevel = confidenceLevel; }

        public long getActiveTimeMs() { return activeTimeMs; }
        public void setActiveTimeMs(long activeTimeMs) { this.activeTimeMs = activeTimeMs; }

        public String getCausaErro() { return causaErro; }
        public void setCausaErro(String causaErro) { this.causaErro = causaErro; }

        public String getDiscipline() { return discipline; }
        public void setDiscipline(String discipline) { this.discipline = discipline; }

        public String getTopic() { return topic; }
        public void setTopic(String topic) { this.topic = topic; }

        public String getBoard() { return board; }
        public void setBoard(String board) { this.board = board; }

        public Integer getYear() { return year; }
        public void setYear(Integer year) { this.year = year; }

        public String getOrgao() { return orgao; }
        public void setOrgao(String orgao) { this.orgao = orgao; }

        public String getCargo() { return cargo; }
        public void setCargo(String cargo) { this.cargo = cargo; }

        public String getOccurredAt() { return occurredAt; }
        public void setOccurredAt(String occurredAt) { this.occurredAt = occurredAt; }

        public int getAttemptNumber() { return attemptNumber; }
        public void setAttemptNumber(int attemptNumber) { this.attemptNumber = attemptNumber; }

        public int getTotalAttemptsForQuestion() { return totalAttemptsForQuestion; }
        public void setTotalAttemptsForQuestion(int totalAttemptsForQuestion) { this.totalAttemptsForQuestion = totalAttemptsForQuestion; }
    }

    public static class Response {
        private List<Item> items;
        private int totalAttempts;
        private int uniqueQuestionsCount;
        private int correctCount;
        private int incorrectCount;
        private int anuladasCount;
        private double accuracyRate;

        public Response() {}

        public Response(List<Item> items, int totalAttempts, int uniqueQuestionsCount,
                        int correctCount, int incorrectCount, int anuladasCount, double accuracyRate) {
            this.items = items;
            this.totalAttempts = totalAttempts;
            this.uniqueQuestionsCount = uniqueQuestionsCount;
            this.correctCount = correctCount;
            this.incorrectCount = incorrectCount;
            this.anuladasCount = anuladasCount;
            this.accuracyRate = accuracyRate;
        }

        public List<Item> getItems() { return items; }
        public void setItems(List<Item> items) { this.items = items; }

        public int getTotalAttempts() { return totalAttempts; }
        public void setTotalAttempts(int totalAttempts) { this.totalAttempts = totalAttempts; }

        public int getUniqueQuestionsCount() { return uniqueQuestionsCount; }
        public void setUniqueQuestionsCount(int uniqueQuestionsCount) { this.uniqueQuestionsCount = uniqueQuestionsCount; }

        public int getCorrectCount() { return correctCount; }
        public void setCorrectCount(int correctCount) { this.correctCount = correctCount; }

        public int getIncorrectCount() { return incorrectCount; }
        public void setIncorrectCount(int incorrectCount) { this.incorrectCount = incorrectCount; }

        public int getAnuladasCount() { return anuladasCount; }
        public void setAnuladasCount(int anuladasCount) { this.anuladasCount = anuladasCount; }

        public double getAccuracyRate() { return accuracyRate; }
        public void setAccuracyRate(double accuracyRate) { this.accuracyRate = accuracyRate; }
    }
}
