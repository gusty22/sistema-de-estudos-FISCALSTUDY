package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.FiscalStudyApplication;
import com.fiscalstudy.backend.application.knowledge.TopicKnowledgeAggregatorService;
import com.fiscalstudy.backend.domain.EventRecord;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeProjection;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Suíte de testes rigorosa de Segurança por Concepção (Security by Design) e Integridade Transacional
 * para o EPIC 02 — Modelo Individual de Conhecimento.
 */
@SpringBootTest(classes = FiscalStudyApplication.class)
@AutoConfigureMockMvc
public class TopicKnowledgeSecurityAndIntegrityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TopicKnowledgeRepository topicKnowledgeRepository;

    @Autowired
    private TopicKnowledgeAggregatorService aggregatorService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Segurança 1: Acesso a tópico inexistente deve retornar HTTP 404 limpo sem vazar detalhes internos")
    void testGetNonexistentTopicReturnsClean404() throws Exception {
        mockMvc.perform(get("/api/v1/knowledge/topics/topico_inexistente_nao_cadastrado_999")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(content().string(isEmptyOrNullString()));
    }

    @Test
    @DisplayName("Segurança 2: Validação de entradas — Parâmetros excessivos devem ser rejeitados com HTTP 400 Bad Request")
    void testOversizedFiltersRejectedWithBadRequest() throws Exception {
        String oversizedDiscipline = "A".repeat(250);
        mockMvc.perform(get("/api/v1/knowledge/topics")
                        .param("discipline", oversizedDiscipline)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("BAD_REQUEST")))
                .andExpect(jsonPath("$.message", containsString("excede o tamanho máximo")))
                .andExpect(jsonPath("$.executionId", notNullValue()));

        String oversizedStatus = "B".repeat(60);
        mockMvc.perform(get("/api/v1/knowledge/topics")
                        .param("status", oversizedStatus)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("BAD_REQUEST")));
    }

    @Test
    @DisplayName("Segurança 3: Proteção contra chamadas não-loopback no rebuild (HTTP 403 Forbidden)")
    void testNonLoopbackRebuildAccessDenied() throws Exception {
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .with(request -> {
                            request.setRemoteAddr("192.168.1.150"); // IP não-loopback
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("restricted to local loopback")));
    }

    @Test
    @DisplayName("Segurança 4: Proteção contra concorrência abusiva no rebuild (HTTP 409 Conflict se em andamento)")
    void testConcurrentRebuildReturns409Conflict() throws Exception {
        // Simular trava de rebuild em andamento
        java.lang.reflect.Field field = TopicKnowledgeAggregatorService.class.getDeclaredField("isRebuilding");
        field.setAccessible(true);
        java.util.concurrent.atomic.AtomicBoolean flag = (java.util.concurrent.atomic.AtomicBoolean) field.get(aggregatorService);

        flag.set(true);
        try {
            mockMvc.perform(post("/api/v1/knowledge/rebuild")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status", is("IN_PROGRESS")))
                    .andExpect(jsonPath("$.error", containsString("já em andamento")));
        } finally {
            flag.set(false);
        }
    }

    @Test
    @DisplayName("Integridade 5: Deduplicação de eventos idênticos no event_store durante o rebuild")
    void testRebuildDeduplicatesEvents() {
        EventStoreRepository mockStore = mock(EventStoreRepository.class);
        TopicKnowledgeRepository mockRepo = mock(TopicKnowledgeRepository.class);

        TopicKnowledgeAggregatorService service = new TopicKnowledgeAggregatorService(
                mockStore, mockRepo, jdbcTemplate
        );

        // Dois eventos com o mesmo eventId "dup-1"
        List<EventRecord> events = List.of(
                new EventRecord("dup-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":30000,\"origin\":\"REAL_STUDY\"}"),
                new EventRecord("dup-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":30000,\"origin\":\"REAL_STUDY\"}")
        );

        when(mockStore.getAllEvents("ANSWER_SUBMITTED")).thenReturn(events);

        TopicKnowledgeAggregatorService.RebuildResult result = service.rebuildAll();

        assertNotNull(result);
        assertEquals(1, result.totalAttempts(), "Evento duplicado deve ser computado apenas uma vez.");
    }

    @Test
    @DisplayName("Integridade 6: Descarte seguro de eventos sintéticos (AUTOMATED_TEST, BENCHMARK)")
    void testRebuildDiscardsSyntheticEvents() {
        EventStoreRepository mockStore = mock(EventStoreRepository.class);
        TopicKnowledgeRepository mockRepo = mock(TopicKnowledgeRepository.class);

        TopicKnowledgeAggregatorService service = new TopicKnowledgeAggregatorService(
                mockStore, mockRepo, jdbcTemplate
        );

        List<EventRecord> events = List.of(
                new EventRecord("real-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":3,\"activeTimeMs\":20000,\"origin\":\"REAL_STUDY\"}"),
                new EventRecord("synth-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":false,\"confidenceLevel\":1,\"activeTimeMs\":5000,\"origin\":\"AUTOMATED_TEST\"}"),
                new EventRecord("synth-2", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":5,\"activeTimeMs\":1000,\"origin\":\"SYNTHETIC_BENCHMARK\"}")
        );

        when(mockStore.getAllEvents("ANSWER_SUBMITTED")).thenReturn(events);

        TopicKnowledgeAggregatorService.RebuildResult result = service.rebuildAll();

        assertNotNull(result);
        assertEquals(1, result.totalAttempts(), "Apenas a tentativa com origin REAL_STUDY deve ser agregada.");
    }

    @Test
    @DisplayName("Integridade 7: Associação precisa de anotações (ATTEMPT_ANNOTATED) à tentativa correspondente")
    void testRebuildAssociatesAttemptAnnotationCorrectly() {
        // Criar projeção direta com anotação mapeada
        TopicKnowledgeAggregatorService.ParsedAttempt attempt = new TopicKnowledgeAggregatorService.ParsedAttempt(
                "attempt:att-42", "q-10", "DIREITO_TRIBUTARIO", "top_trib_1",
                false, 4, 35000, 0, "PEGADINHA_BANCA", "REGULAR", true, false, Instant.now()
        );

        TopicKnowledgeProjection proj = aggregatorService.buildProjection(
                "top_trib_1", "DIREITO_TRIBUTARIO", "Princípio da Legalidade",
                List.of(attempt), null
        );

        assertNotNull(proj);
        assertEquals(1, proj.getErrorAttempts());
        assertTrue(proj.getErrorCausesDistributionJson().contains("\"PEGADINHA_BANCA\":1"),
                "A causa do erro deve refletir a anotação confirmada.");
    }

    @Test
    @DisplayName("Integridade 8: Cenário com zero tentativas deve retornar SEM_EVIDENCIAS sem erros")
    void testZeroAttemptsScenarioIsConsistent() throws Exception {
        TopicKnowledgeProjection zeroProj = aggregatorService.buildProjection(
                "top_zero", "DIREITO_CONSTITUCIONAL", "Controle de Constitucionalidade",
                Collections.emptyList(), null
        );

        assertEquals("SEM_EVIDENCIAS", zeroProj.getEvidenceStatus());
        assertEquals("SEM_EVIDENCIAS", zeroProj.getAccuracyDenominatorText());
        assertEquals(0, zeroProj.getTotalAttempts());
        assertEquals(0, zeroProj.getCorrectAttempts());
        assertEquals(0.0, zeroProj.getAccuracyRate());
        assertNull(zeroProj.getAvgConfidenceOrdinal());
        assertTrue(zeroProj.getEpistemicLimitationsJson().contains("Ausência total de tentativas"));
    }

    @Test
    @DisplayName("Segurança 9: Mensagens de erro interno não devem expor stack traces, caminhos locais ou SQLite")
    void testInternalErrorDoesNotLeakPathsOrStackTraces() throws Exception {
        // Forçar erro simulando exceção interna no repositório
        TopicKnowledgeRepository mockRepo = mock(TopicKnowledgeRepository.class);
        when(mockRepo.findAll()).thenThrow(new RuntimeException("SQLITE_IOERR: disk I/O error at c:\\Users\\secret\\db.sqlite"));

        TopicKnowledgeController controller = new TopicKnowledgeController(mockRepo, aggregatorService);
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        try {
            controller.listTopics(null, null);
            fail("Deveria ter lançado exceção");
        } catch (RuntimeException ex) {
            var response = handler.handleGeneralException(ex);
            assertEquals(500, response.getStatusCode().value());
            assertNotNull(response.getBody());
            assertEquals("INTERNAL_SERVER_ERROR", response.getBody().getError());
            assertFalse(response.getBody().getMessage().contains("SQLITE"), "Não deve vazar SQLITE");
            assertFalse(response.getBody().getMessage().contains("Users"), "Não deve vazar caminhos de arquivo");
            assertFalse(response.getBody().getMessage().contains("secret"), "Não deve vazar diretórios locais");
            assertNotNull(response.getBody().getExecutionId());
        }
    }

    @Test
    @DisplayName("Integridade 10: Reconstrução transacional — Falha no replaceAll deve dar rollback e manter projeção anterior intacta")
    void testReplaceAllRollbackPreservesExistingProjectionsOnFailure() {
        // 1. Criar e salvar uma projeção prévia conhecida
        TopicKnowledgeProjection initialProj = new TopicKnowledgeProjection("top-persistente-transacional", "DIR_TRIBUTARIO", "Imunidades Constitucionais");
        initialProj.setTotalAttempts(8);
        initialProj.setCorrectAttempts(7);
        initialProj.setErrorAttempts(1);
        initialProj.setEvidenceStatus("PRELIMINAR");
        initialProj.setAccuracyDenominatorText("7/8");
        topicKnowledgeRepository.saveOrUpdate(initialProj);

        assertTrue(topicKnowledgeRepository.findByTopicId("top-persistente-transacional").isPresent(),
                "A projeção inicial deve existir antes da tentativa de substituição.");

        // 2. Preparar batch com uma projeção válida e uma que viola chave primária (duplicada) no SQLite
        TopicKnowledgeProjection validProj1 = new TopicKnowledgeProjection("top-chave-duplicada", "DIR_CONSTITUCIONAL", "Direitos Fundamentais");
        TopicKnowledgeProjection validProj2 = new TopicKnowledgeProjection("top-chave-duplicada", "DIR_ADMINISTRATIVO", "Atos Administrativos");

        // 3. Executar replaceAll esperando falha de persistência no SQLite
        assertThrows(Exception.class, () -> {
            topicKnowledgeRepository.replaceAll(List.of(validProj1, validProj2));
        });

        // 4. Confirmar que a projeção anterior permanece 100% preservada (rollback efetivo do DELETE)
        Optional<TopicKnowledgeProjection> preservedOpt = topicKnowledgeRepository.findByTopicId("top-persistente-transacional");
        assertTrue(preservedOpt.isPresent(), "Rollback transacional DEVE restaurar a projeção anterior intacta.");
        assertEquals("top-persistente-transacional", preservedOpt.get().getTopicId());
        assertEquals(8, preservedOpt.get().getTotalAttempts());
        assertEquals("7/8", preservedOpt.get().getAccuracyDenominatorText());

        // 5. Confirmar que as projeções do batch com falha NÃO foram commitadas
        Optional<TopicKnowledgeProjection> notInsertedOpt = topicKnowledgeRepository.findByTopicId("top-chave-duplicada");
        assertTrue(notInsertedOpt.isEmpty(), "Inserções parciais de batch com falha NÃO devem ser persistidas.");
    }

    @Test
    @DisplayName("Segurança 11: Proteção de endpoint local — Rebuild bloqueia Origin externa, Sec-Fetch-Site cross-site e Referer malicioso")
    void testExternalWebPageAccessToRebuildIsStrictlyForbidden() throws Exception {
        // 1. Origin externa
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .header("Origin", "https://malicious-external-site.com")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("Origin not allowed")));

        // 2. Sec-Fetch-Site cross-site (disparado por páginas externas abertas no navegador)
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .header("Origin", "http://localhost:5173")
                        .header("Sec-Fetch-Site", "cross-site")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("Cross-site request forbidden")));

        // 3. Referer malicioso externo
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .header("Referer", "https://malicious-external-site.com/exploit.html")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("Referer origin not allowed")));
    }

    @Test
    @DisplayName("Integridade 12: Legitimidade — Simulado real (REAL_STUDY) é preservado; sessões de teste e sintéticas são descartadas")
    void testRealStudySimuladoPreservedAndSyntheticSessionsDiscarded() {
        EventStoreRepository mockStore = mock(EventStoreRepository.class);
        TopicKnowledgeRepository mockRepo = mock(TopicKnowledgeRepository.class);

        TopicKnowledgeAggregatorService service = new TopicKnowledgeAggregatorService(
                mockStore, mockRepo, jdbcTemplate
        );

        List<EventRecord> events = List.of(
                // 1. Simulado real feito pelo estudante (origin = REAL_STUDY, interventionType = SIMULADO)
                new EventRecord("real-sim-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "sess-simulado-oficial-1",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":45000,\"origin\":\"REAL_STUDY\",\"interventionType\":\"SIMULADO\"}"),
                // 2. Sessão sintética de teste com prefixo test- (mesmo tentando forjar origin REAL_STUDY)
                new EventRecord("fake-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "test-session-mock-42",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":false,\"confidenceLevel\":1,\"activeTimeMs\":1000,\"origin\":\"REAL_STUDY\"}"),
                // 3. Evento sem declaração de origin
                new EventRecord("no-origin-1", "ANSWER_SUBMITTED", "QUESTION", "q-1", "s-legacy",
                        Instant.now().toString(), Instant.now().toString(), 1, "v1",
                        "{\"questionId\":\"q-1\",\"isCorrect\":true,\"confidenceLevel\":5,\"activeTimeMs\":15000}")
        );

        when(mockStore.getAllEvents("ANSWER_SUBMITTED")).thenReturn(events);

        TopicKnowledgeAggregatorService.RebuildResult result = service.rebuildAll();

        assertNotNull(result);
        assertEquals(1, result.totalAttempts(),
                "Apenas o simulado real legítimo deve ser computado; sessões com prefixo test- ou sem origin devem ser descartadas.");
    }
}
