package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StudySessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/study-sessions")
public class StudySessionController {

    private final StudySessionService studySessionService;

    public StudySessionController(StudySessionService studySessionService) {
        this.studySessionService = studySessionService;
    }

    @PostMapping("/record")
    public ResponseEntity<Map<String, Object>> recordSession(@RequestBody Map<String, Object> sessionData) {
        Map<String, Object> result = studySessionService.recordStudySession(sessionData);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(studySessionService.getStudyTimeSummary(concursoId));
    }
}
