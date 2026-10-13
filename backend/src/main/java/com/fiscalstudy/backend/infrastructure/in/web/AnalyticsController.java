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
    public ResponseEntity<String> exportCsv(@RequestParam(required = false, defaultValue = "ALL") String origin) {
        String csvData = analyticsProjectionService.exportCsv(origin);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fiscalstudy_attempts.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvData);
    }

    @GetMapping(value = "/export/manifest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ExportManifestDTO> exportManifest(@RequestParam(required = false, defaultValue = "ALL") String origin) {
        ExportManifestDTO manifest = analyticsProjectionService.generateExportManifest(origin);
        return ResponseEntity.ok(manifest);
    }
}
