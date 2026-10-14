package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.application.IngestionPipelineService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/v1/ingestion")
public class IngestionController {

    private static final Logger logger = LoggerFactory.getLogger(IngestionController.class);
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final IngestionPipelineService pipelineService;
    private final com.fiscalstudy.backend.application.StagingDatabaseService stagingDatabaseService;

    public IngestionController(JdbcTemplate jdbcTemplate, 
                               IngestionPipelineService pipelineService,
                               com.fiscalstudy.backend.application.StagingDatabaseService stagingDatabaseService) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
        this.pipelineService = pipelineService;
        this.stagingDatabaseService = stagingDatabaseService;
    }

    // --- ENDPOINTS DO NOVO PIPELINE DE STAGING E IMPORTAÇÃO ---

    @PostMapping("/sessions")
    public ResponseEntity<StagingSessionDTO> createSession(@RequestBody(required = false) Map<String, Object> metadata) {
        StagingSessionDTO session = pipelineService.createSession(metadata);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions/{sessionId}/upload")
    public ResponseEntity<StagingSessionDTO.StagingDocumentDTO> uploadDocument(
            @PathVariable String sessionId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "role", defaultValue = "PROVA") String role) throws IOException {
        StagingSessionDTO.StagingDocumentDTO doc = pipelineService.uploadFile(sessionId, file, role);
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/sessions/{sessionId}/process")
    public ResponseEntity<StagingSessionDTO> startProcessing(@PathVariable String sessionId) {
        StagingSessionDTO session = pipelineService.runProcessing(sessionId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions/{sessionId}/cancel")
    public ResponseEntity<StagingSessionDTO> cancelProcessing(@PathVariable String sessionId) {
        StagingSessionDTO session = pipelineService.cancelSession(sessionId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/demo")
    public ResponseEntity<StagingSessionDTO> runDemoSession(@RequestParam(value = "cargo", defaultValue = "532") String cargo) {
        StagingSessionDTO session = pipelineService.createDemoSession(cargo);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<StagingSessionDTO> getSession(@PathVariable String sessionId) {
        StagingSessionDTO session = pipelineService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }

    @GetMapping("/sessions/{sessionId}/questions")
    public ResponseEntity<List<StagingQuestionDTO>> getSessionQuestions(@PathVariable String sessionId) {
        List<StagingQuestionDTO> questions = pipelineService.getSessionQuestions(sessionId);
        return ResponseEntity.ok(questions);
    }

    @PutMapping("/sessions/{sessionId}/questions/{questionId}")
    public ResponseEntity<StagingQuestionDTO> updateQuestion(
            @PathVariable String sessionId,
            @PathVariable String questionId,
            @RequestBody QuestionUpdateRequestDTO req) {
        try {
            StagingQuestionDTO updated = pipelineService.updateQuestion(sessionId, questionId, req);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/sessions/{sessionId}/questions/{questionId}/verify")
    public ResponseEntity<StagingQuestionDTO> verifyQuestion(
            @PathVariable String sessionId,
            @PathVariable String questionId) {
        try {
            StagingQuestionDTO updated = pipelineService.markQuestionVerified(sessionId, questionId);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/sessions/{sessionId}/questions/{questionId}/reject")
    public ResponseEntity<StagingQuestionDTO> rejectQuestion(
            @PathVariable String sessionId,
            @PathVariable String questionId) {
        try {
            StagingQuestionDTO updated = pipelineService.markQuestionRejected(sessionId, questionId);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/sessions/{sessionId}/evidence/{filename}")
    public ResponseEntity<byte[]> getEvidenceImage(
            @PathVariable String sessionId,
            @PathVariable String filename) {
        try {
            byte[] imageBytes = pipelineService.getEvidenceImage(sessionId, filename);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_PNG);
            return new ResponseEntity<>(imageBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/sessions/{sessionId}/simulate-import")
    public ResponseEntity<ImportSimulationDTO> simulateImport(@PathVariable String sessionId) {
        try {
            ImportSimulationDTO sim = pipelineService.simulateImport(sessionId);
            return ResponseEntity.ok(sim);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/sessions/{sessionId}/import-confirmed")
    public ResponseEntity<Map<String, Object>> importConfirmed(@PathVariable String sessionId) {
        try {
            int count = pipelineService.importVerifiedQuestions(sessionId);
            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "imported_count", count,
                    "session_id", sessionId
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // --- ENDPOINTS DE CONSULTA E AUDITORIA DO ACERVO EM STAGING ---

    @GetMapping("/staging-files")
    public ResponseEntity<List<StagingFileDTO>> getStagingFiles() {
        List<StagingFileDTO> files = stagingDatabaseService.listStagingFiles();
        return ResponseEntity.ok(files);
    }

    @GetMapping("/staging-files/{fileId}/questions")
    public ResponseEntity<List<StagingQuestionDTO>> getQuestionsForStagingFile(@PathVariable String fileId) {
        List<StagingQuestionDTO> questions = stagingDatabaseService.getQuestionsForFile(fileId);
        return ResponseEntity.ok(questions);
    }

    @PutMapping("/staging-questions/{questionId}")
    public ResponseEntity<StagingQuestionDTO> updateStagingQuestion(
            @PathVariable String questionId,
            @RequestBody QuestionUpdateRequestDTO req) {
        try {
            StagingQuestionDTO updated = stagingDatabaseService.updateStagingQuestion(questionId, req);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/staging-questions/{questionId}/verify")
    public ResponseEntity<StagingQuestionDTO> verifyStagingQuestion(@PathVariable String questionId) {
        try {
            StagingQuestionDTO updated = stagingDatabaseService.verifyStagingQuestion(questionId);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/staging-questions/{questionId}/reject")
    public ResponseEntity<StagingQuestionDTO> rejectStagingQuestion(@PathVariable String questionId) {
        try {
            StagingQuestionDTO updated = stagingDatabaseService.rejectStagingQuestion(questionId);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/staging-questions/{questionId}/evidence-image")
    public ResponseEntity<byte[]> getQuestionEvidenceImage(@PathVariable String questionId) {
        try {
            byte[] imageBytes = stagingDatabaseService.renderEvidenceForQuestion(questionId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_PNG);
            return new ResponseEntity<>(imageBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            logger.warn("Could not render evidence for question {}: {}", questionId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/staging-publish")
    public ResponseEntity<Map<String, Object>> publishStaging(
            @RequestParam(required = false) String fileId,
            @RequestParam(defaultValue = "false") boolean includeStructurallyValid) {
        try {
            Map<String, Object> result = stagingDatabaseService.publishToOperationalDb(fileId, includeStructurallyValid);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // --- ENDPOINT ORIGINAL (PRESERVADO PARA RETROCOMPATIBILIDADE) ---

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
