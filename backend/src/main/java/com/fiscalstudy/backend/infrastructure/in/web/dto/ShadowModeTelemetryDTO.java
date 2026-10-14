package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.List;
import java.util.Map;

public class ShadowModeTelemetryDTO {
    private String activePolicy;
    private String shadowPolicy;
    private int totalRuns;
    private double averageDivergencePct;
    private List<Map<String, Object>> activeRecommendations;
    private List<Map<String, Object>> shadowRecommendations;
    private List<String> divergenceInsights;
    private String safetyGuarantee;

    public ShadowModeTelemetryDTO() {}

    public String getActivePolicy() { return activePolicy; }
    public void setActivePolicy(String activePolicy) { this.activePolicy = activePolicy; }
    public String getShadowPolicy() { return shadowPolicy; }
    public void setShadowPolicy(String shadowPolicy) { this.shadowPolicy = shadowPolicy; }
    public int getTotalRuns() { return totalRuns; }
    public void setTotalRuns(int totalRuns) { this.totalRuns = totalRuns; }
    public double getAverageDivergencePct() { return averageDivergencePct; }
    public void setAverageDivergencePct(double averageDivergencePct) { this.averageDivergencePct = averageDivergencePct; }
    public List<Map<String, Object>> getActiveRecommendations() { return activeRecommendations; }
    public void setActiveRecommendations(List<Map<String, Object>> activeRecommendations) { this.activeRecommendations = activeRecommendations; }
    public List<Map<String, Object>> getShadowRecommendations() { return shadowRecommendations; }
    public void setShadowRecommendations(List<Map<String, Object>> shadowRecommendations) { this.shadowRecommendations = shadowRecommendations; }
    public List<String> getDivergenceInsights() { return divergenceInsights; }
    public void setDivergenceInsights(List<String> divergenceInsights) { this.divergenceInsights = divergenceInsights; }
    public String getSafetyGuarantee() { return safetyGuarantee; }
    public void setSafetyGuarantee(String safetyGuarantee) { this.safetyGuarantee = safetyGuarantee; }
}
