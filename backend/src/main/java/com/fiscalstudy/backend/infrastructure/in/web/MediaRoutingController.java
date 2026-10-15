package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.MediaRoutingService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CognitiveChatRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CognitiveChatResponseDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MediaRoutingPrescriptionDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/cognitive/media-routing")
@CrossOrigin(origins = "*")
public class MediaRoutingController {

    private final MediaRoutingService mediaRoutingService;

    public MediaRoutingController(MediaRoutingService mediaRoutingService) {
        this.mediaRoutingService = mediaRoutingService;
    }

    @GetMapping("/evaluate")
    public ResponseEntity<MediaRoutingPrescriptionDTO> evaluateRouting(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String assunto,
            @RequestParam(required = false) String sessionId
    ) {
        MediaRoutingPrescriptionDTO prescription = mediaRoutingService.evaluateRouting(
                concursoId,
                disciplina != null ? disciplina : "Geral",
                assunto != null ? assunto : "Geral",
                sessionId
        );
        return ResponseEntity.ok(prescription);
    }

    @PostMapping("/ai-chat")
    public ResponseEntity<CognitiveChatResponseDTO> handleAiChat(@RequestBody CognitiveChatRequestDTO req) {
        return ResponseEntity.ok(mediaRoutingService.handleAiChat(req));
    }

    @PostMapping("/unlock")
    public ResponseEntity<Map<String, Object>> unlockCognitiveSession(@RequestBody Map<String, String> body) {
        String sessionId = body.getOrDefault("sessionId", "");
        String concursoId = body.getOrDefault("concursoId", "");
        String disciplina = body.getOrDefault("disciplina", "Geral");
        String assunto = body.getOrDefault("assunto", "Geral");
        String notes = body.getOrDefault("notes", "Entendido pelo chat com IA");

        boolean unlocked = mediaRoutingService.unlockSession(sessionId, concursoId, disciplina, assunto, notes);
        return ResponseEntity.ok(Map.of(
                "success", unlocked,
                "message", "Bloqueio cognitivo destravado com sucesso. Sessão liberada para continuar.",
                "assunto", assunto
        ));
    }
}
