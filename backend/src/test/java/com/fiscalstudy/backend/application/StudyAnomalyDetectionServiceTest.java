package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class StudyAnomalyDetectionServiceTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private StudyAnomalyDetectionService anomalyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        anomalyService = new StudyAnomalyDetectionService(jdbcTemplate, objectMapper);
    }

    @Test
    @DisplayName("Anomalia 1: Excesso de Teoria Passiva detectado quando PDF/Videoaula > 60% e Questões < 20% na semana")
    void testDetectPassiveTheoryOverload() {
        String concursoId = "concurso_anomalia_teoria_" + UUID.randomUUID().toString().substring(0, 6);
        Instant recent = Instant.now().minus(2, ChronoUnit.DAYS);

        // Sessão de Teoria Passiva: 4 horas de PDF (14400 segundos)
        Map<String, Object> sessaoTeoria = Map.of(
                "sessionId", "sess_teoria_01",
                "concursoId", concursoId,
                "disciplina", "Direito Constitucional",
                "durationSeconds", 14400,
                "paginasLidas", 45,
                "questoesFeitas", 0,
                "activityType", "PDF_LEITURA",
                "modo", "MANUAL"
        );

        // Sessão de Questões: apenas 30 minutos (1800 segundos)
        Map<String, Object> sessaoQuestoes = Map.of(
                "sessionId", "sess_quest_01",
                "concursoId", concursoId,
                "disciplina", "Direito Constitucional",
                "durationSeconds", 1800,
                "paginasLidas", 0,
                "questoesFeitas", 10,
                "activityType", "QUESTOES",
                "modo", "CRONOMETRO"
        );

        try {
            jdbcTemplate.update("""
                INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json)
                VALUES (?, 'STUDY_SESSION_RECORDED', 'STUDY_SESSION', ?, 'sess_teoria_01', ?, ?, 1, 'v1', ?)
            """, UUID.randomUUID().toString(), concursoId, recent.toString(), recent.toString(), objectMapper.writeValueAsString(sessaoTeoria));

            jdbcTemplate.update("""
                INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json)
                VALUES (?, 'STUDY_SESSION_RECORDED', 'STUDY_SESSION', ?, 'sess_quest_01', ?, ?, 1, 'v1', ?)
            """, UUID.randomUUID().toString(), concursoId, recent.toString(), recent.toString(), objectMapper.writeValueAsString(sessaoQuestoes));
        } catch (Exception e) {
            fail("Erro ao inserir eventos de teste: " + e.getMessage());
        }

        StudyAnomalyDetectionService.StudyAnomalyReport report = anomalyService.auditStudyAnomalies(concursoId);

        assertNotNull(report);
        assertTrue(report.totalAnomaliasDetectadas() >= 1);
        assertTrue(report.temAnomaliaCritica());

        var anomaliaTeoria = report.anomalias().stream()
                .filter(a -> a.tipo() == StudyAnomalyDetectionService.AnomalyType.EXCESSO_TEORIA_PASSIVA)
                .findFirst()
                .orElse(null);

        assertNotNull(anomaliaTeoria, "Alerta de Excesso de Teoria Passiva deve ser disparado");
        assertEquals(StudyAnomalyDetectionService.Severity.CRITICA, anomaliaTeoria.severidade());
        assertTrue(anomaliaTeoria.descricao().contains("teoria passiva"));
        assertTrue(report.metricas().shareTeoriaPct() > 60.0);
        assertTrue(report.metricas().shareQuestoesPct() < 20.0);
    }

    @Test
    @DisplayName("Anomalia 2: Estagnação Vertical detectada se o aluno passar mais de 3 semanas (21 dias) preso na mesma matéria")
    void testDetectVerticalStagnation() {
        String concursoId = "concurso_anomalia_estagnacao_" + UUID.randomUUID().toString().substring(0, 6);
        String editalId = "edital_" + UUID.randomUUID().toString().substring(0, 6);
        Instant tenDaysAgo = Instant.now().minus(10, ChronoUnit.DAYS);

        // Edital possui 3 disciplinas cadastradas
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Direito Tributário', 'Tributos', 2.0)", UUID.randomUUID().toString(), concursoId, editalId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Direito Constitucional', 'Direitos Fundamentais', 1.5)", UUID.randomUUID().toString(), concursoId, editalId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Contabilidade Geral', 'Balancete', 2.0)", UUID.randomUUID().toString(), concursoId, editalId);

        // Usuário registrou apenas sessões de Direito Tributário nos últimos 21 dias (monomania)
        Map<String, Object> sessaoMonotematica = Map.of(
                "sessionId", "sess_mono_01",
                "concursoId", concursoId,
                "disciplina", "Direito Tributário",
                "durationSeconds", 7200,
                "paginasLidas", 30,
                "questoesFeitas", 20,
                "activityType", "QUESTOES",
                "modo", "CRONOMETRO"
        );

        try {
            jdbcTemplate.update("""
                INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json)
                VALUES (?, 'STUDY_SESSION_RECORDED', 'STUDY_SESSION', ?, 'sess_mono_01', ?, ?, 1, 'v1', ?)
            """, UUID.randomUUID().toString(), concursoId, tenDaysAgo.toString(), tenDaysAgo.toString(), objectMapper.writeValueAsString(sessaoMonotematica));
        } catch (Exception e) {
            fail("Erro ao inserir evento: " + e.getMessage());
        }

        StudyAnomalyDetectionService.StudyAnomalyReport report = anomalyService.auditStudyAnomalies(concursoId);

        assertNotNull(report);
        var anomaliaEstagnacao = report.anomalias().stream()
                .filter(a -> a.tipo() == StudyAnomalyDetectionService.AnomalyType.ESTAGNACAO_VERTICAL)
                .findFirst()
                .orElse(null);

        assertNotNull(anomaliaEstagnacao, "Alerta de Estagnação Vertical deve ser disparado");
        assertEquals(StudyAnomalyDetectionService.Severity.ALTA, anomaliaEstagnacao.severidade());
        assertTrue(anomaliaEstagnacao.descricao().contains("Direito Tributário"));
        assertEquals("Direito Tributário", report.metricas().disciplinaDominante());
    }

    @Test
    @DisplayName("Anomalia 3: Alerta de Fadiga/Queda de Rendimento após 90 minutos contínuos sem pausa")
    void testDetectFatigueAndPerformanceDrop() {
        // Teste em tempo de execução: sessão de 100 minutos (6000s) com queda de rendimento
        long duracaoSegundos = 6000; // 100 minutos
        double velocidadeInicial = 25.0; // págs/hora
        double velocidadeAtual = 12.0;   // págs/hora (queda de > 50%)
        double acertoInicial = 80.0;     // %
        double acertoSegundaMetade = 40.0; // % (queda de 40%)

        var optAnomalia = anomalyService.evaluateActiveSessionFatigue(
                duracaoSegundos,
                velocidadeInicial,
                velocidadeAtual,
                acertoInicial,
                acertoSegundaMetade
        );

        assertTrue(optAnomalia.isPresent(), "Deve detectar fadiga pós-90min com queda drástica");
        var anomalia = optAnomalia.get();
        assertEquals(StudyAnomalyDetectionService.AnomalyType.FADIGA_QUEDA_RENDIMENTO, anomalia.tipo());
        assertEquals(StudyAnomalyDetectionService.Severity.CRITICA, anomalia.severidade());
        assertTrue(anomalia.descricao().contains("100 minutos"));
        assertTrue(anomalia.acaoPrescritiva().contains("Pausa imediata obrigatória de 15 minutos"));

        // Sessão de apenas 45 minutos (sem fadiga por limite de tempo)
        var optCurta = anomalyService.evaluateActiveSessionFatigue(2700, 25.0, 10.0, 80.0, 40.0);
        assertFalse(optCurta.isPresent(), "Sessões < 90 minutos não devem disparar fadiga contínua");
    }
}
