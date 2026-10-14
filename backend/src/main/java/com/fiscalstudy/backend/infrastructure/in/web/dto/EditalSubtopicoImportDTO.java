package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EditalSubtopicoImportDTO {

    @JsonProperty("id")
    private String id;

    @JsonProperty("nome")
    private String nome;

    private Integer ordem;

    public EditalSubtopicoImportDTO() {
    }

    public EditalSubtopicoImportDTO(String id, String nome) {
        this.id = id;
        this.nome = nome;
    }

    public EditalSubtopicoImportDTO(String id, String nome, Integer ordem) {
        this.id = id;
        this.nome = nome;
        this.ordem = ordem;
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

    public Integer getOrdem() {
        return ordem;
    }

    public void setOrdem(Integer ordem) {
        this.ordem = ordem;
    }
}
