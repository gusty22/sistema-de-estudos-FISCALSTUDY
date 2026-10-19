package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;

public class QuestionUpdateRequestDTO {
    private String statement;
    private List<String> options;
    private String correctOption;
    private String gabaritoStatus;
    private String disciplina;
    private String assunto;
    private String subassunto;
    private String editalTopicoId;
    private String status; // EXTRACTED, STRUCTURALLY_VALID, NEEDS_REVIEW, SOURCE_VERIFIED, REJECTED
    private String rejectionType; // RECUPERAVEL, DEFINITIVA
    private String reviewNotes;
    private Integer numeroOriginal;
    private List<Integer> pages;
    private java.util.Map<String, Object> supportMaterial;
    private String justificativa;
    private String textoApoio;
    private String textoApoioTitulo;

    public QuestionUpdateRequestDTO() {}

    public Integer getNumeroOriginal() {
        return numeroOriginal;
    }

    public void setNumeroOriginal(Integer numeroOriginal) {
        this.numeroOriginal = numeroOriginal;
    }

    public List<Integer> getPages() {
        return pages;
    }

    public void setPages(List<Integer> pages) {
        this.pages = pages;
    }

    public String getStatement() {
        return statement;
    }

    public void setStatement(String statement) {
        this.statement = statement;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public String getCorrectOption() {
        return correctOption;
    }

    public void setCorrectOption(String correctOption) {
        this.correctOption = correctOption;
    }

    public String getGabaritoStatus() {
        return gabaritoStatus;
    }

    public void setGabaritoStatus(String gabaritoStatus) {
        this.gabaritoStatus = gabaritoStatus;
    }

    public String getDisciplina() {
        return disciplina;
    }

    public void setDisciplina(String disciplina) {
        this.disciplina = disciplina;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReviewNotes() {
        return reviewNotes;
    }

    public void setReviewNotes(String reviewNotes) {
        this.reviewNotes = reviewNotes;
    }

    public String getAssunto() {
        return assunto;
    }

    public void setAssunto(String assunto) {
        this.assunto = assunto;
    }

    public String getSubassunto() {
        return subassunto;
    }

    public void setSubassunto(String subassunto) {
        this.subassunto = subassunto;
    }

    public String getEditalTopicoId() {
        return editalTopicoId;
    }

    public void setEditalTopicoId(String editalTopicoId) {
        this.editalTopicoId = editalTopicoId;
    }

    public String getRejectionType() {
        return rejectionType;
    }

    public void setRejectionType(String rejectionType) {
        this.rejectionType = rejectionType;
    }

    public java.util.Map<String, Object> getSupportMaterial() {
        return supportMaterial;
    }

    public void setSupportMaterial(java.util.Map<String, Object> supportMaterial) {
        this.supportMaterial = supportMaterial;
    }

    public String getJustificativa() {
        return justificativa;
    }

    public void setJustificativa(String justificativa) {
        this.justificativa = justificativa;
    }

    public String getTextoApoio() {
        return textoApoio;
    }

    public void setTextoApoio(String textoApoio) {
        this.textoApoio = textoApoio;
    }

    public String getTextoApoioTitulo() {
        return textoApoioTitulo;
    }

    public void setTextoApoioTitulo(String textoApoioTitulo) {
        this.textoApoioTitulo = textoApoioTitulo;
    }
}
