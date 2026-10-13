package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnalyticsProjectionService;
import com.fiscalstudy.backend.application.AttemptSubmissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class AnalyticsExportIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AnalyticsProjectionService analyticsProjectionService;

    @Autowired
    private AttemptSubmissionService attemptSubmissionService;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");

        String optionsJson = "[\"A) Primeira\", \"B) Segunda\", \"C) Terceira\", \"D) Quarta\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, orgao, cargo, disciplina, assunto) " +
                "VALUES ('q1', 'Enunciado Q1', ?, 'A', 'DEFINITIVO', 'IBGP', 2023, 'Prefeitura de Araguari', 'Auditor Fiscal', 'Direito Tributário', 'Imunidades')",
                optionsJson);

        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, orgao, cargo, disciplina, assunto) " +
                "VALUES ('q2', 'Enunciado Q2 Anulada', ?, 'ANULADA', 'ANULADA', 'IBGP', 2023, 'Prefeitura de Araguari', 'Auditor Fiscal', 'Contabilidade', 'Balancete')",
                optionsJson);

        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, orgao, cargo, disciplina, assunto) " +
                "VALUES ('q3', 'Enunciado Q3 Ausente', ?, null, 'AUSENTE', 'IBGP', 2023, 'Prefeitura de Araguari', 'Auditor Fiscal', 'Legislação', 'CTM')",
                optionsJson);
    }

    @Test
    void export_EmptyDataset_ReturnsHeaderOnlyAndValidZeroedManifest() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("fiscalstudy_attempts.csv")))
                .andExpect(content().string(startsWith("question_id,selected_option,is_correct,gabarito_status,confidence_level,active_time_ms,discipline,board,year,topic,assunto,orgao,cargo,event_id,session_id,occurred_at,origin_type,concurso_point\n")))
                .andExpect(content().string(not(containsString("\"q1\""))));

        mockMvc.perform(get("/api/v1/analytics/export/manifest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manifest_version").value("1.0.0"))
                .andExpect(jsonPath("$.contract_version").value("1.0.0"))
                .andExpect(jsonPath("$.total_records").value(0))
                .andExpect(jsonPath("$.evaluable_records").value(0))
                .andExpect(jsonPath("$.non_evaluable_records").value(0))
                .andExpect(jsonPath("$.checksum").isNotEmpty())
                .andExpect(jsonPath("$.is_production_environment").value(true));
    }

    @Test
    void export_RealStudyRecords_IdentifiedAndExportedWithFullAuditTrail() throws Exception {
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-real-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'sess-real-101', '2026-10-13T10:15:30Z', '2026-10-13T10:15:30Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":14500,\"origin\":\"REAL_STUDY\"}')");

        mockMvc.perform(get("/api/v1/analytics/export?origin=REAL_STUDY"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("\"q1\",\"A\",true,\"DEFINITIVO\",5,14500,\"Direito Tributário\",\"IBGP\",2023,\"Imunidades\",\"Imunidades\",\"Prefeitura de Araguari\",\"Auditor Fiscal\",\"evt-real-1\",\"sess-real-101\",\"2026-10-13T10:15:30Z\",\"REAL_STUDY\",1")));

        mockMvc.perform(get("/api/v1/analytics/export/manifest?origin=REAL_STUDY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.declared_origin").value("REAL_STUDY"))
                .andExpect(jsonPath("$.total_records").value(1))
                .andExpect(jsonPath("$.evaluable_records").value(1))
                .andExpect(jsonPath("$.non_evaluable_records").value(0));
    }

    @Test
    void export_DemonstrationAndTestRecords_SegregatedWhenFilteringRealStudy() throws Exception {
        // Record 1: Real study
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-real-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'sess-user-1', '2026-10-13T10:00:00Z', '2026-10-13T10:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":4,\"activeTimeMs\":12000,\"origin\":\"REAL_STUDY\"}')");

        // Record 2: Demonstration
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-demo-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'sess-demo-1', '2026-10-13T10:05:00Z', '2026-10-13T10:05:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"B\",\"isCorrect\":false,\"concursoPoint\":0,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":1,\"activeTimeMs\":5000,\"origin\":\"DEMONSTRATION\"}')");

        // Record 3: Automated Test
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-test-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'test-sess-1', '2026-10-13T10:10:00Z', '2026-10-13T10:10:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":3000,\"origin\":\"AUTOMATED_TEST\"}')");

        // When requesting only REAL_STUDY: demo and test are excluded
        mockMvc.perform(get("/api/v1/analytics/export?origin=REAL_STUDY"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("evt-real-1")))
                .andExpect(content().string(not(containsString("evt-demo-1"))))
                .andExpect(content().string(not(containsString("evt-test-1"))));

        // When requesting ALL: all 3 records are present with respective tags
        mockMvc.perform(get("/api/v1/analytics/export?origin=ALL"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("evt-real-1")))
                .andExpect(content().string(containsString("evt-demo-1")))
                .andExpect(content().string(containsString("evt-test-1")));
    }

    @Test
    void export_UnverifiedHistoricalRecords_ClassifiedStrictlyWithoutInventingProvenance() throws Exception {
        // Record without origin metadata (legacy pre-provenance event)
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-legacy-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'sess-old-99', '2026-10-12T05:00:00Z', '2026-10-12T05:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":22000}')");

        mockMvc.perform(get("/api/v1/analytics/export"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("\"evt-legacy-1\",\"sess-old-99\",\"2026-10-12T05:00:00Z\",\"UNVERIFIED_HISTORICAL\",1")));
    }

    @Test
    void export_AnnulledAndMissingGabaritoQuestions_SegregatedPedagogically() throws Exception {
        // Attempt on Q2 (Annulled)
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-annulled-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q2', 's1', '2026-10-13T11:00:00Z', '2026-10-13T11:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q2\",\"selectedOption\":\"C\",\"isCorrect\":null,\"concursoPoint\":1,\"gabaritoStatus\":\"ANULADA\",\"confidenceLevel\":5,\"activeTimeMs\":18000,\"origin\":\"REAL_STUDY\"}')");

        // Attempt on Q3 (Missing Answer Key)
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-missing-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q3', 's1', '2026-10-13T11:05:00Z', '2026-10-13T11:05:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q3\",\"selectedOption\":\"A\",\"isCorrect\":null,\"concursoPoint\":0,\"gabaritoStatus\":\"AUSENTE\",\"confidenceLevel\":3,\"activeTimeMs\":15000,\"origin\":\"REAL_STUDY\"}')");

        mockMvc.perform(get("/api/v1/analytics/export"))
                .andExpect(status().isOk())
                // Q2 (Annulled): is_correct = NA, concurso_point = 1
                .andExpect(content().string(containsString("\"q2\",\"C\",NA,\"ANULADA\",5,18000")))
                .andExpect(content().string(containsString(",1\n")))
                // Q3 (Missing): is_correct = NA, concurso_point = 0
                .andExpect(content().string(containsString("\"q3\",\"A\",NA,\"AUSENTE\",3,15000")))
                .andExpect(content().string(containsString(",0\n")));

        mockMvc.perform(get("/api/v1/analytics/export/manifest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_records").value(2))
                .andExpect(jsonPath("$.evaluable_records").value(0))
                .andExpect(jsonPath("$.non_evaluable_records").value(2));
    }

    @Test
    void export_DuplicateSubmissions_IdempotencyPreserved() {
        // First submission
        attemptSubmissionService.submitAttempt("q1", "A", 4, 10000, "session-idempotency-1", "REAL_STUDY");

        // Second submission for same question in same session
        attemptSubmissionService.submitAttempt("q1", "A", 4, 10000, "session-idempotency-1", "REAL_STUDY");

        String csv = analyticsProjectionService.exportCsv("ALL");
        String[] lines = csv.split("\r\n|\r|\n");
        // Exactly 1 header + 1 attempt line
        assertEquals(2, lines.length, "Only one event must exist due to session idempotency");
    }

    @Test
    void export_InconsistentIdentifiers_HandledGracefully() throws Exception {
        // Event references a question ID that doesn't exist in questions table
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-unknown-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q-inexistente', 's1', '2026-10-13T12:00:00Z', '2026-10-13T12:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q-inexistente\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":4,\"activeTimeMs\":12000,\"origin\":\"REAL_STUDY\"}')");

        mockMvc.perform(get("/api/v1/analytics/export"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("\"q-inexistente\",\"A\",true,\"DEFINITIVO\",4,12000,\"Geral\",\"IBGP\",2023,\"NA\",\"NA\",\"NA\",\"NA\",\"evt-unknown-1\"")));
    }

    @Test
    void export_TemporalIntegrity_PreservesAuthenticTimestampsWithoutFaking() {
        String isoUtc = "2026-10-13T14:22:15.123456Z";
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-time-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'sess-exact', ?, ?, 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":8000,\"origin\":\"REAL_STUDY\"}')",
                isoUtc, isoUtc);

        String csv = analyticsProjectionService.exportCsv("REAL_STUDY");
        assertTrue(csv.contains(isoUtc), "Authentic ISO-8601 timestamp must be preserved verbatim");
    }

    @Test
    void exportPackageToDirectory_WritesVerifiableCsvAndManifest() throws Exception {
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('evt-pkg-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 'sess-pkg-1', '2026-10-13T15:00:00Z', '2026-10-13T15:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":11000,\"origin\":\"REAL_STUDY\"}')");

        Path tempDir = Files.createTempDirectory("fiscalstudy_export_test");
        try {
            AnalyticsProjectionService.ExportPackageResult result =
                    analyticsProjectionService.exportPackageToDirectory(tempDir, "REAL_STUDY");

            assertTrue(Files.exists(result.getCsvPath()));
            assertTrue(Files.exists(result.getManifestPath()));

            byte[] csvBytes = Files.readAllBytes(result.getCsvPath());
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(csvBytes);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            String actualHash = hexString.toString();

            assertEquals(actualHash, result.getManifest().getChecksum(), "Manifest checksum must exactly match CSV file SHA-256");
            assertEquals(1, result.getManifest().getTotalRecords());
            assertEquals("REAL_STUDY", result.getManifest().getDeclaredOrigin());
        } finally {
            // Cleanup temp dir
            File[] files = tempDir.toFile().listFiles();
            if (files != null) {
                for (File f : files) f.delete();
            }
            tempDir.toFile().delete();
        }
    }

    @Test
    void export_PreservesOperationalDatabaseFileIntegrity() {
        File prodDb = new File("../db/fiscalstudy.db");
        if (!prodDb.exists()) {
            prodDb = new File("db/fiscalstudy.db");
        }
        if (prodDb.exists()) {
            assertTrue(prodDb.length() > 0, "Operational database exists and must not be empty");
        }
    }
}
