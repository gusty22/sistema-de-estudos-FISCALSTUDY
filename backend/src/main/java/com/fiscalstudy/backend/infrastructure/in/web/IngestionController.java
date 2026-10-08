package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.infrastructure.in.web.dto.ImportPayloadDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ingestion")
public class IngestionController {

    private static final Logger logger = LoggerFactory.getLogger(IngestionController.class);

    @PostMapping("/import")
    public ResponseEntity<Void> importData(@RequestBody ImportPayloadDTO payload) {
        logger.info("Received ingestion payload: {}", payload);
        // A lógica de domínio (interpretação do payload ou estatísticas) ainda NÃO deve ser implementada no endpoint.
        return ResponseEntity.ok().build();
    }
}
