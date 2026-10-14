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
 * Serviço de Métricas Cognitivas de Tempo:
 * - Separação estrita de HE (Hora de Estudo Raiz/Ativa) vs. HRE (Hora Relacionada ao Estudo/Operacional)
 * - Alerta de limiar saudável (HRE <= 15%)
 * - Recuperação da Mensagem para o Eu do Futuro (next_session_handoff)
 * - Gestão da Lista de Distrações / Brain Dump (Modo Monge Ctrl+D)
 */
@Service
public class TimeMetricService {

    private static final Logger logger = LoggerFactory.getLogger(TimeMetricService.class);
    public static final double MAX_HEALTHY_HRE_RATIO = 0.15; // 15% limite saudável

    private final EventStoreRepository eventStoreRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public TimeMetricService(EventStoreRepository eventStoreRepository, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.eventStoreRepository = eventStoreRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> getTimeMetricsSummary(String concursoId) {
        List<EventRecord> events = eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED");

        long heSeconds = 0;
        long hreSeconds = 0;
        int totalPaginas = 0;
        int totalQuestoes = 0;
        Map<String, Long> heSecondsPorDisciplina = new LinkedHashMap<>();
        Map<String, String> lastHandoffPerDisciplina = new LinkedHashMap<>();

        for (EventRecord event : events) {
            try {
                Map<String, Object> payload = objectMapper.readValue(event.getPayloadJson(), Map.class);
                String cid = (String) payload.get("concursoId");
                if (concursoId != null && !concursoId.isBlank() && !concursoId.equals(cid)) {
                    continue;
                }

                Number dur = (Number) payload.getOrDefault("durationSeconds", 0);
                long seconds = dur != null ? dur.longValue() : 0L;
                String activityType = (String) payload.getOrDefault("activityType", "HE");
                String disc = (String) payload.getOrDefault("disciplina", "Geral");
                String handoff = (String) payload.get("nextSessionHandoff");

                Number pags = (Number) payload.getOrDefault("paginasLidas", 0);
                Number qsts = (Number) payload.getOrDefault("questoesFeitas", 0);
                totalPaginas += pags != null ? pags.intValue() : 0;
                totalQuestoes += qsts != null ? qsts.intValue() : 0;

                if ("HRE".equalsIgnoreCase(activityType)) {
                    hreSeconds += seconds;
                } else {
                    heSeconds += seconds;
                    heSecondsPorDisciplina.put(disc, heSecondsPorDisciplina.getOrDefault(disc, 0L) + seconds);
                }

                if (handoff != null && !handoff.isBlank()) {
                    lastHandoffPerDisciplina.put(disc, handoff);
                }
            } catch (Exception e) {
                logger.warn("Erro ao desserializar evento de sessão: {}", event.getEventId(), e);
            }
        }

        long totalSeconds = heSeconds + hreSeconds;
        double heHours = Math.round((heSeconds / 3600.0) * 10.0) / 10.0;
        double hreHours = Math.round((hreSeconds / 3600.0) * 10.0) / 10.0;
        double totalHours = Math.round((totalSeconds / 3600.0) * 10.0) / 10.0;

        double hreRatio = totalSeconds > 0 ? (double) hreSeconds / totalSeconds : 0.0;
        double hrePercent = Math.round(hreRatio * 1000.0) / 10.0;
        boolean thresholdExceeded = hreRatio > MAX_HEALTHY_HRE_RATIO;

        String alertMessage;
        if (thresholdExceeded) {
            alertMessage = String.format(
                    "⚠️ Alerta de Fricção: Sua proporção de tempo operacional (HRE) atingiu %.1f%% (limite saudável: 15.0%%). Reduza cadastros, formatações e planejamento para priorizar a HE líquida (leitura investigativa e questões)!",
                    hrePercent
            );
        } else {
            alertMessage = String.format(
                    "✅ Balanço Cognitivo Saudável: %.1f%% de tempo operacional (HRE). Excelente foco em HE ativa!",
                    hrePercent
            );
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("concursoId", concursoId);
        summary.put("totalSeconds", totalSeconds);
        summary.put("totalHours", totalHours);
        summary.put("heSeconds", heSeconds);
        summary.put("heHours", heHours);
        summary.put("hreSeconds", hreSeconds);
        summary.put("hreHours", hreHours);
        summary.put("hreRatio", hreRatio);
        summary.put("hrePercent", hrePercent);
        summary.put("isHreThresholdExceeded", thresholdExceeded);
        summary.put("hreAlertMessage", alertMessage);
        summary.put("totalPaginas", totalPaginas);
        summary.put("totalQuestoes", totalQuestoes);
        summary.put("heSecondsPorDisciplina", heSecondsPorDisciplina);
        summary.put("lastHandoffPerDisciplina", lastHandoffPerDisciplina);

        return summary;
    }

    public Map<String, Object> recordDistraction(String sessionId, String concursoId, String text) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update(
                "INSERT INTO student_distractions (id, session_id, concurso_id, distraction_text, resolved) VALUES (?, ?, ?, ?, 0)",
                id, sessionId, concursoId, text
        );
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", id);
        res.put("sessionId", sessionId);
        res.put("distractionText", text);
        res.put("resolved", false);
        return res;
    }

    public List<Map<String, Object>> getDistractions(String concursoId) {
        String sql = "SELECT id, session_id, concurso_id, distraction_text, resolved, created_at FROM student_distractions " +
                (concursoId != null && !concursoId.isBlank() ? "WHERE concurso_id = ? " : "") +
                "ORDER BY created_at DESC";

        List<Map<String, Object>> rows = (concursoId != null && !concursoId.isBlank())
                ? jdbcTemplate.queryForList(sql, concursoId)
                : jdbcTemplate.queryForList(sql);

        return rows;
    }

    public void resolveDistraction(String id) {
        jdbcTemplate.update("UPDATE student_distractions SET resolved = 1 WHERE id = ?", id);
    }
}
