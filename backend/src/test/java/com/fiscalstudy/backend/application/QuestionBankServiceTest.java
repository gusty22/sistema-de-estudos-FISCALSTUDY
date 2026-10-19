package com.fiscalstudy.backend.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@DisplayName("Testes Unitários do QuestionBankService — Dados Reais e Filtros Dinâmicos")
class QuestionBankServiceTest {

    private JdbcTemplate jdbcTemplate;
    private QuestionBankService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        service = new QuestionBankService(jdbcTemplate);
    }

    @Test
    @DisplayName("Garante busca paginada com contagem total e mapeamento de enunciado")
    void testSearchQuestionsBasic() {
        when(jdbcTemplate.queryForObject(contains("COUNT(DISTINCT q.id)"), eq(Integer.class), any(Object[].class)))
                .thenReturn(42);

        when(jdbcTemplate.query(contains("q.enunciado AS statement"), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of(
                        Map.of(
                                "questionId", "q-001",
                                "statement", "Enunciado real da questão de teste",
                                "discipline", "Direito Constitucional",
                                "board", "FGV",
                                "year", 2024
                        )
                ));

        Map<String, Object> result = service.searchQuestions(
                null, null, null, null, null, null, null, null, null, null, false, 0, 15
        );

        assertNotNull(result);
        assertEquals(42, result.get("totalElements"));
        assertEquals(0, result.get("page"));
        assertEquals(15, result.get("limit"));
        assertEquals(3, result.get("totalPages"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) result.get("questions");
        assertEquals(1, questions.size());
        assertEquals("q-001", questions.get(0).get("questionId"));
        assertEquals("Enunciado real da questão de teste", questions.get(0).get("statement"));
    }

    @Test
    @DisplayName("Metadados dinâmicos retornam valores sem fallbacks mockados")
    void testGetFiltersMetadataWithoutMocks() {
        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT q.disciplina"), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("Auditoria", "Direito Constitucional"));

        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT q.banca"), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("IBGP", "FGV"));

        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT q.ano"), eq(Integer.class), any(Object[].class)))
                .thenReturn(List.of(2025, 2024));

        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT q.orgao"), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("TCE_SC"));

        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT q.cargo"), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("Auditor Fiscal"));

        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM questions q"), eq(Integer.class), any(Object[].class)))
                .thenReturn(0);

        Map<String, Object> metadata = service.getFiltersMetadata(
                null, null, null, null, null, null, null, null, null, null, false
        );

        assertNotNull(metadata);
        assertEquals(List.of("Auditoria", "Direito Constitucional"), metadata.get("disciplinas"));
        assertEquals(List.of("IBGP", "FGV"), metadata.get("bancas"));
        assertEquals(List.of(2025, 2024), metadata.get("anos"));
        assertEquals(List.of("TCE_SC"), metadata.get("orgaos"));
        assertEquals(List.of("Auditor Fiscal"), metadata.get("cargos"));
        assertEquals(List.of("MULTIPLA_ESCOLHA"), metadata.get("tiposQuestao"));
    }

    @Test
    @DisplayName("Filtro de edital calcula cobertura real de questões por disciplina")
    void testEditalDisciplineCoverage() {
        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT disciplina FROM edital_topicos"), eq(String.class), anyString()))
                .thenReturn(List.of("Auditoria", "Matemática"));

        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM questions"), eq(Integer.class), eq("Auditoria"), eq("Auditoria")))
                .thenReturn(229);

        when(jdbcTemplate.queryForObject(contains("COUNT(*) FROM questions"), eq(Integer.class), eq("Matemática"), eq("Matemática")))
                .thenReturn(0);

        when(jdbcTemplate.queryForList(contains("SELECT DISTINCT q.disciplina"), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("Auditoria"));

        Map<String, Object> metadata = service.getFiltersMetadata(
                "concurso-araguari", null, null, null, null, null, null, null, null, null, true
        );

        assertNotNull(metadata);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> editalDisciplinas = (List<Map<String, Object>>) metadata.get("editalDisciplinas");
        assertEquals(2, editalDisciplinas.size());

        Map<String, Object> auditoria = editalDisciplinas.get(0);
        assertEquals("Auditoria", auditoria.get("nome"));
        assertEquals(229, auditoria.get("questoesDisponiveis"));

        Map<String, Object> matematica = editalDisciplinas.get(1);
        assertEquals("Matemática", matematica.get("nome"));
        assertEquals(0, matematica.get("questoesDisponiveis"));
    }
}
