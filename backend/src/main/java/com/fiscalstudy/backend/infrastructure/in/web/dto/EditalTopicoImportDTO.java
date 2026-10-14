package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EditalTopicoImportDTO {

    @JsonProperty("id")
    private String id;

    @JsonProperty("nome")
    private String nome;

    private List<EditalSubtopicoImportDTO> subtopicos = new ArrayList<>();

    private Integer ordem;

    public EditalTopicoImportDTO() {
    }

    public EditalTopicoImportDTO(String id, String nome) {
        this.id = id;
        this.nome = nome;
    }

    public EditalTopicoImportDTO(String id, String nome, List<EditalSubtopicoImportDTO> subtopicos, Integer ordem) {
        this.id = id;
        this.nome = nome;
        this.subtopicos = subtopicos != null ? subtopicos : new ArrayList<>();
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

    public List<EditalSubtopicoImportDTO> getSubtopicos() {
        return subtopicos;
    }

    public void setSubtopicos(List<EditalSubtopicoImportDTO> subtopicos) {
        this.subtopicos = subtopicos != null ? subtopicos : new ArrayList<>();
    }

    /**
     * Suporte flexível a subtópicos como objetos { "id": "...", "nome": "..." }
     * ou strings simples ["Subtópico 1", "Subtópico 2"].
     */
    @JsonSetter("subtopicos")
    public void deserializeSubtopicos(JsonNode node) {
        this.subtopicos = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return;
        }

        int index = 0;
        for (JsonNode item : node) {
            if (item.isTextual()) {
                String subNome = item.asText();
                String subId = (this.id != null ? this.id : "top") + "_sub_" + String.format("%03d", index + 1);
                this.subtopicos.add(new EditalSubtopicoImportDTO(subId, subNome, index));
            } else if (item.isObject()) {
                String subId = item.hasNonNull("id") ? item.get("id").asText() : null;
                String subNome = item.hasNonNull("nome") ? item.get("nome").asText() : null;
                this.subtopicos.add(new EditalSubtopicoImportDTO(subId, subNome, index));
            }
            index++;
        }
    }

    public Integer getOrdem() {
        return ordem;
    }

    public void setOrdem(Integer ordem) {
        this.ordem = ordem;
    }
}
