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

    public StagingDatabaseService(JdbcTemplate operationalJdbcTemplate) {
        this.operationalJdbcTemplate = operationalJdbcTemplate;
        this.objectMapper = new ObjectMapper();

        Path dbPath = Paths.get("..", "db", "staging.db").toAbsolutePath().normalize();
        if (!Files.exists(dbPath)) {
            dbPath = Paths.get("db", "staging.db").toAbsolutePath().normalize();
        }
        this.stagingDbPath = dbPath;

        this.acervoRoot = Paths.get("C:", "Users", "washi", "Downloads", "provas").toAbsolutePath().normalize();
        this.evidenceCacheDir = Paths.get("target", "staging_pipeline", "evidence_cache").toAbsolutePath().normalize();

        try {
            Files.createDirectories(this.evidenceCacheDir);
        } catch (IOException e) {
            logger.warn("Could not create evidence cache dir: {}", e.getMessage());
        }

        logger.info("StagingDatabaseService initialized with staging DB at: {}", this.stagingDbPath);
    }

    private Connection getStagingConnection() throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + stagingDbPath.toString());
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
                dto.setStatus(rs.getString("status"));
                dto.setQuestionCount(rs.getInt("question_count"));
                dto.setVerifiedCount(rs.getInt("verified_count"));
                dto.setNeedsReviewCount(rs.getInt("needs_review_count"));
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
                "       q.modified_by_user, q.review_notes, " +
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
                "modified_by_user = 1, " +
                "updated_at = CURRENT_TIMESTAMP " +
                "WHERE id = ?";

        try (Connection conn = getStagingConnection()) {
            String optionsJson = null;
            if (req.getOptions() != null) {
                optionsJson = objectMapper.writeValueAsString(req.getOptions());
            }

            try (PreparedStatement uStmt = conn.prepareStatement(updateSql)) {
                uStmt.setString(1, req.getStatement());
                uStmt.setString(2, optionsJson);
                uStmt.setString(3, req.getCorrectOption());
                uStmt.setString(4, req.getGabaritoStatus());
                uStmt.setString(5, req.getDisciplina());
                uStmt.setString(6, req.getAssunto());
                uStmt.setString(7, req.getSubassunto());
                uStmt.setString(8, req.getEditalTopicoId());
                uStmt.setString(9, req.getStatus());
                uStmt.setString(10, req.getReviewNotes());
                uStmt.setString(11, questionId);

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
                        dto.setModifiedByUser(true);
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
                    String pagesJson = rs.getString("pages_json");
                    if (pagesJson != null && !pagesJson.isBlank()) {
                        List<Integer> pages = objectMapper.readValue(pagesJson, new TypeReference<List<Integer>>() {});
                        if (!pages.isEmpty()) {
                            pageNum = pages.get(0);
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
}
