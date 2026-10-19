package com.fiscalstudy.backend.application.review;

public class ReviewFailureRequestDTO {
    private String questionId;
    private String disciplina;
    private String topico;
    private Double diasDesdeUltimaTentativa;
    private Double dominioAnteriorPct;
    private Integer confidenceLevel;
    private Boolean isQuestionInedita;
    private Boolean usedHelp;
    private String causaErro;
    private String sessionId;

    public String getQuestionId() { return questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }
    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }
    public String getTopico() { return topico; }
    public void setTopico(String topico) { this.topico = topico; }
    public Double getDiasDesdeUltimaTentativa() { return diasDesdeUltimaTentativa; }
    public void setDiasDesdeUltimaTentativa(Double diasDesdeUltimaTentativa) { this.diasDesdeUltimaTentativa = diasDesdeUltimaTentativa; }
    public Double getDominioAnteriorPct() { return dominioAnteriorPct; }
    public void setDominioAnteriorPct(Double dominioAnteriorPct) { this.dominioAnteriorPct = dominioAnteriorPct; }
    public Integer getConfidenceLevel() { return confidenceLevel; }
    public void setConfidenceLevel(Integer confidenceLevel) { this.confidenceLevel = confidenceLevel; }
    public Boolean getIsQuestionInedita() { return isQuestionInedita; }
    public void setIsQuestionInedita(Boolean questionInedita) { isQuestionInedita = questionInedita; }
    public Boolean getUsedHelp() { return usedHelp; }
    public void setUsedHelp(Boolean usedHelp) { this.usedHelp = usedHelp; }
    public String getCausaErro() { return causaErro; }
    public void setCausaErro(String causaErro) { this.causaErro = causaErro; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
}
