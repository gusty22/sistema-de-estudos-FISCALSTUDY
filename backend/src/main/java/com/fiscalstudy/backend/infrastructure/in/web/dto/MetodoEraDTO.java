package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class MetodoEraDTO {
    private String id;
    private String concursoId;
    private String disciplina;
    private String topico;
    private String etapa; // EXPLORAR, ESTUDAR, REVISAR, AVALIAR, CONCLUIDO
    private Integer tempoExplorarSegundos;
    private Integer tempoEstudarSegundos;
    private Integer tempoRevisarSegundos;
    private Integer questoesAvaliarFeitas;
    private String anotacoesExcecoes;
    private String resumoRaizAbstracao;
    private String createdAt;

    public MetodoEraDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConcursoId() { return concursoId; }
    public void setConcursoId(String concursoId) { this.concursoId = concursoId; }

    public String getDisciplina() { return disciplina; }
    public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

    public String getTopico() { return topico; }
    public void setTopico(String topico) { this.topico = topico; }

    public String getEtapa() { return etapa; }
    public void setEtapa(String etapa) { this.etapa = etapa; }

    public Integer getTempoExplorarSegundos() { return tempoExplorarSegundos; }
    public void setTempoExplorarSegundos(Integer tempoExplorarSegundos) { this.tempoExplorarSegundos = tempoExplorarSegundos; }

    public Integer getTempoEstudarSegundos() { return tempoEstudarSegundos; }
    public void setTempoEstudarSegundos(Integer tempoEstudarSegundos) { this.tempoEstudarSegundos = tempoEstudarSegundos; }

    public Integer getTempoRevisarSegundos() { return tempoRevisarSegundos; }
    public void setTempoRevisarSegundos(Integer tempoRevisarSegundos) { this.tempoRevisarSegundos = tempoRevisarSegundos; }

    public Integer getQuestoesAvaliarFeitas() { return questoesAvaliarFeitas; }
    public void setQuestoesAvaliarFeitas(Integer questoesAvaliarFeitas) { this.questoesAvaliarFeitas = questoesAvaliarFeitas; }

    public String getAnotacoesExcecoes() { return anotacoesExcecoes; }
    public void setAnotacoesExcecoes(String anotacoesExcecoes) { this.anotacoesExcecoes = anotacoesExcecoes; }

    public String getResumoRaizAbstracao() { return resumoRaizAbstracao; }
    public void setResumoRaizAbstracao(String resumoRaizAbstracao) { this.resumoRaizAbstracao = resumoRaizAbstracao; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
