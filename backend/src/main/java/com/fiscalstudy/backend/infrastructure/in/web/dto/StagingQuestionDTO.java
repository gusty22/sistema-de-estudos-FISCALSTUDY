package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;
import java.util.Map;

public class StagingQuestionDTO {
    private String id;
    private int numeroOriginal;
    private String statement;
    private List<String> options;
    private String correctOption;
    private String gabaritoStatus;
    private String disciplina;
    private String status; // EXTRACTED, STRUCTURALLY_VALID, NEEDS_REVIEW, SOURCE_VERIFIED, REJECTED
    private List<String> flags;
    private List<Integer> pages;
    private String evidenceImage;
    private Map<String, Object> provenance;
    private String reviewNotes;
    private boolean modifiedByUser;
    private Map<String, Object> supportMaterial;
    private String assunto;
    private String subassunto;
    private String editalTopicoId;
    private String disciplinaSugerida;
    private String assuntoSugerido;
    private String subassuntoSugerido;
    private String rejectionType; // RECUPERAVEL, DEFINITIVA

    public StagingQuestionDTO() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public int getNumeroOriginal() {
        return numeroOriginal;
    }

    public void setNumeroOriginal(int numeroOriginal) {
        this.numeroOriginal = numeroOriginal;
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

    public List<String> getFlags() {
        return flags;
    }

    public void setFlags(List<String> flags) {
        this.flags = flags;
    }

    public List<Integer> getPages() {
        return pages;
    }

    public void setPages(List<Integer> pages) {
        this.pages = pages;
    }

    public String getEvidenceImage() {
        return evidenceImage;
    }

    public void setEvidenceImage(String evidenceImage) {
        this.evidenceImage = evidenceImage;
    }

    public Map<String, Object> getProvenance() {
        return provenance;
    }

    public void setProvenance(Map<String, Object> provenance) {
        this.provenance = provenance;
    }

    public String getReviewNotes() {
        return reviewNotes;
    }

    public void setReviewNotes(String reviewNotes) {
        this.reviewNotes = reviewNotes;
    }

    public boolean isModifiedByUser() {
        return modifiedByUser;
    }

    public void setModifiedByUser(boolean modifiedByUser) {
        this.modifiedByUser = modifiedByUser;
    }

    public Map<String, Object> getSupportMaterial() {
        return supportMaterial;
    }

    public void setSupportMaterial(Map<String, Object> supportMaterial) {
        this.supportMaterial = supportMaterial;
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

    public String getDisciplinaSugerida() {
        return disciplinaSugerida;
    }

    public void setDisciplinaSugerida(String disciplinaSugerida) {
        this.disciplinaSugerida = disciplinaSugerida;
    }

    public String getAssuntoSugerido() {
        return assuntoSugerido;
    }

    public void setAssuntoSugerido(String assuntoSugerido) {
        this.assuntoSugerido = assuntoSugerido;
    }

    public String getSubassuntoSugerido() {
        return subassuntoSugerido;
    }

    public void setSubassuntoSugerido(String subassuntoSugerido) {
        this.subassuntoSugerido = subassuntoSugerido;
    }

    public String getRejectionType() {
        return rejectionType;
    }

    public void setRejectionType(String rejectionType) {
        this.rejectionType = rejectionType;
    }
}
