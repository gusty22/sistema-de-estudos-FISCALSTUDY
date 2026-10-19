package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class QuestionRepositoryImpl implements QuestionRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public QuestionRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
    }

    @jakarta.annotation.PostConstruct
    public void ensureSchemaCompatibility() {
        try {
            jdbcTemplate.execute("ALTER TABLE questions ADD COLUMN gabarito_status TEXT DEFAULT 'DEFINITIVO'");
        } catch (Exception ignored) {
            // Column already exists
        }
    }

    @Override
    public Optional<Question> findNextAvailableQuestion() {
        return findNextAvailableQuestion(null, null, null, null, false);
    }

    @Override
    public Optional<Question> findNextAvailableQuestion(String sessionId, String disciplina) {
        return findNextAvailableQuestion(sessionId, null, disciplina, null, false);
    }

    @Override
    public Optional<Question> findNextAvailableQuestion(String sessionId, String concursoId, String disciplina, String assunto, Boolean includeAnswered) {
        return findQuestionBatch(sessionId, concursoId, disciplina, assunto, includeAnswered, 25).stream().findFirst();
    }

    @Override
    public List<Question> findQuestionBatch(String sessionId, String concursoId, String disciplina, String assunto, Boolean includeAnswered, int limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM questions WHERE 1=1 ");
        List<Object> params = new java.util.ArrayList<>();

        if (concursoId != null && !concursoId.isBlank()) {
            boolean matchedConcurso = false;
            try {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT banca, ano, cargo, orgao FROM concursos WHERE id = ?", concursoId.trim());
                if (!rows.isEmpty()) {
                    Map<String, Object> cRow = rows.get(0);
                    Object cargo = cRow.get("cargo");
                    Object orgao = cRow.get("orgao");

                    sql.append("AND (");
                    sql.append("disciplina IN (SELECT DISTINCT disciplina FROM edital_topicos WHERE concurso_id = ?) ");
                    params.add(concursoId.trim());

                    if (cargo != null && !String.valueOf(cargo).isBlank()) {
                        sql.append("OR LOWER(cargo) LIKE ? ");
                        params.add("%" + String.valueOf(cargo).trim().toLowerCase() + "%");
                    }
                    if (orgao != null && !String.valueOf(orgao).isBlank()) {
                        sql.append("OR LOWER(orgao) LIKE ? ");
                        params.add("%" + String.valueOf(orgao).trim().toLowerCase() + "%");
                    }
                    sql.append(") ");
                    matchedConcurso = true;
                }
            } catch (Exception ignored) {}

            if (!matchedConcurso) {
                sql.append("AND (cargo LIKE ? OR orgao LIKE ? OR disciplina LIKE ?) ");
                String pat = "%" + concursoId.trim() + "%";
                params.add(pat);
                params.add(pat);
                params.add(pat);
            }
        }

        if (disciplina != null && !disciplina.isBlank()) {
            sql.append("AND (LOWER(disciplina) = LOWER(?) OR LOWER(disciplina) LIKE ?) ");
            params.add(disciplina.trim());
            params.add("%" + disciplina.trim().toLowerCase() + "%");
        }

        if (assunto != null && !assunto.isBlank()) {
            sql.append("AND (LOWER(assunto) = LOWER(?) OR LOWER(assunto) LIKE ?) ");
            params.add(assunto.trim());
            params.add("%" + assunto.trim().toLowerCase() + "%");
        }

        if ((includeAnswered == null || !includeAnswered) && sessionId != null && !sessionId.isBlank()) {
            sql.append("AND id NOT IN (SELECT aggregate_id FROM event_store WHERE session_id = ? AND event_type = 'ANSWER_SUBMITTED') ");
            params.add(sessionId.trim());
        }

        sql.append("AND (status = 'VALIDADA' OR status IS NULL) ");

        int maxLimit = Math.max(1, Math.min(limit, 50));
        sql.append("ORDER BY RANDOM() LIMIT ").append(maxLimit);

        List<Question> questions = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            try {
                List<String> options = null;
                String optionsJson = rs.getString("options_json");
                if (optionsJson != null && !optionsJson.isEmpty()) {
                    options = objectMapper.readValue(optionsJson, new TypeReference<List<String>>(){});
                    if (options != null) {
                        options.sort((opt1, opt2) -> {
                            String l1 = (opt1 != null && !opt1.isBlank()) ? opt1.trim().substring(0, 1).toUpperCase() : "";
                            String l2 = (opt2 != null && !opt2.isBlank()) ? opt2.trim().substring(0, 1).toUpperCase() : "";
                            return l1.compareTo(l2);
                        });
                    }
                }

                String rawStatus = null;
                try {
                    rawStatus = rs.getString("gabarito_status");
                } catch (Exception ignored) {}
                com.fiscalstudy.backend.domain.GabaritoStatus gabaritoStatus = 
                        com.fiscalstudy.backend.domain.GabaritoStatus.fromString(rawStatus);
                
                String orgao = null;
                try {
                    orgao = rs.getString("orgao");
                } catch (Exception ignored) {}
                String cargo = null;
                try {
                    cargo = rs.getString("cargo");
                } catch (Exception ignored) {}

                String justificativa = null;
                try {
                    justificativa = rs.getString("justificativa");
                } catch (Exception ignored) {}
                String textoApoio = null;
                try {
                    textoApoio = rs.getString("texto_apoio");
                } catch (Exception ignored) {}
                String textoApoioTitulo = null;
                try {
                    textoApoioTitulo = rs.getString("texto_apoio_titulo");
                } catch (Exception ignored) {}
                String qStatus = null;
                try {
                    qStatus = rs.getString("status");
                } catch (Exception ignored) {}
                Integer numOrig = null;
                try {
                    int no = rs.getInt("numero_original");
                    if (!rs.wasNull()) numOrig = no;
                } catch (Exception ignored) {}
                String arqOrig = null;
                try {
                    arqOrig = rs.getString("arquivo_origem");
                } catch (Exception ignored) {}

                return new Question(
                        rs.getString("id"),
                        rs.getString("enunciado"),
                        options,
                        rs.getString("correct_option"),
                        gabaritoStatus,
                        rs.getString("disciplina"),
                        rs.getString("assunto"),
                        rs.getString("banca"),
                        rs.getInt("ano"),
                        orgao,
                        cargo,
                        null,
                        justificativa,
                        textoApoio,
                        textoApoioTitulo,
                        qStatus,
                        numOrig,
                        arqOrig
                );
            } catch (Exception e) {
                throw new RuntimeException("Failed to map question", e);
            }
        }, params.toArray());

        List<Question> validQuestions = questions.stream()
                .filter(this::isStructurallyValid)
                .collect(java.util.stream.Collectors.toList());

        enrichWithSupportMaterials(validQuestions);
        return validQuestions;
    }

    private void enrichWithSupportMaterials(List<Question> questionList) {
        if (questionList == null || questionList.isEmpty()) return;
        List<String> ids = questionList.stream().map(Question::getId).collect(java.util.stream.Collectors.toList());
        String inSql = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String matSql = "SELECT qsm.question_id, m.id, m.tipo, m.titulo, m.conteudo_texto, m.media_path, m.pagina_inicio, m.pagina_fim " +
                "FROM question_support_materials qsm " +
                "JOIN support_materials m ON qsm.material_id = m.id " +
                "WHERE qsm.question_id IN (" + inSql + ")";
        try {
            Map<String, Map<String, Object>> matMap = new HashMap<>();
            jdbcTemplate.query(matSql, rs -> {
                String qId = rs.getString("question_id");
                Map<String, Object> m = new HashMap<>();
                m.put("id", rs.getString("id"));
                m.put("tipo", rs.getString("tipo"));
                m.put("titulo", rs.getString("titulo"));
                m.put("conteudoTexto", rs.getString("conteudo_texto"));
                m.put("mediaPath", rs.getString("media_path"));
                m.put("paginaInicio", rs.getInt("pagina_inicio"));
                m.put("paginaFim", rs.getInt("pagina_fim"));
                matMap.put(qId, m);
            }, ids.toArray());

            for (int i = 0; i < questionList.size(); i++) {
                Question q = questionList.get(i);
                if (matMap.containsKey(q.getId())) {
                    Question enriched = new Question(
                            q.getId(),
                            q.getStatement(),
                            q.getOptions(),
                            q.getCorrectOption(),
                            q.getGabaritoStatus(),
                            q.getDiscipline(),
                            q.getTopic(),
                            q.getBoard(),
                            q.getYear(),
                            q.getOrgao(),
                            q.getCargo(),
                            matMap.get(q.getId())
                    );
                    questionList.set(i, enriched);
                }
            }
        } catch (Exception e) {
            // Se tabela de materiais não existir ou falhar, preserva as questões
        }
    }

    private boolean isStructurallyValid(Question q) {
        if (q.getStatement() == null || q.getStatement().isBlank()) {
            return false;
        }
        if (q.getOptions() == null || q.getOptions().size() < 4) {
            return false;
        }
        java.util.Set<String> letters = new java.util.HashSet<>();
        for (String opt : q.getOptions()) {
            if (opt != null && opt.length() >= 2) {
                String firstChar = opt.trim().substring(0, 1).toUpperCase();
                if (firstChar.matches("[A-E]")) {
                    letters.add(firstChar);
                }
            }
        }
        if (!letters.contains("A") || !letters.contains("B") || !letters.contains("C") || !letters.contains("D")) {
            return false;
        }

        String correctOpt = q.getCorrectOption();
        if (correctOpt != null && !correctOpt.isBlank() && !"ANULADA".equalsIgnoreCase(correctOpt)) {
            String optLetter = correctOpt.trim().toUpperCase();
            if (!letters.contains(optLetter)) {
                return false;
            }
        }
        return true;
    }

    @Override
    public Optional<Question> findById(String id) {
        String sql = "SELECT * FROM questions WHERE id = ?";
        
        List<Question> questions = jdbcTemplate.query(sql, (rs, rowNum) -> {
            try {
                List<String> options = null;
                String optionsJson = rs.getString("options_json");
                if (optionsJson != null && !optionsJson.isEmpty()) {
                    options = objectMapper.readValue(optionsJson, new TypeReference<List<String>>(){});
                    if (options != null) {
                        options.sort((opt1, opt2) -> {
                            String l1 = (opt1 != null && !opt1.isBlank()) ? opt1.trim().substring(0, 1).toUpperCase() : "";
                            String l2 = (opt2 != null && !opt2.isBlank()) ? opt2.trim().substring(0, 1).toUpperCase() : "";
                            return l1.compareTo(l2);
                        });
                    }
                }

                String rawStatus = null;
                try {
                    rawStatus = rs.getString("gabarito_status");
                } catch (Exception ignored) {}
                com.fiscalstudy.backend.domain.GabaritoStatus gabaritoStatus = 
                        com.fiscalstudy.backend.domain.GabaritoStatus.fromString(rawStatus);
                
                String orgao = null;
                try {
                    orgao = rs.getString("orgao");
                } catch (Exception ignored) {}
                String cargo = null;
                try {
                    cargo = rs.getString("cargo");
                } catch (Exception ignored) {}

                String justificativa = null;
                try {
                    justificativa = rs.getString("justificativa");
                } catch (Exception ignored) {}
                String textoApoio = null;
                try {
                    textoApoio = rs.getString("texto_apoio");
                } catch (Exception ignored) {}
                String textoApoioTitulo = null;
                try {
                    textoApoioTitulo = rs.getString("texto_apoio_titulo");
                } catch (Exception ignored) {}
                String qStatus = null;
                try {
                    qStatus = rs.getString("status");
                } catch (Exception ignored) {}
                Integer numOrig = null;
                try {
                    int no = rs.getInt("numero_original");
                    if (!rs.wasNull()) numOrig = no;
                } catch (Exception ignored) {}
                String arqOrig = null;
                try {
                    arqOrig = rs.getString("arquivo_origem");
                } catch (Exception ignored) {}

                return new Question(
                        rs.getString("id"),
                        rs.getString("enunciado"),
                        options,
                        rs.getString("correct_option"),
                        gabaritoStatus,
                        rs.getString("disciplina"),
                        rs.getString("assunto"),
                        rs.getString("banca"),
                        rs.getInt("ano"),
                        orgao,
                        cargo,
                        null,
                        justificativa,
                        textoApoio,
                        textoApoioTitulo,
                        qStatus,
                        numOrig,
                        arqOrig
                );
            } catch (Exception e) {
                throw new RuntimeException("Failed to map question", e);
            }
        }, id);

        if (questions.isEmpty()) {
            return Optional.empty();
        }
        enrichWithSupportMaterials(questions);
        return Optional.of(questions.get(0));
    }

    @Override
    public List<String> findAllDisciplines() {
        String sql = """
            SELECT DISTINCT disciplina FROM (
                SELECT disciplina FROM questions WHERE disciplina IS NOT NULL AND TRIM(disciplina) != ''
                UNION
                SELECT disciplina FROM edital_topicos WHERE disciplina IS NOT NULL AND TRIM(disciplina) != ''
            ) ORDER BY disciplina
        """;
        return jdbcTemplate.queryForList(sql, String.class);
    }

    @Override
    public List<String> findAllAssuntos(String disciplina) {
        if (disciplina != null && !disciplina.isBlank()) {
            String sql = """
                SELECT DISTINCT assunto FROM (
                    SELECT assunto FROM questions WHERE LOWER(disciplina) = LOWER(?) AND assunto IS NOT NULL AND TRIM(assunto) != ''
                    UNION
                    SELECT assunto FROM edital_topicos WHERE LOWER(disciplina) = LOWER(?) AND assunto IS NOT NULL AND TRIM(assunto) != ''
                ) ORDER BY assunto
            """;
            return jdbcTemplate.queryForList(sql, String.class, disciplina.trim(), disciplina.trim());
        }
        String sql = """
            SELECT DISTINCT assunto FROM (
                SELECT assunto FROM questions WHERE assunto IS NOT NULL AND TRIM(assunto) != ''
                UNION
                SELECT assunto FROM edital_topicos WHERE assunto IS NOT NULL AND TRIM(assunto) != ''
            ) ORDER BY assunto
        """;
        return jdbcTemplate.queryForList(sql, String.class);
    }
}
