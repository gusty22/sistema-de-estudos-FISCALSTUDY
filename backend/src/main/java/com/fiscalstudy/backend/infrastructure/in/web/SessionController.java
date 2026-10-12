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

        int evaluatedCount = 0;
        int correctCount = 0;
        long totalTimeMs = 0;
        int overconfidenceCount = 0;

        for (String payload : payloads) {
            try {
                JsonNode node = mapper.readTree(payload);
                String gabaritoStatus = node.path("gabaritoStatus").asText("DEFINITIVO");
                JsonNode isCorrectNode = node.path("isCorrect");
                int confidenceLevel = node.path("confidenceLevel").asInt();
                long activeTimeMs = node.path("activeTimeMs").asLong();

                totalTimeMs += activeTimeMs;

                // Questões sem gabarito verificado são excluídas do cálculo de acurácia
                boolean isUnverified = "AUSENTE".equalsIgnoreCase(gabaritoStatus) || 
                                       "SOB_REVISAO".equalsIgnoreCase(gabaritoStatus) || 
                                       isCorrectNode.isNull();
                if (!isUnverified) {
                    evaluatedCount++;
                    boolean isCorrect = isCorrectNode.asBoolean();
                    if (isCorrect) {
                        correctCount++;
                    } else if (confidenceLevel == 5) {
                        overconfidenceCount++;
                    }
                }
            } catch (Exception e) {
                // ignore invalid payloads
            }
        }

        double accuracy = evaluatedCount > 0 ? ((double) correctCount / evaluatedCount * 100.0) : 0.0;
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
