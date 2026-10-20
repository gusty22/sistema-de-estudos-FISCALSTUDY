package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import com.fiscalstudy.backend.domain.EventOrigin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
public class AttemptSubmissionService {

    private static final Logger log = LoggerFactory.getLogger(AttemptSubmissionService.class);

    private final QuestionRepository questionRepository;
    private final EventStoreRepository eventStoreRepository;
    private final EventOrigin instanceOrigin;
    private final AnkiIntegrationService ankiIntegrationService;
    private final MediaRoutingService mediaRoutingService;
    private final RevisionCalendarService revisionCalendarService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public AttemptSubmissionService(QuestionRepository questionRepository,
                                    EventStoreRepository eventStoreRepository,
                                    @Value("${fiscalstudy.event-origin:UNVERIFIED_HISTORICAL}") String configuredOrigin) {
        this(questionRepository, eventStoreRepository, configuredOrigin, null, null, null);
    }

    public AttemptSubmissionService(QuestionRepository questionRepository,
                                    EventStoreRepository eventStoreRepository,
                                    @Value("${fiscalstudy.event-origin:UNVERIFIED_HISTORICAL}") String configuredOrigin,
                                    AnkiIntegrationService ankiIntegrationService) {
        this(questionRepository, eventStoreRepository, configuredOrigin, ankiIntegrationService, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AttemptSubmissionService(QuestionRepository questionRepository,
                                    EventStoreRepository eventStoreRepository,
                                    @Value("${fiscalstudy.event-origin:UNVERIFIED_HISTORICAL}") String configuredOrigin,
                                    @org.springframework.beans.factory.annotation.Autowired(required = false) AnkiIntegrationService ankiIntegrationService,
                                    @org.springframework.beans.factory.annotation.Autowired(required = false) MediaRoutingService mediaRoutingService,
                                    @org.springframework.beans.factory.annotation.Autowired(required = false) RevisionCalendarService revisionCalendarService) {
        this.questionRepository = questionRepository;
        this.eventStoreRepository = eventStoreRepository;
        this.instanceOrigin = EventOrigin.fromString(configuredOrigin);
        this.ankiIntegrationService = ankiIntegrationService;
        this.mediaRoutingService = mediaRoutingService;
        this.revisionCalendarService = revisionCalendarService;
    }

    public EventOrigin getInstanceOrigin() {
        return instanceOrigin;
    }

    /**
     * Resolução de proveniência com salvaguarda local-first:
     * 1. Sessões com prefixo de teste/mock/e2e são estritamente forçadas a AUTOMATED_TEST.
     * 2. Sessões com prefixo demo/sample são forçadas a DEMONSTRATION.
     * 3. O cliente só pode solicitar downgrade (DEMONSTRATION ou AUTOMATED_TEST).
     * 4. Uma declaração arbitrária de REAL_STUDY vinda do cliente é ignorada, prevalecendo a configuração da instância.
     */
    public EventOrigin resolveOrigin(String clientHint, String sessionId) {
        String lowerSession = (sessionId != null) ? sessionId.toLowerCase().trim() : "";
        if (lowerSession.startsWith("test-") || lowerSession.startsWith("mock-") || lowerSession.startsWith("e2e-")) {
            return EventOrigin.AUTOMATED_TEST;
        }
        if (lowerSession.startsWith("demo-") || lowerSession.startsWith("sample-")) {
            return EventOrigin.DEMONSTRATION;
        }
        EventOrigin hint = (clientHint == null || clientHint.isBlank()) ? null : EventOrigin.fromString(clientHint);
        if (hint == EventOrigin.DEMONSTRATION || hint == EventOrigin.AUTOMATED_TEST) {
            return hint;
        }
        return instanceOrigin;
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId) {
        return submitAttempt(questionId, selectedOption, confidenceLevel, activeTimeMs, sessionId, null, null);
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin) {
        return submitAttempt(questionId, selectedOption, confidenceLevel, activeTimeMs, sessionId, origin, null);
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin, String causaErro) {
        return submitAttempt(questionId, selectedOption, confidenceLevel, activeTimeMs, sessionId, origin, causaErro, false, false);
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin, String causaErro, Boolean naCordaBamba, Boolean pensouContrario) {
        return submitAttempt(questionId, selectedOption, confidenceLevel, activeTimeMs, sessionId, origin, causaErro, naCordaBamba, pensouContrario, null, null, null, null, null, null, null);
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin, String causaErro, Boolean naCordaBamba, Boolean pensouContrario,
                                                                       Long tempoLeituraMs, Long tempoHesitacaoMs, Integer trocasOpcaoCount, Double distanciaCursorPx, Double friccaoCognitivaScore, Boolean chuteEducadoDetectado, String fluenciaNeurologica) {
        return submitAttempt(questionId, selectedOption, confidenceLevel, activeTimeMs, sessionId, origin, causaErro, naCordaBamba, pensouContrario,
                tempoLeituraMs, tempoHesitacaoMs, trocasOpcaoCount, distanciaCursorPx, friccaoCognitivaScore, chuteEducadoDetectado, fluenciaNeurologica,
                false, "NENHUM", "REGULAR");
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin, String causaErro, Boolean naCordaBamba, Boolean pensouContrario,
                                                                      Long tempoLeituraMs, Long tempoHesitacaoMs, Integer trocasOpcaoCount, Double distanciaCursorPx, Double friccaoCognitivaScore, Boolean chuteEducadoDetectado, String fluenciaNeurologica,
                                                                      Boolean usedHelp, String helpType, String interventionType) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("Session ID is required");
        }

        if (eventStoreRepository.isSessionEnded(sessionId)) {
            // Tolerância cognitiva: se a sessão recebeu sinal de encerramento concorrente ou em lote,
            // não descartamos os dados nem bloqueamos a gravação da telemetria (milissegundos e confiança),
            // pois o motor em R (Robin Hood / esquecimento) precisa obrigatoriamente desses dados.
            log.warn("Tentativa recebida para sessionId [{}] que já possuía sinal de encerramento. Gravando telemetria normalmente.", sessionId);
        }

        Optional<Question> questionOpt = questionRepository.findById(questionId);
        
        if (questionOpt.isEmpty()) {
            throw new IllegalArgumentException("Question not found");
        }

        Question question = questionOpt.get();
        
        if (selectedOption == null || selectedOption.trim().isEmpty()) {
            throw new IllegalArgumentException("Invalid selected option");
        }
        
        String optionLetter = selectedOption.trim().toUpperCase();
        boolean isCE = isCertoErrado(question);
        String normalizedUser = normalizeOption(optionLetter, isCE);

        boolean isValidOption = false;
        if (isCE) {
            isValidOption = "C".equals(normalizedUser) || "E".equals(normalizedUser);
        } else if (question.getOptions() != null) {
            for (String opt : question.getOptions()) {
                if (opt != null && opt.trim().toUpperCase().startsWith(optionLetter)) {
                    isValidOption = true;
                    break;
                }
            }
        }

        if (!isValidOption) {
            throw new IllegalArgumentException("Invalid selected option: " + selectedOption);
        }

        com.fiscalstudy.backend.domain.GabaritoStatus status = question.getGabaritoStatus();
        if (status == null) {
            String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : null;
            if ("ANULADA".equalsIgnoreCase(correctOpt)) {
                status = com.fiscalstudy.backend.domain.GabaritoStatus.ANULADA;
            } else if (correctOpt == null || correctOpt.isBlank()) {
                status = com.fiscalstudy.backend.domain.GabaritoStatus.AUSENTE;
            } else {
                status = com.fiscalstudy.backend.domain.GabaritoStatus.DEFINITIVO;
            }
        }

        // Idempotência: se já respondeu esta questão nesta mesma sessão, não duplica evento
        if (eventStoreRepository.hasEvent("ANSWER_SUBMITTED", questionId, sessionId)) {
            return calculateAttemptResult(question, optionLetter, status);
        }

        Boolean isCorrect;
        int concursoPoint;
        if (status == com.fiscalstudy.backend.domain.GabaritoStatus.ANULADA) {
            isCorrect = null; // Excluído de acurácia/domínio pedagógico
            concursoPoint = 1; // Ponto atribuído conforme regras do concurso
        } else if (status == com.fiscalstudy.backend.domain.GabaritoStatus.AUSENTE || status == com.fiscalstudy.backend.domain.GabaritoStatus.SOB_REVISAO) {
            isCorrect = null; // Sem gabarito verificado: sem acerto/erro atribuído
            concursoPoint = 0;
        } else {
            String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : "";
            String normalizedCorrect = normalizeOption(correctOpt, isCE);
            boolean matched = normalizedUser.equalsIgnoreCase(normalizedCorrect);
            isCorrect = matched;
            concursoPoint = matched ? 1 : 0;
        }

        String determinedOrigin = resolveOrigin(origin, sessionId).name();

        String causaErroStr = (causaErro != null && !causaErro.isBlank()) ? causaErro.trim() : null;
        String isCorrectStr = (isCorrect == null) ? "null" : String.valueOf(isCorrect);
        boolean cordaBambaVal = Boolean.TRUE.equals(naCordaBamba);
        boolean pensouContrarioVal = Boolean.TRUE.equals(pensouContrario);

        long leituraVal = tempoLeituraMs != null ? tempoLeituraMs : activeTimeMs;
        long hesitacaoVal = tempoHesitacaoMs != null ? tempoHesitacaoMs : 0L;
        int trocasVal = trocasOpcaoCount != null ? trocasOpcaoCount : 0;
        double distanciaVal = distanciaCursorPx != null ? distanciaCursorPx : 0.0;
        double friccaoVal = friccaoCognitivaScore != null ? friccaoCognitivaScore : 0.0;
        boolean chuteVal = Boolean.TRUE.equals(chuteEducadoDetectado);
        String fluenciaVal = (fluenciaNeurologica != null && !fluenciaNeurologica.isBlank()) ? fluenciaNeurologica : (friccaoVal > 0.6 ? "CHUTE_EDUCADO_PROVAVEL" : (friccaoVal > 0.3 ? "FRICCAO_MODERADA" : "ALTA_FLUENCIA"));

        // Instrumentação Etapa 1: Exposição anterior à questão e rastreabilidade longitudinal
        int exposicaoAnteriorCount = eventStoreRepository.countPreviousAttempts(questionId);
        Double diasDesdeUltimaExposicao = null;
        Boolean resultadoAnterior = null;

        if (exposicaoAnteriorCount > 0) {
            java.util.Optional<com.fiscalstudy.backend.domain.EventRecord> latestOpt = eventStoreRepository.findLatestAttempt(questionId);
            if (latestOpt.isPresent()) {
                com.fiscalstudy.backend.domain.EventRecord latest = latestOpt.get();
                try {
                    java.time.Instant lastOccurred = java.time.Instant.parse(latest.getOccurredAt());
                    long secondsDiff = java.time.Duration.between(lastOccurred, java.time.Instant.now()).getSeconds();
                    diasDesdeUltimaExposicao = Math.max(0.0, Math.round((secondsDiff / 86400.0) * 100.0) / 100.0);

                    com.fasterxml.jackson.databind.JsonNode prevNode = objectMapper.readTree(latest.getPayloadJson());
                    if (prevNode.hasNonNull("isCorrect")) {
                        resultadoAnterior = prevNode.get("isCorrect").asBoolean();
                    }
                } catch (Exception ignored) {}
            }
        }

        boolean usedHelpVal = Boolean.TRUE.equals(usedHelp);
        String helpTypeVal = (helpType != null && !helpType.isBlank()) ? helpType.trim() : (usedHelpVal ? "MATERIAL_APOIO" : "NENHUM");
        String interventionVal = (interventionType != null && !interventionType.isBlank()) ? interventionType.trim() : "REGULAR";

        String payload = String.format(java.util.Locale.US,
            "{\"questionId\": \"%s\", \"selectedOption\": \"%s\", \"isCorrect\": %s, \"concursoPoint\": %d, \"gabaritoStatus\": \"%s\", \"confidenceLevel\": %d, \"activeTimeMs\": %d, \"origin\": \"%s\", \"causaErro\": %s, \"naCordaBamba\": %b, \"pensouContrario\": %b, \"tempoLeituraMs\": %d, \"tempoHesitacaoMs\": %d, \"trocasOpcaoCount\": %d, \"distanciaCursorPx\": %.2f, \"friccaoCognitivaScore\": %.3f, \"chuteEducadoDetectado\": %b, \"fluenciaNeurologica\": \"%s\", \"usedHelp\": %b, \"helpType\": \"%s\", \"exposicaoAnteriorCount\": %d, \"diasDesdeUltimaExposicao\": %s, \"resultadoAnterior\": %s, \"interventionType\": \"%s\"}",
            questionId, optionLetter, isCorrectStr, concursoPoint, status.name(), confidenceLevel, activeTimeMs, determinedOrigin,
            causaErroStr != null ? "\"" + causaErroStr.replace("\"", "\\\"") + "\"" : "null",
            cordaBambaVal, pensouContrarioVal,
            leituraVal, hesitacaoVal, trocasVal, distanciaVal, friccaoVal, chuteVal, fluenciaVal,
            usedHelpVal, helpTypeVal,
            exposicaoAnteriorCount,
            diasDesdeUltimaExposicao != null ? String.valueOf(diasDesdeUltimaExposicao) : "null",
            resultadoAnterior != null ? String.valueOf(resultadoAnterior) : "null",
            interventionVal
        );

        eventStoreRepository.appendEvent(
                "ANSWER_SUBMITTED",
                "QUESTION",
                questionId,
                sessionId,
                1,
                "v1",
                payload
        );

        // Automação Extrema: Integração Silenciosa com Anki quando o estudante erra a questão
        if (Boolean.FALSE.equals(isCorrect) && ankiIntegrationService != null) {
            try {
                ankiIntegrationService.generateFromQuestionError(question, optionLetter, causaErroStr, sessionId);
            } catch (Exception ignored) {}
        }

        // Agendamento no Motor de Revisão Adaptativa Individualizada (Baseado em Nível de Retenção e Confiança)
        if (revisionCalendarService != null) {
            try {
                String origem = Boolean.FALSE.equals(isCorrect) ? "ERRO_QUESTAO" : (chuteVal ? "CHUTE_EDUCADO" : "PRATICA_RESOLUCAO");
                revisionCalendarService.scheduleAdaptiveRevision(
                        sessionId, null, question.getDiscipline(), question.getTopic(), origem, question.getId(),
                        isCorrect, confidenceLevel, causaErroStr, chuteVal, fluenciaVal, friccaoVal
                );
            } catch (Exception ignored) {}
        }

        // Roteamento Inteligente de Mídia & Detecção de Bloqueio Cognitivo (3 erros seguidos)
        boolean bloqueioCognitivo = false;
        int errosConsecutivos = 0;
        String prescricaoTexto = null;
        String veiculo = null;

        if (Boolean.FALSE.equals(isCorrect) && mediaRoutingService != null) {
            try {
                var prescription = mediaRoutingService.evaluateRouting(null, question.getDiscipline(), question.getTopic(), sessionId);
                if (prescription != null) {
                    bloqueioCognitivo = prescription.isBloqueioCognitivo();
                    errosConsecutivos = prescription.getErrosConsecutivos();
                    prescricaoTexto = prescription.getPrescricaoTexto();
                    veiculo = prescription.getVeiculo();
                }
            } catch (Exception ignored) {}
        }

        com.fiscalstudy.backend.domain.AttemptResult result = new com.fiscalstudy.backend.domain.AttemptResult(
                isCorrect, status, concursoPoint,
                bloqueioCognitivo, errosConsecutivos, prescricaoTexto, veiculo
        );
        result.setCorrectOption(question.getCorrectOption());
        return result;
    }

