package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.cycle.RobinHoodCycleEngine;
import com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Calibrador Automático de Pesos do Ciclo (Feedback Loop Pós-Simulado SWOT).
 *
 * Ao salvar ou concluir um Simulado SWOT no domingo, este serviço:
 * 1. Mapeia disciplinas e tópicos nas quatro zonas da Matriz SWOT:
 *    - FORÇA (Strengths): Acerto >= 80% (matéria consolidada).
 *    - AMEAÇA (Threats): Acerto < 65% E alto peso no edital (peso >= 1.5).
 *    - FRAQUEZA (Weaknesses): Acerto < 60% com peso moderado.
 *    - OPORTUNIDADE (Opportunities): Acerto entre 60% e 79%.
 * 2. Executa a Lei de Robin Hood Pós-Simulado:
 *    - Rouba de 15% a 20% (padrão 18%) do tempo das matérias em zona de FORÇA.
 *    - Injeta proporcionalmente o montante roubado nas matérias em zona de AMEAÇA e FRAQUEZA.
 * 3. Identifica tópicos críticos com erros (ex: "Crédito Tributário") e gera blocos emergenciais
 *    de intervenção prioritária no ciclo.
 * 4. Constrói e injeta os novos pesos no {@link RobinHoodCycleService}, recalculando a semana seguinte.
 * 5. Registra o evento imutável no event_store e persiste a calibração para auditoria.
 */
@Service
public class SwotCycleCalibratorService {

    private static final Logger log = LoggerFactory.getLogger(SwotCycleCalibratorService.class);

    public static final double DEFAULT_STEAL_RATE_PERCENT = 18.0; // 15% a 20%
    public static final double MIN_STEAL_RATE_PERCENT = 15.0;
    public static final double MAX_STEAL_RATE_PERCENT = 20.0;
    public static final double STRENGTH_THRESHOLD = 80.0; // >= 80%
    public static final double THREAT_ACCURACY_THRESHOLD = 65.0; // < 65%
    public static final double THREAT_WEIGHT_THRESHOLD = 1.5; // peso >= 1.5
    public static final double WEAKNESS_THRESHOLD = 60.0; // < 60%

    private final JdbcTemplate jdbcTemplate;
    private final RobinHoodCycleService robinHoodCycleService;
    private final ObjectMapper objectMapper;

    public SwotCycleCalibratorService(JdbcTemplate jdbcTemplate,
                                      RobinHoodCycleService robinHoodCycleService,
                                      ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.robinHoodCycleService = robinHoodCycleService;
        this.objectMapper = objectMapper;
        ensureTables();
    }

