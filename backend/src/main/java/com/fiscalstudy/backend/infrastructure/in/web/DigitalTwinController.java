package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.DigitalTwinService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/digital-twin")
public class DigitalTwinController {

    private final DigitalTwinService digitalTwinService;

    public DigitalTwinController(DigitalTwinService digitalTwinService) {
        this.digitalTwinService = digitalTwinService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getDigitalTwinStatus(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String concursoNome
    ) {
        Map<String, Object> result = digitalTwinService.getDigitalTwinStatus(concursoId, concursoNome);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/recalibrate-r")
    public ResponseEntity<Map<String, Object>> recalibrateWithR(
            @RequestParam(required = false) String concursoId
    ) {
        Map<String, Object> result = digitalTwinService.recalibrateWithREngine(concursoId);
        return ResponseEntity.ok(result);
    }
}
