package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.SystemSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/v1/system")
public class SystemSettingsController {

    private final SystemSettingsService systemSettingsService;

    public SystemSettingsController(SystemSettingsService systemSettingsService) {
        this.systemSettingsService = systemSettingsService;
    }

    // --- T36: Configurações do Estudante ---

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(systemSettingsService.getSettings());
    }

    @PostMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(@RequestBody Map<String, Object> newSettings) {
        return ResponseEntity.ok(systemSettingsService.updateSettings(newSettings));
    }

    // --- T37: Dados, Backups e Recuperação ---

    @GetMapping("/backup/overview")
    public ResponseEntity<Map<String, Object>> getBackupOverview() {
        return ResponseEntity.ok(systemSettingsService.getBackupOverview());
    }

    @PostMapping("/backup/create")
    public ResponseEntity<Map<String, Object>> createBackup(@RequestBody(required = false) Map<String, String> body) {
        String label = (body != null) ? body.get("label") : "MANUAL";
        Map<String, Object> res = systemSettingsService.createConsistentBackup(label);
        if (Boolean.TRUE.equals(res.get("success"))) {
            return ResponseEntity.ok(res);
        } else {
            return ResponseEntity.badRequest().body(res);
        }
    }

    @PostMapping("/backup/verify")
    public ResponseEntity<Map<String, Object>> verifyIntegrity() {
        return ResponseEntity.ok(systemSettingsService.verifyIntegrity());
    }

    @GetMapping("/backup/list")
    public ResponseEntity<List<Map<String, Object>>> listBackups() {
        return ResponseEntity.ok(systemSettingsService.listBackups());
    }

    @PostMapping("/backup/restore")
    public ResponseEntity<Map<String, Object>> restoreBackup(@RequestBody Map<String, String> body) {
        String filename = body.get("filename");
        if (filename == null || filename.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Filename obrigatório"));
        }
        Map<String, Object> res = systemSettingsService.restoreBackup(filename);
        if (Boolean.TRUE.equals(res.get("success"))) {
            return ResponseEntity.ok(res);
        } else {
            return ResponseEntity.badRequest().body(res);
        }
    }

    // --- T38: Integrações e Motor Analítico ---

    @GetMapping("/integrations/status")
    public ResponseEntity<Map<String, Object>> getIntegrationsStatus() {
        return ResponseEntity.ok(systemSettingsService.getIntegrationsStatus());
    }

    // --- T39: Diagnóstico Técnico e Auditoria ---

    @GetMapping("/audit/report")
    public ResponseEntity<Map<String, Object>> getTechnicalAuditReport() {
        return ResponseEntity.ok(systemSettingsService.getTechnicalAuditReport());
    }

    // --- T40: Busca Global ---

    @GetMapping("/search")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> globalSearch(@RequestParam(name = "q", defaultValue = "") String query) {
        return ResponseEntity.ok(systemSettingsService.globalSearch(query));
    }
}
