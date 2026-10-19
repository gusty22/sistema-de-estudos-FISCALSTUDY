package com.fiscalstudy.backend.application.review;

import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveArchitectureService;
import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveStateDTO;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class AdaptiveReviewDecisionEngineTest {

    private UnifiedCognitiveArchitectureService cognitiveService;
    private EventStoreRepository eventStoreRepository;
    private JdbcTemplate jdbcTemplate;
    private AdaptiveReviewDecisionEngine engine;

    @BeforeEach
    void setUp() {
        cognitiveService = Mockito.mock(UnifiedCognitiveArchitectureService.class);
        eventStoreRepository = Mockito.mock(EventStoreRepository.class);
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        engine = new AdaptiveReviewDecisionEngine(cognitiveService, eventStoreRepository, jdbcTemplate);
    }

    @Test
    @DisplayName("Deve replicar a tomada de decisão adaptativa dos 3 cenários: Morfologia, Concordância e Regência")
    void testAdaptiveDecisionsTriad() {
        // Mock do estado cognitivo com os 3 tópicos do exemplo conceitual
        UnifiedCognitiveStateDTO mockState = new UnifiedCognitiveStateDTO();
        List<UnifiedCognitiveStateDTO.TopicKnowledgeEstimate> list = new ArrayList<>();

        // 1. Morfologia: Domínio Alto (85%), Recuperabilidade Alta (88%), Importância Média (peso 1.8)
        UnifiedCognitiveStateDTO.TopicKnowledgeEstimate morfologia = new UnifiedCognitiveStateDTO.TopicKnowledgeEstimate();
        morfologia.setTopicId("top-morfologia");
        morfologia.setDisciplina("Língua Portuguesa");
        morfologia.setAssunto("Morfologia");
        morfologia.setDominioEstimadoPct(85.0);
        morfologia.setRetencaoAtualPct(88.0);
        morfologia.setIncertezaSigma(0.25);
        morfologia.setPesoEdital(1.8);
        morfologia.setEvidenciasValidasCount(8);
        list.add(morfologia);

        // 2. Concordância Verbal: Domínio Médio (58%), Recuperabilidade Baixa (52%), Importância Alta (peso 3.0)
        UnifiedCognitiveStateDTO.TopicKnowledgeEstimate concordancia = new UnifiedCognitiveStateDTO.TopicKnowledgeEstimate();
        concordancia.setTopicId("top-concordancia");
        concordancia.setDisciplina("Língua Portuguesa");
        concordancia.setAssunto("Concordância Verbal");
        concordancia.setDominioEstimadoPct(58.0);
        concordancia.setRetencaoAtualPct(52.0);
        concordancia.setIncertezaSigma(0.35);
        concordancia.setPesoEdital(3.0);
        concordancia.setEvidenciasValidasCount(5);
        list.add(concordancia);

        // 3. Regência: Domínio Baixo (20%), Recuperabilidade Incerta (0%), Incerteza Alta (σ = 0.95, N=0), Importância Alta (peso 2.8)
        UnifiedCognitiveStateDTO.TopicKnowledgeEstimate regencia = new UnifiedCognitiveStateDTO.TopicKnowledgeEstimate();
        regencia.setTopicId("top-regencia");
        regencia.setDisciplina("Língua Portuguesa");
        regencia.setAssunto("Regência Verbal e Nominal");
        regencia.setDominioEstimadoPct(20.0);
        regencia.setRetencaoAtualPct(0.0);
        regencia.setIncertezaSigma(0.95);
        regencia.setPesoEdital(2.8);
        regencia.setEvidenciasValidasCount(0);
        list.add(regencia);

        mockState.setKnowledgeModel(list);
        when(cognitiveService.computeUnifiedState(any(), anyInt())).thenReturn(mockState);

        AdaptiveRevisionDecisionDTO result = engine.evaluateDecisions("concurso-teste", 60);

        assertNotNull(result);
        assertEquals(3, result.getDecisoes().size());

        // Aferir Morfologia -> ADIAR_REVISAO
        AdaptiveRevisionDecisionDTO.TopicRevisionDecision decMorfologia = result.getDecisoes().stream()
                .filter(d -> "top-morfologia".equals(d.getTopicId())).findFirst().orElseThrow();
        assertEquals("ADIAR_REVISAO", decMorfologia.getDecisao());
        assertEquals(0, decMorfologia.getDuracaoSugeridaMinutos());

        // Aferir Concordância -> PRIORIZAR_REVISAO_ATIVA
        AdaptiveRevisionDecisionDTO.TopicRevisionDecision decConcordancia = result.getDecisoes().stream()
                .filter(d -> "top-concordancia".equals(d.getTopicId())).findFirst().orElseThrow();
        assertEquals("PRIORIZAR_REVISAO_ATIVA", decConcordancia.getDecisao());
        assertTrue(decConcordancia.getDuracaoSugeridaMinutos() > 0);

        // Aferir Regência -> DIAGNOSTICO_DIRECIONADO (Active Information Gathering)
        AdaptiveRevisionDecisionDTO.TopicRevisionDecision decRegencia = result.getDecisoes().stream()
                .filter(d -> "top-regencia".equals(d.getTopicId())).findFirst().orElseThrow();
        assertEquals("DIAGNOSTICO_DIRECIONADO", decRegencia.getDecisao());
        assertTrue(decRegencia.isActiveInformationGathering());
        assertTrue(decRegencia.getJustificativa().contains("não inventa probabilidades"));

        // Aferir Estatísticas Globais
        assertEquals(1, result.getEstatisticas().getAdiadasCount());
        assertEquals(1, result.getEstatisticas().getAtivasPrioritariasCount());
        assertEquals(1, result.getEstatisticas().getDiagnosticosCount());
    }

    @Test
    @DisplayName("Falha em revisão após intervalo longo (Δt >= 14 dias) deve diagnosticar ACESSIBILIDADE_TEMPORAL e NÃO zerar domínio")
    void testReviewFailureLongInterval() {
        ReviewFailureRequestDTO req = new ReviewFailureRequestDTO();
        req.setQuestionId("q-long");
        req.setDisciplina("Direito Tributário");
        req.setTopico("Decadência");
        req.setDiasDesdeUltimaTentativa(22.0);
        req.setDominioAnteriorPct(80.0);
        req.setConfidenceLevel(3);

        ReviewFailureDiagnosisDTO diag = engine.handleReviewFailure(req);

        assertNotNull(diag);
        assertFalse(diag.isDominioZerado(), "Domínio NUNCA pode ser zerado por regra inegociável");
        assertEquals("ACESSIBILIDADE_TEMPORAL", diag.getTipoFalha());
        assertEquals("MICRO_REATIVACAO_ESPACADA", diag.getIntervencaoPrescrita());
        assertTrue(diag.getNovoDominioAjustadoPct() > 0.0);
        assertTrue(diag.getNovoDominioAjustadoPct() < 80.0);
    }

    @Test
    @DisplayName("Falha logo após explicação (Δt <= 2 dias) deve diagnosticar COMPREENSAO_ESTRUTURAL e prescrever Feynman")
    void testReviewFailureShortInterval() {
        ReviewFailureRequestDTO req = new ReviewFailureRequestDTO();
        req.setQuestionId("q-short");
        req.setDisciplina("Contabilidade Geral");
        req.setTopico("DFC Método Indireto");
        req.setDiasDesdeUltimaTentativa(1.0);
        req.setDominioAnteriorPct(60.0);
        req.setConfidenceLevel(2);
        req.setIsQuestionInedita(false);

        ReviewFailureDiagnosisDTO diag = engine.handleReviewFailure(req);

        assertNotNull(diag);
        assertFalse(diag.isDominioZerado());
        assertEquals("COMPREENSAO_ESTRUTURAL", diag.getTipoFalha());
        assertEquals("DESCONSTRUCAO_FEYNMAN", diag.getIntervencaoPrescrita());
    }

    @Test
    @DisplayName("Falha com confiança máxima (5/5) deve diagnosticar OVERCONFIDENCE_PEGADINHA")
    void testReviewFailureOverconfidence() {
        ReviewFailureRequestDTO req = new ReviewFailureRequestDTO();
        req.setQuestionId("q-overconf");
        req.setDisciplina("Legislação Tributária Municipal");
        req.setTopico("ISS - Local da Prestação e Exceções");
        req.setDiasDesdeUltimaTentativa(6.0);
        req.setDominioAnteriorPct(75.0);
        req.setConfidenceLevel(5); // Certeza Absoluta

        ReviewFailureDiagnosisDTO diag = engine.handleReviewFailure(req);

        assertNotNull(diag);
        assertFalse(diag.isDominioZerado());
        assertEquals("OVERCONFIDENCE_PEGADINHA", diag.getTipoFalha());
        assertEquals("AUDITORIA_PEGADINHA_ARMADILHA", diag.getIntervencaoPrescrita());
    }
}
