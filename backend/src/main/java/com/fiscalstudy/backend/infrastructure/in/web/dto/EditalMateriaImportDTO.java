package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EditalMateriaImportDTO {

    @JsonProperty("id")
    private String id;

    @JsonProperty("nome")
    private String nome;

    @JsonProperty("topicos")
    private List<EditalTopicoImportDTO> topicos = new ArrayList<>();

    private Integer ordem;

    public EditalMateriaImportDTO() {
    }

    public EditalMateriaImportDTO(String id, String nome) {
        this.id = id;
        this.nome = nome;
    }

    public EditalMateriaImportDTO(String id, String nome, List<EditalTopicoImportDTO> topicos, Integer ordem) {
        this.id = id;
        this.nome = nome;
        this.topicos = topicos != null ? topicos : new ArrayList<>();
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

    public List<EditalTopicoImportDTO> getTopicos() {
        return topicos;
    }

    public void setTopicos(List<EditalTopicoImportDTO> topicos) {
        this.topicos = topicos != null ? topicos : new ArrayList<>();
    }

    public Integer getOrdem() {
        return ordem;
    }

    public void setOrdem(Integer ordem) {
        this.ordem = ordem;
    }
}
