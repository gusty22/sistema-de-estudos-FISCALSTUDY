package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class IngestionPipelineService {

    private static final Logger logger = LoggerFactory.getLogger(IngestionPipelineService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EditalRepository editalRepository;
    private final ObjectMapper objectMapper;
    private final Path stagingRoot;

    // Sessões ativas em memória com persistência local em stagingRoot
    private final Map<String, StagingSessionDTO> sessions = new ConcurrentHashMap<>();
    private final Map<String, List<StagingQuestionDTO>> sessionQuestions = new ConcurrentHashMap<>();
    private final Map<String, Process> runningProcesses = new ConcurrentHashMap<>();

    public IngestionPipelineService(JdbcTemplate jdbcTemplate) {
        this(jdbcTemplate, null);
    }

    @Autowired
    public IngestionPipelineService(JdbcTemplate jdbcTemplate, @Autowired(required = false) EditalRepository editalRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.editalRepository = editalRepository;
        this.objectMapper = new ObjectMapper();
        this.stagingRoot = Paths.get("target", "staging_pipeline").toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.stagingRoot);
        } catch (IOException e) {
            logger.error("Failed to create staging root directory", e);
        }
    }

    public StagingSessionDTO createSession(Map<String, Object> metadata) {
        String sessionId = UUID.randomUUID().toString();
        StagingSessionDTO session = new StagingSessionDTO(sessionId, "PENDING", "Sessão de importação criada");
        session.setMetadata(metadata != null ? metadata : new HashMap<>());
        session.setDocuments(new ArrayList<>());
        session.setSummary(new HashMap<>());

        Path sessionDir = stagingRoot.resolve(sessionId);
        try {
            Files.createDirectories(sessionDir);
            Files.createDirectories(sessionDir.resolve("uploads"));
            Files.createDirectories(sessionDir.resolve("output"));
        } catch (IOException e) {
            logger.error("Error creating session directory for {}", sessionId, e);
        }

        sessions.put(sessionId, session);
        sessionQuestions.put(sessionId, new ArrayList<>());
        saveSessionState(sessionId);
        return session;
    }

    public StagingSessionDTO.StagingDocumentDTO uploadFile(String sessionId, MultipartFile file, String role) throws IOException {
        StagingSessionDTO session = getSession(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Sessão não encontrada: " + sessionId);
        }

        if (file.isEmpty()) {
            throw new IllegalArgumentException("Arquivo vazio não é permitido.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "upload_" + System.currentTimeMillis();
        }

        // Sanitização de nome de arquivo contra Directory Traversal
        String safeName = Paths.get(originalFilename).getFileName().toString().replaceAll("[^a-zA-Z0-9._-]", "_");
        String ext = "";
        int dotIdx = safeName.lastIndexOf('.');
        if (dotIdx != -1) {
            ext = safeName.substring(dotIdx).toLowerCase();
        }

        if (!Arrays.asList(".pdf", ".png", ".jpg", ".jpeg", ".txt").contains(ext)) {
            throw new IllegalArgumentException("Formato não suportado: " + ext);
        }

        String docId = UUID.randomUUID().toString();
        Path sessionUploads = stagingRoot.resolve(sessionId).resolve("uploads");
        Path targetPath = sessionUploads.resolve(docId + "_" + safeName);

        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        StagingSessionDTO.StagingDocumentDTO docDto = new StagingSessionDTO.StagingDocumentDTO(
                docId,
                originalFilename,
                role != null ? role : "PROVA",
                file.getSize(),
                ext.replace(".", "").toUpperCase()
        );

        session.getDocuments().add(docDto);
        session.setStepDescription("Arquivo " + originalFilename + " recebido com segurança (" + file.getSize() + " bytes)");
        saveSessionState(sessionId);
        return docDto;
    }

    public StagingSessionDTO runProcessing(String sessionId) {
        StagingSessionDTO session = getSession(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Sessão não encontrada: " + sessionId);
        }

        session.setStatus("INSPECTING");
        session.setStepDescription("Iniciando inspeção e análise documental");
        session.setProgressPercent(10);

        Path sessionDir = stagingRoot.resolve(sessionId);
        Path uploadsDir = sessionDir.resolve("uploads");
        Path outputDir = sessionDir.resolve("output");

        // Localiza prova, gabarito e edital nos uploads priorizando o papel (role) declarado
        File examFile = null;
        File answerKeyFile = null;
        File editalFile = null;

        if (session.getDocuments() != null && !session.getDocuments().isEmpty()) {
            for (StagingSessionDTO.StagingDocumentDTO doc : session.getDocuments()) {
                String role = doc.getRole() != null ? doc.getRole().toUpperCase() : "";
                // Localizar arquivo físico correspondente na pasta de uploads
                File[] matchingFiles = uploadsDir.toFile().listFiles((dir, name) -> name.startsWith(doc.getId()));
                File physical = (matchingFiles != null && matchingFiles.length > 0) ? matchingFiles[0] : null;
                if (physical == null || !physical.exists()) continue;

                if (role.contains("GAB")) {
                    answerKeyFile = physical;
                } else if (role.contains("EDITAL") || role.contains("ANEXO")) {
                    editalFile = physical;
                } else if (role.contains("PROVA") || role.contains("EXAM")) {
                    examFile = physical;
                }
            }
        }

        // Fallback heurístico caso os papéis não tenham sido declarados
        if (examFile == null || answerKeyFile == null) {
            File[] files = uploadsDir.toFile().listFiles();
            if (files != null) {
                for (File f : files) {
                    String fname = f.getName().toLowerCase();
                    if (answerKeyFile == null && (fname.contains("gabarito") || fname.contains("gab_def") || fname.contains("gab"))) {
                        answerKeyFile = f;
                    } else if (editalFile == null && (fname.contains("edital") || fname.contains("anexo") || fname.contains("conteudo"))) {
                        editalFile = f;
                    } else if (examFile == null && fname.endsWith(".pdf") && !fname.contains("edital") && !fname.contains("gabarito")) {
                        examFile = f;
                    }
                }
            }
        }

        if (examFile == null && editalFile != null) {
            session.setStatus("FAILED");
            session.setErrorMessage("Foi recebido um edital, mas nenhuma prova foi selecionada para extração de questões. Para verticalizar o edital, utilize o módulo de Edital.");
            saveSessionState(sessionId);
            return session;
        }

        if (examFile == null) {
            session.setStatus("FAILED");
            session.setErrorMessage("Nenhum arquivo de prova válido encontrado na sessão para processamento.");
            saveSessionState(sessionId);
            return session;
        }

        String cargoCodigo = "532";
        if (session.getMetadata() != null && session.getMetadata().containsKey("cargo_codigo")) {
            cargoCodigo = String.valueOf(session.getMetadata().get("cargo_codigo"));
        }

        session.setStatus("EXTRACTING");
        session.setStepDescription("Executando extração nativa e análise de layout geométrico");
        session.setProgressPercent(40);
        saveSessionState(sessionId);

        // Executar pipeline python com timeout seguro e captura UTF-8
        Process process = null;
        try {
            String pythonPath = findPythonExecutable();
            File ingestionDir = findIngestionDir();

            Path metadataFile = sessionDir.resolve("metadata.json");
            objectMapper.writeValue(metadataFile.toFile(), session.getMetadata());

            List<String> command = new ArrayList<>();
            command.add(pythonPath);
            command.add("-m");
            command.add("src.pipeline.pipeline_runner");
            command.add("--exam");
            command.add(examFile.getAbsolutePath());
            if (answerKeyFile != null) {
                command.add("--answer-key");
                command.add(answerKeyFile.getAbsolutePath());
            }
            command.add("--cargo-code");
            command.add(cargoCodigo);
            command.add("--output-dir");
            command.add(outputDir.toAbsolutePath().toString());
            command.add("--metadata-file");
            command.add(metadataFile.toAbsolutePath().toString());

            logger.info("Executing pipeline command: {}", String.join(" ", command));

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(ingestionDir);
            pb.redirectErrorStream(true);

            process = pb.start();
            runningProcesses.put(sessionId, process);

            boolean finished = process.waitFor(180, java.util.concurrent.TimeUnit.SECONDS);
            runningProcesses.remove(sessionId);

            if (!finished) {
                process.destroyForcibly();
                session.setStatus("FAILED");
                session.setErrorMessage("Tempo limite excedido: o processamento da prova ultrapassou 180 segundos e foi abortado com segurança.");
                saveSessionState(sessionId);
                return session;
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                String errorOut = new String(process.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                logger.error("Pipeline process failed (exit code {}): {}", exitCode, errorOut);
                session.setStatus("FAILED");
                session.setErrorMessage("Falha no pipeline de extração (código " + exitCode + "): " + errorOut);
                saveSessionState(sessionId);
                return session;
            }

            // Ler pipeline_result.json gerado
            Path resultJsonPath = outputDir.resolve("pipeline_result.json");
            if (!Files.exists(resultJsonPath)) {
                session.setStatus("FAILED");
                session.setErrorMessage("Arquivo de resultado pipeline_result.json não foi gerado pelo pipeline Python.");
                saveSessionState(sessionId);
                return session;
            }

            Map<String, Object> pipelineResult = objectMapper.readValue(resultJsonPath.toFile(), new TypeReference<>() {});
            Map<String, Object> summary = (Map<String, Object>) pipelineResult.get("summary");
            session.setSummary(summary);

            String cargoCodigoFinal = cargoCodigo;
            String concursoId = (session.getMetadata() != null && session.getMetadata().containsKey("concurso_id"))
                    ? String.valueOf(session.getMetadata().get("concurso_id"))
                    : ("503".equals(cargoCodigoFinal) ? "ibgp-araguari-2023-auditor" : "ibgp-araguari-2023-tecnico");
            List<EditalTopico> topicos = (editalRepository != null) ? editalRepository.findTopicosByConcurso(concursoId) : Collections.emptyList();
            if (topicos.isEmpty() && editalRepository != null) {
                topicos = editalRepository.findTopicosByConcurso("ibgp-araguari-2023-auditor");
            }

            List<Map<String, Object>> rawQuestions = (List<Map<String, Object>>) pipelineResult.get("questions");
            List<StagingQuestionDTO> dtoList = new ArrayList<>();

            if (rawQuestions != null) {
                for (Map<String, Object> q : rawQuestions) {
                    StagingQuestionDTO dto = new StagingQuestionDTO();
                    dto.setId(String.valueOf(q.get("id")));
                    Object rawNum = q.get("numero_original");
                    dto.setNumeroOriginal(rawNum instanceof Number ? ((Number) rawNum).intValue() : 0);
                    dto.setStatement(String.valueOf(q.get("statement")));
                    
                    List<String> options = (List<String>) q.get("options_formatted");
                    dto.setOptions(options != null ? options : new ArrayList<>());

                    Object corr = q.get("correct_option");
                    dto.setCorrectOption(corr != null ? String.valueOf(corr) : null);

                    dto.setGabaritoStatus(q.get("gabarito_status") != null ? String.valueOf(q.get("gabarito_status")) : "AUSENTE");
                    dto.setDisciplina(q.get("disciplina") != null ? String.valueOf(q.get("disciplina")) : "Geral");
                    dto.setStatus(q.get("status") != null ? String.valueOf(q.get("status")) : "EXTRACTED");

                    List<String> flags = (List<String>) q.get("flags");
                    dto.setFlags(flags != null ? new ArrayList<>(flags) : new ArrayList<>());

                    List<Integer> pages = (List<Integer>) q.get("pages");
                    dto.setPages(pages != null ? pages : new ArrayList<>());

                    dto.setEvidenceImage(q.get("evidence_image") != null ? String.valueOf(q.get("evidence_image")) : null);
                    dto.setProvenance((Map<String, Object>) q.get("provenance"));
                    dto.setModifiedByUser(false);

                    Object suppMat = q.get("support_material");
                    if (suppMat instanceof Map) {
                        dto.setSupportMaterial((Map<String, Object>) suppMat);
                    }
                    if (q.get("assunto") != null) {
                        dto.setAssunto(String.valueOf(q.get("assunto")));
                    }
                    if (q.get("subassunto") != null) {
                        dto.setSubassunto(String.valueOf(q.get("subassunto")));
                    }
                    if (q.get("edital_topico_id") != null) {
                        dto.setEditalTopicoId(String.valueOf(q.get("edital_topico_id")));
                    }

                    // Se rejeitada pelo extrator, define tipo recuperável para não sumir da revisão
                    if ("REJECTED".equals(dto.getStatus())) {
                        dto.setRejectionType("RECUPERAVEL");
                    }

                    // Detecção contextual de caracteres suspeitos sem tratar pontuação portuguesa legítima como erro
                    if (detectContextualSuspectChars(dto.getStatement())) {
                        if (!dto.getFlags().contains("SUSPECT_OCR")) {
                            dto.getFlags().add("SUSPECT_OCR");
                        }
                    }

                    // Classificação de assuntos a partir do Edital Verticalizado
                    classifyFromEdital(dto, topicos);

                    dtoList.add(dto);
                }
            }

            sessionQuestions.put(sessionId, dtoList);
            session.setStatus("AWAITING_REVIEW");
            session.setStepDescription("Extração concluída com sucesso. " + dtoList.size() + " questões prontas para revisão.");
            session.setProgressPercent(100);

            saveSessionState(sessionId);
            return session;
        } catch (Exception e) {
            runningProcesses.remove(sessionId);
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
            logger.error("Exception during pipeline execution", e);
            session.setStatus("FAILED");
            session.setErrorMessage("Erro durante processamento: " + e.getMessage());
            saveSessionState(sessionId);
            return session;
        }
    }

    public StagingSessionDTO cancelSession(String sessionId) {
        StagingSessionDTO session = getSession(sessionId);
        if (session == null) {
            throw new IllegalArgumentException("Sessão não encontrada: " + sessionId);
        }

        Process proc = runningProcesses.remove(sessionId);
        if (proc != null && proc.isAlive()) {
            proc.destroyForcibly();
            logger.info("Process for session {} forcibly terminated by user cancellation", sessionId);
        }

        session.setStatus("CANCELLED");
        session.setStepDescription("Processamento cancelado pelo usuário.");
        session.setProgressPercent(0);
        saveSessionState(sessionId);
        return session;
    }

    public StagingSessionDTO createDemoSession(String cargoCodigo) {
        String code = cargoCodigo != null ? cargoCodigo : "532";
        Map<String, Object> meta = new HashMap<>();
        meta.put("banca", "IBGP");
        meta.put("ano", 2023);
        meta.put("orgao", "Prefeitura Municipal de Araguari - MG");
        meta.put("cargo_codigo", code);
        meta.put("cargo", "503".equals(code) ? "Auditor Fiscal da Receita Municipal" : "Técnico Fiscal da Receita Municipal");

        StagingSessionDTO session = createSession(meta);
        Path sessionUploads = stagingRoot.resolve(session.getSessionId()).resolve("uploads");

        // Copia documentos do Golden Set para a pasta de uploads da sessão
        try {
            Path goldenSetDocs = Paths.get("tests", "golden-set", "docs").toAbsolutePath().normalize();
            if (!Files.exists(goldenSetDocs)) {
                goldenSetDocs = Paths.get("..", "tests", "golden-set", "docs").toAbsolutePath().normalize();
            }

            Path provaPath = goldenSetDocs.resolve("ibgp-2023-prefeitura-de-araguari-mg-tecnico-fiscal-da-receita-municipal-prova.pdf");
            Path gabaritoPath = goldenSetDocs.resolve("gabarito-preliminar-prova-objetiva-tarde-1.pdf");

            if ("503".equals(code)) {
                provaPath = goldenSetDocs.resolve("503_-_auditor_fiscal_da_receita_municipal.pdf");
                gabaritoPath = goldenSetDocs.resolve("gab_def_-_iss_araguari_2023_-_auditor.pdf");
            }

            if (Files.exists(provaPath)) {
                Files.copy(provaPath, sessionUploads.resolve("prova.pdf"), StandardCopyOption.REPLACE_EXISTING);
                session.getDocuments().add(new StagingSessionDTO.StagingDocumentDTO(
                        UUID.randomUUID().toString(),
                        provaPath.getFileName().toString(),
                        "PROVA",
                        Files.size(provaPath),
                        "PDF"
                ));
            }

            if (Files.exists(gabaritoPath)) {
                Files.copy(gabaritoPath, sessionUploads.resolve("gabarito.pdf"), StandardCopyOption.REPLACE_EXISTING);
                session.getDocuments().add(new StagingSessionDTO.StagingDocumentDTO(
                        UUID.randomUUID().toString(),
                        gabaritoPath.getFileName().toString(),
                        "GABARITO_PRELIMINAR",
                        Files.size(gabaritoPath),
                        "PDF"
                ));
            }
        } catch (IOException e) {
            logger.warn("Could not copy golden set files directly: {}", e.getMessage());
        }

        return runProcessing(session.getSessionId());
    }

    public List<StagingQuestionDTO> getSessionQuestions(String sessionId) {
        return sessionQuestions.getOrDefault(sessionId, Collections.emptyList());
    }

    public StagingQuestionDTO updateQuestion(String sessionId, String questionId, QuestionUpdateRequestDTO req) {
        List<StagingQuestionDTO> questions = sessionQuestions.get(sessionId);
        if (questions == null) {
            throw new IllegalArgumentException("Sessão não encontrada: " + sessionId);
        }

        StagingQuestionDTO target = questions.stream()
                .filter(q -> q.getId().equals(questionId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Questão não encontrada: " + questionId));

        if (req.getStatement() != null) target.setStatement(req.getStatement());
        if (req.getOptions() != null) target.setOptions(req.getOptions());
        if (req.getCorrectOption() != null) target.setCorrectOption(req.getCorrectOption());
        if (req.getGabaritoStatus() != null) target.setGabaritoStatus(req.getGabaritoStatus());
        if (req.getDisciplina() != null) target.setDisciplina(req.getDisciplina());
        if (req.getAssunto() != null) target.setAssunto(req.getAssunto());
        if (req.getSubassunto() != null) target.setSubassunto(req.getSubassunto());
        if (req.getEditalTopicoId() != null) target.setEditalTopicoId(req.getEditalTopicoId());
        if (req.getRejectionType() != null) target.setRejectionType(req.getRejectionType());
        if (req.getSupportMaterial() != null) target.setSupportMaterial(req.getSupportMaterial());
        if (req.getStatus() != null) target.setStatus(req.getStatus());
        if (req.getReviewNotes() != null) target.setReviewNotes(req.getReviewNotes());

        target.setModifiedByUser(true);
        saveSessionState(sessionId);
        return target;
    }

    public StagingQuestionDTO markQuestionVerified(String sessionId, String questionId) {
        QuestionUpdateRequestDTO req = new QuestionUpdateRequestDTO();
        req.setStatus("SOURCE_VERIFIED");
        return updateQuestion(sessionId, questionId, req);
    }

    public StagingQuestionDTO markQuestionRejected(String sessionId, String questionId) {
        QuestionUpdateRequestDTO req = new QuestionUpdateRequestDTO();
        req.setStatus("REJECTED");
        return updateQuestion(sessionId, questionId, req);
    }

    public byte[] getEvidenceImage(String sessionId, String filename) throws IOException {
        // Sanitização contra directory traversal
        String safeName = Paths.get(filename).getFileName().toString();
        Path evidencePath = stagingRoot.resolve(sessionId).resolve("output").resolve("evidence").resolve(safeName);
        if (!Files.exists(evidencePath)) {
            throw new IllegalArgumentException("Imagem de evidência não encontrada: " + safeName);
        }
        return Files.readAllBytes(evidencePath);
    }

    public ImportSimulationDTO simulateImport(String sessionId) {
        List<StagingQuestionDTO> questions = sessionQuestions.get(sessionId);
        if (questions == null) {
            throw new IllegalArgumentException("Sessão não encontrada: " + sessionId);
        }

        ImportSimulationDTO sim = new ImportSimulationDTO();
        sim.setMode("TEST_MODE_DRY_RUN");
        sim.setTotalStagingQuestions(questions.size());

        int verified = 0;
        int needsReview = 0;
        int rejected = 0;
        Map<String, Integer> byDiscipline = new HashMap<>();
        List<String> warnings = new ArrayList<>();
        List<String> collidingIds = new ArrayList<>();

        // Consulta banco operacional apenas para verificação de colisão
        List<String> existingIds = jdbcTemplate.query(
                "SELECT id FROM questions",
                (rs, rowNum) -> rs.getString("id")
        );
        Set<String> existingIdSet = new HashSet<>(existingIds);

        for (StagingQuestionDTO q : questions) {
            String status = q.getStatus();
            if ("SOURCE_VERIFIED".equals(status) || "STRUCTURALLY_VALID".equals(status)) {
                verified++;
            } else if ("NEEDS_REVIEW".equals(status)) {
                needsReview++;
                warnings.add("Q" + q.getNumeroOriginal() + ": pendente de revisão humana (" + String.join(", ", q.getFlags()) + ")");
            } else {
                rejected++;
                warnings.add("Q" + q.getNumeroOriginal() + ": rejeitada por problemas estruturais");
            }

            byDiscipline.put(q.getDisciplina(), byDiscipline.getOrDefault(q.getDisciplina(), 0) + 1);

            if (existingIdSet.contains(q.getId())) {
                collidingIds.add(q.getId());
            }
        }

        sim.setVerifiedReadyToImport(verified);
        sim.setNeedsReviewCount(needsReview);
        sim.setRejectedCount(rejected);
        sim.setCollidingExistingQuestions(collidingIds.size());
        sim.setCollidingQuestionIds(collidingIds);
        sim.setWarnings(warnings);
        sim.setByDiscipline(byDiscipline);
        sim.setSafeToImport(verified > 0 && collidingIds.isEmpty());

        return sim;
    }

    public int importVerifiedQuestions(String sessionId) {
        List<StagingQuestionDTO> questions = sessionQuestions.get(sessionId);
        StagingSessionDTO session = getSession(sessionId);
        if (questions == null || session == null) {
            throw new IllegalArgumentException("Sessão não encontrada: " + sessionId);
        }

        int importedCount = 0;
        for (StagingQuestionDTO q : questions) {
            if (!"SOURCE_VERIFIED".equals(q.getStatus()) && !"STRUCTURALLY_VALID".equals(q.getStatus())) {
                continue;
            }

            String id = q.getId();
            String statement = q.getStatement();
            String optionsJson = "[]";
            try {
                optionsJson = objectMapper.writeValueAsString(q.getOptions());
            } catch (Exception e) {
                logger.error("Error serializing options", e);
            }

            String correctOption = q.getCorrectOption();
            String gabaritoStatus = q.getGabaritoStatus() != null ? q.getGabaritoStatus() : "DEFINITIVO";
            String disciplina = q.getDisciplina();

            Map<String, Object> prov = q.getProvenance() != null ? q.getProvenance() : session.getMetadata();
            String banca = prov != null ? (String) prov.get("banca") : "IBGP";
            Integer ano = prov != null && prov.get("ano") instanceof Number ? ((Number) prov.get("ano")).intValue() : 2023;
            String cargo = prov != null ? (String) prov.get("cargo") : "Técnico Fiscal da Receita Municipal";
            String orgao = prov != null ? (String) prov.get("orgao") : "Prefeitura de Araguari";

            String sql = "INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, orgao, cargo, disciplina) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                    "ON CONFLICT(id) DO UPDATE SET enunciado=excluded.enunciado, options_json=excluded.options_json, " +
                    "correct_option=excluded.correct_option, gabarito_status=excluded.gabarito_status, " +
                    "banca=excluded.banca, ano=excluded.ano, orgao=excluded.orgao, cargo=excluded.cargo, disciplina=excluded.disciplina";

            jdbcTemplate.update(sql, id, statement, optionsJson, correctOption, gabaritoStatus, banca, ano, orgao, cargo, disciplina);
            importedCount++;
        }

        // Registrar evento auditável no log imutável
        String eventId = UUID.randomUUID().toString();
        String now = Instant.now().toString();
        String eventSql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(eventSql, eventId, "IMPORT_RECEIVED", "INGESTION_STAGING", sessionId,
                now, now, 1, "v1", "{\"imported_verified_questions\":" + importedCount + ",\"session_id\":\"" + sessionId + "\"}");

        session.setStatus("COMPLETED");
        session.setStepDescription("Importação segura concluída. " + importedCount + " questões verificadas persistidas.");
        saveSessionState(sessionId);

        return importedCount;
    }

    public StagingSessionDTO getSession(String sessionId) {
        StagingSessionDTO session = sessions.get(sessionId);
        if (session == null) {
            loadSessionState(sessionId);
            session = sessions.get(sessionId);
        }
        return session;
    }

    private void saveSessionState(String sessionId) {
        StagingSessionDTO session = sessions.get(sessionId);
        if (session == null) return;
        Path stateFile = stagingRoot.resolve(sessionId).resolve("staging_state.json");
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("session", session);
            payload.put("questions", sessionQuestions.getOrDefault(sessionId, Collections.emptyList()));
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(stateFile.toFile(), payload);
        } catch (IOException e) {
            logger.warn("Could not save staging state for {}: {}", sessionId, e.getMessage());
        }
    }

    private void loadSessionState(String sessionId) {
        Path stateFile = stagingRoot.resolve(sessionId).resolve("staging_state.json");
        if (!Files.exists(stateFile)) return;
        try {
            Map<String, Object> data = objectMapper.readValue(stateFile.toFile(), new TypeReference<>() {});
            if (data.containsKey("session")) {
                StagingSessionDTO sess = objectMapper.convertValue(data.get("session"), StagingSessionDTO.class);
                sessions.put(sessionId, sess);
            }
            if (data.containsKey("questions")) {
                List<StagingQuestionDTO> qs = objectMapper.convertValue(data.get("questions"), new TypeReference<List<StagingQuestionDTO>>() {});
                sessionQuestions.put(sessionId, qs);
            }
        } catch (IOException e) {
            logger.warn("Could not load staging state for {}: {}", sessionId, e.getMessage());
        }
    }

    public boolean detectContextualSuspectChars(String text) {
        if (text == null) return false;
        // Caractere de substituição Unicode
        if (text.contains("\uFFFD")) return true;
        // Padrões típicos de corrupção/mojibake em português
        if (text.matches(".*(Ã£|Ã©|Ã³|Ã§|Ãª|Ã¡|Ãº|Ã­|â|â).*")) return true;
        // Barra vertical indevida dentro de palavras (artefato de OCR com 'l' ou 'I')
        if (text.matches(".*[a-zA-ZÀ-ÿ]\\|[a-zA-ZÀ-ÿ].*")) return true;
        return false;
    }

    public void classifyFromEdital(StagingQuestionDTO dto, List<EditalTopico> topicos) {
        if (topicos == null || topicos.isEmpty() || dto == null) return;
        String statementLower = (dto.getStatement() != null) ? dto.getStatement().toLowerCase() : "";
        String disciplinaLower = (dto.getDisciplina() != null) ? dto.getDisciplina().toLowerCase() : "";

        EditalTopico bestMatch = null;
        int maxScore = 0;

        for (EditalTopico topico : topicos) {
            String tDiscLower = topico.getDisciplina() != null ? topico.getDisciplina().toLowerCase() : "";
            // Verifica compatibilidade de disciplina
            boolean discMatches = disciplinaLower.contains(tDiscLower) || tDiscLower.contains(disciplinaLower)
                    || (disciplinaLower.contains("tribut") && tDiscLower.contains("tribut"))
                    || (disciplinaLower.contains("portug") && tDiscLower.contains("portug"))
                    || (disciplinaLower.contains("matem") && tDiscLower.contains("racioc"))
                    || (disciplinaLower.contains("racioc") && tDiscLower.contains("matem"));

            if (!discMatches && !disciplinaLower.contains("geral")) {
                continue;
            }

            int score = 0;
            String assunto = topico.getAssunto() != null ? topico.getAssunto().toLowerCase() : "";
            String subassunto = topico.getSubassunto() != null ? topico.getSubassunto().toLowerCase() : "";

            // Termos compostos e frases específicas dão maior pontuação
            if (!assunto.isBlank() && statementLower.contains(assunto)) {
                score += assunto.split("\\s+").length * 3;
            }
            if (!subassunto.isBlank() && statementLower.contains(subassunto)) {
                score += subassunto.split("\\s+").length * 4;
            }

            // Exigência: Não utilizar apenas palavras-chave isoladas (score mínimo de 3)
            if (score >= 3 && score > maxScore) {
                maxScore = score;
                bestMatch = topico;
            }
        }

        if (bestMatch != null) {
            dto.setDisciplinaSugerida(bestMatch.getDisciplina());
            dto.setAssuntoSugerido(bestMatch.getAssunto());
            dto.setSubassuntoSugerido(bestMatch.getSubassunto());
            dto.setEditalTopicoId(bestMatch.getId());
        }
    }

    private String findPythonExecutable() {
        List<Path> candidates = Arrays.asList(
                Paths.get("ingestion", "venv", "Scripts", "python.exe"),
                Paths.get("..", "ingestion", "venv", "Scripts", "python.exe"),
                Paths.get("ingestion", "venv", "bin", "python"),
                Paths.get("..", "ingestion", "venv", "bin", "python")
        );
        for (Path p : candidates) {
            Path abs = p.toAbsolutePath().normalize();
            if (Files.exists(abs)) {
                return abs.toString();
            }
        }
        return "python";
    }

    private File findIngestionDir() {
        Path candidate1 = Paths.get("ingestion").toAbsolutePath().normalize();
        if (Files.exists(candidate1)) return candidate1.toFile();
        Path candidate2 = Paths.get("..", "ingestion").toAbsolutePath().normalize();
        if (Files.exists(candidate2)) return candidate2.toFile();
        return new File(".");
    }
}
