package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EditalImportRequestDTO {

    private EditalImportPayloadDTO payload;
    private boolean confirmadoHumano = false;
    private String procedenciaStatus = "STRUCTURE_HUMAN_REVIEWED";
    private String versao = "1.0";
    private String tipo = "ORIGINAL";
    private boolean overwrite = true;

    public EditalImportRequestDTO() {
    }

    public EditalImportRequestDTO(EditalImportPayloadDTO payload, boolean confirmadoHumano, String procedenciaStatus) {
        this.payload = payload;
        this.confirmadoHumano = confirmadoHumano;
        this.procedenciaStatus = procedenciaStatus != null ? procedenciaStatus : (confirmadoHumano ? "STRUCTURE_HUMAN_REVIEWED" : "JSON_STRUCTURALLY_VALID");
    }

    public EditalImportPayloadDTO getPayload() {
        return payload;
    }

    public void setPayload(EditalImportPayloadDTO payload) {
        this.payload = payload;
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

    public String getVersao() {
        return versao;
    }

    public void setVersao(String versao) {
        this.versao = versao;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public boolean isOverwrite() {
        return overwrite;
    }

    public void setOverwrite(boolean overwrite) {
        this.overwrite = overwrite;
    }
}
