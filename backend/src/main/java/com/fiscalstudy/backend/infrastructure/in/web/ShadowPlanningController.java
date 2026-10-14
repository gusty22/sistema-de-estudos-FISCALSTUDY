package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.ShadowPlanningService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ShadowModeTelemetryDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/shadow-mode")
@CrossOrigin(origins = "*")
public class ShadowPlanningController {

    private final ShadowPlanningService shadowPlanningService;

    public ShadowPlanningController(ShadowPlanningService shadowPlanningService) {
        this.shadowPlanningService = shadowPlanningService;
    }

    @GetMapping("/telemetry")
    public ResponseEntity<ShadowModeTelemetryDTO> getTelemetry(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(shadowPlanningService.evaluateShadowTelemetry(concursoId));
    }
}
