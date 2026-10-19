package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.QuestionBankService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/bank")
@CrossOrigin(origins = "*")
public class QuestionBankController {

    private final QuestionBankService questionBankService;

    public QuestionBankController(QuestionBankService questionBankService) {
        this.questionBankService = questionBankService;
    }

    @GetMapping("/questions")
    public ResponseEntity<Map<String, Object>> searchQuestions(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String assunto,
            @RequestParam(required = false) String banca,
            @RequestParam(required = false) Integer ano,
            @RequestParam(required = false) String cargo,
            @RequestParam(required = false) String orgao,
            @RequestParam(required = false) String tipoQuestao,
            @RequestParam(required = false) String situacao,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "15") Integer limit
    ) {
        return ResponseEntity.ok(questionBankService.searchQuestions(
                concursoId, disciplina, assunto, banca, ano, cargo, orgao, tipoQuestao, situacao, q, page, limit
        ));
    }

    @GetMapping("/filters-metadata")
    public ResponseEntity<Map<String, Object>> getFiltersMetadata() {
        return ResponseEntity.ok(questionBankService.getFiltersMetadata());
    }

    @PostMapping("/questions/{id}/favorite")
    public ResponseEntity<Map<String, Object>> toggleFavorite(@PathVariable String id) {
        boolean isFav = questionBankService.toggleFavorite(id);
        return ResponseEntity.ok(Map.of("questionId", id, "isFavorite", isFav));
    }

    @PostMapping("/questions/{id}/report")
    public ResponseEntity<Void> reportQuestion(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String motivo = body.getOrDefault("motivo", "ERRO_CONTEUDO");
        String descricao = body.getOrDefault("descricao", "");
        questionBankService.reportQuestion(id, motivo, descricao);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/notebooks")
    public ResponseEntity<List<Map<String, Object>>> getNotebooks(
            @RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(questionBankService.getNotebooks(concursoId));
    }

    @PostMapping("/notebooks")
    public ResponseEntity<Map<String, Object>> saveNotebook(
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(questionBankService.saveNotebook(payload));
    }
}
