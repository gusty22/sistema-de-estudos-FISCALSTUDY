package com.fiscalstudy.backend.application.knowledge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventRecord;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.knowledge.CognitiveMetricsCalculator;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeProjection;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Agregador determinístico do Modelo Individual de Conhecimento (EPIC 02).
 * 
 * Reconstruível a partir dos eventos originais da tabela imutável event_store.
 * Preserva distinção entre observação e inferência, sem pesos arbitrários e sem misturar memória com domínio.
 */
@Service
public class TopicKnowledgeAggregatorService {

    private static final Logger log = LoggerFactory.getLogger(TopicKnowledgeAggregatorService.class);

    private final EventStoreRepository eventStoreRepository;
    private final TopicKnowledgeRepository topicKnowledgeRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final AtomicBoolean isRebuilding = new AtomicBoolean(false);

    public TopicKnowledgeAggregatorService(
            EventStoreRepository eventStoreRepository,
            TopicKnowledgeRepository topicKnowledgeRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.eventStoreRepository = eventStoreRepository;
        this.topicKnowledgeRepository = topicKnowledgeRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
    }

    public boolean isRebuilding() {
        return isRebuilding.get();
    }

    /**
     * DTO auxiliar para informações cadastrais de uma questão.
     */
    public record QuestionMetadata(
            String id,
            String discipline,
            String topic,
            String board,
            Integer year,
            String familyId
    ) {}

    /**
     * Reconstrução completa, idempotente e determinística de todos os tópicos a partir do event_store.
     */
    public RebuildResult rebuildAll() {
        if (!isRebuilding.compareAndSet(false, true)) {
            throw new IllegalStateException("Reconstrução já em andamento. Aguarde a conclusão da execução atual.");
        }
        try {
            log.info("Iniciando reconstrução determinística do Modelo Individual de Conhecimento...");

            // 1. Carregar mapeamento de todas as questões
            Map<String, QuestionMetadata> questionMap = loadQuestionMetadata();

            // 2. Carregar famílias de variantes identificadas confiavelmente
            Map<String, String> familyMap = loadQuestionFamilies();

            // 3. Carregar anotações mais recentes por tentativa (ATTEMPT_ANNOTATED)
            Map<String, String> latestAnnotations = loadLatestAnnotations();

            // 4. Carregar estimativas temporais de memória FSRS pura
            Map<String, MemoryState> memoryMap = loadMemoryStates();

            // 5. Carregar todos os tópicos canônicos do edital verticalizado
            Map<String, TopicInfo> canonicalTopics = loadCanonicalTopics();

            // 6. Carregar todos os eventos ANSWER_SUBMITTED legítimos
            List<EventRecord> answerEvents = eventStoreRepository.getAllEvents("ANSWER_SUBMITTED");

            // 7. Deduplicar eventos e agrupar por topicId/assunto
            Set<String> seenEventIds = new HashSet<>();
            Map<String, List<ParsedAttempt>> attemptsByTopic = new HashMap<>();

            for (EventRecord event : answerEvents) {
                if (event.getEventId() != null && !seenEventIds.add(event.getEventId())) {
                    log.debug("Ignorando evento duplicado no event_store: {}", event.getEventId());
                    continue;
                }
                ParsedAttempt attempt = parseAttempt(event, questionMap, familyMap, latestAnnotations);
                if (attempt == null || !attempt.isRealStudy()) {
                    continue; // Descarta testes sintéticos ou sem tópico
                }
                attemptsByTopic.computeIfAbsent(attempt.topicId(), k -> new ArrayList<>()).add(attempt);
            }

            // Ordenar tentativas de cada tópico cronologicamente
            for (List<ParsedAttempt> list : attemptsByTopic.values()) {
                list.sort(Comparator.comparing(
                        a -> a.occurredAt() != null ? a.occurredAt() : Instant.EPOCH
                ));
            }

            List<TopicKnowledgeProjection> allProjections = new ArrayList<>();
            int totalLegitimateAttempts = 0;
            Set<String> processedTopicKeys = new HashSet<>();

            // 8. Processar todos os tópicos canônicos (mesmo os com 0 tentativas -> SEM_EVIDENCIAS)
            for (Map.Entry<String, TopicInfo> entry : canonicalTopics.entrySet()) {
                String topicKey = entry.getKey();
                TopicInfo info = entry.getValue();
                processedTopicKeys.add(topicKey);

                List<ParsedAttempt> attempts = attemptsByTopic.getOrDefault(topicKey, Collections.emptyList());
                MemoryState memory = memoryMap.get(topicKey);

                TopicKnowledgeProjection projection = buildProjection(
                        topicKey,
                        info.discipline(),
                        info.topicName(),
                        attempts,
                        memory
                );

                allProjections.add(projection);
                totalLegitimateAttempts += attempts.size();
            }

            // 9. Processar tópicos que porventura existam em questões mas não estejam em edital_topicos
            for (Map.Entry<String, List<ParsedAttempt>> entry : attemptsByTopic.entrySet()) {
                String topicKey = entry.getKey();
                if (processedTopicKeys.contains(topicKey)) continue;

                List<ParsedAttempt> attempts = entry.getValue();
                String discipline = attempts.isEmpty() ? "GERAL" : attempts.get(0).discipline();
                MemoryState memory = memoryMap.get(topicKey);

                TopicKnowledgeProjection projection = buildProjection(
                        topicKey,
                        discipline,
                        topicKey,
                        attempts,
                        memory
                );

                allProjections.add(projection);
                totalLegitimateAttempts += attempts.size();
            }

            // 10. Atualização atômica transacional de todas as projeções
            topicKnowledgeRepository.replaceAll(allProjections);

            log.info("Reconstrução concluída com sucesso: {} tópicos processados, {} tentativas legítimas agregadas.",
                    allProjections.size(), totalLegitimateAttempts);

            return new RebuildResult(allProjections.size(), totalLegitimateAttempts, Instant.now());
        } finally {
            isRebuilding.set(false);
        }
    }