    private void ensureTables() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS cycle_swot_calibrations (
                    id TEXT PRIMARY KEY,
                    concurso_id TEXT,
                    simulado_id TEXT,
                    taxa_roubo_pct REAL NOT NULL,
                    horas_semanais_total REAL NOT NULL,
                    horas_roubadas_total REAL NOT NULL,
                    disciplinas_doadoras TEXT,
                    disciplinas_receptoras TEXT,
                    topicos_criticos_json TEXT,
                    detalhes_json TEXT,
                    created_at TEXT NOT NULL
                )
            """);
        } catch (Exception e) {
            log.warn("Aviso ao criar tabela cycle_swot_calibrations: {}", e.getMessage());
        }
    }

    public record SwotDisciplineReport(
            String disciplina,
            double pesoEdital,
            int questoesSimulado,
            int acertos,
            int erros,
            double taxaAcertoPct,
            String zonaSwot, // FORCA, AMEACA, FRAQUEZA, OPORTUNIDADE
            double horasOriginais,
            double horasDelta, // negativo se doadora, positivo se receptora
            double horasRecalibradas,
            double variacaoPct,
            List<String> topicosCriticos
    ) {}

    public record SwotCalibrationResult(
            String calibrationId,
            String concursoId,
            String simuladoId,
            String timestamp,
            double taxaRouboAplicadaPct,
            double horasSemanaisTotal,
            double totalHorasTransferidas,
            List<String> materiasDoadoras,
            List<String> materiasReceptoras,
            List<SwotDisciplineReport> disciplinas,
            List<Map<String, Object>> blocosEmergenciais,
            String resumoPedagogico
    ) {}

    /**
     * Executa a recalibração automática do ciclo de estudos a partir dos dados do Simulado SWOT.
     *
     * @param concursoId ID do concurso ativo
     * @param simuladoPayload Payload contendo dados de execução e desempenho por disciplina/tópico
     * @return SwotCalibrationResult detalhado com o mapa antes/depois da carga horária
     */
    public SwotCalibrationResult recalibrateFromSimulado(String concursoId, Map<String, Object> simuladoPayload) {
        String calibrationId = "swot_calib_" + UUID.randomUUID().toString().substring(0, 8);
        String now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String simuladoId = simuladoPayload != null ? (String) simuladoPayload.getOrDefault("id", simuladoPayload.get("executionId")) : null;

        // 1. Determina a taxa de roubo temporal (default 18%, limitada a [15%, 20%])
        double stealRate = DEFAULT_STEAL_RATE_PERCENT;
        if (simuladoPayload != null && simuladoPayload.containsKey("taxaRouboPct")) {
            try {
                double reqRate = Double.parseDouble(String.valueOf(simuladoPayload.get("taxaRouboPct")));
                stealRate = Math.min(Math.max(reqRate, MIN_STEAL_RATE_PERCENT), MAX_STEAL_RATE_PERCENT);
            } catch (Exception ignored) {}
        }

        // 2. Carrega disponibilidade semanal de horas (padrão 24.0h ou da rotina do concurso)
        double weeklyHours = loadWeeklyHours(concursoId, simuladoPayload);

        // 3. Mapeia disciplinas do edital com pesos e contagem de questões
        Map<String, Double> pesosEdital = loadPesosEdital(concursoId);

        // 4. Extrai desempenho do simulado por disciplina e tópicos com erro
        Map<String, SimuladoDisciplineStats> stats = extractSimuladoStats(concursoId, simuladoPayload, pesosEdital);

        if (stats.isEmpty()) {
            log.info("Nenhuma disciplina encontrada para recalibração SWOT no concurso {}. Mantendo ciclo neutro.", concursoId);
            return emptyResult(calibrationId, concursoId, simuladoId, now, weeklyHours);
        }

        // 5. Calcula horas originais semanais distribuídas pelo peso do edital
        double totalWeight = 0.0;
        for (SimuladoDisciplineStats s : stats.values()) {
            totalWeight += s.pesoEdital;
        }
        if (totalWeight <= 0.0) totalWeight = stats.size();

        Map<String, Double> baseHours = new LinkedHashMap<>();
        for (Map.Entry<String, SimuladoDisciplineStats> entry : stats.entrySet()) {
            double h = weeklyHours * (entry.getValue().pesoEdital / totalWeight);
            baseHours.put(entry.getKey(), h);
        }

        // 6. Classificação SWOT e cálculo de transferência
        List<String> doadoras = new ArrayList<>();
        List<String> receptoras = new ArrayList<>();
        double totalStolenHours = 0.0;

        Map<String, String> zonasSwot = new LinkedHashMap<>();
        Map<String, Double> deltas = new LinkedHashMap<>();

        // Passo A: Identificar zonas e roubar das Forças (>= 80%)
        for (Map.Entry<String, SimuladoDisciplineStats> entry : stats.entrySet()) {
            String disc = entry.getKey();
            SimuladoDisciplineStats s = entry.getValue();
            double acc = s.getTaxaAcerto();
            double peso = s.pesoEdital;

            if (acc >= STRENGTH_THRESHOLD && s.total > 0) {
                zonasSwot.put(disc, "FORCA");
                doadoras.add(disc);
                double stolen = baseHours.get(disc) * (stealRate / 100.0);
                totalStolenHours += stolen;
                deltas.put(disc, -stolen);
            } else if (acc < THREAT_ACCURACY_THRESHOLD && peso >= THREAT_WEIGHT_THRESHOLD) {
                zonasSwot.put(disc, "AMEACA");
                receptoras.add(disc);
            } else if (acc < WEAKNESS_THRESHOLD) {
                zonasSwot.put(disc, "FRAQUEZA");
                receptoras.add(disc);
            } else {
                zonasSwot.put(disc, "OPORTUNIDADE");
            }
        }

        // Se não houver receptoras formais mas houver doadoras, as receptoras serão as matérias de menor acurácia e maior peso
        if (receptoras.isEmpty() && totalStolenHours > 0) {
            String lowestDisc = null;
            double lowestScore = Double.MAX_VALUE;
            for (Map.Entry<String, SimuladoDisciplineStats> entry : stats.entrySet()) {
                if (!doadoras.contains(entry.getKey())) {
                    double score = entry.getValue().getTaxaAcerto() / Math.max(1.0, entry.getValue().pesoEdital);
                    if (score < lowestScore) {
                        lowestScore = score;
                        lowestDisc = entry.getKey();
                    }
                }
            }
            if (lowestDisc != null) {
                receptoras.add(lowestDisc);
                zonasSwot.put(lowestDisc, "OPORTUNIDADE_ALTO_PESO");
            }
        }

        // Passo B: Injetar nas receptoras proporcionalmente ao déficit de domínio e peso do edital
        if (totalStolenHours > 0 && !receptoras.isEmpty()) {
            double totalInjectionScore = 0.0;
            Map<String, Double> injectionScores = new LinkedHashMap<>();

            for (String rDisc : receptoras) {
                SimuladoDisciplineStats s = stats.get(rDisc);
                double deficit = Math.max(15.0, 100.0 - s.getTaxaAcerto());
                double mult = "AMEACA".equals(zonasSwot.get(rDisc)) ? 1.6 : 1.0;
                double score = deficit * s.pesoEdital * mult;
                injectionScores.put(rDisc, score);
                totalInjectionScore += score;
            }

            if (totalInjectionScore <= 0.0) totalInjectionScore = receptoras.size();

            for (String rDisc : receptoras) {
                double fraction = injectionScores.get(rDisc) / totalInjectionScore;
                double injected = totalStolenHours * fraction;
                deltas.put(rDisc, injected);
            }
        }

        // 7. Monta os relatórios finais e garante a conservação de horas
        List<SwotDisciplineReport> reports = new ArrayList<>();
        Map<String, RobinHoodWeightsDTO.DisciplineWeightDTO> weightsMap = new LinkedHashMap<>();
        List<RobinHoodWeightsDTO.CriticalTopicDTO> criticalTopicsList = new ArrayList<>();
        List<Map<String, Object>> emergencyBlocks = new ArrayList<>();

        for (Map.Entry<String, SimuladoDisciplineStats> entry : stats.entrySet()) {
            String disc = entry.getKey();
            SimuladoDisciplineStats s = entry.getValue();
            double origH = baseHours.getOrDefault(disc, weeklyHours / stats.size());
            double deltaH = deltas.getOrDefault(disc, 0.0);
            double recalibH = Math.max(1.0, origH + deltaH);
            double varPct = origH > 0 ? (deltaH / origH) * 100.0 : 0.0;
            String zona = zonasSwot.getOrDefault(disc, "OPORTUNIDADE");

            reports.add(new SwotDisciplineReport(
                    disc,
                    Math.round(s.pesoEdital * 10.0) / 10.0,
                    s.total,
                    s.acertos,
                    s.erros,
                    Math.round(s.getTaxaAcerto() * 10.0) / 10.0,
                    zona,
                    Math.round(origH * 10.0) / 10.0,
                    Math.round(deltaH * 10.0) / 10.0,
                    Math.round(recalibH * 10.0) / 10.0,
                    Math.round(varPct * 10.0) / 10.0,
                    s.topicosComErro
            ));

            // Constrói peso para o RobinHoodWeightsDTO
            double sharePct = (recalibH / weeklyHours) * 100.0;
            String urgency = "AMEACA".equals(zona) ? "OVERDUE_CRITICAL_INTERVENTION"
                    : ("FRAQUEZA".equals(zona) ? "CRITICAL_INTERVENTION" : "BALANCED");

            weightsMap.put(disc, new RobinHoodWeightsDTO.DisciplineWeightDTO(
                    disc,
                    s.total,
                    s.acertos,
                    s.getTaxaAcerto() / 100.0,
                    Math.max(0.2, (s.getTaxaAcerto() / 100.0) - 0.1),
                    urgency,
                    "AMEACA".equals(zona) ? 1 : 5,
                    "AMEACA".equals(zona) ? 0 : 3,
                    s.pesoEdital * 10.0,
                    "AMEACA".equals(zona) ? "Reforço urgente pós-simulado" : "Manutenção",
                    sharePct,
                    "AMEACA".equals(zona) ? 30 : 20
            ));

            // Tópicos críticos de erro detectados no simulado (ex: "Crédito Tributário")
            if (("AMEACA".equals(zona) || "FRAQUEZA".equals(zona)) && !s.topicosComErro.isEmpty()) {
                for (String topico : s.topicosComErro) {
                    String rationale = String.format("🚨 Feedback Loop Pós-Simulado SWOT: Desempenho crítico em %s (aproveitamento %.1f%%). +%.1fh redistribuídas de matérias consolidadas.",
                            disc, s.getTaxaAcerto(), Math.max(0.5, deltaH));

                    criticalTopicsList.add(new RobinHoodWeightsDTO.CriticalTopicDTO(
                            disc,
                            topico,
                            0.0, 0.0, 0.0, 0.0,
                            s.getTaxaAcerto() / 100.0,
                            s.total,
                            false,
                            95.0,
                            "BLOCO_EMERGENCIAL_REVISAO",
                            30,
                            rationale
                    ));

                    Map<String, Object> block = new LinkedHashMap<>();
                    block.put("disciplina", disc);
                    block.put("topico", topico);
                    block.put("duracaoMinutos", 30);
                    block.put("motivo", rationale);
                    block.put("horasAdicionadas", Math.round(deltaH * 10.0) / 10.0);
                    emergencyBlocks.add(block);
                }
            }
        }

        // 8. Injeta os pesos ativos diretamente no RobinHoodCycleService
        List<RobinHoodWeightsDTO.HyperConsolidatedDTO> donorsDTO = doadoras.stream()
                .map(d -> new RobinHoodWeightsDTO.HyperConsolidatedDTO(
                        d,
                        0.88,
                        0.92,
                        (int) Math.round(Math.abs(deltas.getOrDefault(d, 0.0)) * 60),
                        "FORCA_CONSOLIDADA"
                ))
                .toList();

        RobinHoodWeightsDTO.RedistributionPlanDTO planDTO = new RobinHoodWeightsDTO.RedistributionPlanDTO(
                (int) Math.round(totalStolenHours * 60),
                doadoras.isEmpty() ? "Nenhuma" : String.join(", ", doadoras),
                receptoras.isEmpty() ? "Nenhuma" : String.join(", ", receptoras),
                criticalTopicsList.isEmpty() ? "Reforço Geral" : criticalTopicsList.get(0).topic(),
                "SWOT_FEEDBACK_LOOP_18PCT"
        );

        RobinHoodWeightsDTO recalculatedWeights = new RobinHoodWeightsDTO(
                "v1.swot-feedback-loop",
                now,
                "SWOT_SIMULADO_CALIBRATOR",
                "ROBIN_HOOD_18_PERCENT_HEURISTIC",
                0.85,
                stats.size(),
                weightsMap,
                new RobinHoodWeightsDTO.RecommendationsDTO(
                        doadoras,
                        receptoras,
                        String.format("Transferência de %.1fh das disciplinas de Força (>80%%) para disciplinas de Ameaça/Fraqueza com alto peso no edital.", totalStolenHours)
                ),
                Map.of("stealRatePercent", stealRate, "concursoId", concursoId != null ? concursoId : "GLOBAL"),
                criticalTopicsList,
                donorsDTO,
                planDTO
        );

        robinHoodCycleService.injectWeights(recalculatedWeights);

        // 9. Persiste histórico e evento append-only
        persistCalibration(calibrationId, concursoId, simuladoId, stealRate, weeklyHours, totalStolenHours, doadoras, receptoras, criticalTopicsList, reports, now);

        String resumo = montarResumoPedagogico(totalStolenHours, stealRate, doadoras, receptoras, reports);

        return new SwotCalibrationResult(
                calibrationId,
                concursoId,
                simuladoId,
                now,
                stealRate,
                weeklyHours,
                Math.round(totalStolenHours * 10.0) / 10.0,
                doadoras,
                receptoras,
                reports,
                emergencyBlocks,
                resumo
        );
    }

    /**
     * Retorna a última calibração SWOT registrada para o concurso.
     */
    public Map<String, Object> getLatestSwotCalibration(String concursoId) {
        try {
            String sql = "SELECT * FROM cycle_swot_calibrations " +
                    (concursoId != null && !concursoId.isBlank() ? "WHERE concurso_id = ? " : "") +
                    "ORDER BY created_at DESC LIMIT 1";

            List<Map<String, Object>> rows = concursoId != null && !concursoId.isBlank()
                    ? jdbcTemplate.queryForList(sql, concursoId)
                    : jdbcTemplate.queryForList(sql);

            if (!rows.isEmpty()) {
                Map<String, Object> row = rows.get(0);
                Map<String, Object> res = new LinkedHashMap<>(row);
                if (row.get("detalhes_json") != null) {
                    try {
                        res.put("detalhes", objectMapper.readValue((String) row.get("detalhes_json"), new TypeReference<Map<String, Object>>() {}));
                    } catch (Exception ignored) {}
                }
                return res;
            }
        } catch (Exception e) {
            log.warn("Erro ao buscar última calibração SWOT: {}", e.getMessage());
        }
        return Map.of("status", "Nenhuma calibração SWOT executada ainda para este concurso.");
    }

    private double loadWeeklyHours(String concursoId, Map<String, Object> payload) {
        if (payload != null && payload.containsKey("weeklyHours")) {
            try {
                return Double.parseDouble(String.valueOf(payload.get("weeklyHours")));
            } catch (Exception ignored) {}
        }

        if (concursoId != null && !concursoId.isBlank()) {
            try {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT horas_segunda + horas_terca + horas_quarta + horas_quinta + horas_sexta + horas_sabado + horas_domingo as total_semana " +
                        "FROM student_routines WHERE concurso_id = ?",
                        concursoId
                );
                if (!rows.isEmpty() && rows.get(0).get("total_semana") != null) {
                    Number n = (Number) rows.get(0).get("total_semana");
                    if (n.doubleValue() > 0) return n.doubleValue();
                }
            } catch (Exception ignored) {}
        }
        return 24.0; // Padrão
    }

    private Map<String, Double> loadPesosEdital(String concursoId) {
        Map<String, Double> map = new LinkedHashMap<>();
        if (concursoId != null && !concursoId.isBlank()) {
            try {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT disciplina, AVG(peso) as peso_medio FROM edital_topicos WHERE concurso_id = ? GROUP BY disciplina",
                        concursoId
                );
                for (Map<String, Object> r : rows) {
                    String disc = (String) r.get("disciplina");
                    Number p = (Number) r.getOrDefault("peso_medio", 1.0);
                    map.put(disc, p != null ? p.doubleValue() : 1.0);
                }
            } catch (Exception ignored) {}
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private Map<String, SimuladoDisciplineStats> extractSimuladoStats(
            String concursoId,
            Map<String, Object> payload,
            Map<String, Double> pesosEdital
    ) {
        Map<String, SimuladoDisciplineStats> stats = new LinkedHashMap<>();

        // Opção 1: Payload direto de `desempenhoPorDisciplina`
        if (payload != null && payload.containsKey("desempenhoPorDisciplina")) {
            Object obj = payload.get("desempenhoPorDisciplina");
            if (obj instanceof Map<?, ?> m) {
                for (Map.Entry<?, ?> entry : m.entrySet()) {
                    String disc = String.valueOf(entry.getKey());
                    double peso = pesosEdital.getOrDefault(disc, 1.0);
                    SimuladoDisciplineStats ds = new SimuladoDisciplineStats(disc, peso);

                    if (entry.getValue() instanceof Map<?, ?> dData) {
                        ds.total = extractInt(dData.get("total"), extractInt(dData.get("questoes"), 0));
                        ds.acertos = extractInt(dData.get("acertos"), 0);
                        ds.erros = extractInt(dData.get("erros"), ds.total - ds.acertos);

                        if (dData.containsKey("topicosComErro") && dData.get("topicosComErro") instanceof List<?> l) {
                            for (Object t : l) ds.topicosComErro.add(String.valueOf(t));
                        }
                    }
                    stats.put(disc, ds);
                }
            } else if (obj instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> dData) {
                        String disc = String.valueOf(dData.get("disciplina"));
                        double peso = pesosEdital.getOrDefault(disc, 1.0);
                        SimuladoDisciplineStats ds = new SimuladoDisciplineStats(disc, peso);
                        ds.total = extractInt(dData.get("total"), extractInt(dData.get("questoes"), 0));
                        ds.acertos = extractInt(dData.get("acertos"), 0);
                        ds.erros = extractInt(dData.get("erros"), ds.total - ds.acertos);

                        if (dData.containsKey("topicosComErro") && dData.get("topicosComErro") instanceof List<?> l) {
                            for (Object t : l) ds.topicosComErro.add(String.valueOf(t));
                        }
                        stats.put(disc, ds);
                    }
                }
            }
        }

        // Opção 2: Se não houver no payload, consulta edital e histórico recente de respostas
        if (stats.isEmpty() && !pesosEdital.isEmpty()) {
            for (Map.Entry<String, Double> entry : pesosEdital.entrySet()) {
                String disc = entry.getKey();
                SimuladoDisciplineStats ds = new SimuladoDisciplineStats(disc, entry.getValue());
                try {
                    List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                            "SELECT " +
                            "COUNT(*) as total, " +
                            "SUM(CASE WHEN payload_json LIKE '%\"isCorrect\":true%' THEN 1 ELSE 0 END) as acertos " +
                            "FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE ?",
                            "%" + disc + "%"
                    );
                    if (!rows.isEmpty() && rows.get(0).get("total") != null) {
                        int tot = ((Number) rows.get(0).get("total")).intValue();
                        int ac = rows.get(0).get("acertos") != null ? ((Number) rows.get(0).get("acertos")).intValue() : 0;
                        ds.total = tot;
                        ds.acertos = ac;
                        ds.erros = tot - ac;
                    }
                } catch (Exception ignored) {}
                stats.put(disc, ds);
            }
        }

        return stats;
    }

    private void persistCalibration(
            String id,
            String concursoId,
            String simuladoId,
            double taxaRoubo,
            double weeklyHours,
            double totalRoubado,
            List<String> doadoras,
            List<String> receptoras,
            List<RobinHoodWeightsDTO.CriticalTopicDTO> topicosCriticos,
            List<SwotDisciplineReport> reports,
            String now
    ) {
        try {
            Map<String, Object> detalhes = new LinkedHashMap<>();
            detalhes.put("taxaRouboPct", taxaRoubo);
            detalhes.put("weeklyHours", weeklyHours);
            detalhes.put("totalRoubado", totalRoubado);
            detalhes.put("doadoras", doadoras);
            detalhes.put("receptoras", receptoras);
            detalhes.put("disciplinasRelatorio", reports);

            String detalhesJson = objectMapper.writeValueAsString(detalhes);
            String criticosJson = objectMapper.writeValueAsString(topicosCriticos);

            jdbcTemplate.update("""
                INSERT INTO cycle_swot_calibrations (
                    id, concurso_id, simulado_id, taxa_roubo_pct, horas_semanais_total,
                    horas_roubadas_total, disciplinas_doadoras, disciplinas_receptoras,
                    topicos_criticos_json, detalhes_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, id, concursoId, simuladoId, taxaRoubo, weeklyHours, totalRoubado,
                 String.join(", ", doadoras), String.join(", ", receptoras),
                 criticosJson, detalhesJson, now);

