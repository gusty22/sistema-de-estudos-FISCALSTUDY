package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.EventRecord;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnalyticsOverviewDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
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

                // Questões anuladas ou sem gabarito verificado são EXCLUÍDAS de domínio, acurácia e calibração pedagógica
                boolean isExcludedFromPedagogy = "ANULADA".equalsIgnoreCase(gabaritoStatus) ||
                                                "AUSENTE".equalsIgnoreCase(gabaritoStatus) || 
                                                "SOB_REVISAO".equalsIgnoreCase(gabaritoStatus) || 
                                                isCorrectNode.isNull();
                if (!isExcludedFromPedagogy) {
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
        String res = "Evidência posterior sobre intervenção: aguardando ciclo subsequente de resoluções para mensurar eficácia.";

        AnalyticsOverviewDTO.DiagnosticGuidanceDTO guidance = new AnalyticsOverviewDTO.DiagnosticGuidanceDTO(
                obs, ind, hip, diag, interv, res
        );

        return new AnalyticsOverviewDTO(
                totalAnswered, evaluatedCount, correctCount, errorCount,
                globalAccuracy, totalActiveTimeMs, avgTimeMs,
                overconfidenceCount, underconfidenceCount, wellCalibratedCount,
                byDiscipline, guidance
        );
    }

    public String exportCsv() {
        return exportCsv("ALL");
    }

    public String exportCsv(String originFilter) {
        List<EventRecord> events = eventStoreRepository.getAllEvents("ANSWER_SUBMITTED");
        StringBuilder sb = new StringBuilder();
        sb.append("question_id,selected_option,is_correct,gabarito_status,confidence_level,active_time_ms,discipline,board,year,topic,assunto,orgao,cargo,event_id,session_id,occurred_at,origin_type,concurso_point\n");

        for (EventRecord event : events) {
            try {
                JsonNode node = objectMapper.readTree(event.getPayloadJson());
                String questionId = node.path("questionId").asText();
                String selectedOption = node.path("selectedOption").asText();
                String gabaritoStatus = node.path("gabaritoStatus").asText("DEFINITIVO");
                JsonNode isCorrectNode = node.path("isCorrect");
                int concursoPoint = node.path("concursoPoint").asInt(0);
                int confidence = node.path("confidenceLevel").asInt();
                long activeTime = node.path("activeTimeMs").asLong();

                // Identificação de proveniência conforme Etapa 2
                JsonNode originNode = node.path("origin");
                String origin;
                if (originNode.isMissingNode() || originNode.isNull() || originNode.asText().isBlank()) {
                    origin = "UNVERIFIED_HISTORICAL";
                } else {
                    origin = originNode.asText();
                }

                // Filtragem de proveniência (ex: exportar apenas REAL_STUDY ou ALL)
                if (originFilter != null && !originFilter.isBlank() && !originFilter.equalsIgnoreCase("ALL")) {
                    if (!origin.equalsIgnoreCase(originFilter.trim())) {
                        continue;
                    }
                }

                Optional<Question> qOpt = questionRepository.findById(questionId);
                String discipline = qOpt.map(Question::getDiscipline).orElse("Geral");
                String board = qOpt.map(Question::getBoard).orElse("IBGP");
                Integer year = qOpt.map(Question::getYear).orElse(2023);
                String topic = qOpt.map(Question::getTopic).filter(t -> !t.isBlank()).orElse("NA");
                String orgao = qOpt.map(Question::getOrgao).filter(o -> !o.isBlank()).orElse("NA");
                String cargo = qOpt.map(Question::getCargo).filter(c -> !c.isBlank()).orElse("NA");

                String isCorrectStr;
                if (isCorrectNode.isNull() || "ANULADA".equalsIgnoreCase(gabaritoStatus) ||
                        "AUSENTE".equalsIgnoreCase(gabaritoStatus) || "SOB_REVISAO".equalsIgnoreCase(gabaritoStatus)) {
                    isCorrectStr = "NA";
                } else {
                    isCorrectStr = String.valueOf(isCorrectNode.asBoolean());
                }

                String eventId = event.getEventId();
                String sessionId = event.getSessionId() != null && !event.getSessionId().isBlank() ? event.getSessionId() : "NA";
                String occurredAt = event.getOccurredAt() != null && !event.getOccurredAt().isBlank() ? event.getOccurredAt() : "NA";

                sb.append(String.format("\"%s\",\"%s\",%s,\"%s\",%d,%d,\"%s\",\"%s\",%d,\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d\n",
                        escapeCsv(questionId),
                        escapeCsv(selectedOption),
                        isCorrectStr,
                        escapeCsv(gabaritoStatus),
                        confidence,
                        activeTime,
                        escapeCsv(discipline != null ? discipline : "Geral"),
                        escapeCsv(board != null ? board : "IBGP"),
                        year != null ? year : 2023,
                        escapeCsv(topic),
                        escapeCsv(topic), // assunto espelha topic para consumo direto pelo adapter.R
                        escapeCsv(orgao),
                        escapeCsv(cargo),
                        escapeCsv(eventId),
                        escapeCsv(sessionId),
                        escapeCsv(occurredAt),
                        escapeCsv(origin),
                        concursoPoint
                ));
            } catch (Exception e) {
                // ignore unparseable record
            }
        }
        return sb.toString();
    }

    public ExportManifestDTO generateExportManifest(String originFilter) {
        String csvData = exportCsv(originFilter);
        return generateExportManifest(originFilter, csvData);
    }

    public ExportManifestDTO generateExportManifest(String originFilter, String csvData) {
        byte[] bytes = csvData.getBytes(StandardCharsets.UTF_8);
        String sha256 = calculateSha256(bytes);

        String[] lines = csvData.split("\r\n|\r|\n");
        int totalRecords = 0;
        int evaluableRecords = 0;
        int nonEvaluableRecords = 0;

        if (lines.length > 1) {
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i];
                if (line.isBlank()) continue;
                totalRecords++;
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                if (parts.length >= 3) {
                    String isCorrectVal = parts[2].trim();
                    if ("NA".equalsIgnoreCase(isCorrectVal) || "null".equalsIgnoreCase(isCorrectVal)) {
                        nonEvaluableRecords++;
                    } else {
                        evaluableRecords++;
                    }
                }
            }
        }

        String declaredOrigin = (originFilter != null && !originFilter.isBlank() && !originFilter.equalsIgnoreCase("ALL"))
                ? originFilter.trim()
                : "MIXED_ORIGINS";

        List<ExportManifestDTO.GeneratedFileDTO> files = List.of(
                new ExportManifestDTO.GeneratedFileDTO(
                        "fiscalstudy_attempts.csv",
                        "text/csv; charset=UTF-8",
                        totalRecords,
                        sha256,
                        bytes.length
                )
        );

        List<String> inclusionCriteria = List.of(
                "Eventos ANSWER_SUBMITTED registrados no log append-only (event_store)",
                "Filtro de proveniência aplicado: " + declaredOrigin,
                "Identificadores canônicos e metadados de questões correlacionados pelo catálogo"
        );

        List<String> exclusionCriteria = List.of(
                "Eventos de ciclo de sessão (STUDY_SESSION_STARTED/ENDED) e apresentação (QUESTION_PRESENTED) são preservados no log mas não constam na tabela de tentativas",
                "Tentativas divergentes do filtro de proveniência declarado são segregadas da exportação",
                "Questões sem gabarito ou anuladas são exportadas com is_correct = NA para preservar rigor metrológico"
        );

        List<String> traceabilityLimitations = List.of(
                "Registros históricos pré-existentes sem tag explícita de proveniência são catalogados como UNVERIFIED_HISTORICAL",
                "Sistema pessoal local-first: não emprega autoridade certificadora externa ou infraestrutura de assinatura digital",
                "O manifesto atesta integridade criptográfica SHA-256 e extração do SQLite local, não constituindo prova de autenticação de identidade pessoal do estudante"
        );

        return new ExportManifestDTO(
                "1.0.0",
                "1.0.0",
                Instant.now().toString(),
                "db/fiscalstudy.db:event_store",
                "default_user",
                true,
                declaredOrigin,
                totalRecords,
                evaluableRecords,
                nonEvaluableRecords,
                files,
                sha256,
                inclusionCriteria,
                exclusionCriteria,
                traceabilityLimitations,
                "OPERATIONAL_DATABASE_EXTRACTION"
        );
    }

    public ExportPackageResult exportPackageToDirectory(Path targetDir, String originFilter) throws java.io.IOException {
        Files.createDirectories(targetDir);
        String csv = exportCsv(originFilter);
        ExportManifestDTO manifest = generateExportManifest(originFilter, csv);

        Path csvPath = targetDir.resolve("fiscalstudy_attempts.csv");
        Files.writeString(csvPath, csv, StandardCharsets.UTF_8);

        Path manifestPath = targetDir.resolve("export_manifest.json");
        String manifestJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest);
        Files.writeString(manifestPath, manifestJson, StandardCharsets.UTF_8);

        return new ExportPackageResult(csvPath, manifestPath, manifest);
    }

    private static String escapeCsv(String value) {
        if (value == null) return "";
        return value.replace("\"", "\"\"");
    }

    private String calculateSha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 digest unavailable", e);
        }
    }

    public static class ExportPackageResult {
        private final Path csvPath;
        private final Path manifestPath;
        private final ExportManifestDTO manifest;

        public ExportPackageResult(Path csvPath, Path manifestPath, ExportManifestDTO manifest) {
            this.csvPath = csvPath;
            this.manifestPath = manifestPath;
            this.manifest = manifest;
        }

        public Path getCsvPath() { return csvPath; }
        public Path getManifestPath() { return manifestPath; }
        public ExportManifestDTO getManifest() { return manifest; }
    }

    private static class DisciplineAccumulator {
        int total = 0;
        int evaluated = 0;
        int correct = 0;
        long totalTimeMs = 0;
        int overconfidenceCount = 0;
    }
}
