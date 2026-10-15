package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;

public class CognitiveChatResponseDTO {

    private String responseMessage;
    private String persona;
    private String analogiaMecanica;
    private List<String> sugestoesPerguntas;
    private boolean lockResolved;

    public CognitiveChatResponseDTO() {}

    public CognitiveChatResponseDTO(String responseMessage, String persona, String analogiaMecanica, List<String> sugestoesPerguntas, boolean lockResolved) {
        this.responseMessage = responseMessage;
        this.persona = persona;
        this.analogiaMecanica = analogiaMecanica;
        this.sugestoesPerguntas = sugestoesPerguntas;
        this.lockResolved = lockResolved;
    }

    public String getResponseMessage() { return responseMessage; }
    public void setResponseMessage(String responseMessage) { this.responseMessage = responseMessage; }

    public String getPersona() { return persona; }
    public void setPersona(String persona) { this.persona = persona; }

    public String getAnalogiaMecanica() { return analogiaMecanica; }
    public void setAnalogiaMecanica(String analogiaMecanica) { this.analogiaMecanica = analogiaMecanica; }

    public List<String> getSugestoesPerguntas() { return sugestoesPerguntas; }
    public void setSugestoesPerguntas(List<String> sugestoesPerguntas) { this.sugestoesPerguntas = sugestoesPerguntas; }

    public boolean isLockResolved() { return lockResolved; }
    public void setLockResolved(boolean lockResolved) { this.lockResolved = lockResolved; }
}
