package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.RevisionCalendarService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/revisoes")
@CrossOrigin(origins = "*")
public class RevisionCalendarController {

    private final RevisionCalendarService revisionCalendarService;
    private final com.fiscalstudy.backend.application.review.AdaptiveReviewDecisionEngine adaptiveReviewDecisionEngine;

    public RevisionCalendarController(RevisionCalendarService revisionCalendarService,
                                      com.fiscalstudy.backend.application.review.AdaptiveReviewDecisionEngine adaptiveReviewDecisionEngine) {
        this.revisionCalendarService = revisionCalendarService;
        this.adaptiveReviewDecisionEngine = adaptiveReviewDecisionEngine;
    }

    @GetMapping("/decisoes-adaptativas")
    public ResponseEntity<com.fiscalstudy.backend.application.review.AdaptiveRevisionDecisionDTO> getAdaptiveDecisions(
            @RequestParam(required = false) String concursoId,
            @RequestParam(defaultValue = "60") int tempoDisponivelMinutos) {
        return ResponseEntity.ok(adaptiveReviewDecisionEngine.evaluateDecisions(concursoId, tempoDisponivelMinutos));
    }

    @PostMapping("/falha-diagnostico")
    public ResponseEntity<com.fiscalstudy.backend.application.review.ReviewFailureDiagnosisDTO> evaluateReviewFailure(
            @RequestBody com.fiscalstudy.backend.application.review.ReviewFailureRequestDTO request) {
        return ResponseEntity.ok(adaptiveReviewDecisionEngine.handleReviewFailure(request));
    }

    @GetMapping("/agenda")
    public ResponseEntity<Map<String, Object>> getAgenda(@RequestParam(required = false) String concursoId) {
        Map<String, Object> agenda = revisionCalendarService.getAgenda(concursoId);
        return ResponseEntity.ok(agenda);
    }

    @GetMapping("/error-taxonomy-counts")
    public ResponseEntity<Map<String, Object>> getErrorTaxonomyCounts(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(revisionCalendarService.getErrorTaxonomyStats(concursoId));
    }

    @PostMapping("/{id}/concluir")
    public ResponseEntity<Map<String, Object>> completeRevision(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> body) {
        Double taxaAcerto = body != null && body.get("taxaAcerto") != null
                ? Double.parseDouble(body.get("taxaAcerto").toString())
                : 1.0;
        String sessionId = body != null && body.get("sessionId") != null
                ? body.get("sessionId").toString()
                : "manual";

        boolean success = revisionCalendarService.completeRevision(id, taxaAcerto, sessionId);
        if (success) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Revisão concluída e registrada com sucesso!"));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/adiar")
    public ResponseEntity<Map<String, Object>> postponeRevision(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> body) {
        int dias = body != null && body.get("dias") != null
                ? Integer.parseInt(body.get("dias").toString())
                : 1;
        String motivo = body != null && body.get("motivo") != null
                ? body.get("motivo").toString()
                : "Adiado pelo estudante";

        boolean success = revisionCalendarService.postponeRevision(id, dias, motivo);
        if (success) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Revisão adiada por " + dias + " dia(s)."));
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}/execucao")
    public ResponseEntity<Map<String, Object>> getExecutionContext(
            @PathVariable String id,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String topico) {
        Map<String, Object> context = revisionCalendarService.getRevisionExecutionContext(id, disciplina, topico);
        return ResponseEntity.ok(context);
    }

    @PostMapping("/{id}/tentativa")
    public ResponseEntity<Map<String, Object>> recordRecoveryAttempt(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        boolean sucesso = body.get("recuperouComSucesso") != null && Boolean.parseBoolean(body.get("recuperouComSucesso").toString());
        int confianca = body.get("nivelConfianca") != null ? Integer.parseInt(body.get("nivelConfianca").toString()) : 3;
        String resposta = body.get("respostaEvocacao") != null ? body.get("respostaEvocacao").toString() : "";
        boolean precisouExemplo = body.get("precisouExemplo") != null && Boolean.parseBoolean(body.get("precisouExemplo").toString());
        int tempoSegundos = body.get("tempoSegundos") != null ? Integer.parseInt(body.get("tempoSegundos").toString()) : 45;
        String sessionId = body.get("sessionId") != null ? body.get("sessionId").toString() : "manual";

        Map<String, Object> result = revisionCalendarService.recordRecoveryAttempt(
                id, sucesso, confianca, resposta, precisouExemplo, tempoSegundos, sessionId
        );
        return ResponseEntity.ok(result);
    }

    @PostMapping("/agendar")
    public ResponseEntity<Map<String, Object>> scheduleAutomatic(
            @RequestBody Map<String, String> body) {
        String sessionId = body.get("sessionId");
        String concursoId = body.get("concursoId");
        String disciplina = body.get("disciplina");
        String topico = body.get("topico");
        String origem = body.getOrDefault("origem", "MANUAL");

        revisionCalendarService.scheduleAutomaticRevision(sessionId, concursoId, disciplina, topico, origem, null);
        return ResponseEntity.ok(Map.of("success", true, "message", "Ciclo de revisões D+1, D+7, D+15 e D+30 agendado!"));
    }
}
