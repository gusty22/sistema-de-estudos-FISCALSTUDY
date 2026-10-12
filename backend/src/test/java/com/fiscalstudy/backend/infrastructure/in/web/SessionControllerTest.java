package com.fiscalstudy.backend.infrastructure.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
    }

    @Test
    void startSession_RecordsEvent() throws Exception {
        String payload = "{\"sessionId\":\"sess-lifecycle-1\"}";

        mockMvc.perform(post("/api/v1/sessions/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk());

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_store WHERE event_type = 'STUDY_SESSION_STARTED' AND session_id = 'sess-lifecycle-1'",
                Integer.class
        );
        assertEquals(1, count);
    }

    @Test
    void endSession_RecordsEvent() throws Exception {
        String payload = "{\"sessionId\":\"sess-lifecycle-1\"}";

        mockMvc.perform(post("/api/v1/sessions/end")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk());

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_store WHERE event_type = 'STUDY_SESSION_ENDED' AND session_id = 'sess-lifecycle-1'",
                Integer.class
        );
        assertEquals(1, count);
    }

    @Test
    void getSessionSummary_CalculatesMetricsFromEvents() throws Exception {
        String sessId = "sess-metrics-1";

        // Insert mock ANSWER_SUBMITTED events directly into event_store
        String sql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        // 1. Correct answer, 2000ms, confidence 4
        jdbcTemplate.update(sql, "e1", "ANSWER_SUBMITTED", "QUESTION", "q1", sessId, "2026-10-12T00:00:00Z", "2026-10-12T00:00:00Z", 1, "v1",
                "{\"selectedOption\":\"A\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":2000}");

        // 2. Incorrect answer with overconfidence (confidence 5), 4000ms
        jdbcTemplate.update(sql, "e2", "ANSWER_SUBMITTED", "QUESTION", "q2", sessId, "2026-10-12T00:01:00Z", "2026-10-12T00:01:00Z", 1, "v1",
                "{\"selectedOption\":\"B\",\"isCorrect\":false,\"confidenceLevel\":5,\"activeTimeMs\":4000}");

        mockMvc.perform(get("/api/v1/sessions/" + sessId + "/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAnswered").value(2))
                .andExpect(jsonPath("$.correctCount").value(1))
                .andExpect(jsonPath("$.accuracy").value(50.0))
                .andExpect(jsonPath("$.averageTimeMs").value(3000.0))
                .andExpect(jsonPath("$.overconfidenceCount").value(1));
    }
}
