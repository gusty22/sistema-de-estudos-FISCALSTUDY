package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class QuestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");

        String qId = "q123";
        String optionsJson = "[\"A) Option A\", \"B) Option B\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo) VALUES (?, ?, ?, ?, ?, ?, ?)",
                qId, "Qual a capital de MG?", optionsJson, "A", "FCC", 2023, "Auditor");
    }

    @Test
    void getNextQuestion_ReturnsQuestion_And_NoGabarito() throws Exception {
        mockMvc.perform(get("/api/v1/questions/next?sessionId=sess1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value("q123"))
                .andExpect(jsonPath("$.statement").value("Qual a capital de MG?"))
                .andExpect(jsonPath("$.correctOption").doesNotExist())
                .andExpect(jsonPath("$.gabarito").doesNotExist());

        // Validate event QUESTION_PRESENTED was NOT saved by GET (read-only / no side-effects)
        Integer eventCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type = 'QUESTION_PRESENTED'", Integer.class);
        assertEquals(0, eventCount);
    }

    @Test
    void getNextQuestion_ExcludesAnsweredQuestionsInSession() throws Exception {
        // Insert a second question
        String optionsJson = "[\"A) SP\", \"B) RJ\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo) VALUES (?, ?, ?, ?, ?, ?, ?)",
                "q456", "Qual a capital de SP?", optionsJson, "A", "FCC", 2023, "Auditor");

        // Record that q123 was already answered in session "sess1"
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q123', 'sess1', '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z', 1, 'v1', '{}')");

        mockMvc.perform(get("/api/v1/questions/next?sessionId=sess1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value("q456"));
    }

    @Test
    void getNextQuestion_WhenAllAnsweredInSession_ReturnsNotFound() throws Exception {
        // Record that q123 was already answered in session "sess1"
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q123', 'sess1', '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z', 1, 'v1', '{}')");

        mockMvc.perform(get("/api/v1/questions/next?sessionId=sess1"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getNextQuestion_WithDisciplineFilter_ReturnsMatchingQuestion() throws Exception {
        jdbcTemplate.update("UPDATE questions SET disciplina = 'Geografia' WHERE id = 'q123'");

        String optionsJson = "[\"A) 2\", \"B) 3\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "q999", "Quanto é 1+1?", optionsJson, "A", "FCC", 2023, "Auditor", "Matemática");

        mockMvc.perform(get("/api/v1/questions/next?disciplina=Matemática"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value("q999"));
    }

    @Test
    void getDisciplines_ReturnsDistinctOrderedList() throws Exception {
        jdbcTemplate.update("UPDATE questions SET disciplina = 'Geografia' WHERE id = 'q123'");

        String optionsJson = "[\"A) 2\", \"B) 3\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "q999", "Quanto é 1+1?", optionsJson, "A", "FCC", 2023, "Auditor", "Matemática");

        mockMvc.perform(get("/api/v1/questions/disciplines"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0]").value("Geografia"))
                .andExpect(jsonPath("$[1]").value("Matemática"));
    }

    @Test
    void recordPresentation_ValidPayload_SavesEvent() throws Exception {
        String payload = "{\"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/presented")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk());

        Integer eventCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type = 'QUESTION_PRESENTED' AND session_id = 'sess1'", Integer.class);
        assertEquals(1, eventCount);
    }

    @Test
    void recordPresentation_DuplicateCall_IsIdempotent() throws Exception {
        String payload = "{\"sessionId\":\"sess1\"}";

        // First call
        mockMvc.perform(post("/api/v1/questions/q123/presented")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk());

        // Duplicate call (simulating StrictMode or retry within debounce window)
        mockMvc.perform(post("/api/v1/questions/q123/presented")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk());

        Integer eventCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type = 'QUESTION_PRESENTED' AND session_id = 'sess1'", Integer.class);
        assertEquals(1, eventCount);
    }

    @Test
    void recordPresentation_MissingSessionId_ReturnsBadRequest() throws Exception {
        String payload = "{}";

        mockMvc.perform(post("/api/v1/questions/q123/presented")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitAttempt_ValidCorrectAnswer_ReturnsTrue() throws Exception {
        String payload = "{\"selectedOption\":\"A\", \"confidenceLevel\":5, \"activeTimeMs\":1500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(true));

        // Validate event ANSWER_SUBMITTED was saved
        Integer eventCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type = 'ANSWER_SUBMITTED'", Integer.class);
        assertEquals(1, eventCount);
    }

    @Test
    void submitAttempt_ValidIncorrectAnswer_ReturnsFalse() throws Exception {
        String payload = "{\"selectedOption\":\"B\", \"confidenceLevel\":3, \"activeTimeMs\":2000, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(false));
    }

    @Test
    void submitAttempt_InvalidConfidence_ReturnsBadRequest() throws Exception {
        String payload = "{\"selectedOption\":\"A\", \"confidenceLevel\":6, \"activeTimeMs\":1500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitAttempt_ZeroConfidence_ReturnsBadRequest() throws Exception {
        String payload = "{\"selectedOption\":\"A\", \"confidenceLevel\":0, \"activeTimeMs\":1500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitAttempt_InvalidOption_ReturnsBadRequest() throws Exception {
        String payload = "{\"selectedOption\":\"Z\", \"confidenceLevel\":4, \"activeTimeMs\":1500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitAttempt_EmptyOption_ReturnsBadRequest() throws Exception {
        String payload = "{\"selectedOption\":\"\", \"confidenceLevel\":4, \"activeTimeMs\":1500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitAttempt_NegativeTime_ReturnsBadRequest() throws Exception {
        String payload = "{\"selectedOption\":\"A\", \"confidenceLevel\":4, \"activeTimeMs\":-500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/q123/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitAttempt_NonExistentQuestion_ReturnsNotFound() throws Exception {
        String payload = "{\"selectedOption\":\"A\", \"confidenceLevel\":4, \"activeTimeMs\":1500, \"sessionId\":\"sess1\"}";

        mockMvc.perform(post("/api/v1/questions/invalid_q/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isNotFound());
    }
}
