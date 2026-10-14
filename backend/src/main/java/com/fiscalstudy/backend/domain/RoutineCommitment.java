package com.fiscalstudy.backend.domain;

public class RoutineCommitment {
    private String id;
    private String titulo;
    private String diaSemana; // SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO, DOMINGO, TODOS_DIAS_UTEIS
    private String horaInicio;
    private String horaFim;
    private String tipo; // TRABALHO, FACULDADE, ACADEMIA, FAMILIA, OUTRO
    private String createdAt;

    public RoutineCommitment() {}

    public RoutineCommitment(String id, String titulo, String diaSemana, String horaInicio, String horaFim, String tipo, String createdAt) {
        this.id = id;
        this.titulo = titulo;
        this.diaSemana = diaSemana;
        this.horaInicio = horaInicio;
        this.horaFim = horaFim;
        this.tipo = tipo != null ? tipo : "TRABALHO";
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getDiaSemana() { return diaSemana; }
    public void setDiaSemana(String diaSemana) { this.diaSemana = diaSemana; }

    public String getHoraInicio() { return horaInicio; }
    public void setHoraInicio(String horaInicio) { this.horaInicio = horaInicio; }

    public String getHoraFim() { return horaFim; }
    public void setHoraFim(String horaFim) { this.horaFim = horaFim; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
