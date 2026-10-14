package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class CriticalErrorFeynmanAuditDTO {
    private String id;
    private String questionId;
    private String sessionId;
    private String selectedOption;
    private String pegadinhaExplicacao;
    private String regraCorretaExplicacao;
    private String statusValidacao;
    private String createdAt;

    public CriticalErrorFeynmanAuditDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getQuestionId() { return questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getSelectedOption() { return selectedOption; }
    public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }
    public String getPegadinhaExplicacao() { return pegadinhaExplicacao; }
    public void setPegadinhaExplicacao(String pegadinhaExplicacao) { this.pegadinhaExplicacao = pegadinhaExplicacao; }
    public String getRegraCorretaExplicacao() { return regraCorretaExplicacao; }
    public void setRegraCorretaExplicacao(String regraCorretaExplicacao) { this.regraCorretaExplicacao = regraCorretaExplicacao; }
    public String getStatusValidacao() { return statusValidacao; }
    public void setStatusValidacao(String statusValidacao) { this.statusValidacao = statusValidacao; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
