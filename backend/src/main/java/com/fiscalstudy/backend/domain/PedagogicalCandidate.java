package com.fiscalstudy.backend.domain;

import java.util.Map;

/**
 * Contrato canônico e imutável de um candidato pedagógico avaliado e/ou admitido.
 */
public record PedagogicalCandidate(
    String candidateId,
    PedagogicalActivityType activityType,
    String scopeId,
    String contestId,
    String topicId,
    String questionId,
    String materialId,
    String classificationId,
    String priority,
    int estimatedMinutes,
    String timeBasis,
    boolean materialAvailable,
    boolean inSyllabus,
    String prerequisitesStatus,
    String risk,
    String supportSpecialistId,
    String inventoryId,
    String inventoryVersion,
    String curriculumSourceId,
    String inventoryObservedAt,
    EpistemicStatus epistemicStatus,
    Map<String, Object> metadata
) {}
