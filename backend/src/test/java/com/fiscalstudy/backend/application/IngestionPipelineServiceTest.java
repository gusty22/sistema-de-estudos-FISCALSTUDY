package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.infrastructure.in.web.dto.ImportSimulationDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionUpdateRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingQuestionDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingSessionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class IngestionPipelineServiceTest {

    private JdbcTemplate jdbcTemplate;
    private IngestionPipelineService service;

    @BeforeEach
    public void setup() {
        jdbcTemplate = mock(JdbcTemplate.class);
        service = new IngestionPipelineService(jdbcTemplate);
    }

    @Test
    public void testCreateSessionGeneratesValidSession() {
        StagingSessionDTO session = service.createSession(Map.of("banca", "IBGP", "ano", 2023));
        assertNotNull(session.getSessionId());
        assertEquals("PENDING", session.getStatus());
        assertEquals(2023, session.getMetadata().get("ano"));
    }

    @Test
    public void testUploadFileValidatesExtensionAndRejectsInvalid() {
        StagingSessionDTO session = service.createSession(Map.of());

        MockMultipartFile exeFile = new MockMultipartFile("file", "malicious.exe", "application/octet-stream", "dummy".getBytes());
        assertThrows(IllegalArgumentException.class, () -> service.uploadFile(session.getSessionId(), exeFile, "PROVA"));

        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);
        assertThrows(IllegalArgumentException.class, () -> service.uploadFile(session.getSessionId(), emptyFile, "PROVA"));
    }

    @Test
    public void testUploadValidPdfSucceeds() throws Exception {
        StagingSessionDTO session = service.createSession(Map.of());
        MockMultipartFile pdfFile = new MockMultipartFile("file", "prova_concurso.pdf", "application/pdf", "dummy pdf content".getBytes());

        StagingSessionDTO.StagingDocumentDTO doc = service.uploadFile(session.getSessionId(), pdfFile, "PROVA");
        assertNotNull(doc.getId());
        assertEquals("prova_concurso.pdf", doc.getOriginalFilename());
        assertEquals("PROVA", doc.getRole());
        assertEquals("PDF", doc.getFormat());
    }

    @Test
    public void testHumanReviewUpdatesQuestionAndPreservesState() {
        StagingSessionDTO session = service.createSession(Map.of());
        
        // Simular questão carregada
        StagingQuestionDTO q = new StagingQuestionDTO();
        q.setId("q15");
        q.setNumeroOriginal(15);
        q.setStatement("Enunciado inicial com anomalia");
        q.setOptions(List.of("A) 256", "B) 280", "C) 336", "D) 560"));
        q.setStatus("NEEDS_REVIEW");
        
        service.getSessionQuestions(session.getSessionId()); // inicializa
        // Adiciona questão na sessão via reflexão ou teste
        List<StagingQuestionDTO> questions = service.getSessionQuestions(session.getSessionId());
        questions.add(q);

        QuestionUpdateRequestDTO update = new QuestionUpdateRequestDTO();
        update.setStatement("Enunciado revisado e corrigido");
        update.setStatus("SOURCE_VERIFIED");
        update.setReviewNotes("Verificado contra PDF original da página 6");

        StagingQuestionDTO updated = service.updateQuestion(session.getSessionId(), "q15", update);
        assertEquals("Enunciado revisado e corrigido", updated.getStatement());
        assertEquals("SOURCE_VERIFIED", updated.getStatus());
        assertTrue(updated.isModifiedByUser());
        assertEquals("Verificado contra PDF original da página 6", updated.getReviewNotes());
    }

    @Test
    public void testSimulateImportDetectsCollisionsAndReadiness() {
        when(jdbcTemplate.query(anyString(), org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.RowMapper<String>>any()))
                .thenReturn(List.of("q1", "q2"));

        StagingSessionDTO session = service.createSession(Map.of());
        List<StagingQuestionDTO> questions = service.getSessionQuestions(session.getSessionId());

        StagingQuestionDTO qVerified = new StagingQuestionDTO();
        qVerified.setId("q15_new");
        qVerified.setNumeroOriginal(15);
        qVerified.setStatus("SOURCE_VERIFIED");
        qVerified.setDisciplina("Raciocínio Lógico");
        questions.add(qVerified);

        StagingQuestionDTO qColliding = new StagingQuestionDTO();
        qColliding.setId("q1");
        qColliding.setNumeroOriginal(1);
        qColliding.setStatus("STRUCTURALLY_VALID");
        qColliding.setDisciplina("Língua Portuguesa");
        questions.add(qColliding);

        ImportSimulationDTO sim = service.simulateImport(session.getSessionId());
        assertEquals(2, sim.getTotalStagingQuestions());
        assertEquals(2, sim.getVerifiedReadyToImport());
        assertEquals(1, sim.getCollidingExistingQuestions());
        assertEquals(List.of("q1"), sim.getCollidingQuestionIds());
        assertFalse(sim.isSafeToImport()); // Unsafe because of collision with existing q1
    }

    @Test
    public void testDetectContextualSuspectCharsPreservesValidPortuguese() {
        String legitPortuguese = "No que concerne à tributação predial urbana (IPTU), o contribuinte — pessoa física — alegou:";
        assertFalse(service.detectContextualSuspectChars(legitPortuguese), "Pontuação legítima em português não pode ser tratada como erro");

        String quoteText = "«Conforme previsto no Art. 150, VI, 'd' da CRFB/88...»";
        assertFalse(service.detectContextualSuspectChars(quoteText));

        String mojibakeText = "TributaÃ§Ã£o municipal e lanÃ§amento";
        assertTrue(service.detectContextualSuspectChars(mojibakeText), "Mojibake deve ser detectado");

        String replacementCharText = "Imposto sobre a propriedade predial urbana \uFFFD ISSQN";
        assertTrue(service.detectContextualSuspectChars(replacementCharText), "Caractere de substituição deve ser detectado");

        String brokenPipeText = "A con|unção adversativa introduz ressalva";
        assertTrue(service.detectContextualSuspectChars(brokenPipeText), "Pipe dentro de palavra deve ser detectado");
    }

    @Test
    public void testClassifyFromEditalSuggestsTopicsAccurately() {
        com.fiscalstudy.backend.domain.EditalTopico t1 = new com.fiscalstudy.backend.domain.EditalTopico(
                "topico-1", "edital-1", "concurso-1", "Direito Tributário", "Imunidade Tributária", "Espécies Tributárias",
                2.0, 10, "edital.pdf", 45, "Item 3.1", "EXPLICITA", false
        );
        com.fiscalstudy.backend.domain.EditalTopico t2 = new com.fiscalstudy.backend.domain.EditalTopico(
                "topico-2", "edital-1", "concurso-1", "Língua Portuguesa", "Concordância Verbal", "Sintaxe de Concordância",
                1.0, 10, "edital.pdf", 42, "Item 1.4", "EXPLICITA", false
        );

        StagingQuestionDTO qTrib = new StagingQuestionDTO();
        qTrib.setDisciplina("Direito Tributário");
        qTrib.setStatement("Com base na jurisprudência do STF sobre a imunidade tributária recíproca dos entes federados...");

        service.classifyFromEdital(qTrib, List.of(t1, t2));
        assertEquals("Direito Tributário", qTrib.getDisciplinaSugerida());
        assertEquals("Imunidade Tributária", qTrib.getAssuntoSugerido());
        assertEquals("Espécies Tributárias", qTrib.getSubassuntoSugerido());
        assertEquals("topico-1", qTrib.getEditalTopicoId());

        StagingQuestionDTO qSemMatch = new StagingQuestionDTO();
        qSemMatch.setDisciplina("Direito Tributário");
        qSemMatch.setStatement("Questão genérica sobre prazo decadencial e prescricional de certidão.");

        service.classifyFromEdital(qSemMatch, List.of(t1, t2));
        assertNull(qSemMatch.getAssuntoSugerido(), "Sem match forte deve permanecer nulo/pendente");
    }
}
