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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"fiscalstudy.event-origin=REAL_STUDY", "fiscalstudy.anki.network-allowed=false"})
@AutoConfigureMockMvc
public class ActiveTimeAndConfidenceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");

        String optionsJson = "[\"A) 1\", \"B) 2\", \"C) 3\", \"D) 4\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina, assunto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "q1", "Questão Tributário 1", optionsJson, "A", "FGV", 2024, "Auditor", "Direito Tributário", "Imunidades");
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina, assunto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "q2", "Questão Tributário 2", optionsJson, "B", "FGV", 2024, "Auditor", "Direito Tributário", "Crédito Tributário");
    }

    @Test
    void recordStudySession_WhenDurationZero_EnrichesFromAnswerSubmittedEvents() throws Exception {
        String sessId = "sess-rec-enrich-1";

        // Inserir tentativa de resposta com tempo ativo de 45 segundos e confiança 5
        String sql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql, "e1", "ANSWER_SUBMITTED", "QUESTION", "q1", sessId, "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z", 1, "v1",
                "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"confidenceLevel\":5,\"activeTimeMs\":45000}");

        // Gravar sessão com durationSeconds zerado
        String recordPayload = String.format("{\"sessionId\":\"%s\",\"concursoId\":\"c1\",\"tipo\":\"QUESTOES\",\"titulo\":\"Sessão Enriquecida\",\"durationSeconds\":0,\"questoesFeitas\":0,\"acertos\":0}", sessId);

        mockMvc.perform(post("/api/v1/study-sessions/record")
                .contentType(MediaType.APPLICATION_JSON)
                .content(recordPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(sessId))
                .andExpect(jsonPath("$.durationSeconds").value(45))
                .andExpect(jsonPath("$.questoesFeitas").value(1))
                .andExpect(jsonPath("$.questoesAcertadas").value(1))
                .andExpect(jsonPath("$.confiancaMedia").value(5.0));

        // Consultar histórico de sessões e verificar enriquecimento real
        mockMvc.perform(get("/api/v1/study-sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].sessionId").value(sessId))
                .andExpect(jsonPath("$[0].durationSeconds").value(45))
                .andExpect(jsonPath("$[0].questoesFeitas").value(1))
                .andExpect(jsonPath("$[0].questoesAcertadas").value(1))
                .andExpect(jsonPath("$[0].confiancaMedia").value(5.0));
    }

    @Test
    void getAllStudySessions_SynthesizesUnrecordedSessionsWithActiveTimeAndConfidence() throws Exception {
        String sessId = "sess-unrecorded-synth-1";

        // Resposta submetida sem chamada de record posterior
        String sql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql, "e2", "ANSWER_SUBMITTED", "QUESTION", "q2", sessId, "2026-10-20T00:05:00Z", "2026-10-20T00:05:00Z", 1, "v1",
                "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q2\",\"selectedOption\":\"C\",\"isCorrect\":false,\"confidenceLevel\":3,\"activeTimeMs\":15000}");

        mockMvc.perform(get("/api/v1/study-sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sessionId").value(sessId))
                .andExpect(jsonPath("$[0].durationSeconds").value(15))
                .andExpect(jsonPath("$[0].questoesFeitas").value(1))
                .andExpect(jsonPath("$[0].questoesAcertadas").value(0))
                .andExpect(jsonPath("$[0].confiancaMedia").value(3.0));
    }

    @Test
    void analyticsDashboardAndCalibration_ReflectRealActiveTimeAndConfidence() throws Exception {
        String sessId = "sess-analytics-real-1";
        String sql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        // 1. Acerto com Alta Confiança (5) e 45s (45000ms)
        jdbcTemplate.update(sql, "e1", "ANSWER_SUBMITTED", "QUESTION", "q1", sessId, "2026-10-20T01:00:00Z", "2026-10-20T01:00:00Z", 1, "v1",
                "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"confidenceLevel\":5,\"activeTimeMs\":45000}");

        // 2. Erro com Baixa Confiança (1) e 15s (15000ms) - Lacuna Consciente
        jdbcTemplate.update(sql, "e2", "ANSWER_SUBMITTED", "QUESTION", "q2", sessId, "2026-10-20T01:01:00Z", "2026-10-20T01:01:00Z", 1, "v1",
                "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q2\",\"selectedOption\":\"A\",\"isCorrect\":false,\"confidenceLevel\":1,\"activeTimeMs\":15000}");

        // Dashboard de Desempenho
        mockMvc.perform(get("/api/v1/analytics/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resumo.tempoEfetivoMs").value(60000))
                .andExpect(jsonPath("$.resumo.tempoEfetivoFormatado").value("1 min"))
                .andExpect(jsonPath("$.resumo.confiancaMedia").value(3.0))
                .andExpect(jsonPath("$.resumo.distribuicaoConfianca['5']").value(1))
                .andExpect(jsonPath("$.resumo.distribuicaoConfianca['1']").value(1))
                .andExpect(jsonPath("$.distribuicao[0].confiancaMedia").value(1.0))
                .andExpect(jsonPath("$.distribuicao[1].confiancaMedia").value(5.0));

        // Aba A - Calibração de Confiança
        mockMvc.perform(get("/api/v1/analytics/calibration-model"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.abaA_confianca.matriz.altaConfiancaAcerto").value(1))
                .andExpect(jsonPath("$.abaA_confianca.matriz.baixaConfiancaErro").value(1))
                .andExpect(jsonPath("$.abaA_confianca.brierScore").isNumber());
    }
    @Test
    void automatedAndUnknownAnswersDoNotCreatePersonalSessions() throws Exception {
        jdbcTemplate.update("INSERT INTO event_store(event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json) VALUES(?,?,?,?,?,?,?,1,'v1',?)",
            "excluded-test", "ANSWER_SUBMITTED", "QUESTION", "q1", "test-fixture", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z",
            "{\"origin\":\"AUTOMATED_TEST\",\"activeTimeMs\":45000,\"isCorrect\":true}");
        jdbcTemplate.update("INSERT INTO event_store(event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json) VALUES(?,?,?,?,?,?,?,1,'v1',?)",
            "excluded-unknown", "ANSWER_SUBMITTED", "QUESTION", "q2", "unknown-fixture", "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z", "{}");
        mockMvc.perform(get("/api/v1/study-sessions"))
            .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }
}
