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
        String activityType = (String) sessionData.getOrDefault("activityType", "HE"); // HE (raiz/ativo) ou HRE (operacional)
        String nextSessionHandoff = (String) sessionData.get("nextSessionHandoff");
        String notas = (String) sessionData.get("notas");

        Number paginaInicio = (Number) sessionData.get("paginaInicio");
        Number paginaFim = (Number) sessionData.get("paginaFim");
        int finalPaginasLidas = paginasLidas != null ? paginasLidas.intValue() : 0;
        if (paginaInicio != null && paginaFim != null && paginaFim.intValue() >= paginaInicio.intValue()) {
            finalPaginasLidas = Math.max(finalPaginasLidas, paginaFim.intValue() - paginaInicio.intValue() + 1);
        }

        Number questoesAcertadas = (Number) sessionData.get("questoesAcertadas");
        int qFeitas = questoesFeitas != null ? questoesFeitas.intValue() : 0;
        int qAcertadas = questoesAcertadas != null ? Math.min(qFeitas, questoesAcertadas.intValue()) : 0;

        // Se durationSeconds ou questões vierem zerados, consultar respostas reais gravadas para a mesma sessão
        List<String> answerPayloads = (sessionId != null && !sessionId.isBlank())
                ? eventStoreRepository.getEventPayloads(sessionId, "ANSWER_SUBMITTED")
                : Collections.emptyList();
        long sumActiveTimeMs = 0;
        int answersCount = 0;
        int answersCorrect = 0;
        double sumConf = 0.0;

        for (String ap : answerPayloads) {
            try {
                com.fasterxml.jackson.databind.JsonNode n = objectMapper.readTree(ap);
                sumActiveTimeMs += n.path("activeTimeMs").asLong(0);
                answersCount++;
                if (n.path("isCorrect").asBoolean(false)) {
                    answersCorrect++;
                }
                sumConf += n.path("confidenceLevel").asDouble(3.0);
            } catch (Exception ignored) {}
        }

        if (answersCount > 0) {
            if (durationSec.intValue() <= 0) {
                durationSec = Math.max(1, (int) Math.round(sumActiveTimeMs / 1000.0));
            }
            if (qFeitas <= 0) {
                qFeitas = answersCount;
                qAcertadas = answersCorrect;
            }
        } else if (qFeitas > 0 && durationSec.intValue() <= 0) {
            // Piso mínimo de integridade: pelo menos 1s por questão resolvida
            durationSec = Math.max(1, qFeitas);
        }

        double rendimentoPct = qFeitas > 0 ? Math.round(((qAcertadas * 100.0) / qFeitas) * 10.0) / 10.0 : 0.0;
        Double confMedia = null;
        if (sessionData.get("confiancaMedia") instanceof Number n) {
            confMedia = Math.round(n.doubleValue() * 10.0) / 10.0;
        } else if (answersCount > 0) {
            confMedia = Math.round((sumConf / answersCount) * 10.0) / 10.0;
        }

        double hoursDuration = durationSec.doubleValue() / 3600.0;
        double velPagsHora = hoursDuration > 0 ? Math.round((finalPaginasLidas / hoursDuration) * 10.0) / 10.0 : 0.0;
        double velQuestoesHora = hoursDuration > 0 ? Math.round((qFeitas / hoursDuration) * 10.0) / 10.0 : 0.0;

        // Atualiza progresso do material se materialId e páginas lidas foram fornecidos
        if (materialId != null && !materialId.isBlank() && finalPaginasLidas > 0) {
            Optional<StudyMaterial> matOpt = studyMaterialRepository.findById(materialId);
            if (matOpt.isPresent()) {
                StudyMaterial mat = matOpt.get();
                mat.setPaginaAtual(Math.min(mat.getTotalPaginas() > 0 ? mat.getTotalPaginas() : Integer.MAX_VALUE,
                        mat.getPaginaAtual() + finalPaginasLidas));
                studyMaterialRepository.save(mat);
            }
        }

        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("sessionId", sessionId);
        payloadMap.put("concursoId", concursoId);
        payloadMap.put("disciplina", disciplina != null ? disciplina : "Geral");
        payloadMap.put("topicoId", topicoId != null ? topicoId : "Resolução de Questões");
        payloadMap.put("materialId", materialId);
        payloadMap.put("durationSeconds", durationSec.intValue());
        payloadMap.put("paginaInicio", paginaInicio);
        payloadMap.put("paginaFim", paginaFim);
        payloadMap.put("paginasLidas", finalPaginasLidas);
        payloadMap.put("questoesFeitas", qFeitas);
        payloadMap.put("questoesAcertadas", qAcertadas);
        payloadMap.put("rendimentoPercentual", rendimentoPct);
        if (confMedia != null) {
            payloadMap.put("confiancaMedia", confMedia);
        }
        payloadMap.put("velocidadePaginasPorHora", velPagsHora);
        payloadMap.put("velocidadeQuestoesPorHora", velQuestoesHora);
        payloadMap.put("modo", modo);
        payloadMap.put("activityType", activityType);
        payloadMap.put("nextSessionHandoff", nextSessionHandoff);
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
        long heSeconds = 0;
        long hreSeconds = 0;
        int totalPaginas = 0;
        int totalQuestoes = 0;
        int totalQuestoesAcertadas = 0;
        Map<String, Long> secondsPorDisciplina = new LinkedHashMap<>();
        String latestHandoff = null;
        Set<String> processedSessionIds = new HashSet<>();

        for (String p : payloads) {
            try {
                Map<String, Object> map = objectMapper.readValue(p, Map.class);
                String cid = (String) map.get("concursoId");
                if (concursoId != null && !concursoId.isBlank() && !concursoId.equals(cid)) {
                    continue;
                }
                String sId = (String) map.get("sessionId");
                if (sId != null) {
                    processedSessionIds.add(sId);
                }

                Number dur = (Number) map.getOrDefault("durationSeconds", 0);
                Number pags = (Number) map.getOrDefault("paginasLidas", 0);
                Number qsts = (Number) map.getOrDefault("questoesFeitas", 0);
                Number qAcert = (Number) map.getOrDefault("questoesAcertadas", 0);
                String disc = (String) map.getOrDefault("disciplina", "Geral");
                String activityType = (String) map.getOrDefault("activityType", "HE");
                String handoff = (String) map.get("nextSessionHandoff");
                if (handoff != null && !handoff.isBlank()) {
                    latestHandoff = handoff;
                }

                long s = dur != null ? dur.longValue() : 0L;
                int q = qsts != null ? qsts.intValue() : 0;
                int a = qAcert != null ? qAcert.intValue() : 0;

                // Se durationSeconds ou questões vierem zeradas, checar respostas da sessão
                if ((s <= 0 || q <= 0) && sId != null && !sId.isBlank()) {
                    List<String> aPayloads = eventStoreRepository.getEventPayloads(sId, "ANSWER_SUBMITTED");
                    long sumMs = 0;
                    int aCount = 0;
                    int aCorr = 0;
                    for (String ap : aPayloads) {
                        try {
                            com.fasterxml.jackson.databind.JsonNode n = objectMapper.readTree(ap);
                            sumMs += n.path("activeTimeMs").asLong(0);
                            aCount++;
                            if (n.path("isCorrect").asBoolean(false)) aCorr++;
                        } catch (Exception ignored) {}
                    }
                    if (aCount > 0) {
                        if (s <= 0) s = Math.max(1L, (long) Math.round(sumMs / 1000.0));
                        if (q <= 0) {
                            q = aCount;
                            a = aCorr;
                        }
                    }
                }

                totalSeconds += s;
                if ("HRE".equalsIgnoreCase(activityType)) {
                    hreSeconds += s;
                } else {
                    heSeconds += s;
                }
                totalPaginas += pags != null ? pags.intValue() : 0;
                totalQuestoes += q;
                totalQuestoesAcertadas += a;

                secondsPorDisciplina.put(disc, secondsPorDisciplina.getOrDefault(disc, 0L) + s);
            } catch (Exception ignored) {}
        }

        // Incorporar sessões de questões em ANSWER_SUBMITTED que não possuam STUDY_SESSION_RECORDED
        List<com.fiscalstudy.backend.domain.EventRecord> allAnswers = eventStoreRepository.getAllEvents("ANSWER_SUBMITTED");
        Map<String, List<com.fiscalstudy.backend.domain.EventRecord>> answersBySession = new HashMap<>();
        for (com.fiscalstudy.backend.domain.EventRecord ar : allAnswers) {
            String sid = ar.getSessionId();
            if (sid != null && !sid.isBlank() && !processedSessionIds.contains(sid)) {
                answersBySession.computeIfAbsent(sid, k -> new ArrayList<>()).add(ar);
            }
        }

        for (Map.Entry<String, List<com.fiscalstudy.backend.domain.EventRecord>> entry : answersBySession.entrySet()) {
            long sessActiveMs = 0;
            int sessCount = 0;
            int sessCorrect = 0;
            String sessDisc = "Geral";

            for (com.fiscalstudy.backend.domain.EventRecord ar : entry.getValue()) {
                sessCount++;
                try {
                    com.fasterxml.jackson.databind.JsonNode n = objectMapper.readTree(ar.getPayloadJson());
                    sessActiveMs += n.path("activeTimeMs").asLong(0);
                    if (n.path("isCorrect").asBoolean(false)) sessCorrect++;
                    if (n.hasNonNull("disciplina") && !n.path("disciplina").asText().isBlank()) {
                        sessDisc = n.path("disciplina").asText();
                    }
                } catch (Exception ignored) {}
            }

            long sessSec = Math.max(1L, (long) Math.round(sessActiveMs / 1000.0));
            totalSeconds += sessSec;
            heSeconds += sessSec;
            totalQuestoes += sessCount;
            totalQuestoesAcertadas += sessCorrect;
            secondsPorDisciplina.put(sessDisc, secondsPorDisciplina.getOrDefault(sessDisc, 0L) + sessSec);
        }

        double hrePercentage = totalSeconds > 0 ? Math.round(((hreSeconds * 100.0) / totalSeconds) * 10.0) / 10.0 : 0.0;
        boolean hreAlert = hrePercentage > 15.0;

        double totalHours = Math.round((totalSeconds / 3600.0) * 10.0) / 10.0;
        double thresholdTargetHours = 3100.0; // Limiar estatístico de aprovação
        double progressTowardsThresholdPct = Math.min(100.0, Math.round(((totalHours / thresholdTargetHours) * 100.0) * 10.0) / 10.0);

        double totalHoursDouble = totalSeconds / 3600.0;
        double avgPagesPerHour = totalHoursDouble > 0 ? Math.round((totalPaginas / totalHoursDouble) * 10.0) / 10.0 : 0.0;
        double avgQuestionsPerHour = totalHoursDouble > 0 ? Math.round((totalQuestoes / totalHoursDouble) * 10.0) / 10.0 : 0.0;
        double overallScorePct = totalQuestoes > 0 ? Math.round(((totalQuestoesAcertadas * 100.0) / totalQuestoes) * 10.0) / 10.0 : 0.0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalSeconds", totalSeconds);
        summary.put("totalHours", totalHours);
        summary.put("thresholdTargetHours", thresholdTargetHours);
        summary.put("progressTowardsThresholdPct", progressTowardsThresholdPct);
        summary.put("avgPagesPerHour", avgPagesPerHour);
        summary.put("avgQuestionsPerHour", avgQuestionsPerHour);
        summary.put("overallScorePct", overallScorePct);
        summary.put("heSeconds", heSeconds);
        summary.put("heHours", Math.round((heSeconds / 3600.0) * 10.0) / 10.0);
        summary.put("hreSeconds", hreSeconds);
        summary.put("hreHours", Math.round((hreSeconds / 3600.0) * 10.0) / 10.0);
        summary.put("hrePercentage", hrePercentage);
        summary.put("hreAlert", hreAlert);
        summary.put("latestHandoff", latestHandoff);
        summary.put("totalPaginas", totalPaginas);
        summary.put("totalQuestoes", totalQuestoes);
        summary.put("secondsPorDisciplina", secondsPorDisciplina);
        return summary;
    }

    public List<Map<String, Object>> getAllStudySessions(String concursoId, String disciplina, String tipo) {
        List<com.fiscalstudy.backend.domain.EventRecord> sessionEvents = eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED");
        List<com.fiscalstudy.backend.domain.EventRecord> annotationEvents = eventStoreRepository.getAllEvents("STUDY_SESSION_ANNOTATION_ADDED");

        // Agrupa anotações por sessionId
        Map<String, List<Map<String, Object>>> annotationsBySession = new HashMap<>();
        for (com.fiscalstudy.backend.domain.EventRecord annRecord : annotationEvents) {
            try {
                Map<String, Object> annMap = objectMapper.readValue(annRecord.getPayloadJson(), Map.class);
                String sId = (String) annMap.get("sessionId");
                if (sId != null) {
                    annMap.put("createdAt", annRecord.getOccurredAt());
                    annotationsBySession.computeIfAbsent(sId, k -> new ArrayList<>()).add(annMap);
                }
            } catch (Exception ignored) {}
        }

        Set<String> recordedSessionIds = new HashSet<>();
        List<Map<String, Object>> result = new ArrayList<>();

        for (com.fiscalstudy.backend.domain.EventRecord event : sessionEvents) {
            try {
                Map<String, Object> map = objectMapper.readValue(event.getPayloadJson(), Map.class);
                String cid = (String) map.get("concursoId");
                if (concursoId != null && !concursoId.isBlank() && !concursoId.equals(cid)) {
                    continue;
                }
                String disc = (String) map.get("disciplina");
                if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase(disc)) {
                    continue;
                }
                String actType = (String) map.get("activityType");
                if (tipo != null && !tipo.isBlank() && !tipo.equalsIgnoreCase(actType)) {
                    continue;
                }

                String sId = (String) map.get("sessionId");
                if (sId != null) {
                    recordedSessionIds.add(sId);
                }

                Number durNum = (Number) map.getOrDefault("durationSeconds", 0);
                Number qFeitasNum = (Number) map.getOrDefault("questoesFeitas", 0);
                long currentSec = durNum != null ? durNum.longValue() : 0L;
                int currentQFeitas = qFeitasNum != null ? qFeitasNum.intValue() : 0;

                // Enriquecer registros com dados de tentativas reais se estiverem com tempo zerado
                if ((currentSec <= 0 || currentQFeitas <= 0) && sId != null && !sId.isBlank()) {
                    List<String> aPayloads = eventStoreRepository.getEventPayloads(sId, "ANSWER_SUBMITTED");
                    long sumMs = 0;
                    int aCount = 0;
                    int aCorr = 0;
                    double cSum = 0.0;
                    for (String ap : aPayloads) {
                        try {
                            com.fasterxml.jackson.databind.JsonNode n = objectMapper.readTree(ap);
                            sumMs += n.path("activeTimeMs").asLong(0);
                            aCount++;
                            if (n.path("isCorrect").asBoolean(false)) aCorr++;
                            cSum += n.path("confidenceLevel").asDouble(3.0);
                        } catch (Exception ignored) {}
                    }
                    if (aCount > 0) {
                        if (currentSec <= 0) {
                            currentSec = Math.max(1L, (long) Math.round(sumMs / 1000.0));
                            map.put("durationSeconds", currentSec);
                        }
                        if (currentQFeitas <= 0) {
                            map.put("questoesFeitas", aCount);
                            map.put("questoesAcertadas", aCorr);
                            map.put("rendimentoPercentual", Math.round(((aCorr * 100.0) / aCount) * 10.0) / 10.0);
                        }
                        if (!map.containsKey("confiancaMedia") || map.get("confiancaMedia") == null) {
                            map.put("confiancaMedia", Math.round((cSum / aCount) * 10.0) / 10.0);
                        }
                    }
                }

                map.put("occurredAt", event.getOccurredAt());
                if (sId != null && annotationsBySession.containsKey(sId)) {
                    map.put("annotations", annotationsBySession.get(sId));
                } else {
                    map.put("annotations", Collections.emptyList());
                }

                result.add(map);
            } catch (Exception ignored) {}
        }

        // Sintetizar sessões de questões em ANSWER_SUBMITTED não registradas em STUDY_SESSION_RECORDED
        if (tipo == null || tipo.isBlank() || "ALL".equalsIgnoreCase(tipo) || "QUESTOES".equalsIgnoreCase(tipo)) {
            List<com.fiscalstudy.backend.domain.EventRecord> allAnswers = eventStoreRepository.getAllEvents("ANSWER_SUBMITTED");
            Map<String, List<com.fiscalstudy.backend.domain.EventRecord>> answersBySession = new LinkedHashMap<>();

            for (com.fiscalstudy.backend.domain.EventRecord ar : allAnswers) {
                String sid = ar.getSessionId();
                if (sid != null && !sid.isBlank() && !recordedSessionIds.contains(sid)) {
                    answersBySession.computeIfAbsent(sid, k -> new ArrayList<>()).add(ar);
                }
            }

            for (Map.Entry<String, List<com.fiscalstudy.backend.domain.EventRecord>> entry : answersBySession.entrySet()) {
                String sid = entry.getKey();
                List<com.fiscalstudy.backend.domain.EventRecord> recs = entry.getValue();
                if (recs.isEmpty()) continue;

                long totalMs = 0;
                int qCount = 0;
                int qCorrect = 0;
                double confSum = 0.0;
                String sessDisc = "Geral";
                String sessTopico = "Resolução de Questões";
                String lastOccurred = recs.get(recs.size() - 1).getOccurredAt();

                for (com.fiscalstudy.backend.domain.EventRecord er : recs) {
                    qCount++;
                    if (er.getOccurredAt() != null && er.getOccurredAt().compareTo(lastOccurred) > 0) {
                        lastOccurred = er.getOccurredAt();
                    }
                    try {
                        com.fasterxml.jackson.databind.JsonNode n = objectMapper.readTree(er.getPayloadJson());
                        totalMs += n.path("activeTimeMs").asLong(0);
                        if (n.path("isCorrect").asBoolean(false)) qCorrect++;
                        confSum += n.path("confidenceLevel").asDouble(3.0);
                        if (n.hasNonNull("disciplina") && !n.path("disciplina").asText().isBlank()) {
                            sessDisc = n.path("disciplina").asText();
                        }
                        if (n.hasNonNull("assunto") && !n.path("assunto").asText().isBlank()) {
                            sessTopico = n.path("assunto").asText();
                        }
                    } catch (Exception ignored) {}
                }

                if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase(sessDisc)) {
                    continue;
                }

                long durSec = Math.max(1L, (long) Math.round(totalMs / 1000.0));
                double rendPct = qCount > 0 ? Math.round(((qCorrect * 100.0) / qCount) * 10.0) / 10.0 : 0.0;
                double confMed = qCount > 0 ? Math.round((confSum / qCount) * 10.0) / 10.0 : 3.0;

                Map<String, Object> synth = new LinkedHashMap<>();
                synth.put("sessionId", sid);
                synth.put("concursoId", concursoId != null ? concursoId : "");
                synth.put("disciplina", sessDisc);
                synth.put("topicoId", sessTopico);
                synth.put("durationSeconds", durSec);
                synth.put("questoesFeitas", qCount);
                synth.put("questoesAcertadas", qCorrect);
                synth.put("rendimentoPercentual", rendPct);
                synth.put("confiancaMedia", confMed);
                synth.put("modo", "BANCO_QUESTOES");
                synth.put("activityType", "QUESTOES");
                synth.put("occurredAt", lastOccurred);
                synth.put("annotations", annotationsBySession.getOrDefault(sid, Collections.emptyList()));

                result.add(synth);
            }
        }

        // Ordena decrescente pela data do evento
        result.sort((a, b) -> {
            String da = (String) a.getOrDefault("occurredAt", "");
            String db = (String) b.getOrDefault("occurredAt", "");
            return db.compareTo(da);
        });

        return result;
    }

    public Map<String, Object> addSessionAnnotation(String sessionId, Map<String, Object> annotationData) {
        String annotationId = UUID.randomUUID().toString();
        Map<String, Object> payload = new LinkedHashMap<>(annotationData);
        payload.put("annotationId", annotationId);
        payload.put("sessionId", sessionId);

        String payloadJson = "{}";
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            logger.error("Falha ao serializar anotação de sessão", e);
        }

        eventStoreRepository.appendEvent(
                "STUDY_SESSION_ANNOTATION_ADDED",
                "STUDY_SESSION",
                sessionId,
                sessionId,
                1,
                "v1",
                payloadJson
        );

        payload.put("status", "ANNOTATION_RECORDED");
        return payload;
    }
}
