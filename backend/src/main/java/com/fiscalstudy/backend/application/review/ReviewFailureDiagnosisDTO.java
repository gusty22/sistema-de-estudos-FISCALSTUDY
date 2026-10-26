package com.fiscalstudy.backend.application.review;

/**
 * Non-causal review discrepancy response.
 * Numeric model outputs remain null until an independently validated model can support them.
 */
public class ReviewFailureDiagnosisDTO {
    private String tipoFalha;
    private String diagnosticoCientifico;
    private Double dominioAnteriorPct;
    private Double novoDominioAjustadoPct;
    private Double novaEstabilidadeDias;
    private String statusPrerequisitos;
    private String intervencaoPrescrita;
    private String explicacaoPedagogica;
    private String status;
    private boolean causeResolved;
    private boolean canApply;
    private boolean dominioZerado = false;

    public String getTipoFalha() { return tipoFalha; }
    public void setTipoFalha(String tipoFalha) { this.tipoFalha = tipoFalha; }
    public String getDiagnosticoCientifico() { return diagnosticoCientifico; }
    public void setDiagnosticoCientifico(String diagnosticoCientifico) { this.diagnosticoCientifico = diagnosticoCientifico; }
    public Double getDominioAnteriorPct() { return dominioAnteriorPct; }
    public void setDominioAnteriorPct(Double dominioAnteriorPct) { this.dominioAnteriorPct = dominioAnteriorPct; }
    public Double getNovoDominioAjustadoPct() { return novoDominioAjustadoPct; }
    public void setNovoDominioAjustadoPct(Double novoDominioAjustadoPct) { this.novoDominioAjustadoPct = novoDominioAjustadoPct; }
    public Double getNovaEstabilidadeDias() { return novaEstabilidadeDias; }
    public void setNovaEstabilidadeDias(Double novaEstabilidadeDias) { this.novaEstabilidadeDias = novaEstabilidadeDias; }
    public String getStatusPrerequisitos() { return statusPrerequisitos; }
    public void setStatusPrerequisitos(String statusPrerequisitos) { this.statusPrerequisitos = statusPrerequisitos; }
    public String getIntervencaoPrescrita() { return intervencaoPrescrita; }
    public void setIntervencaoPrescrita(String intervencaoPrescrita) { this.intervencaoPrescrita = intervencaoPrescrita; }
    public String getExplicacaoPedagogica() { return explicacaoPedagogica; }
    public void setExplicacaoPedagogica(String explicacaoPedagogica) { this.explicacaoPedagogica = explicacaoPedagogica; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isCauseResolved() { return causeResolved; }
    public void setCauseResolved(boolean causeResolved) { this.causeResolved = causeResolved; }
    public boolean isCanApply() { return canApply; }
    public void setCanApply(boolean canApply) { this.canApply = canApply; }
    public boolean isDominioZerado() { return dominioZerado; }
    public void setDominioZerado(boolean dominioZerado) { this.dominioZerado = dominioZerado; }
}
