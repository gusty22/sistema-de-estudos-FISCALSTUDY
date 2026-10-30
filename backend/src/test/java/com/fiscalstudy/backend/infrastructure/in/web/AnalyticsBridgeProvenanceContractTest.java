package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.application.AnalyticsBridgeService;
import com.fiscalstudy.backend.application.AnalyticsProjectionService;
import com.fiscalstudy.backend.application.RobinHoodCycleService;
import com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ExportManifestDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Real R process and synthetic files, without Spring, database, mocks or network. */
class AnalyticsBridgeProvenanceContractTest {
    private Path output;

    @Test
    @Timeout(value = 60, threadMode = Timeout.ThreadMode.SEPARATE_THREAD)
    void transportsMatchingManifestWithoutPromotingSyntheticEvidence() throws Exception {
        Files.createDirectories(Path.of("target/analytics-contract-tests"));
        output = Files.createTempDirectory(Path.of("target/analytics-contract-tests"), "run-").toAbsolutePath();
        var mapper = new ObjectMapper();
        Path engine = Path.of(System.getProperty("fiscalstudy.analytics-engine-dir", "../analytics-engine"))
                .toAbsolutePath().normalize();
        var paths = new AnalyticsPaths(null, engine.toString(), output.toString());
        String csv = "question_id,selected_option,is_correct,gabarito_status,confidence_level,active_time_ms,discipline,board,year,topic,assunto,event_id,session_id,occurred_at,origin_type\n"
                + "q-contract,A,true,DEFINITIVO,4,12345,Disciplina,Fixture,2026,Topico,Topico,event-contract,session-contract,2026-10-10T10:00:00Z,AUTOMATED_TEST\n";
        String checksum = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(csv.getBytes(StandardCharsets.UTF_8)));
        var packageCalls = new AtomicInteger();
        var projection = new AnalyticsProjectionService(null, null) {
            @Override public ExportPackageResult exportPackageToDirectory(Path run, String origin) throws java.io.IOException {
                assertEquals("REAL_STUDY", origin);
                packageCalls.incrementAndGet();
                Path source = run.resolve("fiscalstudy_attempts.csv");
                Path manifestPath = run.resolve("export_manifest.json");
                Files.writeString(source, csv, StandardCharsets.UTF_8);
                var manifest = new ExportManifestDTO("1.1.0", "1.1.0", "2026-10-10T11:00:00Z",
                        "ISOLATED_SYNTHETIC_CONTRACT", "fixture", false, "AUTOMATED_TEST", "REAL_STUDY",
                        "SYNTHETIC_FIXTURE", 1, 1, 1, 0, Map.of("AUTOMATED_TEST", 1),
                        List.of(new ExportManifestDTO.GeneratedFileDTO("fiscalstudy_attempts.csv",
                                "text/csv", 1, checksum, csv.getBytes(StandardCharsets.UTF_8).length)),
                        "SHA-256", checksum, List.of(), List.of(),
                        List.of("Synthetic fixture, never personal learning evidence"), "CONTRACT_FIXTURE_ONLY");
                mapper.writeValue(manifestPath.toFile(), manifest);
                return new ExportPackageResult(source, manifestPath, manifest);
            }
            @Override public String exportCsv(String origin) {
                throw new AssertionError("Bridge must request the snapshot package, not a bare CSV");
            }
        };
        var cycle = new RobinHoodCycleService(null, null, mapper);
        var bridge = new AnalyticsBridgeService(projection, cycle, mapper, paths);
        assumeTrue(com.fiscalstudy.backend.support.RscriptTestSupport.available(bridge.resolveExecutable()), "Local Rscript required");
        assumeTrue(Files.isRegularFile(engine.resolve("run_analytics.R")), "Local R engine required");
        var result = bridge.executeAnalyticsPipeline();
        assertTrue(result.success(), () -> result.message() + "\n" + result.logs());
        assertEquals(1, packageCalls.get());
        var execution = mapper.readTree(Files.readString(paths.currentManifest()));
        assertEquals("SUCCEEDED", execution.path("status").asText());
        assertEquals(checksum, execution.path("inputSha256").asText());
        Path run = output.resolve("runs").resolve(execution.path("runId").asText());
        assertEquals(csv, Files.readString(run.resolve("input.csv")));
        assertTrue(Files.isRegularFile(run.resolve("export_manifest.json")));
        var summary = mapper.readTree(Files.readString(run.resolve("metrics/metrics_summary_v1.json")));
        assertEquals(execution.path("runId").asText(), summary.path("run_id").asText());
        assertEquals("SYNTHETIC_FIXTURE", summary.path("data_provenance").asText());
        assertFalse(summary.path("is_real_student_data").asBoolean());
        assertFalse(summary.path("can_apply").asBoolean());
    }
}
