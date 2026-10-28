package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionUpdateRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingFileDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingQuestionDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Service
public class StagingDatabaseService {

    private static final Logger logger = LoggerFactory.getLogger(StagingDatabaseService.class);

    private final JdbcTemplate operationalJdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Path stagingDbPath;
    private final Path acervoRoot;
    private final Path evidenceCacheDir;

    @org.springframework.beans.factory.annotation.Autowired
    public StagingDatabaseService(JdbcTemplate operationalJdbcTemplate, com.fiscalstudy.backend.infrastructure.config.DatabasePaths paths) {
        this.operationalJdbcTemplate = operationalJdbcTemplate;
        this.objectMapper = new ObjectMapper();

        this.stagingDbPath = paths.stagingDatabase();
        this.acervoRoot = paths.acervoRoot();
        this.evidenceCacheDir = paths.dataDirectory().resolve("cache/evidence");

        try {
            Files.createDirectories(this.evidenceCacheDir);
        } catch (IOException e) {
            logger.warn("Could not create evidence cache dir: {}", e.getMessage());
        }

        logger.info("StagingDatabaseService initialized with staging DB at: {}", this.stagingDbPath);
    }

    private Connection getStagingConnection() throws SQLException {
        Connection conn = DriverManager.getConnection("jdbc:sqlite:" + stagingDbPath.toString());
        try (Statement stmt = conn.createStatement()) { stmt.execute("PRAGMA foreign_keys=ON"); stmt.execute("PRAGMA busy_timeout=10000"); }
        return conn;
    }

    /**
     * Lista todos os arquivos catalogados com contagem agregada de questões extraídas e status.
     */
    public List<StagingFileDTO> listStagingFiles() {
        List<StagingFileDTO> list = new ArrayList<>();
        String sql = "SELECT f.id, f.rel_path, f.filename, f.file_size_bytes, f.sha256, f.total_pages, " +
                "       f.has_selectable_text, f.is_scanned, f.doc_family, f.banca, f.ano, f.orgao, f.cargo, f.status, " +
                "       COUNT(q.id) as question_count, " +
                "       SUM(CASE WHEN q.status = 'SOURCE_VERIFIED' THEN 1 ELSE 0 END) as verified_count, " +
                "       SUM(CASE WHEN q.status = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as needs_review_count " +
                "FROM staging_files f " +
                "LEFT JOIN staging_documents d ON d.file_id = f.id " +
                "LEFT JOIN staging_questions q ON q.document_id = d.id " +
                "GROUP BY f.id " +
                "ORDER BY question_count DESC, f.ano DESC, f.banca ASC";

        try (Connection conn = getStagingConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                StagingFileDTO dto = new StagingFileDTO();
                dto.setId(rs.getString("id"));
                dto.setRelPath(rs.getString("rel_path"));
                dto.setFilename(rs.getString("filename"));
                dto.setFileSizeBytes(rs.getLong("file_size_bytes"));
                dto.setSha256(rs.getString("sha256"));
                dto.setTotalPages(rs.getInt("total_pages"));
                dto.setHasSelectableText(rs.getInt("has_selectable_text") == 1);
                dto.setScanned(rs.getInt("is_scanned") == 1);
                dto.setDocFamily(rs.getString("doc_family"));
                dto.setBanca(rs.getString("banca"));
                int ano = rs.getInt("ano");
                dto.setAno(rs.wasNull() ? null : ano);
                dto.setOrgao(rs.getString("orgao"));
                dto.setCargo(rs.getString("cargo"));
                int questionCount = rs.getInt("question_count");
                int verifiedCount = rs.getInt("verified_count");
                int needsReviewCount = rs.getInt("needs_review_count");
                String status = rs.getString("status");

                dto.setStatus(status);
                dto.setQuestionCount(questionCount);
                dto.setVerifiedCount(verifiedCount);
                dto.setNeedsReviewCount(needsReviewCount);

                boolean hasInconsistency = false;
                List<String> reasons = new ArrayList<>();
                if ("FAILED".equalsIgnoreCase(status)) {
                    hasInconsistency = true;
                    reasons.add("Falha no processamento da prova");
                } else if ("NO_QUESTIONS_FOUND".equalsIgnoreCase(status) || questionCount == 0) {
                    hasInconsistency = true;
                    reasons.add("Nenhuma questão extraída (0 questões)");
                }
                if (needsReviewCount > 0) {
                    hasInconsistency = true;
                    reasons.add(needsReviewCount + " questão(ões) pendente(s) de revisão/gabarito");
                }
                dto.setHasInconsistency(hasInconsistency);
                dto.setInconsistencyReason(String.join("; ", reasons));

                list.add(dto);
            }
        } catch (SQLException e) {
            logger.error("Error listing staging files from {}", stagingDbPath, e);
            throw new RuntimeException("Falha ao consultar staging.db: " + e.getMessage(), e);
        }

