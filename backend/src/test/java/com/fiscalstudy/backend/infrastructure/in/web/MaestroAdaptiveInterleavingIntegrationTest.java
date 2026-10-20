package com.fiscalstudy.backend.infrastructure.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class MaestroAdaptiveInterleavingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final String concursoId = "concurso-interleaving-test";

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM edital_topicos WHERE concurso_id = '" + concursoId + "'");
        jdbcTemplate.execute("DELETE FROM student_routines WHERE concurso_id = '" + concursoId + "'");
        jdbcTemplate.execute("DELETE FROM anki_flashcards WHERE deck_name LIKE '%test%'");

        // Cadastra 3 tópicos de 3 disciplinas distintas com pesos altos
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, subassunto, peso) " +
                "VALUES (?, ?, 'ed1', 'Ética no Serviço Público', 'Princípios Constitucionais', 'Moralidade Administrativa', 3.0)", UUID.randomUUID().toString(), concursoId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, subassunto, peso) " +
                "VALUES (?, ?, 'ed1', 'Direito Constitucional', 'Direitos Fundamentais', 'Remédios Constitucionais', 2.5)", UUID.randomUUID().toString(), concursoId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, subassunto, peso) " +
                "VALUES (?, ?, 'ed1', 'Raciocínio Lógico', 'Equivalências Lógicas', 'Tabela Verdade', 2.0)", UUID.randomUUID().toString(), concursoId);
    }

    @Test
    @DisplayName("Garante interleaving cognitivo sem monotonia: 180 min distribui em matérias alternadas com blocos <= 60 min")
    void testInterleaving180MinutesDoesNotMonopolizeSingleDiscipline() throws Exception {
        mockMvc.perform(get("/api/v1/maestro/plan")
                        .param("concursoId", concursoId)
                        .param("tempoDisponivelMinutos", "180"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tempoTotalMinutos", is(180)))
                .andExpect(jsonPath("$.tempoDisponivelMinutos", is(180)))
                .andExpect(jsonPath("$.telemetriaCognitiva.tempoDisponivelMinutos", is(180)))
                .andExpect(jsonPath("$.telemetriaCognitiva.tempoPlanejadoMinutos", is(180)))
                .andExpect(jsonPath("$.telemetriaCognitiva.totalBlocosIntercalados", is(3)))
                .andExpect(jsonPath("$.telemetriaCognitiva.disciplinasIntercaladas", hasSize(greaterThanOrEqualTo(2))))
                .andExpect(jsonPath("$.telemetriaCognitiva.revisoesInjetadas", is(0)))
                .andExpect(jsonPath("$.telemetriaCognitiva.statusPlanejador", is("ADEQUADO_BALANCEADO")))
                .andExpect(jsonPath("$.telemetriaCognitiva.criterioDecaimento", containsString("Nenhuma revisão emergencial injetada hoje")))
                .andExpect(jsonPath("$.telemetriaCognitiva.criterioAlternancia", containsString("Interleaving Ativo")))
                .andExpect(jsonPath("$.passos", hasSize(greaterThanOrEqualTo(6))));
    }

    @Test
    @DisplayName("Garante calibração perfeita para 120 min com status adequado e balanceado")
    void testPlan120MinutesMatchesAvailability() throws Exception {
        mockMvc.perform(get("/api/v1/maestro/plan")
                        .param("concursoId", concursoId)
                        .param("tempoDisponivelMinutos", "120"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tempoTotalMinutos", is(120)))
                .andExpect(jsonPath("$.tempoDisponivelMinutos", is(120)))
                .andExpect(jsonPath("$.telemetriaCognitiva.totalBlocosIntercalados", is(2)))
                .andExpect(jsonPath("$.telemetriaCognitiva.statusPlanejador", is("ADEQUADO_BALANCEADO")));
    }
}