            // Registro Append-Only no Event Store
            jdbcTemplate.update("""
                INSERT INTO event_store (
                    event_id, event_type, aggregate_type, aggregate_id, session_id,
                    occurred_at, recorded_at, event_version, schema_version, payload_json
                ) VALUES (?, 'SWOT_CYCLE_RECALIBRATED', 'CYCLE', ?, ?, ?, ?, 1, 'v1', ?)
            """, "evt_" + UUID.randomUUID().toString().substring(0, 10),
                 concursoId != null ? concursoId : "GLOBAL",
                 simuladoId != null ? simuladoId : "swot_session",
                 now,
                 now,
                 detalhesJson);

        } catch (Exception e) {
            log.error("Erro ao persistir calibração SWOT: {}", e.getMessage());
        }
    }

    private String montarResumoPedagogico(
            double totalRoubado,
            double stealRate,
            List<String> doadoras,
            List<String> receptoras,
            List<SwotDisciplineReport> reports
    ) {
        if (totalRoubado <= 0 || receptoras.isEmpty()) {
            return "Ciclo mantido em equilíbrio padrão. Nenhuma disciplina em zona crítica exigiu intervenção emergencial de horas.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("🔄 Feedback Loop Pós-Simulado Ativado: %.1fh semanais transferidas (alíquota de %.0f%%). ",
                totalRoubado, stealRate));

        if (!doadoras.isEmpty()) {
            sb.append(String.format("Doadoras de Força (>80%%): %s. ", String.join(", ", doadoras)));
        }

        if (!receptoras.isEmpty()) {
            sb.append(String.format("Injeção em Ameaças/Fraquezas: %s. ", String.join(", ", receptoras)));
        }

        return sb.toString();
    }

    private SwotCalibrationResult emptyResult(String id, String concursoId, String simuladoId, String now, double weeklyHours) {
        return new SwotCalibrationResult(
                id,
                concursoId,
                simuladoId,
                now,
                DEFAULT_STEAL_RATE_PERCENT,
                weeklyHours,
                0.0,
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                "Nenhum dado de disciplina encontrado para recalibração SWOT."
        );
    }

    private int extractInt(Object val, int fallback) {
        if (val instanceof Number n) return n.intValue();
        if (val != null) {
            try { return Integer.parseInt(String.valueOf(val).trim()); } catch (Exception ignored) {}
        }
        return fallback;
    }

    private static class SimuladoDisciplineStats {
        final String disciplina;
        final double pesoEdital;
        int total = 0;
        int acertos = 0;
        int erros = 0;
        final List<String> topicosComErro = new ArrayList<>();

        SimuladoDisciplineStats(String disciplina, double pesoEdital) {
            this.disciplina = disciplina;
            this.pesoEdital = pesoEdital > 0 ? pesoEdital : 1.0;
        }

        double getTaxaAcerto() {
            return total > 0 ? (acertos * 100.0) / total : 0.0;
        }
    }
}
