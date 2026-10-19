package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StrategicSummaryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/summaries")
@CrossOrigin(origins = "*")
public class StrategicSummaryController {

    private final StrategicSummaryService summaryService;

    public StrategicSummaryController(StrategicSummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getSummaries(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String topico) {
        return ResponseEntity.ok(summaryService.getSummaries(concursoId, disciplina, topico));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getSummaryById(@PathVariable String id) {
        return summaryService.getSummaryById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateSummary(@RequestBody Map<String, Object> req) {
        Map<String, Object> created = summaryService.generateSummary(req);
        return ResponseEntity.ok(created);
    }

    @PostMapping("/{id}/send-to-anki")
    public ResponseEntity<Map<String, Object>> sendToAnki(@PathVariable String id) {
        int cardsSent = summaryService.sendFlashcardsToAnki(id);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "summaryId", id,
                "cardsInjected", cardsSent,
                "message", cardsSent + " flashcards inteligentes injetados com sucesso na curadoria do Anki."
        ));
    }

    @PostMapping("/{id}/mark-reviewed")
    public ResponseEntity<Map<String, Object>> markReviewed(@PathVariable String id) {
        boolean ok = summaryService.markReviewed(id);
        return ResponseEntity.ok(Map.of(
                "success", ok,
                "summaryId", id,
                "message", ok ? "Resumo marcado como revisado com sucesso." : "Falha ao marcar revisão."
        ));
    }
}
