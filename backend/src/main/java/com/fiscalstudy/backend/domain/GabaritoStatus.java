package com.fiscalstudy.backend.domain;

public enum GabaritoStatus {
    PRELIMINAR,
    DEFINITIVO,
    RETIFICADO,
    ANULADA,
    AUSENTE,
    SOB_REVISAO;

    public boolean isVerified() {
        return this == DEFINITIVO || this == RETIFICADO;
    }

    public boolean isEvaluatable() {
        return this == DEFINITIVO || this == RETIFICADO || this == PRELIMINAR || this == ANULADA;
    }

    public static GabaritoStatus fromString(String val) {
        if (val == null || val.isBlank()) {
            return null;
        }
        String normalized = val.trim().toUpperCase()
                .replace("-", "_")
                .replace(" ", "_");
        try {
            return GabaritoStatus.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            if (normalized.contains("ANULA")) return ANULADA;
            if (normalized.contains("REVIS")) return SOB_REVISAO;
            if (normalized.contains("RETIF")) return RETIFICADO;
            if (normalized.contains("PRELIM")) return PRELIMINAR;
            if (normalized.contains("DEFIN")) return DEFINITIVO;
            return null;
        }
    }
}
