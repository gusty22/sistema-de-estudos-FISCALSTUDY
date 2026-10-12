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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

@RestController
@RequestMapping("/api/v1/ingestion")
public class IngestionController {

    private static final Logger logger = LoggerFactory.getLogger(IngestionController.class);
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public IngestionController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
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
                
                String optionsJson = "[]";
                if (q.containsKey("options")) {
                    try {
                        optionsJson = objectMapper.writeValueAsString(q.get("options"));
                    } catch (JsonProcessingException e) {
                        logger.error("Error serializing options", e);
                    }
                }
                
                String correctOption = null; 
                if (q.containsKey("correct_option") && q.get("correct_option") != null) {
                    String rawOpt = String.valueOf(q.get("correct_option")).trim();
                    if (!rawOpt.isEmpty() && !rawOpt.equalsIgnoreCase("null")) {
                        correctOption = rawOpt.toUpperCase();
                    }
                }

                String gabaritoStatus = "DEFINITIVO";
                if (q.containsKey("gabarito_status") && q.get("gabarito_status") != null) {
                    gabaritoStatus = String.valueOf(q.get("gabarito_status")).trim().toUpperCase();
                } else if ("ANULADA".equalsIgnoreCase(correctOption)) {
                    gabaritoStatus = "ANULADA";
                } else if (correctOption == null || correctOption.isBlank()) {
                    gabaritoStatus = "AUSENTE";
                }

                if ("ANULADA".equalsIgnoreCase(gabaritoStatus) && correctOption == null) {
                    correctOption = "ANULADA";
                }

                String disciplina = null;
                if (q.containsKey("disciplina") && q.get("disciplina") != null) {
                    disciplina = String.valueOf(q.get("disciplina")).trim();
                }

                String orgao = metadata != null && metadata.containsKey("orgao") ? (String) metadata.get("orgao") : "Prefeitura de Araguari";

                // Proteção contra colisão acidental entre provas distintas
                List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                    "SELECT id, banca, ano, cargo, orgao FROM questions WHERE id = ?", id
                );
                if (!existing.isEmpty()) {
                    Map<String, Object> prev = existing.get(0);
                    String prevBanca = (String) prev.get("banca");
                    Integer prevAno = (Integer) prev.get("ano");
                    String prevCargo = (String) prev.get("cargo");

                    boolean sameProvenance = java.util.Objects.equals(prevBanca, banca) &&
                                             java.util.Objects.equals(prevAno, ano) &&
                                             java.util.Objects.equals(prevCargo, cargo);
                    if (!sameProvenance) {
                        id = buildCanonicalQuestionId(banca, ano, cargo, id);
                        logger.warn("ID collision detected with different provenance. Re-qualifying to canonical ID: {}", id);
                    }
                }

                boolean hasGabaritoCol = jdbcTemplate.queryForList("PRAGMA table_info(questions)").stream()
                        .anyMatch(col -> "gabarito_status".equalsIgnoreCase(String.valueOf(col.get("name"))));

                if (hasGabaritoCol) {
                    String sql = "INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, orgao, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                                 "ON CONFLICT(id) DO UPDATE SET enunciado=excluded.enunciado, options_json=excluded.options_json, correct_option=excluded.correct_option, gabarito_status=excluded.gabarito_status, banca=excluded.banca, ano=excluded.ano, orgao=excluded.orgao, cargo=excluded.cargo, disciplina=excluded.disciplina";
                    jdbcTemplate.update(sql, id, statement, optionsJson, correctOption, gabaritoStatus, banca, ano, orgao, cargo, disciplina);
                } else {
                    String sql = "INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, orgao, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                                 "ON CONFLICT(id) DO UPDATE SET enunciado=excluded.enunciado, options_json=excluded.options_json, correct_option=excluded.correct_option, banca=excluded.banca, ano=excluded.ano, orgao=excluded.orgao, cargo=excluded.cargo, disciplina=excluded.disciplina";
                    jdbcTemplate.update(sql, id, statement, optionsJson, correctOption, banca, ano, orgao, cargo, disciplina);
                }
                
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

    private String buildCanonicalQuestionId(String banca, Integer ano, String cargo, String rawId) {
        String b = banca != null ? slugify(banca) : "banca";
        String y = ano != null ? String.valueOf(ano) : "0000";
        String c = cargo != null ? slugify(cargo) : "cargo";
        return b + "-" + y + "-" + c + "-q" + rawId;
    }

    private String slugify(String input) {
        if (input == null) return "unknown";
        return java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replaceAll("[^a-zA-Z0-9]+", "-")
                .toLowerCase()
                .replaceAll("^-+|-+$", "");
    }
}
