package com.fiscalstudy.backend.domain;

public class StudentRoutine {
    private String id;
    private String concursoId;
    private String modoPlanejamento; // SEMANAL, CICLO
    private double horasSegunda;
    private double horasTerca;
    private double horasQuarta;
    private double horasQuinta;
    private double horasSexta;
    private double horasSabado;
    private double horasDomingo;
    private String cicloDisciplinasJson;
    private String updatedAt;

    public StudentRoutine() {}

    public StudentRoutine(String id, String concursoId, String modoPlanejamento,
                          double horasSegunda, double horasTerca, double horasQuarta,
                          double horasQuinta, double horasSexta, double horasSabado,
                          double horasDomingo, String cicloDisciplinasJson, String updatedAt) {
        this.id = id;
        this.concursoId = concursoId;
        this.modoPlanejamento = modoPlanejamento != null ? modoPlanejamento : "SEMANAL";
        this.horasSegunda = horasSegunda;
        this.horasTerca = horasTerca;
        this.horasQuarta = horasQuarta;
        this.horasQuinta = horasQuinta;
        this.horasSexta = horasSexta;
        this.horasSabado = horasSabado;
        this.horasDomingo = horasDomingo;
        this.cicloDisciplinasJson = cicloDisciplinasJson;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getModoPlanejamento() { return modoPlanejamento; }
    public void setModoPlanejamento(String modoPlanejamento) { this.modoPlanejamento = modoPlanejamento; }

    public double getHorasSegunda() { return horasSegunda; }
    public void setHorasSegunda(double horasSegunda) { this.horasSegunda = horasSegunda; }

    public double getHorasTerca() { return horasTerca; }
    public void setHorasTerca(double horasTerca) { this.horasTerca = horasTerca; }

    public double getHorasQuarta() { return horasQuarta; }
    public void setHorasQuarta(double horasQuarta) { this.horasQuarta = horasQuarta; }

    public double getHorasQuinta() { return horasQuinta; }
    public void setHorasQuinta(double horasQuinta) { this.horasQuinta = horasQuinta; }

    public double getHorasSexta() { return horasSexta; }
    public void setHorasSexta(double horasSexta) { this.horasSexta = horasSexta; }

    public double getHorasSabado() { return horasSabado; }
    public void setHorasSabado(double horasSabado) { this.horasSabado = horasSabado; }

    public double getHorasDomingo() { return horasDomingo; }
    public void setHorasDomingo(double horasDomingo) { this.horasDomingo = horasDomingo; }

    public String getCicloDisciplinasJson() { return cicloDisciplinasJson; }
    public void setCicloDisciplinasJson(String cicloDisciplinasJson) { this.cicloDisciplinasJson = cicloDisciplinasJson; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public double getTotalHorasSemanais() {
        return horasSegunda + horasTerca + horasQuarta + horasQuinta + horasSexta + horasSabado + horasDomingo;
    }
}
