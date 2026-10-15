package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RobinHoodWeightsDTO(
        @JsonProperty("contract_version") String contractVersion,
        @JsonProperty("generated_at") String generatedAt,
        @JsonProperty("source_model") String sourceModel,
        @JsonProperty("parameters") Map<String, Object> parameters,
        @JsonProperty("critical_topics") List<CriticalTopicDTO> criticalTopics,
        @JsonProperty("hyper_consolidated_disciplines") List<HyperConsolidatedDTO> hyperConsolidatedDisciplines,
        @JsonProperty("redistribution_plan") RedistributionPlanDTO redistributionPlan
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CriticalTopicDTO(
            @JsonProperty("discipline") String discipline,
            @JsonProperty("topic") String topic,
            @JsonProperty("beta_0") Double beta0,
            @JsonProperty("beta_1_decay") Double beta1Decay,
            @JsonProperty("beta_2_conf") Double beta2Conf,
            @JsonProperty("beta_3_diff") Double beta3Diff,
            @JsonProperty("wilson_lower_bound") Double wilsonLowerBound,
            @JsonProperty("sample_size_n") Integer sampleSizeN,
            @JsonProperty("metacognitive_penalty") Boolean metacognitivePenalty,
            @JsonProperty("priority_score") Double priorityScore,
            @JsonProperty("recommended_intervention") String recommendedIntervention,
            @JsonProperty("emergency_block_minutes") Integer emergencyBlockMinutes,
            @JsonProperty("rationale") String rationale
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HyperConsolidatedDTO(
            @JsonProperty("discipline") String discipline,
            @JsonProperty("wilson_lower_bound") Double wilsonLowerBound,
            @JsonProperty("projected_retention_14d") Double projectedRetention14d,
            @JsonProperty("max_stealable_minutes") Integer maxStealableMinutes,
            @JsonProperty("status") String status
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RedistributionPlanDTO(
            @JsonProperty("total_stolen_minutes") Integer totalStolenMinutes,
            @JsonProperty("donor_discipline") String donorDiscipline,
            @JsonProperty("receiver_discipline") String receiverDiscipline,
            @JsonProperty("receiver_topic") String receiverTopic,
            @JsonProperty("intervention_type") String interventionType
    ) {}
}
