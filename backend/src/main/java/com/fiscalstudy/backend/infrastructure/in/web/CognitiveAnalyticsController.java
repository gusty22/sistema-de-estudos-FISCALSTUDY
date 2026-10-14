package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnswerSwitchTrackerService;
import com.fiscalstudy.backend.application.TimeMetricService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cognitive")
public class CognitiveAnalyticsController {

    private final TimeMetricService timeMetricService;
    private final AnswerSwitchTrackerService answerSwitchTrackerService;

    public CognitiveAnalyticsController(TimeMetricService timeMetricService, AnswerSwitchTrackerService answerSwitchTrackerService) {
        this.timeMetricService = timeMetricService;
        this.answerSwitchTrackerService = answerSwitchTrackerService;
    }

    @GetMapping("/time-metrics")
    public ResponseEntity<Map<String, Object>> getTimeMetrics(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(timeMetricService.getTimeMetricsSummary(concursoId));
    }

    @GetMapping("/marcou-acabou")
    public ResponseEntity<Map<String, Object>> getMarcouAcabouAnalytics(@RequestParam(required = false) String sessionId) {
        return ResponseEntity.ok(answerSwitchTrackerService.getAnswerSwitchAnalytics(sessionId));
    }

    @PostMapping("/switch-answer")
    public ResponseEntity<Map<String, Object>> switchAnswer(@RequestBody Map<String, Object> body) {
        String sessionId = (String) body.get("sessionId");
        String questionId = (String) body.get("questionId");
        String fromOption = (String) body.get("fromOption");
        String toOption = (String) body.get("toOption");
        Number timeSpent = (Number) body.getOrDefault("timeSpentSeconds", 0);

        answerSwitchTrackerService.recordAnswerSwitch(sessionId, questionId, fromOption, toOption, timeSpent != null ? timeSpent.intValue() : 0);
        return ResponseEntity.ok(Map.of("status", "SWITCH_RECORDED", "questionId", questionId));
    }

    @PostMapping("/distractions")
    public ResponseEntity<Map<String, Object>> recordDistraction(@RequestBody Map<String, Object> body) {
        String sessionId = (String) body.get("sessionId");
        String concursoId = (String) body.get("concursoId");
        String text = (String) body.get("distractionText");
        return ResponseEntity.ok(timeMetricService.recordDistraction(sessionId, concursoId, text));
    }

    @GetMapping("/distractions")
    public ResponseEntity<List<Map<String, Object>>> getDistractions(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(timeMetricService.getDistractions(concursoId));
    }

    @PutMapping("/distractions/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolveDistraction(@PathVariable String id) {
        timeMetricService.resolveDistraction(id);
        return ResponseEntity.ok(Map.of("id", id, "status", "RESOLVED"));
    }
}
