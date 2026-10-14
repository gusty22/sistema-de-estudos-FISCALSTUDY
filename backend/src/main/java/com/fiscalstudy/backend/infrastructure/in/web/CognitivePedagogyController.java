package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.CognitivePedagogyService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cognitive")
@CrossOrigin(origins = "*")
public class CognitivePedagogyController {

    private final CognitivePedagogyService cognitivePedagogyService;

    public CognitivePedagogyController(CognitivePedagogyService cognitivePedagogyService) {
        this.cognitivePedagogyService = cognitivePedagogyService;
    }

    // 1. Pré-Mortem
    @PostMapping("/pre-mortem")
    public ResponseEntity<PreMortemDTO> createPreMortem(@RequestBody PreMortemDTO dto) {
        return ResponseEntity.ok(cognitivePedagogyService.createPreMortem(dto));
    }

    @GetMapping("/pre-mortem")
    public ResponseEntity<List<PreMortemDTO>> listPreMortems(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(cognitivePedagogyService.listPreMortems(concursoId));
    }

    @DeleteMapping("/pre-mortem/{id}")
    public ResponseEntity<Void> deletePreMortem(@PathVariable String id) {
        cognitivePedagogyService.deletePreMortem(id);
        return ResponseEntity.noContent().build();
    }

    // 2. Feynman Sessions
    @PostMapping("/feynman")
    public ResponseEntity<FeynmanSessionDTO> recordFeynmanSession(@RequestBody FeynmanSessionDTO dto) {
        return ResponseEntity.ok(cognitivePedagogyService.recordFeynmanSession(dto));
    }

    @GetMapping("/feynman")
    public ResponseEntity<List<FeynmanSessionDTO>> listFeynmanSessions(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina
    ) {
        return ResponseEntity.ok(cognitivePedagogyService.listFeynmanSessions(concursoId, disciplina));
    }

    // 3. Pontos-Chave (Cloze Deletion)
    @PostMapping("/pontos-chave")
    public ResponseEntity<PontoChaveDTO> createPontoChave(@RequestBody PontoChaveDTO dto) {
        return ResponseEntity.ok(cognitivePedagogyService.createPontoChave(dto));
    }

    @GetMapping("/pontos-chave")
    public ResponseEntity<List<PontoChaveDTO>> listPontosChave(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String criterio
    ) {
        return ResponseEntity.ok(cognitivePedagogyService.listPontosChave(concursoId, disciplina, criterio));
    }

    @PostMapping("/pontos-chave/{id}/review")
    public ResponseEntity<Void> reviewPontoChave(@PathVariable String id, @RequestParam boolean acertou) {
        cognitivePedagogyService.reviewPontoChave(id, acertou);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/pontos-chave/{id}")
    public ResponseEntity<Void> deletePontoChave(@PathVariable String id) {
        cognitivePedagogyService.deletePontoChave(id);
        return ResponseEntity.noContent().build();
    }

    // 4. Método ERA
    @PostMapping("/metodo-era")
    public ResponseEntity<MetodoEraDTO> saveMetodoEraSession(@RequestBody MetodoEraDTO dto) {
        return ResponseEntity.ok(cognitivePedagogyService.saveMetodoEraSession(dto));
    }

    @GetMapping("/metodo-era")
    public ResponseEntity<List<MetodoEraDTO>> listMetodoEraSessions(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(cognitivePedagogyService.listMetodoEraSessions(concursoId));
    }

    // 5. Auditoria de Erros Críticos (Feynman Constrangido)
    @PostMapping("/feynman-audit")
    public ResponseEntity<CriticalErrorFeynmanAuditDTO> recordCriticalErrorAudit(@RequestBody CriticalErrorFeynmanAuditDTO dto) {
        if (dto.getPegadinhaExplicacao() == null || dto.getPegadinhaExplicacao().trim().length() < 10) {
            return ResponseEntity.badRequest().build();
        }
        if (dto.getRegraCorretaExplicacao() == null || dto.getRegraCorretaExplicacao().trim().length() < 10) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(cognitivePedagogyService.recordCriticalErrorAudit(dto));
    }
}
