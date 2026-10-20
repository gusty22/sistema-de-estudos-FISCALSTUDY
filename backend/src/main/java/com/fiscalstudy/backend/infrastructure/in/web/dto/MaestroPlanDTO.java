package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;
import java.util.Map;

/**
 * DTO que encapsula o plano completo do Maestro para o dia.
 */
public class MaestroPlanDTO {
    private String concursoId;
    private String concursoNome;
    private int tempoTotalMinutos;
    private int tempoDisponivelMinutos;
    private int totalPassos;
    private String disciplinaPrincipal;
    private String assuntoPrincipal;
    private List<MaestroStepDTO> passos;
    private Map<String, Object> telemetriaCognitiva;
    private String statusMensagem;

    public MaestroPlanDTO() {}

    public MaestroPlanDTO(String concursoId, String concursoNome, int tempoTotalMinutos, int totalPassos,
                          String disciplinaPrincipal, String assuntoPrincipal, List<MaestroStepDTO> passos,
                          Map<String, Object> telemetriaCognitiva, String statusMensagem) {
        this(concursoId, concursoNome, tempoTotalMinutos, tempoTotalMinutos, totalPassos, disciplinaPrincipal, assuntoPrincipal, passos, telemetriaCognitiva, statusMensagem);
    }

    public MaestroPlanDTO(String concursoId, String concursoNome, int tempoTotalMinutos, int tempoDisponivelMinutos,
                          int totalPassos, String disciplinaPrincipal, String assuntoPrincipal,
                          List<MaestroStepDTO> passos, Map<String, Object> telemetriaCognitiva, String statusMensagem) {
        this.concursoId = concursoId;
        this.concursoNome = concursoNome;
        this.tempoTotalMinutos = tempoTotalMinutos;
        this.tempoDisponivelMinutos = tempoDisponivelMinutos;
        this.totalPassos = totalPassos;
        this.disciplinaPrincipal = disciplinaPrincipal;
        this.assuntoPrincipal = assuntoPrincipal;
        this.passos = passos;
        this.telemetriaCognitiva = telemetriaCognitiva;
        this.statusMensagem = statusMensagem;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public void setConcursoId(String concursoId) {
        this.concursoId = concursoId;
    }

    public String getConcursoNome() {
        return concursoNome;
    }

    public void setConcursoNome(String concursoNome) {
        this.concursoNome = concursoNome;
    }

    public int getTempoTotalMinutos() {
        return tempoTotalMinutos;
    }

    public void setTempoTotalMinutos(int tempoTotalMinutos) {
        this.tempoTotalMinutos = tempoTotalMinutos;
    }

    public int getTempoDisponivelMinutos() {
        return tempoDisponivelMinutos;
    }

    public void setTempoDisponivelMinutos(int tempoDisponivelMinutos) {
        this.tempoDisponivelMinutos = tempoDisponivelMinutos;
    }

    public int getTotalPassos() {
        return totalPassos;
    }

    public void setTotalPassos(int totalPassos) {
        this.totalPassos = totalPassos;
    }

    public String getDisciplinaPrincipal() {
        return disciplinaPrincipal;
    }

    public void setDisciplinaPrincipal(String disciplinaPrincipal) {
        this.disciplinaPrincipal = disciplinaPrincipal;
    }

    public String getAssuntoPrincipal() {
        return assuntoPrincipal;
    }

    public void setAssuntoPrincipal(String assuntoPrincipal) {
        this.assuntoPrincipal = assuntoPrincipal;
    }

    public List<MaestroStepDTO> getPassos() {
        return passos;
    }

    public void setPassos(List<MaestroStepDTO> passos) {
        this.passos = passos;
    }

    public Map<String, Object> getTelemetriaCognitiva() {
        return telemetriaCognitiva;
    }

    public void setTelemetriaCognitiva(Map<String, Object> telemetriaCognitiva) {
        this.telemetriaCognitiva = telemetriaCognitiva;
    }

    public String getStatusMensagem() {
        return statusMensagem;
    }

    public void setStatusMensagem(String statusMensagem) {
        this.statusMensagem = statusMensagem;
    }
}
