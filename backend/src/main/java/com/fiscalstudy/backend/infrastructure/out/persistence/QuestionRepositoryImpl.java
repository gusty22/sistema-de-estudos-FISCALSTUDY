package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

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

    @Override
    public Optional<Question> findNextAvailableQuestion() {
        return findNextAvailableQuestion(null, null);
    }

    @Override
    public Optional<Question> findNextAvailableQuestion(String sessionId, String disciplina) {
        StringBuilder sql = new StringBuilder("SELECT * FROM questions WHERE 1=1 ");
        List<Object> params = new java.util.ArrayList<>();

        if (disciplina != null && !disciplina.isBlank()) {
            sql.append("AND disciplina = ? ");
            params.add(disciplina.trim());
        }

        if (sessionId != null && !sessionId.isBlank()) {
            sql.append("AND id NOT IN (SELECT aggregate_id FROM event_store WHERE session_id = ? AND event_type = 'ANSWER_SUBMITTED') ");
            params.add(sessionId.trim());
        }

        sql.append("ORDER BY RANDOM() LIMIT 1");

        List<Question> questions = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            try {
                List<String> options = null;
                String optionsJson = rs.getString("options_json");
                if (optionsJson != null && !optionsJson.isEmpty()) {
                    options = objectMapper.readValue(optionsJson, new TypeReference<List<String>>(){});
                }
                
                return new Question(
                        rs.getString("id"),
                        rs.getString("enunciado"),
                        options,
                        rs.getString("correct_option"),
                        rs.getString("disciplina"),
                        rs.getString("assunto"),
                        rs.getString("banca"),
                        rs.getInt("ano")
                );
            } catch (Exception e) {
                throw new RuntimeException("Failed to map question", e);
            }
        }, params.toArray());

        return questions.isEmpty() ? Optional.empty() : Optional.of(questions.get(0));
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
                }
                
                return new Question(
                        rs.getString("id"),
                        rs.getString("enunciado"),
                        options,
                        rs.getString("correct_option"),
                        rs.getString("disciplina"),
                        rs.getString("assunto"),
                        rs.getString("banca"),
                        rs.getInt("ano")
                );
            } catch (Exception e) {
                throw new RuntimeException("Failed to map question", e);
            }
        }, id);

        return questions.isEmpty() ? Optional.empty() : Optional.of(questions.get(0));
    }

    @Override
    public List<String> findAllDisciplines() {
        String sql = "SELECT DISTINCT disciplina FROM questions WHERE disciplina IS NOT NULL AND TRIM(disciplina) != '' ORDER BY disciplina";
        return jdbcTemplate.queryForList(sql, String.class);
    }
}
