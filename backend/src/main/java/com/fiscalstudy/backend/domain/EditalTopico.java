package com.fiscalstudy.backend.domain;

public class EditalTopico {
    private String id;
    private String editalId;
    private String concursoId;
    private String disciplina;
    private String assunto;
    private String subassunto;
    private Double peso;
    private Integer questoesPrevistas;
    private String docOrigem;
    private Integer paginaOrigem;
    private String trechoOrigem;
    private String tipoClassificacao; // EXPLICITA, INFERIDA, CONFIRMADA
    private boolean confirmadoHumano;
    private String createdAt;

    public EditalTopico() {
        this.peso = 1.0;
        this.tipoClassificacao = "EXPLICITA";
        this.confirmadoHumano = false;
    }

    public EditalTopico(String id, String editalId, String concursoId, String disciplina, String assunto, String subassunto,
                        Double peso, Integer questoesPrevistas, String docOrigem, Integer paginaOrigem, String trechoOrigem,
                        String tipoClassificacao, boolean confirmadoHumano) {
        this.id = id;
        this.editalId = editalId;
        this.concursoId = concursoId;
        this.disciplina = disciplina;
        this.assunto = assunto;
        this.subassunto = subassunto;
        this.peso = peso != null ? peso : 1.0;
        this.questoesPrevistas = questoesPrevistas;
        this.docOrigem = docOrigem;
        this.paginaOrigem = paginaOrigem;
        this.trechoOrigem = trechoOrigem;
        this.tipoClassificacao = tipoClassificacao != null ? tipoClassificacao : "EXPLICITA";
        this.confirmadoHumano = confirmadoHumano;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEditalId() {
        return editalId;
    }

    public void setEditalId(String editalId) {
        this.editalId = editalId;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public void setConcursoId(String concursoId) {
        this.concursoId = concursoId;
    }

    public String getDisciplina() {
        return disciplina;
    }

    public void setDisciplina(String disciplina) {
        this.disciplina = disciplina;
    }

    public String getAssunto() {
        return assunto;
    }

    public void setAssunto(String assunto) {
        this.assunto = assunto;
    }

    public String getSubassunto() {
        return subassunto;
    }

    public void setSubassunto(String subassunto) {
        this.subassunto = subassunto;
    }

    public Double getPeso() {
        return peso;
    }

    public void setPeso(Double peso) {
        this.peso = peso;
    }

    public Integer getQuestoesPrevistas() {
        return questoesPrevistas;
    }

    public void setQuestoesPrevistas(Integer questoesPrevistas) {
        this.questoesPrevistas = questoesPrevistas;
    }

    public String getDocOrigem() {
        return docOrigem;
    }

    public void setDocOrigem(String docOrigem) {
        this.docOrigem = docOrigem;
    }

    public Integer getPaginaOrigem() {
        return paginaOrigem;
    }

    public void setPaginaOrigem(Integer paginaOrigem) {
        this.paginaOrigem = paginaOrigem;
    }

    public String getTrechoOrigem() {
        return trechoOrigem;
    }

    public void setTrechoOrigem(String trechoOrigem) {
        this.trechoOrigem = trechoOrigem;
    }

    public String getTipoClassificacao() {
        return tipoClassificacao;
    }

    public void setTipoClassificacao(String tipoClassificacao) {
        this.tipoClassificacao = tipoClassificacao;
    }

    public boolean isConfirmadoHumano() {
        return confirmadoHumano;
    }

    public void setConfirmadoHumano(boolean confirmadoHumano) {
        this.confirmadoHumano = confirmadoHumano;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
