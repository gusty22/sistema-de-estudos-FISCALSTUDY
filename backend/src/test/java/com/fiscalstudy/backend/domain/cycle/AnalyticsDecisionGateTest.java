package com.fiscalstudy.backend.domain.cycle;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.application.RobinHoodCycleService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

/** Legacy analytical DTO has no approved decision contract, regardless of JSON claims. */
class AnalyticsDecisionGateTest {
    private RobinHoodWeightsDTO payload() throws Exception {
        return new ObjectMapper().readValue("""
            {"contract_version":"1.1.0","source_model":"EXPLORATORY",
             "can_apply":true,"is_validated":true,"is_real_student_data":true,
             "weights":{"A":{"discipline":"A","cycle_time_share_percent":99}},
             "critical_topics":[{"discipline":"A","topic":"Unverified","emergency_block_minutes":50}]}
            """, RobinHoodWeightsDTO.class);
    }
    @Test void jsonFlagsCannotAuthorizeAnUnhomologatedContract() throws Exception {
        assertFalse(payload().supportsAutomaticPlanning());
    }
    @Test void serviceDoesNotActivateObservationalWeights() throws Exception {
        var service = new RobinHoodCycleService(null, null, new ObjectMapper());
        service.injectWeights(payload());
        assertNull(service.getActiveWeights());
    }
    @Test void engineRetainsConfiguredCycleInsteadOfApplyingExploratoryPayload() throws Exception {
        var engine = new RobinHoodCycleEngine();
        var profiles = List.of(new DisciplineProfile("A", 2, 20, 50, 3, "FISCAL"),
                new DisciplineProfile("B", 2, 20, 50, 3, "JURIDICA"));
        var baseline = engine.generateCycle("exam", profiles, 20, 60, 0, Map.of());
        var guarded = engine.generateCycle("exam", profiles, 20, 60, 0, Map.of(), payload());
        assertEquals(baseline.getBlocos().stream().map(b -> b.getDisciplina() + ":" + b.getHorasAlocadasDisciplina()).toList(),
                guarded.getBlocos().stream().map(b -> b.getDisciplina() + ":" + b.getHorasAlocadasDisciplina()).toList());
        assertEquals(baseline.getResumoRobinHood(), guarded.getResumoRobinHood());
    }
    @Test void fileReloadCannotBypassTheObservationalGate() throws Exception {
        var mapper = new ObjectMapper();
        java.nio.file.Files.createDirectories(java.nio.file.Path.of("target/analytics-gate-tests"));
        var root = java.nio.file.Files.createTempDirectory(java.nio.file.Path.of("target/analytics-gate-tests"), "run-").toAbsolutePath();
        var paths = new com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths(null, root.toString(), root.toString());
        String id = java.util.UUID.randomUUID().toString();
        var metrics = root.resolve("runs").resolve(id).resolve("metrics");
        java.nio.file.Files.createDirectories(metrics);
        mapper.writeValue(paths.currentManifest().toFile(), Map.of("status", "SUCCEEDED", "runId", id));
        mapper.writeValue(metrics.resolve("robin_hood_weights.json").toFile(), payload());
        var service = new RobinHoodCycleService(null, null, mapper);
        var field = RobinHoodCycleService.class.getDeclaredField("analyticsPaths");
        field.setAccessible(true);
        field.set(service, paths);
        assertNull(service.syncWeightsFromFile(null));
    }

    @Test void manualInjectionRejectsInsteadOfReportingFalseSuccess() throws Exception {
        var service = new RobinHoodCycleService(null, null, new ObjectMapper());
        var controller = new com.fiscalstudy.backend.infrastructure.in.web.RobinHoodCycleController(service);
        var response = controller.injectWeights(payload());
        assertEquals(422, response.getStatusCode().value());
        assertEquals("OBSERVATIONAL_ONLY", response.getHeaders().getFirst("X-FiscalStudy-Analytics-Status"));
        assertNull(service.getActiveWeights());
    }
    @Test void absentOrInapplicableSyncDoesNotReportAppliedWeights() {
        var controller = new com.fiscalstudy.backend.infrastructure.in.web.RobinHoodCycleController(
                new RobinHoodCycleService(null, null, new ObjectMapper()));
        assertEquals(422, controller.syncWeights(null).getStatusCode().value());
    }

}
