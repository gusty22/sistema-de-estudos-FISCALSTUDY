package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.ArrayList;
import java.util.List;

public class EditalValidationResultDTO {

    private boolean valid;
    private String status; // VALID, WARNINGS, INVALID
    private int totalMaterias;
    private int totalTopicos;
    private int totalSubtopicos;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private List<EditalMateriaImportDTO> normalizedMaterias = new ArrayList<>();
    private String procedenciaStatus = "JSON_STRUCTURALLY_VALID";
    private String notaFidelidade = "A validade estrutural do JSON não comprova fidelidade ao edital oficial. Requer revisão e conferência humana.";

    public EditalValidationResultDTO() {
    }

    public static EditalValidationResultDTO invalid(List<String> errors) {
        EditalValidationResultDTO dto = new EditalValidationResultDTO();
        dto.setValid(false);
        dto.setStatus("INVALID");
        dto.setErrors(errors != null ? errors : new ArrayList<>());
        return dto;
    }

    public void addError(String error) {
        this.errors.add(error);
        this.valid = false;
        this.status = "INVALID";
    }

    public void addWarning(String warning) {
        this.warnings.add(warning);
        if (this.valid && !"INVALID".equals(this.status)) {
            this.status = "WARNINGS";
        }
    }

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getTotalMaterias() {
        return totalMaterias;
    }

    public void setTotalMaterias(int totalMaterias) {
        this.totalMaterias = totalMaterias;
    }

    public int getTotalTopicos() {
        return totalTopicos;
    }

    public void setTotalTopicos(int totalTopicos) {
        this.totalTopicos = totalTopicos;
    }

    public int getTotalSubtopicos() {
        return totalSubtopicos;
    }

    public void setTotalSubtopicos(int totalSubtopicos) {
        this.totalSubtopicos = totalSubtopicos;
    }

    public List<String> getErrors() {
        return errors;
    }

    public void setErrors(List<String> errors) {
        this.errors = errors != null ? errors : new ArrayList<>();
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings != null ? warnings : new ArrayList<>();
    }

    public List<EditalMateriaImportDTO> getNormalizedMaterias() {
        return normalizedMaterias;
    }

    public void setNormalizedMaterias(List<EditalMateriaImportDTO> normalizedMaterias) {
        this.normalizedMaterias = normalizedMaterias != null ? normalizedMaterias : new ArrayList<>();
    }

    public String getProcedenciaStatus() {
        return procedenciaStatus;
    }

    public void setProcedenciaStatus(String procedenciaStatus) {
        this.procedenciaStatus = procedenciaStatus;
    }

    public String getNotaFidelidade() {
        return notaFidelidade;
    }

    public void setNotaFidelidade(String notaFidelidade) {
        this.notaFidelidade = notaFidelidade;
    }
}
