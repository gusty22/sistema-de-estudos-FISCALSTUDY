package com.fiscalstudy.backend.domain.cognitive;

public enum ConfidenceLevel {
    CERTAIN,
    DOUBT_BETWEEN_TWO,
    BLIND_GUESS;

    public static ConfidenceLevel fromString(String val) {
        if (val == null) return DOUBT_BETWEEN_TWO;
        try {
            return ConfidenceLevel.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return DOUBT_BETWEEN_TWO;
        }
    }
}
