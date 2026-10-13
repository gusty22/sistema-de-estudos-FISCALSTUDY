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
}
