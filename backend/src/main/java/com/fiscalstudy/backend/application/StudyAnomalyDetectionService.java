package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Detector de Anomalias de Estudo (Auditoria Automática por Logs).
 *
 * Substitui o preenchimento manual da planilha de "Diagnóstico de 8 Áreas" por
 * uma auditoria determinística e contínua dos rastros de execução no event_store:
 *
 * 1. ALERTA DE EXCESSO DE TEORIA PASSIVA:
 *    Se o tempo gasto em PDF/VIDEOAULA passar de 60% na semana e QUESTOES ficar abaixo de 20%.
 *
 * 2. ALERTA DE ESTAGNAÇÃO VERTICAL:
 *    Se o usuário ficar mais de 3 semanas (21 dias) focado na mesma matéria sem girar o ciclo.
 *
 * 3. ALERTA DE FADIGA / QUEDA DE RENDIMENTO:
 *    Se a velocidade de leitura (páginas/hora) ou taxa de acerto cair drasticamente após
 *    90 minutos contínuos de estudo sem pausa.
 */
@Service
public class StudyAnomalyDetectionService {

    private static final Logger log = LoggerFactory.getLogger(StudyAnomalyDetectionService.class);

    public static final double PASSIVE_THEORY_MAX_SHARE_PCT = 60.0;
    public static final double QUESTIONS_MIN_SHARE_PCT = 20.0;
    public static final int VERTICAL_STAGNATION_DAYS_THRESHOLD = 21; // 3 semanas
    public static final double VERTICAL_STAGNATION_CONCENTRATION_PCT = 85.0; // >=85% do tempo em 1 matéria
    public static final long FATIGUE_SESSION_MIN_SECONDS = 5400; // 90 minutos contínuos
    public static final double FATIGUE_SPEED_DROP_PCT = 35.0; // Queda >= 35% na velocidade
    public static final double FATIGUE_ACCURACY_DROP_PCT = 25.0; // Queda >= 25% no acerto

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public StudyAnomalyDetectionService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public enum AnomalyType {
        EXCESSO_TEORIA_PASSIVA,
        ESTAGNACAO_VERTICAL,
        FADIGA_QUEDA_RENDIMENTO
    }

    public enum Severity {
        CRITICA,
        ALTA,
        MODERADA
    }

    public record AnomalyItem(
            AnomalyType tipo,
            String titulo,
            String descricao,
            Severity severidade,
            String acaoPrescritiva,
            Map<String, Object> metricasEvidencia
    ) {}

    public record AuditMetrics(
            double tempoTeoriaHorasSemana,
            double tempoQuestoesHorasSemana,
            double tempoTotalHorasSemana,
            double shareTeoriaPct,
            double shareQuestoesPct,
            int diasNaMateriaAtual,
            String disciplinaDominante,
            double shareDisciplinaDominantePct,
            int sessoesLongasSemPausaCount,
            double piorQuedaRendimentoPct
    ) {}

    public record StudyAnomalyReport(
            String concursoId,
            String dataAuditoria,
            int totalAnomaliasDetectadas,
            boolean temAnomaliaCritica,
            List<AnomalyItem> anomalias,
            AuditMetrics metricas,
            String diagnosticoExecucaoGlobal
    ) {}

