package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Map;

public class Question {
    private String id;
    private String statement;
    private List<String> options;
    private String correctOption;
    private String discipline;
    private String topic;
    private String board;
    private Integer year;

    public Question(String id, String statement, List<String> options, String correctOption, String discipline, String topic, String board, Integer year) {
        this.id = id;
        this.statement = statement;
        this.options = options;
        this.correctOption = correctOption;
        this.discipline = discipline;
        this.topic = topic;
        this.board = board;
        this.year = year;
    }

    public String getId() { return id; }
    public String getStatement() { return statement; }
    public List<String> getOptions() { return options; }
    public String getCorrectOption() { return correctOption; }
    public String getDiscipline() { return discipline; }
    public String getTopic() { return topic; }
    public String getBoard() { return board; }
    public Integer getYear() { return year; }
}
