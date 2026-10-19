package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveArchitectureService;
import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveStateDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/cognitive/architecture")
public class UnifiedCognitiveController {

    private final UnifiedCognitiveArchitectureService cognitiveArchitectureService;

    public UnifiedCognitiveController(UnifiedCognitiveArchitectureService cognitiveArchitectureService) {
        this.cognitiveArchitectureService = cognitiveArchitectureService;
    }

    /**
     * Retorna a representação unificada e auditável dos 6 componentes cognitivos
     * (Registro de Eventos, Modelo de Conhecimento, Calibração, Anomalias, Intervenções e Planejador).
     */
    @GetMapping("/state")
    public ResponseEntity<UnifiedCognitiveStateDTO> getUnifiedState(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false, defaultValue = "120") Integer tempoDisponivelMinutos
    ) {
        UnifiedCognitiveStateDTO state = cognitiveArchitectureService.computeUnifiedState(concursoId, tempoDisponivelMinutos);
        return ResponseEntity.ok(state);
    }

    /**
     * Recalcula a frio as projeções dos 6 componentes a partir do log imutável do event_store.
     * Não altera nenhum evento histórico.
     */
    @PostMapping("/recompute")
    public ResponseEntity<UnifiedCognitiveStateDTO> recomputeState(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false, defaultValue = "120") Integer tempoDisponivelMinutos
    ) {
        UnifiedCognitiveStateDTO state = cognitiveArchitectureService.computeUnifiedState(concursoId, tempoDisponivelMinutos);
        return ResponseEntity.ok(state);
    }
}