    /**
     * Executa a auditoria completa de anomalias de estudo para o concurso.
     */
    public StudyAnomalyReport auditStudyAnomalies(String concursoId) {
        String nowStr = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        Instant now = Instant.now();

        List<AnomalyItem> anomalias = new ArrayList<>();

        // 1. Auditoria da proporção Teoria vs Prática na semana
        var passiveReport = auditPassiveTheoryOverload(concursoId, now);
        if (passiveReport.anomalia() != null) {
            anomalias.add(passiveReport.anomalia());
        }

        // 2. Auditoria de Estagnação Vertical (3 semanas na mesma matéria)
        var stagnationReport = auditVerticalStagnation(concursoId, now);
        if (stagnationReport.anomalia() != null) {
            anomalias.add(stagnationReport.anomalia());
        }

        // 3. Auditoria de Fadiga e Queda de Rendimento (>90min)
        var fatigueReport = auditFatigueAndPerformanceDrop(concursoId, now);
        if (fatigueReport.anomalia() != null) {
            anomalias.add(fatigueReport.anomalia());
        }

        AuditMetrics metrics = new AuditMetrics(
                passiveReport.tempoTeoriaHoras(),
                passiveReport.tempoQuestoesHoras(),
                passiveReport.tempoTotalHoras(),
                passiveReport.shareTeoriaPct(),
                passiveReport.shareQuestoesPct(),
                stagnationReport.diasConcentracao(),
                stagnationReport.disciplinaDominante(),
                stagnationReport.shareDominantePct(),
                fatigueReport.sessoesLongasCount(),
                fatigueReport.maiorQuedaPct()
        );

        boolean temCritica = anomalias.stream().anyMatch(a -> a.severidade() == Severity.CRITICA);

        String diagGlobal = montarDiagnosticoGlobal(anomalias, metrics);

        // Se houver anomalia, registra log imutável no event_store
        if (!anomalias.isEmpty()) {
            recordAnomalyEvent(concursoId, anomalias, nowStr);
        }

        return new StudyAnomalyReport(
                concursoId != null ? concursoId : "GLOBAL",
                nowStr,
                anomalias.size(),
                temCritica,
                anomalias,
                metrics,
                diagGlobal
        );
    }

    /**
     * Verificação pontual e rápida de fadiga em tempo de execução (usada por timers ativos).
     */
    public Optional<AnomalyItem> evaluateActiveSessionFatigue(
            long durationSeconds,
            double velocidadeInicialPagsHora,
            double velocidadeAtualPagsHora,
            double acertoPrimeiraMetadePct,
            double acertoSegundaMetadePct
    ) {
        if (durationSeconds < FATIGUE_SESSION_MIN_SECONDS) {
            return Optional.empty();
        }

        boolean dropVelocidade = false;
        double quedaVelPct = 0.0;
        if (velocidadeInicialPagsHora > 0 && velocidadeAtualPagsHora >= 0) {
            quedaVelPct = ((velocidadeInicialPagsHora - velocidadeAtualPagsHora) / velocidadeInicialPagsHora) * 100.0;
            if (quedaVelPct >= FATIGUE_SPEED_DROP_PCT) {
                dropVelocidade = true;
            }
        }

        boolean dropAcerto = false;
        double quedaAcertoPct = 0.0;
        if (acertoPrimeiraMetadePct > 0) {
            quedaAcertoPct = acertoPrimeiraMetadePct - acertoSegundaMetadePct;
            if (quedaAcertoPct >= FATIGUE_ACCURACY_DROP_PCT || acertoSegundaMetadePct < 45.0) {
                dropAcerto = true;
            }
        }

        if (dropVelocidade || dropAcerto) {
            long minutos = durationSeconds / 60;
            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("duracaoMinutos", minutos);
            ev.put("quedaVelocidadeLeituraPct", Math.round(quedaVelPct * 10.0) / 10.0);
            ev.put("quedaAproveitamentoQuestoesPct", Math.round(quedaAcertoPct * 10.0) / 10.0);
            ev.put("limiteSessaoMinutos", 90);

            String desc = String.format(Locale.ROOT,
                    "Você está há %d minutos em estudo contínuo sem pausas. Queda de rendimento detectada: %s. O cérebro entrou em exaustão cognitiva.",
                    minutos,
                    dropAcerto ? String.format(Locale.ROOT, "acertos caíram de %.1f%% para %.1f%%", acertoPrimeiraMetadePct, acertoSegundaMetadePct)
                               : String.format(Locale.ROOT, "velocidade de leitura caiu %.1f%%", quedaVelPct));

            return Optional.of(new AnomalyItem(
                    AnomalyType.FADIGA_QUEDA_RENDIMENTO,
                    "Fadiga Cognitiva Pós-90min Detectada",
                    desc,
                    Severity.CRITICA,
                    "Pausa imediata obrigatória de 15 minutos: hidrate-se, levante-se e encerre o bloco para restabelecer a plasticidade sináptica.",
                    ev
            ));
        }

        return Optional.empty();
    }

    // =========================================================================
    // SUB-AUDITORIAS DETERMINÍSTICAS
    // =========================================================================

