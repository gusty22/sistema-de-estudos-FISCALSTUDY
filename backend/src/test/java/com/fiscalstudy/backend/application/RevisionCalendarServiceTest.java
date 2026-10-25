package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RevisionCalendarServiceTest {

    private JdbcTemplate jdbcTemplate;
    private EventStoreRepository eventStoreRepository;
    private RevisionCalendarService service;

    @BeforeEach
    void setUp() {
        org.springframework.jdbc.datasource.SingleConnectionDataSource dataSource =
                new org.springframework.jdbc.datasource.SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbcTemplate = new JdbcTemplate(dataSource);

        // Cria schema mínimo em memória
        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS revision_calendar (" +
                        "id TEXT PRIMARY KEY, session_id TEXT, concurso_id TEXT, disciplina TEXT NOT NULL, " +
                        "topico TEXT NOT NULL, tipo_revisao TEXT NOT NULL, intervalo_dias INTEGER NOT NULL DEFAULT 1, " +
                        "data_agendada TEXT NOT NULL, origem_evento TEXT NOT NULL, source_id TEXT, " +
                        "status TEXT NOT NULL DEFAULT 'PENDENTE', taxa_acerto_revisao REAL, " +
                        "justificativa_pedagogica TEXT, estagio_intervencao TEXT, prioridade_score REAL DEFAULT 0.5, " +
                        "created_at TEXT DEFAULT CURRENT_TIMESTAMP, concluida_em TEXT);"
        );

        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS event_store (" +
                        "event_id TEXT PRIMARY KEY, event_type TEXT, aggregate_type TEXT, aggregate_id TEXT, " +
                        "session_id TEXT, occurred_at TEXT, recorded_at TEXT, event_version INTEGER, " +
                        "schema_version TEXT, payload_json TEXT);"
        );

        eventStoreRepository = org.mockito.Mockito.mock(EventStoreRepository.class);
        service = new RevisionCalendarService(jdbcTemplate, eventStoreRepository);

        jdbcTemplate.execute("DELETE FROM revision_calendar;");
        jdbcTemplate.execute("DELETE FROM event_store;");
    }

    @Test
    @DisplayName("Deve agendar Intervenção Corretiva com alta prioridade para erro com alta confiança (falsa fluência)")
    void testScheduleAdaptiveRevision_HighConfidenceError() {
        service.scheduleAdaptiveRevision(
                "sess-1", "conc-1", "Direito Tributário", "Imunidades",
                "ERRO_QUESTAO", "q-1",
                false, 3, "E2_CONFUSAO_CONCEITUAL", false, "HESITANTE", 0.6
        );

        Map<String, Object> agenda = service.getAgenda("conc-1");
        assertNotNull(agenda);
        var hoje = (java.util.List<Map<String, Object>>) agenda.get("hoje");
        var proximos = (java.util.List<Map<String, Object>>) agenda.get("proximos7Dias");

        int totalPendentes = hoje.size() + proximos.size();
        assertEquals(1, totalPendentes);

        Map<String, Object> item = !hoje.isEmpty() ? hoje.get(0) : proximos.get(0);
        assertEquals("Direito Tributário", item.get("disciplina"));
        assertEquals("Imunidades", item.get("topico"));
        assertEquals("INTERVENCAO_CORRETIVA", item.get("estagio_intervencao"));
        assertTrue((Double) item.get("prioridade_score") >= 0.90);
        assertNotNull(item.get("justificativa_pedagogica"));
        assertTrue(item.get("justificativa_pedagogica").toString().contains("Falsa fluência"));
    }

    @Test
    @DisplayName("Deve agendar Recuperação Ativa para acerto assinalado por chute/dúvida")
    void testScheduleAdaptiveRevision_EducatedGuess() {
        service.scheduleAdaptiveRevision(
                "sess-2", "conc-1", "Contabilidade Geral", "DRE e Balanço",
                "CHUTE_EDUCADO", "q-2",
                true, 1, null, true, "HESITANTE", 0.8
        );

        Map<String, Object> agenda = service.getAgenda("conc-1");
        var proximos = (java.util.List<Map<String, Object>>) agenda.get("proximos7Dias");
        assertFalse(proximos.isEmpty());

        Map<String, Object> item = proximos.get(0);
        assertEquals("RECUPERACAO_ATIVA", item.get("estagio_intervencao"));
        assertTrue(item.get("justificativa_pedagogica").toString().contains("chute/dúvida"));
    }

    @Test
    @DisplayName("Deve dilatar o intervalo e avançar de estágio quando o estudante acertar a revisão")
    void testCompleteRevision_SuccessProgression() {
        // 1. Agenda intervenção corretiva
        service.scheduleAdaptiveRevision(
                "sess-3", "conc-1", "Auditoria", "Relatórios e Pareceres",
                "ERRO_QUESTAO", "q-3",
                false, 3, "E1_CONTEUDO_NAO_APRENDIDO", false, "LENTO", 0.7
        );

        Map<String, Object> agenda = service.getAgenda("conc-1");
        var list = (java.util.List<Map<String, Object>>) agenda.get("proximos7Dias");
        if (list.isEmpty()) {
            list = (java.util.List<Map<String, Object>>) agenda.get("hoje");
        }
        String revId = (String) list.get(0).get("id");

        // 2. Conclui com 100% de acerto
        boolean completed = service.completeRevision(revId, 1.0, "sess-review");
        assertTrue(completed);

        // 3. Verifica se nova etapa foi gerada (TESTE_TRANSFERENCIA) com intervalo dilatado
        Map<String, Object> agendaApos = service.getAgenda("conc-1");
        var proximosApos = (java.util.List<Map<String, Object>>) agendaApos.get("proximos7Dias");
        assertFalse(proximosApos.isEmpty());

        Map<String, Object> proximaEtapa = proximosApos.get(0);
        assertEquals("TESTE_TRANSFERENCIA", proximaEtapa.get("estagio_intervencao"));
        assertTrue((Integer) proximaEtapa.get("intervalo_dias") >= 2);
    }
 @Test void schedulingUsesConfiguredLocalDayAtUtcMidnight() {
   var instant=java.time.Instant.parse("2026-01-01T00:30:00Z");
   service=new RevisionCalendarService(jdbcTemplate,eventStoreRepository,java.time.Clock.fixed(instant,java.time.ZoneId.of("America/Sao_Paulo")));
   service.scheduleAdaptiveRevision("s","c","Tributário","Imunidade","ERRO_QUESTAO","q",false,5,null,false,null,0.0);
   assertEquals("2026-01-01",jdbcTemplate.queryForObject("SELECT data_agendada FROM revision_calendar",String.class));
   jdbcTemplate.update("DELETE FROM revision_calendar");
   service=new RevisionCalendarService(jdbcTemplate,eventStoreRepository,java.time.Clock.fixed(instant,java.time.ZoneId.of("UTC")));
   service.scheduleAdaptiveRevision("s","c","Tributário","Imunidade","ERRO_QUESTAO","q",false,5,null,false,null,0.0);
   assertEquals("2026-01-02",jdbcTemplate.queryForObject("SELECT data_agendada FROM revision_calendar",String.class));
 }
}
