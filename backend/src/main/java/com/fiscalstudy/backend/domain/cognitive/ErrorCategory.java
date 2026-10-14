package com.fiscalstudy.backend.domain.cognitive;

public enum ErrorCategory {
    NONE,
    THEORETICAL_GAP,
    LAW_LITERALNESS_FORGOTTEN,
    BOARD_TRAP_INTERPRETATION,
    LACK_OF_ATTENTION_RUSH;

    public static ErrorCategory fromString(String val) {
        if (val == null) return NONE;
        try {
            return ErrorCategory.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return NONE;
        }
    }
}
