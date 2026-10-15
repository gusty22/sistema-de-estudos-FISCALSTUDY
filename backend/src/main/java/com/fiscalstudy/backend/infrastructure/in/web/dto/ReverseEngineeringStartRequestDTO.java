package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class ReverseEngineeringStartRequestDTO {
    private String concursoId;
    private String disciplina;
    private String assunto;
    private String banca; // FGV, Cebraspe, FCC, etc.
    private String nivelTopico; // INTERMEDIARIO, AVANCADO
    private Integer quantidadeQuestoes; // 5 a 10 (default 5)
    private String sessionId;

    public ReverseEngineeringStartRequestDTO() {}

    public ReverseEngineeringStartRequestDTO(String concursoId, String disciplina, String assunto, String banca, String nivelTopico, Integer quantidadeQuestoes, String sessionId) {
        this.concursoId = concursoId;
        this.disciplina = disciplina;
        this.assunto = assunto;
        this.banca = banca;
        this.nivelTopico = nivelTopico;
        this.quantidadeQuestoes = quantidadeQuestoes;
        this.sessionId = sessionId;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public void setConcursoId(String concursoId) {
        this.concursoId = concursoId;
    }

    public String getDisciplina() {
        return disciplina;
    }

    public void setDisciplina(String disciplina) {
        this.disciplina = disciplina;
    }

    public String getAssunto() {
        return assunto;
    }

    public void setAssunto(String assunto) {
        this.assunto = assunto;
    }

    public String getBanca() {
        return banca;
    }

    public void setBanca(String banca) {
        this.banca = banca;
    }

    public String getNivelTopico() {
        return nivelTopico;
    }

    public void setNivelTopico(String nivelTopico) {
        this.nivelTopico = nivelTopico;
    }

    public Integer getQuantidadeQuestoes() {
        return quantidadeQuestoes;
    }

    public void setQuantidadeQuestoes(Integer quantidadeQuestoes) {
        this.quantidadeQuestoes = quantidadeQuestoes;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
}
