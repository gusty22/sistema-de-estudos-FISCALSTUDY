package com.fiscalstudy.backend.domain.cognitive;

public enum FsrsRating {
    AGAIN(1),
    HARD(2),
    GOOD(3),
    EASY(4);

    private final int value;

    FsrsRating(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }
}
