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
        String sql = "SELECT * FROM questions ORDER BY RANDOM() LIMIT 1"; // Simplest strategy for V1
        
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
        });

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
}
