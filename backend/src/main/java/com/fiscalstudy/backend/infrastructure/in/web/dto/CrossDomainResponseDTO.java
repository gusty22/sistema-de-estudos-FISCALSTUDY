package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class CrossDomainResponseDTO {
    private String id;
    private String bridgeId;
    private String sessionId;
    private String activeOutputText;
    private int tempoRespostaSegundos;
    private String createdAt;
    private boolean validado;
    private String feedback;

    public CrossDomainResponseDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getBridgeId() { return bridgeId; }
    public void setBridgeId(String bridgeId) { this.bridgeId = bridgeId; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getActiveOutputText() { return activeOutputText; }
    public void setActiveOutputText(String activeOutputText) { this.activeOutputText = activeOutputText; }
    public int getTempoRespostaSegundos() { return tempoRespostaSegundos; }
    public void setTempoRespostaSegundos(int tempoRespostaSegundos) { this.tempoRespostaSegundos = tempoRespostaSegundos; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public boolean isValidado() { return validado; }
    public void setValidado(boolean validado) { this.validado = validado; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
}
