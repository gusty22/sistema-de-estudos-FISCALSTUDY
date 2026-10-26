package com.fiscalstudy.backend.application.review;

import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveArchitectureService;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdaptiveReviewDecisionEngineTest {

    private UnifiedCognitiveArchitectureService cognitiveService;
    private EventStoreRepository eventStoreRepository;
    private JdbcTemplate jdbcTemplate;
    private AdaptiveReviewDecisionEngine engine;

    @BeforeEach
    void setUp() {
        cognitiveService = Mockito.mock(UnifiedCognitiveArchitectureService.class);
        eventStoreRepository = Mockito.mock(EventStoreRepository.class);
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        engine = new AdaptiveReviewDecisionEngine(cognitiveService, eventStoreRepository, jdbcTemplate);
    }

    @Test
    void unvalidatedTopicModelCannotEmitExecutableReviewDecisions() {
        AdaptiveRevisionDecisionDTO result = engine.evaluateDecisions("contest-1", 45);

        assertEquals("BLOCKED_UNVALIDATED_MODEL", result.getStatus());
        assertFalse(result.isCanApply());
        assertTrue(result.getDecisoes().isEmpty());
        assertEquals(0, result.getEstatisticas().getTotalAnalisados());
        assertEquals(0, result.getEstatisticas().getTempoTotalAlocadoMinutos());
        assertTrue(result.getEstrategiaGlobal().contains("fila canônica de revisões FSRS"));
        verifyNoInteractions(cognitiveService);
    }

    @Test
    void failureContextIsRecordedWithoutClaimingItsCauseOrChangingModelState() {
        ReviewFailureRequestDTO[] contexts = new ReviewFailureRequestDTO[4];

        contexts[0] = request(22.0, 3, false, false, "não vi");
        contexts[1] = request(1.0, 2, false, false, "confundi");
        contexts[2] = request(6.0, 5, true, false, "prazo");
        contexts[3] = request(3.0, 4, false, true, "interpretei");

        for (ReviewFailureRequestDTO context : contexts) {
            ReviewFailureDiagnosisDTO result = engine.handleReviewFailure(context);

            assertEquals("INVESTIGATION_CANDIDATE", result.getTipoFalha());
            assertEquals("CAUSE_UNRESOLVED", result.getStatus());
            assertFalse(result.isCauseResolved());
            assertFalse(result.isCanApply());
            assertNull(result.getDominioAnteriorPct());
            assertNull(result.getNovoDominioAjustadoPct());
            assertNull(result.getNovaEstabilidadeDias());
            assertEquals("NOT_ASSESSED", result.getStatusPrerequisitos());
            assertEquals("DIAGNOSTIC_FOLLOW_UP_CANDIDATE", result.getIntervencaoPrescrita());
            assertEquals("PERSISTED", result.getPersistenceStatus());
            assertFalse(result.isDominioZerado());
        }

        verify(eventStoreRepository, times(contexts.length)).appendEvent(
                eq("REVISION_FAILURE_INVESTIGATION_REQUESTED"),
                eq("REVISION"),
                anyString(),
                anyString(),
                eq(1),
                eq("investigation-candidate-v1"),
                anyString()
        );
    }

    @Test
    void missingContextStaysMissingInsteadOfBecomingAZeroOrDefaultEstimate() {
        ReviewFailureRequestDTO request = request(null, null, null, null, null);
        request.setDominioAnteriorPct(null);

        ReviewFailureDiagnosisDTO result = engine.handleReviewFailure(request);

        assertNull(result.getDominioAnteriorPct());
        assertNull(result.getNovoDominioAjustadoPct());
        assertNull(result.getNovaEstabilidadeDias());
        assertEquals("CAUSE_UNRESOLVED", result.getStatus());
        assertFalse(result.isCanApply());
        assertEquals("PERSISTED", result.getPersistenceStatus());
    }

    @Test
    void persistenceFailureIsExplicitAndDoesNotClaimTheCandidateWasRecorded() {
        doThrow(new IllegalStateException("store unavailable"))
                .when(eventStoreRepository)
                .appendEvent(anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), anyString());

        ReviewFailureDiagnosisDTO result = engine.handleReviewFailure(request(2.0, 4, false, false, null));

        assertEquals("CAUSE_UNRESOLVED", result.getStatus());
        assertEquals("FAILED", result.getPersistenceStatus());
        assertFalse(result.isCanApply());
        assertTrue(result.getExplicacaoPedagogica().contains("não foi persistido"));
        assertNull(result.getNovoDominioAjustadoPct());
        assertNull(result.getNovaEstabilidadeDias());
    }

    private ReviewFailureRequestDTO request(Double days, Integer confidence, Boolean isNew,
                                             Boolean usedHelp, String reportedCause) {
        ReviewFailureRequestDTO request = new ReviewFailureRequestDTO();
        request.setQuestionId("question-1");
        request.setSessionId("session-1");
        request.setDisciplina("Direito Tributário");
        request.setTopico("Decadência");
        request.setDiasDesdeUltimaTentativa(days);
        request.setDominioAnteriorPct(80.0);
        request.setConfidenceLevel(confidence);
        request.setIsQuestionInedita(isNew);
        request.setUsedHelp(usedHelp);
        request.setCausaErro(reportedCause);
        return request;
    }
}
