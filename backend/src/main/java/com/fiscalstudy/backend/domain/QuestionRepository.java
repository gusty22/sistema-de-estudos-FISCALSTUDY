package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Optional;

public interface QuestionRepository {
    Optional<Question> findNextAvailableQuestion();
    Optional<Question> findNextAvailableQuestion(String sessionId, String disciplina);
    Optional<Question> findNextAvailableQuestion(String sessionId, String concursoId, String disciplina, String assunto, Boolean includeAnswered);
    Optional<Question> findById(String id);
    List<String> findAllDisciplines();
    List<String> findAllAssuntos(String disciplina);
}
