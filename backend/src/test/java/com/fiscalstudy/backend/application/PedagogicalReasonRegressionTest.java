package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.time.*;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class PedagogicalReasonRegressionTest {
    SingleConnectionDataSource ds;
    JdbcTemplate jdbc;
    RevisionCalendarService service;

    @BeforeEach void setup() {
        ds = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbc = new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE revision_calendar(id TEXT,session_id TEXT,concurso_id TEXT,disciplina TEXT,topico TEXT,tipo_revisao TEXT,intervalo_dias INTEGER,data_agendada TEXT,origem_evento TEXT,source_id TEXT,status TEXT,justificativa_pedagogica TEXT,estagio_intervencao TEXT,prioridade_score REAL)");
        service = new RevisionCalendarService(jdbc, mock(EventStoreRepository.class),
            Clock.fixed(Instant.parse("2026-10-25T12:00:00Z"), ZoneId.of("America/Sao_Paulo")));
    }
    @AfterEach void close() { ds.destroy(); }
    Map<String,Object> schedule(boolean correct, Integer confidence, String cause, boolean guessed, double friction) {
        service.scheduleAdaptiveRevision("s", "c", "Tributario", "Credito", "ANSWER", "q", correct, confidence, cause, guessed, null, friction);
        return jdbc.queryForMap("SELECT * FROM revision_calendar");
    }
    void contract(Map<String,Object> row, String stage, String type, int days, double priority) {
        assertEquals(stage, row.get("estagio_intervencao"));
        assertEquals(type, row.get("tipo_revisao"));
        assertEquals(days, ((Number)row.get("intervalo_dias")).intValue());
        assertEquals(priority, ((Number)row.get("prioridade_score")).doubleValue(), 0.00001);
        assertEquals(LocalDate.of(2026,10,25).plusDays(days).toString(), row.get("data_agendada"));
    }
    String reason(Map<String,Object> row) { return (String)row.get("justificativa_pedagogica"); }
    @Test void unexpectedErrorDoesNotDiagnoseItsCause() {
        var row = schedule(false,5,null,false,0.2);
        contract(row,"INTERVENCAO_CORRETIVA","D1_IMEDIATO",1,0.95);
        assertTrue(reason(row).contains("Causa ainda não identificada"));
        assertTrue(reason(row).contains("a confiança não determina sua causa"));
        assertFalse(reason(row).contains("crítico detectado"));
    }
    @Test void declaredCauseRemainsAReport() {
        var row = schedule(false,2,"E1",false,0.2);
        contract(row,"INTERVENCAO_CORRETIVA","D1_IMEDIATO",1,0.95);
        assertTrue(reason(row).contains("Causa relatada pelo estudante: E1"));
    }
    @Test void absentConfidenceIsNotPresentedAsDeclared() {
        var row = schedule(false,null,"E1",false,0.2);
        contract(row,"INTERVENCAO_CORRETIVA","D1_IMEDIATO",1,0.95);
        assertTrue(reason(row).contains("Confiança não informada"));
    }
    @Test void transferRecommendationDoesNotConfirmCausation() {
        var row = schedule(false,2,"E3",false,0.2);
        contract(row,"TESTE_TRANSFERENCIA","D1_IMEDIATO",1,0.85);
        assertTrue(reason(row).contains("não confirma um diagnóstico causal"));
    }
    @Test void ordinaryErrorDoesNotProveForgetting() {
        var row = schedule(false,2,null,false,0.2);
        contract(row,"INTERVENCAO_CORRETIVA","D1_IMEDIATO",1,0.80);
        assertTrue(reason(row).contains("não comprova esquecimento"));
    }
    @Test void guessedSuccessDoesNotPromiseConsolidation() {
        var row = schedule(true,1,null,true,0.2);
        contract(row,"RECUPERACAO_ATIVA","D7_CONSOLIDACAO",2,0.75);
        assertTrue(reason(row).contains("não demonstra retenção duradoura"));
    }
    @Test void frictionIsAnIndicatorRatherThanMeasuredCognitiveEffort() {
        var row = schedule(true,3,null,false,0.5);
        contract(row,"RECUPERACAO_ATIVA","D7_CONSOLIDACAO",3,0.60);
        assertTrue(reason(row).contains("não identifica esforço cognitivo"));
    }
    @Test void singleSuccessDoesNotEstablishMastery() {
        var row = schedule(true,2,null,false,0.2);
        contract(row,"MANUTENCAO_PREVENTIVA","D15_APROFUNDAMENTO",7,0.35);
        assertTrue(reason(row).contains("não demonstra domínio conceitual"));
        assertFalse(reason(row).contains("Domínio fluente demonstrado"));
    }
}