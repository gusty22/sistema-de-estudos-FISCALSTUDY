package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.ReverseEngineeringService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringAnswerRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringSessionDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringStartRequestDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/cognitive/reverse-engineering")
@CrossOrigin(origins = "*")
public class ReverseEngineeringController {

    private final ReverseEngineeringService reverseEngineeringService;

    public ReverseEngineeringController(ReverseEngineeringService reverseEngineeringService) {
        this.reverseEngineeringService = reverseEngineeringService;
    }

    @PostMapping("/start")
    public ResponseEntity<ReverseEngineeringSessionDTO> startSession(@RequestBody ReverseEngineeringStartRequestDTO request) {
        ReverseEngineeringSessionDTO session = reverseEngineeringService.startReverseEngineeringSession(request);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/answer")
    public ResponseEntity<ReverseEngineeringSessionDTO> submitAnswer(@RequestBody ReverseEngineeringAnswerRequestDTO request) {
        ReverseEngineeringSessionDTO session = reverseEngineeringService.recordQuestionResolution(request);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/session/{id}")
    public ResponseEntity<ReverseEngineeringSessionDTO> getSession(@PathVariable("id") String id) {
        ReverseEngineeringSessionDTO session = reverseEngineeringService.getSessionById(id);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }

    @GetMapping("/eligibility")
    public ResponseEntity<Map<String, Object>> checkEligibility(
            @RequestParam(name = "disciplina", required = false) String disciplina,
            @RequestParam(name = "assunto", required = false) String assunto,
            @RequestParam(name = "concursoId", required = false) String concursoId) {
        
        boolean eligible = reverseEngineeringService.isTopicEligibleForReverseEngineering(disciplina, assunto, concursoId);
        return ResponseEntity.ok(Map.of(
                "eligible", eligible,
                "disciplina", disciplina != null ? disciplina : "",
                "assunto", assunto != null ? assunto : "",
                "metodoRecomendado", "ESTUDO_REVERSO_ORIENTADO",
                "motivo", "Assunto intermediário/avançado: sondagem com 5 a 10 questões da banca para mapear pegadinhas e pular a teoria geral."
        ));
    }
}
