package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class DigitalTwinServiceTest {

    private EditalRepository editalRepository;
    private EventStoreRepository eventStoreRepository;
    private StudySessionService studySessionService;
    private QuestionRepository questionRepository;
    private ObjectMapper objectMapper;
    private DigitalTwinService digitalTwinService;

    @BeforeEach
    void setUp() {
        editalRepository = Mockito.mock(EditalRepository.class);
        eventStoreRepository = Mockito.mock(EventStoreRepository.class);
        studySessionService = Mockito.mock(StudySessionService.class);
        questionRepository = Mockito.mock(QuestionRepository.class);
        objectMapper = new ObjectMapper();

        digitalTwinService = new DigitalTwinService(
                editalRepository,
                eventStoreRepository,
                studySessionService,
                questionRepository,
                objectMapper
        );
    }

    @Test
    void testGetDigitalTwinStatusWithEmptyTopics() {
        when(editalRepository.findTopicosByConcurso("concurso-1")).thenReturn(Collections.emptyList());
        when(eventStoreRepository.getAllEvents("ATTEMPT_SUBMITTED")).thenReturn(Collections.emptyList());
        when(eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED")).thenReturn(Collections.emptyList());
        when(studySessionService.getStudyTimeSummary("concurso-1")).thenReturn(Map.of(
                "totalHours", 0.0,
                "progressTowardsThresholdPct", 0.0,
                "avgPagesPerHour", 0.0,
                "avgQuestionsPerHour", 0.0,
                "overallScorePct", 0.0
        ));

        Map<String, Object> status = digitalTwinService.getDigitalTwinStatus("concurso-1", "Sefaz Teste");

        assertNotNull(status);
        assertEquals("concurso-1", status.get("concursoId"));
        assertEquals(0, status.get("totalNos"));
        assertEquals(3100.0, status.get("metaHorasAprovacao"));
        assertEquals(0.0, status.get("saudeNeuralMediaPct"));
    }

    @Test
    void testGetDigitalTwinStatusWithTopicsAndAttempts() {
        EditalTopico t1 = new EditalTopico("top-1", "ed-1", "c-1", "Direito Tributário", "Imunidades", null, 2.0, 10, "doc", 1, "trecho", "EXPLICITA", true);
        EditalTopico t2 = new EditalTopico("top-2", "ed-1", "c-1", "Contabilidade Geral", "Balancete", null, 1.5, 8, "doc", 2, "trecho", "EXPLICITA", true);

        when(editalRepository.findTopicosByConcurso("c-1")).thenReturn(List.of(t1, t2));
        when(eventStoreRepository.getAllEvents("ATTEMPT_SUBMITTED")).thenReturn(Collections.emptyList());
        when(eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED")).thenReturn(Collections.emptyList());
        when(studySessionService.getStudyTimeSummary("c-1")).thenReturn(Map.of(
                "totalHours", 450.0,
                "progressTowardsThresholdPct", 14.5,
                "avgPagesPerHour", 18.2,
                "avgQuestionsPerHour", 22.0,
                "overallScorePct", 78.5
        ));

        Map<String, Object> status = digitalTwinService.getDigitalTwinStatus("c-1", "Receita Municipal");

        assertNotNull(status);
        assertEquals(2, status.get("totalNos"));
        assertEquals(2, status.get("nosVirgens"));
        assertEquals(450.0, status.get("horasLiquidasAcumuladas"));
        assertEquals(3100.0, status.get("metaHorasAprovacao"));

        Map<String, Object> sim = (Map<String, Object>) status.get("simulacaoRecente");
        assertNotNull(sim);
        assertEquals(100, sim.get("totalQuestoesSimuladas"));

        Map<String, Object> roteiro = (Map<String, Object>) status.get("roteiroDoDia");
        assertNotNull(roteiro);
        assertTrue(roteiro.containsKey("blocosSugeridos"));
    }
}
