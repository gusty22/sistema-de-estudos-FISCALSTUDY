package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.CrossDomainBridgeService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CrossDomainBridgeDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CrossDomainResponseDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cross-domain")
@CrossOrigin(origins = "*")
public class CrossDomainBridgeController {

    private final CrossDomainBridgeService crossDomainBridgeService;

    public CrossDomainBridgeController(CrossDomainBridgeService crossDomainBridgeService) {
        this.crossDomainBridgeService = crossDomainBridgeService;
    }

    @GetMapping("/bridges")
    public ResponseEntity<List<CrossDomainBridgeDTO>> listBridges(@RequestParam(required = false) String disciplina) {
        return ResponseEntity.ok(crossDomainBridgeService.listBridges(disciplina));
    }

    @PostMapping("/synthesize")
    public ResponseEntity<CrossDomainResponseDTO> submitSynthesis(@RequestBody CrossDomainResponseDTO dto) {
        try {
            return ResponseEntity.ok(crossDomainBridgeService.submitSynthesis(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
