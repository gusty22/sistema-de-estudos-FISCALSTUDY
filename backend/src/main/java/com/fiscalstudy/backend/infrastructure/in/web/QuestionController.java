package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AttemptSubmissionService;
import com.fiscalstudy.backend.application.QuestionSelectionService;
import com.fiscalstudy.backend.domain.Question;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/questions")
@CrossOrigin(origins = "*") // Permite requisições do frontend local
public class QuestionController {

    private final QuestionSelectionService questionSelectionService;
    private final AttemptSubmissionService attemptSubmissionService;

    public QuestionController(QuestionSelectionService questionSelectionService, AttemptSubmissionService attemptSubmissionService) {
        this.questionSelectionService = questionSelectionService;
        this.attemptSubmissionService = attemptSubmissionService;
    }

    @GetMapping("/next")
    public ResponseEntity<QuestionDTO> getNextQuestion(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String disciplina) {
        Optional<Question> questionOpt = questionSelectionService.getNextQuestion(sessionId, disciplina);
        
        if (questionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Question q = questionOpt.get();
        // NUNCA devolve o gabarito (correctOption) para o frontend
        QuestionDTO dto = new QuestionDTO(
            q.getId(),
            q.getStatement(),
            q.getOptions(),
            q.getDiscipline(),
            q.getTopic(),
            q.getBoard(),
            q.getYear()
        );
        
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/disciplines")
    public ResponseEntity<List<String>> getDisciplines() {
        List<String> disciplines = questionSelectionService.getAvailableDisciplines();
        return ResponseEntity.ok(disciplines);
    }

    @PostMapping("/{id}/presented")
    public ResponseEntity<Void> recordPresentation(
            @PathVariable String id,
            @RequestBody Map<String, String> payload) {
        String sessionId = payload.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        questionSelectionService.recordPresentation(id, sessionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/attempts")
    public ResponseEntity<AttemptResultDTO> submitAttempt(
            @PathVariable String id,
            @RequestBody AttemptPayloadDTO payload) {
            
        if (payload.getConfidenceLevel() < 1 || payload.getConfidenceLevel() > 5) {
            return ResponseEntity.badRequest().build();
        }
        if (payload.getActiveTimeMs() < 0) {
            return ResponseEntity.badRequest().build();
        }
        if (payload.getSessionId() == null || payload.getSessionId().isBlank()) {
            return ResponseEntity.badRequest().build();
        }


        try {
            com.fiscalstudy.backend.domain.AttemptResult result = attemptSubmissionService.submitAttempt(
                    id,
                    payload.getSelectedOption(),
                    payload.getConfidenceLevel(),
                    payload.getActiveTimeMs(),
                    payload.getSessionId()
            );

            return ResponseEntity.ok(new AttemptResultDTO(
                    result.getIsCorrect(),
                    result.getGabaritoStatus() != null ? result.getGabaritoStatus().name() : "DEFINITIVO",
                    result.getConcursoPoint()
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null && e.getMessage().contains("Invalid")) {
                return ResponseEntity.badRequest().build();
            }
            return ResponseEntity.notFound().build();
        }
    }

    public static class QuestionDTO {
        public String questionId;
        public String statement;
        public Object options; // can be List<String> or List<Map>
        public MetadataDTO metadata;

        public QuestionDTO(String questionId, String statement, Object options, String discipline, String topic, String board, Integer year) {
            this.questionId = questionId;
            this.statement = statement;
            this.options = options;
            this.metadata = new MetadataDTO(discipline, topic, board, year);
        }
    }

    public static class MetadataDTO {
        public String discipline;
        public String topic;
        public String board;
        public Integer year;

        public MetadataDTO(String discipline, String topic, String board, Integer year) {
            this.discipline = discipline;
            this.topic = topic;
            this.board = board;
            this.year = year;
        }
    }

    public static class AttemptPayloadDTO {
        private String selectedOption;
        private int confidenceLevel;
        private long activeTimeMs;
        private String sessionId;

        public String getSelectedOption() { return selectedOption; }
        public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }
        public int getConfidenceLevel() { return confidenceLevel; }
        public void setConfidenceLevel(int confidenceLevel) { this.confidenceLevel = confidenceLevel; }
        public long getActiveTimeMs() { return activeTimeMs; }
        public void setActiveTimeMs(long activeTimeMs) { this.activeTimeMs = activeTimeMs; }
        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public static class AttemptResultDTO {
        @com.fasterxml.jackson.annotation.JsonProperty("isCorrect")
        public Boolean isCorrect;

        @com.fasterxml.jackson.annotation.JsonProperty("gabaritoStatus")
        public String gabaritoStatus;

        @com.fasterxml.jackson.annotation.JsonProperty("concursoPoint")
        public Integer concursoPoint;

        public AttemptResultDTO(Boolean isCorrect, String gabaritoStatus, Integer concursoPoint) {
            this.isCorrect = isCorrect;
            this.gabaritoStatus = gabaritoStatus;
            this.concursoPoint = concursoPoint;
        }

        public AttemptResultDTO(Boolean isCorrect, String gabaritoStatus) {
            this(isCorrect, gabaritoStatus, null);
        }

        public AttemptResultDTO(boolean isCorrect) {
            this(isCorrect, "DEFINITIVO", isCorrect ? 1 : 0);
        }

        public Boolean getIsCorrect() { return isCorrect; }
        public String getGabaritoStatus() { return gabaritoStatus; }
        public Integer getConcursoPoint() { return concursoPoint; }
    }
}
