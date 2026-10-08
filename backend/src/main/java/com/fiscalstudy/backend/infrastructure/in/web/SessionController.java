package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/sessions")
@CrossOrigin(origins = "*")
public class SessionController {

    private final EventStoreRepository eventStoreRepository;

    public SessionController(EventStoreRepository eventStoreRepository) {
        this.eventStoreRepository = eventStoreRepository;
    }

    @PostMapping("/start")
    public ResponseEntity<Void> startSession(@RequestBody Map<String, String> payload) {
        String sessionId = payload.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        
        eventStoreRepository.appendEvent(
                "STUDY_SESSION_STARTED",
                "SESSION",
                sessionId,
                sessionId,
                1,
                "v1",
                "{}"
        );
        return ResponseEntity.ok().build();
    }

    @PostMapping("/end")
    public ResponseEntity<Void> endSession(@RequestBody Map<String, String> payload) {
        String sessionId = payload.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        
        eventStoreRepository.appendEvent(
                "STUDY_SESSION_ENDED",
                "SESSION",
                sessionId,
                sessionId,
                1,
                "v1",
                "{}"
        );
        return ResponseEntity.ok().build();
    }
}
