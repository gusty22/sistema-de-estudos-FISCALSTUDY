package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.EditalImportService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.EditalValidationResultDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping({"/api/v1/edital", "/api/v1/editais"})
public class EditalImportController {

    private final EditalImportService editalImportService;

    public EditalImportController(EditalImportService editalImportService) {
        this.editalImportService = editalImportService;
    }

    /**
     * Endpoint de validação puramente em memória, independente de concurso.
     * Permite validar e inspecionar a hierarquia do edital JSON antes da criação do concurso.
     * Zero efeitos colaterais e zero persistência no banco.
     */
    @PostMapping(value = "/validate-json", consumes = {"application/json", "text/plain", "*/*"})
    public ResponseEntity<EditalValidationResultDTO> validateEditalJsonStandalone(@RequestBody String rawJson) {
        EditalValidationResultDTO result = editalImportService.validateJson(rawJson);
        return ResponseEntity.ok(result);
    }
}
