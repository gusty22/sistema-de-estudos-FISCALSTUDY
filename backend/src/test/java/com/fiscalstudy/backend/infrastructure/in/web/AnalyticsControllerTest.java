package com.fiscalstudy.backend.infrastructure.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import org.springframework.http.MediaType;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");

        String optionsJson = "[\"A) 1\", \"B) 2\", \"C) 3\", \"D) 4\"]";
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "q1", "Questão Tributário", optionsJson, "A", "IBGP", 2023, "Auditor", "Direito Tributário");
        jdbcTemplate.update("INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "q2", "Questão Contabilidade", optionsJson, "B", "IBGP", 2023, "Auditor", "Contabilidade");
    }

    @Test
    void getOverview_WhenEmpty_ReturnsZeroedMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAnswered").value(0))
                .andExpect(jsonPath("$.globalAccuracy").value(0.0))
                .andExpect(jsonPath("$.guidance.observacao").value(containsString("Nenhum evento")));
    }

    @Test
    void getOverview_WithEvents_ComputesMetricsAndGuidance() throws Exception {
        // Record attempt 1: correct on q1 (Tributário) with confidence 5
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-12T01:00:00Z', '2026-10-12T01:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":12000}')");

        // Record attempt 2: error on q2 (Contabilidade) with confidence 5 (overconfidence)
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e2', 'ANSWER_SUBMITTED', 'QUESTION', 'q2', 's1', '2026-10-12T01:01:00Z', '2026-10-12T01:01:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q2\",\"selectedOption\":\"A\",\"isCorrect\":false,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":18000}')");

        mockMvc.perform(get("/api/v1/analytics/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAnswered").value(2))
                .andExpect(jsonPath("$.evaluatedCount").value(2))
                .andExpect(jsonPath("$.correctCount").value(1))
                .andExpect(jsonPath("$.errorCount").value(1))
                .andExpect(jsonPath("$.globalAccuracy").value(50.0))
                .andExpect(jsonPath("$.overconfidenceCount").value(1))
                .andExpect(jsonPath("$.byDiscipline['Direito Tributário'].accuracy").value(100.0))
                .andExpect(jsonPath("$.byDiscipline['Contabilidade'].accuracy").value(0.0))
                .andExpect(jsonPath("$.guidance.observacao").value(containsString("2 tentativas")))
                .andExpect(jsonPath("$.guidance.diagnostico").value(containsString("Volume amostral")));
    }

    @Test
    void exportCsv_ReturnsCsvFormattedDataset() throws Exception {
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-12T01:00:00Z', '2026-10-12T01:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":12000}')");

        mockMvc.perform(get("/api/v1/analytics/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("fiscalstudy_attempts.csv")))
                .andExpect(content().contentType("text/csv; charset=UTF-8"))
                .andExpect(content().string(containsString("question_id,selected_option,is_correct")))
                .andExpect(content().string(containsString("\"q1\",\"A\",true,\"DEFINITIVO\",5,12000,\"Direito Tributário\",\"IBGP\",2023")));
    }

    @Test
    void getOverview_ExcludesAnuladasFromPedagogicalDomainAndAccuracy() throws Exception {
        // Attempt 1: Definitivo correto em Tributário (q1)
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-12T01:00:00Z', '2026-10-12T01:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"concursoPoint\":1,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":4,\"activeTimeMs\":10000}')");

        // Attempt 2: Questão Anulada pela banca em Contabilidade (q2) com confiança máxima 5
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e2', 'ANSWER_SUBMITTED', 'QUESTION', 'q2', 's1', '2026-10-12T01:01:00Z', '2026-10-12T01:01:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q2\",\"selectedOption\":\"A\",\"isCorrect\":null,\"concursoPoint\":1,\"gabaritoStatus\":\"ANULADA\",\"confidenceLevel\":5,\"activeTimeMs\":15000}')");

        mockMvc.perform(get("/api/v1/analytics/overview"))
                .andExpect(status().isOk())
                // totalAnswered conta os 2 eventos registrados (atividade)
                .andExpect(jsonPath("$.totalAnswered").value(2))
                // evaluatedCount pedagógico conta apenas o 1 item válido (q1)
                .andExpect(jsonPath("$.evaluatedCount").value(1))
                .andExpect(jsonPath("$.correctCount").value(1))
                .andExpect(jsonPath("$.errorCount").value(0))
                .andExpect(jsonPath("$.globalAccuracy").value(100.0))
                // Anulada NÃO gera overconfidence/calibração mesmo com confiança 5
                .andExpect(jsonPath("$.overconfidenceCount").value(0))
                // Contabilidade teve tentativa mas 0 itens pedagógicos avaliados (não polui taxa de acerto)
                .andExpect(jsonPath("$.byDiscipline['Contabilidade'].evaluated").value(0))
                .andExpect(jsonPath("$.byDiscipline['Contabilidade'].accuracy").value(0.0))
                .andExpect(jsonPath("$.byDiscipline['Direito Tributário'].evaluated").value(1))
                .andExpect(jsonPath("$.byDiscipline['Direito Tributário'].accuracy").value(100.0));
    }

    @Test
    void exportQuestionsV1_GeneratesStrictContractV1Csv() throws Exception {
        // Tentativa 1 no tópico Imunidades
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-14T10:00:00Z', '2026-10-14T10:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":4,\"activeTimeMs\":15000}')");

        // Tentativa 2 no mesmo tópico Imunidades 24 horas depois
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e2', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's2', '2026-10-15T10:00:00Z', '2026-10-15T10:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"B\",\"isCorrect\":false,\"gabaritoStatus\":\"DEFINITIVO\",\"confidenceLevel\":5,\"activeTimeMs\":22000}')");

        mockMvc.perform(get("/api/v1/analytics/export/questions-v1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("questions_v1.csv")))
                .andExpect(content().contentType("text/csv; charset=UTF-8"))
                .andExpect(content().string(containsString("attempt_id,question_id,session_id,discipline,topic,occurred_at,attempt_index_topic,delta_t_hours,delta_t_days,prev_confidence_level,confidence_level")))
                .andExpect(content().string(containsString("0.00,0.0000,NA,4")))
                .andExpect(content().string(containsString("24.00,1.0000,4,5")));
    }

    @Test
    void exportEventsV1_ExportsRawEventStoreStream() throws Exception {
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                "VALUES ('e1', 'ANSWER_SUBMITTED', 'QUESTION', 'q1', 's1', '2026-10-14T10:00:00Z', '2026-10-14T10:00:00Z', 1, 'v1', " +
                "'{\"questionId\":\"q1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"confidenceLevel\":5}')");

        mockMvc.perform(get("/api/v1/analytics/export/events-v1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("events_v1.csv")))
                .andExpect(content().contentType("text/csv; charset=UTF-8"))
                .andExpect(content().string(containsString("rowid,event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json")))
                .andExpect(content().string(containsString("\"e1\",\"ANSWER_SUBMITTED\",\"QUESTION\",\"q1\",\"s1\"")));
    }

    @Test
    void syncToLocal_WritesFilesSuccessfully() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/analytics/export/sync-to-local"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analytics_questions_v1").exists())
                .andExpect(jsonPath("$.analytics_events_v1").exists());
    }

    @Test
    void getStudentKnowledgeState_ReturnsCanonicalModelFormulaAndTopics() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/student-knowledge-state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formula.expressaoLatex").value("P_{atual}(t) = P_{base} \\cdot e^{-\\frac{\\Delta t}{S}}"))
                .andExpect(jsonPath("$.resumoGlobal").exists())
                .andExpect(jsonPath("$.topicos").isArray());
    }

    @Test
    void getCalibrationAndStudentModel_ReturnsEnrichedRetentionFormula() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/calibration-model"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.abaB_retencao.formula.expressao").value("P_{atual}(t) = P_{base} \\cdot e^{-\\frac{\\Delta t}{S}}"))
                .andExpect(jsonPath("$.abaB_retencao.itens").isArray())
                .andExpect(jsonPath("$.abaC_modeloEstudante").isArray());
    }

    @Test
    void getStudyAnomalies_ReturnsAutomatedAuditReport() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/study-anomalies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataAuditoria").exists())
                .andExpect(jsonPath("$.metricas").exists())
                .andExpect(jsonPath("$.anomalias").isArray());
    }

    @Test
    void checkFatigue_DetectsExcessSessionTime() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/analytics/study-anomalies/check-fatigue")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"durationSeconds\": 6000, \"velocidadeInicial\": 20.0, \"velocidadeAtual\": 8.0, \"acertoPrimeiraMetade\": 80.0, \"acertoSegundaMetade\": 40.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fatigue").value(true))
                .andExpect(jsonPath("$.anomalia.tipo").value("FADIGA_QUEDA_RENDIMENTO"));
    }
}
