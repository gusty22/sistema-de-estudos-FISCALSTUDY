package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class FeynmanSessionDTO {
    private String id;
    private String concursoId;
    private String disciplina;
    private String topico;
    private String reconstructionText;
    private String lacunasIdentificadas;
    private Integer tempoMinutos;
    private String createdAt;

    public FeynmanSessionDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getTopico() { return topico; }
    public void setTopico(String topico) { this.topico = topico; }

    public String getReconstructionText() { return reconstructionText; }
    public void setReconstructionText(String reconstructionText) { this.reconstructionText = reconstructionText; }

    public String getLacunasIdentificadas() { return lacunasIdentificadas; }
    public void setLacunasIdentificadas(String lacunasIdentificadas) { this.lacunasIdentificadas = lacunasIdentificadas; }

    public Integer getTempoMinutos() { return tempoMinutos; }
    public void setTempoMinutos(Integer tempoMinutos) { this.tempoMinutos = tempoMinutos; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
