package com.fiscalstudy.backend.domain;

public class AttemptResult {
    private final Boolean isCorrect;
    private final GabaritoStatus gabaritoStatus;
    private final Integer concursoPoint;

    public AttemptResult(Boolean isCorrect, GabaritoStatus gabaritoStatus) {
        this(isCorrect, gabaritoStatus, (gabaritoStatus == GabaritoStatus.ANULADA || Boolean.TRUE.equals(isCorrect)) ? 1 : 0);
    }

    public AttemptResult(Boolean isCorrect, GabaritoStatus gabaritoStatus, Integer concursoPoint) {
        this.isCorrect = isCorrect;
        this.gabaritoStatus = gabaritoStatus;
        this.concursoPoint = concursoPoint;
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
}

