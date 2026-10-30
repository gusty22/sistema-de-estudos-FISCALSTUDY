package com.fiscalstudy.backend.domain;

import java.util.List;

/**
 * Registro estruturado de rejeição de candidato pedagógico durante auditoria de inventário.
 */
public record CandidateRejection(
    String candidateId,
    PedagogicalActivityType activityType,
    String scopeId,
    EpistemicStatus epistemicStatus,
    List<PedagogicalRejectionReason> reasons,
    String details
) {}
