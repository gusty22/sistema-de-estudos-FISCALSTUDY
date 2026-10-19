package com.fiscalstudy.backend.application.review;

public class ReviewFailureDiagnosisDTO {
    private String tipoFalha; // ACESSIBILIDADE_TEMPORAL, COMPREENSAO_ESTRUTURAL, OVERCONFIDENCE_PEGADINHA, REGRESSAO_REPETIDA, DEPENDENCIA_ASSISTIDA
    private String diagnosticoCientifico;
    private double dominioAnteriorPct;
    private double novoDominioAjustadoPct;
    private double novaEstabilidadeDias;
    private String statusPrerequisitos;
    private String intervencaoPrescrita; // MICRO_REATIVACAO_ESPACADA, DESCONSTRUCAO_FEYNMAN, AUDITORIA_PEGADINHA_ARMADILHA, REESTUDO_PREREQUISITO
    private String explicacaoPedagogica;
    private boolean dominioZerado = false; // Sempre false por regra inegociável

    public String getTipoFalha() { return tipoFalha; }
    public void setTipoFalha(String tipoFalha) { this.tipoFalha = tipoFalha; }
    public String getDiagnosticoCientifico() { return diagnosticoCientifico; }
    public void setDiagnosticoCientifico(String diagnosticoCientifico) { this.diagnosticoCientifico = diagnosticoCientifico; }
    public double getDominioAnteriorPct() { return dominioAnteriorPct; }
    public void setDominioAnteriorPct(double dominioAnteriorPct) { this.dominioAnteriorPct = dominioAnteriorPct; }
    public double getNovoDominioAjustadoPct() { return novoDominioAjustadoPct; }
    public void setNovoDominioAjustadoPct(double novoDominioAjustadoPct) { this.novoDominioAjustadoPct = novoDominioAjustadoPct; }
    public double getNovaEstabilidadeDias() { return novaEstabilidadeDias; }
    public void setNovaEstabilidadeDias(double novaEstabilidadeDias) { this.novaEstabilidadeDias = novaEstabilidadeDias; }
    public String getStatusPrerequisitos() { return statusPrerequisitos; }
    public void setStatusPrerequisitos(String statusPrerequisitos) { this.statusPrerequisitos = statusPrerequisitos; }
    public String getIntervencaoPrescrita() { return intervencaoPrescrita; }
    public void setIntervencaoPrescrita(String intervencaoPrescrita) { this.intervencaoPrescrita = intervencaoPrescrita; }
    public String getExplicacaoPedagogica() { return explicacaoPedagogica; }
    public void setExplicacaoPedagogica(String explicacaoPedagogica) { this.explicacaoPedagogica = explicacaoPedagogica; }
    public boolean isDominioZerado() { return dominioZerado; }
    public void setDominioZerado(boolean dominioZerado) { this.dominioZerado = dominioZerado; }
}
