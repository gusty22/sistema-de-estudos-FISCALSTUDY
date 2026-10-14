package com.fiscalstudy.backend.domain.cycle;

import java.util.List;
import java.util.Map;

/**
 * Resultado completo do processamento do Ciclo de Estudos Robin Hood.
 */
public class RobinHoodCycleResult {

    private final String concursoId;
    private final double horasSemanaisDisponiveis;
    private final int duracaoPadraoBlocoMinutos;
    private final List<RobinHoodCycleBlock> blocos;
    private final int ciclosCompletados;
    private final boolean recalibracaoObrigatoria;
    private final Map<String, String> resumoRobinHood; // Relatório de transferência de horas

    public RobinHoodCycleResult(
            String concursoId,
            double horasSemanaisDisponiveis,
            int duracaoPadraoBlocoMinutos,
            List<RobinHoodCycleBlock> blocos,
            int ciclosCompletados,
            boolean recalibracaoObrigatoria,
            Map<String, String> resumoRobinHood
    ) {
        this.concursoId = concursoId;
        this.horasSemanaisDisponiveis = horasSemanaisDisponiveis;
        this.duracaoPadraoBlocoMinutos = duracaoPadraoBlocoMinutos;
        this.blocos = blocos;
        this.ciclosCompletados = ciclosCompletados;
        this.recalibracaoObrigatoria = recalibracaoObrigatoria;
        this.resumoRobinHood = resumoRobinHood;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public double getHorasSemanaisDisponiveis() {
        return horasSemanaisDisponiveis;
    }

    public int getDuracaoPadraoBlocoMinutos() {
        return duracaoPadraoBlocoMinutos;
    }

    public List<RobinHoodCycleBlock> getBlocos() {
        return blocos;
    }

    public int getCiclosCompletados() {
        return ciclosCompletados;
    }

    public boolean isRecalibracaoObrigatoria() {
        return recalibracaoObrigatoria;
    }

    public Map<String, String> getResumoRobinHood() {
        return resumoRobinHood;
    }
}
