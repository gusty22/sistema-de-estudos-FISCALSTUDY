package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.time.Instant;

public class EditalImportSummaryDTO {

    private String status = "SUCCESS";
    private String concursoId;
    private String editalId;
    private String titulo;
    private String versao;
    private String tipo;
    private int totalMaterias;
    private int totalTopicos;
    private int totalSubtopicos;
    private int totalRowsPersisted;
    private String procedenciaStatus;
    private boolean confirmadoHumano;
    private String importedAt;

    public EditalImportSummaryDTO() {
        this.importedAt = Instant.now().toString();
    }

    public EditalImportSummaryDTO(String concursoId, String editalId, String titulo, String versao, String tipo,
                                  int totalMaterias, int totalTopicos, int totalSubtopicos, int totalRowsPersisted,
                                  String procedenciaStatus, boolean confirmadoHumano) {
        this.status = "SUCCESS";
        this.concursoId = concursoId;
        this.editalId = editalId;
        this.titulo = titulo;
        this.versao = versao;
        this.tipo = tipo;
        this.totalMaterias = totalMaterias;
        this.totalTopicos = totalTopicos;
        this.totalSubtopicos = totalSubtopicos;
        this.totalRowsPersisted = totalRowsPersisted;
        this.procedenciaStatus = procedenciaStatus;
        this.confirmadoHumano = confirmadoHumano;
        this.importedAt = Instant.now().toString();
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public void setConcursoId(String concursoId) {
        this.concursoId = concursoId;
    }

    public String getEditalId() {
        return editalId;
    }

    public void setEditalId(String editalId) {
        this.editalId = editalId;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
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

    public int getTotalMaterias() {
        return totalMaterias;
    }

    public void setTotalMaterias(int totalMaterias) {
        this.totalMaterias = totalMaterias;
    }

    public int getTotalTopicos() {
        return totalTopicos;
    }

    public void setTotalTopicos(int totalTopicos) {
        this.totalTopicos = totalTopicos;
    }

    public int getTotalSubtopicos() {
        return totalSubtopicos;
    }

    public void setTotalSubtopicos(int totalSubtopicos) {
        this.totalSubtopicos = totalSubtopicos;
    }

    public int getTotalRowsPersisted() {
        return totalRowsPersisted;
    }

    public void setTotalRowsPersisted(int totalRowsPersisted) {
        this.totalRowsPersisted = totalRowsPersisted;
    }

    public String getProcedenciaStatus() {
        return procedenciaStatus;
    }

    public void setProcedenciaStatus(String procedenciaStatus) {
        this.procedenciaStatus = procedenciaStatus;
    }

    public boolean isConfirmadoHumano() {
        return confirmadoHumano;
    }

    public void setConfirmadoHumano(boolean confirmadoHumano) {
        this.confirmadoHumano = confirmadoHumano;
    }

    public String getImportedAt() {
        return importedAt;
    }

    public void setImportedAt(String importedAt) {
        this.importedAt = importedAt;
    }
}
