package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class PontoChaveDTO {
    private String id;
    private String concursoId;
    private String disciplina;
    private String topico;
    private String criterio; // MAIS_CAI, MAIS_DIFICIL, MAIS_ERRA, MAIS_ESQUECE, PEGADINHA_BANCA
    private String clozeText;
    private String explicacao;
    private String artigoOuReferencia;
    private Double taxaAcerto;
    private String proximaRevisao;
    private String createdAt;

    public PontoChaveDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getTopico() { return topico; }
    public void setTopico(String topico) { this.topico = topico; }

    public String getCriterio() { return criterio; }
    public void setCriterio(String criterio) { this.criterio = criterio; }

    public String getClozeText() { return clozeText; }
    public void setClozeText(String clozeText) { this.clozeText = clozeText; }

    public String getExplicacao() { return explicacao; }
    public void setExplicacao(String explicacao) { this.explicacao = explicacao; }

    public String getArtigoOuReferencia() { return artigoOuReferencia; }
    public void setArtigoOuReferencia(String artigoOuReferencia) { this.artigoOuReferencia = artigoOuReferencia; }

    public Double getTaxaAcerto() { return taxaAcerto; }
    public void setTaxaAcerto(Double taxaAcerto) { this.taxaAcerto = taxaAcerto; }

    public String getProximaRevisao() { return proximaRevisao; }
    public void setProximaRevisao(String proximaRevisao) { this.proximaRevisao = proximaRevisao; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
