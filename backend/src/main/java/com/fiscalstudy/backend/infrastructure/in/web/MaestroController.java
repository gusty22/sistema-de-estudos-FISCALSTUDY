package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.MaestroOrchestratorService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MaestroPlanDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller REST para o Maestro do Ciclo Diário (Micro-Orquestração e Interface de Batalha).
 */
@RestController
@RequestMapping("/api/v1/maestro")
@CrossOrigin(origins = "*")
public class MaestroController {

    private final MaestroOrchestratorService maestroService;

    public MaestroController(MaestroOrchestratorService maestroService) {
        this.maestroService = maestroService;
    }

    @GetMapping("/plan")
    public ResponseEntity<MaestroPlanDTO> getDailyPlan(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false, defaultValue = "180") Integer tempoDisponivelMinutos) {
        MaestroPlanDTO plan = maestroService.generateDailyPlan(concursoId, tempoDisponivelMinutos);
        return ResponseEntity.ok(plan);
    }

    @PostMapping("/complete-step")
    public ResponseEntity<Map<String, Object>> completeStep(@RequestBody Map<String, Object> body) {
        String concursoId = (String) body.getOrDefault("concursoId", "");
        int numeroPasso = ((Number) body.getOrDefault("numeroPasso", 1)).intValue();
        String tipo = (String) body.getOrDefault("tipo", "GENERIC_STEP");
        int duracaoMinutos = ((Number) body.getOrDefault("duracaoMinutos", 15)).intValue();

        maestroService.recordStepCompleted(concursoId, numeroPasso, tipo, duracaoMinutos);
        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Passo " + numeroPasso + " registrado no histórico append-only."
        ));
    }
}
