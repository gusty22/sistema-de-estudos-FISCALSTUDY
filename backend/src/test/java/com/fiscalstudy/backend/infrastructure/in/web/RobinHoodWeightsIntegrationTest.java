package com.fiscalstudy.backend.infrastructure.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class RobinHoodWeightsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM edital_topicos WHERE concurso_id = 'c_robin'");
        jdbcTemplate.execute("DELETE FROM student_routines WHERE concurso_id = 'c_robin'");

        // Cadastrar edital com Direito Constitucional e Auditoria
        jdbcTemplate.update("INSERT INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto, peso, questoes_previstas) " +
                "VALUES ('et1', 'ed1', 'c_robin', 'Direito Constitucional', 'Direitos Individuais', 1.0, 10)");
        jdbcTemplate.update("INSERT INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto, peso, questoes_previstas) " +
                "VALUES ('et2', 'ed1', 'c_robin', 'Auditoria', 'Normas de Auditoria', 2.0, 15)");
    }

    @Test
    void legacyObservationalWeightsCannotInjectEmergencyBlock() throws Exception {
        String jsonPayload = """
                {
                  "contract_version": "1.0.0",
                  "generated_at": "2026-10-15T02:00:00Z",
                  "source_model": "survival_logistic_regression_wilson_v1",
                  "critical_topics": [
                    {
                      "discipline": "Auditoria",
                      "topic": "Normas Relativas ao Relatório do Auditor",
                      "wilson_lower_bound": 0.046,
                      "metacognitive_penalty": true,
                      "emergency_block_minutes": 15,
                      "rationale": "Limite de Wilson caiu para 4.6% (<85%). Erro com Confiança 5."
                    }
                  ],
                  "hyper_consolidated_disciplines": [
                    {
                      "discipline": "Direito Constitucional",
                      "wilson_lower_bound": 0.920,
                      "status": "DOADOR_DE_TEMPO"
                    }
                  ],
                  "redistribution_plan": {
                    "total_stolen_minutes": 15,
                    "donor_discipline": "Direito Constitucional",
                    "receiver_discipline": "Auditoria",
                    "receiver_topic": "Normas Relativas ao Relatório do Auditor",
                    "intervention_type": "EMERGENCIA_ROBIN_HOOD"
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/cycle/robin-hood/inject-weights")
                        .contentType(MediaType.APPLICATION_JSON).content(jsonPayload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string("X-FiscalStudy-Analytics-Status","OBSERVATIONAL_ONLY"));
        mockMvc.perform(get("/api/v1/cycle/robin-hood/active-weights"))
                .andExpect(status().isOk()).andExpect(content().string(""));
        mockMvc.perform(get("/api/v1/cycle/robin-hood?concursoId=c_robin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocos[?(@.type == 'EMERGENCIA_ROBIN_HOOD')]").isEmpty());
    }

    @Test
    void missingWeightsFileCannotGrantAuthority(@org.junit.jupiter.api.io.TempDir java.nio.file.Path temporary) throws Exception {
        mockMvc.perform(post("/api/v1/cycle/robin-hood/sync-weights").param("path",temporary.resolve("missing.json").toString()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string("X-FiscalStudy-Analytics-Status","NO_APPLICABLE_ANALYTICS"));
    }
}
