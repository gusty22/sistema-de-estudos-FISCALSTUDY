package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UngradedRevisionRegressionTest {
    SingleConnectionDataSource ds;
    JdbcTemplate jdbc;
    EventStoreRepository events;
    RevisionCalendarService service;
    @BeforeEach void setup() {
        ds = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbc = new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE revision_calendar(id TEXT,session_id TEXT,concurso_id TEXT,disciplina TEXT,topico TEXT,tipo_revisao TEXT,intervalo_dias INTEGER,data_agendada TEXT,origem_evento TEXT,source_id TEXT,status TEXT,justificativa_pedagogica TEXT,estagio_intervencao TEXT,prioridade_score REAL)");
        events = mock(EventStoreRepository.class);
        service = new RevisionCalendarService(jdbc, events,
            Clock.fixed(Instant.parse("2026-10-25T12:00:00Z"), ZoneId.of("America/Sao_Paulo")));
    }
    @AfterEach void close() { ds.destroy(); }
    void ungraded() {
        service.scheduleAdaptiveRevision("s","c","Tributario","Credito","ANSWER","q",null,5,"E1",true,null,0.9);
    }
    @Test void ungradedAnswerDoesNotCreateRevisionOrEventDespiteStrongSignals() {
        ungraded();
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM revision_calendar",Integer.class));
        verifyNoInteractions(events);
    }
    @Test void ungradedAnswerDoesNotChangeExistingRevisionOrEmitEvent() {
        service.scheduleAdaptiveRevision("s","c","Tributario","Credito","ANSWER","q",true,5,null,false,null,0.2);
        var before = jdbc.queryForList("SELECT * FROM revision_calendar");
        assertEquals(1,before.size());
        clearInvocations(events);
        ungraded();
        assertEquals(before,jdbc.queryForList("SELECT * FROM revision_calendar"));
        verifyNoInteractions(events);
    }
}