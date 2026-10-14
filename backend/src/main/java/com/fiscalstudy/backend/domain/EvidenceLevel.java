package com.fiscalstudy.backend.domain;

/**
 * Representa os níveis de qualidade e fundamentação epistemológica das evidências de aprendizagem.
 * Não utiliza métricas ou limiares arbitrários (ex: 30 questões) para presumir domínio.
 */
public enum EvidenceLevel {
    /**
     * Autorrelato inicial do estudante informado no cadastro ou questionário.
     * Não comprova domínio; orienta apenas o ponto de partida na ausência de dados empíricos.
     */
    SELF_REPORTED("Autorrelato inicial do estudante"),

    /**
     * Desempenho observado diretamente em sessões reais de resolução de questões e testes.
     * Baseia-se em acurácia recente, tempo de resposta e taxonomia de erros.
     */
    OBSERVED_PERFORMANCE("Desempenho observado em sessões de resolução"),

    /**
     * Evidência de retenção longitudinal comprovada através de repetições espaçadas
     * e contato com o conteúdo distribuído ao longo do tempo.
     */
    LONGITUDINAL_EVIDENCE("Retenção longitudinal em repetições espaçadas"),

    /**
     * Volume ou intervalo de dados insuficiente para inferir com segurança
     * o nível de domínio ou retenção do estudante naquele tópico.
     */
    INSUFFICIENT_EVIDENCE("Amostra ou histórico insuficiente para inferência");

    private final String descricao;

    EvidenceLevel(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
