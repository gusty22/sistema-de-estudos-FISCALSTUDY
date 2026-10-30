package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnalyticsBridgeService;
import com.fiscalstudy.backend.application.AttemptSubmissionService;
import com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@SpringBootTest
@ActiveProfiles("test")
public class AnalyticsBridgeIntegrationTest {

    @Autowired
    private AnalyticsBridgeService bridgeService;

    @Autowired
    private AttemptSubmissionService attemptSubmissionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AnalyticsPaths analyticsPaths;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");

        String optionsJson = "[\"A) Primeira\", \"B) Segunda\", \"C) Terceira\", \"D) Quarta\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, orgao, cargo, disciplina, assunto) " +
                "VALUES ('q1', 'Enunciado Q1', ?, 'A', 'DEFINITIVO', 'IBGP', 2023, 'Prefeitura de Araguari', 'Auditor Fiscal', 'Direito Tributário', 'Imunidades')",
                optionsJson);
    }

    @Test
    void resolveExecutable_IdentifiesInstalledRscriptOrValidFallback() {
        String exec = bridgeService.resolveExecutable();
        assertNotNull(exec, "Executable path cannot be null");
        assertFalse(exec.isBlank(), "Executable path cannot be blank");
        // Se estiver no Windows com R instalado, deve apontar para o executável existente
        if (System.getProperty("os.name", "").toLowerCase().contains("win")) {
            Path p = Path.of(exec);
            if (Files.isRegularFile(p)) {
                assertTrue(exec.toLowerCase().endsWith("rscript.exe") || exec.toLowerCase().endsWith("rscript"));
            }
        }
    }

    @Test
    void executeAnalyticsPipeline_ProducesReadOnlyArtifacts() throws Exception {
        String exec = bridgeService.resolveExecutable();
        boolean hasExec = com.fiscalstudy.backend.support.RscriptTestSupport.available(exec);
        assumeTrue(hasExec, "Rscript must be installed to run end-to-end bridge test");

        // Registrar tentativa válida
        attemptSubmissionService.submitAttempt("q1", "A", 5, 12000, "sess-real-bridge-1", "REAL_STUDY");

        AnalyticsBridgeService.AnalyticsExecutionResult result = bridgeService.executeAnalyticsPipeline();
        assertNotNull(result);
        assertTrue(result.success(), "Execução da pipeline falhou. Msg: " + result.message() + " | Logs: " + result.logs());
        assertNotNull(result.weights(), "Envelope analitico observacional deve estar disponivel");
        assertNotNull(result.signals(), "Sinais analíticos devem ser extraídos");
        assertTrue(result.executionTimeMs() >= 0);

        // Transport validation on an isolated test database; not personal learning evidence.
        var mapper = new ObjectMapper();
        var runManifest = mapper.readTree(Files.readString(analyticsPaths.currentManifest()));
        String runId = runManifest.path("runId").asText();
        Path run = analyticsPaths.output().resolve("runs").resolve(runId);
        Path exportManifest = run.resolve("export_manifest.json");
        assertTrue(Files.isRegularFile(exportManifest), "Each run must retain its own export manifest");
        var sourceManifest = mapper.readTree(Files.readString(exportManifest));
        assertEquals(runManifest.path("inputSha256").asText(), sourceManifest.path("checksum").asText(),
                "The R input and export manifest must describe identical bytes");
        var summary = mapper.readTree(Files.readString(run.resolve("metrics/metrics_summary_v1.json")));
        assertEquals(runId, summary.path("run_id").asText(), "R artifacts belong to this actual run");
        assertFalse(summary.path("can_apply").asBoolean(), "A transport test cannot authorize planning");
        assertTrue(Files.isRegularFile(run.resolve("metrics/temporal_baseline_backtest_v1.json")));
        assertTrue(Files.isRegularFile(run.resolve("metrics/retrieval_surprise_v1.json")));

        // Validar recuperação subsequente via getters
        assertNotNull(bridgeService.loadRobinHoodWeights(), "Pesos devem ser recuperáveis do run bem-sucedido");
        assertNotNull(bridgeService.loadAnalyticalSignals(), "Sinais analíticos devem ser recuperáveis");
    }
}
