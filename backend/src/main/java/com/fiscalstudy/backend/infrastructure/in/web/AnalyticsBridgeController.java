package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnalyticsBridgeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics-bridge")
public class AnalyticsBridgeController {

    private final AnalyticsBridgeService bridgeService;

    public AnalyticsBridgeController(AnalyticsBridgeService bridgeService) {
        this.bridgeService = bridgeService;
    }

    @PostMapping("/run")
    public ResponseEntity<AnalyticsBridgeService.AnalyticsExecutionResult> runPipelineSync() {
        AnalyticsBridgeService.AnalyticsExecutionResult result = bridgeService.executeAnalyticsPipeline();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/run-async")
    public ResponseEntity<Map<String, Object>> runPipelineAsync() {
        bridgeService.triggerAnalyticsAsync();
        return ResponseEntity.ok(Map.of(
                "status", "QUEUED",
                "message", "Execução assíncrona do motor R iniciada em segundo plano."
        ));
    }

    @PostMapping("/export-csv")
    public ResponseEntity<Map<String, Object>> exportCsv() {
        try {
            var path = bridgeService.exportCanonicalCsv();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "file_path", path.toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    @GetMapping("/signals")
    public ResponseEntity<List<Map<String, Object>>> getSignals() {
        return ResponseEntity.ok(bridgeService.loadAnalyticalSignals());
    }

    @GetMapping("/weights")
    public ResponseEntity<Object> getWeights() {
        return ResponseEntity.ok(bridgeService.loadRobinHoodWeights());
    }
}
