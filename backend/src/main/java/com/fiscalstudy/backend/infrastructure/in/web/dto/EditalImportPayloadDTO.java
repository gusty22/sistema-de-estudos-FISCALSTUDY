package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EditalImportPayloadDTO {

    @JsonProperty("materias")
    private List<EditalMateriaImportDTO> materias = new ArrayList<>();

    @JsonProperty("versao")
    private String versao = "1.0";

    @JsonProperty("docOrigem")
    private String docOrigem;

    @JsonProperty("tipo")
    private String tipo = "ORIGINAL";

    public EditalImportPayloadDTO() {
    }

    public EditalImportPayloadDTO(List<EditalMateriaImportDTO> materias) {
        this.materias = materias != null ? materias : new ArrayList<>();
    }

    public List<EditalMateriaImportDTO> getMaterias() {
        return materias;
    }

    public void setMaterias(List<EditalMateriaImportDTO> materias) {
        this.materias = materias != null ? materias : new ArrayList<>();
    }

    public String getVersao() {
        return versao;
    }

    public void setVersao(String versao) {
        this.versao = versao != null ? versao : "1.0";
    }

    public String getDocOrigem() {
        return docOrigem;
    }

    public void setDocOrigem(String docOrigem) {
        this.docOrigem = docOrigem;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo != null ? tipo : "ORIGINAL";
    }
}
