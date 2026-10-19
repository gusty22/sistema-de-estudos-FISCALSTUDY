package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class QuestionBankService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public QuestionBankService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
    }

    public Map<String, Object> searchQuestions(
            String concursoId,
            String disciplina,
            String assunto,
            String banca,
            Integer ano,
            String cargo,
            String orgao,
            String tipoQuestao,
            String situacao,
            String query,
            Integer page,
            Integer limit
    ) {
        int pageNum = (page != null && page >= 0) ? page : 0;
        int pageSize = (limit != null && limit > 0) ? Math.min(limit, 100) : 15;
        int offset = pageNum * pageSize;

        StringBuilder whereClause = new StringBuilder(" WHERE (q.status = 'VALIDADA' OR q.status IS NULL) ");
        List<Object> params = new ArrayList<>();

        if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase("TODAS")) {
            whereClause.append(" AND LOWER(q.disciplina) = LOWER(?) ");
            params.add(disciplina.trim());
        }

        if (assunto != null && !assunto.isBlank() && !assunto.equalsIgnoreCase("TODOS")) {
            whereClause.append(" AND (LOWER(q.assunto) LIKE ? OR LOWER(q.assunto) = LOWER(?)) ");
            params.add("%" + assunto.trim().toLowerCase() + "%");
            params.add(assunto.trim());
        }

        if (banca != null && !banca.isBlank() && !banca.equalsIgnoreCase("TODAS")) {
            whereClause.append(" AND LOWER(q.banca) = LOWER(?) ");
            params.add(banca.trim());
        }

        if (ano != null && ano > 0) {
            whereClause.append(" AND q.ano = ? ");
            params.add(ano);
        }

        if (cargo != null && !cargo.isBlank() && !cargo.equalsIgnoreCase("TODOS")) {
            whereClause.append(" AND LOWER(q.cargo) LIKE ? ");
            params.add("%" + cargo.trim().toLowerCase() + "%");
        }

        if (orgao != null && !orgao.isBlank() && !orgao.equalsIgnoreCase("TODOS")) {
            whereClause.append(" AND LOWER(q.orgao) LIKE ? ");
            params.add("%" + orgao.trim().toLowerCase() + "%");
        }

        if (tipoQuestao != null && !tipoQuestao.isBlank() && !tipoQuestao.equalsIgnoreCase("TODOS")) {
            if (tipoQuestao.equalsIgnoreCase("CERTO_ERRADO") || tipoQuestao.equalsIgnoreCase("CE")) {
                whereClause.append(" AND (q.options_json LIKE '%Certo%' OR q.options_json LIKE '%Errado%') ");
            } else if (tipoQuestao.equalsIgnoreCase("MULTIPLA_ESCOLHA") || tipoQuestao.equalsIgnoreCase("ME")) {
                whereClause.append(" AND (q.options_json NOT LIKE '%Certo%' AND q.options_json NOT LIKE '%Errado%') ");
            }
        }

        if (query != null && !query.isBlank()) {
            whereClause.append(" AND (LOWER(q.statement) LIKE ? OR LOWER(q.id) LIKE ?) ");
            String pat = "%" + query.trim().toLowerCase() + "%";
            params.add(pat);
            params.add(pat);
        }

        // Situação da Questão (baseado no event_store e favoritos)
        if (situacao != null && !situacao.isBlank() && !situacao.equalsIgnoreCase("TODAS")) {
            switch (situacao.toUpperCase()) {
                case "NUNCA_RESPONDIDA" -> {
                    whereClause.append(" AND q.id NOT IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED') ");
                }
                case "RESPONDIDA_INCORRETAMENTE", "ERRADAS" -> {
                    whereClause.append(" AND q.id IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":false%') ");
                }
                case "ACERTADA_BAIXA_CONFIANCA", "BAIXA_CONFIANCA" -> {
                    whereClause.append(" AND q.id IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":true%' AND (payload_json LIKE '%\"confidenceLevel\":1%' OR payload_json LIKE '%\"confidenceLevel\":2%')) ");
                }
                case "FAVORITA", "FAVORITAS" -> {
                    whereClause.append(" AND q.id IN (SELECT question_id FROM favorite_questions) ");
                }
                case "PENDENTE_REVISAO" -> {
                    whereClause.append(" AND q.id IN (SELECT source_id FROM revision_calendar WHERE status = 'PENDENTE') ");
                }
            }
        }

        // 1. Contagem Total de Itens Elegíveis (Sem duplicatas)
        String countSql = "SELECT COUNT(DISTINCT q.id) FROM questions q " + whereClause;
        Integer totalCount = jdbcTemplate.queryForObject(countSql, Integer.class, params.toArray());
        int total = totalCount != null ? totalCount : 0;

        // 2. Busca paginada
        String selectSql = """
            SELECT q.id, q.statement, q.options_json, q.disciplina, q.assunto, q.banca, q.ano, q.orgao, q.cargo,
                   q.gabarito_status, q.numero_original, q.arquivo_origem,
                   (SELECT COUNT(*) FROM favorite_questions f WHERE f.question_id = q.id) AS is_favorite,
                   (SELECT COUNT(*) FROM event_store e WHERE e.aggregate_id = q.id AND e.event_type = 'ANSWER_SUBMITTED') AS total_attempts,
                   (SELECT COUNT(*) FROM event_store e WHERE e.aggregate_id = q.id AND e.event_type = 'ANSWER_SUBMITTED' AND e.payload_json LIKE '%\"isCorrect\":true%') AS total_correct
            FROM questions q
        """ + whereClause + " ORDER BY q.ano DESC, q.id ASC LIMIT ? OFFSET ?";

        List<Object> selectParams = new ArrayList<>(params);
        selectParams.add(pageSize);
        selectParams.add(offset);

        List<Map<String, Object>> questions = jdbcTemplate.query(selectSql, (rs, rowNum) -> {
            Map<String, Object> map = new HashMap<>();
            map.put("questionId", rs.getString("id"));
            map.put("statement", rs.getString("statement"));
            map.put("discipline", rs.getString("disciplina"));
            map.put("topic", rs.getString("assunto"));
            map.put("board", rs.getString("banca"));
            map.put("year", rs.getInt("ano"));
            map.put("orgao", rs.getString("orgao"));
            map.put("cargo", rs.getString("cargo"));
            map.put("gabaritoStatus", rs.getString("gabarito_status") != null ? rs.getString("gabarito_status") : "DEFINITIVO");
            map.put("numeroOriginal", rs.getObject("numero_original"));
            map.put("arquivoOrigem", rs.getString("arquivo_origem"));
            map.put("isFavorite", rs.getInt("is_favorite") > 0);

            int totalAtt = rs.getInt("total_attempts");
            int totalCorr = rs.getInt("total_correct");
            map.put("tentativasTotal", totalAtt);
            map.put("acertosTotal", totalCorr);
            map.put("taxaAcertoPessoal", totalAtt > 0 ? Math.round(((double) totalCorr / totalAtt) * 100) : null);

            // Parse options sem expor o gabarito
            try {
                String optJson = rs.getString("options_json");
                if (optJson != null && !optJson.isBlank()) {
                    List<String> options = objectMapper.readValue(optJson, new TypeReference<List<String>>() {});
                    map.put("options", options);
                    boolean isCe = options.stream().anyMatch(o -> o.contains("Certo") || o.contains("Errado"));
                    map.put("tipoQuestao", isCe ? "CERTO_ERRADO" : "MULTIPLA_ESCOLHA");
                } else {
                    map.put("options", Collections.emptyList());
                    map.put("tipoQuestao", "MULTIPLA_ESCOLHA");
                }
            } catch (Exception e) {
                map.put("options", Collections.emptyList());
                map.put("tipoQuestao", "MULTIPLA_ESCOLHA");
            }

            return map;
        }, selectParams.toArray());

        Map<String, Object> response = new HashMap<>();
        response.put("totalElements", total);
        response.put("page", pageNum);
        response.put("limit", pageSize);
        response.put("totalPages", (int) Math.ceil((double) total / pageSize));
        response.put("questions", questions);
        return response;
    }

    public Map<String, Object> getFiltersMetadata() {
        Map<String, Object> metadata = new HashMap<>();
        try {
            metadata.put("bancas", jdbcTemplate.queryForList("SELECT DISTINCT banca FROM questions WHERE banca IS NOT NULL AND TRIM(banca) != '' ORDER BY banca", String.class));
            metadata.put("anos", jdbcTemplate.queryForList("SELECT DISTINCT ano FROM questions WHERE ano IS NOT NULL AND ano > 1990 ORDER BY ano DESC", Integer.class));
            metadata.put("orgaos", jdbcTemplate.queryForList("SELECT DISTINCT orgao FROM questions WHERE orgao IS NOT NULL AND TRIM(orgao) != '' ORDER BY orgao LIMIT 50", String.class));
            metadata.put("cargos", jdbcTemplate.queryForList("SELECT DISTINCT cargo FROM questions WHERE cargo IS NOT NULL AND TRIM(cargo) != '' ORDER BY cargo LIMIT 50", String.class));
            metadata.put("disciplinas", jdbcTemplate.queryForList("SELECT DISTINCT disciplina FROM questions WHERE disciplina IS NOT NULL AND TRIM(disciplina) != '' ORDER BY disciplina", String.class));
        } catch (Exception e) {
            metadata.put("bancas", List.of("FGV", "CEBRASPE", "VUNESP", "FCC", "CESGRANRIO"));
            metadata.put("anos", List.of(2026, 2025, 2024, 2023, 2022));
            metadata.put("orgaos", Collections.emptyList());
            metadata.put("cargos", Collections.emptyList());
            metadata.put("disciplinas", Collections.emptyList());
        }
        return metadata;
    }

    public boolean toggleFavorite(String questionId) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM favorite_questions WHERE question_id = ?", Integer.class, questionId);
        if (count != null && count > 0) {
            jdbcTemplate.update("DELETE FROM favorite_questions WHERE question_id = ?", questionId);
            return false;
        } else {
            jdbcTemplate.update("INSERT OR IGNORE INTO favorite_questions (question_id) VALUES (?)", questionId);
            return true;
        }
    }

    public void reportQuestion(String questionId, String motivo, String descricao) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update(
                "INSERT INTO question_reports (id, question_id, motivo, descricao) VALUES (?, ?, ?, ?)",
                id, questionId, motivo, descricao
        );
    }

    // =========================================================================
    // CADERNOS E SIMULADOS (T19 & T23)
    // =========================================================================
    public List<Map<String, Object>> getNotebooks(String concursoId) {
        ensureNotebooksTable();
        String sql = "SELECT * FROM study_notebooks ORDER BY created_at DESC";
        List<Map<String, Object>> dbNotebooks = jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", rs.getString("id"));
            map.put("nome", rs.getString("nome"));
            map.put("concursoId", rs.getString("concurso_id"));
            map.put("tipo", rs.getString("tipo"));
            map.put("modoResolucao", rs.getString("modo_resolucao"));
            map.put("quantidade", rs.getInt("quantidade"));
            map.put("createdAt", rs.getString("created_at"));
            map.put("lastExecutedAt", rs.getString("last_executed_at"));
            try {
                String filtros = rs.getString("filtros_json");
                if (filtros != null) {
                    map.put("filtros", objectMapper.readValue(filtros, Map.class));
                }
            } catch (Exception ignored) {}
            return map;
        });

        // Cadernos dinâmicos pré-computados
        List<Map<String, Object>> result = new ArrayList<>();
        
        // 1. Caderno Dinâmico de Erros
        Integer countErradas = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT aggregate_id) FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":false%'",
                Integer.class
        );
        Map<String, Object> cadErros = new HashMap<>();
        cadErros.put("id", "dyn_erros");
        cadErros.put("nome", "Caderno de Erros Recentes");
        cadErros.put("tipo", "DINAMICO");
        cadErros.put("modoResolucao", "PRATICA");
        cadErros.put("quantidade", countErradas != null ? countErradas : 0);
        cadErros.put("origem", "Dinâmico");
        cadErros.put("lastExecutedAt", "Hoje");
        result.add(cadErros);

        // 2. Caderno Dinâmico de Acertos Inseguros
        Integer countInseguros = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT aggregate_id) FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":true%' AND (payload_json LIKE '%\"confidenceLevel\":1%' OR payload_json LIKE '%\"confidenceLevel\":2%')",
                Integer.class
        );
        Map<String, Object> cadInseguros = new HashMap<>();
        cadInseguros.put("id", "dyn_inseguros");
        cadInseguros.put("nome", "Acertos com Baixa Confiança");
        cadInseguros.put("tipo", "DINAMICO");
        cadInseguros.put("modoResolucao", "DIAGNOSTICO");
        cadInseguros.put("quantidade", countInseguros != null ? countInseguros : 0);
        cadInseguros.put("origem", "Dinâmico");
        cadInseguros.put("lastExecutedAt", "Ontem");
        result.add(cadInseguros);

        // 3. Cadernos Salvos pelo Usuário
        result.addAll(dbNotebooks);
        return result;
    }

    public Map<String, Object> saveNotebook(Map<String, Object> payload) {
        ensureNotebooksTable();
        String id = (String) payload.getOrDefault("id", "cad_" + UUID.randomUUID().toString().substring(0, 8));
        String nome = (String) payload.getOrDefault("nome", "Novo Caderno de Questões");
        String concursoId = (String) payload.get("concursoId");
        String tipo = (String) payload.getOrDefault("tipo", "DINAMICO");
        String modo = (String) payload.getOrDefault("modoResolucao", "PRATICA");
        int quantidade = payload.get("quantidade") instanceof Number ? ((Number) payload.get("quantidade")).intValue() : 20;

        String filtrosJson = null;
        try {
            if (payload.containsKey("filtros")) {
                filtrosJson = objectMapper.writeValueAsString(payload.get("filtros"));
            }
        } catch (Exception ignored) {}

        String sql = """
            INSERT INTO study_notebooks (id, nome, concurso_id, tipo, modo_resolucao, filtros_json, quantidade, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                nome = excluded.nome,
                modo_resolucao = excluded.modo_resolucao,
                filtros_json = excluded.filtros_json,
                quantidade = excluded.quantidade
        """;
        jdbcTemplate.update(sql, id, nome, concursoId, tipo, modo, filtrosJson, quantidade);

        Map<String, Object> res = new HashMap<>(payload);
        res.put("id", id);
        return res;
    }

    private void ensureNotebooksTable() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS study_notebooks (
                    id TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    concurso_id TEXT,
                    tipo TEXT NOT NULL DEFAULT 'DINAMICO',
                    modo_resolucao TEXT NOT NULL DEFAULT 'PRATICA',
                    filtros_json TEXT,
                    questoes_ids_json TEXT,
                    quantidade INTEGER DEFAULT 20,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_executed_at TEXT
                )
            """);
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS favorite_questions (question_id TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS question_reports (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, motivo TEXT NOT NULL, descricao TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
        } catch (Exception ignored) {}
    }
}
