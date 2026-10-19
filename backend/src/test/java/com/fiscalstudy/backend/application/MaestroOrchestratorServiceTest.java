package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MaestroPlanDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MaestroOrchestratorServiceTest {

    private JdbcTemplate jdbcTemplate;
    private EventStoreRepository eventStoreRepository;
    private ObjectMapper objectMapper;
    private MaestroOrchestratorService maestroService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        eventStoreRepository = mock(EventStoreRepository.class);
        objectMapper = new ObjectMapper();
        maestroService = new MaestroOrchestratorService(jdbcTemplate, eventStoreRepository, objectMapper);
    }

    @Test
    @DisplayName("Deve gerar plano de 3 horas com o roteiro mastigado imersivo (Passo 1 Anki, Passo 2 Priming, Passo 3 Teoria, Passo 4 Descanso)")
    void testGenerateDailyPlan3Hours() {
        when(jdbcTemplate.queryForList(startsWith("SELECT nome FROM concursos"), any(Object[].class)))
                .thenReturn(List.of(Map.of("nome", "Auditor Fiscal Araguari")));

        when(jdbcTemplate.queryForList(startsWith("SELECT disciplina, assunto"), any(Object[].class)))
                .thenReturn(List.of(Map.of("disciplina", "Direito Administrativo", "assunto", "Atos Administrativos", "subassunto", "Atributos do Ato")));

        when(jdbcTemplate.queryForList(startsWith("SELECT COUNT(*) as total FROM anki_flashcards")))
                .thenReturn(List.of(Map.of("total", 15)));

        MaestroPlanDTO plan = maestroService.generateDailyPlan("concurso-123", 180);

        assertNotNull(plan);
        assertEquals(180, plan.getTempoTotalMinutos());
        assertTrue(plan.getPassos().size() >= 4);

        // Passo 1: Anki SRS
        var p1 = plan.getPassos().get(0);
        assertEquals(1, p1.getNumeroPasso());
        assertEquals("ANKI_SRS", p1.getTipo());
        assertTrue(p1.getInstrucaoMastigada().contains("cards pendentes"));
        assertTrue(p1.getInstrucaoMastigada().contains("Direito Administrativo"));

        // Passo 2: Priming Cognitivo
        var p2 = plan.getPassos().get(1);
        assertEquals(2, p2.getNumeroPasso());
        assertEquals("PRIMING_COGNITIVO", p2.getTipo());
        assertTrue(p2.getInstrucaoMastigada().contains("5 questões"));

        // Passo 3: Teoria
        var p3 = plan.getPassos().get(2);
        assertEquals(3, p3.getNumeroPasso());
        assertEquals("TEORIA", p3.getTipo());
        assertTrue(p3.getInstrucaoMastigada().contains("Estude"));

        // Passo 4: Descanso
        var p4 = plan.getPassos().get(3);
        assertEquals(4, p4.getNumeroPasso());
        assertEquals("DESCANSO", p4.getTipo());
        assertTrue(p4.getInstrucaoMastigada().contains("Pausa"));
    }

    @Test
    @DisplayName("Deve registrar evento MAESTRO_STEP_COMPLETED no event_store")
    void testRecordStepCompleted() {
        maestroService.recordStepCompleted("concurso-123", 1, "ANKI_SRS", 15);
        verify(eventStoreRepository, times(1)).appendEvent(
                eq("MAESTRO_STEP_COMPLETED"),
                eq("MAESTRO"),
                eq("concurso-123"),
                anyString(),
                eq(1),
                eq("1.0"),
                anyString()
        );
    }
}
