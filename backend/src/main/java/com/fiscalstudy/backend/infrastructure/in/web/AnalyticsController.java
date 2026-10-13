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

    public AnalyticsController(AnalyticsProjectionService analyticsProjectionService) {
        this.analyticsProjectionService = analyticsProjectionService;
    }

    @GetMapping("/overview")
    public ResponseEntity<AnalyticsOverviewDTO> getOverview() {
        AnalyticsOverviewDTO overview = analyticsProjectionService.computeOverview();
        return ResponseEntity.ok(overview);
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
}
