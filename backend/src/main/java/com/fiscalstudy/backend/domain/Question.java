package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Map;

public class Question {
    private String id;
    private String statement;
    private List<String> options;
    private String correctOption;
    private GabaritoStatus gabaritoStatus;
    private String discipline;
    private String topic;
    private String board;
    private Integer year;
    private String orgao;
    private String cargo;
    private Map<String, Object> supportMaterial;
    private String justificativa;
    private String textoApoio;
    private String textoApoioTitulo;
    private String status;
    private Integer numeroOriginal;
    private String arquivoOrigem;

    public Question(String id, String statement, List<String> options, String correctOption, String discipline, String topic, String board, Integer year) {
        this(id, statement, options, correctOption, null, discipline, topic, board, year, null, null, null);
    }

    public Question(String id, String statement, List<String> options, String correctOption, GabaritoStatus gabaritoStatus, String discipline, String topic, String board, Integer year) {
        this(id, statement, options, correctOption, gabaritoStatus, discipline, topic, board, year, null, null, null);
    }

    public Question(String id, String statement, List<String> options, String correctOption, GabaritoStatus gabaritoStatus, String discipline, String topic, String board, Integer year, String orgao, String cargo) {
        this(id, statement, options, correctOption, gabaritoStatus, discipline, topic, board, year, orgao, cargo, null);
    }

    public Question(String id, String statement, List<String> options, String correctOption, GabaritoStatus gabaritoStatus, String discipline, String topic, String board, Integer year, String orgao, String cargo, Map<String, Object> supportMaterial) {
        this(id, statement, options, correctOption, gabaritoStatus, discipline, topic, board, year, orgao, cargo, supportMaterial, null, null, null, "VALIDADA", null, null);
    }

    public Question(String id, String statement, List<String> options, String correctOption, GabaritoStatus gabaritoStatus, String discipline, String topic, String board, Integer year, String orgao, String cargo, Map<String, Object> supportMaterial, String justificativa, String textoApoio, String textoApoioTitulo, String status, Integer numeroOriginal, String arquivoOrigem) {
        this.id = id;
        this.statement = statement;
        this.options = options;
        this.correctOption = correctOption;
        if ("ANULADA".equalsIgnoreCase(correctOption)) {
            this.gabaritoStatus = GabaritoStatus.ANULADA;
        } else if (correctOption == null || correctOption.isBlank()) {
            this.gabaritoStatus = GabaritoStatus.AUSENTE;
        } else if (gabaritoStatus != null) {
            this.gabaritoStatus = gabaritoStatus;
        } else {
            this.gabaritoStatus = GabaritoStatus.DEFINITIVO;
        }
        this.discipline = discipline;
        this.topic = topic;
        this.board = board;
        this.year = year;
        this.orgao = orgao;
        this.cargo = cargo;
        this.supportMaterial = supportMaterial;
        this.justificativa = justificativa;
        this.textoApoio = textoApoio;
        this.textoApoioTitulo = textoApoioTitulo;
        this.status = (status != null && !status.isBlank()) ? status : "VALIDADA";
        this.numeroOriginal = numeroOriginal;
        this.arquivoOrigem = arquivoOrigem;
    }

    public String getId() { return id; }
    public String getStatement() { return statement; }
    public List<String> getOptions() { return options; }
    public String getCorrectOption() { return correctOption; }
    public GabaritoStatus getGabaritoStatus() { return gabaritoStatus; }
    public String getDiscipline() { return discipline; }
    public String getTopic() { return topic; }
    public String getBoard() { return board; }
    public Integer getYear() { return year; }
    public String getOrgao() { return orgao; }
    public String getCargo() { return cargo; }
    public Map<String, Object> getSupportMaterial() { return supportMaterial; }
    public String getJustificativa() { return justificativa; }
    public String getTextoApoio() { return textoApoio; }
    public String getTextoApoioTitulo() { return textoApoioTitulo; }
    public String getStatus() { return status; }
    public Integer getNumeroOriginal() { return numeroOriginal; }
    public String getArquivoOrigem() { return arquivoOrigem; }
}
