package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnalyticsProjectionService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnalyticsOverviewDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
@CrossOrigin(origins = "*")
public class AnalyticsController {

    private final AnalyticsProjectionService analyticsProjectionService;
    private final com.fiscalstudy.backend.application.QuestionHistoryService questionHistoryService;

    public AnalyticsController(AnalyticsProjectionService analyticsProjectionService,
                               com.fiscalstudy.backend.application.QuestionHistoryService questionHistoryService) {
        this.analyticsProjectionService = analyticsProjectionService;
        this.questionHistoryService = questionHistoryService;
    }

    @GetMapping("/overview")
    public ResponseEntity<AnalyticsOverviewDTO> getOverview() {
        AnalyticsOverviewDTO overview = analyticsProjectionService.computeOverview();
        return ResponseEntity.ok(overview);
    }

    @GetMapping("/question-history")
    public ResponseEntity<com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionHistoryDTO.Response> getQuestionHistory(
            @RequestParam(required = false) String concursoId,
            @RequestParam(required = false) String disciplina,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String period,
            @RequestParam(required = false, defaultValue = "100") Integer limit,
            @RequestParam(required = false, defaultValue = "0") Integer offset
    ) {
        return ResponseEntity.ok(questionHistoryService.getQuestionHistory(concursoId, disciplina, topic, result, period, limit, offset));
    }

    @GetMapping("/performance-xray")
    public ResponseEntity<com.fiscalstudy.backend.infrastructure.in.web.dto.PerformanceXRayDTO> getPerformanceXRay(
            @RequestParam(required = false) String concursoId
    ) {
        return ResponseEntity.ok(questionHistoryService.getPerformanceXRay(concursoId));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> exportCsv(
            @RequestParam(required = false, defaultValue = "ALL") String origin,
            @RequestParam(required = false) Long snapshotRowid) {
        String csvData = snapshotRowid != null
                ? analyticsProjectionService.exportCsv(origin, snapshotRowid)
                : analyticsProjectionService.exportCsv(origin);
        byte[] bytes = csvData.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String sha256 = analyticsProjectionService.calculateSha256(bytes);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fiscalstudy_attempts.csv\"")
                .header(HttpHeaders.ETAG, "\"" + sha256 + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvData);
    }

    @GetMapping(value = "/export/manifest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ExportManifestDTO> exportManifest(
            @RequestParam(required = false, defaultValue = "ALL") String origin,
            @RequestParam(required = false) Long snapshotRowid) {
        ExportManifestDTO manifest = snapshotRowid != null
                ? analyticsProjectionService.generateExportManifest(origin, snapshotRowid)
                : analyticsProjectionService.generateExportManifest(origin);
        return ResponseEntity.ok(manifest);
    }

    @GetMapping(value = "/export/questions-v1", produces = "text/csv")
    public ResponseEntity<String> exportQuestionsV1(
            @RequestParam(required = false, defaultValue = "ALL") String origin,
            @RequestParam(required = false) Long snapshotRowid) {
        String csvData = analyticsProjectionService.exportQuestionsV1Csv(origin, snapshotRowid);
        byte[] bytes = csvData.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String sha256 = analyticsProjectionService.calculateSha256(bytes);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"questions_v1.csv\"")
                .header(HttpHeaders.ETAG, "\"" + sha256 + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvData);
    }

    @GetMapping(value = "/export/events-v1", produces = "text/csv")
    public ResponseEntity<String> exportEventsV1(
            @RequestParam(required = false, defaultValue = "ALL") String eventType,
            @RequestParam(required = false) Long snapshotRowid) {
        String csvData = analyticsProjectionService.exportEventsV1Csv(eventType, snapshotRowid);
        byte[] bytes = csvData.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String sha256 = analyticsProjectionService.calculateSha256(bytes);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"events_v1.csv\"")
                .header(HttpHeaders.ETAG, "\"" + sha256 + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvData);
    }

    @PostMapping(value = "/export/sync-to-local")
    public ResponseEntity<java.util.Map<String, String>> syncToLocal(
            @RequestParam(required = false) String targetDir,
            @RequestParam(required = false, defaultValue = "ALL") String origin) {
        java.util.Map<String, String> result = analyticsProjectionService.exportSyncToLocal(targetDir, origin);
        return ResponseEntity.ok(result);
    }
}
