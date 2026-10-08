package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.infrastructure.in.web.dto.ImportPayloadDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ingestion")
public class IngestionController {

    private static final Logger logger = LoggerFactory.getLogger(IngestionController.class);
    private final JdbcTemplate jdbcTemplate;

    public IngestionController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/import")
    public ResponseEntity<Void> importData(@RequestBody ImportPayloadDTO payload) {
        logger.info("Received ingestion payload: version={}, source={}", payload.getVersion(), payload.getSource());

        Map<String, Object> data = payload.getData();
        if (data != null && data.containsKey("questions")) {
            List<Map<String, Object>> questions = (List<Map<String, Object>>) data.get("questions");
            
            // Extrair metadata
            Map<String, Object> metadata = (Map<String, Object>) data.get("metadata");
            String banca = metadata != null ? (String) metadata.get("banca") : null;
            Integer ano = metadata != null ? (Integer) metadata.get("ano") : null;
            String cargo = metadata != null ? (String) metadata.get("cargo") : null;

            for (Map<String, Object> q : questions) {
                Object rawId = q.get("id");
                String id = rawId != null ? String.valueOf(rawId) : UUID.randomUUID().toString();
                Object rawStatement = q.get("statement");
                String statement = rawStatement != null ? String.valueOf(rawStatement) : null;
                
                String sql = "INSERT INTO questions (id, enunciado, banca, ano, cargo) VALUES (?, ?, ?, ?, ?) " +
                             "ON CONFLICT(id) DO UPDATE SET enunciado=excluded.enunciado, banca=excluded.banca, ano=excluded.ano, cargo=excluded.cargo";
                jdbcTemplate.update(sql, id, statement, banca, ano, cargo);
                
                logger.info("Saved question {}", id);
            }

            // Registrar evento na event_store
            String eventId = UUID.randomUUID().toString();
            String now = Instant.now().toString();
            String eventSql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            jdbcTemplate.update(eventSql, eventId, "IMPORT_RECEIVED", "INGESTION", payload.getSource() != null ? payload.getSource() : "UNKNOWN",
                    now, now, 1, "v1", "{\"imported_questions\":" + questions.size() + "}");
            
            logger.info("Event IMPORT_RECEIVED recorded for source {}", payload.getSource());
        }

        return ResponseEntity.ok().build();
    }
}
