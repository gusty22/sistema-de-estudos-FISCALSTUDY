package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class CrossDomainBridgeDTO {
    private String id;
    private String dominioADisciplina;
    private String dominioATopico;
    private String dominioBDisciplina;
    private String dominioBTopico;
    private String conceitoFronteira;
    private String desafioPrompt;
    private int maxCaracteres;
    private String createdAt;
    private Integer totalRespostas;
    private String ultimaResposta;

    public CrossDomainBridgeDTO() {}

    public CrossDomainBridgeDTO(String id, String dominioADisciplina, String dominioATopico,
                                String dominioBDisciplina, String dominioBTopico,
                                String conceitoFronteira, String desafioPrompt, int maxCaracteres) {
        this.id = id;
        this.dominioADisciplina = dominioADisciplina;
        this.dominioATopico = dominioATopico;
        this.dominioBDisciplina = dominioBDisciplina;
        this.dominioBTopico = dominioBTopico;
        this.conceitoFronteira = conceitoFronteira;
        this.desafioPrompt = desafioPrompt;
        this.maxCaracteres = maxCaracteres;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getDominioADisciplina() { return dominioADisciplina; }
    public void setDominioADisciplina(String dominioADisciplina) { this.dominioADisciplina = dominioADisciplina; }
    public String getDominioATopico() { return dominioATopico; }
    public void setDominioATopico(String dominioATopico) { this.dominioATopico = dominioATopico; }
    public String getDominioBDisciplina() { return dominioBDisciplina; }
    public void setDominioBDisciplina(String dominioBDisciplina) { this.dominioBDisciplina = dominioBDisciplina; }
    public String getDominioBTopico() { return dominioBTopico; }
    public void setDominioBTopico(String dominioBTopico) { this.dominioBTopico = dominioBTopico; }
    public String getConceitoFronteira() { return conceitoFronteira; }
    public void setConceitoFronteira(String conceitoFronteira) { this.conceitoFronteira = conceitoFronteira; }
    public String getDesafioPrompt() { return desafioPrompt; }
    public void setDesafioPrompt(String desafioPrompt) { this.desafioPrompt = desafioPrompt; }
    public int getMaxCaracteres() { return maxCaracteres; }
    public void setMaxCaracteres(int maxCaracteres) { this.maxCaracteres = maxCaracteres; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public Integer getTotalRespostas() { return totalRespostas; }
    public void setTotalRespostas(Integer totalRespostas) { this.totalRespostas = totalRespostas; }
    public String getUltimaResposta() { return ultimaResposta; }
    public void setUltimaResposta(String ultimaResposta) { this.ultimaResposta = ultimaResposta; }
}