    private record PassiveTheoryAuditResult(
            AnomalyItem anomalia,
            double tempoTeoriaHoras,
            double tempoQuestoesHoras,
            double tempoTotalHoras,
            double shareTeoriaPct,
            double shareQuestoesPct
    ) {}

    private PassiveTheoryAuditResult auditPassiveTheoryOverload(String concursoId, Instant now) {
        Instant sevenDaysAgo = now.minus(Duration.ofDays(7));
        String sevenDaysAgoStr = sevenDaysAgo.toString();

        long teoriaSeconds = 0;
        long questoesSeconds = 0;
        long outrosSeconds = 0;

        // A. Consultar sessões de estudo dos últimos 7 dias
        try {
            String sql = "SELECT payload_json, occurred_at FROM event_store " +
                    "WHERE event_type = 'STUDY_SESSION_RECORDED' AND occurred_at >= ? " +
                    (concursoId != null ? "AND aggregate_id = ? " : "");

            List<Map<String, Object>> rows = concursoId != null
                    ? jdbcTemplate.queryForList(sql, sevenDaysAgoStr, concursoId)
                    : jdbcTemplate.queryForList(sql, sevenDaysAgoStr);

            for (Map<String, Object> r : rows) {
                String payload = (String) r.get("payload_json");
                JsonNode node = objectMapper.readTree(payload);
                long dur = node.path("durationSeconds").asLong(0);
                String actType = node.path("activityType").asText("").toUpperCase();
                String modo = node.path("modo").asText("").toUpperCase();
                int qFeitas = node.path("questoesFeitas").asInt(0);
                int pags = node.path("paginasLidas").asInt(0);

                if (actType.contains("QUEST") || modo.contains("QUEST") || qFeitas > 0) {
                    questoesSeconds += dur;
                } else if (actType.contains("PDF") || actType.contains("VIDEO") || actType.contains("LEITURA") || actType.contains("TEORIA") || pags > 0) {
                    teoriaSeconds += dur;
                } else {
                    outrosSeconds += dur;
                }
            }
        } catch (Exception e) {
            log.warn("Erro ao auditar sessões de teoria: {}", e.getMessage());
        }

        // B. Consultar tempo ativo de resolução de questões no ANSWER_SUBMITTED dos últimos 7 dias
        try {
            String sqlQ = "SELECT payload_json FROM event_store " +
                    "WHERE event_type = 'ANSWER_SUBMITTED' AND occurred_at >= ? " +
                    (concursoId != null ? "AND aggregate_id = ? " : "");

            List<Map<String, Object>> qRows = concursoId != null
                    ? jdbcTemplate.queryForList(sqlQ, sevenDaysAgoStr, concursoId)
                    : jdbcTemplate.queryForList(sqlQ, sevenDaysAgoStr);

            for (Map<String, Object> qr : qRows) {
                String payload = (String) qr.get("payload_json");
                JsonNode node = objectMapper.readTree(payload);
                long activeTimeMs = node.path("activeTimeMs").asLong(0);
                if (activeTimeMs > 0 && activeTimeMs < 7200000) {
                    questoesSeconds += (activeTimeMs / 1000);
                }
            }
        } catch (Exception ignored) {}

        long totalSec = teoriaSeconds + questoesSeconds + outrosSeconds;
        double tTeoriaH = Math.round((teoriaSeconds / 3600.0) * 10.0) / 10.0;
        double tQuestoesH = Math.round((questoesSeconds / 3600.0) * 10.0) / 10.0;
        double tTotalH = Math.round((totalSec / 3600.0) * 10.0) / 10.0;

        double shareTeoria = totalSec > 0 ? (teoriaSeconds * 100.0) / totalSec : 0.0;
        double shareQuestoes = totalSec > 0 ? (questoesSeconds * 100.0) / totalSec : 0.0;

        shareTeoria = Math.round(shareTeoria * 10.0) / 10.0;
        shareQuestoes = Math.round(shareQuestoes * 10.0) / 10.0;

        AnomalyItem anomalia = null;
        // Disparo: Teoria > 60% e Questões < 20% com pelo menos 30 min de estudo acumulado
        if (totalSec >= 1800 && shareTeoria > PASSIVE_THEORY_MAX_SHARE_PCT && shareQuestoes < QUESTIONS_MIN_SHARE_PCT) {
            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("tempoTeoriaHoras", tTeoriaH);
            ev.put("tempoQuestoesHoras", tQuestoesH);
            ev.put("tempoTotalHoras", tTotalH);
            ev.put("shareTeoriaPct", shareTeoria);
            ev.put("shareQuestoesPct", shareQuestoes);
            ev.put("limiteTeoriaMaximoPct", PASSIVE_THEORY_MAX_SHARE_PCT);
            ev.put("limiteQuestoesMinimoPct", QUESTIONS_MIN_SHARE_PCT);

            anomalia = new AnomalyItem(
                    AnomalyType.EXCESSO_TEORIA_PASSIVA,
                    "Alerta de Excesso de Teoria Passiva",
                    String.format(Locale.ROOT,
                            "Você dedicou %.1f%% do seu tempo semanal a teoria passiva (PDF/Videoaula) e apenas %.1f%% a questões práticas. Para concursos fiscais de ponta, o mínimo recomendado de prática ativa é 40%% a 50%%.",
                            shareTeoria, shareQuestoes),
                    Severity.CRITICA,
                    "Inverter proporção imediatamente: congele a leitura de novas páginas de PDF e ative o modo 'Só Questões' com blocos de fixação prática.",
                    ev
            );
        }

        return new PassiveTheoryAuditResult(anomalia, tTeoriaH, tQuestoesH, tTotalH, shareTeoria, shareQuestoes);
    }

