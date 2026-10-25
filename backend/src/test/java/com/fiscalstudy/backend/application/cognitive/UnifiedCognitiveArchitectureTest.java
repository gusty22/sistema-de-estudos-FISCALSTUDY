package com.fiscalstudy.backend.application.cognitive;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class UnifiedCognitiveArchitectureTest {

    @Autowired
    private UnifiedCognitiveArchitectureService cognitiveService;

    @Autowired
    private EventStoreRepository eventStoreRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM event_store");
        jdbcTemplate.update("DELETE FROM questions");

        jdbcTemplate.update("INSERT OR REPLACE INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto,peso) VALUES('cog-topic','e-cog','c-araguari-01','Direito Tributário','Imunidades Tributárias',1)");
        // Inserir questão de teste
        jdbcTemplate.update(
                "INSERT INTO questions (id, enunciado, correct_option, banca, ano, cargo, disciplina, assunto) " +
                "VALUES ('q_cog_1', 'Enunciado de teste', 'A', 'FGV', 2024, 'Auditor', 'Direito Tributário', 'Imunidades Tributárias')"
        );
    }

    @Test
    void computeUnifiedState_IntegratesAllSixComponentsConsistently() {
        // Inserir 1 tentativa normal (confiável, correta, certeza 4)
        String payloadNormal = "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q_cog_1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"confidenceLevel\":4,\"activeTimeMs\":35000,\"gabaritoStatus\":\"DEFINITIVO\",\"usedHelp\":false}";
        eventStoreRepository.appendEvent("ANSWER_SUBMITTED", "QUESTION", "q_cog_1", "sess_1", 1, "v1", payloadNormal);

        // Inserir 1 tentativa com ruído de tempo (< 1.5s) e overconfidence (certeza 5 e erro)
        String payloadOverconfident = "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q_cog_1\",\"selectedOption\":\"B\",\"isCorrect\":false,\"confidenceLevel\":5,\"activeTimeMs\":800,\"gabaritoStatus\":\"DEFINITIVO\",\"usedHelp\":false}";
        eventStoreRepository.appendEvent("ANSWER_SUBMITTED", "QUESTION", "q_cog_1", "sess_2", 1, "v1", payloadOverconfident);

        // Inserir 1 tentativa assistida (usedHelp = true)
        String payloadAssistida = "{\"origin\":\"REAL_STUDY\",\"questionId\":\"q_cog_1\",\"selectedOption\":\"A\",\"isCorrect\":true,\"confidenceLevel\":3,\"activeTimeMs\":45000,\"gabaritoStatus\":\"DEFINITIVO\",\"usedHelp\":true}";
        eventStoreRepository.appendEvent("ANSWER_SUBMITTED", "QUESTION", "q_cog_1", "sess_3", 1, "v1", payloadAssistida);

        // Computar o estado unificado
        UnifiedCognitiveStateDTO state = cognitiveService.computeUnifiedState("c-araguari-01", 120);

        assertNotNull(state);
        assertNotNull(state.getModelVersion());
        assertNotNull(state.getAuditHash());

        // 1. Registro de Eventos
        assertNotNull(state.getEventStoreSummary());
        assertEquals(3, state.getEventStoreSummary().getTotalAttempts());
        assertTrue(state.getEventStoreSummary().isAppendOnlyProtected());

        // 4. Monitor de Anomalias
        assertNotNull(state.getAnomalyReport());
        assertEquals(3, state.getAnomalyReport().getTotalEvidenciasAnalisadas());
        assertEquals(1, state.getAnomalyReport().getEvidenciasRuidoTempoCount(), "Tentativa com tempo < 1500ms deve ser classificada como ruído de tempo");
        assertEquals(1, state.getAnomalyReport().getEvidenciasAssistidasCount(), "Tentativa com usedHelp=true deve ser classificada como assistida");
        assertTrue(state.getAnomalyReport().getPesoMedioConfiabilidade() > 0.0 && state.getAnomalyReport().getPesoMedioConfiabilidade() <= 1.0);

        // 3. Calibração Metacognitiva
        assertNotNull(state.getMetacognition());
        assertTrue(state.getMetacognition().getBrierScore() >= 0.0);
        assertEquals(1, state.getMetacognition().getOverconfidenceCount(), "Deve acusar 1 caso de Certeza 5 e Erro");

        // 2. Modelo de Conhecimento
        assertNotNull(state.getKnowledgeModel());
        assertFalse(state.getKnowledgeModel().isEmpty());
        UnifiedCognitiveStateDTO.TopicKnowledgeEstimate imunidades = state.getKnowledgeModel().stream()
                .filter(t -> "Imunidades Tributárias".equalsIgnoreCase(t.getAssunto()))
                .findFirst()
                .orElse(null);
        assertNotNull(imunidades);
        assertTrue(imunidades.getEvidenciasValidasCount() > 0);
        assertTrue(imunidades.getIncertezaSigma() > 0.0 && imunidades.getIncertezaSigma() < 1.0);

        // 5. Motor de Intervenções
        assertNotNull(state.getActiveInterventions());

        // 6. Planejador Adaptativo
        assertNotNull(state.getAdaptivePlan());
        assertEquals(120, state.getAdaptivePlan().getTempoDisponivelMinutos());
        assertNotNull(state.getAdaptivePlan().getJustificativaAuditavel());
        assertFalse(state.getAdaptivePlan().getBlocos().isEmpty());
    }
}
