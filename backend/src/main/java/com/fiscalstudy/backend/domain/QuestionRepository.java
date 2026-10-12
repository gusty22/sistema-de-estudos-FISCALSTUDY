package com.fiscalstudy.backend.domain;

import java.util.Optional;

public interface QuestionRepository {
    Optional<Question> findNextAvailableQuestion();
    Optional<Question> findNextAvailableQuestion(String sessionId, String disciplina);
    Optional<Question> findById(String id);
    java.util.List<String> findAllDisciplines();
}
