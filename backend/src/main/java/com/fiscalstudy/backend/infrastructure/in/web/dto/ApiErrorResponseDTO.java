package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class ApiErrorResponseDTO {
    private String error;
    private String message;
    private String executionId;
    private String timestamp;
    private Map<String, Object> details;

    public ApiErrorResponseDTO() {
        this.executionId = UUID.randomUUID().toString();
        this.timestamp = Instant.now().toString();
    }

    public ApiErrorResponseDTO(String error, String message) {
        this();
        this.error = error;
        this.message = message;
    }

    public ApiErrorResponseDTO(String error, String message, String executionId) {
        this.error = error;
        this.message = message;
        this.executionId = executionId != null ? executionId : UUID.randomUUID().toString();
        this.timestamp = Instant.now().toString();
    }

    public ApiErrorResponseDTO(String error, String message, String executionId, Map<String, Object> details) {
        this(error, message, executionId);
        this.details = details;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getExecutionId() {
        return executionId;
    }

    public void setExecutionId(String executionId) {
        this.executionId = executionId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public Map<String, Object> getDetails() {
        return details;
    }

    public void setDetails(Map<String, Object> details) {
        this.details = details;
    }
}
