package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.application.AttemptAnnotationView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Homologação E2E Integrada da Wave 1 — FiscalStudy
 * Valida o ciclo de 10 etapas exigido pela governança:
 * 1. Abrir questão válida sem gabarito prévio
 * 2. Registrar tentativa real
 * 3. Persistência append-only no event_store com origin=REAL_STUDY
 * 4. Metadados de confiança e tempo ativo
 * 5. Liberação do gabarito apenas pós-tentativa
 * 6. Registro de anotação pós-tentativa via endpoint dedicado
 * 7. Persistência de ATTEMPT_ANNOTATED vinculado ao attemptId
 * 8. Imutabilidade da resposta original
 * 9. Consulta do histórico e integridade de sessão
 * 10. Disponibilidade para revisão e Analytics
 * 11. Casos de erro: 400, 404, 409 e idempotência de retry
 */
@SpringBootTest(properties = {
        "fiscalstudy.event-origin=REAL_STUDY",
        "fiscalstudy.anki.network-allowed=false"
})
@AutoConfigureMockMvc
class Wave1IntegratedE2EFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private final String questionId = "q_e2e_fiscal_01";
    private final String sessionId = "sess_e2e_" + UUID.randomUUID();

    @BeforeEach
    void setupCleanDatabase() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions WHERE id = '" + questionId + "'");

        String options = "[\"A) Opção Incorreta\", \"B) Opção Correta\", \"C) Opção Distrator\", \"D) Opção Errada\"]";
        jdbcTemplate.update(
                "INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina, assunto) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                questionId,
                "Qual o regime contábil adotado pela Lei 6.404/76 para a DRE?",
                options,
                "B",
                "FGV",
                2024,
                "Auditor Fiscal",
                "Contabilidade Geral",
                "Demonstração do Resultado do Exercício"
        );
    }

    @Test
    @DisplayName("Fluxo Canônico E2E: Ciclo Completo de Tentativa, Anotação e Imutabilidade")
    void testCompleteWave1Flow() throws Exception {
        // ETAPA 1 & 5: Abrir questão válida e assegurar ausência de gabarito antes de responder
        MvcResult nextResult = mockMvc.perform(get("/api/v1/questions/next?disciplina=Contabilidade Geral&sessionId=" + sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionId").value(questionId))
                .andExpect(jsonPath("$.statement").exists())
                .andExpect(jsonPath("$.correctOption").doesNotExist())
                .andExpect(jsonPath("$.gabarito").doesNotExist())
                .andReturn();

        // ETAPA 2, 3 & 4: Registrar tentativa real com confiança e tempo ativo medido
        String attemptId = UUID.randomUUID().toString();
        String attemptPayload = objectMapper.writeValueAsString(Map.of(
                "attemptId", attemptId,
                "sessionId", sessionId,
                "selectedOption", "A", // Resposta incorreta intencional para posterior diagnóstico
                "confidenceLevel", 4,
                "activeTimeMs", 42500,
                "chuteVal", false
        ));

        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(attemptPayload))
                .andExpect(status().isOk());

        // Verificar persistência no SQLite (Event Store Append-Only)
        String rawAnswerEvent = jdbcTemplate.queryForObject(
                "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND session_id = ?",
                String.class,
                sessionId
        );
        assertNotNull(rawAnswerEvent);
        JsonNode answerNode = objectMapper.readTree(rawAnswerEvent);
        assertEquals(attemptId, answerNode.path("attemptId").asText());
        assertEquals("A", answerNode.path("selectedOption").asText());
        assertEquals(4, answerNode.path("confidenceLevel").asInt());
        assertEquals(42500, answerNode.path("activeTimeMs").asLong());
        assertEquals("REAL_STUDY", answerNode.path("origin").asText());

        // ETAPA 6 & 7: Registrar anotação pós-tentativa em endpoint dedicado
        String annotationId = UUID.randomUUID().toString();
        String annotationPayload = objectMapper.writeValueAsString(Map.of(
                "annotationId", annotationId,
                "sessionId", sessionId,
                "causaErro", "CONCEITO_CONFUNDIDO"
        ));

        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts/" + attemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(annotationPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECORDED"))
                .andExpect(jsonPath("$.attemptId").value(attemptId))
                .andExpect(jsonPath("$.annotationId").value(annotationId));

        // ETAPA 8: Confirmar que ANSWER_SUBMITTED original NÃO foi modificado (Imutabilidade)
        String answerAfterAnnotation = jdbcTemplate.queryForObject(
                "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND session_id = ?",
                String.class,
                sessionId
        );
        assertEquals(rawAnswerEvent, answerAfterAnnotation, "O payload da resposta original não pode sofrer mutação após a anotação.");

        // Verificar persistência de ATTEMPT_ANNOTATED como novo evento independente
        String rawAnnotationEvent = jdbcTemplate.queryForObject(
                "SELECT payload_json FROM event_store WHERE event_type = 'ATTEMPT_ANNOTATED' AND session_id = ?",
                String.class,
                sessionId
        );
        assertNotNull(rawAnnotationEvent);
        JsonNode annotationNode = objectMapper.readTree(rawAnnotationEvent);
        assertEquals(attemptId, annotationNode.path("attemptId").asText());
        assertEquals("CONCEITO_CONFUNDIDO", annotationNode.path("causaErro").asText());

        // ETAPA 9: Consulta de histórico da tentativa agregando a anotação
        mockMvc.perform(get("/api/v1/questions/" + questionId + "/attempts/" + attemptId + "/annotations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer.attemptId").value(attemptId))
                .andExpect(jsonPath("$.origin").value("REAL_STUDY"))
                .andExpect(jsonPath("$.annotations[0].causaErro").value("CONCEITO_CONFUNDIDO"));

        // ETAPA 10: Disponibilidade da anotação para a visão consolidada de Analytics e Revisões
        Map<String, String> latestAnnotations = AttemptAnnotationView.latest(jdbcTemplate);
        assertEquals("CONCEITO_CONFUNDIDO", latestAnnotations.get(attemptId),
                "A visão materializada de anotações deve refletir a causa do erro registrada.");
    }

    @Test
    @DisplayName("Cenários de Erro e Idempotência: 404, 400 e Reenvio Seguro")
    void testErrorScenariosAndIdempotency() throws Exception {
        String nonExistentQ = "q_inexistente_999";
        String validAttemptId = UUID.randomUUID().toString();

        // 1. Tentar anotar questão inexistente -> 404 Not Found
        mockMvc.perform(post("/api/v1/questions/" + nonExistentQ + "/attempts/" + validAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "annotationId", UUID.randomUUID().toString(),
                        "causaErro", "PEGADINHA",
                        "sessionId", sessionId
                ))))
                .andExpect(status().isNotFound());

        // 2. Submeter tentativa com nível de confiança inválido (fora do intervalo 1-5) -> 400 Bad Request
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "selectedOption", "A",
                        "confidenceLevel", 9, // Inválido
                        "activeTimeMs", 1000,
                        "sessionId", sessionId
                ))))
                .andExpect(status().isBadRequest());

        // 3. Submissão idempotente (mesmo attemptId e mesmo payload repetido por retry de rede)
        String attemptPayload = objectMapper.writeValueAsString(Map.of(
                "attemptId", validAttemptId,
                "sessionId", sessionId,
                "selectedOption", "B",
                "confidenceLevel", 5,
                "activeTimeMs", 12000
        ));

        // Primeira chamada
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(attemptPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(true));

        // Reenvio do mesmo attemptId (deve responder com sucesso sem duplicar registro no banco)
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(attemptPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(true));

        Integer totalAttempts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND session_id = ?",
                Integer.class,
                sessionId
        );
        assertEquals(1, totalAttempts, "Reenvio de tentativa com mesmo attemptId e payload idêntico deve ser estritamente idempotente.");
    }

    @Test
    @DisplayName("Conflito: Reenvio de tentativa com mesmo attemptId e payload divergente deve responder 409 Conflict")
    void testReenvioComMesmoIdentificadorEPayloadDivergente() throws Exception {
        String testAttemptId = UUID.randomUUID().toString();
        String initialPayload = objectMapper.writeValueAsString(Map.of(
                "attemptId", testAttemptId,
                "sessionId", sessionId,
                "selectedOption", "B",
                "confidenceLevel", 5,
                "activeTimeMs", 10000
        ));

        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(initialPayload))
                .andExpect(status().isOk());

        // Reenvio com selectedOption divergente ("A" em vez de "B")
        String conflictingPayload = objectMapper.writeValueAsString(Map.of(
                "attemptId", testAttemptId,
                "sessionId", sessionId,
                "selectedOption", "A",
                "confidenceLevel", 5,
                "activeTimeMs", 10000
        ));

        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(conflictingPayload))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Anotação Concorrente: Idempotência com payload idêntico e 409 com payload divergente")
    void testAnotacaoConcorrenteEConflitante() throws Exception {
        String testAttemptId = UUID.randomUUID().toString();
        String attemptPayload = objectMapper.writeValueAsString(Map.of(
                "attemptId", testAttemptId,
                "sessionId", sessionId,
                "selectedOption", "A",
                "confidenceLevel", 3,
                "activeTimeMs", 15000
        ));

        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(attemptPayload))
                .andExpect(status().isOk());

        String testAnnotationId = UUID.randomUUID().toString();
        String annotationPayload = objectMapper.writeValueAsString(Map.of(
                "annotationId", testAnnotationId,
                "sessionId", sessionId,
                "causaErro", "CONCEITO_CONFUNDIDO"
        ));

        // Primeira anotação -> 200 OK
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts/" + testAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(annotationPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECORDED"));

        // Reenvio idêntico -> 200 OK (idempotente)
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts/" + testAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(annotationPayload))
                .andExpect(status().isOk());

        // Reenvio com mesmo annotationId mas causaErro divergente -> 409 Conflict
        String conflictingAnnotation = objectMapper.writeValueAsString(Map.of(
                "annotationId", testAnnotationId,
                "sessionId", sessionId,
                "causaErro", "PEGADINHA"
        ));

        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts/" + testAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(conflictingAnnotation))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Propriedade de Questão: Tentar anotar tentativa associada a outra questão retorna 409 Conflict")
    void testTentativaPertencenteAOutraQuestao() throws Exception {
        String otherQuestionId = "q_e2e_fiscal_02";
        jdbcTemplate.execute("DELETE FROM questions WHERE id = '" + otherQuestionId + "'");
        jdbcTemplate.update(
                "INSERT INTO questions (id, enunciado, options_json, correct_option, banca, ano, cargo, disciplina, assunto) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                otherQuestionId,
                "Enunciado da questão 2",
                "[\"A) Op1\", \"B) Op2\", \"C) Op3\", \"D) Op4\"]",
                "A",
                "FGV",
                2024,
                "Auditor Fiscal",
                "Contabilidade Geral",
                "Balanço"
        );

        String testAttemptId = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "attemptId", testAttemptId,
                        "sessionId", sessionId,
                        "selectedOption", "A",
                        "confidenceLevel", 3,
                        "activeTimeMs", 15000
                ))))
                .andExpect(status().isOk());

        // Tenta anotar a tentativa de questionId usando a rota de otherQuestionId
        mockMvc.perform(post("/api/v1/questions/" + otherQuestionId + "/attempts/" + testAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "annotationId", UUID.randomUUID().toString(),
                        "sessionId", sessionId,
                        "causaErro", "CONCEITO_CONFUNDIDO"
                ))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Questão sem Gabarito Válido: ANULADA retorna isCorrect=null e ponto de concurso=1")
    void testQuestaoSemGabaritoValido() throws Exception {
        String anuladaId = "q_e2e_anulada_03";
        jdbcTemplate.execute("DELETE FROM questions WHERE id = '" + anuladaId + "'");
        jdbcTemplate.update(
                "INSERT INTO questions (id, enunciado, options_json, correct_option, gabarito_status, banca, ano, cargo, disciplina, assunto) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                anuladaId,
                "Questão que foi posteriormente anulada pela banca",
                "[\"A) Op1\", \"B) Op2\", \"C) Op3\", \"D) Op4\"]",
                "B",
                "ANULADA",
                "FGV",
                2024,
                "Auditor Fiscal",
                "Contabilidade Geral",
                "Patrimônio"
        );

        mockMvc.perform(post("/api/v1/questions/" + anuladaId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "attemptId", UUID.randomUUID().toString(),
                        "sessionId", sessionId,
                        "selectedOption", "A",
                        "confidenceLevel", 2,
                        "activeTimeMs", 20000
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").doesNotExist())
                .andExpect(jsonPath("$.gabaritoStatus").value("ANULADA"))
                .andExpect(jsonPath("$.concursoPoint").value(1));
    }

    @Test
    @DisplayName("Múltiplas Anotações: Persistência independente e agregação cronológica sem mutação da resposta original")
    void testRecuperacaoCronologicaMultiplasAnotacoes() throws Exception {
        String testAttemptId = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "attemptId", testAttemptId,
                        "sessionId", sessionId,
                        "selectedOption", "A",
                        "confidenceLevel", 4,
                        "activeTimeMs", 30000
                ))))
                .andExpect(status().isOk());

        String rawOriginalAnswer = jdbcTemplate.queryForObject(
                "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND session_id = ?",
                String.class,
                sessionId
        );

        // Anotação 1: Inicial
        String ann1Id = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts/" + testAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "annotationId", ann1Id,
                        "sessionId", sessionId,
                        "causaErro", "LAPSO_INTERPRETACAO"
                ))))
                .andExpect(status().isOk());

        // Anotação 2: Refinamento posterior
        String ann2Id = UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/questions/" + questionId + "/attempts/" + testAttemptId + "/annotations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "annotationId", ann2Id,
                        "sessionId", sessionId,
                        "causaErro", "CONCEITO_CONFUNDIDO"
                ))))
                .andExpect(status().isOk());

        // Verificar histórico agregado
        mockMvc.perform(get("/api/v1/questions/" + questionId + "/attempts/" + testAttemptId + "/annotations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.annotations.length()").value(2))
                .andExpect(jsonPath("$.annotations[0].causaErro").value("LAPSO_INTERPRETACAO"))
                .andExpect(jsonPath("$.annotations[1].causaErro").value("CONCEITO_CONFUNDIDO"));

        // Confirmar imutabilidade da resposta original
        String rawAnswerAfter = jdbcTemplate.queryForObject(
                "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND session_id = ?",
                String.class,
                sessionId
        );
        assertEquals(rawOriginalAnswer, rawAnswerAfter, "O evento original ANSWER_SUBMITTED nunca pode sofrer mutação.");

        // Verificar que AttemptAnnotationView reflete a causa mais recente (última)
        Map<String, String> latestMap = AttemptAnnotationView.latest(jdbcTemplate);
        assertEquals("CONCEITO_CONFUNDIDO", latestMap.get(testAttemptId));
    }
}
