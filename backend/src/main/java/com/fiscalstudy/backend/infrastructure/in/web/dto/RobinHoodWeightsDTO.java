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
        @JsonProperty("algorithm") String algorithm,
        @JsonProperty("target_retention_threshold") Double targetRetentionThreshold,
        @JsonProperty("disciplines_count") Integer disciplinesCount,
        @JsonProperty("weights") @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = WeightsMapDeserializer.class) Map<String, DisciplineWeightDTO> weights,
        @JsonProperty("recommendations") RecommendationsDTO recommendations,
        @JsonProperty("parameters") Map<String, Object> parameters,
        @JsonProperty("critical_topics") List<CriticalTopicDTO> criticalTopics,
        @JsonProperty("hyper_consolidated_disciplines") List<HyperConsolidatedDTO> hyperConsolidatedDisciplines,
        @JsonProperty("redistribution_plan") RedistributionPlanDTO redistributionPlan
) {
    /**
     * This legacy observational contract carries no homologated decision authority.
     * Populated weights or unknown JSON flags cannot authorize automatic interventions.
     * A future actionable contract requires explicit review and independent validation.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean supportsAutomaticPlanning() { return false; }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DisciplineWeightDTO(
            @JsonProperty("discipline") String discipline,
            @JsonProperty("n_attempts") Integer nAttempts,
            @JsonProperty("n_correct") Integer nCorrect,
            @JsonProperty("accuracy") Double accuracy,
            @JsonProperty("ci_lower") Double ciLower,
            @JsonProperty("urgency_status") String urgencyStatus,
            @JsonProperty("critical_day") Integer criticalDay,
            @JsonProperty("days_until_critical") Integer daysUntilCritical,
            @JsonProperty("raw_priority_score") Double rawPriorityScore,
            @JsonProperty("recommended_action") String recommendedAction,
            @JsonProperty("cycle_time_share_percent") Double cycleTimeSharePercent,
            @JsonProperty("suggested_block_minutes") Integer suggestedBlockMinutes
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RecommendationsDTO(
            @JsonProperty("time_theft_donors") Object timeTheftDonors,
            @JsonProperty("priority_recipients") Object priorityRecipients,
            @JsonProperty("summary_instruction") String summaryInstruction
    ) {}

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

    public static class WeightsMapDeserializer extends com.fasterxml.jackson.databind.JsonDeserializer<Map<String, DisciplineWeightDTO>> {
        @Override
        public Map<String, DisciplineWeightDTO> deserialize(com.fasterxml.jackson.core.JsonParser p, com.fasterxml.jackson.databind.DeserializationContext ctxt) throws java.io.IOException {
            if (p.currentToken() == com.fasterxml.jackson.core.JsonToken.START_ARRAY) {
                p.skipChildren();
                return java.util.Collections.emptyMap();
            }
            com.fasterxml.jackson.databind.type.MapType mapType = ctxt.getTypeFactory().constructMapType(java.util.LinkedHashMap.class, String.class, DisciplineWeightDTO.class);
            return ctxt.readValue(p, mapType);
        }
    }
}
