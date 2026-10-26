package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.FiscalStudyApplication;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeProjection;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Homologação Ponta a Ponta (E2E) com dados controlados:
 * Fluxo: Registrar -> Reconstruir -> Consultar API -> Reiniciar/Re-reconstruir -> Consultar novamente.
 */
@SpringBootTest(classes = FiscalStudyApplication.class)
@AutoConfigureMockMvc
public class TopicKnowledgeE2EHomologationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TopicKnowledgeRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("ETAPA 6: Homologação Ponta a Ponta com dados controlados, descarte de sintéticos e idempotência")
    void testEndToEndHomologationFlow() throws Exception {
        String testSuffix = UUID.randomUUID().toString().substring(0, 8);
        String topicA = "Homologacao_Topico_A_" + testSuffix;
        String topicB = "Homologacao_Topico_B_" + testSuffix;
        String topicZero = "Homologacao_Topico_Zero_" + testSuffix;

        String disc = "DIREITO_TRIBUTARIO";

        // 1. Cadastrar tópicos canônicos em edital_topicos
        jdbcTemplate.update("INSERT OR IGNORE INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto) VALUES (?, ?, ?, ?, ?)",
                "top-a-" + testSuffix, "ed-e2e", "conc-e2e", disc, topicA);
        jdbcTemplate.update("INSERT OR IGNORE INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto) VALUES (?, ?, ?, ?, ?)",
                "top-b-" + testSuffix, "ed-e2e", "conc-e2e", disc, topicB);
        jdbcTemplate.update("INSERT OR IGNORE INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto) VALUES (?, ?, ?, ?, ?)",
                "top-zero-" + testSuffix, "ed-e2e", "conc-e2e", disc, topicZero);

        // 2. Cadastrar questões
        String qA1 = "q-a1-" + testSuffix;
        String qA2 = "q-a2-" + testSuffix;
        String qB1 = "q-b1-" + testSuffix;

        jdbcTemplate.update("INSERT OR IGNORE INTO questions (id, disciplina, assunto, banca, ano, enunciado) VALUES (?, ?, ?, ?, ?, ?)",
                qA1, disc, topicA, "FGV", 2025, "Enunciado QA1");
        jdbcTemplate.update("INSERT OR IGNORE INTO questions (id, disciplina, assunto, banca, ano, enunciado) VALUES (?, ?, ?, ?, ?, ?)",
                qA2, disc, topicA, "FGV", 2025, "Enunciado QA2");
        jdbcTemplate.update("INSERT OR IGNORE INTO questions (id, disciplina, assunto, banca, ano, enunciado) VALUES (?, ?, ?, ?, ?, ?)",
                qB1, disc, topicB, "FGV", 2025, "Enunciado QB1");

        // 3. Inserir tentativas controladas em event_store
        // QA1: Tentativa 1 (Inédita, Acerto, Confiança 5, Ativo 40s)
        String attId1 = "att-1-" + testSuffix;
        Map<String, Object> p1 = Map.of(
                "attemptId", attId1,
                "questionId", qA1,
                "isCorrect", true,
                "confidenceLevel", 5,
                "activeTimeMs", 40000L,
                "exposicaoAnteriorCount", 0,
                "origin", "REAL_STUDY",
                "interventionType", "REGULAR"
        );
        String nowStr = Instant.now().toString();

        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, 1, '1.0', ?)",
                "attempt:" + attId1, "ANSWER_SUBMITTED", "QUESTION", qA1, "sess-1", Instant.now().minusSeconds(100).toString(), nowStr, objectMapper.writeValueAsString(p1));

        // QA1: Tentativa 2 (Repetida, Erro, Confiança 4, Ativo 60s, Causa: LACUNA_TEORICA)
        String attId2 = "att-2-" + testSuffix;
        Map<String, Object> p2 = Map.of(
                "attemptId", attId2,
                "questionId", qA1,
                "isCorrect", false,
                "confidenceLevel", 4,
                "activeTimeMs", 60000L,
                "exposicaoAnteriorCount", 1,
                "origin", "REAL_STUDY",
                "causaErro", "LACUNA_TEORICA",
                "interventionType", "SIMULADO"
        );
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, 1, '1.0', ?)",
                "attempt:" + attId2, "ANSWER_SUBMITTED", "QUESTION", qA1, "sess-1", Instant.now().minusSeconds(50).toString(), nowStr, objectMapper.writeValueAsString(p2));

        // Anotação posterior (ATTEMPT_ANNOTATED) para attId2 atualizando causa de erro para PEGADINHA_BANCA
        Map<String, Object> annotPayload = Map.of(
                "attemptId", attId2,
                "causaErro", "PEGADINHA_BANCA"
        );
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, 1, '1.0', ?)",
                "annotation:" + attId2, "ATTEMPT_ANNOTATED", "QUESTION", qA1, "sess-1", Instant.now().minusSeconds(30).toString(), nowStr, objectMapper.writeValueAsString(annotPayload));

        // QA2: Tentativa 3 (Inédita, Acerto com baixa confiança 2, Ativo 30s)
        String attId3 = "att-3-" + testSuffix;
        Map<String, Object> p3 = Map.of(
                "attemptId", attId3,
                "questionId", qA2,
                "isCorrect", true,
                "confidenceLevel", 2,
                "activeTimeMs", 30000L,
                "exposicaoAnteriorCount", 0,
                "origin", "REAL_STUDY",
                "interventionType", "REGULAR"
        );
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, 1, '1.0', ?)",
                "attempt:" + attId3, "ANSWER_SUBMITTED", "QUESTION", qA2, "sess-1", Instant.now().minusSeconds(20).toString(), nowStr, objectMapper.writeValueAsString(p3));

        // QB1: Tentativa Sintética em Tópico B (deve ser categoricamente ignorada!)
        String attIdSynth = "att-synth-" + testSuffix;
        Map<String, Object> pSynth = Map.of(
                "attemptId", attIdSynth,
                "questionId", qB1,
                "isCorrect", false,
                "confidenceLevel", 1,
                "activeTimeMs", 5000L,
                "exposicaoAnteriorCount", 0,
                "origin", "AUTOMATED_TEST"
        );
        jdbcTemplate.update("INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, 1, '1.0', ?)",
                "attempt:" + attIdSynth, "ANSWER_SUBMITTED", "QUESTION", qB1, "sess-1", Instant.now().minusSeconds(10).toString(), nowStr, objectMapper.writeValueAsString(pSynth));

        // 4. Executar Reconstrução Determinística
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topicsProcessed", greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$.completedAt", notNullValue()));

        // 5. Consultar API para Tópico A
        mockMvc.perform(get("/api/v1/knowledge/topics/" + topicA)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topicName", is(topicA)))
                .andExpect(jsonPath("$.evidenceStatus", is("PRELIMINAR")))
                .andExpect(jsonPath("$.totalAttempts", is(3)))
                .andExpect(jsonPath("$.correctAttempts", is(2)))
                .andExpect(jsonPath("$.errorAttempts", is(1)))
                .andExpect(jsonPath("$.accuracyDenominatorText", is("2/3")))
                .andExpect(jsonPath("$.uniqueQuestionsCount", is(2)))
                .andExpect(jsonPath("$.newQuestionsAttempts", is(2)))
                .andExpect(jsonPath("$.repeatedQuestionsAttempts", is(1)))
                // Confiança ordinal: (5 + 4 + 2) / 3 = 3.67
                .andExpect(jsonPath("$.avgConfidenceOrdinal", is(3.67)))
                // 1 acerto com baixa confiança (nível 2) e 1 erro com alta confiança (nível 4)
                .andExpect(jsonPath("$.lowConfidenceSuccesses", is(1)))
                .andExpect(jsonPath("$.highConfidenceErrors", is(1)))
                // Causa de erro atualizada pela anotação ATTEMPT_ANNOTATED
                .andExpect(jsonPath("$.errorCausesDistributionJson", containsString("\"PEGADINHA_BANCA\":1")))
                .andExpect(jsonPath("$.contextDistributionJson", containsString("\"SIMULADO\":1")));

        // 6. Consultar API para Tópico B (deve ser SEM_EVIDENCIAS porque o evento era sintético)
        mockMvc.perform(get("/api/v1/knowledge/topics/" + topicB)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceStatus", is("SEM_EVIDENCIAS")))
                .andExpect(jsonPath("$.totalAttempts", is(0)))
                .andExpect(jsonPath("$.accuracyDenominatorText", is("SEM_EVIDENCIAS")));

        // 7. Consultar API para Tópico Zero (zero tentativas reais)
        mockMvc.perform(get("/api/v1/knowledge/topics/" + topicZero)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidenceStatus", is("SEM_EVIDENCIAS")))
                .andExpect(jsonPath("$.totalAttempts", is(0)))
                .andExpect(jsonPath("$.accuracyDenominatorText", is("SEM_EVIDENCIAS")));

        // 8. Teste de Reinício / Idempotência: Reconstruir novamente e checar preservação idêntica
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        TopicKnowledgeProjection projA = repository.findByTopicId(topicA).orElseThrow();
        assertEquals(3, projA.getTotalAttempts());
        assertEquals(2, projA.getCorrectAttempts());
        assertEquals("2/3", projA.getAccuracyDenominatorText());
        assertEquals("PRELIMINAR", projA.getEvidenceStatus());
        assertTrue(projA.getErrorCausesDistributionJson().contains("\"PEGADINHA_BANCA\":1"));
    }
}
