package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class CognitiveChatRequestDTO {

    private String sessionId;
    private String concursoId;
    private String disciplina;
    private String assunto;
    private String userMessage;
    private String persona; // DONO_SUPERMERCADO, CRIANCA_10_ANOS, AUDITOR_PRATICO

    public CognitiveChatRequestDTO() {}

    public CognitiveChatRequestDTO(String sessionId, String concursoId, String disciplina, String assunto, String userMessage, String persona) {
        this.sessionId = sessionId;
        this.concursoId = concursoId;
        this.disciplina = disciplina;
        this.assunto = assunto;
        this.userMessage = userMessage;
        this.persona = persona;
    }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getAssunto() { return assunto; }
    public void setAssunto(String assunto) { this.assunto = assunto; }

    public String getUserMessage() { return userMessage; }
    public void setUserMessage(String userMessage) { this.userMessage = userMessage; }

    public String getPersona() { return persona; }
    public void setPersona(String persona) { this.persona = persona; }
}
