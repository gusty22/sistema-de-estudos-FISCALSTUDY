package com.fiscalstudy.backend.application.review;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AdaptiveReviewDecisionEngine {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveReviewDecisionEngine.class);

    private final EventStoreRepository eventStoreRepository;

    public AdaptiveReviewDecisionEngine(EventStoreRepository eventStoreRepository) {
        this.eventStoreRepository = eventStoreRepository;
    }

    /**
     * The prior topic-level BKT/exponential outputs are not empirically validated.
     * Keep this endpoint fail-closed until a validated decision contract is available.
     * FSRS-backed due reviews continue through the canonical review calendar.
     */
    public AdaptiveRevisionDecisionDTO evaluateDecisions(String concursoId, int tempoDisponivelMinutos) {
        int availableMinutes = tempoDisponivelMinutos > 0 ? tempoDisponivelMinutos : 60;
        AdaptiveRevisionDecisionDTO result = new AdaptiveRevisionDecisionDTO();
        result.setConcursoId(concursoId != null ? concursoId : "Concurso Fiscal");
        result.setTempoDisponivelMinutos(availableMinutes);
        result.setStatus("BLOCKED_UNVALIDATED_MODEL");
        result.setCanApply(false);
        result.setEstrategiaGlobal(
                "Sem decisões cognitivas: o modelo por tópico ainda não foi validado. " +
                "Consulte a fila canônica de revisões FSRS e o planejamento do edital."
        );
        result.setDecisoes(java.util.Collections.emptyList());
        result.setEstatisticas(new AdaptiveRevisionDecisionDTO.DecisionStatistics());
        return result;
    }

    /**
     * Records a discrepancy and returns an investigation candidate.
     * Elapsed time, confidence, novelty and help do not identify a cause or justify
     * changing conceptual mastery, FSRS stability or a review date.
     */
    public ReviewFailureDiagnosisDTO handleReviewFailure(ReviewFailureRequestDTO request) {
        ReviewFailureDiagnosisDTO response = new ReviewFailureDiagnosisDTO();
        response.setTipoFalha("INVESTIGATION_CANDIDATE");
        response.setStatus("CAUSE_UNRESOLVED");
        response.setCauseResolved(false);
        response.setCanApply(false);
        response.setDiagnosticoCientifico(
                "A causa do erro não foi determinada. Intervalo, confiança e uso de ajuda são contexto relatado, não um diagnóstico."
        );
        response.setDominioAnteriorPct(null);
        response.setNovoDominioAjustadoPct(null);
        response.setNovaEstabilidadeDias(null);
        response.setStatusPrerequisitos("NOT_ASSESSED");
        response.setIntervencaoPrescrita("DIAGNOSTIC_FOLLOW_UP_CANDIDATE");
        response.setExplicacaoPedagogica(
                "Investigue a resposta, a questão e sua classificação; compare com a previsão FSRS pré-atualização, se elegível. " +
                "Nenhum agendamento ou estado de conhecimento é alterado por esta resposta."
        );

        try {
            Map<String, Object> evidence = new LinkedHashMap<>();
            evidence.put("questionId", request.getQuestionId());
            evidence.put("disciplineReported", request.getDisciplina());
            evidence.put("topicReported", request.getTopico());
            evidence.put("daysSincePriorAttemptReported", request.getDiasDesdeUltimaTentativa());
            evidence.put("priorKnowledgeValueReported", request.getDominioAnteriorPct());
            evidence.put("confidenceReported", request.getConfidenceLevel());
            evidence.put("questionMarkedNew", request.getIsQuestionInedita());
            evidence.put("helpReported", request.getUsedHelp());
            evidence.put("errorCauseReportedByStudent", request.getCausaErro());
            evidence.put("evidenceStatus", "USER_REPORTED_CONTEXT_ONLY");
            evidence.put("causeResolved", false);
            String payload = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(evidence);
            eventStoreRepository.appendEvent(
                    "REVISION_FAILURE_INVESTIGATION_REQUESTED",
                    "REVISION",
                    request.getQuestionId() != null ? request.getQuestionId() : UUID.randomUUID().toString(),
                    request.getSessionId() != null ? request.getSessionId() : "system",
                    1,
                    "investigation-candidate-v1",
                    payload
            );
            response.setPersistenceStatus("PERSISTED");
        } catch (Exception e) {
            log.warn("Falha ao registrar candidato de investigação de erro: {}", e.getMessage());
            response.setPersistenceStatus("FAILED");
            response.setExplicacaoPedagogica(
                    "A causa continua não determinada e o candidato de investigação não foi persistido. " +
                    "Nenhum agendamento ou estado de conhecimento foi alterado."
            );
        }

        return response;
    }
}