    /**
     * Constrói a projeção observável para um tópico específico.
     */
    public TopicKnowledgeProjection buildProjection(
            String topicId,
            String disciplineId,
            String topicName,
            List<ParsedAttempt> attempts,
            MemoryState memory
    ) {
        TopicKnowledgeProjection proj = new TopicKnowledgeProjection(topicId, disciplineId, topicName);

        if (attempts == null || attempts.isEmpty()) {
            proj.setEvidenceStatus("SEM_EVIDENCIAS");
            proj.setAccuracyDenominatorText("SEM_EVIDENCIAS");
            proj.setEpistemicLimitationsJson(toJson(CognitiveMetricsCalculator.buildEpistemicLimitations(
                    0, 0, 0, 0, 0, "SEM_EVIDENCIAS"
            )));
            proj.setPedagogicalHypothesesJson(toJson(CognitiveMetricsCalculator.buildPedagogicalHypotheses(
                    0, 0, 0, 0, 0, 0
            )));
            if (memory != null) {
                proj.setFsrsStabilityDays(memory.stability());
                proj.setFsrsRetrievalRate(memory.retrievalRate());
            }
            return proj;
        }

        int total = attempts.size();
        int correct = 0;
        int error = 0;
        long totalActiveMs = 0;
        Instant latestTime = null;

        Set<String> uniqueQuestions = new HashSet<>();
        int newQuestions = 0;
        int repeatedQuestions = 0;
        int variantQuestions = 0;

        List<Integer> confidenceLevels = new ArrayList<>();
        int[] confDistribution = new int[6]; // 1 a 5
        int lowConfSuccess = 0;
        int highConfError = 0;

        Map<String, Integer> contextCounts = new LinkedHashMap<>();
        Map<String, Integer> errorCauseCounts = new LinkedHashMap<>();

        for (ParsedAttempt att : attempts) {
            uniqueQuestions.add(att.questionId());

            if (att.isCorrect()) {
                correct++;
            } else {
                error++;
            }

            totalActiveMs += Math.max(0, att.activeTimeMs());

            if (latestTime == null || (att.occurredAt() != null && att.occurredAt().isAfter(latestTime))) {
                latestTime = att.occurredAt();
            }

            if (att.exposicaoAnterior() == 0) {
                newQuestions++;
            } else {
                repeatedQuestions++;
            }

            if (att.isVariant()) {
                variantQuestions++;
            }

            if (att.confidenceLevel() >= 1 && att.confidenceLevel() <= 5) {
                confidenceLevels.add(att.confidenceLevel());
                confDistribution[att.confidenceLevel()]++;
            }

            if (CognitiveMetricsCalculator.isLowConfidenceSuccess(att.confidenceLevel(), att.isCorrect())) {
                lowConfSuccess++;
            }
            if (CognitiveMetricsCalculator.isHighConfidenceError(att.confidenceLevel(), att.isCorrect())) {
                highConfError++;
            }

            // Metadado de contexto sem pesos arbitrários
            String ctx = att.interventionType() != null && !att.interventionType().isBlank() ? att.interventionType() : "REGULAR";
            contextCounts.put(ctx, contextCounts.getOrDefault(ctx, 0) + 1);

            // Causa de erro
            if (!att.isCorrect() && att.causaErro() != null && !att.causaErro().isBlank()) {
                errorCauseCounts.put(att.causaErro(), errorCauseCounts.getOrDefault(att.causaErro(), 0) + 1);
            }
        }

        double accuracyRate = Math.round(((double) correct / total) * 1000.0) / 1000.0;
        long avgActiveMs = total > 0 ? (totalActiveMs / total) : 0;
        Double avgConf = CognitiveMetricsCalculator.computeOrdinalConfidenceMean(confidenceLevels);
        String evidenceStatus = CognitiveMetricsCalculator.classifyEvidenceStatus(total, uniqueQuestions.size());

        proj.setTotalAttempts(total);
        proj.setCorrectAttempts(correct);
        proj.setErrorAttempts(error);
        proj.setAccuracyRate(accuracyRate);
        proj.setAccuracyDenominatorText(CognitiveMetricsCalculator.formatAccuracyDenominator(correct, total));
        proj.setTotalActiveTimeMs(totalActiveMs);
        proj.setAverageActiveTimeMs(avgActiveMs);
        proj.setLastAttemptAt(latestTime);

        proj.setUniqueQuestionsCount(uniqueQuestions.size());
        proj.setNewQuestionsAttempts(newQuestions);
        proj.setRepeatedQuestionsAttempts(repeatedQuestions);
        proj.setVariantQuestionsAttempts(variantQuestions);

        proj.setAvgConfidenceOrdinal(avgConf);
        proj.setLowConfidenceSuccesses(lowConfSuccess);
        proj.setHighConfidenceErrors(highConfError);

        Map<String, Integer> confMap = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) {
            confMap.put(String.valueOf(i), confDistribution[i]);
        }
        proj.setConfidenceDistributionJson(toJson(confMap));
        proj.setContextDistributionJson(toJson(contextCounts));
        proj.setErrorCausesDistributionJson(toJson(errorCauseCounts));

