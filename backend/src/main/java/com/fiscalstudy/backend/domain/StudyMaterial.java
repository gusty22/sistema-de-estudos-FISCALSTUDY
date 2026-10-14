package com.fiscalstudy.backend.domain;

public class StudyMaterial {
    private String id;
    private String concursoId;
    private String disciplina;
    private String titulo;
    private String autor;
    private String formato; // PDF, LIVRO, VIDEO, LEI_SECA, LINK
    private int totalPaginas;
    private int paginaAtual;
    private String urlOuCaminho;
    private String notas;
    private String createdAt;

    public StudyMaterial() {}

    public StudyMaterial(String id, String concursoId, String disciplina, String titulo, String autor,
                         String formato, int totalPaginas, int paginaAtual, String urlOuCaminho, String notas, String createdAt) {
        this.id = id;
        this.concursoId = concursoId;
        this.disciplina = disciplina;
        this.titulo = titulo;
        this.autor = autor;
        this.formato = formato != null ? formato : "PDF";
        this.totalPaginas = totalPaginas;
        this.paginaAtual = paginaAtual;
        this.urlOuCaminho = urlOuCaminho;
        this.notas = notas;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getAutor() { return autor; }
    public void setAutor(String autor) { this.autor = autor; }

    public String getFormato() { return formato; }
    public void setFormato(String formato) { this.formato = formato; }

    public int getTotalPaginas() { return totalPaginas; }
    public void setTotalPaginas(int totalPaginas) { this.totalPaginas = totalPaginas; }

    public int getPaginaAtual() { return paginaAtual; }
    public void setPaginaAtual(int paginaAtual) { this.paginaAtual = paginaAtual; }

    public String getUrlOuCaminho() { return urlOuCaminho; }
    public void setUrlOuCaminho(String urlOuCaminho) { this.urlOuCaminho = urlOuCaminho; }

    public String getNotas() { return notas; }
    public void setNotas(String notas) { this.notas = notas; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public double getProgressoPercentual() {
        if (totalPaginas <= 0) return 0.0;
        return Math.min(100.0, (paginaAtual * 100.0) / totalPaginas);
    }
}
