package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnkiIntegrationService;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.domain.QuestionRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiConnectStatusDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiFlashcardDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiGenerationRequestDTO;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/anki")
@CrossOrigin(origins = "*")
public class AnkiController {

    private final AnkiIntegrationService ankiIntegrationService;
    private final QuestionRepository questionRepository;

    public AnkiController(AnkiIntegrationService ankiIntegrationService, QuestionRepository questionRepository) {
        this.ankiIntegrationService = ankiIntegrationService;
        this.questionRepository = questionRepository;
    }

    @GetMapping("/status")
    public ResponseEntity<AnkiConnectStatusDTO> getStatus() {
        return ResponseEntity.ok(ankiIntegrationService.checkConnection());
    }

    @GetMapping("/flashcards")
    public ResponseEntity<List<AnkiFlashcardDTO>> getRecentFlashcards(@RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(ankiIntegrationService.getRecentFlashcards(limit));
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generateCard(@RequestBody AnkiGenerationRequestDTO request) {
        if (request.getTextParagraph() != null && !request.getTextParagraph().isBlank()) {
            AnkiFlashcardDTO card = ankiIntegrationService.generateFromPdfParagraph(
                    request.getTextParagraph(),
                    request.getDisciplina(),
                    request.getAssunto(),
                    request.getSessionId() != null ? request.getSessionId() : "manual-session"
            );
            return ResponseEntity.ok(card);
        }

        if (request.getQuestionId() != null && !request.getQuestionId().isBlank()) {
            Optional<Question> qOpt = questionRepository.findById(request.getQuestionId());
            if (qOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Questão não encontrada"));
            }
            AnkiFlashcardDTO card = ankiIntegrationService.generateFromQuestionError(
                    qOpt.get(),
                    request.getSelectedOption() != null ? request.getSelectedOption() : "A",
                    "Geração manual do usuário",
                    request.getSessionId() != null ? request.getSessionId() : "manual-session"
            );
            return ResponseEntity.ok(card);
        }

        return ResponseEntity.badRequest().body(Map.of("error", "Forneça 'textParagraph' ou 'questionId'"));
    }

    @PostMapping("/batch-15")
    public ResponseEntity<List<AnkiFlashcardDTO>> generateSessionBatch15(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String sessionId) {
        List<AnkiFlashcardDTO> cards = ankiIntegrationService.generateSessionBatch15(
                concursoId,
                sessionId != null ? sessionId : "session-" + System.currentTimeMillis()
        );
        return ResponseEntity.ok(cards);
    }

    @PostMapping("/sync-queue")
    public ResponseEntity<Map<String, Object>> syncPendingQueue() {
        int synced = ankiIntegrationService.syncPendingQueue();
        AnkiConnectStatusDTO status = ankiIntegrationService.checkConnection();
        return ResponseEntity.ok(Map.of(
                "syncedNow", synced,
                "pendingRemaining", status.getPendingQueueCount(),
                "connected", status.isConnected(),
                "message", synced > 0
                        ? String.format("✓ %d flashcards foram enviados com sucesso para o Anki!", synced)
                        : (status.isConnected() ? "Nenhum card pendente na fila." : "Anki não detectado. Os cards permanecem seguros na fila local.")
        ));
    }

    @GetMapping("/export-csv")
    public ResponseEntity<byte[]> exportCsv(@RequestParam(required = false) String deckName) {
        String csv = ankiIntegrationService.exportToCsv(deckName);
        byte[] bytes = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fiscalstudy_anki_deck.txt\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(bytes);
    }
}
