package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class StagingFileDTO {
    private String id;
    private String relPath;
    private String filename;
    private long fileSizeBytes;
    private String sha256;
    private int totalPages;
    private boolean hasSelectableText;
    private boolean isScanned;
    private String docFamily;
    private String banca;
    private Integer ano;
    private String orgao;
    private String cargo;
    private String status;
    private int questionCount;
    private int verifiedCount;
    private int needsReviewCount;
    private boolean hasInconsistency;
    private String inconsistencyReason;

    public StagingFileDTO() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRelPath() {
        return relPath;
    }

    public void setRelPath(String relPath) {
        this.relPath = relPath;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public String getSha256() {
        return sha256;
    }

    public void setSha256(String sha256) {
        this.sha256 = sha256;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public boolean isHasSelectableText() {
        return hasSelectableText;
    }

    public void setHasSelectableText(boolean hasSelectableText) {
        this.hasSelectableText = hasSelectableText;
    }

    public boolean isScanned() {
        return isScanned;
    }

    public void setScanned(boolean scanned) {
        isScanned = scanned;
    }

    public String getDocFamily() {
        return docFamily;
    }

    public void setDocFamily(String docFamily) {
        this.docFamily = docFamily;
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

    public String getOrgao() {
        return orgao;
    }

    public void setOrgao(String orgao) {
        this.orgao = orgao;
    }

    public String getCargo() {
        return cargo;
    }

    public void setCargo(String cargo) {
        this.cargo = cargo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getQuestionCount() {
        return questionCount;
    }

    public void setQuestionCount(int questionCount) {
        this.questionCount = questionCount;
    }

    public int getVerifiedCount() {
        return verifiedCount;
    }

    public void setVerifiedCount(int verifiedCount) {
        this.verifiedCount = verifiedCount;
    }

    public int getNeedsReviewCount() {
        return needsReviewCount;
    }

    public void setNeedsReviewCount(int needsReviewCount) {
        this.needsReviewCount = needsReviewCount;
    }

    public boolean isHasInconsistency() {
        return hasInconsistency;
    }

    public void setHasInconsistency(boolean hasInconsistency) {
        this.hasInconsistency = hasInconsistency;
    }

    public String getInconsistencyReason() {
        return inconsistencyReason;
    }

    public void setInconsistencyReason(String inconsistencyReason) {
        this.inconsistencyReason = inconsistencyReason;
    }
}
