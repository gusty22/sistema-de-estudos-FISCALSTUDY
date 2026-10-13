package com.fiscalstudy.backend.domain;

/**
 * Classificação formal de proveniência de eventos para auditoria analítica.
 * Alinhado às diretrizes epistêmicas do FiscalStudy e do laboratório fiscalstudy-analytics.
 */
public enum EventOrigin {
    /**
     * Sessões de estudo efetivas realizadas interativamente pelo estudante.
     * Mapeia para PROVEN_OPERATIONAL no fiscalstudy-analytics se acompanhado de manifesto e cadeia temporal.
     */
    REAL_STUDY("Sessão de estudo efetiva do estudante"),

    /**
     * Eventos gerados durante execução de suítes de testes unitários ou de integração.
     * Mapeia para SYNTHETIC_FIXTURE. VEDADO apresentar como histórico real.
     */
    AUTOMATED_TEST("Execução de teste automatizado"),

    /**
     * Dados de demonstração, walkthrough ou amostras de interface.
     * Mapeia para DEMONSTRATION_SAMPLE. VEDADO inferir proficiência real.
     */
    DEMONSTRATION("Dados demonstrativos ou amostrais"),

    /**
     * Registros históricos legados cuja cadeia de custódia não pode ser comprovada por evidência documental.
     * Mapeia para UNVERIFIED_SOURCE. Não recebe atribuição retroativa fictícia de autenticidade.
     */
    UNVERIFIED_HISTORICAL("Registro histórico de origem não comprovável");

    private final String description;

    EventOrigin(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public static EventOrigin fromString(String value) {
        if (value == null || value.isBlank()) {
            return UNVERIFIED_HISTORICAL;
        }
        for (EventOrigin origin : values()) {
            if (origin.name().equalsIgnoreCase(value.trim())) {
                return origin;
            }
        }
        return UNVERIFIED_HISTORICAL;
    }
}
