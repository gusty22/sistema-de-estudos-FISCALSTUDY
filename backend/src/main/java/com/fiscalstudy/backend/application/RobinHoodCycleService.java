package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.cycle.*;
import com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * Serviço de Aplicação para geração e gestão do Ciclo de Estudos Robin Hood.
 */
@Service
public class RobinHoodCycleService {

    private static final Logger logger = LoggerFactory.getLogger(RobinHoodCycleService.class);

    private final RobinHoodCycleEngine engine;
    private final TimeMetricService timeMetricService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private RobinHoodWeightsDTO activeWeights;
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths analyticsPaths;

    public RobinHoodCycleService(TimeMetricService timeMetricService, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.engine = new RobinHoodCycleEngine();
        this.timeMetricService = timeMetricService;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.activeWeights = null;
    }

    public RobinHoodCycleResult getOrGenerateCycle(String concursoId, Double weeklyHours, Integer blockMinutes) {
        // Obter disponibilidade semanal
        double hours = weeklyHours != null && weeklyHours > 0 ? weeklyHours : 24.0;
        int duration = blockMinutes != null && blockMinutes >= 50 ? blockMinutes : 60;

        if (concursoId != null && !concursoId.isBlank()) {
            List<Map<String, Object>> routineRows = jdbcTemplate.queryForList(
                    "SELECT horas_segunda + horas_terca + horas_quarta + horas_quinta + horas_sexta + horas_sabado + horas_domingo as total_semana " +
                            "FROM student_routines WHERE concurso_id = ?",
                    concursoId
            );
            if (!routineRows.isEmpty() && routineRows.get(0).get("total_semana") != null) {
                Number n = (Number) routineRows.get(0).get("total_semana");
                if (n.doubleValue() > 0) {
                    hours = n.doubleValue();
                }
            }
        }

        // Carregar disciplinas do concurso a partir de edital_topicos
        List<DisciplineProfile> profiles = loadDisciplineProfiles(concursoId);

        // Se não houver disciplinas cadastradas no concurso, retorna ciclo vazio honesto (sem dados simulados)
        if (profiles.isEmpty()) {
            return new RobinHoodCycleResult(
                    concursoId,
                    hours,
                    duration,
                    Collections.emptyList(),
                    0,
                    false,
                    Map.of("status", "Nenhuma disciplina cadastrada no edital para este concurso. Cadastre o edital para gerar o ciclo adaptativo.")
            );
        }

        // Buscar handoffs do passado (Mensagem para o Eu do Futuro)
        Map<String, Object> timeSummary = timeMetricService.getTimeMetricsSummary(concursoId);
        Map<String, String> handoffs = (Map<String, String>) timeSummary.getOrDefault("lastHandoffPerDisciplina", Collections.emptyMap());

        // Contagem de ciclos completados para gatilho de recalibração
        int completedCycles = 0;
        try {
            List<Map<String, Object>> countRow = jdbcTemplate.queryForList(
                    "SELECT COUNT(*) as c FROM event_store WHERE event_type = 'CYCLE_COMPLETED' " +
                            (concursoId != null ? "AND aggregate_id = '" + concursoId + "'" : "")
            );
            if (!countRow.isEmpty() && countRow.get(0).get("c") != null) {
                completedCycles = ((Number) countRow.get(0).get("c")).intValue();
            }
        } catch (Exception ignored) {}

        if (this.activeWeights == null) {
            autoLoadWeightsIfPresent();
        }

        return engine.generateCycle(concursoId, profiles, hours, duration, completedCycles, handoffs, this.activeWeights);
    }

    public synchronized void injectWeights(RobinHoodWeightsDTO weights) {
        this.activeWeights = weights;
        logger.info("Robin Hood Weights injetados com sucesso. Modelo fonte: {}, Tópicos críticos: {}",
                weights != null ? weights.sourceModel() : "null",
                weights != null && weights.criticalTopics() != null ? weights.criticalTopics().size() : 0);
    }

