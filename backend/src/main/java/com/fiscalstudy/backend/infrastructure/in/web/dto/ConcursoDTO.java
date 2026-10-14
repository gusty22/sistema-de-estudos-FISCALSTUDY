package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fiscalstudy.backend.domain.Concurso;

public class ConcursoDTO {
    private String id;
    private String nome;
    private String orgao;
    private String banca;
    private Integer ano;
    private String cargo;
    private String cargoCodigo;
    private String status;
    private String descricao;
    private String createdAt;
    private String updatedAt;
    private long availableQuestionsCount;
    private String situacao;
    private String localidade;
    private String escolaridade;
    private Integer vagas;
    private Double salario;
    private String linkEdital;
    private String dataProva;
    private String dataProvaTipo;
    private String datasImportantesJson;
    private String disponibilidadeJson;

    public ConcursoDTO() {}

    public ConcursoDTO(Concurso c, long availableQuestionsCount) {
        this.id = c.getId();
        this.nome = c.getNome();
        this.orgao = c.getOrgao();
        this.banca = c.getBanca();
        this.ano = c.getAno();
        this.cargo = c.getCargo();
        this.cargoCodigo = c.getCargoCodigo();
        this.status = c.getStatus();
        this.descricao = c.getDescricao();
        this.createdAt = c.getCreatedAt();
        this.updatedAt = c.getUpdatedAt();
        this.availableQuestionsCount = availableQuestionsCount;
        this.situacao = c.getSituacao();
        this.localidade = c.getLocalidade();
        this.escolaridade = c.getEscolaridade();
        this.vagas = c.getVagas();
        this.salario = c.getSalario();
        this.linkEdital = c.getLinkEdital();
        this.dataProva = c.getDataProva();
        this.dataProvaTipo = c.getDataProvaTipo();
        this.datasImportantesJson = c.getDatasImportantesJson();
        this.disponibilidadeJson = c.getDisponibilidadeJson();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getOrgao() {
        return orgao;
    }

    public void setOrgao(String orgao) {
        this.orgao = orgao;
    }

    public String getBanca() {
        return banca;
    }

    public void setBanca(String banca) {
        this.banca = banca;
    }

    public Integer getAno() {
        return ano;
    }

    public void setAno(Integer ano) {
        this.ano = ano;
    }

    public String getCargo() {
        return cargo;
    }

    public void setCargo(String cargo) {
        this.cargo = cargo;
    }

    public String getCargoCodigo() {
        return cargoCodigo;
    }

    public void setCargoCodigo(String cargoCodigo) {
        this.cargoCodigo = cargoCodigo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public long getAvailableQuestionsCount() {
        return availableQuestionsCount;
    }

    public void setAvailableQuestionsCount(long availableQuestionsCount) {
        this.availableQuestionsCount = availableQuestionsCount;
    }

    public String getSituacao() {
        return situacao;
    }

    public void setSituacao(String situacao) {
        this.situacao = situacao;
    }

    public String getLocalidade() {
        return localidade;
    }

    public void setLocalidade(String localidade) {
        this.localidade = localidade;
    }

    public String getEscolaridade() {
        return escolaridade;
    }

    public void setEscolaridade(String escolaridade) {
        this.escolaridade = escolaridade;
    }

    public Integer getVagas() {
        return vagas;
    }

    public void setVagas(Integer vagas) {
        this.vagas = vagas;
    }

    public Double getSalario() {
        return salario;
    }

    public void setSalario(Double salario) {
        this.salario = salario;
    }

    public String getLinkEdital() {
        return linkEdital;
    }

    public void setLinkEdital(String linkEdital) {
        this.linkEdital = linkEdital;
    }

    public String getDataProva() {
        return dataProva;
    }

    public void setDataProva(String dataProva) {
        this.dataProva = dataProva;
    }

    public String getDataProvaTipo() {
        return dataProvaTipo;
    }

    public void setDataProvaTipo(String dataProvaTipo) {
        this.dataProvaTipo = dataProvaTipo;
    }

    public String getDatasImportantesJson() {
        return datasImportantesJson;
    }

    public void setDatasImportantesJson(String datasImportantesJson) {
        this.datasImportantesJson = datasImportantesJson;
    }

    public String getDisponibilidadeJson() {
        return disponibilidadeJson;
    }

    public void setDisponibilidadeJson(String disponibilidadeJson) {
        this.disponibilidadeJson = disponibilidadeJson;
    }
}
