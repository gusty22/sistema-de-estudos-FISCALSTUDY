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
            Boolean editalOnly,
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

        if (Boolean.TRUE.equals(editalOnly) && concursoId != null && !concursoId.isBlank()) {
            whereClause.append(" AND EXISTS (SELECT 1 FROM edital_topicos et WHERE et.concurso_id = ? AND (LOWER(et.disciplina) = LOWER(q.disciplina) OR (LOWER(et.disciplina) LIKE '%portug%' AND LOWER(q.disciplina) LIKE '%portug%'))) ");
            params.add(concursoId.trim());
        }

        if (query != null && !query.isBlank()) {
            whereClause.append(" AND (LOWER(q.enunciado) LIKE ? OR LOWER(q.id) LIKE ?) ");
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
            SELECT q.id, q.enunciado AS statement, q.options_json, q.disciplina, q.assunto, q.banca, q.ano, q.orgao, q.cargo,
                   q.gabarito_status, q.numero_original, q.arquivo_origem,
                   (SELECT COUNT(*) FROM favorite_questions f WHERE f.question_id = q.id) AS is_favorite,
                   (SELECT COUNT(*) FROM event_store e WHERE e.aggregate_id = q.id AND e.event_type = 'ANSWER_SUBMITTED') AS total_attempts,
                   (SELECT COUNT(*) FROM event_store e WHERE e.aggregate_id = q.id AND e.event_type = 'ANSWER_SUBMITTED' AND e.payload_json LIKE '%"isCorrect":true%') AS total_correct
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
        return getFiltersMetadata(null, null, null, null, null, null, null, null, null, null, false);
    }

    public Map<String, Object> getFiltersMetadata(
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
            Boolean editalOnly
    ) {
        Map<String, Object> metadata = new HashMap<>();

        // 1. Disciplinas previstas no Edital (com indicação real de cobertura no banco de questões)
        List<Map<String, Object>> editalDisciplinas = new ArrayList<>();
        if (concursoId != null && !concursoId.isBlank()) {
            String editalSql = "SELECT DISTINCT disciplina FROM edital_topicos WHERE concurso_id = ? ORDER BY disciplina";
            List<String> rawEdital = jdbcTemplate.queryForList(editalSql, String.class, concursoId.trim());
            for (String ed : rawEdital) {
                // Checa quantas questões existem no banco para esta disciplina do edital
                String countQSql = "SELECT COUNT(*) FROM questions WHERE (status = 'VALIDADA' OR status IS NULL) AND (LOWER(disciplina) = LOWER(?) OR (LOWER(?) LIKE '%portug%' AND LOWER(disciplina) LIKE '%portug%'))";
                Integer qCount = jdbcTemplate.queryForObject(countQSql, Integer.class, ed, ed);
                Map<String, Object> item = new HashMap<>();
                item.put("nome", ed);
                item.put("questoesDisponiveis", qCount != null ? qCount : 0);
                editalDisciplinas.add(item);
            }
        }
        metadata.put("editalDisciplinas", editalDisciplinas);

        // Cláusula base para metadados dinâmicos respeitando os filtros combinados
        // Construímos sub-consultas que filtram conforme a seleção atual (eliminando incompatibilidades)
        StringBuilder baseWhere = new StringBuilder(" WHERE (q.status = 'VALIDADA' OR q.status IS NULL) ");
        List<Object> baseParams = new ArrayList<>();

        if (Boolean.TRUE.equals(editalOnly) && concursoId != null && !concursoId.isBlank()) {
            baseWhere.append(" AND EXISTS (SELECT 1 FROM edital_topicos et WHERE et.concurso_id = ? AND (LOWER(et.disciplina) = LOWER(q.disciplina) OR (LOWER(et.disciplina) LIKE '%portug%' AND LOWER(q.disciplina) LIKE '%portug%'))) ");
            baseParams.add(concursoId.trim());
        }

        if (query != null && !query.isBlank()) {
            baseWhere.append(" AND (LOWER(q.enunciado) LIKE ? OR LOWER(q.id) LIKE ?) ");
            String pat = "%" + query.trim().toLowerCase() + "%";
            baseParams.add(pat);
            baseParams.add(pat);
        }

        if (situacao != null && !situacao.isBlank() && !situacao.equalsIgnoreCase("TODAS")) {
            switch (situacao.toUpperCase()) {
                case "NUNCA_RESPONDIDA" -> {
                    baseWhere.append(" AND q.id NOT IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED') ");
                }
                case "RESPONDIDA_INCORRETAMENTE", "ERRADAS" -> {
                    baseWhere.append(" AND q.id IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":false%') ");
                }
                case "ACERTADA_BAIXA_CONFIANCA", "BAIXA_CONFIANCA" -> {
                    baseWhere.append(" AND q.id IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":true%' AND (payload_json LIKE '%\"confidenceLevel\":1%' OR payload_json LIKE '%\"confidenceLevel\":2%')) ");
                }
                case "FAVORITA", "FAVORITAS" -> {
                    baseWhere.append(" AND q.id IN (SELECT question_id FROM favorite_questions) ");
                }
                case "PENDENTE_REVISAO" -> {
                    baseWhere.append(" AND q.id IN (SELECT source_id FROM revision_calendar WHERE status = 'PENDENTE') ");
                }
            }
        }

        // Consultas dinâmicas de cada dimensão combinando os filtros
        // A. Disciplinas disponíveis considerando banca, ano, etc.
        StringBuilder discWhere = new StringBuilder(baseWhere);
        List<Object> discParams = new ArrayList<>(baseParams);
        if (banca != null && !banca.isBlank() && !banca.equalsIgnoreCase("TODAS")) {
            discWhere.append(" AND LOWER(q.banca) = LOWER(?) ");
            discParams.add(banca.trim());
        }
        if (ano != null && ano > 0) {
            discWhere.append(" AND q.ano = ? ");
            discParams.add(ano);
        }
        if (cargo != null && !cargo.isBlank() && !cargo.equalsIgnoreCase("TODOS")) {
            discWhere.append(" AND LOWER(q.cargo) LIKE ? ");
            discParams.add("%" + cargo.trim().toLowerCase() + "%");
        }
        if (orgao != null && !orgao.isBlank() && !orgao.equalsIgnoreCase("TODOS")) {
            discWhere.append(" AND LOWER(q.orgao) LIKE ? ");
            discParams.add("%" + orgao.trim().toLowerCase() + "%");
        }

        List<String> disciplinas = jdbcTemplate.queryForList(
                "SELECT DISTINCT q.disciplina FROM questions q " + discWhere + " AND q.disciplina IS NOT NULL AND TRIM(q.disciplina) != '' ORDER BY q.disciplina",
                String.class,
                discParams.toArray()
        );
        metadata.put("disciplinas", disciplinas);

        // B. Bancas disponíveis considerando disciplina, ano, etc.
        StringBuilder bancaWhere = new StringBuilder(baseWhere);
        List<Object> bancaParams = new ArrayList<>(baseParams);
        if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase("TODAS")) {
            bancaWhere.append(" AND LOWER(q.disciplina) = LOWER(?) ");
            bancaParams.add(disciplina.trim());
        }
        if (ano != null && ano > 0) {
            bancaWhere.append(" AND q.ano = ? ");
            bancaParams.add(ano);
        }
        if (cargo != null && !cargo.isBlank() && !cargo.equalsIgnoreCase("TODOS")) {
            bancaWhere.append(" AND LOWER(q.cargo) LIKE ? ");
            bancaParams.add("%" + cargo.trim().toLowerCase() + "%");
        }
        if (orgao != null && !orgao.isBlank() && !orgao.equalsIgnoreCase("TODOS")) {
            bancaWhere.append(" AND LOWER(q.orgao) LIKE ? ");
            bancaParams.add("%" + orgao.trim().toLowerCase() + "%");
        }

        List<String> bancas = jdbcTemplate.queryForList(
                "SELECT DISTINCT q.banca FROM questions q " + bancaWhere + " AND q.banca IS NOT NULL AND TRIM(q.banca) != '' ORDER BY q.banca",
                String.class,
                bancaParams.toArray()
        );
        metadata.put("bancas", bancas);

        // C. Anos disponíveis considerando disciplina, banca, etc.
        StringBuilder anoWhere = new StringBuilder(baseWhere);
        List<Object> anoParams = new ArrayList<>(baseParams);
        if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase("TODAS")) {
            anoWhere.append(" AND LOWER(q.disciplina) = LOWER(?) ");
            anoParams.add(disciplina.trim());
        }
        if (banca != null && !banca.isBlank() && !banca.equalsIgnoreCase("TODAS")) {
            anoWhere.append(" AND LOWER(q.banca) = LOWER(?) ");
            anoParams.add(banca.trim());
        }
        if (cargo != null && !cargo.isBlank() && !cargo.equalsIgnoreCase("TODOS")) {
            anoWhere.append(" AND LOWER(q.cargo) LIKE ? ");
            anoParams.add("%" + cargo.trim().toLowerCase() + "%");
        }
        if (orgao != null && !orgao.isBlank() && !orgao.equalsIgnoreCase("TODOS")) {
            anoWhere.append(" AND LOWER(q.orgao) LIKE ? ");
            anoParams.add("%" + orgao.trim().toLowerCase() + "%");
        }

        List<Integer> anos = jdbcTemplate.queryForList(
                "SELECT DISTINCT q.ano FROM questions q " + anoWhere + " AND q.ano IS NOT NULL AND q.ano > 1990 ORDER BY q.ano DESC",
                Integer.class,
                anoParams.toArray()
        );
        metadata.put("anos", anos);

        // D. Órgãos disponíveis considerando filtros atuais
        StringBuilder orgaoWhere = new StringBuilder(baseWhere);
        List<Object> orgaoParams = new ArrayList<>(baseParams);
        if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase("TODAS")) {
            orgaoWhere.append(" AND LOWER(q.disciplina) = LOWER(?) ");
            orgaoParams.add(disciplina.trim());
        }
        if (banca != null && !banca.isBlank() && !banca.equalsIgnoreCase("TODAS")) {
            orgaoWhere.append(" AND LOWER(q.banca) = LOWER(?) ");
            orgaoParams.add(banca.trim());
        }
        if (ano != null && ano > 0) {
            orgaoWhere.append(" AND q.ano = ? ");
            orgaoParams.add(ano);
        }

        List<String> orgaos = jdbcTemplate.queryForList(
                "SELECT DISTINCT q.orgao FROM questions q " + orgaoWhere + " AND q.orgao IS NOT NULL AND TRIM(q.orgao) != '' ORDER BY q.orgao",
                String.class,
                orgaoParams.toArray()
        );
        metadata.put("orgaos", orgaos);

        // E. Cargos disponíveis considerando filtros atuais
        StringBuilder cargoWhere = new StringBuilder(baseWhere);
        List<Object> cargoParams = new ArrayList<>(baseParams);
        if (disciplina != null && !disciplina.isBlank() && !disciplina.equalsIgnoreCase("TODAS")) {
            cargoWhere.append(" AND LOWER(q.disciplina) = LOWER(?) ");
            cargoParams.add(disciplina.trim());
        }
        if (banca != null && !banca.isBlank() && !banca.equalsIgnoreCase("TODAS")) {
            cargoWhere.append(" AND LOWER(q.banca) = LOWER(?) ");
            cargoParams.add(banca.trim());
        }
        if (ano != null && ano > 0) {
            cargoWhere.append(" AND q.ano = ? ");
            cargoParams.add(ano);
        }

        List<String> cargos = jdbcTemplate.queryForList(
                "SELECT DISTINCT q.cargo FROM questions q " + cargoWhere + " AND q.cargo IS NOT NULL AND TRIM(q.cargo) != '' ORDER BY q.cargo",
                String.class,
                cargoParams.toArray()
        );
        metadata.put("cargos", cargos);

        // F. Tipos de questão reais disponíveis
        List<String> tiposReais = new ArrayList<>();
        tiposReais.add("MULTIPLA_ESCOLHA");
        // Verifica se há alguma CE sob as condições atuais
        Integer countCe = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM questions q " + baseWhere + " AND (q.options_json LIKE '%Certo%' OR q.options_json LIKE '%Errado%')",
                Integer.class,
                baseParams.toArray()
        );
        if (countCe != null && countCe > 0) {
            tiposReais.add("CERTO_ERRADO");
        }
        metadata.put("tiposQuestao", tiposReais);

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
