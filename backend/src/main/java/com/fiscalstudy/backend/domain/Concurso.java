package com.fiscalstudy.backend.domain;

public class Concurso {
    private String id;
    private String nome;
    private String orgao;
    private String banca;
    private Integer ano;
    private String cargo;
    private String cargoCodigo;
    private String status; // ACTIVE, ARCHIVED
    private String descricao;
    private String createdAt;
    private String updatedAt;

    public Concurso() {
    }

    public Concurso(String id, String nome, String orgao, String banca, Integer ano, String cargo, String cargoCodigo, String status, String descricao) {
        this.id = id;
        this.nome = nome;
        this.orgao = orgao;
        this.banca = banca;
        this.ano = ano;
        this.cargo = cargo;
        this.cargoCodigo = cargoCodigo;
        this.status = status != null ? status : "ACTIVE";
        this.descricao = descricao;
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
}
