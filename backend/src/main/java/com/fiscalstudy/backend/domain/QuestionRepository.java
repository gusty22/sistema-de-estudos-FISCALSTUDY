package com.fiscalstudy.backend.domain;

import java.util.Optional;

public interface QuestionRepository {
    Optional<Question> findNextAvailableQuestion();
    Optional<Question> findById(String id);
}
