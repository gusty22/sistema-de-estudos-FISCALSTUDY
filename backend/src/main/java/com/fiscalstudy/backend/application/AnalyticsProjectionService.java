package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnalyticsOverviewDTO;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

@Service
public class AnalyticsProjectionService {

    private final EventStoreRepository eventStoreRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;
    private final com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths analyticsPaths;

    public AnalyticsProjectionService(EventStoreRepository eventStoreRepository, QuestionRepository questionRepository) {
        this(eventStoreRepository,questionRepository,null);
    }
    @org.springframework.beans.factory.annotation.Autowired
    public AnalyticsProjectionService(EventStoreRepository eventStoreRepository, QuestionRepository questionRepository,
            com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths analyticsPaths) {
        this.eventStoreRepository = eventStoreRepository;
        this.questionRepository = questionRepository;
        this.objectMapper = new ObjectMapper();
        this.analyticsPaths = analyticsPaths;
    }

    public AnalyticsOverviewDTO computeOverview() {
        List<String> payloads = eventStoreRepository.getAllEventPayloads("ANSWER_SUBMITTED").stream().filter(p -> { try { return "REAL_STUDY".equals(objectMapper.readTree(p).path("origin").asText()); } catch(Exception e) { return false; } }).toList();
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
                : "Amostra observacional: volume isolado não comprova estabilidade, transferência ou eficácia pedagógica.";
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

    public String exportCsv(String originFilter) {
        return exportCsv(originFilter, eventStoreRepository.getMaxRowid());
    }

    public String exportCsv(String originFilter, long maxRowid) {
        List<com.fiscalstudy.backend.domain.EventRecord> events = eventStoreRepository.getEventsUpTo("ANSWER_SUBMITTED", maxRowid);

        StringBuilder sb = new StringBuilder();
        sb.append("question_id,selected_option,is_correct,gabarito_status,confidence_level,active_time_ms,discipline,board,year,topic,assunto,orgao,cargo,event_id,session_id,occurred_at,origin_type,concurso_point,fsrs_retrievability_pre_update,fsrs_prediction_timestamp,fsrs_model_version,fsrs_evidence_status\n");

        for (com.fiscalstudy.backend.domain.EventRecord event : events) {
            try {
                JsonNode node = objectMapper.readTree(event.getPayloadJson());
                String questionId = node.path("questionId").asText();
                String selectedOption = node.path("selectedOption").asText();
                String gabaritoStatus = node.path("gabaritoStatus").asText("DEFINITIVO");
                JsonNode isCorrectNode = node.path("isCorrect");
                int confidence = node.path("confidenceLevel").asInt();
                long activeTime = node.path("activeTimeMs").asLong();
                int concursoPoint = node.path("concursoPoint").asInt(0);
                JsonNode memoryPrediction = node.path("memoryPrediction");
                String fsrsRetrievability = memoryPrediction.path("recallBefore").isNumber()
                        ? memoryPrediction.path("recallBefore").asText() : "";
                String fsrsPredictionTimestamp = memoryPrediction.path("predictedAt").asText("");
                String fsrsModelVersion = memoryPrediction.path("modelVersion").asText("");
                String fsrsEvidenceStatus = memoryPrediction.path("evidenceStatus").asText("");

                String origin = node.has("origin") && !node.path("origin").asText().isBlank()
                        ? node.path("origin").asText().trim()
                        : com.fiscalstudy.backend.domain.EventOrigin.UNVERIFIED_HISTORICAL.name();

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

                sb.append(String.format("\"%s\",\"%s\",%s,\"%s\",%d,%d,\"%s\",\"%s\",%d,\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d,%s,\"%s\",\"%s\",\"%s\"\n",
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
                        concursoPoint,
                        fsrsRetrievability,
                        escapeCsv(fsrsPredictionTimestamp),
                        escapeCsv(fsrsModelVersion),
                        escapeCsv(fsrsEvidenceStatus)
                ));
            } catch (Exception e) {
                // ignore unparseable record
            }
        }
        return sb.toString();
    }

    public String exportQuestionsV1Csv(String originFilter) {
        return exportQuestionsV1Csv(originFilter, eventStoreRepository.getMaxRowid());
    }

    public String exportQuestionsV1Csv(String originFilter, Long maxRowid) {
        long effectiveMaxRowid = maxRowid != null ? maxRowid : eventStoreRepository.getMaxRowid();
        List<com.fiscalstudy.backend.domain.EventRecord> events = eventStoreRepository.getEventsUpTo("ANSWER_SUBMITTED", effectiveMaxRowid);

        List<AttemptItem> attempts = new ArrayList<>();
        for (com.fiscalstudy.backend.domain.EventRecord event : events) {
            try {
                JsonNode node = objectMapper.readTree(event.getPayloadJson());
                String origin = node.has("origin") && !node.path("origin").asText().isBlank()
                        ? node.path("origin").asText().trim()
                        : com.fiscalstudy.backend.domain.EventOrigin.UNVERIFIED_HISTORICAL.name();

                if (originFilter != null && !originFilter.isBlank() && !originFilter.equalsIgnoreCase("ALL")) {
                    if (!origin.equalsIgnoreCase(originFilter.trim())) {
                        continue;
                    }
                }

                String questionId = node.path("questionId").asText();
                String selectedOption = node.path("selectedOption").asText();
                String gabaritoStatus = node.path("gabaritoStatus").asText("DEFINITIVO");
                JsonNode isCorrectNode = node.path("isCorrect");
                int confidence = node.path("confidenceLevel").asInt(3);
                long activeTime = node.path("activeTimeMs").asLong(0);
                int concursoPoint = node.path("concursoPoint").asInt(0);

                Optional<Question> qOpt = questionRepository.findById(questionId);
                String discipline = qOpt.map(Question::getDiscipline).orElse("Geral");
                String board = qOpt.map(Question::getBoard).orElse("IBGP");
                String topic = qOpt.map(Question::getTopic).filter(t -> !t.isBlank()).orElse("Geral");
                String officialOption = qOpt.map(Question::getCorrectOption).orElse("NA");

                String isCorrectStr;
                String ynStr;
                if (isCorrectNode.isNull() || "ANULADA".equalsIgnoreCase(gabaritoStatus) ||
                        "AUSENTE".equalsIgnoreCase(gabaritoStatus) || "SOB_REVISAO".equalsIgnoreCase(gabaritoStatus)) {
                    isCorrectStr = "NA";
                    ynStr = "NA";
                } else {
                    boolean correct = isCorrectNode.asBoolean();
                    isCorrectStr = String.valueOf(correct);
                    ynStr = correct ? "1" : "0";
                }

                Instant occurredAtInstant;
                try {
                    occurredAtInstant = Instant.parse(event.getOccurredAt());
                } catch (Exception ex) {
                    occurredAtInstant = Instant.EPOCH;
                }

                attempts.add(new AttemptItem(
                        event.getEventId(),
                        questionId,
                        event.getSessionId() != null ? event.getSessionId() : "NA",
                        discipline != null ? discipline : "Geral",
                        topic != null ? topic : "Geral",
                        event.getOccurredAt() != null ? event.getOccurredAt() : "NA",
                        occurredAtInstant,
                        confidence,
                        selectedOption,
                        officialOption,
                        gabaritoStatus,
                        isCorrectStr,
                        ynStr,
                        activeTime,
                        activeTime < 1000,
                        0.50,
                        board != null ? board : "IBGP",
                        origin,
                        concursoPoint
                ));
            } catch (Exception ignored) {}
        }

        attempts.sort(Comparator.comparing(a -> a.occurredAt));

        StringBuilder sb = new StringBuilder();
        sb.append("attempt_id,question_id,session_id,discipline,topic,occurred_at,attempt_index_topic,delta_t_hours,delta_t_days,prev_confidence_level,confidence_level,selected_option,official_option,gabarito_status,is_correct,y_n,active_time_ms,is_noise_filtered,topic_difficulty_prior,board,origin_type,concurso_point\n");

        Map<String, TopicTemporalState> topicStates = new HashMap<>();

        for (AttemptItem att : attempts) {
            String topicKey = (att.discipline + ":::" + att.topic).toLowerCase().trim();
            TopicTemporalState state = topicStates.computeIfAbsent(topicKey, k -> new TopicTemporalState());
            state.attemptIndex++;

            double deltaHours = 0.0;
            double deltaDays = 0.0;
            String prevConfStr = "NA";

            if (state.lastOccurredAt != null) {
                long diffMs = Math.max(0, att.occurredAt.toEpochMilli() - state.lastOccurredAt.toEpochMilli());
                deltaHours = diffMs / 3600000.0;
                deltaDays = deltaHours / 24.0;
                prevConfStr = state.lastConfidence != null ? String.valueOf(state.lastConfidence) : "NA";
            }

            state.lastOccurredAt = att.occurredAt;
            state.lastConfidence = att.confidenceLevel;

            sb.append(String.format(Locale.US, "\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d,%.2f,%.4f,%s,%d,\"%s\",\"%s\",\"%s\",%s,%s,%d,%b,%.2f,\"%s\",\"%s\",%d\n",
                    escapeCsv(att.attemptId),
                    escapeCsv(att.questionId),
                    escapeCsv(att.sessionId),
                    escapeCsv(att.discipline),
                    escapeCsv(att.topic),
                    escapeCsv(att.occurredAtStr),
                    state.attemptIndex,
                    deltaHours,
                    deltaDays,
                    prevConfStr,
                    att.confidenceLevel,
                    escapeCsv(att.selectedOption),
                    escapeCsv(att.officialOption),
                    escapeCsv(att.gabaritoStatus),
                    att.isCorrectStr,
                    att.ynStr,
                    att.activeTimeMs,
                    att.isNoiseFiltered,
                    att.topicDifficultyPrior,
                    escapeCsv(att.board),
                    escapeCsv(att.originType),
                    att.concursoPoint
            ));
        }

        return sb.toString();
    }

    public String exportEventsV1Csv(String eventTypeFilter, Long maxRowid) {
        long effectiveMaxRowid = maxRowid != null ? maxRowid : eventStoreRepository.getMaxRowid();
        List<com.fiscalstudy.backend.domain.EventRecord> events = (eventTypeFilter != null && !eventTypeFilter.isBlank() && !eventTypeFilter.equalsIgnoreCase("ALL"))
                ? eventStoreRepository.getEventsUpTo(eventTypeFilter, effectiveMaxRowid)
                : eventStoreRepository.getAllEvents();

        StringBuilder sb = new StringBuilder();
        sb.append("rowid,event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json\n");

        int rowidCounter = 1;
        for (com.fiscalstudy.backend.domain.EventRecord ev : events) {
            sb.append(String.format("%d,\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d,\"%s\",\"%s\"\n",
                    rowidCounter++,
                    escapeCsv(ev.getEventId()),
                    escapeCsv(ev.getEventType()),
                    escapeCsv(ev.getAggregateType()),
                    escapeCsv(ev.getAggregateId()),
                    escapeCsv(ev.getSessionId() != null ? ev.getSessionId() : "NA"),
                    escapeCsv(ev.getOccurredAt()),
                    escapeCsv(ev.getRecordedAt()),
                    ev.getEventVersion(),
                    escapeCsv(ev.getSchemaVersion()),
                    escapeCsv(ev.getPayloadJson())
            ));
        }
        return sb.toString();
    }

    public Map<String, String> exportSyncToLocal(String customTargetDir, String originFilter) {
        Map<String, String> results = new LinkedHashMap<>();
        try {
            String questionsCsv = exportQuestionsV1Csv(originFilter, null);
            String eventsCsv = exportEventsV1Csv(null, null);

            // 1. Salvar somente na saída analytics configurada para esta instalação
            Path localAnalyticsDir = Objects.requireNonNull(analyticsPaths,"Analytics output must be configured").output();
            Files.createDirectories(localAnalyticsDir);
            Path qPath = localAnalyticsDir.resolve("questions_v1.csv");
            Path ePath = localAnalyticsDir.resolve("events_v1.csv");
            Files.writeString(qPath, questionsCsv, java.nio.charset.StandardCharsets.UTF_8);
            Files.writeString(ePath, eventsCsv, java.nio.charset.StandardCharsets.UTF_8);
            results.put("analytics_questions_v1", qPath.toAbsolutePath().toString());
            results.put("analytics_events_v1", ePath.toAbsolutePath().toString());

            // 2. Salvar em diretórios adicionais configurados
            List<String> targetDirs = new ArrayList<>();
            if (customTargetDir != null && !customTargetDir.isBlank()) {
                targetDirs.add(customTargetDir);
            }

            for (String tDir : targetDirs) {
                try {
                    Path dir = Paths.get(tDir);
                    if (Files.exists(dir) || dir.toFile().mkdirs()) {
                        Path tQ = dir.resolve("questions_v1.csv");
                        Path tE = dir.resolve("events_v1.csv");
                        Files.writeString(tQ, questionsCsv, java.nio.charset.StandardCharsets.UTF_8);
                        Files.writeString(tE, eventsCsv, java.nio.charset.StandardCharsets.UTF_8);
                        results.put("external_sync_" + dir.getFileName(), tQ.toAbsolutePath().toString());
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            results.put("error", e.getMessage());
        }
        return results;
    }

    public com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO generateExportManifest(String originFilter) {
        long maxRowid = eventStoreRepository.getMaxRowid();
        return generateExportManifest(originFilter, maxRowid);
    }

    public com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO generateExportManifest(String originFilter, long maxRowid) {
        String csvData = exportCsv(originFilter, maxRowid);
        return generateExportManifest(originFilter, maxRowid, csvData);
    }

    public com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO generateExportManifest(String originFilter, long maxRowid, String csvData) {
        byte[] bytes = csvData.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String sha256 = calculateSha256(bytes);

        String[] lines = csvData.split("\r\n|\r|\n");
        int totalRecords = 0;
        int evaluableRecords = 0;
        int nonEvaluableRecords = 0;
        Map<String, Integer> recordsByOrigin = new HashMap<>();

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
                if (parts.length >= 17) {
                    String originVal = parts[16].replace("\"", "").trim();
                    recordsByOrigin.merge(originVal, 1, Integer::sum);
                }
            }
        }

        String declaredOrigin = (originFilter != null && !originFilter.isBlank() && !originFilter.equalsIgnoreCase("ALL"))
                ? originFilter.trim()
                : "MIXED_ORIGINS";

        List<com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO.GeneratedFileDTO> files = List.of(
                new com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO.GeneratedFileDTO(
                        "fiscalstudy_attempts.csv",
                        "text/csv; charset=UTF-8",
                        totalRecords,
                        sha256,
                        bytes.length
                )
        );

        List<String> inclusionCriteria = List.of(
                "Eventos ANSWER_SUBMITTED registrados no log append-only (event_store) com rowid <= " + maxRowid,
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
                "O manifesto atesta integridade criptográfica SHA-256 sobre bytes entregues e extração do SQLite local, não constituindo prova de autenticação de identidade pessoal do estudante"
        );

        return new com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO(
                "1.1.0",
                "1.1.0",
                java.time.Instant.now().toString(),
                "db/fiscalstudy.db:event_store",
                "default_user",
                true,
                "REAL_STUDY",
                originFilter != null ? originFilter : "ALL",
                declaredOrigin,
                maxRowid,
                totalRecords,
                evaluableRecords,
                nonEvaluableRecords,
                recordsByOrigin,
                files,
                "SHA-256",
                sha256,
                inclusionCriteria,
                exclusionCriteria,
                traceabilityLimitations,
                "OPERATIONAL_DATABASE_EXTRACTION"
        );
    }

    public ExportPackageResult exportPackageToDirectory(java.nio.file.Path targetDir, String originFilter) throws java.io.IOException {
        java.nio.file.Files.createDirectories(targetDir);
        long snapshotRowid = eventStoreRepository.getMaxRowid();
        String csv = exportCsv(originFilter, snapshotRowid);
        com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO manifest = generateExportManifest(originFilter, snapshotRowid, csv);

        java.nio.file.Path csvPath = targetDir.resolve("fiscalstudy_attempts.csv");
        java.nio.file.Files.writeString(csvPath, csv, java.nio.charset.StandardCharsets.UTF_8);

        java.nio.file.Path manifestPath = targetDir.resolve("export_manifest.json");
        String manifestJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest);
        java.nio.file.Files.writeString(manifestPath, manifestJson, java.nio.charset.StandardCharsets.UTF_8);

        return new ExportPackageResult(csvPath, manifestPath, manifest);
    }

    public static String escapeCsv(String value) {
        if (value == null) return "";
        return value.replace("\"", "\"\"");
    }

    public String calculateSha256(byte[] data) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data);
            return java.util.HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 digest unavailable", e);
        }
    }

    public static class ExportPackageResult {
        private final java.nio.file.Path csvPath;
        private final java.nio.file.Path manifestPath;
        private final com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO manifest;

        public ExportPackageResult(java.nio.file.Path csvPath, java.nio.file.Path manifestPath, com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO manifest) {
            this.csvPath = csvPath;
            this.manifestPath = manifestPath;
            this.manifest = manifest;
        }

        public java.nio.file.Path getCsvPath() { return csvPath; }
        public java.nio.file.Path getManifestPath() { return manifestPath; }
        public com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO getManifest() { return manifest; }
    }

    private static class DisciplineAccumulator {
        int total = 0;
        int evaluated = 0;
        int correct = 0;
        long totalTimeMs = 0;
        int overconfidenceCount = 0;
    }

    private static class AttemptItem {
        final String attemptId;
        final String questionId;
        final String sessionId;
        final String discipline;
        final String topic;
        final String occurredAtStr;
        final Instant occurredAt;
        final int confidenceLevel;
        final String selectedOption;
        final String officialOption;
        final String gabaritoStatus;
        final String isCorrectStr;
        final String ynStr;
        final long activeTimeMs;
        final boolean isNoiseFiltered;
        final double topicDifficultyPrior;
        final String board;
        final String originType;
        final int concursoPoint;

        public AttemptItem(String attemptId, String questionId, String sessionId, String discipline, String topic,
                           String occurredAtStr, Instant occurredAt, int confidenceLevel, String selectedOption,
                           String officialOption, String gabaritoStatus, String isCorrectStr, String ynStr,
                           long activeTimeMs, boolean isNoiseFiltered, double topicDifficultyPrior,
                           String board, String originType, int concursoPoint) {
            this.attemptId = attemptId;
            this.questionId = questionId;
            this.sessionId = sessionId;
            this.discipline = discipline;
            this.topic = topic;
            this.occurredAtStr = occurredAtStr;
            this.occurredAt = occurredAt;
            this.confidenceLevel = confidenceLevel;
            this.selectedOption = selectedOption;
            this.officialOption = officialOption;
            this.gabaritoStatus = gabaritoStatus;
            this.isCorrectStr = isCorrectStr;
            this.ynStr = ynStr;
            this.activeTimeMs = activeTimeMs;
            this.isNoiseFiltered = isNoiseFiltered;
            this.topicDifficultyPrior = topicDifficultyPrior;
            this.board = board;
            this.originType = originType;
            this.concursoPoint = concursoPoint;
        }
    }

    private static class TopicTemporalState {
        int attemptIndex = 0;
        Instant lastOccurredAt = null;
        Integer lastConfidence = null;
    }
}
