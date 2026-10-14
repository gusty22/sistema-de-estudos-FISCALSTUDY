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
    private String titulo;
    private boolean replaceAllPreviousTopics = false;
    private boolean updateConcursoSituacao = false;
    private String novaSituacaoConcurso;
    private String dataProva;
    private String linkEdital;

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

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public boolean isReplaceAllPreviousTopics() {
        return replaceAllPreviousTopics;
    }

    public void setReplaceAllPreviousTopics(boolean replaceAllPreviousTopics) {
        this.replaceAllPreviousTopics = replaceAllPreviousTopics;
    }

    public boolean isUpdateConcursoSituacao() {
        return updateConcursoSituacao;
    }

    public void setUpdateConcursoSituacao(boolean updateConcursoSituacao) {
        this.updateConcursoSituacao = updateConcursoSituacao;
    }

    public String getNovaSituacaoConcurso() {
        return novaSituacaoConcurso;
    }

    public void setNovaSituacaoConcurso(String novaSituacaoConcurso) {
        this.novaSituacaoConcurso = novaSituacaoConcurso;
    }

    public String getDataProva() {
        return dataProva;
    }

    public void setDataProva(String dataProva) {
        this.dataProva = dataProva;
    }

    public String getLinkEdital() {
        return linkEdital;
    }

    public void setLinkEdital(String linkEdital) {
        this.linkEdital = linkEdital;
    }
}
