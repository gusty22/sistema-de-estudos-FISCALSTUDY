package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.cycle.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

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

    public RobinHoodCycleService(TimeMetricService timeMetricService, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.engine = new RobinHoodCycleEngine();
        this.timeMetricService = timeMetricService;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
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

        // Se não houver disciplinas cadastradas no concurso, criar conjunto base para demonstração
        if (profiles.isEmpty()) {
            profiles = List.of(
                    new DisciplineProfile("Direito Tributário", 2.0, 20, 50.0, 4, "JURIDICA"),
                    new DisciplineProfile("Contabilidade Geral", 2.0, 20, 50.0, 3, "FISCAL"),
                    new DisciplineProfile("Tecnologia da Informação", 3.0, 25, 60.0, 1, "TI"),
                    new DisciplineProfile("Legislação Tributária", 2.5, 25, 60.0, 2, "FISCAL"),
                    new DisciplineProfile("Direito Administrativo", 1.0, 10, 50.0, 5, "JURIDICA"),
                    new DisciplineProfile("Português", 1.0, 15, 50.0, 3, "GERAL")
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

        return engine.generateCycle(concursoId, profiles, hours, duration, completedCycles, handoffs);
    }

    private List<DisciplineProfile> loadDisciplineProfiles(String concursoId) {
        if (concursoId == null || concursoId.isBlank()) {
            return Collections.emptyList();
        }

        String sql = "SELECT disciplina, AVG(peso) as peso_medio, COUNT(*) as qtd_topicos " +
                "FROM edital_topicos WHERE concurso_id = ? " +
                "GROUP BY disciplina";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, concursoId);
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
        // Consulta simplificada para estimar domínio de 0 a 5 estrelas
        // Se ainda não resolveu questões dessa disciplina, inicia com 1 estrela
        return 2;
    }
}
