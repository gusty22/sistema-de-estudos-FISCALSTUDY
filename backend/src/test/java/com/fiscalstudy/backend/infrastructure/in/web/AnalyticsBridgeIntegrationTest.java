package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.AnalyticsBridgeService;
import com.fiscalstudy.backend.application.AttemptSubmissionService;
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
    void executeAnalyticsPipeline_RunsSuccessfullyAndInjectsWeights() throws Exception {
        String exec = bridgeService.resolveExecutable();
        boolean hasExec = Files.isRegularFile(Path.of(exec));
        assumeTrue(hasExec, "Rscript must be installed to run end-to-end bridge test");

        // Registrar tentativa válida
        attemptSubmissionService.submitAttempt("q1", "A", 5, 12000, "sess-real-bridge-1", "REAL_STUDY");

        AnalyticsBridgeService.AnalyticsExecutionResult result = bridgeService.executeAnalyticsPipeline();
        assertNotNull(result);
        assertTrue(result.success(), "Execução da pipeline falhou. Msg: " + result.message() + " | Logs: " + result.logs());
        assertNotNull(result.weights(), "Pesos do ciclo adaptativo Robin Hood devem ser gerados");
        assertNotNull(result.signals(), "Sinais analíticos devem ser extraídos");
        assertTrue(result.executionTimeMs() >= 0);

        // Validar recuperação subsequente via getters
        assertNotNull(bridgeService.loadRobinHoodWeights(), "Pesos devem ser recuperáveis do run bem-sucedido");
        assertNotNull(bridgeService.loadAnalyticalSignals(), "Sinais analíticos devem ser recuperáveis");
    }
}
