package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.infrastructure.in.web.dto.ApiErrorResponseDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponseDTO> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
        String execId = UUID.randomUUID().toString();
        logger.error("[{}] Upload size exceeded limit: {}", execId, ex.getMessage());
        ApiErrorResponseDTO error = new ApiErrorResponseDTO(
                "PAYLOAD_TOO_LARGE",
                "O arquivo enviado excede o limite máximo permitido de 50MB. Reduza o tamanho ou divida os documentos.",
                execId,
                Map.of("maxFileSize", "50MB", "maxRequestSize", "100MB")
        );
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponseDTO> handleIllegalArgument(IllegalArgumentException ex) {
        String execId = UUID.randomUUID().toString();
        logger.warn("[{}] Bad request: {}", execId, ex.getMessage());
        ApiErrorResponseDTO error = new ApiErrorResponseDTO(
                "BAD_REQUEST",
                ex.getMessage(),
                execId
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponseDTO> handleIllegalState(IllegalStateException ex) {
        String execId = UUID.randomUUID().toString();
        logger.warn("[{}] Illegal state: {}", execId, ex.getMessage());
        ApiErrorResponseDTO error = new ApiErrorResponseDTO(
                "ILLEGAL_STATE",
                ex.getMessage(),
                execId
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponseDTO> handleGeneralException(Exception ex) {
        String execId = UUID.randomUUID().toString();
        logger.error("[{}] Internal server error: {}", execId, ex.getMessage(), ex);
        ApiErrorResponseDTO error = new ApiErrorResponseDTO(
                "INTERNAL_SERVER_ERROR",
                "Erro interno no processamento: " + ex.getMessage(),
                execId
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
