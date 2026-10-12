package com.fiscalstudy.backend.domain;

public class AttemptResult {
    private final Boolean isCorrect;
    private final GabaritoStatus gabaritoStatus;

    public AttemptResult(Boolean isCorrect, GabaritoStatus gabaritoStatus) {
        this.isCorrect = isCorrect;
        this.gabaritoStatus = gabaritoStatus;
    }

    public Boolean getIsCorrect() {
        return isCorrect;
    }

    public GabaritoStatus getGabaritoStatus() {
        return gabaritoStatus;
    }
}
