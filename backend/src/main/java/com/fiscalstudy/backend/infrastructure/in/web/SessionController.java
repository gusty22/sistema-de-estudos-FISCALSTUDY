package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fiscalstudy.backend.infrastructure.in.web.dto.SessionSummaryDTO;

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

    @GetMapping("/{sessionId}/summary")
    public ResponseEntity<SessionSummaryDTO> getSessionSummary(@PathVariable String sessionId) {
        List<String> payloads = eventStoreRepository.getEventPayloads(sessionId, "ANSWER_SUBMITTED");
        ObjectMapper mapper = new ObjectMapper();
        
        int totalAnswered = payloads.size();
        if (totalAnswered == 0) {
            return ResponseEntity.ok(new SessionSummaryDTO(0, 0, 0.0, 0.0, 0));
        }

        int correctCount = 0;
        long totalTimeMs = 0;
        int overconfidenceCount = 0;

        for (String payload : payloads) {
            try {
                JsonNode node = mapper.readTree(payload);
                boolean isCorrect = node.path("isCorrect").asBoolean();
                int confidenceLevel = node.path("confidenceLevel").asInt();
                long activeTimeMs = node.path("activeTimeMs").asLong();

                if (isCorrect) correctCount++;
                totalTimeMs += activeTimeMs;
                if (!isCorrect && confidenceLevel == 5) overconfidenceCount++;
            } catch (Exception e) {
                // ignore invalid payloads
            }
        }

        double accuracy = (double) correctCount / totalAnswered * 100.0;
        double averageTimeMs = (double) totalTimeMs / totalAnswered;

        SessionSummaryDTO dto = new SessionSummaryDTO(
            totalAnswered,
            correctCount,
            accuracy,
            averageTimeMs,
            overconfidenceCount
        );

        return ResponseEntity.ok(dto);
    }
}
