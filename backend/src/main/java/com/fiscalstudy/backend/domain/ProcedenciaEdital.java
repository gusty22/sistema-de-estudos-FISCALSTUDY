package com.fiscalstudy.backend.domain;

/**
 * Representa o estado de procedência e nível de conferência do edital verticalizado.
 * SOURCE_VERIFIED nunca deve ser atribuído automaticamente pelo sistema sem conferência direta.
 */
public enum ProcedenciaEdital {
    /**
     * O JSON foi validado sintática e hierarquicamente pelo motor determinístico.
     */
    JSON_STRUCTURALLY_VALID("Estrutura JSON validada com sucesso segundo o esquema do edital"),

    /**
     * A árvore foi visualizada, inspecionada e confirmada pelo estudante na interface.
     */
    STRUCTURE_HUMAN_REVIEWED("Hierarquia revisada e confirmada pelo estudante"),

    /**
     * O conteúdo foi expressamente confrontado e atestado com o documento oficial do edital (PDF/DOU).
     */
    SOURCE_VERIFIED("Conteúdo confrontado e atestado diretamente com o edital oficial");

    private final String descricao;

    ProcedenciaEdital(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
