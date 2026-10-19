package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StrategicSimuladoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller REST para o Módulo Estratégico de Simulados e Cadernos.
 */
@RestController
@RequestMapping("/api/v1/simulados")
public class SimuladoController {

    private final StrategicSimuladoService strategicSimuladoService;

    public SimuladoController(StrategicSimuladoService strategicSimuladoService) {
        this.strategicSimuladoService = strategicSimuladoService;
    }

    /**
     * Retorna a visão analítica completa do módulo de simulados orientados pelo edital.
     */
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getSimuladosDashboard(
            @RequestParam(required = false) String concursoId
    ) {
        Map<String, Object> result = strategicSimuladoService.getSimuladosDashboard(concursoId);
        return ResponseEntity.ok(result);
    }

    /**
     * Gera e persiste um caderno de simulado inteligente com base na estratégia escolhida (Pareto, Pontos Fracos, Prova Real, etc).
     */
    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateSimulado(
            @RequestBody Map<String, Object> request
    ) {
        Map<String, Object> result = strategicSimuladoService.generateStrategicSimulado(request);
        return ResponseEntity.ok(result);
    }

    /**
     * Registra o resultado final e estatísticas de um simulado concluído pelo estudante.
     */
    @PostMapping("/record-completion")
    public ResponseEntity<Map<String, Object>> recordCompletion(
            @RequestBody Map<String, Object> payload
    ) {
        Map<String, Object> result = strategicSimuladoService.recordSimuladoCompletion(payload);
        return ResponseEntity.ok(result);
    }
}
