package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class StagingSessionDTO {
    private String sessionId;
    private String status; // PENDING, INSPECTING, EXTRACTING, PARSING, VALIDATING, AWAITING_REVIEW, COMPLETED, FAILED
    private String stepDescription;
    private int progressPercent;
    private String createdAt;
    private List<StagingDocumentDTO> documents;
    private Map<String, Object> metadata;
    private Map<String, Object> summary;
    private String errorMessage;

    public StagingSessionDTO() {
        this.createdAt = Instant.now().toString();
    }

    public StagingSessionDTO(String sessionId, String status, String stepDescription) {
        this.sessionId = sessionId;
        this.status = status;
        this.stepDescription = stepDescription;
        this.createdAt = Instant.now().toString();
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStepDescription() {
        return stepDescription;
    }

    public void setStepDescription(String stepDescription) {
        this.stepDescription = stepDescription;
    }

    public int getProgressPercent() {
        return progressPercent;
    }

    public void setProgressPercent(int progressPercent) {
        this.progressPercent = progressPercent;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public List<StagingDocumentDTO> getDocuments() {
        return documents;
    }

    public void setDocuments(List<StagingDocumentDTO> documents) {
        this.documents = documents;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public Map<String, Object> getSummary() {
        return summary;
    }

    public void setSummary(Map<String, Object> summary) {
        this.summary = summary;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public static class StagingDocumentDTO {
        private String id;
        private String originalFilename;
        private String role; // PROVA, GABARITO_PRELIMINAR, GABARITO_DEFINITIVO, etc.
        private long sizeBytes;
        private String format;
        private String sha256;

        public StagingDocumentDTO() {}

        public StagingDocumentDTO(String id, String originalFilename, String role, long sizeBytes, String format) {
            this.id = id;
            this.originalFilename = originalFilename;
            this.role = role;
            this.sizeBytes = sizeBytes;
            this.format = format;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getOriginalFilename() {
            return originalFilename;
        }

        public void setOriginalFilename(String originalFilename) {
            this.originalFilename = originalFilename;
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public long getSizeBytes() {
            return sizeBytes;
        }

        public void setSizeBytes(long sizeBytes) {
            this.sizeBytes = sizeBytes;
        }

        public String getFormat() {
            return format;
        }

        public void setFormat(String format) {
            this.format = format;
        }

        public String getSha256() {
            return sha256;
        }

        public void setSha256(String sha256) {
            this.sha256 = sha256;
        }
    }
}
