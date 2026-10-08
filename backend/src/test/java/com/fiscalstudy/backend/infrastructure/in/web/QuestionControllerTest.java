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
        String optionsJson = "[{\"label\":\"A\", \"text\":\"Option A\"}, {\"label\":\"B\", \"text\":\"Option B\"}]";
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

        // Validate event QUESTION_PRESENTED was saved
        Integer eventCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type = 'QUESTION_PRESENTED'", Integer.class);
        assertEquals(1, eventCount);
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
