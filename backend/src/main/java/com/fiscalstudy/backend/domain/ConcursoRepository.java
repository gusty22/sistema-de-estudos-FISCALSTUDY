package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Optional;

public interface ConcursoRepository {
    List<Concurso> findAll(String statusFilter);
    Optional<Concurso> findById(String id);
    Concurso save(Concurso concurso);
    void updateStatus(String id, String status);
    long countAvailableQuestions(String concursoId);
}
