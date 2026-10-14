package com.fiscalstudy.backend.domain;

public class TopicMaterialLink {
    private String id;
    private String topicoId;
    private String materialId;
    private Integer paginaInicio;
    private Integer paginaFim;
    private int paginasLidas;
    private String status; // NAO_INICIADO, EM_ANDAMENTO, CONCLUIDO
    private String anotacoes;
    private String createdAt;

    // Campos de visualização enriquecidos (join)
    private String materialTitulo;
    private String materialFormato;
    private String topicoAssunto;
    private String disciplina;

    public TopicMaterialLink() {}

    public TopicMaterialLink(String id, String topicoId, String materialId, Integer paginaInicio,
                             Integer paginaFim, int paginasLidas, String status, String anotacoes, String createdAt) {
        this.id = id;
        this.topicoId = topicoId;
        this.materialId = materialId;
        this.paginaInicio = paginaInicio;
        this.paginaFim = paginaFim;
        this.paginasLidas = paginasLidas;
        this.status = status != null ? status : "NAO_INICIADO";
        this.anotacoes = anotacoes;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTopicoId() { return topicoId; }
    public void setTopicoId(String topicoId) { this.topicoId = topicoId; }

    public String getMaterialId() { return materialId; }
    public void setMaterialId(String materialId) { this.materialId = materialId; }

    public Integer getPaginaInicio() { return paginaInicio; }
    public void setPaginaInicio(Integer paginaInicio) { this.paginaInicio = paginaInicio; }

    public Integer getPaginaFim() { return paginaFim; }
    public void setPaginaFim(Integer paginaFim) { this.paginaFim = paginaFim; }

    public int getPaginasLidas() { return paginasLidas; }
    public void setPaginasLidas(int paginasLidas) { this.paginasLidas = paginasLidas; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAnotacoes() { return anotacoes; }
    public void setAnotacoes(String anotacoes) { this.anotacoes = anotacoes; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getMaterialTitulo() { return materialTitulo; }
    public void setMaterialTitulo(String materialTitulo) { this.materialTitulo = materialTitulo; }

    public String getMaterialFormato() { return materialFormato; }
    public void setMaterialFormato(String materialFormato) { this.materialFormato = materialFormato; }

    public String getTopicoAssunto() { return topicoAssunto; }
    public void setTopicoAssunto(String topicoAssunto) { this.topicoAssunto = topicoAssunto; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }
}
