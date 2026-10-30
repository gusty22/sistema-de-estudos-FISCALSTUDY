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
                null, null, "REGULAR");
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin, String causaErro, Boolean naCordaBamba, Boolean pensouContrario,
                                                                      Long tempoLeituraMs, Long tempoHesitacaoMs, Integer trocasOpcaoCount, Double distanciaCursorPx, Double friccaoCognitivaScore, Boolean chuteEducadoDetectado, String fluenciaNeurologica,
                                                                      Boolean usedHelp, String helpType, String interventionType) {
        return submitAttempt(questionId,selectedOption,confidenceLevel,activeTimeMs,sessionId,origin,causaErro,naCordaBamba,pensouContrario,tempoLeituraMs,tempoHesitacaoMs,trocasOpcaoCount,distanciaCursorPx,friccaoCognitivaScore,chuteEducadoDetectado,fluenciaNeurologica,usedHelp,helpType,interventionType,null);
    }

    public com.fiscalstudy.backend.domain.AttemptResult submitAttempt(String questionId, String selectedOption, int confidenceLevel, long activeTimeMs, String sessionId, String origin, String causaErro, Boolean naCordaBamba, Boolean pensouContrario,
            Long tempoLeituraMs, Long tempoHesitacaoMs, Integer trocasOpcaoCount, Double distanciaCursorPx, Double friccaoCognitivaScore, Boolean chuteEducadoDetectado, String fluenciaNeurologica,
            Boolean usedHelp, String helpType, String interventionType, String requestedAttemptId) {
        String attemptId = requireUuid(requestedAttemptId == null || requestedAttemptId.isBlank() ? java.util.UUID.randomUUID().toString() : requestedAttemptId);
        if(confidenceLevel<1 || confidenceLevel>5 || activeTimeMs<0) throw new IllegalArgumentException("Invalid confidence or duration");
        String determinedOrigin = resolveOrigin(origin, sessionId).name();

        String causaErroStr = (causaErro != null && !causaErro.isBlank()) ? causaErro.trim() : null;
        boolean cordaBambaVal = Boolean.TRUE.equals(naCordaBamba);
        boolean pensouContrarioVal = Boolean.TRUE.equals(pensouContrario);

        long leituraVal = tempoLeituraMs != null ? tempoLeituraMs : activeTimeMs;
        long hesitacaoVal = tempoHesitacaoMs != null ? tempoHesitacaoMs : 0L;
        int trocasVal = trocasOpcaoCount != null ? trocasOpcaoCount : 0;
        double distanciaVal = distanciaCursorPx != null ? distanciaCursorPx : 0.0;
        double friccaoVal = friccaoCognitivaScore != null ? friccaoCognitivaScore : 0.0;
        boolean chuteVal = Boolean.TRUE.equals(chuteEducadoDetectado);
        String fluenciaVal = (fluenciaNeurologica != null && !fluenciaNeurologica.isBlank()) ? fluenciaNeurologica : (friccaoVal > 0.6 ? "CHUTE_EDUCADO_PROVAVEL" : (friccaoVal > 0.3 ? "FRICCAO_MODERADA" : "ALTA_FLUENCIA"));

        boolean usedHelpVal = Boolean.TRUE.equals(usedHelp);
        String helpTypeVal = (helpType != null && !helpType.isBlank()) ? helpType.trim() : (usedHelpVal ? "MATERIAL_APOIO" : "NENHUM");
        String interventionVal = (interventionType != null && !interventionType.isBlank()) ? interventionType.trim() : "REGULAR";

        java.util.Map<String,Object> responseData=new java.util.LinkedHashMap<>();
        responseData.put("selectedOption",selectedOption==null?"":selectedOption.trim().toUpperCase(java.util.Locale.ROOT));
        responseData.put("confidenceLevel",confidenceLevel); responseData.put("activeTimeMs",activeTimeMs);
        responseData.put("origin",determinedOrigin); responseData.put("causaErro",causaErroStr);
        responseData.put("naCordaBamba",cordaBambaVal); responseData.put("pensouContrario",pensouContrarioVal);
        responseData.put("tempoLeituraMs",leituraVal); responseData.put("tempoHesitacaoMs",hesitacaoVal);
        responseData.put("trocasOpcaoCount",trocasVal); responseData.put("distanciaCursorPx",distanciaVal);
        responseData.put("friccaoCognitivaScore",friccaoVal); responseData.put("chuteEducadoDetectado",chuteVal);
        responseData.put("helpDeclarationProvided",usedHelp!=null); responseData.put("usedHelp",usedHelpVal);
        responseData.put("helpType",helpTypeVal); responseData.put("interventionType",interventionVal);
        responseData.put("fluenciaNeurologica",fluenciaVal);
        var existing=eventStoreRepository.findByEventId("attempt:"+attemptId);
        if(existing.isPresent()) return replay(existing.get(),questionId,sessionId,responseData);

        // A forecast may only be linked if it was already committed in an earlier request.
        var prospectiveEvent=eventStoreRepository.findByEventId("prediction:"+attemptId);
        String prospectivePredictionId=null;
        if(prospectiveEvent.isPresent()) {
            var committed=prospectiveEvent.get();
            if(!"PREDICTION_COMMITTED".equals(committed.getEventType()) ||
               !questionId.equals(committed.getAggregateId()) || !java.util.Objects.equals(sessionId,committed.getSessionId()))
                throw new AttemptConflictException("Forecast identity conflict");
            try {
                var frozen=objectMapper.readTree(committed.getPayloadJson());
                if(!"prospective-question-v1".equals(frozen.path("contractVersion").asText()) ||
                   !attemptId.equals(frozen.path("attemptId").asText()) ||
                   frozen.path("predictionId").asText().isBlank())
                    throw new IllegalArgumentException("Invalid prospective prediction");
                prospectivePredictionId=requireUuid(frozen.path("predictionId").asText());
                if(java.time.Instant.parse(committed.getOccurredAt()).isAfter(java.time.Instant.now()))
                    throw new IllegalArgumentException("Invalid future prospective prediction");
            } catch(com.fasterxml.jackson.core.JsonProcessingException e) {
                throw new IllegalArgumentException("Invalid prospective prediction",e);
            }
        }

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

        java.util.Map<String,Object> prediction=learningEvidenceService==null ? java.util.Map.of("evidenceStatus","UNAVAILABLE") : learningEvidenceService.preview(questionId);
        java.time.Instant occurredAt=java.time.Instant.now();
        if(prospectiveEvent.isPresent() &&
           (!java.time.Instant.parse(prospectiveEvent.get().getOccurredAt()).isBefore(occurredAt) ||
            !java.time.Instant.parse(prospectiveEvent.get().getRecordedAt()).isBefore(occurredAt)))
            throw new AttemptConflictException("Forecast must strictly precede the answer");
        java.util.Map<String,Object> fields=new java.util.LinkedHashMap<>(responseData);
        fields.put("attemptId",attemptId); fields.put("questionId",questionId);
        fields.put("correctOption",question.getCorrectOption()); fields.put("isCorrect",isCorrect); fields.put("concursoPoint",concursoPoint);
        fields.put("gabaritoStatus",status.name());
        fields.put("exposicaoAnteriorCount",exposicaoAnteriorCount); fields.put("diasDesdeUltimaExposicao",diasDesdeUltimaExposicao);
        fields.put("resultadoAnterior",resultadoAnterior); fields.put("memoryPrediction",prediction);
        if(prospectivePredictionId!=null) fields.put("prospectivePredictionId",prospectivePredictionId);
        String payload=json(fields);
        if(!eventStoreRepository.appendEventOnce("attempt:"+attemptId,"ANSWER_SUBMITTED","QUESTION",questionId,sessionId,occurredAt.toString(),payload)) {
            return replay(eventStoreRepository.findByEventId("attempt:"+attemptId).orElseThrow(),questionId,sessionId,responseData);
        }
        boolean eligible="REAL_STUDY".equals(determinedOrigin) && isCorrect!=null && !usedHelpVal;
        if(learningEvidenceService!=null) project(attemptId,questionId,occurredAt,isCorrect,determinedOrigin,confidenceLevel,usedHelpVal,prediction);

        // Trava 2: Gatilho por Erro Real ou Baixa Confiança/Dúvida (Nível <= 3)
        boolean shouldTriggerAnki = Boolean.FALSE.equals(isCorrect) || confidenceLevel <= 3 || chuteVal;
        if (eligible && shouldTriggerAnki && ankiIntegrationService != null) {
            try {
                ankiIntegrationService.generateFromQuestionError(question, optionLetter, causaErroStr, sessionId);
            } catch (Exception ignored) {}
        }

        // Agendamento no Motor de Revisão Adaptativa Individualizada (Baseado em Nível de Retenção e Confiança)
        if (eligible && learningEvidenceService == null && revisionCalendarService != null) {
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

        if (eligible && Boolean.FALSE.equals(isCorrect) && mediaRoutingService != null) {
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
        result.setAttemptId(attemptId);
        return result;
    }

    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private LearningEvidenceService learningEvidenceService;

    private void project(String id,String questionId,java.time.Instant occurredAt,Boolean correct,String origin,int confidence,boolean usedHelp,java.util.Map<String,Object> prediction) {
        try { learningEvidenceService.projectAttempt(id,questionId,occurredAt,correct,origin,confidence,usedHelp,prediction); }
        catch(RuntimeException e){throw new LearningProjectionPendingException(id,e);}
    }
    public static class LearningProjectionPendingException extends IllegalStateException {
        private final String attemptId;
        public LearningProjectionPendingException(String id,Throwable cause){super("Attempt persisted; learning projection pending. Retry the same attempt ID.",cause);attemptId=id;}
        public String getAttemptId(){return attemptId;}
    }
    private boolean sameJson(String first,String second) {
        try { return objectMapper.readTree(first).equals(objectMapper.readTree(second)); }
        catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid persisted annotation",e);}
    }
    private String requireUuid(String value) {
        try { return java.util.UUID.fromString(value).toString(); }
        catch(Exception e){ throw new IllegalArgumentException("Invalid attempt or annotation ID"); }
    }
    private String json(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch(com.fasterxml.jackson.core.JsonProcessingException e){ throw new IllegalArgumentException("Invalid event payload",e); }
    }
    private com.fiscalstudy.backend.domain.AttemptResult replay(com.fiscalstudy.backend.domain.EventRecord event,String questionId,String sessionId,java.util.Map<String,Object> responseData) {
        try {
            var n=objectMapper.readTree(event.getPayloadJson());
            if(!"ANSWER_SUBMITTED".equals(event.getEventType()) || !"QUESTION".equals(event.getAggregateType()) ||
               !java.util.Objects.equals(event.getAggregateId(),questionId) || !java.util.Objects.equals(event.getSessionId(),sessionId))
                throw new AttemptConflictException("Attempt ID already belongs to a different submission");
            // Compare only submitted evidence, never recompute answer keys, forecasts or exposure history.
            // Round-trip JSON so small integer durations compare identically to persisted JSON numbers.
            var requested=objectMapper.readTree(json(responseData));
            for(var entry:responseData.entrySet()) {
                var stored=n.get(entry.getKey());
                if(stored==null && "helpDeclarationProvided".equals(entry.getKey()))
                    stored=com.fasterxml.jackson.databind.node.BooleanNode.FALSE; // legacy absence remains unknown
                if(!java.util.Objects.equals(stored,requested.get(entry.getKey())))
                    throw new AttemptConflictException("Attempt ID already belongs to different response data");
            }
            Boolean correct=n.hasNonNull("isCorrect")?n.get("isCorrect").asBoolean():null;
            if(learningEvidenceService!=null) {
                java.util.Map<String,Object> prediction=objectMapper.convertValue(n.path("memoryPrediction"),new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String,Object>>(){});
                project(n.path("attemptId").asText(),questionId,java.time.Instant.parse(event.getOccurredAt()),correct,n.path("origin").asText(),n.path("confidenceLevel").asInt(),n.path("usedHelp").asBoolean(),prediction);
            }
            var result=new com.fiscalstudy.backend.domain.AttemptResult(correct,com.fiscalstudy.backend.domain.GabaritoStatus.valueOf(n.path("gabaritoStatus").asText()),n.path("concursoPoint").asInt());
            result.setCorrectOption(n.path("correctOption").asText(null)); result.setAttemptId(n.path("attemptId").asText()); return result;
        } catch(com.fasterxml.jackson.core.JsonProcessingException e){ throw new IllegalStateException("Persisted attempt payload is invalid",e); }
    }
    public java.util.Map<String,Object> getAttemptHistory(String questionId,String attemptId) {
        attemptId=requireUuid(attemptId);
        var event=eventStoreRepository.findByEventId("attempt:"+attemptId).orElseThrow(()->new IllegalArgumentException("Attempt not found"));
        if(!questionId.equals(event.getAggregateId()))throw new AttemptConflictException("Attempt ownership does not match");
        try {
            var answer=objectMapper.readTree(event.getPayloadJson());
            String target=attemptId;
            var annotations=eventStoreRepository.getEventPayloads(event.getSessionId(),"ATTEMPT_ANNOTATED").stream().map(p->{try{return objectMapper.readTree(p);}catch(Exception e){throw new IllegalStateException("Invalid persisted annotation",e);}}).filter(n->target.equals(n.path("attemptId").asText())).toList();
            return java.util.Map.of("answer",answer,"annotations",annotations,"origin",answer.path("origin").asText("UNVERIFIED_HISTORICAL"));
        } catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid persisted attempt",e);}
    }
    public java.util.Map<String,Object> annotateAttempt(String questionId,String attemptId,String annotationId,String sessionId,String causaErro) {
        attemptId=requireUuid(attemptId); annotationId=requireUuid(annotationId);
        if(causaErro==null || causaErro.isBlank() || causaErro.length()>2000) throw new IllegalArgumentException("Invalid error annotation");
        var attempt=eventStoreRepository.findByEventId("attempt:"+attemptId).orElseThrow(()->new IllegalArgumentException("Attempt not found"));
        if(!questionId.equals(attempt.getAggregateId()) || !java.util.Objects.equals(sessionId,attempt.getSessionId())) throw new AttemptConflictException("Attempt ownership does not match");
        var data=java.util.Map.of("attemptId",attemptId,"annotationId",annotationId,"questionId",questionId,"causaErro",causaErro.trim(),"source","SELF_REPORTED");
        String payload=json(data);
        if(!eventStoreRepository.appendEventOnce("annotation:"+annotationId,"ATTEMPT_ANNOTATED","QUESTION",questionId,sessionId,java.time.Instant.now().toString(),payload)) {
            var old=eventStoreRepository.findByEventId("annotation:"+annotationId).orElseThrow();
            if(!sameJson(old.getPayloadJson(),payload) || !java.util.Objects.equals(old.getSessionId(),sessionId)) throw new AttemptConflictException("Annotation ID already exists with different content");
        }
        return java.util.Map.of("attemptId",attemptId,"annotationId",annotationId,"status","RECORDED");
    }
    public static class AttemptConflictException extends IllegalArgumentException { public AttemptConflictException(String message){super(message);} }

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
