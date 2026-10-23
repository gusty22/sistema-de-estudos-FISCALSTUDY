package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Serviço de Integração desacoplada (Batch CLI) entre Spring Boot e o motor estatístico R (analytics-engine).
 * Orquestra:
 * 1. Exportação canônica do banco SQLite para ../analytics-engine/data/raw/operational_export_v1.csv
 * 2. Execução autônoma em lote do Rscript run_analytics.R
 * 3. Consumo e desserialização de robin_hood_weights.json e analytical_signals_v1.json
 * 4. Fallback seguro e pedagógico caso R não esteja presente ou ocorra falha de execução.
 */
@Service
public class AnalyticsBridgeService {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsBridgeService.class);

    private final AnalyticsProjectionService analyticsProjectionService;
    private final RobinHoodCycleService robinHoodCycleService;
    private final ObjectMapper objectMapper;

    // Caminhos relativos canônicos do Monorepo
    private static Path resolveEngineDir() {
        Path local = Paths.get("analytics-engine");
        if (Files.exists(local) && Files.isDirectory(local)) {
            return local;
        }
        return Paths.get("../analytics-engine");
    }

    private static Path resolveExportCsv() {
        return resolveEngineDir().resolve("data/raw/operational_export_v1.csv");
    }

    private static Path resolveWeightsJson() {
        return resolveEngineDir().resolve("output/metrics/robin_hood_weights.json");
    }

    private static Path resolveSignalsJson() {
        return resolveEngineDir().resolve("output/metrics/analytical_signals_v1.json");
    }

    public AnalyticsBridgeService(AnalyticsProjectionService analyticsProjectionService,
                                  RobinHoodCycleService robinHoodCycleService,
                                  ObjectMapper objectMapper) {
        this.analyticsProjectionService = analyticsProjectionService;
        this.robinHoodCycleService = robinHoodCycleService;
        this.objectMapper = objectMapper;
    }

    /**
     * Exporta os dados consolidados do banco SQLite para o CSV canônico de entrada do motor R.
     */
    public synchronized Path exportCanonicalCsv() throws Exception {
        Path targetPath = resolveExportCsv().toAbsolutePath().normalize();
        if (targetPath.getParent() != null && !Files.exists(targetPath.getParent())) {
            Files.createDirectories(targetPath.getParent());
        }

        // Gera CSV respeitando rigorosamente o contrato do adapter.R
        String csvContent = analyticsProjectionService.exportCsv("ALL");
        Files.writeString(targetPath, csvContent, StandardCharsets.UTF_8);
        logger.info("Exportação canônica operacional concluída com sucesso em: {}", targetPath);
        return targetPath;
    }

    /**
     * Executa o pipeline de análise do R de forma assíncrona com fallback seguro.
     */
    @Async
    public CompletableFuture<AnalyticsExecutionResult> triggerAnalyticsAsync() {
        return CompletableFuture.completedFuture(executeAnalyticsPipeline());
    }

    /**
     * Executa o pipeline de análise do R sincronicamente via CLI ProcessBuilder.
     */
    public synchronized AnalyticsExecutionResult executeAnalyticsPipeline() {
        Instant startTime = Instant.now();
        logger.info("Iniciando pipeline analítico desacoplado via CLI em R...");

        try {
            // 1. Exportar CSV
            Path csvPath = exportCanonicalCsv();

            // 2. Localizar binário do Rscript
            String rscriptExe = locateRscriptExecutable();
            if (rscriptExe == null) {
                logger.warn("Rscript não encontrado no ambiente do sistema operacional. Aplicando fallback de pesos baseado no edital.");
                return applyFallbackWeights("Rscript não encontrado no sistema operacional. Pesos mantidos conforme prioridade do edital.");
            }

            File engineDir = resolveEngineDir().toFile();
            if (!engineDir.exists() || !engineDir.isDirectory()) {
                logger.warn("Diretório do analytics-engine não encontrado em: {}. Aplicando fallback seguro.", engineDir.getAbsolutePath());
                return applyFallbackWeights("Diretório analytics-engine ausente. Ciclo padronizado via edital.");
            }

            // 3. Execução desacoplada via ProcessBuilder
            List<String> command = List.of(
                    rscriptExe,
                    "run_analytics.R",
                    "data/raw/operational_export_v1.csv"
            );

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(engineDir);
            pb.redirectErrorStream(true);

            logger.info("Executando CLI: {} run_analytics.R data/raw/operational_export_v1.csv (cwd: {})", rscriptExe, engineDir.getAbsolutePath());
            Process process = pb.start();

            StringBuilder logs = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logs.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            logger.info("Processo R finalizado com código de saída: {}", exitCode);

            if (exitCode != 0) {
                logger.warn("Pipeline em R retornou código de erro {}. Log: \n{}", exitCode, logs);
                return applyFallbackWeights("Erro na execução estatística do R. Fallback aplicado com pesos padrão.");
            }

            // 4. Carregar e sincronizar artefatos de saída
            RobinHoodWeightsDTO weights = loadRobinHoodWeights();
            if (weights != null) {
                robinHoodCycleService.injectWeights(weights);
            }

            List<Map<String, Object>> signals = loadAnalyticalSignals();

            return new AnalyticsExecutionResult(
                    true,
                    "Pipeline estatístico e psicométrico em R executado com sucesso.",
                    weights,
                    signals,
                    logs.toString(),
                    Instant.now().toEpochMilli() - startTime.toEpochMilli()
            );

        } catch (Exception e) {
            logger.error("Exceção ao orquestrar motor R: {}", e.getMessage(), e);
            return applyFallbackWeights("Exceção operacional ao comunicar com analytics-engine: " + e.getMessage());
        }
    }

    /**
     * Desserializa os pesos de robin_hood_weights.json.
     */
    public RobinHoodWeightsDTO loadRobinHoodWeights() {
        Path p = resolveWeightsJson().toAbsolutePath().normalize();
        if (Files.exists(p)) {
            try {
                String json = Files.readString(p, StandardCharsets.UTF_8);
                RobinHoodWeightsDTO dto = objectMapper.readValue(json, RobinHoodWeightsDTO.class);
                logger.info("robin_hood_weights.json lido com sucesso (algoritmo: {})", dto.algorithm());
                return dto;
            } catch (Exception e) {
                logger.warn("Falha ao ler robin_hood_weights.json: {}", e.getMessage());
            }
        }
        return robinHoodCycleService.getActiveWeights();
    }

    /**
     * Desserializa os sinais de analytical_signals_v1.json.
     */
    public List<Map<String, Object>> loadAnalyticalSignals() {
        Path p = resolveSignalsJson().toAbsolutePath().normalize();
        if (Files.exists(p)) {
            try {
                String json = Files.readString(p, StandardCharsets.UTF_8);
                JsonNode root = objectMapper.readTree(json);
                JsonNode sigArray = root.path("signals");
                if (sigArray.isArray()) {
                    List<Map<String, Object>> list = new ArrayList<>();
                    for (JsonNode item : sigArray) {
                        Map<String, Object> map = objectMapper.convertValue(item, Map.class);
                        list.add(map);
                    }
                    return list;
                }
            } catch (Exception e) {
                logger.warn("Falha ao ler analytical_signals_v1.json: {}", e.getMessage());
            }
        }
        return Collections.emptyList();
    }

    /**
     * Fallback seguro: mantém pesos equilibrados no Robin Hood sem interromper a rotina do aluno.
     */
    private AnalyticsExecutionResult applyFallbackWeights(String reason) {
        logger.info("Aplicando pesos estáticos de contingência baseados no edital. Razão: {}", reason);
        robinHoodCycleService.syncWeightsFromFile(null);
        return new AnalyticsExecutionResult(
                false,
                reason,
                robinHoodCycleService.getActiveWeights(),
                Collections.emptyList(),
                "Fallback executado preventivamente.",
                0L
        );
    }

    /**
     * Localiza o executável do Rscript no PATH ou caminhos canônicos no Windows.
     */
    private String locateRscriptExecutable() {
        List<String> candidates = List.of(
                "Rscript",
                "C:\\Program Files\\R\\R-4.5.1\\bin\\Rscript.exe",
                "C:\\Program Files\\R\\R-4.5.1\\bin\\x64\\Rscript.exe",
                "C:\\Program Files\\R\\R-4.4.1\\bin\\Rscript.exe",
                "C:\\Program Files\\R\\R-4.3.1\\bin\\Rscript.exe",
                "C:\\Program Files\\R\\R-4.2.1\\bin\\Rscript.exe"
        );

        for (String c : candidates) {
            try {
                Process p = new ProcessBuilder(c, "--version").start();
                if (p.waitFor() == 0) {
                    return c;
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    public record AnalyticsExecutionResult(
            boolean success,
            String message,
            RobinHoodWeightsDTO weights,
            List<Map<String, Object>> signals,
            String logs,
            long executionTimeMs
    ) {}
}