    private record StagnationAuditResult(
            AnomalyItem anomalia,
            int diasConcentracao,
            String disciplinaDominante,
            double shareDominantePct
    ) {}

    private StagnationAuditResult auditVerticalStagnation(String concursoId, Instant now) {
        Instant threeWeeksAgo = now.minus(Duration.ofDays(VERTICAL_STAGNATION_DAYS_THRESHOLD));
        String threeWeeksAgoStr = threeWeeksAgo.toString();

        Map<String, Long> timePerDiscipline = new LinkedHashMap<>();
        Map<String, Integer> questionsPerDiscipline = new LinkedHashMap<>();

        try {
            // A. Analisar sessões nos últimos 21 dias
            String sql = "SELECT payload_json, occurred_at FROM event_store " +
                    "WHERE event_type = 'STUDY_SESSION_RECORDED' AND occurred_at >= ? " +
                    (concursoId != null ? "AND aggregate_id = ? " : "");

            List<Map<String, Object>> rows = concursoId != null
                    ? jdbcTemplate.queryForList(sql, threeWeeksAgoStr, concursoId)
                    : jdbcTemplate.queryForList(sql, threeWeeksAgoStr);

            for (Map<String, Object> r : rows) {
                String payload = (String) r.get("payload_json");
                JsonNode node = objectMapper.readTree(payload);
                String disc = node.path("disciplina").asText("Geral").trim();
                long dur = node.path("durationSeconds").asLong(0);
                timePerDiscipline.put(disc, timePerDiscipline.getOrDefault(disc, 0L) + dur);
            }

            // B. Analisar questões respondidas nos últimos 21 dias
            String sqlQ = "SELECT payload_json FROM event_store " +
                    "WHERE event_type = 'ANSWER_SUBMITTED' AND occurred_at >= ? " +
                    (concursoId != null ? "AND aggregate_id = ? " : "");

            List<Map<String, Object>> qRows = concursoId != null
                    ? jdbcTemplate.queryForList(sqlQ, threeWeeksAgoStr, concursoId)
                    : jdbcTemplate.queryForList(sqlQ, threeWeeksAgoStr);

            for (Map<String, Object> qr : qRows) {
                String payload = (String) qr.get("payload_json");
                JsonNode node = objectMapper.readTree(payload);
                String disc = node.path("discipline").asText("").trim();
                if (!disc.isBlank()) {
                    questionsPerDiscipline.put(disc, questionsPerDiscipline.getOrDefault(disc, 0) + 1);
                }
            }
        } catch (Exception e) {
            log.warn("Erro ao auditar estagnação vertical: {}", e.getMessage());
        }

        // Calcular concentração na disciplina dominante
        long totalSecAll = timePerDiscipline.values().stream().mapToLong(Long::longValue).sum();
        int totalQuestionsAll = questionsPerDiscipline.values().stream().mapToInt(Integer::intValue).sum();

        String dominant = null;
        double maxShare = 0.0;

        if (totalSecAll > 0) {
            for (Map.Entry<String, Long> entry : timePerDiscipline.entrySet()) {
                double share = (entry.getValue() * 100.0) / totalSecAll;
                if (share > maxShare) {
                    maxShare = share;
                    dominant = entry.getKey();
                }
            }
        } else if (totalQuestionsAll > 0) {
            for (Map.Entry<String, Integer> entry : questionsPerDiscipline.entrySet()) {
                double share = (entry.getValue() * 100.0) / totalQuestionsAll;
                if (share > maxShare) {
                    maxShare = share;
                    dominant = entry.getKey();
                }
            }
        }

        // Verificar quantas disciplinas constam no edital
        int totalDisciplinasEdital = 0;
        try {
            Integer count = null;
            if (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId)) {
                count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(DISTINCT disciplina) FROM edital_topicos WHERE concurso_id = ?",
                        Integer.class,
                        concursoId.trim()
                );
            }
            if (count == null || count == 0) {
                count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(DISTINCT disciplina) FROM edital_topicos",
                        Integer.class
                );
            }
            totalDisciplinasEdital = count != null ? count : 0;
        } catch (Exception ignored) {}

        AnomalyItem anomalia = null;
        // Se há pelo menos 2 matérias no edital e nos últimos 21 dias o aluno ficou >= 85% do tempo preso na mesma matéria
        if (dominant != null && (totalDisciplinasEdital >= 2 || totalDisciplinasEdital == 0) && maxShare >= VERTICAL_STAGNATION_CONCENTRATION_PCT) {
            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("disciplinaEstagnada", dominant);
            ev.put("concentracaoTempoPct", Math.round(maxShare * 10.0) / 10.0);
            ev.put("diasSemGirarCiclo", VERTICAL_STAGNATION_DAYS_THRESHOLD);
            ev.put("disciplinasNegligenciadasCount", Math.max(1, totalDisciplinasEdital - 1));

            anomalia = new AnomalyItem(
                    AnomalyType.ESTAGNACAO_VERTICAL,
                    "Alerta de Estagnação Vertical: Monomania em " + dominant,
                    String.format(Locale.ROOT,
                            "Você está há mais de 3 semanas (21 dias) focado quase que exclusivamente em %s (%.1f%% da sua atividade). O ciclo de estudos parou e o esquecimento nas demais matérias já começou a degradar suas notas.",
                            dominant, maxShare),
                    Severity.ALTA,
                    String.format(Locale.ROOT,
                            "Rotacionar o ciclo imediatamente: congele %s por 3 dias e force a execução dos blocos de matérias negligenciadas no Ciclo Robin Hood.",
                            dominant),
                    ev
            );
        }

        return new StagnationAuditResult(anomalia, VERTICAL_STAGNATION_DAYS_THRESHOLD, dominant != null ? dominant : "Nenhuma", Math.round(maxShare * 10.0) / 10.0);
    }

    private record FatigueAuditResult(
            AnomalyItem anomalia,
            int sessoesLongasCount,
            double maiorQuedaPct
    ) {}

    private FatigueAuditResult auditFatigueAndPerformanceDrop(String concursoId, Instant now) {
        Instant thirtyDaysAgo = now.minus(Duration.ofDays(30));
        String thirtyDaysAgoStr = thirtyDaysAgo.toString();

        int sessoesLongas = 0;
        double maiorQueda = 0.0;
        String piorSessaoId = null;
        String descDetalhe = null;

        try {
            String sql = "SELECT payload_json, occurred_at FROM event_store " +
                    "WHERE event_type = 'STUDY_SESSION_RECORDED' AND occurred_at >= ? " +
                    (concursoId != null ? "AND aggregate_id = ? " : "");

            List<Map<String, Object>> rows = concursoId != null
                    ? jdbcTemplate.queryForList(sql, thirtyDaysAgoStr, concursoId)
                    : jdbcTemplate.queryForList(sql, thirtyDaysAgoStr);

            for (Map<String, Object> r : rows) {
                String payload = (String) r.get("payload_json");
                JsonNode node = objectMapper.readTree(payload);
                long dur = node.path("durationSeconds").asLong(0);

                if (dur >= FATIGUE_SESSION_MIN_SECONDS) {
                    sessoesLongas++;
                    double velPags = node.path("velocidadePaginasPorHora").asDouble(0.0);
                    double rendimento = node.path("rendimentoPercentual").asDouble(100.0);
                    int qFeitas = node.path("questoesFeitas").asInt(0);

                    // Indicativo de colapso: taxa de acerto em sessão longa despencou para < 50% ou velocidade muito baixa (< 8 pags/h em leitura)
                    if (qFeitas >= 10 && rendimento < 50.0) {
                        double drop = 75.0 - rendimento;
                        if (drop > maiorQueda) {
                            maiorQueda = drop;
                            piorSessaoId = node.path("sessionId").asText("sess_long");
                            descDetalhe = String.format(Locale.ROOT, "sessão de %d minutos com aproveitamento que colapsou para %.1f%%", dur / 60, rendimento);
                        }
                    } else if (dur >= 7200 && velPags > 0 && velPags < 8.0) {
                        double drop = 40.0;
                        if (drop > maiorQueda) {
                            maiorQueda = drop;
                            piorSessaoId = node.path("sessionId").asText("sess_long");
                            descDetalhe = String.format(Locale.ROOT, "sessão de %d minutos com velocidade de leitura arrastada (%.1f págs/h)", dur / 60, velPags);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Erro ao auditar fadiga: {}", e.getMessage());
        }

        AnomalyItem anomalia = null;
        if (sessoesLongas > 0 && maiorQueda > 0) {
            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("sessoesAcimaDe90MinCount", sessoesLongas);
            ev.put("maiorQuedaRendimentoPct", Math.round(maiorQueda * 10.0) / 10.0);
            ev.put("sessionIdAtingida", piorSessaoId);

            anomalia = new AnomalyItem(
                    AnomalyType.FADIGA_QUEDA_RENDIMENTO,
                    "Alerta de Fadiga e Queda de Rendimento (>90min)",
                    String.format(Locale.ROOT,
                            "Detectada execução sem pausa por mais de 90 minutos contínuos (%s). O estudo prolongado em fadiga gera falsa fluência e degradação da consolidação sináptica.",
                            descDetalhe != null ? descDetalhe : "queda drástica pós-90min"),
                    Severity.CRITICA,
                    "Regra inegociável de Pomodoro Expandido: limite qualquer bloco de estudo a no máximo 75 a 90 minutos, com intervalo obrigatório de 10 a 15 minutos para recuperação biológica.",
                    ev
            );
        }

        return new FatigueAuditResult(anomalia, sessoesLongas, Math.round(maiorQueda * 10.0) / 10.0);
    }

    private void recordAnomalyEvent(String concursoId, List<AnomalyItem> anomalias, String now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("totalAnomalias", anomalias.size());
            payload.put("anomalias", anomalias);
            payload.put("concursoId", concursoId);

            String json = objectMapper.writeValueAsString(payload);

            jdbcTemplate.update("""
                INSERT INTO event_store (
                    event_id, event_type, aggregate_type, aggregate_id, session_id,
                    occurred_at, recorded_at, event_version, schema_version, payload_json
                ) VALUES (?, 'STUDY_ANOMALY_DETECTED', 'AUDIT', ?, 'system_audit', ?, ?, 1, 'v1', ?)
            """, "anom_evt_" + UUID.randomUUID().toString().substring(0, 8),
                 concursoId != null ? concursoId : "GLOBAL",
                 now,
                 now,
                 json);
        } catch (Exception ignored) {}
    }

    private String montarDiagnosticoGlobal(List<AnomalyItem> anomalias, AuditMetrics m) {
        if (anomalias.isEmpty()) {
            return "✓ Execução Equilibrada: Nenhuma anomalia de estudo detectada. Proporção de teoria/questões saudável e alternância de disciplinas no ciclo dentro dos padrões de alto rendimento.";
        }
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("⚠️ Auditoria Automática: Detectadas %d anomalia(s) de execução. ", anomalias.size()));
        for (AnomalyItem a : anomalias) {
            sb.append("[").append(a.titulo()).append("] ");
        }
        return sb.toString().trim();
    }
}
