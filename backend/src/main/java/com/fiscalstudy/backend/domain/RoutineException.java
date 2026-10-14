package com.fiscalstudy.backend.domain;

public class RoutineException {
    private String id;
    private String data; // YYYY-MM-DD
    private String tipo; // INDISPONIBILIDADE, TEMPO_EXTRA
    private double horas;
    private String motivo;
    private String createdAt;

    public RoutineException() {}

    public RoutineException(String id, String data, String tipo, double horas, String motivo, String createdAt) {
        this.id = id;
        this.data = data;
        this.tipo = tipo != null ? tipo : "INDISPONIBILIDADE";
        this.horas = horas;
        this.motivo = motivo;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getData() { return data; }
    public void setData(String data) { this.data = data; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public double getHoras() { return horas; }
    public void setHoras(double horas) { this.horas = horas; }

    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
