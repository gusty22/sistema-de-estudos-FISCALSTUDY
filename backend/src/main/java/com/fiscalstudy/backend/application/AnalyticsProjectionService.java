package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnalyticsOverviewDTO;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AnalyticsProjectionService {

    private final EventStoreRepository eventStoreRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;

    public AnalyticsProjectionService(EventStoreRepository eventStoreRepository, QuestionRepository questionRepository) {
        this.eventStoreRepository = eventStoreRepository;
        this.questionRepository = questionRepository;
        this.objectMapper = new ObjectMapper();
    }

    public AnalyticsOverviewDTO computeOverview() {
        List<String> payloads = eventStoreRepository.getAllEventPayloads("ANSWER_SUBMITTED");
        int totalAnswered = payloads.size();

        if (totalAnswered == 0) {
            AnalyticsOverviewDTO.DiagnosticGuidanceDTO emptyGuidance = new AnalyticsOverviewDTO.DiagnosticGuidanceDTO(
                "Nenhum evento de resposta registrado até o momento.",
                "Métricas zeradas.",
                "Sem dados para inferência.",
                "Amostra inexistente para diagnóstico.",
                "Iniciar primeira sessão de estudos."
            );
            return new AnalyticsOverviewDTO(0, 0, 0, 0, 0.0, 0L, 0.0, 0, 0, 0, Collections.emptyMap(), emptyGuidance);
        }

        int evaluatedCount = 0;
        int correctCount = 0;
        int errorCount = 0;
        long totalActiveTimeMs = 0;
        int overconfidenceCount = 0;
        int underconfidenceCount = 0;
        int wellCalibratedCount = 0;

        Map<String, DisciplineAccumulator> disciplineMap = new HashMap<>();

        for (String p : payloads) {
            try {
                JsonNode node = objectMapper.readTree(p);
                String questionId = node.path("questionId").asText();
                String gabaritoStatus = node.path("gabaritoStatus").asText("DEFINITIVO");
                JsonNode isCorrectNode = node.path("isCorrect");
                int confidence = node.path("confidenceLevel").asInt();
                long activeTime = node.path("activeTimeMs").asLong();

                totalActiveTimeMs += activeTime;

                // Obter metadados da questão
                Optional<Question> qOpt = questionRepository.findById(questionId);
                String discipline = qOpt.map(Question::getDiscipline).orElse("Geral");
                if (discipline == null || discipline.isBlank()) discipline = "Geral";

                DisciplineAccumulator acc = disciplineMap.computeIfAbsent(discipline, k -> new DisciplineAccumulator());
                acc.total++;
                acc.totalTimeMs += activeTime;

                if (!"AUSENTE".equalsIgnoreCase(gabaritoStatus) && !isCorrectNode.isNull()) {
                    evaluatedCount++;
                    boolean isCorrect = isCorrectNode.asBoolean();
                    acc.evaluated++;

                    if (isCorrect) {
                        correctCount++;
                        acc.correct++;
                        if (confidence <= 2) {
                            underconfidenceCount++;
                        } else if (confidence >= 4) {
                            wellCalibratedCount++;
                        }
                    } else {
                        errorCount++;
                        if (confidence == 5) {
                            overconfidenceCount++;
                            acc.overconfidenceCount++;
                        } else if (confidence <= 2) {
                            wellCalibratedCount++;
                        }
                    }
                }
            } catch (Exception e) {
                // ignore unparseable payload
            }
        }

        double globalAccuracy = evaluatedCount > 0 ? ((double) correctCount / evaluatedCount * 100.0) : 0.0;
        double avgTimeMs = totalAnswered > 0 ? ((double) totalActiveTimeMs / totalAnswered) : 0.0;

        Map<String, AnalyticsOverviewDTO.DisciplineStatDTO> byDiscipline = new HashMap<>();
        String lowestDiscipline = null;
        double lowestAccuracy = 101.0;

        for (Map.Entry<String, DisciplineAccumulator> entry : disciplineMap.entrySet()) {
            DisciplineAccumulator a = entry.getValue();
            double accRate = a.evaluated > 0 ? ((double) a.correct / a.evaluated * 100.0) : 0.0;
            double discAvgTime = a.total > 0 ? ((double) a.totalTimeMs / a.total) : 0.0;

            byDiscipline.put(entry.getKey(), new AnalyticsOverviewDTO.DisciplineStatDTO(
                a.total, a.evaluated, a.correct, accRate, discAvgTime, a.overconfidenceCount
            ));

            if (a.evaluated >= 3 && accRate < lowestAccuracy) {
                lowestAccuracy = accRate;
                lowestDiscipline = entry.getKey();
            }
        }

        String obs = String.format("Registradas %d tentativas (%d avaliadas com gabarito oficial) distribuídas em %d disciplinas.",
                totalAnswered, evaluatedCount, byDiscipline.size());
        String ind = String.format("Acurácia global de %.1f%%. Tempo médio de %.1fs por item. Falsa fluência (overconfidence) em %d itens.",
                globalAccuracy, avgTimeMs / 1000.0, overconfidenceCount);
        String hip = lowestDiscipline != null 
                ? String.format("A disciplina '%s' apresentou menor rendimento (%.1f%%), sugerindo necessidade de consolidação conceitual.", lowestDiscipline, lowestAccuracy)
                : "Rendimento homogêneo entre as disciplinas observadas.";
        String diag = evaluatedCount < 30
                ? "Volume amostral preliminar reduzido (N < 30). Diagnóstico determinístico prudente: evidências insuficientes para modelagem psicométrica definitiva."
                : "Volume amostral satisfatório para inferência de padrões de desempenho na V1.";
        String interv = overconfidenceCount > 0
                ? "Revisar itens onde houve confiança máxima e erro para corrigir falsas certezas antes de avançar para novos blocos."
                : "Manter ciclo contínuo de resolução determinística por blocos de questões.";

        AnalyticsOverviewDTO.DiagnosticGuidanceDTO guidance = new AnalyticsOverviewDTO.DiagnosticGuidanceDTO(
                obs, ind, hip, diag, interv
        );

        return new AnalyticsOverviewDTO(
                totalAnswered, evaluatedCount, correctCount, errorCount,
                globalAccuracy, totalActiveTimeMs, avgTimeMs,
                overconfidenceCount, underconfidenceCount, wellCalibratedCount,
                byDiscipline, guidance
        );
    }

    public String exportCsv() {
        List<String> payloads = eventStoreRepository.getAllEventPayloads("ANSWER_SUBMITTED");
        StringBuilder sb = new StringBuilder();
        sb.append("question_id,selected_option,is_correct,gabarito_status,confidence_level,active_time_ms,discipline,board,year\n");

        for (String p : payloads) {
            try {
                JsonNode node = objectMapper.readTree(p);
                String questionId = node.path("questionId").asText();
                String selectedOption = node.path("selectedOption").asText();
                String gabaritoStatus = node.path("gabaritoStatus").asText("DEFINITIVO");
                JsonNode isCorrectNode = node.path("isCorrect");
                String isCorrectStr = isCorrectNode.isNull() ? "NA" : String.valueOf(isCorrectNode.asBoolean());
                int confidence = node.path("confidenceLevel").asInt();
                long activeTime = node.path("activeTimeMs").asLong();

                Optional<Question> qOpt = questionRepository.findById(questionId);
                String discipline = qOpt.map(Question::getDiscipline).orElse("Geral");
                String board = qOpt.map(Question::getBoard).orElse("IBGP");
                Integer year = qOpt.map(Question::getYear).orElse(2023);

                sb.append(String.format("\"%s\",\"%s\",%s,\"%s\",%d,%d,\"%s\",\"%s\",%d\n",
                        questionId, selectedOption, isCorrectStr, gabaritoStatus, confidence, activeTime,
                        discipline != null ? discipline : "Geral",
                        board != null ? board : "IBGP",
                        year != null ? year : 2023));
            } catch (Exception e) {
                // ignore
            }
        }
        return sb.toString();
    }

    private static class DisciplineAccumulator {
        int total = 0;
        int evaluated = 0;
        int correct = 0;
        long totalTimeMs = 0;
        int overconfidenceCount = 0;
    }
}
