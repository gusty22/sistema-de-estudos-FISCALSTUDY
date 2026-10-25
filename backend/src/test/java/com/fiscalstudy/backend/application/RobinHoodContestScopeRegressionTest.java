package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.cycle.RobinHoodCycleBlock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RobinHoodContestScopeRegressionTest {
    SingleConnectionDataSource dataSource;
    JdbcTemplate jdbc;
    TimeMetricService timeMetrics;
    RobinHoodCycleService service;

    @BeforeEach void setup() {
        dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE edital_topicos(concurso_id TEXT, disciplina TEXT, peso REAL)");
        jdbc.execute("CREATE TABLE student_routines(concurso_id TEXT, horas_segunda REAL, horas_terca REAL, horas_quarta REAL, horas_quinta REAL, horas_sexta REAL, horas_sabado REAL, horas_domingo REAL)");
        jdbc.execute("CREATE TABLE event_store(event_type TEXT, aggregate_id TEXT, payload_json TEXT)");
        timeMetrics = mock(TimeMetricService.class);
        when(timeMetrics.getTimeMetricsSummary(any())).thenReturn(Map.of());
        service = new RobinHoodCycleService(timeMetrics, jdbc, new ObjectMapper());
        jdbc.update("INSERT INTO edital_topicos VALUES(?,?,?)", "other", "Contabilidade", 2.0);
    }
    @AfterEach void close() { dataSource.destroy(); }

    @Test void selectedContestWithoutTopicsDoesNotBorrowAnotherContest() {
        var result = service.getOrGenerateCycle("selected", 12.0, 60);
        assertEquals("selected", result.getConcursoId());
        assertTrue(result.getBlocos().isEmpty());
        assertTrue(result.getResumoRobinHood().get("status").contains("Nenhuma disciplina"));
        verify(timeMetrics, never()).getTimeMetricsSummary(any());
    }

    @Test void existingContestIncludesOnlyItsOwnDisciplines() {
        jdbc.update("INSERT INTO edital_topicos VALUES(?,?,?)", "selected", "Tributario", 1.0);
        assertEquals(Set.of("Tributario"), disciplines("selected"));
    }

    @Test void trimmedConcreteContestKeepsItsScope() {
        jdbc.update("INSERT INTO edital_topicos VALUES(?,?,?)", "selected", "Tributario", 1.0);
        assertEquals(Set.of("Tributario"), disciplines(" selected "));
        assertTrue(service.getOrGenerateCycle(" missing ", 12.0, 60).getBlocos().isEmpty());
    }

    @Test void existingGlobalModeAndLegacySentinelsRemainCompatible() {
        jdbc.update("INSERT INTO edital_topicos VALUES(?,?,?)", "selected", "Tributario", 1.0);
        for (String global : Arrays.asList(null, "", "  ", "undefined", "NULL")) {
            assertEquals(Set.of("Tributario", "Contabilidade"), disciplines(global));
        }
    }

    @Test void completedCyclesAreCountedForQuotedContestIdentifiers() {
        String contest = "d'agua";
        jdbc.update("INSERT INTO edital_topicos VALUES(?,?,?)", contest, "Tributario", 1.0);
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "CYCLE_COMPLETED", contest, "{}");
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "CYCLE_COMPLETED", "other", "{}");
        assertEquals(1, service.getOrGenerateCycle(contest, 12.0, 60).getCiclosCompletados());
    }

    @Test void contestIdentifierCannotChangeCompletedCyclesPredicate() {
        String contest = "x' OR 1=1 --";
        jdbc.update("INSERT INTO edital_topicos VALUES(?,?,?)", contest, "Tributario", 1.0);
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "CYCLE_COMPLETED", contest, "{}");
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "CYCLE_COMPLETED", "other", "{}");
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "ANSWER_SUBMITTED", contest, "{}");
        assertEquals(1, service.getOrGenerateCycle(contest, 12.0, 60).getCiclosCompletados());
    }

    @Test void completedCyclesGlobalModeStillCountsAllContests() {
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "CYCLE_COMPLETED", "selected", "{}");
        jdbc.update("INSERT INTO event_store VALUES(?,?,?)", "CYCLE_COMPLETED", "other", "{}");
        assertEquals(2, service.getOrGenerateCycle(null, 12.0, 60).getCiclosCompletados());
    }

    private Set<String> disciplines(String contest) {
        return service.getOrGenerateCycle(contest, 12.0, 60).getBlocos().stream()
            .filter(block -> block.getType() == RobinHoodCycleBlock.BlockType.ESTUDO_REGULAR)
            .map(RobinHoodCycleBlock::getDisciplina).collect(Collectors.toSet());
    }
}
