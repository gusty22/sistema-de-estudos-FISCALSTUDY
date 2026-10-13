package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;
import java.util.Map;

public class ImportSimulationDTO {
    private String mode; // "TEST_MODE_DRY_RUN" ou "OPERATIONAL_MODE"
    private int totalStagingQuestions;
    private int verifiedReadyToImport;
    private int needsReviewCount;
    private int rejectedCount;
    private int collidingExistingQuestions;
    private List<String> collidingQuestionIds;
    private List<String> warnings;
    private boolean safeToImport;
    private Map<String, Integer> byDiscipline;

    public ImportSimulationDTO() {}

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public int getTotalStagingQuestions() {
        return totalStagingQuestions;
    }

    public void setTotalStagingQuestions(int totalStagingQuestions) {
        this.totalStagingQuestions = totalStagingQuestions;
    }

    public int getVerifiedReadyToImport() {
        return verifiedReadyToImport;
    }

    public void setVerifiedReadyToImport(int verifiedReadyToImport) {
        this.verifiedReadyToImport = verifiedReadyToImport;
    }

    public int getNeedsReviewCount() {
        return needsReviewCount;
    }

    public void setNeedsReviewCount(int needsReviewCount) {
        this.needsReviewCount = needsReviewCount;
    }

    public int getRejectedCount() {
        return rejectedCount;
    }

    public void setRejectedCount(int rejectedCount) {
        this.rejectedCount = rejectedCount;
    }

    public int getCollidingExistingQuestions() {
        return collidingExistingQuestions;
    }

    public void setCollidingExistingQuestions(int collidingExistingQuestions) {
        this.collidingExistingQuestions = collidingExistingQuestions;
    }

    public List<String> getCollidingQuestionIds() {
        return collidingQuestionIds;
    }

    public void setCollidingQuestionIds(List<String> collidingQuestionIds) {
        this.collidingQuestionIds = collidingQuestionIds;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings;
    }

    public boolean isSafeToImport() {
        return safeToImport;
    }

    public void setSafeToImport(boolean safeToImport) {
        this.safeToImport = safeToImport;
    }

    public Map<String, Integer> getByDiscipline() {
        return byDiscipline;
    }

    public void setByDiscipline(Map<String, Integer> byDiscipline) {
        this.byDiscipline = byDiscipline;
    }
}
