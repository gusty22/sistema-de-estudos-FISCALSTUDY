package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class PreMortemDTO {
    private String id;
    private String concursoId;
    private String titulo;
    private String dataPrevista;
    private String cenarioFracasso;
    private String causa1;
    private String acao1;
    private String causa2;
    private String acao2;
    private String causa3;
    private String acao3;
    private String status;
    private String createdAt;

    public PreMortemDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getDataPrevista() { return dataPrevista; }
    public void setDataPrevista(String dataPrevista) { this.dataPrevista = dataPrevista; }

    public String getCenarioFracasso() { return cenarioFracasso; }
    public void setCenarioFracasso(String cenarioFracasso) { this.cenarioFracasso = cenarioFracasso; }

    public String getCausa1() { return causa1; }
    public void setCausa1(String causa1) { this.causa1 = causa1; }

    public String getAcao1() { return acao1; }
    public void setAcao1(String acao1) { this.acao1 = acao1; }

    public String getCausa2() { return causa2; }
    public void setCausa2(String causa2) { this.causa2 = causa2; }

    public String getAcao2() { return acao2; }
    public void setAcao2(String acao2) { this.acao2 = acao2; }

    public String getCausa3() { return causa3; }
    public void setCausa3(String causa3) { this.causa3 = causa3; }

    public String getAcao3() { return acao3; }
    public void setAcao3(String acao3) { this.acao3 = acao3; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
