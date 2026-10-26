package com.fiscalstudy.backend.application.knowledge;

import com.fiscalstudy.backend.domain.EventRecord;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.knowledge.CognitiveMetricsCalculator;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeProjection;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

public class TopicKnowledgeDeterministicReconstructionTest {

    private EventStoreRepository eventStoreRepository;
    private TopicKnowledgeRepository topicKnowledgeRepository;
    private JdbcTemplate jdbcTemplate;
    private TopicKnowledgeAggregatorService aggregatorService;

    private List<TopicKnowledgeProjection> savedProjections;

    @BeforeEach
    void setUp() {
        eventStoreRepository = mock(EventStoreRepository.class);
        topicKnowledgeRepository = mock(TopicKnowledgeRepository.class);
        jdbcTemplate = mock(JdbcTemplate.class);
        savedProjections = new ArrayList<>();

        doAnswer(invocation -> {
            savedProjections.add(invocation.getArgument(0));
            return null;
        }).when(topicKnowledgeRepository).saveOrUpdate(any());

        doAnswer(invocation -> {
            savedProjections.addAll(invocation.getArgument(0));
            return null;
        }).when(topicKnowledgeRepository).replaceAll(any());

        aggregatorService = new TopicKnowledgeAggregatorService(
                eventStoreRepository,
                topicKnowledgeRepository,
                jdbcTemplate
        );
    }

    @Test
    @DisplayName("Cenário 1: Tópico com zero tentativas deve resultar em SEM_EVIDENCIAS com denominador explícito")
    void testZeroAttemptsYieldsSemEvidencias() {
        TopicKnowledgeProjection proj = aggregatorService.buildProjection(
                "dir_trib_imunidades",
                "DIREITO_TRIBUTARIO",
                "Imunidades Tributárias",
                Collections.emptyList(),
                null
        );

        assertEquals("SEM_EVIDENCIAS", proj.getEvidenceStatus());
        assertEquals("SEM_EVIDENCIAS", proj.getAccuracyDenominatorText());
        assertEquals(0, proj.getTotalAttempts());
        assertEquals(0, proj.getCorrectAttempts());
        assertEquals(0.0, proj.getAccuracyRate());
        assertNull(proj.getAvgConfidenceOrdinal());
        assertTrue(proj.getEpistemicLimitationsJson().contains("Ausência total de tentativas"));
    }

    @Test
    @DisplayName("Cenário 2: Poucas tentativas (N=3) resultam em PRELIMINAR com denominador explícito e sem pesos arbitrários")
    void testFewAttemptsYieldsPreliminarWithExplicitDenominator() {
        List<TopicKnowledgeAggregatorService.ParsedAttempt> attempts = List.of(
                new TopicKnowledgeAggregatorService.ParsedAttempt(
                        "ev-1", "q-101", "DIREITO_TRIBUTARIO", "dir_trib_imunidades",
                        true, 4, 45000, 0, null, "SIMULADO", true, false, Instant.now()
                ),
                new TopicKnowledgeAggregatorService.ParsedAttempt(
                        "ev-2", "q-102", "DIREITO_TRIBUTARIO", "dir_trib_imunidades",
                        true, 2, 60000, 0, null, "RETESTE", true, false, Instant.now()
                ),
                new TopicKnowledgeAggregatorService.ParsedAttempt(
                        "ev-3", "q-103", "DIREITO_TRIBUTARIO", "dir_trib_imunidades",
                        false, 5, 80000, 0, "PEGADINHA_BANCA", "REGULAR", true, false, Instant.now()
                )
        );

        TopicKnowledgeProjection proj = aggregatorService.buildProjection(
                "dir_trib_imunidades",
                "DIREITO_TRIBUTARIO",
                "Imunidades Tributárias",
                attempts,
                null
        );

        assertEquals("PRELIMINAR", proj.getEvidenceStatus());
        assertEquals("2/3", proj.getAccuracyDenominatorText());
        assertEquals(3, proj.getTotalAttempts());
        assertEquals(2, proj.getCorrectAttempts());
        assertEquals(1, proj.getErrorAttempts());
        assertEquals(0.667, proj.getAccuracyRate(), 0.005);

        // Média ordinal pura: (4 + 2 + 5) / 3 = 11 / 3 = 3.67
        assertNotNull(proj.getAvgConfidenceOrdinal());
        assertEquals(3.67, proj.getAvgConfidenceOrdinal(), 0.01);

        // Metacognição: 1 acerto com baixa confiança (nível 2), 1 erro com alta confiança (nível 5)
        assertEquals(1, proj.getLowConfidenceSuccesses());
        assertEquals(1, proj.getHighConfidenceErrors());

        // Contextos gravados sem multiplicação arbitrária
        assertTrue(proj.getContextDistributionJson().contains("\"SIMULADO\":1"));
        assertTrue(proj.getContextDistributionJson().contains("\"RETESTE\":1"));
        assertTrue(proj.getContextDistributionJson().contains("\"REGULAR\":1"));

        // Causa de erro registrada
        assertTrue(proj.getErrorCausesDistributionJson().contains("\"PEGADINHA_BANCA\":1"));

        // Limitações epistemológicas explícitas
        assertTrue(proj.getEpistemicLimitationsJson().contains("Amostra preliminar (N=3 em 3 questões únicas)"));
        assertTrue(proj.getEpistemicLimitationsJson().contains("Detecção de 1 erro(s) com alta confiança declarada"));
        assertTrue(proj.getEpistemicLimitationsJson().contains("Detecção de 1 acerto(s) com baixa confiança"));
    }