        if (memory != null) {
            proj.setFsrsStabilityDays(memory.stability());
            proj.setFsrsRetrievalRate(memory.retrievalRate());
        }

        proj.setEvidenceStatus(evidenceStatus);
        proj.setEpistemicLimitationsJson(toJson(CognitiveMetricsCalculator.buildEpistemicLimitations(
                total, uniqueQuestions.size(), repeatedQuestions, lowConfSuccess, highConfError, evidenceStatus
        )));
        proj.setPedagogicalHypothesesJson(toJson(CognitiveMetricsCalculator.buildPedagogicalHypotheses(
                total, correct, uniqueQuestions.size(), highConfError, lowConfSuccess, repeatedQuestions
        )));

        return proj;
    }

    private ParsedAttempt parseAttempt(
            EventRecord event,
            Map<String, QuestionMetadata> questionMap,
            Map<String, String> familyMap
    ) {
        return parseAttempt(event, questionMap, familyMap, Collections.emptyMap());
    }

    private ParsedAttempt parseAttempt(
            EventRecord event,
            Map<String, QuestionMetadata> questionMap,
            Map<String, String> familyMap,
            Map<String, String> latestAnnotations
    ) {
        try {
            JsonNode payload = objectMapper.readTree(event.getPayloadJson());
            String origin = payload.hasNonNull("origin") ? payload.path("origin").asText().trim() : null;
            String sessionId = event.getSessionId();
            String lowerSession = (sessionId != null) ? sessionId.toLowerCase().trim() : "";
            boolean isSyntheticSession = lowerSession.startsWith("test-") || lowerSession.startsWith("mock-") || lowerSession.startsWith("e2e-") || lowerSession.startsWith("demo-") || lowerSession.startsWith("sample-");

            boolean isReal = "REAL_STUDY".equalsIgnoreCase(origin) && !isSyntheticSession;

            String questionId = payload.path("questionId").asText(event.getAggregateId());
            boolean isCorrect = payload.path("isCorrect").asBoolean(false);
            int confidenceLevel = payload.path("confidenceLevel").asInt(3);
            long activeTimeMs = payload.path("activeTimeMs").asLong(0);
            int exposicao = payload.path("exposicaoAnteriorCount").asInt(0);

            // Resolução precisa do attemptId e associação de anotações legítimas (ATTEMPT_ANNOTATED)
            String attemptId = payload.path("attemptId").asText(null);
            if (attemptId == null || attemptId.isBlank()) {
                String eventId = event.getEventId();
                if (eventId != null && eventId.startsWith("attempt:")) {
                    attemptId = eventId.substring("attempt:".length());
                } else {
                    attemptId = event.getAggregateId();
                }
            }

            String causaErro = payload.path("causaErro").asText(null);
            if (attemptId != null && latestAnnotations != null && latestAnnotations.containsKey(attemptId)) {
                causaErro = latestAnnotations.get(attemptId);
            }

            String intervention = payload.path("interventionType").asText("REGULAR");

            Instant occurredAt = null;
            try {
                occurredAt = Instant.parse(event.getOccurredAt());
            } catch (Exception ignored) {}

            QuestionMetadata qMeta = questionMap.get(questionId);
            String discipline = qMeta != null && qMeta.discipline() != null ? qMeta.discipline() : "GERAL";
            String topic = qMeta != null && qMeta.topic() != null ? qMeta.topic() : "GERAL";

            boolean isVariant = false;
            if (qMeta != null && (qMeta.familyId() != null || familyMap.containsKey(questionId))) {
                isVariant = true;
            }

            return new ParsedAttempt(
                    event.getEventId(),
                    questionId,
                    discipline,
                    topic,
                    isCorrect,
                    confidenceLevel,
                    activeTimeMs,
                    exposicao,
                    causaErro,
                    intervention,
                    isReal,
                    isVariant,
                    occurredAt
            );
        } catch (Exception e) {
            log.warn("Erro ao fazer parse do evento {}: {}", event.getEventId(), e.getMessage());
            return null;
        }
    }

    private Map<String, String> loadLatestAnnotations() {
        try {
            return com.fiscalstudy.backend.application.AttemptAnnotationView.latest(jdbcTemplate);
        } catch (Exception e) {
            log.warn("Falha ao carregar anotações de erro (ATTEMPT_ANNOTATED): {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    private Map<String, QuestionMetadata> loadQuestionMetadata() {
        Map<String, QuestionMetadata> map = new HashMap<>();
        String sql = "SELECT id, disciplina, assunto, banca, ano FROM study_questions";
        try {
            jdbcTemplate.query(sql, rs -> {
                String id = rs.getString("id");
                String disc = rs.getString("disciplina");
                String ass = rs.getString("assunto");
                String banca = rs.getString("banca");
                int ano = rs.getInt("ano");
                map.put(id, new QuestionMetadata(id, disc, ass, banca, ano, null));
            });
        } catch (Exception e) {
            log.warn("Falha ao carregar metadados de questões: {}", e.getMessage());
        }
        return map;
    }

    private Map<String, String> loadQuestionFamilies() {
        Map<String, String> map = new HashMap<>();
        try {
            String sql = "SELECT question_id, family_id FROM question_families";
            jdbcTemplate.query(sql, rs -> {
                map.put(rs.getString("question_id"), rs.getString("family_id"));
            });
        } catch (Exception ignored) {}
        return map;
    }

    private Map<String, MemoryState> loadMemoryStates() {
        Map<String, MemoryState> map = new HashMap<>();
        try {
            String sql = """
                SELECT q.assunto, AVG(m.stability) as avg_stab, 
                       AVG(EXP(- (julianday('now') - julianday(m.last_reviewed_at)) / MAX(1.0, m.stability))) as avg_retrieval
                FROM learning_memory_state m
                JOIN study_questions q ON q.id = m.question_id
                GROUP BY q.assunto
            """;
            jdbcTemplate.query(sql, rs -> {
                String topic = rs.getString("assunto");
                double stab = rs.getDouble("avg_stab");
                double ret = rs.getDouble("avg_retrieval");
                if (topic != null) {
                    map.put(topic, new MemoryState(Math.round(stab * 10.0) / 10.0, Math.round(ret * 100.0) / 100.0));
                }
            });
        } catch (Exception ignored) {}
        return map;
    }

    private Map<String, TopicInfo> loadCanonicalTopics() {
        Map<String, TopicInfo> map = new LinkedHashMap<>();
        try {
            String sql = "SELECT id, disciplina, assunto FROM edital_topicos ORDER BY disciplina, assunto";
            jdbcTemplate.query(sql, rs -> {
                String id = rs.getString("id");
                String disc = rs.getString("disciplina");
                String ass = rs.getString("assunto");
                String key = (ass != null && !ass.isBlank()) ? ass : id;
                map.put(key, new TopicInfo(id, disc, ass != null ? ass : id));
            });
        } catch (Exception e) {
            log.warn("Falha ao consultar edital_topicos: {}", e.getMessage());
        }
        return map;
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    public record ParsedAttempt(
            String eventId,
            String questionId,
            String discipline,
            String topicId,
            boolean isCorrect,
            int confidenceLevel,
            long activeTimeMs,
            int exposicaoAnterior,
            String causaErro,
            String interventionType,
            boolean isRealStudy,
            boolean isVariant,
            Instant occurredAt
    ) {}

    public record TopicInfo(String id, String discipline, String topicName) {}
    public record MemoryState(double stability, double retrievalRate) {}
    public record RebuildResult(int topicsProcessed, int totalAttempts, Instant completedAt) {}
}
