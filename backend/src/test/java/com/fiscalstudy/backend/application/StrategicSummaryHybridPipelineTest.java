package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class StrategicSummaryHybridPipelineTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EventStoreRepository eventStoreRepository;

    @Autowired
    private AnkiIntegrationService ankiIntegrationService;

    private StrategicSummaryService service;

    @BeforeEach
    void setUp() {
        service = new StrategicSummaryService(jdbcTemplate, eventStoreRepository, ankiIntegrationService);
    }

    @Test
    @DisplayName("Deve resolver domínios epistêmicos com estrito isolamento por disciplina")
    void testResolveDomainIsolation() {
        assertEquals(StrategicSummaryService.KnowledgeDomain.CONTABILIDADE,
                service.resolveDomain("Contabilidade Geral"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.CONTABILIDADE,
                service.resolveDomain("Contabilidade Avançada e CPCs"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.CONTABILIDADE,
                service.resolveDomain("Contabilidade de Custos"));

        assertEquals(StrategicSummaryService.KnowledgeDomain.DIREITO_PENAL,
                service.resolveDomain("Direito Penal"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.DIREITO_PENAL,
                service.resolveDomain("Direito Processual Penal e Criminologia"));

        assertEquals(StrategicSummaryService.KnowledgeDomain.DIREITO_TRIBUTARIO,
                service.resolveDomain("Direito Tributário"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.DIREITO_TRIBUTARIO,
                service.resolveDomain("Legislação Tributária Municipal"));

        assertEquals(StrategicSummaryService.KnowledgeDomain.DIREITO_ADMINISTRATIVO,
                service.resolveDomain("Direito Administrativo"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.DIREITO_CONSTITUCIONAL,
                service.resolveDomain("Direito Constitucional"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.AUDITORIA,
                service.resolveDomain("Auditoria Governamental e Fiscal"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.TI_EXATAS,
                service.resolveDomain("Tecnologia da Informação e Banco de Dados"));
        assertEquals(StrategicSummaryService.KnowledgeDomain.PORTUGUES,
                service.resolveDomain("Língua Portuguesa"));
    }

    @Test
    @DisplayName("Pipeline Híbrido: Resumo de Contabilidade NÃO pode conter jargões de Direito Penal")
    void testContabilidadeSummaryMustNotContainPenalConcepts() {
        Map<String, Object> req = Map.of(
                "concursoId", "concurso-teste-fiscal",
                "disciplina", "Contabilidade Geral",
                "topico", "Demonstração dos Fluxos de Caixa (CPC 03)",
                "banca", "FGV",
                "materialOrigemNome", "Contabilidade para Auditores Fiscais",
                "materialPaginas", "Páginas 210 a 245"
        );

        Map<String, Object> summary = service.generateSummary(req);
        assertNotNull(summary);
        String summaryId = (String) summary.get("id");
        assertNotNull(summaryId);

        Optional<Map<String, Object>> fetchedOpt = service.getSummaryById(summaryId);
        assertTrue(fetchedOpt.isPresent());
        Map<String, Object> s = fetchedOpt.get();

        String resumoMarkdown = (String) s.get("resumo_markdown");
        String retaFinal = (String) s.get("resumo_reta_final_markdown");

        // 1. Verificação de Blindagem Epistêmica (Zero jargões penais em Contabilidade)
        assertFalse(resumoMarkdown.toLowerCase().contains("tipicidade cerrada"),
                "Resumo contábil NÃO pode conter 'tipicidade cerrada'");
        assertFalse(resumoMarkdown.toLowerCase().contains("analogia in malam partem"),
                "Resumo contábil NÃO pode conter 'analogia in malam partem'");
        assertFalse(resumoMarkdown.toLowerCase().contains("fato típico"),
                "Resumo contábil NÃO pode conter 'fato típico'");
        assertFalse(resumoMarkdown.toLowerCase().contains("excludente de ilicitude"),
                "Resumo contábil NÃO pode conter 'excludente de ilicitude'");

        assertFalse(retaFinal.toLowerCase().contains("tipicidade cerrada"),
                "Reta final de Contabilidade NÃO pode conter 'tipicidade cerrada'");
        assertFalse(retaFinal.toLowerCase().contains("analogia in malam partem"),
                "Reta final de Contabilidade NÃO pode conter 'analogia in malam partem'");

        // 2. Verificação de Vocabulário Autêntico de Contabilidade
        assertTrue(resumoMarkdown.contains("CPC 03") || resumoMarkdown.contains("Contábil") || resumoMarkdown.contains("Partidas Dobradas"));
        assertTrue(retaFinal.contains("CPC 03") || retaFinal.contains("Investimento") || retaFinal.contains("Depreciação"));

        // 3. Verificação de Metadados do Pipeline Híbrido
        @SuppressWarnings("unchecked")
        Map<String, Object> stats = (Map<String, Object>) s.get("estatisticasBase");
        assertNotNull(stats);
        assertEquals(Boolean.TRUE, stats.get("pipelineHibrido"));
        assertEquals("CONTABILIDADE", stats.get("dominioEpistemico"));
        assertEquals("FGV", stats.get("bancaAlvo"));
        assertEquals("Contabilidade para Auditores Fiscais", stats.get("materialVinculado"));
        assertEquals("Páginas 210 a 245", stats.get("paginasVinculadas"));

        // 4. Verificação dos Flashcards e Fichas
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> flashcards = (List<Map<String, Object>>) s.get("flashcards");
        assertNotNull(flashcards);
        assertFalse(flashcards.isEmpty());
        for (Map<String, Object> fc : flashcards) {
            String frente = (String) fc.get("frente");
            String verso = (String) fc.get("verso");
            assertFalse(frente.toLowerCase().contains("analogia in malam partem"));
            assertFalse(verso.toLowerCase().contains("analogia in malam partem"));
        }
    }
}
