package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Optional;

public interface StudentRoutineRepository {
    Optional<StudentRoutine> findByConcursoId(String concursoId);
    StudentRoutine save(StudentRoutine routine);

    List<RoutineCommitment> findAllCommitments();
    RoutineCommitment saveCommitment(RoutineCommitment commitment);
    void deleteCommitment(String id);

    List<RoutineException> findAllExceptions();
    RoutineException saveException(RoutineException exception);
    void deleteException(String id);
}
