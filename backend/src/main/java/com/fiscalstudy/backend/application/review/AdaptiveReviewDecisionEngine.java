package com.fiscalstudy.backend.application.review;

import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveArchitectureService;
import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveStateDTO;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AdaptiveReviewDecisionEngine {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveReviewDecisionEngine.class);

    private final UnifiedCognitiveArchitectureService cognitiveService;
    private final EventStoreRepository eventStoreRepository;
    private final JdbcTemplate jdbcTemplate;

    public AdaptiveReviewDecisionEngine(UnifiedCognitiveArchitectureService cognitiveService,
                                        EventStoreRepository eventStoreRepository,
                                        JdbcTemplate jdbcTemplate) {
        this.cognitiveService = cognitiveService;
        this.eventStoreRepository = eventStoreRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Avalia e decide a próxima revisão combinando os 4 fatores essenciais:
     * 1. Estimativa de recuperabilidade do conhecimento (FSRS / R(t))
     * 2. Importância do conteúdo para o edital (Peso e incidência)
     * 3. Consequências de esquecer para os tópicos seguintes (DAG de pré-requisitos)
     * 4. Tempo disponível para estudar e revisar (Alocação com restrição)
     */
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
        result.setDecisoes(Collections.emptyList());
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
        } catch (Exception e) {
            log.warn("Falha ao registrar candidato de investigação de erro: {}", e.getMessage());
        }

        return response;
    }

    private int calculateDownstreamDependencies(String disciplina, String topico) {
        if (topico == null) return 0;
        String normalized = topico.toLowerCase();

        // 1. Consulta SQL no banco se existirem pré-requisitos canônicos cadastrados
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM canonical_concept_prerequisites ccp " +
                            "JOIN canonical_concepts cc ON ccp.prerequisite_concept_id = cc.id " +
                            "WHERE LOWER(cc.nome) LIKE ?",
                    Integer.class,
                    "%" + normalized + "%"
            );
            if (count != null && count > 0) {
                return count;
            }
        } catch (Exception ignored) {}

        // 2. Heurística Epistemológica para Matérias Fiscais
        // Português: Morfologia é pré-requisito essencial para Sintaxe, Concordância, Regência e Crase
        if (normalized.contains("morfologia") || normalized.contains("classes de palavras") || normalized.contains("estrutura das palavras")) {
            return 3;
        }
        if (normalized.contains("sintaxe") || normalized.contains("termos da oração")) {
            return 2;
        }
        // Tributário: Princípios e Competência são pré-requisitos para Fato Gerador, Lançamento, Suspensão e Extinção
        if (normalized.contains("conceito de tributo") || normalized.contains("princípios tributários") || normalized.contains("competência")) {
            return 4;
        }
        if (normalized.contains("obrigação tributária") || normalized.contains("fato gerador")) {
            return 3;
        }
        // Contabilidade: Contabilidade Básica/Método das Partidas Dobradas é pré-requisito para DFC, DVA, Balanço
        if (normalized.contains("partidas dobradas") || normalized.contains("atos e fatos") || normalized.contains("estrutura conceitual")) {
            return 4;
        }
        if (normalized.contains("estoques") || normalized.contains("ativo imobilizado")) {
            return 2;
        }

        return 0;
    }
}
