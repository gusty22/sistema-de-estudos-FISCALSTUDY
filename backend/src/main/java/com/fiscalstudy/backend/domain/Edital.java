package com.fiscalstudy.backend.domain;

public class Edital {
    private String id;
    private String concursoId;
    private String titulo;
    private String versao;
    private String tipo; // ORIGINAL, ANEXO, RETIFICACAO
    private String filename;
    private String createdAt;

    public Edital() {}

    public Edital(String id, String concursoId, String titulo, String versao, String tipo, String filename) {
        this.id = id;
        this.concursoId = concursoId;
        this.titulo = titulo;
        this.versao = versao != null ? versao : "1.0";
        this.tipo = tipo != null ? tipo : "ORIGINAL";
        this.filename = filename;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getConcursoId() {
        return concursoId;
    }

    public void setConcursoId(String concursoId) {
        this.concursoId = concursoId;
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

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
