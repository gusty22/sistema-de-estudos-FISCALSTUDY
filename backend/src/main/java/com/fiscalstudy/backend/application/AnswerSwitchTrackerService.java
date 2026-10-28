package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventRecord;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Rastreador "Marcou, Acabou" (Answer Switch Tracker):
 * Audita trocas de alternativa antes da submissão final, calculando
 * com precisão se o estudante perdeu pontos trocando do Certo para o Errado.
 */
@Service
public class AnswerSwitchTrackerService {

    private static final Logger logger = LoggerFactory.getLogger(AnswerSwitchTrackerService.class);

    private final EventStoreRepository eventStoreRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AnswerSwitchTrackerService(EventStoreRepository eventStoreRepository, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.eventStoreRepository = eventStoreRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void recordAnswerSwitch(String sessionId, String questionId, String fromOption, String toOption, int timeSpentSeconds) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sessionId", sessionId);
        payload.put("questionId", questionId);
        payload.put("fromOption", fromOption);
        payload.put("toOption", toOption);
        payload.put("timeSpentSeconds", timeSpentSeconds);
        payload.put("switchedAt", java.time.Instant.now().toString());

        try {
            String json = objectMapper.writeValueAsString(payload);
            eventStoreRepository.appendEvent(
                    "ANSWER_SWITCHED",
                    "QUESTION",
                    questionId,
                    sessionId,
                    1,
                    "v1",
                    json
            );
        } catch (Exception e) {
            logger.error("Falha ao registrar ANSWER_SWITCHED no event_store", e);
        }
    }

    public Map<String, Object> getAnswerSwitchAnalytics(String sessionId) {
        List<EventRecord> switchEvents = eventStoreRepository.getAllEvents("ANSWER_SWITCHED");
        List<EventRecord> answerEvents = eventStoreRepository.getAllEvents("ANSWER_SUBMITTED");

        // Mapear gabarito oficial por questionId a partir do banco de questões
        Map<String, String> officialAnswers = new HashMap<>();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT id, correct_option FROM study_questions");
        for (Map<String, Object> r : rows) {
            String qid = (String) r.get("id");
            String ans = (String) r.get("correct_option");
            if (qid != null && ans != null) {
                officialAnswers.put(qid, ans.trim().toUpperCase());
            }
        }

        int totalSwitches = 0;
        int correctToWrong = 0;
        int wrongToCorrect = 0;
        int neutralSwitches = 0;

        for (EventRecord event : switchEvents) {
            try {
                Map<String, Object> p = objectMapper.readValue(event.getPayloadJson(), Map.class);
                String sid = (String) p.get("sessionId");
                if (sessionId != null && !sessionId.isBlank() && !sessionId.equals(sid)) {
                    continue;
                }

                String qid = (String) p.get("questionId");
                String fromOpt = (String) p.get("fromOption");
                String toOpt = (String) p.get("toOption");

                String official = officialAnswers.get(qid);
                if (official == null) {
                    continue;
                }

                totalSwitches++;
                boolean fromWasCorrect = official.equalsIgnoreCase(fromOpt);
                boolean toWasCorrect = official.equalsIgnoreCase(toOpt);

                if (fromWasCorrect && !toWasCorrect) {
                    correctToWrong++;
                } else if (!fromWasCorrect && toWasCorrect) {
                    wrongToCorrect++;
                } else {
                    neutralSwitches++;
                }
            } catch (Exception e) {
                logger.warn("Erro ao processar evento ANSWER_SWITCHED", e);
            }
        }

        double netScoreImpact = (wrongToCorrect * 1.0) - (correctToWrong * 1.0);
        double correctToWrongRate = totalSwitches > 0 ? (double) correctToWrong / totalSwitches : 0.0;
        double correctToWrongPercent = Math.round(correctToWrongRate * 1000.0) / 10.0;

        String advice;
        if (totalSwitches == 0) {
            advice = "Nenhuma troca de alternativa registrada. Excelente firmeza de decisão!";
        } else if (netScoreImpact < 0) {
            advice = String.format(
                    "⚠️ Alerta 'Marcou, Acabou': Você trocou de alternativa %d vezes e em %.1f%% das vezes trocou do Certo para o Errado! Seu saldo líquido foi de %.1f pontos perdidos. Só troque se encontrar um erro crasso comprovado!",
                    totalSwitches, correctToWrongPercent, Math.abs(netScoreImpact)
            );
        } else if (netScoreImpact > 0) {
            advice = String.format(
                    "🎯 Trocas calibradas: Suas trocas geraram um saldo positivo de +%.1f pontos (%d acertos recuperados vs %d erros). Mantenha a vigilância crítica!",
                    netScoreImpact, wrongToCorrect, correctToWrong
            );
        } else {
            advice = String.format(
                    "⚖️ Trocas neutras: %d trocas com saldo líquido zero (+%d certos vs -%d errados).",
                    totalSwitches, wrongToCorrect, correctToWrong
            );
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalSwitches", totalSwitches);
        result.put("correctToWrongCount", correctToWrong);
        result.put("wrongToCorrectCount", wrongToCorrect);
        result.put("neutralCount", neutralSwitches);
        result.put("netPointsScore", netScoreImpact);
        result.put("correctToWrongPercent", correctToWrongPercent);
        result.put("marcouAcabouAdvice", advice);

        return result;
    }
}
