package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiConnectStatusDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiFlashcardDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AnkiIntegrationServiceTest {

    private JdbcTemplate jdbcTemplate;
    private EventStoreRepository eventStoreRepository;
    private ObjectMapper objectMapper;
    private AnkiIntegrationService ankiService;

    @BeforeEach
    void setUp() {
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource();
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setUrl("jdbc:sqlite::memory:");
        dataSource.setSuppressClose(true);

        jdbcTemplate = new JdbcTemplate(dataSource);

        // Cria tabelas necessárias em memória
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS anki_flashcards (" +
                "id TEXT PRIMARY KEY, session_id TEXT, concurso_id TEXT, disciplina TEXT NOT NULL, " +
                "assunto TEXT NOT NULL, card_type TEXT NOT NULL, front_or_text TEXT NOT NULL, " +
                "back_or_extra TEXT, deck_name TEXT NOT NULL, anki_note_id INTEGER, " +
                "sync_status TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, " +
                "created_at TEXT, synced_at TEXT, error_message TEXT)");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS edital_topicos (" +
                "id TEXT PRIMARY KEY, edital_id TEXT, concurso_id TEXT, disciplina TEXT, " +
                "assunto TEXT, subassunto TEXT, peso REAL, questoes_previstas INTEGER)");

        eventStoreRepository = mock(EventStoreRepository.class);
        objectMapper = new ObjectMapper();

        ankiService = new AnkiIntegrationService(jdbcTemplate, eventStoreRepository, objectMapper);
    }

    @Test
    @DisplayName("checkConnection deve retornar status offline gracioso quando AnkiConnect não estiver rodando")
    void testCheckConnectionGracefulWhenOffline() {
        AnkiConnectStatusDTO status = ankiService.checkConnection();
        assertNotNull(status);
        assertFalse(status.isConnected());
        assertEquals("http://127.0.0.1:8765", status.getEndpoint());
        assertTrue(status.getMessage().contains("Anki não detectado"));
    }

    @Test
    @DisplayName("generateFromQuestionError deve sintetizar flashcard no SQLite e registrar no event_store")
    void testGenerateFromQuestionError() {
        Question q = new Question(
                "q-101",
                "O princípio da autoexecutoriedade permite a execução direta do ato administrativo sem ordem judicial prévia.",
                List.of("A) Correto", "B) Incorreto"),
                "A",
                "Direito Administrativo",
                "Atos Administrativos",
                "FGV",
                2024
        );

        AnkiFlashcardDTO card = ankiService.generateFromQuestionError(q, "B", "Erro de conceito", "session-test");

        assertNotNull(card);
        assertEquals("Direito Administrativo", card.getDisciplina());
        assertEquals("Atos Administrativos", card.getAssunto());
        assertEquals("FiscalStudy::Direito Administrativo", card.getDeckName());
        assertNotNull(card.getFrontOrText());

        // Verifica que o evento foi registrado no event_store
        verify(eventStoreRepository, atLeastOnce()).appendEvent(
                anyString(), eq("FLASHCARD"), anyString(), eq("session-test"), anyInt(), eq("v1"), anyString()
        );

        // Verifica persistência na tabela anki_flashcards
        List<AnkiFlashcardDTO> recent = ankiService.getRecentFlashcards(10);
        assertFalse(recent.isEmpty());
        assertEquals(card.getId(), recent.get(0).getId());
    }

    @Test
    @DisplayName("generateSessionBatch15 deve gerar exatamente 15 flashcards das regras mais importantes da sessão")
    void testGenerateSessionBatch15() {
        List<AnkiFlashcardDTO> batch = ankiService.generateSessionBatch15("concurso-araguari", "session-end-01");

        assertNotNull(batch);
        assertEquals(15, batch.size(), "O lote de fechamento de sessão deve conter exatamente 15 flashcards");

        long clozeCount = batch.stream().filter(c -> "CLOZE".equalsIgnoreCase(c.getCardType())).count();
        long basicCount = batch.stream().filter(c -> "BASIC".equalsIgnoreCase(c.getCardType())).count();

        assertTrue(clozeCount > 0, "Deve conter cards no formato Omissão de Palavras (Cloze)");
        assertTrue(basicCount > 0, "Deve conter cards no formato Frente e Verso (Basic)");

        // Todos os 15 cards devem estar persistidos na fila
        List<AnkiFlashcardDTO> allInDb = ankiService.getRecentFlashcards(50);
        assertEquals(15, allInDb.size());
    }

    @Test
    @DisplayName("exportToCsv deve gerar formato tab-delimited compatível com importação do Anki")
    void testExportToCsv() {
        ankiService.saveAndPushCard(
                "sess-1", "conc-1", "Direito Tributário", "Imunidades",
                "CLOZE", "A imunidade recíproca é {{c1::extensiva}} às autarquias e fundações.",
                "Art. 150, VI, a e § 2º da CF/88", "PDF_PARAGRAPH", null
        );

        String csv = ankiService.exportToCsv(null);
        assertNotNull(csv);
        assertTrue(csv.contains("#separator:Tab"));
        assertTrue(csv.contains("imunidade recíproca"));
        assertTrue(csv.contains("direito_tributario"));
    }
}
