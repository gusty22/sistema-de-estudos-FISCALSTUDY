package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CognitiveChatRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CognitiveChatResponseDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MediaRoutingPrescriptionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaRoutingServiceTest {

    private JdbcTemplate jdbcTemplate;
    private EventStoreRepository eventStoreRepository;
    private MediaRoutingService mediaRoutingService;

    @BeforeEach
    void setUp() {
        SingleConnectionDataSource ds = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        ds.setSuppressClose(true);
        jdbcTemplate = new JdbcTemplate(ds);

        // Cria tabelas essenciais para o teste
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS event_store (" +
                "event_id TEXT PRIMARY KEY, event_type TEXT, aggregate_type TEXT, aggregate_id TEXT, " +
                "session_id TEXT, occurred_at TEXT, recorded_at TEXT, event_version INTEGER, schema_version TEXT, payload_json TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS questions (" +
                "id TEXT PRIMARY KEY, disciplina TEXT, assunto TEXT, status TEXT DEFAULT 'VALIDADA', " +
                "justificativa TEXT, texto_apoio TEXT, texto_apoio_titulo TEXT, numero_original INTEGER, arquivo_origem TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS question_attempts (" +
                "id TEXT PRIMARY KEY, aggregate_id TEXT, is_correct INTEGER)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS topic_material_links (" +
                "id TEXT PRIMARY KEY, topico_id TEXT, material_id TEXT, pagina_inicio INTEGER, pagina_fim INTEGER)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS edital_topicos (" +
                "id TEXT PRIMARY KEY, disciplina TEXT, assunto TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS cognitive_lock_records (" +
                "id TEXT PRIMARY KEY, session_id TEXT, concurso_id TEXT, disciplina TEXT, assunto TEXT, " +
                "consecutive_errors INTEGER, chat_dialogue_json TEXT, resolved BOOLEAN, created_at TEXT, resolved_at TEXT)");

        eventStoreRepository = mock(EventStoreRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();

        mediaRoutingService = new MediaRoutingService(jdbcTemplate, eventStoreRepository, objectMapper);
    }

    @Test
    @DisplayName("Regra 1: Para Exatas/Cálculos (Estatística, Contabilidade), prescreve Videoaula 1.5x")
    void testExatasPrescribesVideoLesson() {
        MediaRoutingPrescriptionDTO result = mediaRoutingService.evaluateRouting(
                "conc-1", "Contabilidade Geral", "Balanço Patrimonial", "sess-1"
        );

        assertNotNull(result);
        assertEquals("VIDEOAULA", result.getVeiculo());
        assertEquals("1.5x", result.getVelocidadeSugerida());
        assertTrue(result.getPrescricaoTexto().contains("Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x)"));
        assertTrue(result.getPrescricaoTexto().contains("Esta matéria exige compreensão visual da mecânica."));
        assertFalse(result.isBloqueioCognitivo());
    }

    @Test
    @DisplayName("Regra 1 (Variante): Primeiro Contato em qualquer matéria prescreve Videoaula 1.5x")
    void testPrimeiroContatoPrescribesVideoLesson() {
        MediaRoutingPrescriptionDTO result = mediaRoutingService.evaluateRouting(
                "conc-1", "Direito Constitucional", "Controle de Constitucionalidade Difuso", "sess-1"
        );

        assertNotNull(result);
        assertEquals("VIDEOAULA", result.getVeiculo());
        assertEquals("PRIMEIRO_CONTATO", result.getNivelFamiliaridade());
        assertTrue(result.getPrescricaoTexto().contains("Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x)"));
    }

    @Test
    @DisplayName("Regra 2: Para Leis e Decoreba (Direito Tributário) consolidado, prescreve PDF Direto")
    void testLeisConsolidadasPrescribesPdf() {
        // Simula histórico prévio consolidado (> 5 tentativas com bom acerto)
        for (int i = 0; i < 6; i++) {
            String qId = "q-trib-" + i;
            jdbcTemplate.update("INSERT INTO questions (id, disciplina, assunto) VALUES (?, ?, ?)",
                    qId, "Direito Tributário", "Imunidades Tributárias");
            jdbcTemplate.update("INSERT INTO question_attempts (id, aggregate_id, is_correct) VALUES (?, ?, ?)",
                    UUID.randomUUID().toString(), qId, 1);
        }

        MediaRoutingPrescriptionDTO result = mediaRoutingService.evaluateRouting(
                "conc-1", "Direito Tributário", "Imunidades Tributárias", "sess-1"
        );

        assertNotNull(result);
        assertEquals("PDF_LEITURA", result.getVeiculo());
        assertTrue(result.getPrescricaoTexto().contains("Vá direto para o PDF, página 20. Videoaula aqui é perda de tempo."));
        assertEquals(20, result.getPaginaSugerida());
        assertFalse(result.isBloqueioCognitivo());
    }

    @Test
    @DisplayName("Regra 3: Travamentos / Bloqueio Cognitivo (3 erros seguidos) abre chat embutido de IA com Dono de Supermercado")
    void testCognitiveLockAfterThreeConsecutiveErrors() {
        String assunto = "Substituição Tributária para Frente";

        // Insere 3 questões e 3 respostas consecutivas com erro
        for (int i = 1; i <= 3; i++) {
            String qId = "q-st-" + i;
            jdbcTemplate.update("INSERT INTO questions (id, disciplina, assunto) VALUES (?, ?, ?)",
                    qId, "Direito Tributário", assunto);

            String payload = String.format("{\"questionId\": \"%s\", \"isCorrect\": false}", qId);
            jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                            "VALUES (?, 'ANSWER_SUBMITTED', 'QUESTION', ?, 'sess-lock', '2026-10-14T10:00:00Z', ?, 1, 'v1', ?)",
                    "ev-" + i, qId, "2026-10-14T10:0" + i + ":00Z", payload);
        }

        MediaRoutingPrescriptionDTO result = mediaRoutingService.evaluateRouting(
                "conc-1", "Direito Tributário", assunto, "sess-lock"
        );

        assertNotNull(result);
        assertTrue(result.isBloqueioCognitivo());
        assertEquals("CHAT_IA_DESBLOQUEIO", result.getVeiculo());
        assertEquals(3, result.getErrosConsecutivos());
        assertTrue(result.getPrescricaoTexto().contains("Notei que você errou 3 questões seguidas sobre 'Substituição Tributária para Frente'"));
        assertTrue(result.getPrescricaoTexto().contains("Fale com a IA agora. Peça para ela explicar como se você fosse um dono de supermercado."));
    }

    @Test
    @DisplayName("Chat com IA embutida: Retorna explicação didática com analogia de Dono de Supermercado")
    void testAiChatExplanationForSupermarketOwner() {
        CognitiveChatRequestDTO req = new CognitiveChatRequestDTO(
                "sess-1", "conc-1", "Direito Tributário",
                "Substituição Tributária para Frente",
                "Como funciona a ST para frente?",
                "DONO_SUPERMERCADO"
        );

        CognitiveChatResponseDTO resp = mediaRoutingService.handleAiChat(req);

        assertNotNull(resp);
        assertNotNull(resp.getResponseMessage());
        assertTrue(resp.getResponseMessage().contains("Dono de Supermercado"));
        assertTrue(resp.getResponseMessage().contains("fábrica"));
        assertTrue(resp.getResponseMessage().contains("caixa"));
        assertNotNull(resp.getSugestoesPerguntas());
        assertFalse(resp.getSugestoesPerguntas().isEmpty());
    }

    @Test
    @DisplayName("Desbloqueio de Sessão: Registra evento COGNITIVE_LOCK_RESOLVED no event_store")
    void testUnlockSession() {
        boolean success = mediaRoutingService.unlockSession(
                "sess-1", "conc-1", "Direito Tributário", "Substituição Tributária", "Conceito compreendido com sucesso"
        );

        assertTrue(success);
        verify(eventStoreRepository, times(1)).appendEvent(
                eq("COGNITIVE_LOCK_RESOLVED"),
                eq("COGNITIVE_LOCK"),
                anyString(),
                eq("sess-1"),
                eq(1),
                eq("v1"),
                contains("Conceito compreendido com sucesso")
        );
    }
}
