package com.fiscalstudy.backend.domain.cycle;

/**
 * Perfil de uma disciplina no concurso para o algoritmo do Ciclo Robin Hood.
 */
public class DisciplineProfile {

    private final String disciplina;
    private final double pesoProva;            // Ex: 1.0, 2.0, 3.0
    private final int quantidadeQuestoes;      // Ex: 10, 20 questões
    private final double minimoExigido;        // Ex: 50%
    private final int nivelDominioEstrelas;    // 0 a 5 estrelas
    private final String area;                 // JURIDICA, FISCAL, EXATAS, TI, GERAL

    public DisciplineProfile(String disciplina, double pesoProva, int quantidadeQuestoes, double minimoExigido, int nivelDominioEstrelas, String area) {
        this.disciplina = disciplina != null ? disciplina.trim() : "Geral";
        this.pesoProva = Math.max(pesoProva, 0.5);
        this.quantidadeQuestoes = Math.max(quantidadeQuestoes, 1);
        this.minimoExigido = Math.max(minimoExigido, 0.0);
        this.nivelDominioEstrelas = Math.min(Math.max(nivelDominioEstrelas, 0), 5);
        this.area = area != null ? area : "GERAL";
    }

    public String getDisciplina() {
        return disciplina;
    }

    public double getPesoProva() {
        return pesoProva;
    }

    public int getQuantidadeQuestoes() {
        return quantidadeQuestoes;
    }

    public double getMinimoExigido() {
        return minimoExigido;
    }

    public int getNivelDominioEstrelas() {
        return nivelDominioEstrelas;
    }

    public String getArea() {
        return area;
    }
}
