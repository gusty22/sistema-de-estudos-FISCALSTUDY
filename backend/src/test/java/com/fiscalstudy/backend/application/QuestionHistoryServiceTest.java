package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.infrastructure.in.web.dto.PerformanceXRayDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.QuestionHistoryDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@DisplayName("Testes do QuestionHistoryService (Rastreabilidade e Raio-X de Questões)")
class QuestionHistoryServiceTest {

    private JdbcTemplate jdbcTemplate;
    private QuestionHistoryService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        service = new QuestionHistoryService(jdbcTemplate);
    }

    @Test
    @DisplayName("Retorna histórico de questões paginado e com distinção entre tentativas e questões únicas")
    void testQuestionHistoryMapping() {
        Map<String, Object> row1 = new HashMap<>();
        row1.put("event_id", "evt-1");
        row1.put("question_id", "q-101");
        row1.put("session_id", "sess-1");
        row1.put("occurred_at", "2026-10-14T10:00:00Z");
        row1.put("payload_json", "{\"questionId\":\"q-101\",\"selectedOption\":\"B\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":45000,\"gabaritoStatus\":\"DEFINITIVO\"}");
        row1.put("enunciado", "Sobre o ISSQN, assinale a correta:");
        row1.put("options_json", "[\"A) Opção 1\",\"B) Opção 2\"]");
        row1.put("correct_option", "B");
        row1.put("gabarito_status", "DEFINITIVO");
        row1.put("banca", "FGV");
        row1.put("ano", 2024);
        row1.put("orgao", "SEFAZ");
        row1.put("cargo", "Auditor");
        row1.put("disciplina", "Direito Tributário");
        row1.put("assunto", "ISSQN");
        row1.put("attempt_number", 1);
        row1.put("total_attempts_for_question", 2);

        Map<String, Object> row2 = new HashMap<>();
        row2.put("event_id", "evt-2");
        row2.put("question_id", "q-101");
        row2.put("session_id", "sess-2");
        row2.put("occurred_at", "2026-10-14T14:00:00Z");
        row2.put("payload_json", "{\"questionId\":\"q-101\",\"selectedOption\":\"A\",\"isCorrect\":false,\"confidenceLevel\":5,\"activeTimeMs\":30000,\"gabaritoStatus\":\"DEFINITIVO\",\"causaErro\":\"E1\"}");
        row2.put("enunciado", "Sobre o ISSQN, assinale a correta:");
        row2.put("options_json", "[\"A) Opção 1\",\"B) Opção 2\"]");
        row2.put("correct_option", "B");
        row2.put("gabarito_status", "DEFINITIVO");
        row2.put("banca", "FGV");
        row2.put("ano", 2024);
        row2.put("orgao", "SEFAZ");
        row2.put("cargo", "Auditor");
        row2.put("disciplina", "Direito Tributário");
        row2.put("assunto", "ISSQN");
        row2.put("attempt_number", 2);
        row2.put("total_attempts_for_question", 2);

        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row1, row2));

        QuestionHistoryDTO.Response res = service.getQuestionHistory(null, null, null, "ALL", "ALL", 10, 0);

        assertNotNull(res);
        assertEquals(2, res.getTotalAttempts(), "Total de tentativas deve ser 2");
        assertEquals(1, res.getUniqueQuestionsCount(), "Questão única deve ser 1");
        assertEquals(1, res.getCorrectCount(), "1 acerto");
        assertEquals(1, res.getIncorrectCount(), "1 erro");
        assertEquals(50.0, res.getAccuracyRate(), 0.01);
        assertEquals(2, res.getItems().size());

        QuestionHistoryDTO.Item item = res.getItems().get(0);
        assertEquals("evt-1", item.getEventId());
        assertEquals("q-101", item.getQuestionId());
        assertEquals("B", item.getSelectedOption());
        assertTrue(item.getIsCorrect());
        assertEquals("Direito Tributário", item.getDiscipline());
        assertEquals("ISSQN", item.getTopic());
    }

    @Test
    @DisplayName("Performance X-Ray calcula acurácia real por disciplina e tópicos críticos sem mocks")
    void testPerformanceXRayCalculation() {
        Map<String, Object> r1 = new HashMap<>();
        r1.put("question_id", "q-1");
        r1.put("occurred_at", "2026-10-14T09:00:00Z");
        r1.put("payload_json", "{\"isCorrect\":true,\"activeTimeMs\":40000,\"gabaritoStatus\":\"DEFINITIVO\"}");
        r1.put("disciplina", "Direito Tributário");
        r1.put("assunto", "CTN");
        r1.put("gabarito_status", "DEFINITIVO");

        Map<String, Object> r2 = new HashMap<>();
        r2.put("question_id", "q-2");
        r2.put("occurred_at", "2026-10-14T09:10:00Z");
        r2.put("payload_json", "{\"isCorrect\":false,\"activeTimeMs\":60000,\"gabaritoStatus\":\"DEFINITIVO\"}");
        r2.put("disciplina", "Contabilidade");
        r2.put("assunto", "DRE");
        r2.put("gabarito_status", "DEFINITIVO");

        when(jdbcTemplate.queryForList(contains("FROM event_store e"))).thenReturn(List.of(r1, r2));
        when(jdbcTemplate.queryForList(contains("FROM questions"))).thenReturn(List.of(Map.of("c", 100)));

        PerformanceXRayDTO xray = service.getPerformanceXRay("concurso-1");

        assertNotNull(xray);
        assertEquals(2, xray.getTotalAttempts());
        assertEquals(2, xray.getUniqueQuestions());
        assertEquals(1, xray.getTotalCorrect());
        assertEquals(1, xray.getTotalIncorrect());
        assertEquals(50.0, xray.getAccuracyRate(), 0.01);
        assertEquals(100, xray.getTotalQuestionsInBank());
        assertEquals(98, xray.getUnansweredQuestionsCount());

        // Verifica divisão por disciplina
        assertEquals(2, xray.getDisciplineBreakdown().size());
        // Verifica área de erro (Contabilidade teve 1 erro)
        assertFalse(xray.getTopErrorAreas().isEmpty());
        assertEquals("Contabilidade", xray.getTopErrorAreas().get(0).getDisciplina());
    }

    @Test
    @DisplayName("Performance X-Ray retorna estado limpo quando não há resoluções")
    void testPerformanceXRayEmptyState() {
        when(jdbcTemplate.queryForList(anyString())).thenReturn(new ArrayList<>());

        PerformanceXRayDTO xray = service.getPerformanceXRay("concurso-1");

        assertNotNull(xray);
        assertEquals(0, xray.getTotalAttempts());
        assertEquals(0, xray.getUniqueQuestions());
        assertEquals(0.0, xray.getAccuracyRate());
        assertTrue(xray.getDisciplineBreakdown().isEmpty());
    }
}