    public synchronized RobinHoodWeightsDTO getActiveWeights() {
        if (this.activeWeights == null) {
            autoLoadWeightsIfPresent();
        }
        return this.activeWeights;
    }

    public synchronized RobinHoodWeightsDTO syncWeightsFromFile(String customPath) {
        // Only the current completed run may supply analytical weights.
        if(analyticsPaths==null)return activeWeights;
        try {
            var manifest=objectMapper.readTree(Files.readString(analyticsPaths.currentManifest()));
            if(!"SUCCEEDED".equals(manifest.path("status").asText()))return activeWeights;
            Path run=analyticsPaths.output().resolve("runs").resolve(manifest.path("runId").asText()).normalize();
            if(!run.startsWith(analyticsPaths.output().resolve("runs")))throw new IllegalStateException("Invalid run path");
            Path file=run.resolve("metrics/robin_hood_weights.json");
            if(customPath!=null && !Path.of(customPath).toAbsolutePath().normalize().equals(file))throw new IllegalArgumentException("Only current run artifacts can be loaded");
            activeWeights=objectMapper.readValue(Files.readString(file),RobinHoodWeightsDTO.class);
            return activeWeights;
        }catch(java.nio.file.NoSuchFileException e){return activeWeights;}
        catch(Exception e){throw new IllegalStateException("Cannot load current analytical weights",e);}
    }
    private void autoLoadWeightsIfPresent(){syncWeightsFromFile(null);}

    private List<DisciplineProfile> loadDisciplineProfiles(String concursoId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId) && !"null".equalsIgnoreCase(concursoId)) {
            String sql = "SELECT disciplina, AVG(peso) as peso_medio, COUNT(*) as qtd_topicos " +
                    "FROM edital_topicos WHERE concurso_id = ? " +
                    "GROUP BY disciplina";
            rows = jdbcTemplate.queryForList(sql, concursoId.trim());
        } else {
            // Global view is explicit. An empty selected contest must stay empty.
            String fallbackSql = "SELECT disciplina, AVG(peso) as peso_medio, COUNT(*) as qtd_topicos " +
                    "FROM edital_topicos " +
                    "GROUP BY disciplina";
            rows = jdbcTemplate.queryForList(fallbackSql);
        }

        List<DisciplineProfile> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String disc = (String) r.get("disciplina");
            Number peso = (Number) r.getOrDefault("peso_medio", 1.0);
            Number qtd = (Number) r.getOrDefault("qtd_topicos", 10);

            // Estima estrelas baseado em taxa histórica se houver
            int stars = estimateMasteryStars(concursoId, disc);
            list.add(new DisciplineProfile(disc, peso.doubleValue(), qtd.intValue(), 50.0, stars, "GERAL"));
        }

        return list;
    }

    private int estimateMasteryStars(String concursoId, String disciplina) {
        // 1. Se pesos ativos (SWOT / Robin Hood) estiverem injetados, usa a acurácia calibrada
        if (this.activeWeights != null && this.activeWeights.weights() != null && this.activeWeights.weights().containsKey(disciplina)) {
            var dw = this.activeWeights.weights().get(disciplina);
            if (dw.accuracy() != null) {
                double acc = dw.accuracy();
                if (acc >= 0.85) return 5;
                if (acc >= 0.75) return 4;
                if (acc >= 0.60) return 3;
                if (acc >= 0.45) return 2;
                return 1;
            }
        }

        // 2. Consulta histórica real de respostas para esta disciplina
        try {
            Double avg = jdbcTemplate.queryForObject(
                "SELECT AVG(CASE WHEN payload_json LIKE '%\"isCorrect\":true%' THEN 1.0 ELSE 0.0 END) " +
                "FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE ?",
                Double.class,
                "%" + disciplina + "%"
            );
            if (avg != null) {
                if (avg >= 0.85) return 5;
                if (avg >= 0.75) return 4;
                if (avg >= 0.60) return 3;
                if (avg >= 0.45) return 2;
                return 1;
            }
        } catch (Exception ignored) {}

        // 3. Fallback neutro
        return 2;
    }
}

