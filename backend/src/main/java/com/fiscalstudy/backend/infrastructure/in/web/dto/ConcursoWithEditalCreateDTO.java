package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fiscalstudy.backend.domain.Concurso;

import java.util.HashMap;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ConcursoWithEditalCreateDTO {

    private Concurso concurso;
    private EditalImportPayloadDTO editalPayload;
    private boolean confirmadoHumano = false;
    private String procedenciaStatus = "STRUCTURE_HUMAN_REVIEWED";
    private Map<String, String> diagnosticoInicial = new HashMap<>();

    public ConcursoWithEditalCreateDTO() {
    }

    public ConcursoWithEditalCreateDTO(Concurso concurso, EditalImportPayloadDTO editalPayload,
                                      boolean confirmadoHumano, String procedenciaStatus,
                                      Map<String, String> diagnosticoInicial) {
        this.concurso = concurso;
        this.editalPayload = editalPayload;
        this.confirmadoHumano = confirmadoHumano;
        this.procedenciaStatus = procedenciaStatus;
        this.diagnosticoInicial = diagnosticoInicial != null ? diagnosticoInicial : new HashMap<>();
    }

    public Concurso getConcurso() {
        return concurso;
    }

    public void setConcurso(Concurso concurso) {
        this.concurso = concurso;
    }

    public EditalImportPayloadDTO getEditalPayload() {
        return editalPayload;
    }

    public void setEditalPayload(EditalImportPayloadDTO editalPayload) {
        this.editalPayload = editalPayload;
    }

    public boolean isConfirmadoHumano() {
        return confirmadoHumano;
    }

    public void setConfirmadoHumano(boolean confirmadoHumano) {
        this.confirmadoHumano = confirmadoHumano;
    }

    public String getProcedenciaStatus() {
        return procedenciaStatus;
    }

    public void setProcedenciaStatus(String procedenciaStatus) {
        this.procedenciaStatus = procedenciaStatus;
    }

    public Map<String, String> getDiagnosticoInicial() {
        return diagnosticoInicial;
    }

    public void setDiagnosticoInicial(Map<String, String> diagnosticoInicial) {
        this.diagnosticoInicial = diagnosticoInicial != null ? diagnosticoInicial : new HashMap<>();
    }
}
