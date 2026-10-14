package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class ConcursoWithEditalResponseDTO {

    private String status = "SUCCESS";
    private ConcursoDTO concurso;
    private EditalImportSummaryDTO editalSummary;

    public ConcursoWithEditalResponseDTO() {
    }

    public ConcursoWithEditalResponseDTO(ConcursoDTO concurso, EditalImportSummaryDTO editalSummary) {
        this.status = "SUCCESS";
        this.concurso = concurso;
        this.editalSummary = editalSummary;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public ConcursoDTO getConcurso() {
        return concurso;
    }

    public void setConcurso(ConcursoDTO concurso) {
        this.concurso = concurso;
    }

    public EditalImportSummaryDTO getEditalSummary() {
        return editalSummary;
    }

    public void setEditalSummary(EditalImportSummaryDTO editalSummary) {
        this.editalSummary = editalSummary;
    }
}
