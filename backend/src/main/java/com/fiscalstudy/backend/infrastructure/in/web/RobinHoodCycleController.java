package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.RobinHoodCycleService;
import com.fiscalstudy.backend.domain.cycle.RobinHoodCycleResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cycle")
public class RobinHoodCycleController {

    private final RobinHoodCycleService robinHoodCycleService;

    public RobinHoodCycleController(RobinHoodCycleService robinHoodCycleService) {
        this.robinHoodCycleService = robinHoodCycleService;
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
}