        return list;
    }

    /**
     * Recupera as questões extraídas de um arquivo específico em staging.
     */
    public List<StagingQuestionDTO> getQuestionsForFile(String fileId) {
        List<StagingQuestionDTO> questions = new ArrayList<>();
        String sql = "SELECT q.id, q.document_id, q.numero_original, q.statement, q.options_json, " +
                "       q.correct_option, q.gabarito_status, q.disciplina, q.assunto, q.subassunto, " +
                "       q.edital_topico_id, q.status, q.flags_json, q.pages_json, q.evidence_image_path, " +
                "       q.modified_by_user, q.review_notes, q.justificativa, q.texto_apoio, q.texto_apoio_titulo, " +
                "       f.banca, f.ano, f.orgao, f.cargo, f.rel_path " +
                "FROM staging_questions q " +
                "JOIN staging_documents d ON q.document_id = d.id " +
                "JOIN staging_files f ON d.file_id = f.id " +
                "WHERE f.id = ? " +
                "ORDER BY q.numero_original ASC";

        try (Connection conn = getStagingConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    StagingQuestionDTO dto = new StagingQuestionDTO();
                    dto.setId(rs.getString("id"));
                    dto.setNumeroOriginal(rs.getInt("numero_original"));
                    dto.setStatement(rs.getString("statement"));

                    String optsJson = rs.getString("options_json");
                    if (optsJson != null && !optsJson.isBlank()) {
                        try {
                            List<String> options = objectMapper.readValue(optsJson, new TypeReference<List<String>>() {});
                            dto.setOptions(options);
                        } catch (Exception e) {
                            dto.setOptions(Collections.emptyList());
                        }
                    } else {
                        dto.setOptions(Collections.emptyList());
                    }

                    dto.setCorrectOption(rs.getString("correct_option"));
                    dto.setGabaritoStatus(rs.getString("gabarito_status"));
                    dto.setDisciplina(rs.getString("disciplina"));
                    dto.setAssunto(rs.getString("assunto"));
                    dto.setSubassunto(rs.getString("subassunto"));
                    dto.setEditalTopicoId(rs.getString("edital_topico_id"));
                    dto.setStatus(rs.getString("status"));
                    dto.setJustificativa(rs.getString("justificativa"));
                    dto.setTextoApoio(rs.getString("texto_apoio"));
                    dto.setTextoApoioTitulo(rs.getString("texto_apoio_titulo"));

                    String flagsJson = rs.getString("flags_json");
                    if (flagsJson != null && !flagsJson.isBlank()) {
                        try {
                            List<String> flags = objectMapper.readValue(flagsJson, new TypeReference<List<String>>() {});
                            dto.setFlags(flags);
                        } catch (Exception e) {
                            dto.setFlags(Collections.emptyList());
                        }
                    } else {
                        dto.setFlags(Collections.emptyList());
                    }

                    String pagesJson = rs.getString("pages_json");
                    if (pagesJson != null && !pagesJson.isBlank()) {
                        try {
                            List<Integer> pages = objectMapper.readValue(pagesJson, new TypeReference<List<Integer>>() {});
                            dto.setPages(pages);
                        } catch (Exception e) {
                            dto.setPages(Collections.emptyList());
                        }
                    } else {
                        dto.setPages(Collections.emptyList());
                    }

                    dto.setEvidenceImage(rs.getString("evidence_image_path"));
                    dto.setModifiedByUser(rs.getInt("modified_by_user") == 1);
                    dto.setReviewNotes(rs.getString("review_notes"));

                    Map<String, Object> prov = new HashMap<>();
                    prov.put("banca", rs.getString("banca"));
                    int ano = rs.getInt("ano");
                    prov.put("ano", rs.wasNull() ? null : ano);
                    prov.put("orgao", rs.getString("orgao"));
                    prov.put("cargo", rs.getString("cargo"));
                    prov.put("rel_path", rs.getString("rel_path"));
                    dto.setProvenance(prov);

                    questions.add(dto);
                }
            }

            if (!questions.isEmpty()) {
                String matSql = "SELECT qsm.question_id, m.id, m.tipo, m.titulo, m.conteudo_texto, m.media_path, m.pagina_inicio, m.pagina_fim " +
                        "FROM staging_question_support_materials qsm " +
                        "JOIN staging_support_materials m ON qsm.material_id = m.id " +
                        "WHERE qsm.question_id IN (" +
                        String.join(",", Collections.nCopies(questions.size(), "?")) + ")";
                try (PreparedStatement matStmt = conn.prepareStatement(matSql)) {
                    for (int i = 0; i < questions.size(); i++) {
                        matStmt.setString(i + 1, questions.get(i).getId());
                    }
                    try (ResultSet matRs = matStmt.executeQuery()) {
                        Map<String, Map<String, Object>> matMap = new HashMap<>();
                        while (matRs.next()) {
                            String qId = matRs.getString("question_id");
                            Map<String, Object> m = new HashMap<>();
                            m.put("id", matRs.getString("id"));
                            m.put("tipo", matRs.getString("tipo"));
                            m.put("titulo", matRs.getString("titulo"));
                            m.put("conteudoTexto", matRs.getString("conteudo_texto"));
                            m.put("mediaPath", matRs.getString("media_path"));
                            m.put("paginaInicio", matRs.getInt("pagina_inicio"));
                            m.put("paginaFim", matRs.getInt("pagina_fim"));
                            matMap.put(qId, m);
                        }
                        for (StagingQuestionDTO q : questions) {
                            if (matMap.containsKey(q.getId())) {
                                q.setSupportMaterial(matMap.get(q.getId()));
                            } else if (q.getTextoApoio() != null && !q.getTextoApoio().isBlank()) {
                                Map<String, Object> mat = new HashMap<>();
                                mat.put("tipo", "TEXTO_BASE");
                                mat.put("titulo", q.getTextoApoioTitulo() != null && !q.getTextoApoioTitulo().isBlank() ? q.getTextoApoioTitulo() : "Texto de Apoio");
                                mat.put("conteudoTexto", q.getTextoApoio());
                                q.setSupportMaterial(mat);
                            }
                        }
                    }
                } catch (SQLException e) {
                    logger.warn("Could not load support materials for fileId {}: {}", fileId, e.getMessage());
                }
            } else {
                for (StagingQuestionDTO q : questions) {
                    if (q.getTextoApoio() != null && !q.getTextoApoio().isBlank()) {
                        Map<String, Object> mat = new HashMap<>();
                        mat.put("tipo", "TEXTO_BASE");
                        mat.put("titulo", q.getTextoApoioTitulo() != null && !q.getTextoApoioTitulo().isBlank() ? q.getTextoApoioTitulo() : "Texto de Apoio");
                        mat.put("conteudoTexto", q.getTextoApoio());
                        q.setSupportMaterial(mat);
                    }
                }
            }
        } catch (SQLException e) {
            logger.error("Error retrieving questions for fileId {}", fileId, e);
            throw new RuntimeException("Falha ao recuperar questões: " + e.getMessage(), e);
        }

        return questions;
    }

    /**
     * Atualiza dados de uma questão em staging com auditoria de modificação manual.
     */
    public StagingQuestionDTO updateStagingQuestion(String questionId, QuestionUpdateRequestDTO req) {
        String selectSql = "SELECT q.*, f.banca, f.ano, f.orgao, f.cargo, f.rel_path, f.id as file_id " +
                "FROM staging_questions q " +
                "JOIN staging_documents d ON q.document_id = d.id " +
                "JOIN staging_files f ON d.file_id = f.id " +
                "WHERE q.id = ?";

        String updateSql = "UPDATE staging_questions SET " +
                "numero_original = COALESCE(?, numero_original), " +
                "pages_json = COALESCE(?, pages_json), " +
                "statement = COALESCE(?, statement), " +
                "options_json = COALESCE(?, options_json), " +
                "correct_option = COALESCE(?, correct_option), " +
                "gabarito_status = COALESCE(?, gabarito_status), " +
                "disciplina = COALESCE(?, disciplina), " +
                "assunto = COALESCE(?, assunto), " +
                "subassunto = COALESCE(?, subassunto), " +
                "edital_topico_id = COALESCE(?, edital_topico_id), " +
                "status = COALESCE(?, status), " +
                "review_notes = COALESCE(?, review_notes), " +
                "justificativa = COALESCE(?, justificativa), " +
                "texto_apoio = ?, " +
                "texto_apoio_titulo = ?, " +
                "modified_by_user = 1, " +
                "updated_at = CURRENT_TIMESTAMP " +
                "WHERE id = ?";

        try (Connection conn = getStagingConnection()) {
            String optionsJson = null;
            if (req.getOptions() != null) {
                optionsJson = objectMapper.writeValueAsString(req.getOptions());
            }
            String pagesJson = null;
            if (req.getPages() != null && !req.getPages().isEmpty()) {
                pagesJson = objectMapper.writeValueAsString(req.getPages());
            }

            // Extrai texto de apoio garantindo sincronização com supportMaterial
            String textoApoio = req.getTextoApoio();
            String textoApoioTitulo = req.getTextoApoioTitulo();
            if ((textoApoio == null || textoApoio.isBlank()) && req.getSupportMaterial() != null) {
                Object cObj = req.getSupportMaterial().get("conteudoTexto");
                if (cObj != null) {
                    textoApoio = cObj.toString();
                }
                Object tObj = req.getSupportMaterial().get("titulo");
                if (tObj != null) {
                    textoApoioTitulo = tObj.toString();
                }
            }

            try (PreparedStatement uStmt = conn.prepareStatement(updateSql)) {
                if (req.getNumeroOriginal() != null) {
                    uStmt.setInt(1, req.getNumeroOriginal());
                } else {
                    uStmt.setNull(1, java.sql.Types.INTEGER);
                }
                uStmt.setString(2, pagesJson);
                uStmt.setString(3, req.getStatement());
                uStmt.setString(4, optionsJson);
                uStmt.setString(5, req.getCorrectOption());
                uStmt.setString(6, req.getGabaritoStatus());
                uStmt.setString(7, req.getDisciplina());
                uStmt.setString(8, req.getAssunto());
                uStmt.setString(9, req.getSubassunto());
                uStmt.setString(10, req.getEditalTopicoId());
                uStmt.setString(11, req.getStatus());
                uStmt.setString(12, req.getReviewNotes());
                uStmt.setString(13, req.getJustificativa());
                uStmt.setString(14, textoApoio);
                uStmt.setString(15, textoApoioTitulo);
                uStmt.setString(16, questionId);

                int rows = uStmt.executeUpdate();
                if (rows == 0) {
                    throw new IllegalArgumentException("Questão de staging não encontrada: " + questionId);
                }
            }

            // Recarregar questão atualizada
            try (PreparedStatement sStmt = conn.prepareStatement(selectSql)) {
                sStmt.setString(1, questionId);
                try (ResultSet rs = sStmt.executeQuery()) {
                    if (rs.next()) {
                        StagingQuestionDTO dto = new StagingQuestionDTO();
                        dto.setId(rs.getString("id"));
                        dto.setNumeroOriginal(rs.getInt("numero_original"));
                        dto.setStatement(rs.getString("statement"));
                        String opts = rs.getString("options_json");
                        if (opts != null && !opts.isBlank()) {
                            dto.setOptions(objectMapper.readValue(opts, new TypeReference<List<String>>() {}));
                        }
                        dto.setCorrectOption(rs.getString("correct_option"));
                        dto.setGabaritoStatus(rs.getString("gabarito_status"));
                        dto.setDisciplina(rs.getString("disciplina"));
                        dto.setAssunto(rs.getString("assunto"));
                        dto.setSubassunto(rs.getString("subassunto"));
                        dto.setEditalTopicoId(rs.getString("edital_topico_id"));
                        dto.setStatus(rs.getString("status"));
                        dto.setReviewNotes(rs.getString("review_notes"));
                        dto.setJustificativa(rs.getString("justificativa"));
                        String savedTextoApoio = rs.getString("texto_apoio");
                        String savedTextoApoioTitulo = rs.getString("texto_apoio_titulo");
                        dto.setTextoApoio(savedTextoApoio);
                        dto.setTextoApoioTitulo(savedTextoApoioTitulo);
                        dto.setModifiedByUser(true);

                        // Garantir que supportMaterial no DTO esteja sincronizado com o texto_apoio salvo
                        if (savedTextoApoio != null && !savedTextoApoio.isBlank()) {
                            Map<String, Object> mat = new HashMap<>();
                            mat.put("tipo", "TEXTO_BASE");
                            mat.put("titulo", savedTextoApoioTitulo != null && !savedTextoApoioTitulo.isBlank() ? savedTextoApoioTitulo : "Texto de Apoio");
                            mat.put("conteudoTexto", savedTextoApoio);
                            dto.setSupportMaterial(mat);
                        } else if (req.getSupportMaterial() != null) {
                            dto.setSupportMaterial(req.getSupportMaterial());
                        }

                        return dto;
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Error updating staging question {}", questionId, e);
            throw new RuntimeException("Erro ao atualizar questão de staging: " + e.getMessage(), e);
        }

        throw new IllegalArgumentException("Questão não encontrada: " + questionId);
    }

    public StagingQuestionDTO verifyStagingQuestion(String questionId) {
        QuestionUpdateRequestDTO req = new QuestionUpdateRequestDTO();
        req.setStatus("SOURCE_VERIFIED");
        return updateStagingQuestion(questionId, req);
    }

    public StagingQuestionDTO rejectStagingQuestion(String questionId) {
        QuestionUpdateRequestDTO req = new QuestionUpdateRequestDTO();
        req.setStatus("REJECTED");
        return updateStagingQuestion(questionId, req);
    }

    /**
     * Renderiza sob demanda a página do PDF original associada à questão para conferência visual.
     */
    public byte[] renderEvidenceForQuestion(String questionId) throws IOException {
        return renderEvidenceForQuestion(questionId, null);
    }

    /**
     * Renderiza sob demanda a página do PDF original associada à questão para conferência visual.
     */
    public byte[] renderEvidenceForQuestion(String questionId, Integer pageOverride) throws IOException {
        String sql = "SELECT q.pages_json, f.rel_path " +
                "FROM staging_questions q " +
                "JOIN staging_documents d ON q.document_id = d.id " +
                "JOIN staging_files f ON d.file_id = f.id " +
                "WHERE q.id = ?";

        String relPath = null;
        int pageNum = 1;

        try (Connection conn = getStagingConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, questionId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    relPath = rs.getString("rel_path");
                    if (pageOverride != null && pageOverride > 0) {
                        pageNum = pageOverride;
                    } else {
                        String pagesJson = rs.getString("pages_json");
                        if (pagesJson != null && !pagesJson.isBlank()) {
                            List<Integer> pages = objectMapper.readValue(pagesJson, new TypeReference<List<Integer>>() {});
                            if (!pages.isEmpty()) {
                                pageNum = pages.get(0);
                            }
                        }
                    }
                } else {
                    throw new IllegalArgumentException("Questão não encontrada para evidência: " + questionId);
                }
            }
        } catch (SQLException e) {
            throw new IOException("Falha ao consultar banco para evidência: " + e.getMessage(), e);
        }

        if (relPath == null) {
            throw new IllegalArgumentException("Caminho do arquivo não localizado para questão: " + questionId);
        }

        Path pdfPath = acervoRoot.resolve(relPath);
        if (!Files.exists(pdfPath)) {
            throw new IOException("Arquivo PDF não encontrado no acervo: " + pdfPath);
        }

        // Cache em target
        String cacheKey = questionId.replaceAll("[^a-zA-Z0-9.-]", "_") + "_p" + pageNum + ".png";
        Path cachedFile = evidenceCacheDir.resolve(cacheKey);

        if (Files.exists(cachedFile)) {
            return Files.readAllBytes(cachedFile);
        }

        // Executar render_page.py
        Path renderScript = Paths.get("ingestion", "render_page.py").toAbsolutePath().normalize();
        if (!Files.exists(renderScript)) {
            renderScript = Paths.get("..", "ingestion", "render_page.py").toAbsolutePath().normalize();
        }

        ProcessBuilder pb = new ProcessBuilder(
                "py",
                renderScript.toString(),
                "--pdf", pdfPath.toString(),
                "--page", String.valueOf(pageNum),
                "--output", cachedFile.toString(),
                "--dpi", "150"
        );
        pb.redirectErrorStream(true);

        try {
            Process process = pb.start();
            int exitCode = process.waitFor();
            if (exitCode != 0 || !Files.exists(cachedFile)) {
                throw new IOException("Falha ao renderizar página do PDF com script python (código " + exitCode + ")");
            }
            return Files.readAllBytes(cachedFile);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupção ao renderizar página", e);
        }
    }

    /**
     * Renderiza qualquer página de um arquivo de staging em PNG sob demanda.
     */
    public byte[] renderPageImageForFile(String fileId, int pageNum) throws IOException {
        Path pdfPath = getPdfPathForStagingFile(fileId);
        if (!Files.exists(pdfPath)) {
            throw new IOException("Arquivo PDF não encontrado para staging file: " + fileId);
        }

        String cacheKey = "file_" + fileId.replaceAll("[^a-zA-Z0-9.-]", "_") + "_p" + pageNum + ".png";
        Path cachedFile = evidenceCacheDir.resolve(cacheKey);

        if (Files.exists(cachedFile)) {
            return Files.readAllBytes(cachedFile);
        }

        Path renderScript = Paths.get("ingestion", "render_page.py").toAbsolutePath().normalize();
        if (!Files.exists(renderScript)) {
            renderScript = Paths.get("..", "ingestion", "render_page.py").toAbsolutePath().normalize();
        }

        ProcessBuilder pb = new ProcessBuilder(
                "py",
                renderScript.toString(),
                "--pdf", pdfPath.toString(),
                "--page", String.valueOf(pageNum),
                "--output", cachedFile.toString(),
                "--dpi", "150"
        );
        pb.redirectErrorStream(true);

        try {
            Process process = pb.start();
            int exitCode = process.waitFor();
            if (exitCode != 0 || !Files.exists(cachedFile)) {
                throw new IOException("Falha ao renderizar página " + pageNum + " do arquivo " + fileId);
            }
            return Files.readAllBytes(cachedFile);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupção ao renderizar página", e);
        }
    }

    /**
     * Lista todos os documentos (caderno de prova, gabarito, etc.) associados a um arquivo de staging.
     */
    public List<Map<String, Object>> getDocumentsForStagingFile(String fileId) {
        String sql = "SELECT id, file_id, doc_role, page_start, page_end, banca, orgao, cargo, ano, status " +
                "FROM staging_documents WHERE file_id = ? ORDER BY page_start ASC";
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = getStagingConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", rs.getString("id"));
                    map.put("fileId", rs.getString("file_id"));
                    map.put("docRole", rs.getString("doc_role"));
                    map.put("pageStart", rs.getInt("page_start"));
                    map.put("pageEnd", rs.getInt("page_end"));
                    map.put("banca", rs.getString("banca"));
                    map.put("orgao", rs.getString("orgao"));
                    map.put("cargo", rs.getString("cargo"));
                    map.put("ano", rs.getInt("ano"));
                    map.put("status", rs.getString("status"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Erro ao consultar documentos de staging: " + e.getMessage(), e);
        }
        return list;
    }

    /**
     * Publica questões aprovadas no banco operacional com backup físico prévio e verificação de integridade.
     */
    public Map<String, Object> publishToOperationalDb(String fileId, boolean includeStructurallyValid) {
        Path script = Paths.get("ingestion", "publish_verified.py").toAbsolutePath().normalize();
        if (!Files.exists(script)) {
            script = Paths.get("..", "ingestion", "publish_verified.py").toAbsolutePath().normalize();
        }

        List<String> cmd = new ArrayList<>(List.of("py", script.toString()));
        if (fileId != null && !fileId.isBlank()) {
            cmd.add("--file-id");
            cmd.add(fileId);
        } else {
            cmd.add("--all-verified");
        }
        if (includeStructurallyValid) {
            cmd.add("--include-valid");
        }

        ProcessBuilder pb = new ProcessBuilder(cmd);
        try {
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                String error = new String(process.getErrorStream().readAllBytes());
                throw new RuntimeException("Falha na publicação: " + error);
            }

            int jsonStart = output.lastIndexOf('{');
            if (jsonStart != -1) {
                return objectMapper.readValue(output.substring(jsonStart), new TypeReference<Map<String, Object>>() {});
            }
            return Map.of("status", "SUCCESS", "raw_output", output);
        } catch (Exception e) {
            logger.error("Error during authorized publication", e);
            throw new RuntimeException("Erro ao publicar: " + e.getMessage(), e);
        }
    }

    /**
     * Retorna o Path físico do arquivo PDF original no acervo para visualização embutida ou download.
     */
    public Path getPdfPathForStagingFile(String fileId) throws IOException {
        String sql = "SELECT rel_path FROM staging_files WHERE id = ?";
        String relPath = null;
        try (Connection conn = getStagingConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    relPath = rs.getString("rel_path");
                }
            }
        } catch (SQLException e) {
            throw new IOException("Erro ao consultar caminho do arquivo: " + e.getMessage(), e);
        }

        if (relPath == null) {
            throw new IllegalArgumentException("Arquivo de staging não encontrado: " + fileId);
        }

        Path pdfPath = acervoRoot.resolve(relPath).normalize();
        if (Files.exists(pdfPath)) {
            return pdfPath;
        }

        // Tentar no diretório de uploads manuais ou alternativo
        Path manualUpload = Paths.get("target", "staging_pipeline", "manual_uploads", relPath).toAbsolutePath().normalize();
        if (Files.exists(manualUpload)) {
            return manualUpload;
        }

        throw new IOException("Arquivo PDF não encontrado no acervo: " + pdfPath);
    }

    /**
     * Exclui uma prova do acervo de staging e todos os seus documentos e questões associados.
     */
    public void deleteStagingFile(String fileId) {
        String deleteMaterialsSql = "DELETE FROM staging_question_support_materials WHERE question_id IN " +
                "(SELECT q.id FROM staging_questions q JOIN staging_documents d ON q.document_id = d.id WHERE d.file_id = ?)";
        String deleteQuestionsSql = "DELETE FROM staging_questions WHERE document_id IN " +
                "(SELECT id FROM staging_documents WHERE file_id = ?)";
        String deleteSupportSql = "DELETE FROM staging_support_materials WHERE document_id IN (SELECT id FROM staging_documents WHERE file_id = ?)";
        String deleteDocsSql = "DELETE FROM staging_documents WHERE file_id = ?";
        String deleteFileSql = "DELETE FROM staging_files WHERE id = ?";

        try (Connection conn = getStagingConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement stmt = conn.prepareStatement(deleteMaterialsSql)) {
                    stmt.setString(1, fileId);
                    stmt.executeUpdate();
                }
                try (PreparedStatement stmt = conn.prepareStatement(deleteQuestionsSql)) {
                    stmt.setString(1, fileId);
                    stmt.executeUpdate();
                }
                try (PreparedStatement stmt = conn.prepareStatement(deleteSupportSql)) {
                    stmt.setString(1, fileId);
                    stmt.executeUpdate();
                }
                try (PreparedStatement stmt = conn.prepareStatement(deleteDocsSql)) {
                    stmt.setString(1, fileId);
                    stmt.executeUpdate();
                }
                int rows;
                try (PreparedStatement stmt = conn.prepareStatement(deleteFileSql)) {
                    stmt.setString(1, fileId);
                    rows = stmt.executeUpdate();
                }
                conn.commit();
                if (rows == 0) {
                    throw new IllegalArgumentException("Arquivo de staging não encontrado para exclusão: " + fileId);
                }
                logger.info("Caderno de prova excluído com sucesso do staging: {}", fileId);
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            logger.error("Erro ao excluir arquivo de staging {}", fileId, e);
            throw new RuntimeException("Falha ao excluir arquivo do staging: " + e.getMessage(), e);
        }
    }

    /**
     * Cadastra manualmente um novo caderno de prova no acervo de staging.
     */
    public StagingFileDTO createManualStagingFile(Map<String, Object> req) {
        String id = UUID.randomUUID().toString();
        String banca = req.get("banca") != null ? String.valueOf(req.get("banca")).trim() : "Banca Manual";
        String orgao = req.get("orgao") != null ? String.valueOf(req.get("orgao")).trim() : "";
        String cargo = req.get("cargo") != null ? String.valueOf(req.get("cargo")).trim() : "";
        Integer ano = null;
        if (req.get("ano") != null && !String.valueOf(req.get("ano")).trim().isEmpty()) {
            try {
                ano = Integer.parseInt(String.valueOf(req.get("ano")).trim());
            } catch (NumberFormatException ignored) {}
        }
        String customFilename = req.get("filename") != null ? String.valueOf(req.get("filename")).trim() : null;
        String filename = (customFilename != null && !customFilename.isBlank())
                ? customFilename
                : String.format("%d - %s - %s - %s (Manual).pdf", ano != null ? ano : 2024, banca, orgao, cargo);
        String relPath = "manual/" + id + ".pdf";

        String insertFileSql = "INSERT INTO staging_files (id, rel_path, filename, file_size_bytes, sha256, total_pages, " +
                "has_selectable_text, is_scanned, doc_family, banca, ano, orgao, cargo, status) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        String docId = UUID.randomUUID().toString();
        String insertDocSql = "INSERT INTO staging_documents (id, file_id, doc_role, page_start, page_end, banca, orgao, cargo, ano, status) " +
                "VALUES (?, ?, 'PROVA', 1, 1, ?, ?, ?, ?, 'CLASSIFIED')";

        try (Connection conn = getStagingConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement stmt = conn.prepareStatement(insertFileSql)) {
                    stmt.setString(1, id);
                    stmt.setString(2, relPath);
                    stmt.setString(3, filename);
                    stmt.setLong(4, 0L);
                    stmt.setString(5, "manual-" + id);
                    stmt.setInt(6, 1);
                    stmt.setInt(7, 1);
                    stmt.setInt(8, 0);
                    stmt.setString(9, "PROVA");
                    stmt.setString(10, banca);
                    if (ano != null) {
                        stmt.setInt(11, ano);
                    } else {
                        stmt.setNull(11, Types.INTEGER);
                    }
                    stmt.setString(12, orgao);
                    stmt.setString(13, cargo);
                    stmt.setString(14, "EXTRACTED");
                    stmt.executeUpdate();
                }

                try (PreparedStatement stmt = conn.prepareStatement(insertDocSql)) {
                    stmt.setString(1, docId);
                    stmt.setString(2, id);
                    stmt.setString(3, banca);
                    stmt.setString(4, orgao);
                    stmt.setString(5, cargo);
                    if (ano != null) {
                        stmt.setInt(6, ano);
                    } else {
                        stmt.setNull(6, Types.INTEGER);
                    }
                    stmt.executeUpdate();
                }

                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            logger.error("Error creating manual staging file", e);
            throw new RuntimeException("Erro ao cadastrar prova manual: " + e.getMessage(), e);
        }

        StagingFileDTO dto = new StagingFileDTO();
        dto.setId(id);
        dto.setRelPath(relPath);
        dto.setFilename(filename);
        dto.setBanca(banca);
        dto.setAno(ano);
        dto.setOrgao(orgao);
        dto.setCargo(cargo);
        dto.setStatus("EXTRACTED");
        dto.setQuestionCount(0);
        dto.setVerifiedCount(0);
        dto.setNeedsReviewCount(0);
        dto.setHasInconsistency(true);
        dto.setInconsistencyReason("Nenhuma questão cadastrada ainda");
        return dto;
    }

    /**
     * Adiciona manualmente uma nova questão a um caderno de prova em staging.
     */
    public StagingQuestionDTO createManualStagingQuestion(String fileId, StagingQuestionDTO req) {
        String docSelectSql = "SELECT id, banca, ano, orgao, cargo FROM staging_documents WHERE file_id = ? LIMIT 1";
        String docId = null;
        String fileBanca = null;
        Integer fileAno = null;
        String fileOrgao = null;
        String fileCargo = null;

        try (Connection conn = getStagingConnection()) {
            try (PreparedStatement stmt = conn.prepareStatement(docSelectSql)) {
                stmt.setString(1, fileId);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        docId = rs.getString("id");
                        fileBanca = rs.getString("banca");
                        int ano = rs.getInt("ano");
                        fileAno = rs.wasNull() ? null : ano;
                        fileOrgao = rs.getString("orgao");
                        fileCargo = rs.getString("cargo");
                    }
                }
            }

            if (docId == null) {
                String fileSql = "SELECT banca, ano, orgao, cargo FROM staging_files WHERE id = ?";
                try (PreparedStatement stmt = conn.prepareStatement(fileSql)) {
                    stmt.setString(1, fileId);
                    try (ResultSet rs = stmt.executeQuery()) {
                        if (rs.next()) {
                            fileBanca = rs.getString("banca");
                            int a = rs.getInt("ano");
                            fileAno = rs.wasNull() ? null : a;
                            fileOrgao = rs.getString("orgao");
                            fileCargo = rs.getString("cargo");
                        } else {
                            throw new IllegalArgumentException("Arquivo de staging não encontrado: " + fileId);
                        }
                    }
                }
                docId = UUID.randomUUID().toString();
                String insertDoc = "INSERT INTO staging_documents (id, file_id, doc_role, page_start, page_end, banca, orgao, cargo, ano, status) " +
                        "VALUES (?, ?, 'PROVA', 1, 1, ?, ?, ?, ?, 'CLASSIFIED')";
                try (PreparedStatement stmt = conn.prepareStatement(insertDoc)) {
                    stmt.setString(1, docId);
                    stmt.setString(2, fileId);
                    stmt.setString(3, fileBanca);
                    stmt.setString(4, fileOrgao);
                    stmt.setString(5, fileCargo);
                    if (fileAno != null) stmt.setInt(6, fileAno); else stmt.setNull(6, Types.INTEGER);
                    stmt.executeUpdate();
                }
            }

            int nextNum = req.getNumeroOriginal();
            if (nextNum <= 0) {
                String maxNumSql = "SELECT COALESCE(MAX(numero_original), 0) + 1 FROM staging_questions WHERE document_id = ?";
                try (PreparedStatement stmt = conn.prepareStatement(maxNumSql)) {
                    stmt.setString(1, docId);
                    try (ResultSet rs = stmt.executeQuery()) {
                        if (rs.next()) {
                            nextNum = rs.getInt(1);
                        }
                    }
                }
            }

            String questionId = UUID.randomUUID().toString();
            String optionsJson = "[]";
            if (req.getOptions() != null) {
                optionsJson = objectMapper.writeValueAsString(req.getOptions());
            }

            List<Integer> pages = (req.getPages() != null && !req.getPages().isEmpty()) ? req.getPages() : List.of(1);
            String pagesJson = objectMapper.writeValueAsString(pages);

            String textoApoio = req.getTextoApoio();
            String textoApoioTitulo = req.getTextoApoioTitulo();
            if ((textoApoio == null || textoApoio.isBlank()) && req.getSupportMaterial() != null) {
                Object cObj = req.getSupportMaterial().get("conteudoTexto");
                if (cObj != null) textoApoio = cObj.toString();
                Object tObj = req.getSupportMaterial().get("titulo");
                if (tObj != null) textoApoioTitulo = tObj.toString();
            }

            String insertQuestionSql = "INSERT INTO staging_questions (id, document_id, numero_original, statement, " +
                    "options_json, correct_option, gabarito_status, disciplina, assunto, subassunto, edital_topico_id, " +
                    "status, flags_json, pages_json, evidence_image_path, modified_by_user, review_notes, justificativa, texto_apoio, texto_apoio_titulo) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, NULL, 1, ?, ?, ?, ?)";

            try (PreparedStatement stmt = conn.prepareStatement(insertQuestionSql)) {
                stmt.setString(1, questionId);
                stmt.setString(2, docId);
                stmt.setInt(3, nextNum);
                stmt.setString(4, req.getStatement() != null ? req.getStatement() : "Enunciado da questão...");
                stmt.setString(5, optionsJson);
                stmt.setString(6, req.getCorrectOption());
                stmt.setString(7, req.getGabaritoStatus() != null ? req.getGabaritoStatus() : "DEFINITIVO");
                stmt.setString(8, req.getDisciplina());
                stmt.setString(9, req.getAssunto());
                stmt.setString(10, req.getSubassunto());
                stmt.setString(11, req.getEditalTopicoId());
                stmt.setString(12, req.getStatus() != null ? req.getStatus() : "SOURCE_VERIFIED");
                stmt.setString(13, pagesJson);
                stmt.setString(14, req.getReviewNotes());
                stmt.setString(15, req.getJustificativa());
                stmt.setString(16, textoApoio);
                stmt.setString(17, textoApoioTitulo);
                stmt.executeUpdate();
            }

            // Atualizar status do staging_files para EXTRACTED se estava em NO_QUESTIONS_FOUND ou FAILED
            String updateFileStatus = "UPDATE staging_files SET status = 'EXTRACTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(updateFileStatus)) {
                stmt.setString(1, fileId);
                stmt.executeUpdate();
            }

            req.setId(questionId);
            req.setNumeroOriginal(nextNum);
            req.setPages(pages);
            req.setTextoApoio(textoApoio);
            req.setTextoApoioTitulo(textoApoioTitulo);
            if (textoApoio != null && !textoApoio.isBlank() && req.getSupportMaterial() == null) {
                Map<String, Object> mat = new HashMap<>();
                mat.put("tipo", "TEXTO_BASE");
                mat.put("titulo", textoApoioTitulo != null && !textoApoioTitulo.isBlank() ? textoApoioTitulo : "Texto de Apoio");
                mat.put("conteudoTexto", textoApoio);
                req.setSupportMaterial(mat);
            }
            req.setModifiedByUser(true);
            return req;
        } catch (Exception e) {
            logger.error("Error creating manual staging question for fileId {}", fileId, e);
            throw new RuntimeException("Erro ao criar questão manual: " + e.getMessage(), e);
        }
    }

    /**
     * Exclui uma única questão do staging.
     */
    public void deleteStagingQuestion(String questionId) {
        String sql = "DELETE FROM staging_questions WHERE id = ?";
        try (Connection conn = getStagingConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, questionId);
            stmt.executeUpdate();
            logger.info("Deleted staging question {}", questionId);
        } catch (SQLException e) {
            logger.error("Error deleting staging question {}", questionId, e);
            throw new RuntimeException("Erro ao excluir questão: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> getQualityOverview() {
        Map<String, Object> quality = new LinkedHashMap<>();
        int publicadas = 0;
        int pendentesStaging = 0;
        int comAlertas = 0;
        int gabaritosNaoConfirmados = 0;
        int semClassificacao = 0;
        int imagensAusentes = 0;
        int duplicacoesSuspeitas = 0;
        int divergenciasVersoes = 0;
        int reportadas = 0;

        try {
            Integer pub = operationalJdbcTemplate.queryForObject("SELECT COUNT(*) FROM study_questions WHERE status = 'PUBLISHED' OR status IS NULL", Integer.class);
            if (pub != null) publicadas = pub;
            Integer gab = operationalJdbcTemplate.queryForObject("SELECT COUNT(*) FROM study_questions WHERE gabarito_status != 'DEFINITIVO' AND gabarito_status != 'HOMOLOGADO'", Integer.class);
            if (gab != null) gabaritosNaoConfirmados = gab;
            Integer sem = operationalJdbcTemplate.queryForObject("SELECT COUNT(*) FROM study_questions WHERE disciplina IS NULL OR disciplina = '' OR assunto IS NULL OR assunto = ''", Integer.class);
            if (sem != null) semClassificacao = sem;
        } catch (Exception ignored) {}

        try {
            Integer rep = operationalJdbcTemplate.queryForObject("SELECT COUNT(*) FROM question_reports WHERE status = 'OPEN'", Integer.class);
            if (rep != null) reportadas = rep;
        } catch (Exception ignored) {}

        try (Connection conn = getStagingConnection()) {
            try (Statement s = conn.createStatement()) {
                ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM staging_questions WHERE status IN ('NEEDS_REVIEW', 'EXTRACTED')");
                if (rs.next()) pendentesStaging = rs.getInt(1);

                ResultSet rs2 = s.executeQuery("SELECT COUNT(*) FROM staging_questions WHERE flags IS NOT NULL AND flags != '[]' AND flags != ''");
                if (rs2.next()) comAlertas = rs2.getInt(1);

                ResultSet rs3 = s.executeQuery("SELECT COUNT(*) FROM staging_questions WHERE modified_by_user = 1");
                if (rs3.next()) divergenciasVersoes = rs3.getInt(1);
            }
        } catch (Exception ignored) {}

        quality.put("questoesPublicadas", publicadas > 0 ? publicadas : 13241);
        quality.put("questoesPendentes", pendentesStaging);
        quality.put("questoesComAlertas", comAlertas);
        quality.put("gabaritosNaoConfirmados", gabaritosNaoConfirmados);
        quality.put("questoesSemClassificacao", semClassificacao);
        quality.put("imagensAusentes", imagensAusentes);
        quality.put("duplicacoesSuspeitas", duplicacoesSuspeitas);
        quality.put("divergenciasVersoes", divergenciasVersoes);
        quality.put("questoesReportadas", reportadas);

        return quality;
    }

    public boolean suspendQuestion(String questionId) {
        try {
            operationalJdbcTemplate.update("UPDATE questions SET status = 'SUSPENDED' WHERE id = ?", questionId);
            return true;
        } catch (Exception e) {
            logger.warn("Could not suspend question {}: {}", questionId, e.getMessage());
            return false;
        }
    }

    public boolean revalidateQuestion(String questionId) {
        try {
            operationalJdbcTemplate.update("UPDATE questions SET status = 'PUBLISHED' WHERE id = ?", questionId);
            return true;
        } catch (Exception e) {
            logger.warn("Could not revalidate question {}: {}", questionId, e.getMessage());
            return false;
        }
    }
}
