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
import static org.mockito.Mockito.when;

@DisplayName("Testes do TimeMetricService (HE vs HRE e Alertas)")
class TimeMetricServiceTest {

    private EventStoreRepository eventStoreRepository;
    private JdbcTemplate jdbcTemplate;
    private ObjectMapper objectMapper;
    private TimeMetricService service;

    @BeforeEach
    void setUp() {
        eventStoreRepository = Mockito.mock(EventStoreRepository.class);
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        objectMapper = new ObjectMapper();
        service = new TimeMetricService(eventStoreRepository, jdbcTemplate, objectMapper);
    }

    @Test
    @DisplayName("Separa corretamente HE de HRE e calcula horas")
    void testHeVsHreSeparation() throws Exception {
        // Sessão 1: HE (ativo) 3600s = 1.0h
        String payloadHe = objectMapper.writeValueAsString(Map.of(
                "sessionId", "s1",
                "concursoId", "c1",
                "disciplina", "Direito Tributário",
                "durationSeconds", 3600,
                "activityType", "HE",
                "nextSessionHandoff", "Parou no art. 150 do CTN"
        ));
        EventRecord e1 = new EventRecord("ev1", "STUDY_SESSION_RECORDED", "STUDY_SESSION", "s1", "s1", "2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z", 1, "v1", payloadHe);

        // Sessão 2: HRE (operacional) 1800s = 0.5h
        String payloadHre = objectMapper.writeValueAsString(Map.of(
                "sessionId", "s2",
                "concursoId", "c1",
                "disciplina", "Direito Tributário",
                "durationSeconds", 1800,
                "activityType", "HRE"
        ));
        EventRecord e2 = new EventRecord("ev2", "STUDY_SESSION_RECORDED", "STUDY_SESSION", "s2", "s2", "2026-10-14T11:00:00Z", "2026-10-14T11:00:00Z", 1, "v1", payloadHre);

        when(eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED")).thenReturn(List.of(e1, e2));

        Map<String, Object> summary = service.getTimeMetricsSummary("c1");

        assertEquals(3600L, summary.get("heSeconds"));
        assertEquals(1800L, summary.get("hreSeconds"));
        assertEquals(1.0, (Double) summary.get("heHours"), 0.01);
        assertEquals(0.5, (Double) summary.get("hreHours"), 0.01);
        assertEquals(1.5, (Double) summary.get("totalHours"), 0.01);

        // HRE ratio = 1800 / 5400 = 33.3% > 15% -> threshold exceeded!
        assertTrue((Boolean) summary.get("isHreThresholdExceeded"));
        assertTrue(((String) summary.get("hreAlertMessage")).contains("Alerta de Fricção"));

        // Mensagem para o Eu do Futuro recuperada
        Map<String, String> handoffs = (Map<String, String>) summary.get("lastHandoffPerDisciplina");
        assertEquals("Parou no art. 150 do CTN", handoffs.get("Direito Tributário"));
    }

    @Test
    @DisplayName("Quando HRE <= 15%, status deve ser saudável sem alerta")
    void testHealthyHreRatio() throws Exception {
        // HE: 5400s (90%), HRE: 600s (10%)
        String p1 = objectMapper.writeValueAsString(Map.of("sessionId", "s1", "durationSeconds", 5400, "activityType", "HE"));
        String p2 = objectMapper.writeValueAsString(Map.of("sessionId", "s2", "durationSeconds", 600, "activityType", "HRE"));

        EventRecord e1 = new EventRecord("ev1", "STUDY_SESSION_RECORDED", "STUDY_SESSION", "s1", "s1", "2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z", 1, "v1", p1);
        EventRecord e2 = new EventRecord("ev2", "STUDY_SESSION_RECORDED", "STUDY_SESSION", "s2", "s2", "2026-10-14T11:00:00Z", "2026-10-14T11:00:00Z", 1, "v1", p2);

        when(eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED")).thenReturn(List.of(e1, e2));

        Map<String, Object> summary = service.getTimeMetricsSummary(null);

        assertFalse((Boolean) summary.get("isHreThresholdExceeded"));
        assertTrue(((String) summary.get("hreAlertMessage")).contains("Balanço Cognitivo Saudável"));
    }
}
