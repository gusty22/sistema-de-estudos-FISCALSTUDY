package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventRecord;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@DisplayName("Testes do AnswerSwitchTrackerService (Regra Marcou, Acabou)")
class AnswerSwitchTrackerServiceTest {

    private EventStoreRepository eventStoreRepository;
    private JdbcTemplate jdbcTemplate;
    private ObjectMapper objectMapper;
    private AnswerSwitchTrackerService service;

    @BeforeEach
    void setUp() {
        eventStoreRepository = Mockito.mock(EventStoreRepository.class);
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        objectMapper = new ObjectMapper();
        service = new AnswerSwitchTrackerService(eventStoreRepository, jdbcTemplate, objectMapper);
    }

    @Test
    @DisplayName("Troca do Certo para o Errado deve penalizar o saldo líquido em -1 ponto")
    void testSwitchFromCorrectToWrongPenalizesScore() throws Exception {
        // Questão Q1 tem gabarito 'B'
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(
                Map.of("id", "q1", "correct_option", "B")
        ));

        // Aluno marcou B (Certo) e trocou para C (Errado)
        String payload = objectMapper.writeValueAsString(Map.of(
                "sessionId", "s1",
                "questionId", "q1",
                "fromOption", "B",
                "toOption", "C",
                "timeSpentSeconds", 45
        ));
        EventRecord event = new EventRecord("ev1", "ANSWER_SWITCHED", "QUESTION", "q1", "s1", "2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z", 1, "v1", payload);

        when(eventStoreRepository.getAllEvents("ANSWER_SWITCHED")).thenReturn(List.of(event));

        Map<String, Object> analytics = service.getAnswerSwitchAnalytics("s1");

        assertEquals(1, analytics.get("totalSwitches"));
        assertEquals(1, analytics.get("correctToWrongCount"));
        assertEquals(0, analytics.get("wrongToCorrectCount"));
        assertEquals(-1.0, (Double) analytics.get("netPointsScore"), 0.01);
        assertEquals(100.0, (Double) analytics.get("correctToWrongPercent"), 0.01);
        assertTrue(((String) analytics.get("marcouAcabouAdvice")).contains("Marcou, Acabou"));
    }

    @Test
    @DisplayName("Troca do Errado para o Certo gera saldo positivo de +1 ponto")
    void testSwitchFromWrongToCorrectRewardsScore() throws Exception {
        // Questão Q2 tem gabarito 'A'
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(
                Map.of("id", "q2", "correct_option", "A")
        ));

        // Aluno marcou D (Errado) e trocou para A (Certo)
        String payload = objectMapper.writeValueAsString(Map.of(
                "sessionId", "s2",
                "questionId", "q2",
                "fromOption", "D",
                "toOption", "A",
                "timeSpentSeconds", 30
        ));
        EventRecord event = new EventRecord("ev2", "ANSWER_SWITCHED", "QUESTION", "q2", "s2", "2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z", 1, "v1", payload);

        when(eventStoreRepository.getAllEvents("ANSWER_SWITCHED")).thenReturn(List.of(event));

        Map<String, Object> analytics = service.getAnswerSwitchAnalytics("s2");

        assertEquals(1, analytics.get("totalSwitches"));
        assertEquals(0, analytics.get("correctToWrongCount"));
        assertEquals(1, analytics.get("wrongToCorrectCount"));
        assertEquals(1.0, (Double) analytics.get("netPointsScore"), 0.01);
        assertTrue(((String) analytics.get("marcouAcabouAdvice")).contains("Trocas calibradas"));
    }
}
