package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class AnkiFlashcardDTO {
    private String id;
    private String sessionId;
    private String concursoId;
    private String disciplina;
    private String assunto;
    private String cardType; // BASIC, CLOZE
    private String frontOrText;
    private String backOrExtra;
    private String deckName;
    private Long ankiNoteId;
    private String syncStatus; // PENDING_ANKI, SYNCED, ERROR
    private String sourceType; // QUESTION_ERROR, PDF_PARAGRAPH, SESSION_SYNTHESIS
    private String sourceId;
    private String createdAt;
    private String syncedAt;
    private String errorMessage;

    public AnkiFlashcardDTO() {}

    public AnkiFlashcardDTO(String id, String sessionId, String concursoId, String disciplina, String assunto,
                            String cardType, String frontOrText, String backOrExtra, String deckName,
                            Long ankiNoteId, String syncStatus, String sourceType, String sourceId,
                            String createdAt, String syncedAt, String errorMessage) {
        this.id = id;
        this.sessionId = sessionId;
        this.concursoId = concursoId;
        this.disciplina = disciplina;
        this.assunto = assunto;
        this.cardType = cardType;
        this.frontOrText = frontOrText;
        this.backOrExtra = backOrExtra;
        this.deckName = deckName;
        this.ankiNoteId = ankiNoteId;
        this.syncStatus = syncStatus;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.createdAt = createdAt;
        this.syncedAt = syncedAt;
        this.errorMessage = errorMessage;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getAssunto() { return assunto; }
    public void setAssunto(String assunto) { this.assunto = assunto; }

    public String getCardType() { return cardType; }
    public void setCardType(String cardType) { this.cardType = cardType; }

    public String getFrontOrText() { return frontOrText; }
    public void setFrontOrText(String frontOrText) { this.frontOrText = frontOrText; }

    public String getBackOrExtra() { return backOrExtra; }
    public void setBackOrExtra(String backOrExtra) { this.backOrExtra = backOrExtra; }

    public String getDeckName() { return deckName; }
    public void setDeckName(String deckName) { this.deckName = deckName; }

    public Long getAnkiNoteId() { return ankiNoteId; }
    public void setAnkiNoteId(Long ankiNoteId) { this.ankiNoteId = ankiNoteId; }

    public String getSyncStatus() { return syncStatus; }
    public void setSyncStatus(String syncStatus) { this.syncStatus = syncStatus; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getSyncedAt() { return syncedAt; }
    public void setSyncedAt(String syncedAt) { this.syncedAt = syncedAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
