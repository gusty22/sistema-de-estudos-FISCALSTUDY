package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventOrigin;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.StudyMaterial;
import com.fiscalstudy.backend.domain.StudyMaterialRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class StudySessionService {

    private static final Logger logger = LoggerFactory.getLogger(StudySessionService.class);

    private final EventStoreRepository eventStoreRepository;
    private final StudyMaterialRepository studyMaterialRepository;
    private final ObjectMapper objectMapper;
    private final EventOrigin instanceOrigin;

    public StudySessionService(EventStoreRepository eventStoreRepository,
                               StudyMaterialRepository studyMaterialRepository,
                               ObjectMapper objectMapper,
                               @Value("${fiscalstudy.event-origin:REAL_STUDY}") String configuredOrigin) {
        this.eventStoreRepository = eventStoreRepository;
        this.studyMaterialRepository = studyMaterialRepository;
        this.objectMapper = objectMapper;
        this.instanceOrigin = EventOrigin.fromString(configuredOrigin);
    }

    public Map<String, Object> recordStudySession(Map<String, Object> sessionData) {
        String sessionId = (String) sessionData.getOrDefault("sessionId", UUID.randomUUID().toString());
        String concursoId = (String) sessionData.get("concursoId");
        String disciplina = (String) sessionData.get("disciplina");
        String topicoId = (String) sessionData.get("topicoId");
        String materialId = (String) sessionData.get("materialId");
        Number durationSec = (Number) sessionData.getOrDefault("durationSeconds", 0);
        Number paginasLidas = (Number) sessionData.getOrDefault("paginasLidas", 0);
        Number questoesFeitas = (Number) sessionData.getOrDefault("questoesFeitas", 0);
        String modo = (String) sessionData.getOrDefault("modo", "CRONOMETRO"); // CRONOMETRO, POMODORO, MANUAL
        String notas = (String) sessionData.get("notas");

        // Atualiza progresso do material se materialId e páginas lidas foram fornecidos
        if (materialId != null && !materialId.isBlank() && paginasLidas != null && paginasLidas.intValue() > 0) {
            Optional<StudyMaterial> matOpt = studyMaterialRepository.findById(materialId);
            if (matOpt.isPresent()) {
                StudyMaterial mat = matOpt.get();
                mat.setPaginaAtual(Math.min(mat.getTotalPaginas() > 0 ? mat.getTotalPaginas() : Integer.MAX_VALUE,
                        mat.getPaginaAtual() + paginasLidas.intValue()));
                studyMaterialRepository.save(mat);
            }
        }

        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("sessionId", sessionId);
        payloadMap.put("concursoId", concursoId);
        payloadMap.put("disciplina", disciplina);
        payloadMap.put("topicoId", topicoId);
        payloadMap.put("materialId", materialId);
        payloadMap.put("durationSeconds", durationSec.intValue());
        payloadMap.put("paginasLidas", paginasLidas.intValue());
        payloadMap.put("questoesFeitas", questoesFeitas.intValue());
        payloadMap.put("modo", modo);
        payloadMap.put("notas", notas);
        payloadMap.put("origin", instanceOrigin.name());

        String payloadJson = "{}";
        try {
            payloadJson = objectMapper.writeValueAsString(payloadMap);
        } catch (Exception e) {
            logger.error("Falha ao serializar payload de estudo", e);
        }

        eventStoreRepository.appendEvent(
                "STUDY_SESSION_RECORDED",
                "STUDY_SESSION",
                sessionId,
                sessionId,
                1,
                "v1",
                payloadJson
        );

        Map<String, Object> response = new LinkedHashMap<>(payloadMap);
        response.put("status", "RECORDED");
        return response;
    }

    public Map<String, Object> getStudyTimeSummary(String concursoId) {
        List<String> payloads = eventStoreRepository.getAllEventPayloads("STUDY_SESSION_RECORDED");
        long totalSeconds = 0;
        int totalPaginas = 0;
        int totalQuestoes = 0;
        Map<String, Long> secondsPorDisciplina = new LinkedHashMap<>();

        for (String p : payloads) {
            try {
                Map<String, Object> map = objectMapper.readValue(p, Map.class);
                String cid = (String) map.get("concursoId");
                if (concursoId != null && !concursoId.isBlank() && !concursoId.equals(cid)) {
                    continue;
                }
                Number dur = (Number) map.getOrDefault("durationSeconds", 0);
                Number pags = (Number) map.getOrDefault("paginasLidas", 0);
                Number qsts = (Number) map.getOrDefault("questoesFeitas", 0);
                String disc = (String) map.getOrDefault("disciplina", "Geral");

                long s = dur != null ? dur.longValue() : 0L;
                totalSeconds += s;
                totalPaginas += pags != null ? pags.intValue() : 0;
                totalQuestoes += qsts != null ? qsts.intValue() : 0;

                secondsPorDisciplina.put(disc, secondsPorDisciplina.getOrDefault(disc, 0L) + s);
            } catch (Exception ignored) {}
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalSeconds", totalSeconds);
        summary.put("totalHours", Math.round((totalSeconds / 3600.0) * 10.0) / 10.0);
        summary.put("totalPaginas", totalPaginas);
        summary.put("totalQuestoes", totalQuestoes);
        summary.put("secondsPorDisciplina", secondsPorDisciplina);
        return summary;
    }
}