    private boolean isCertoErrado(Question question) {
        if (question == null || question.getOptions() == null) return false;
        if (question.getOptions().size() == 2) {
            boolean hasCertoErrado = question.getOptions().stream().anyMatch(o -> o != null &&
                    (o.toUpperCase().contains("CERTO") || o.toUpperCase().contains("ERRADO")));
            if (hasCertoErrado) return true;
            if (question.getBoard() != null &&
                    (question.getBoard().toUpperCase().contains("CESPE") || question.getBoard().toUpperCase().contains("CEBRASPE"))) {
                return true;
            }
            if (question.getCorrectOption() != null &&
                    ("C".equalsIgnoreCase(question.getCorrectOption().trim()) || "E".equalsIgnoreCase(question.getCorrectOption().trim()))) {
                return true;
            }
        }
        return false;
    }

    private String normalizeOption(String opt, boolean certoErrado) {
        if (opt == null) return "";
        String trimmed = opt.trim().toUpperCase();
        if (certoErrado) {
            if (trimmed.equals("C") || trimmed.equals("A") || trimmed.startsWith("CERT") || trimmed.equals("CORRETO")) {
                return "C";
            }
            if (trimmed.equals("E") || trimmed.equals("B") || trimmed.startsWith("ERR") || trimmed.equals("INCORRETO")) {
                return "E";
            }
        }
        return trimmed;
    }

    private com.fiscalstudy.backend.domain.AttemptResult calculateAttemptResult(Question question, String optionLetter, com.fiscalstudy.backend.domain.GabaritoStatus status) {
        if (status == com.fiscalstudy.backend.domain.GabaritoStatus.ANULADA) {
            return new com.fiscalstudy.backend.domain.AttemptResult(null, status, 1);
        }
        if (status == com.fiscalstudy.backend.domain.GabaritoStatus.AUSENTE || status == com.fiscalstudy.backend.domain.GabaritoStatus.SOB_REVISAO) {
            return new com.fiscalstudy.backend.domain.AttemptResult(null, status, 0);
        }
        boolean isCE = isCertoErrado(question);
        String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : "";
        String normalizedUser = normalizeOption(optionLetter, isCE);
        String normalizedCorrect = normalizeOption(correctOpt, isCE);
        boolean matched = normalizedUser.equalsIgnoreCase(normalizedCorrect);
        com.fiscalstudy.backend.domain.AttemptResult result = new com.fiscalstudy.backend.domain.AttemptResult(matched, status, matched ? 1 : 0);
        result.setCorrectOption(question.getCorrectOption());
        return result;
    }
}
