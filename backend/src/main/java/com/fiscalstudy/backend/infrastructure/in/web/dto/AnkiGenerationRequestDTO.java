package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class AnkiGenerationRequestDTO {
    private String textParagraph;
    private String questionId;
    private String selectedOption;
    private String disciplina;
    private String assunto;
    private String cardType; // BASIC, CLOZE, AUTO
    private String deckName;
    private String sessionId;
    private String concursoId;

    public AnkiGenerationRequestDTO() {}

    public String getTextParagraph() { return textParagraph; }
    public void setTextParagraph(String textParagraph) { this.textParagraph = textParagraph; }

    public String getQuestionId() { return questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }

    public String getSelectedOption() { return selectedOption; }
    public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getAssunto() { return assunto; }
    public void setAssunto(String assunto) { this.assunto = assunto; }

    public String getCardType() { return cardType; }
    public void setCardType(String cardType) { this.cardType = cardType; }

    public String getDeckName() { return deckName; }
    public void setDeckName(String deckName) { this.deckName = deckName; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }
}
