package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Validação do Ciclo Ingestão -> Publicação -> Estudo (Item 5 da Governança)
 * Comprova que uma questão originária do staging e publicada no banco operacional
 * é imediatamente consumível pela API de estudos, pelo repositório e pelo event_store.
 */
@SpringBootTest(properties = {
        "fiscalstudy.event-origin=REAL_STUDY",
        "fiscalstudy.anki.network-allowed=false"
})
@AutoConfigureMockMvc
class PublishedStagingQuestionStudyFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private final String publishedStagingId = "ibgp-2023-pref-araguari-auditor-q01";
    private final String sessionId = "sess_staging_flow_" + UUID.randomUUID();

    @BeforeEach
    void setupPublishedQuestionFixture() {
        jdbcTemplate.execute("DELETE FROM event_store WHERE session_id = '" + sessionId + "'");
        jdbcTemplate.execute("DELETE FROM questions WHERE id = '" + publishedStagingId + "'");

        // Simula exatamente o registro gerado pelo publish_verified.py no banco operacional
        String optionsJson = "[\"A) Primeira hipótese\", \"B) Hipótese correta da lei\", \"C) Distrator comum\", \"D) Erro crasso\"]";
        jdbcTemplate.update(
                "INSERT INTO questions (" +
                "  id, enunciado, options_json, correct_option, gabarito_status, " +
                "  banca, ano, orgao, cargo, disciplina, assunto, " +
                "  status, numero_original, arquivo_origem" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                publishedStagingId,
                "Sobre a Lei Complementar 123/2006, assinale a opção correta:",
                optionsJson,
                "B",
                "DEFINITIVO",
                "IBGP",
                2023,
                "Prefeitura Araguari",
                "Auditor Fiscal",
                "Direito Tributário",
                "Simples Nacional",
                "VALIDADA",
                1,
                "provas/araguari-auditor.pdf"
        );
    }

    @Test
    @DisplayName("Percurso Completo: Questão publicada de staging é recuperada, resolvida e auditada na camada de estudo")
    void testPublishedQuestionBecomesUsableInStudyFlow() throws Exception {
        // 1. Recuperar a questão pela API web de estudos
        mockMvc.perform(get("/api/v1/questions/next")
                .param("disciplina", "Direito Tributário")
                .param("sessionId", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value(publishedStagingId))
                .andExpect(jsonPath("$.metadata.board").value("IBGP"))
                .andExpect(jsonPath("$.metadata.year").value(2023));

        // 2. Submeter tentativa real com confiança e tempo ativo
        String attemptId = UUID.randomUUID().toString();
        String attemptPayload = objectMapper.writeValueAsString(Map.of(
                "attemptId", attemptId,
                "sessionId", sessionId,
                "selectedOption", "B",
                "confidenceLevel", 5,
                "activeTimeMs", 35000,
                "origin", "REAL_STUDY"
        ));

        mockMvc.perform(post("/api/v1/questions/" + publishedStagingId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(attemptPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(true))
                .andExpect(jsonPath("$.correctOption").value("B"))
                .andExpect(jsonPath("$.gabaritoStatus").value("DEFINITIVO"));

        // 3. Confirmar que o evento no event_store foi devidamente registrado com a proveniência e metadados da questão
        String rawAnswer = jdbcTemplate.queryForObject(
                "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND session_id = ?",
                String.class,
                sessionId
        );
        assertNotNull(rawAnswer);
        JsonNode node = objectMapper.readTree(rawAnswer);
        assertEquals(attemptId, node.path("attemptId").asText());
        assertEquals("B", node.path("selectedOption").asText());
        assertEquals(5, node.path("confidenceLevel").asInt());
        assertEquals(35000, node.path("activeTimeMs").asLong());
        assertEquals("REAL_STUDY", node.path("origin").asText());
        assertTrue(node.path("isCorrect").asBoolean());

        // 4. Registrar anotação de feedback
        String annotationId = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/questions/" + publishedStagingId + "/attempts/" + attemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "annotationId", annotationId,
                        "sessionId", sessionId,
                        "causaErro", "DOMINIO_PLENO"
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECORDED"));
    }
}
