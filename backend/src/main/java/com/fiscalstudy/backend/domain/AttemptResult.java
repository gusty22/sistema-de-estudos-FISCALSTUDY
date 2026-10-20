package com.fiscalstudy.backend.domain;

public class AttemptResult {
    private final Boolean isCorrect;
    private final GabaritoStatus gabaritoStatus;
    private final Integer concursoPoint;
    private Boolean bloqueioCognitivo = false;
    private Integer errosConsecutivos = 0;
    private String mediaPrescriptionTexto;
    private String mediaVeiculo;

    public AttemptResult(Boolean isCorrect, GabaritoStatus gabaritoStatus) {
        this(isCorrect, gabaritoStatus, (gabaritoStatus == GabaritoStatus.ANULADA || Boolean.TRUE.equals(isCorrect)) ? 1 : 0);
    }

    public AttemptResult(Boolean isCorrect, GabaritoStatus gabaritoStatus, Integer concursoPoint) {
        this.isCorrect = isCorrect;
        this.gabaritoStatus = gabaritoStatus;
        this.concursoPoint = concursoPoint;
    }

    public AttemptResult(Boolean isCorrect, GabaritoStatus gabaritoStatus, Integer concursoPoint,
                         Boolean bloqueioCognitivo, Integer errosConsecutivos,
                         String mediaPrescriptionTexto, String mediaVeiculo) {
        this.isCorrect = isCorrect;
        this.gabaritoStatus = gabaritoStatus;
        this.concursoPoint = concursoPoint;
        this.bloqueioCognitivo = bloqueioCognitivo;
        this.errosConsecutivos = errosConsecutivos;
        this.mediaPrescriptionTexto = mediaPrescriptionTexto;
        this.mediaVeiculo = mediaVeiculo;
    }

    public Boolean getIsCorrect() {
        return isCorrect;
    }

    public GabaritoStatus getGabaritoStatus() {
        return gabaritoStatus;
    }

    public Integer getConcursoPoint() {
        return concursoPoint;
    }

    public Boolean getBloqueioCognitivo() {
        return bloqueioCognitivo;
    }

    public Integer getErrosConsecutivos() {
        return errosConsecutivos;
    }

    public String getMediaPrescriptionTexto() {
        return mediaPrescriptionTexto;
    }

    public String getMediaVeiculo() {
        return mediaVeiculo;
    }

    private String correctOption;

    public String getCorrectOption() {
        return correctOption;
    }

    public void setCorrectOption(String correctOption) {
        this.correctOption = correctOption;
    }
}
