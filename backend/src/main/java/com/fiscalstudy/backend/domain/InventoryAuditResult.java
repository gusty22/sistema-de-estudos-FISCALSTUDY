package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Map;

/**
 * Resultado da auditoria exaustiva e determinística do inventário pedagógico.
 * Contém os candidatos admitidos, motivos explícitos de rejeição e a matriz epistêmica.
 */
public record InventoryAuditResult(
    String contestId,
    String editalId,
    String observedAt,
    List<PedagogicalCandidate> admittedCandidates,
    List<CandidateRejection> rejections,
    Map<PedagogicalActivityType, Map<EpistemicStatus, Integer>> activityMatrix,
    List<String> explicitLimitations
) {}