    @Test
    @DisplayName("Cenário 3: Reconstrução determinística integral a partir de eventos do event_store")
    void testRebuildAllProducesDeterministicOutput() {
        // Mock question query
        doAnswer(inv -> {
            RowCallbackHandler rch = inv.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getString("id")).thenReturn("q-1").thenReturn("q-2");
            when(rs.getString("disciplina")).thenReturn("CONTABILIDADE").thenReturn("CONTABILIDADE");
            when(rs.getString("assunto")).thenReturn("Balancete de Verificação").thenReturn("Balancete de Verificação");
            when(rs.getString("banca")).thenReturn("FGV").thenReturn("FGV");
            when(rs.getInt("ano")).thenReturn(2025).thenReturn(2025);
            rch.processRow(rs);
            rch.processRow(rs);
            return null;
        }).when(jdbcTemplate).query(anyString(), any(RowCallbackHandler.class));

        // Mock canonical topics query
        doAnswer(inv -> {
            RowCallbackHandler rch = inv.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getString("id")).thenReturn("top-cont-1");
            when(rs.getString("disciplina")).thenReturn("CONTABILIDADE");
            when(rs.getString("assunto")).thenReturn("Balancete de Verificação");
            rch.processRow(rs);
            return null;
        }).when(jdbcTemplate).query(contains("edital_topicos"), any(RowCallbackHandler.class));

        // Mock events in event_store
        List<EventRecord> events = List.of(
                new EventRecord("e-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":30000,\"origin\":\"REAL_STUDY\",\"exposicaoAnteriorCount\":0}"),
                new EventRecord("e-2", "ANSWER_SUBMITTED", "QUESTION", "q-2", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-2\",\"isCorrect\":false,\"confidenceLevel\":4,\"activeTimeMs\":50000,\"origin\":\"REAL_STUDY\",\"exposicaoAnteriorCount\":0,\"causaErro\":\"FALTA_ATENCAO\"}"),
                // Evento sintético que DEVE ser descartado
                new EventRecord("e-3", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":5,\"activeTimeMs\":10000,\"origin\":\"AUTOMATED_TEST\"}")
        );

        when(eventStoreRepository.getAllEvents("ANSWER_SUBMITTED")).thenReturn(events);

        TopicKnowledgeAggregatorService.RebuildResult result = aggregatorService.rebuildAll();

        assertNotNull(result);
        assertEquals(2, result.totalAttempts()); // Descartou o AUTOMATED_TEST

        verify(topicKnowledgeRepository, times(1)).replaceAll(anyList());
        assertTrue(savedProjections.size() >= 1);

        TopicKnowledgeProjection proj = savedProjections.get(0);
        assertEquals("Balancete de Verificação", proj.getTopicName());
        assertEquals(2, proj.getTotalAttempts());
        assertEquals(1, proj.getCorrectAttempts());
        assertEquals(1, proj.getErrorAttempts());
        assertEquals("1/2", proj.getAccuracyDenominatorText());
        assertEquals(1, proj.getHighConfidenceErrors()); // 1 erro com confiança 4
    }

    @Test
    @DisplayName("Cenário 4: Preservação estrita da confiança como escala ordinal (sem probabilidades forçadas)")
    void testOrdinalConfidenceNoFakeProbabilities() {
        List<Integer> ordinalLevels = List.of(1, 2, 3, 4, 5);
        Double mean = CognitiveMetricsCalculator.computeOrdinalConfidenceMean(ordinalLevels);
        assertEquals(3.0, mean);

        // Nível 1 com acerto = low confidence success
        assertTrue(CognitiveMetricsCalculator.isLowConfidenceSuccess(1, true));
        assertTrue(CognitiveMetricsCalculator.isLowConfidenceSuccess(2, true));
        assertFalse(CognitiveMetricsCalculator.isLowConfidenceSuccess(3, true));

        // Nível 5 com erro = high confidence error
        assertTrue(CognitiveMetricsCalculator.isHighConfidenceError(5, false));
        assertTrue(CognitiveMetricsCalculator.isHighConfidenceError(4, false));
        assertFalse(CognitiveMetricsCalculator.isHighConfidenceError(3, false));
    }
}
