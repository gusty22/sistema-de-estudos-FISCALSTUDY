package com.fiscalstudy.backend.infrastructure.in.web;
import com.fiscalstudy.backend.application.ProspectivePredictionService;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ProspectivePredictionController {
    private final ProspectivePredictionService service;
    public ProspectivePredictionController(ProspectivePredictionService service) { this.service=service; }
    public record PreparationRequest(String attemptId,String sessionId) {}
    @PostMapping("/questions/{questionId}/predictions")
    public ResponseEntity<?> prepare(@PathVariable String questionId,@RequestBody PreparationRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(service.prepare(questionId,request.sessionId(),request.attemptId()));
    }
    @GetMapping("/questions/{questionId}/predictions/{attemptId}")
    public ResponseEntity<?> recover(@PathVariable String questionId,@PathVariable String attemptId,@RequestParam String sessionId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.recover(questionId,sessionId,attemptId));
    }
    @GetMapping("/learning-lab/prospective-export")
    public ResponseEntity<Map<String,Object>> export() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.exportSnapshot());
    }
}
