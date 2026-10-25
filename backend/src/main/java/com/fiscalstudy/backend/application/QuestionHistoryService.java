package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.in.web.dto.PerformanceXRayDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionHistoryDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class QuestionHistoryService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public QuestionHistoryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
    }

    public QuestionHistoryDTO.Response getQuestionHistory(
            String concursoId,
            String disciplina,
            String topic,
            String result,
            String period,
            Integer limit,
            Integer offset
    ) {
        StringBuilder sql = new StringBuilder("""
            SELECT e.event_id, e.aggregate_id as question_id, e.session_id, e.occurred_at, e.payload_json,
                   q.enunciado, q.options_json, q.correct_option, q.gabarito_status,
                   q.banca, q.ano, q.orgao, q.cargo, q.disciplina, q.assunto,
                   ROW_NUMBER() OVER (PARTITION BY e.aggregate_id ORDER BY e.occurred_at ASC) as attempt_number,
                   COUNT(*) OVER (PARTITION BY e.aggregate_id) as total_attempts_for_question
            FROM event_store e
            LEFT JOIN questions q ON e.aggregate_id = q.id
            WHERE e.event_type = 'ANSWER_SUBMITTED'
        """);

        List<Object> params = new ArrayList<>();

        if (disciplina != null && !disciplina.isBlank() && !"ALL".equalsIgnoreCase(disciplina)) {
            sql.append(" AND q.disciplina = ?");
            params.add(disciplina.trim());
        }

        if (topic != null && !topic.isBlank() && !"ALL".equalsIgnoreCase(topic)) {
            sql.append(" AND q.assunto = ?");
            params.add(topic.trim());
        }

        if (period != null && !period.isBlank()) {
            switch (period.toUpperCase().trim()) {
                case "TODAY" -> sql.append(" AND e.occurred_at >= date('now', 'start of day')");
                case "WEEK" -> sql.append(" AND e.occurred_at >= datetime('now', '-7 days')");
                case "MONTH" -> sql.append(" AND e.occurred_at >= datetime('now', '-30 days')");
            }
        }

        sql.append(" ORDER BY e.occurred_at DESC");

        Map<String,String> annotations=AttemptAnnotationView.latest(jdbcTemplate);
        List<QuestionHistoryDTO.Item> allItems = new ArrayList<>();
        Set<String> uniqueQuestions = new HashSet<>();
        int correctCount = 0;
        int incorrectCount = 0;
        int anuladasCount = 0;

        List<Map<String, Object>> rows = LearningEventEligibility.query(jdbcTemplate, sql.toString(), params.toArray());

        for (Map<String, Object> row : rows) {
            String eventId = (String) row.get("event_id");
            String questionId = (String) row.get("question_id");
            String statement = (String) row.get("enunciado");
            String optionsJson = (String) row.get("options_json");
            String correctOption = (String) row.get("correct_option");
            String rowGabaritoStatus = (String) row.get("gabarito_status");
            String board = (String) row.get("banca");
            Integer year = row.get("ano") != null ? ((Number) row.get("ano")).intValue() : null;
            String orgao = (String) row.get("orgao");
            String cargo = (String) row.get("cargo");
            String disc = (String) row.get("disciplina");
            String top = (String) row.get("assunto");
            String occurredAt = (String) row.get("occurred_at");
            int attemptNumber = row.get("attempt_number") != null ? ((Number) row.get("attempt_number")).intValue() : 1;
            int totalAttemptsForQ = row.get("total_attempts_for_question") != null ? ((Number) row.get("total_attempts_for_question")).intValue() : 1;

            // Parse payload JSON
            String payloadJson = (String) row.get("payload_json");
            String selectedOption = null;
            Boolean isCorrect = null;
            int concursoPoint = 0;
            String gabaritoStatus = rowGabaritoStatus != null ? rowGabaritoStatus : "DEFINITIVO";
            int confidenceLevel = 3;
            long activeTimeMs = 0;
            String causaErro = null;

            if (payloadJson != null && !payloadJson.isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(payloadJson);
                    selectedOption = node.path("selectedOption").asText(null);
                    if (node.hasNonNull("isCorrect")) {
                        isCorrect = node.path("isCorrect").asBoolean();
                    }
                    concursoPoint = node.path("concursoPoint").asInt(0);
                    if (node.hasNonNull("gabaritoStatus")) {
                        gabaritoStatus = node.path("gabaritoStatus").asText();
                    }
                    confidenceLevel = node.path("confidenceLevel").asInt(3);
                    activeTimeMs = node.path("activeTimeMs").asLong(0);
                    causaErro=annotations.get(node.path("attemptId").asText());
                    if (causaErro==null && node.hasNonNull("causaErro") && !node.path("causaErro").asText().isBlank()) {
                        causaErro = node.path("causaErro").asText();
                    }
                } catch (Exception ignored) {}
            }

            // Filter by result if specified
            if (result != null && !result.isBlank() && !"ALL".equalsIgnoreCase(result)) {
                String r = result.toUpperCase().trim();
                if ("CORRECT".equals(r) && !Boolean.TRUE.equals(isCorrect)) continue;
                if ("INCORRECT".equals(r) && !Boolean.FALSE.equals(isCorrect)) continue;
                if ("ANULADA".equals(r) && !"ANULADA".equalsIgnoreCase(gabaritoStatus)) continue;
            }

            // Parse options list
            List<String> options = new ArrayList<>();
            if (optionsJson != null && !optionsJson.isBlank()) {
                try {
                    options = objectMapper.readValue(optionsJson, new TypeReference<List<String>>() {});
                } catch (Exception e) {
                    options = Collections.singletonList(optionsJson);
                }
            }

            uniqueQuestions.add(questionId);
            if ("ANULADA".equalsIgnoreCase(gabaritoStatus)) {
                anuladasCount++;
            } else if (Boolean.TRUE.equals(isCorrect)) {
                correctCount++;
            } else if (Boolean.FALSE.equals(isCorrect)) {
                incorrectCount++;
            }

            allItems.add(new QuestionHistoryDTO.Item(
                    eventId, questionId, statement, options, selectedOption, correctOption,
                    isCorrect, gabaritoStatus, concursoPoint, confidenceLevel, activeTimeMs,
                    causaErro, disc, top, board, year, orgao, cargo, occurredAt,
                    attemptNumber, totalAttemptsForQ
            ));
        }

        int totalAttempts = allItems.size();
        int evaluatedCount = correctCount + incorrectCount;
        double accuracyRate = evaluatedCount > 0 ? ((double) correctCount / evaluatedCount * 100.0) : 0.0;

        // Apply pagination
        int start = offset != null ? Math.max(0, offset) : 0;
        int end = limit != null ? Math.min(allItems.size(), start + limit) : allItems.size();
        List<QuestionHistoryDTO.Item> paged = (start < allItems.size()) ? allItems.subList(start, end) : Collections.emptyList();

        return new QuestionHistoryDTO.Response(
                paged,
                totalAttempts,
                uniqueQuestions.size(),
                correctCount,
                incorrectCount,
                anuladasCount,
                accuracyRate
        );
    }

    public PerformanceXRayDTO getPerformanceXRay(String concursoId) {
        String sql = """
            SELECT e.aggregate_id as question_id, e.occurred_at, e.payload_json,
                   q.disciplina, q.assunto, q.gabarito_status
            FROM event_store e
            LEFT JOIN questions q ON e.aggregate_id = q.id
            WHERE e.event_type = 'ANSWER_SUBMITTED'
            ORDER BY e.occurred_at ASC
        """;

        List<Map<String, Object>> rows = LearningEventEligibility.query(jdbcTemplate, sql);

        PerformanceXRayDTO xray = new PerformanceXRayDTO();
        int totalAttempts = rows.size();
        xray.setTotalAttempts(totalAttempts);

        if (totalAttempts == 0) {
            xray.setUniqueQuestions(0);
            xray.setTotalCorrect(0);
            xray.setTotalIncorrect(0);
            xray.setTotalAnuladas(0);
            xray.setAccuracyRate(0.0);
            xray.setTotalActiveTimeMs(0);
            xray.setAverageTimePerQuestionMs(0.0);
            xray.setDisciplineBreakdown(Collections.emptyList());
            xray.setTopicBreakdown(Collections.emptyList());
            xray.setTopErrorAreas(Collections.emptyList());
            xray.setMasteredAreas(Collections.emptyList());
            xray.setUnansweredQuestionsCount(0);
            xray.setTotalQuestionsInBank(0);
            xray.setRecentEvolution(Collections.emptyList());
            return xray;
        }

        Set<String> uniqueQuestionIds = new HashSet<>();
        int totalCorrect = 0;
        int totalIncorrect = 0;
        int totalAnuladas = 0;
        long totalActiveTimeMs = 0;

        Map<String, DisciplineAcc> discMap = new HashMap<>();
        Map<String, TopicAcc> topicMap = new HashMap<>();
        Map<String, int[]> dailyMap = new TreeMap<>(); // date -> [attempts, correct]

        for (Map<String, Object> row : rows) {
            String questionId = (String) row.get("question_id");
            String occurredAt = (String) row.get("occurred_at");
            String rawDisc = (String) row.get("disciplina");
            final String disc = (rawDisc == null || rawDisc.isBlank()) ? "Geral" : rawDisc;
            String rawTop = (String) row.get("assunto");
            final String top = (rawTop == null || rawTop.isBlank()) ? "Geral" : rawTop;

            uniqueQuestionIds.add(questionId);

            String payloadJson = (String) row.get("payload_json");
            Boolean isCorrect = null;
            long activeTime = 0;
            String gabaritoStatus = (String) row.get("gabarito_status");

            if (payloadJson != null && !payloadJson.isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(payloadJson);
                    if (node.hasNonNull("isCorrect")) {
                        isCorrect = node.path("isCorrect").asBoolean();
                    }
                    if (node.hasNonNull("gabaritoStatus")) {
                        gabaritoStatus = node.path("gabaritoStatus").asText();
                    }
                    activeTime = node.path("activeTimeMs").asLong(0);
                } catch (Exception ignored) {}
            }

            totalActiveTimeMs += activeTime;

            // Discipline accumulator
            DisciplineAcc dAcc = discMap.computeIfAbsent(disc, k -> new DisciplineAcc(k));
            dAcc.totalAttempts++;
            dAcc.uniqueQuestions.add(questionId);
            dAcc.totalTimeMs += activeTime;

            // Topic accumulator
            String topicKey = disc + "||" + top;
            TopicAcc tAcc = topicMap.computeIfAbsent(topicKey, k -> new TopicAcc(disc, top));
            tAcc.totalAttempts++;

            if ("ANULADA".equalsIgnoreCase(gabaritoStatus)) {
                totalAnuladas++;
            } else if (Boolean.TRUE.equals(isCorrect)) {
                totalCorrect++;
                dAcc.correctCount++;
                tAcc.correctCount++;
            } else if (Boolean.FALSE.equals(isCorrect)) {
                totalIncorrect++;
                tAcc.incorrectCount++;
            }

            // Daily evolution
            if (occurredAt != null && occurredAt.length() >= 10) {
                String date = occurredAt.substring(0, 10);
                int[] stats = dailyMap.computeIfAbsent(date, k -> new int[2]);
                stats[0]++; // attempts
                if (Boolean.TRUE.equals(isCorrect)) stats[1]++; // correct
            }
        }

        xray.setUniqueQuestions(uniqueQuestionIds.size());
        xray.setTotalCorrect(totalCorrect);
        xray.setTotalIncorrect(totalIncorrect);
        xray.setTotalAnuladas(totalAnuladas);
        xray.setTotalActiveTimeMs(totalActiveTimeMs);
        xray.setAverageTimePerQuestionMs(totalAttempts > 0 ? (double) totalActiveTimeMs / totalAttempts : 0.0);

        int evaluated = totalCorrect + totalIncorrect;
        xray.setAccuracyRate(evaluated > 0 ? ((double) totalCorrect / evaluated * 100.0) : 0.0);

        // Build discipline breakdown
        List<PerformanceXRayDTO.DisciplineStat> discList = new ArrayList<>();
        for (DisciplineAcc d : discMap.values()) {
            double acc = d.totalAttempts > 0 ? ((double) d.correctCount / d.totalAttempts * 100.0) : 0.0;
            String status = acc >= 75.0 ? "DOMINADO" : (acc >= 50.0 ? "EM_EVOLUCAO" : "ATENCAO");
            double avgTime = d.totalAttempts > 0 ? (double) d.totalTimeMs / d.totalAttempts : 0.0;
            discList.add(new PerformanceXRayDTO.DisciplineStat(
                    d.disciplina, d.totalAttempts, d.uniqueQuestions.size(), d.correctCount, acc, status, avgTime
            ));
        }
        discList.sort((a, b) -> Integer.compare(b.getTotalAttempts(), a.getTotalAttempts()));
        xray.setDisciplineBreakdown(discList);

        // Build topic breakdown
        List<PerformanceXRayDTO.TopicStat> topicList = new ArrayList<>();
        for (TopicAcc t : topicMap.values()) {
            double acc = t.totalAttempts > 0 ? ((double) t.correctCount / t.totalAttempts * 100.0) : 0.0;
            topicList.add(new PerformanceXRayDTO.TopicStat(
                    t.disciplina, t.topic, t.totalAttempts, t.correctCount, t.incorrectCount, acc
            ));
        }
        topicList.sort((a, b) -> Integer.compare(b.getTotalAttempts(), a.getTotalAttempts()));
        xray.setTopicBreakdown(topicList);

        // Top error areas: topics with most errors or lowest accuracy
        List<PerformanceXRayDTO.TopicStat> errorAreas = new ArrayList<>(topicList);
        errorAreas.removeIf(t -> t.getIncorrectCount() == 0);
        errorAreas.sort((a, b) -> Integer.compare(b.getIncorrectCount(), a.getIncorrectCount()));
        xray.setTopErrorAreas(errorAreas.stream().limit(5).toList());

        // Mastered areas: topics with accuracy >= 75%
        List<PerformanceXRayDTO.TopicStat> mastered = new ArrayList<>(topicList);
        mastered.removeIf(t -> t.getAccuracyRate() < 75.0 || t.getTotalAttempts() < 2);
        mastered.sort((a, b) -> Double.compare(b.getAccuracyRate(), a.getAccuracyRate()));
        xray.setMasteredAreas(mastered);

        // Total questions in bank & unanswered count
        int totalQuestionsInBank = 0;
        try {
            List<Map<String, Object>> countRow = LearningEventEligibility.query(jdbcTemplate, "SELECT COUNT(*) as c FROM questions");
            if (!countRow.isEmpty() && countRow.get(0).get("c") != null) {
                totalQuestionsInBank = ((Number) countRow.get(0).get("c")).intValue();
            }
        } catch (Exception ignored) {}
        xray.setTotalQuestionsInBank(totalQuestionsInBank);
        xray.setUnansweredQuestionsCount(Math.max(0, totalQuestionsInBank - uniqueQuestionIds.size()));

        // Recent daily evolution (last 14 days)
        List<PerformanceXRayDTO.DailyEvolution> evolution = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : dailyMap.entrySet()) {
            int att = entry.getValue()[0];
            int cor = entry.getValue()[1];
            double acc = att > 0 ? ((double) cor / att * 100.0) : 0.0;
            evolution.add(new PerformanceXRayDTO.DailyEvolution(entry.getKey(), att, cor, acc));
        }
        xray.setRecentEvolution(evolution);

        return xray;
    }

    private static class DisciplineAcc {
        String disciplina;
        int totalAttempts;
        int correctCount;
        long totalTimeMs;
        Set<String> uniqueQuestions = new HashSet<>();

        DisciplineAcc(String disciplina) {
            this.disciplina = disciplina;
        }
    }

    private static class TopicAcc {
        String disciplina;
        String topic;
        int totalAttempts;
        int correctCount;
        int incorrectCount;

        TopicAcc(String disciplina, String topic) {
            this.disciplina = disciplina;
            this.topic = topic;
        }
    }
}
