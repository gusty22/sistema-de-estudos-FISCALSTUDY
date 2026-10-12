package com.fiscalstudy.backend.infrastructure.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");

        String optionsJson = "[\"A) 1\", \"B) 2\", \"C) 3\", \"D) 4\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "q1", "Questão Tributário", optionsJson, "A", "IBGP", 2023, "Auditor", "Direito Tributário");
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "q2", "Questão Contabilidade", optionsJson, "B", "IBGP", 2023, "Auditor", "Contabilidade");
    }

    @Test
    void getOverview_WhenEmpty_ReturnsZeroedMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAnswered").value(0))
                .andExpect(jsonPath("$.globalAccuracy").value(0.0))
                .andExpect(jsonPath("$.guidance.observacao").value(containsString("Nenhum evento")));
    }

    @Test
    void getOverview_WithEvents_ComputesMetricsAndGuidance() throws Exception {
        // Record attempt 1: correct on q1 (Tributário) with confidence 5
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-12T01:00:00Z', '2026-10-12T01:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":12000}')");

        // Record attempt 2: error on q2 (Contabilidade) with confidence 5 (overconfidence)
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e2', 'ANSWER_SUBMITTED', 'QUESTION', 'q2', 's1', '2026-10-12T01:01:00Z', '2026-10-12T01:01:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q2\",\"selectedOption\":\"A\",\"isCorrect\":false,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":18000}')");

        mockMvc.perform(get("/api/v1/analytics/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAnswered").value(2))
                .andExpect(jsonPath("$.evaluatedCount").value(2))
                .andExpect(jsonPath("$.correctCount").value(1))
                .andExpect(jsonPath("$.errorCount").value(1))
                .andExpect(jsonPath("$.globalAccuracy").value(50.0))
                .andExpect(jsonPath("$.overconfidenceCount").value(1))
                .andExpect(jsonPath("$.byDiscipline['Direito Tributário'].accuracy").value(100.0))
                .andExpect(jsonPath("$.byDiscipline['Contabilidade'].accuracy").value(0.0))
                .andExpect(jsonPath("$.guidance.observacao").value(containsString("2 tentativas")))
                .andExpect(jsonPath("$.guidance.diagnostico").value(containsString("Volume amostral")));
    }

    @Test
    void exportCsv_ReturnsCsvFormattedDataset() throws Exception {
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-12T01:00:00Z', '2026-10-12T01:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":12000}')");

        mockMvc.perform(get("/api/v1/analytics/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("fiscalstudy_attempts.csv")))
                .andExpect(content().contentType("text/csv; charset=UTF-8"))
                .andExpect(content().string(containsString("question_id,selected_option,is_correct")))
                .andExpect(content().string(containsString("\"q1\",\"A\",true,\"DEFINITIVO\",5,12000,\"Direito Tributário\",\"IBGP\",2023")));
    }
}
