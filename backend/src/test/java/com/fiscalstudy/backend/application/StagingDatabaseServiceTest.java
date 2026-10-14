package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionUpdateRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingFileDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.StagingQuestionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class StagingDatabaseServiceTest {

    private StagingDatabaseService stagingService;

    @BeforeEach
    void setUp() {
        JdbcTemplate mockJdbc = mock(JdbcTemplate.class);
        stagingService = new StagingDatabaseService(mockJdbc);
    }

    @Test
    @DisplayName("Deve listar arquivos catalogados no staging.db com agregações")
    void shouldListStagingFiles() {
        List<StagingFileDTO> files = stagingService.listStagingFiles();
        assertNotNull(files);
        assertFalse(files.isEmpty(), "Deveria conter arquivos registrados no staging.db");

        // Verifica se arquivos com questões processadas aparecem no topo
        StagingFileDTO first = files.get(0);
        assertNotNull(first.getId());
        assertNotNull(first.getFilename());
        assertTrue(first.getQuestionCount() >= 0);
    }

    @Test
    @DisplayName("Deve recuperar questões para arquivo de staging existente")
    void shouldGetQuestionsForFile() {
        List<StagingFileDTO> files = stagingService.listStagingFiles();
        StagingFileDTO fileWithQuestions = files.stream()
                .filter(f -> f.getQuestionCount() > 0)
                .findFirst()
                .orElse(null);

        assertNotNull(fileWithQuestions, "Deveria existir ao menos um arquivo com questões extraídas");

        List<StagingQuestionDTO> questions = stagingService.getQuestionsForFile(fileWithQuestions.getId());
        assertNotNull(questions);
        assertEquals(fileWithQuestions.getQuestionCount(), questions.size());

        StagingQuestionDTO firstQ = questions.get(0);
        assertNotNull(firstQ.getId());
        assertTrue(firstQ.getNumeroOriginal() > 0);
        assertNotNull(firstQ.getStatement());
        assertNotNull(firstQ.getOptions());
    }

    @Test
    @DisplayName("Deve verificar e rejeitar questão com atualização em staging.db")
    void shouldVerifyAndRejectQuestion() {
        List<StagingFileDTO> files = stagingService.listStagingFiles();
        StagingFileDTO fileWithQuestions = files.stream()
                .filter(f -> f.getQuestionCount() > 0)
                .findFirst()
                .orElse(null);

        assertNotNull(fileWithQuestions);
        List<StagingQuestionDTO> questions = stagingService.getQuestionsForFile(fileWithQuestions.getId());
        StagingQuestionDTO target = questions.get(0);

        // Marca como verificada
        StagingQuestionDTO verified = stagingService.verifyStagingQuestion(target.getId());
        assertEquals("SOURCE_VERIFIED", verified.getStatus());
        assertTrue(verified.isModifiedByUser());

        // Atualiza nota de revisão
        QuestionUpdateRequestDTO req = new QuestionUpdateRequestDTO();
        req.setReviewNotes("Verificado conforme gabarito oficial");
        StagingQuestionDTO updated = stagingService.updateStagingQuestion(target.getId(), req);
        assertEquals("Verificado conforme gabarito oficial", updated.getReviewNotes());
    }
}
