package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.RobinHoodCycleService;
import com.fiscalstudy.backend.domain.cycle.RobinHoodCycleResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cycle")
public class RobinHoodCycleController {

    private final RobinHoodCycleService robinHoodCycleService;
    private final com.fiscalstudy.backend.application.SwotCycleCalibratorService swotCycleCalibratorService;

    public RobinHoodCycleController(RobinHoodCycleService robinHoodCycleService) {
        this(robinHoodCycleService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RobinHoodCycleController(RobinHoodCycleService robinHoodCycleService,
                                    @org.springframework.beans.factory.annotation.Autowired(required = false) com.fiscalstudy.backend.application.SwotCycleCalibratorService swotCycleCalibratorService) {
        this.robinHoodCycleService = robinHoodCycleService;
        this.swotCycleCalibratorService = swotCycleCalibratorService;
    }

    @GetMapping("/robin-hood")
    public ResponseEntity<RobinHoodCycleResult> getRobinHoodCycle(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) Double weeklyHours,
            @RequestParam(required = false) Integer blockMinutes
    ) {
        RobinHoodCycleResult result = robinHoodCycleService.getOrGenerateCycle(concursoId, weeklyHours, blockMinutes);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/robin-hood/inject-weights")
    public ResponseEntity<com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO> injectWeights(
            @RequestBody com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO weights
    ) {
        if (weights == null || !weights.supportsAutomaticPlanning()) {
            return ResponseEntity.unprocessableEntity()
                    .header("X-FiscalStudy-Analytics-Status", "OBSERVATIONAL_ONLY").build();
        }
        robinHoodCycleService.injectWeights(weights);
        return ResponseEntity.ok(robinHoodCycleService.getActiveWeights());
    }

    @PostMapping("/robin-hood/sync-weights")
    public ResponseEntity<com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO> syncWeights(
            @RequestParam(required = false) String path
    ) {
        com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO weights = robinHoodCycleService.syncWeightsFromFile(path);
        if (weights == null || !weights.supportsAutomaticPlanning()) {
            return ResponseEntity.unprocessableEntity()
                    .header("X-FiscalStudy-Analytics-Status", "NO_APPLICABLE_ANALYTICS").build();
        }
        return ResponseEntity.ok(weights);
    }

    @GetMapping("/robin-hood/active-weights")
    public ResponseEntity<com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO> getActiveWeights() {
        return ResponseEntity.ok(robinHoodCycleService.getActiveWeights());
    }

    @PostMapping("/recalibrate-swot")
    public ResponseEntity<Object> recalibrateFromSwotSimulado(
            @RequestParam(required = false) String concursoId,
            @RequestBody java.util.Map<String, Object> payload
    ) {
        if (swotCycleCalibratorService == null) {
            return ResponseEntity.ok(java.util.Map.of("erro", "Serviço SwotCycleCalibrator não inicializado."));
        }
        var result = swotCycleCalibratorService.recalibrateFromSimulado(concursoId, payload);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/latest-swot-calibration")
    public ResponseEntity<Object> getLatestSwotCalibration(
            @RequestParam(required = false) String concursoId
    ) {
        if (swotCycleCalibratorService == null) {
            return ResponseEntity.ok(java.util.Map.of("status", "Serviço não inicializado."));
        }
        return ResponseEntity.ok(swotCycleCalibratorService.getLatestSwotCalibration(concursoId));
    }
}
