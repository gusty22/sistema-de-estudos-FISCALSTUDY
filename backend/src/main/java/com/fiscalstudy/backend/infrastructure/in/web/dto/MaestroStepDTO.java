package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.Map;

/**
 * DTO que representa um passo imediato do Roteiro Mastigado do Maestro do Ciclo Diário.
 */
public class MaestroStepDTO {
    private int numeroPasso;
    private int totalPassos;
    private int duracaoMinutos;
    private String tipo; // ANKI_SRS, PRIMING_COGNITIVO, TEORIA, DESCANSO, FIXACAO_QUESTOES, FEYNMAN_AUDIT
    private String titulo;
    private String instrucaoMastigada;
    private String disciplina;
    private String assunto;
    private String objetivoPedagogico;
    private String actionType; // ANKI_SYNC, RESOLVER_QUESTOES, LER_MATERIAL, DESCANSO_TIMER, FEYNMAN
    private Map<String, Object> metadata;
    private boolean concluido;

    public MaestroStepDTO() {}

    public MaestroStepDTO(int numeroPasso, int totalPassos, int duracaoMinutos, String tipo, String titulo,
                          String instrucaoMastigada, String disciplina, String assunto,
                          String objetivoPedagogico, String actionType, Map<String, Object> metadata) {
        this.numeroPasso = numeroPasso;
        this.totalPassos = totalPassos;
        this.duracaoMinutos = duracaoMinutos;
        this.tipo = tipo;
        this.titulo = titulo;
        this.instrucaoMastigada = instrucaoMastigada;
        this.disciplina = disciplina;
        this.assunto = assunto;
        this.objetivoPedagogico = objetivoPedagogico;
        this.actionType = actionType;
        this.metadata = metadata;
        this.concluido = false;
    }

    public int getNumeroPasso() {
        return numeroPasso;
    }

    public void setNumeroPasso(int numeroPasso) {
        this.numeroPasso = numeroPasso;
    }

    public int getTotalPassos() {
        return totalPassos;
    }

    public void setTotalPassos(int totalPassos) {
        this.totalPassos = totalPassos;
    }

    public int getDuracaoMinutos() {
        return duracaoMinutos;
    }

    public void setDuracaoMinutos(int duracaoMinutos) {
        this.duracaoMinutos = duracaoMinutos;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getInstrucaoMastigada() {
        return instrucaoMastigada;
    }

    public void setInstrucaoMastigada(String instrucaoMastigada) {
        this.instrucaoMastigada = instrucaoMastigada;
    }

    public String getDisciplina() {
        return disciplina;
    }

    public void setDisciplina(String disciplina) {
        this.disciplina = disciplina;
    }

    public String getAssunto() {
        return assunto;
    }

    public void setAssunto(String assunto) {
        this.assunto = assunto;
    }

    public String getObjetivoPedagogico() {
        return objetivoPedagogico;
    }

    public void setObjetivoPedagogico(String objetivoPedagogico) {
        this.objetivoPedagogico = objetivoPedagogico;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public boolean isConcluido() {
        return concluido;
    }

    public void setConcluido(boolean concluido) {
        this.concluido = concluido;
    }
}
