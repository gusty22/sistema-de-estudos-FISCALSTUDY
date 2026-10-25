package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MaestroPlanDTO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MaestroContestScopeRegressionTest {
    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private MaestroOrchestratorService service;
    private EventStoreRepository events;

    @BeforeEach
    void setup() throws Exception {
        dataSource = new SingleConnectionDataSource(DriverManager.getConnection("jdbc:sqlite::memory:"), true);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE concursos(id TEXT PRIMARY KEY, nome TEXT, disponibilidade_json TEXT)");
        jdbc.execute("CREATE TABLE edital_topicos(id TEXT PRIMARY KEY, concurso_id TEXT, disciplina TEXT, assunto TEXT, subassunto TEXT, peso REAL)");
        jdbc.execute("CREATE TABLE revision_calendar(id TEXT PRIMARY KEY, concurso_id TEXT, disciplina TEXT, topico TEXT, tipo_revisao TEXT, prioridade_score REAL, justificativa_pedagogica TEXT, status TEXT, data_agendada TEXT)");
        jdbc.execute("CREATE TABLE anki_flashcards(id TEXT PRIMARY KEY, concurso_id TEXT, sync_status TEXT)");
        jdbc.execute("CREATE TABLE event_store(event_type TEXT, payload_json TEXT)");
        jdbc.execute("CREATE TABLE study_materials(id TEXT PRIMARY KEY, concurso_id TEXT, disciplina TEXT, titulo TEXT, total_paginas INTEGER)");
        jdbc.execute("CREATE TABLE topic_material_links(topico_id TEXT, material_id TEXT, pagina_inicio INTEGER, pagina_fim INTEGER)");
        jdbc.update("INSERT INTO concursos VALUES ('A','Concurso A',NULL),('B','Concurso B',NULL)");
        events = mock(EventStoreRepository.class);
        service = new MaestroOrchestratorService(jdbc, events, new ObjectMapper());
    }

    @AfterEach
    void close() { dataSource.destroy(); }

    private void topic(String contest) {
        jdbc.update("INSERT INTO edital_topicos VALUES (?,?,?,?,?,1)", "topic-" + contest, contest, "Disciplina " + contest, "Assunto " + contest, "Subassunto " + contest);
    }

    private void revision(String contest) {
        jdbc.update("INSERT INTO revision_calendar VALUES (?,?,?,?,?,1,?,'PENDENTE','2000-01-01')", "revision-" + contest, contest, "Revisao " + contest, "Pendente " + contest, "FSRS_ITEM", "Revisao registrada " + contest);
    }

    private void assertEmpty(MaestroPlanDTO plan, String reason) {
        assertTrue(plan.getPassos().isEmpty());
        assertEquals(0, plan.getTotalPassos());
        assertEquals(0, plan.getTempoTotalMinutos());
        assertEquals(120, plan.getTempoDisponivelMinutos());
        assertNull(plan.getDisciplinaPrincipal());
        assertNull(plan.getAssuntoPrincipal());
        assertEquals(reason, plan.getTelemetriaCognitiva().get("statusPlanejador"));
        assertFalse(plan.getStatusMensagem().contains("Atos Administrativos"));
        verifyNoInteractions(events);
    }

    @Test
    void contestWithoutTopicsNeverBorrowsOtherContestOrItsBacklog() {
        topic("B"); revision("B");
        jdbc.update("INSERT INTO anki_flashcards VALUES ('card-B','B','PENDING_ANKI')");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        assertEquals("A", plan.getConcursoId());
        assertEmpty(plan, "SEM_TOPICOS_EDITAL");
    }

    @Test
    void emptyDatabaseDoesNotInventAStudyTopic() {
        assertEmpty(service.generateDailyPlan("A", 120), "SEM_TOPICOS_EDITAL");
    }

    @Test
    void missingSelectionHasExplicitEmptyState() {
        topic("B"); revision("B");
        for (String selection : new String[] {null, "", "  ", "undefined", " NULL "}) {
            MaestroPlanDTO plan = service.generateDailyPlan(selection, 120);
            assertNull(plan.getConcursoId());
            assertEmpty(plan, "SELECIONE_CONCURSO");
        }
    }

    @Test
    void pendingRevisionsStayInsideSelectedContest() {
        topic("A"); topic("B"); revision("A"); revision("B");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        assertTrue(plan.getPassos().stream().anyMatch(s -> "REVISAO_ATIVA".equals(s.getTipo()) && "Revisao A".equals(s.getDisciplina())));
        assertTrue(plan.getPassos().stream().noneMatch(s -> "Disciplina B".equals(s.getDisciplina()) || "Revisao B".equals(s.getDisciplina())));
        assertEquals(1, plan.getTelemetriaCognitiva().get("revisoesInjetadas"));
        assertEquals(120, plan.getTempoTotalMinutos());
    }

    @Test
    void otherContestsRevisionDoesNotBecomePersonalPendingWork() {
        topic("A"); revision("B");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        assertTrue(plan.getPassos().stream().noneMatch(s -> "REVISAO_ATIVA".equals(s.getTipo())));
        assertEquals(0, plan.getTelemetriaCognitiva().get("revisoesInjetadas"));
    }

    @Test
    void ankiPendingExportUsesCanonicalColumnsAndContestScope() {
        topic("A");
        jdbc.update("INSERT INTO anki_flashcards VALUES ('card-A','A','PENDING_ANKI'),('card-B','B','PENDING_ANKI'),('card-synced','A','SYNCED')");
        MaestroPlanDTO plan = service.generateDailyPlan(" A ", 120);
        assertEquals("A", plan.getConcursoId());
        assertEquals(1, plan.getTelemetriaCognitiva().get("cardsAtrasados"));
        var step = plan.getPassos().stream().filter(s -> "ANKI_SRS".equals(s.getTipo())).findFirst().orElseThrow();
        assertTrue(step.getInstrucaoMastigada().contains("1 cards deste concurso"));
        assertTrue(step.getInstrucaoMastigada().contains("não informa revisões vencidas"));
    }

    @Test
    void otherContestsCardsCannotCreateAnkiStep() {
        topic("A");
        jdbc.update("INSERT INTO anki_flashcards VALUES ('card-B','B','PENDING_ANKI')");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        assertEquals(0, plan.getTelemetriaCognitiva().get("cardsAtrasados"));
        assertTrue(plan.getPassos().stream().noneMatch(s -> "ANKI_SRS".equals(s.getTipo())));
    }
    @Test
    void unlinkedGlobalAndOtherContestMaterialsAreNotAssignedByDisciplineName() {
        topic("A");
        jdbc.update("INSERT INTO study_materials VALUES ('global',NULL,'Disciplina A','Material global sem vinculo',50),('other','B','Disciplina A','Material exclusivo B',70)");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        assertTrue(plan.getPassos().stream().noneMatch(s -> s.getInstrucaoMastigada().contains("Material global sem vinculo") || s.getInstrucaoMastigada().contains("Material exclusivo B")));
    }

    @Test
    void explicitlyLinkedSharedMaterialRemainsAvailable() {
        topic("A");
        jdbc.update("INSERT INTO study_materials VALUES ('global',NULL,'Disciplina A','Material compartilhado vinculado',50)");
        jdbc.update("INSERT INTO topic_material_links VALUES ('topic-A','global',8,12)");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        var theory = plan.getPassos().stream().filter(s -> "TEORIA".equals(s.getTipo())).findFirst().orElseThrow();
        assertEquals("Material compartilhado vinculado", theory.getMetadata().get("materialDoc"));
        assertEquals(8, theory.getMetadata().get("paginaInicio"));
        assertEquals(12, theory.getMetadata().get("paginaFim"));
    }

    @Test
    void directlyAssignedContestMaterialRemainsAvailable() {
        topic("A");
        jdbc.update("INSERT INTO study_materials VALUES ('own','A','Disciplina A','Material do concurso A',50)");
        MaestroPlanDTO plan = service.generateDailyPlan("A", 120);
        assertTrue(plan.getPassos().stream().anyMatch(s -> s.getInstrucaoMastigada().contains("Material do concurso A")));
    }
}
