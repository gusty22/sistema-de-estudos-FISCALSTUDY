package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StrategicSimuladoService;
import com.fiscalstudy.backend.domain.Concurso;
import com.fiscalstudy.backend.domain.ConcursoRepository;
import com.fiscalstudy.backend.domain.Edital;
import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("default")
public class EditalSingleRepositoryIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EditalRepository editalRepository;

    @Autowired
    private ConcursoRepository concursoRepository;

    @Autowired
    private StrategicSimuladoService strategicSimuladoService;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private String testConcursoId;
    private String testEditalId;

    @BeforeEach
    void setUp() {
        testConcursoId = "test-concurso-repo-" + UUID.randomUUID().toString().substring(0, 8);
        testEditalId = "test-edital-" + UUID.randomUUID().toString().substring(0, 8);

        Concurso concurso = new Concurso();
        concurso.setId(testConcursoId);
        concurso.setNome("Auditor Fiscal de Teste Repositório Único");
        concurso.setOrgao("SEFAZ Teste");
        concurso.setStatus("ACTIVE");
        concursoRepository.save(concurso);

        Edital edital = new Edital(testEditalId, testConcursoId, "Edital Verticalizado de Teste", "1.0", "ORIGINAL", "edital_teste.pdf");
        editalRepository.saveEdital(edital);

        // Insere tópicos do edital verticalizado
        EditalTopico t1 = new EditalTopico(
                "top-1-" + UUID.randomUUID().toString().substring(0, 8),
                testEditalId, testConcursoId, "Direito Tributário", "Crédito Tributário", "Suspensão",
                3.0, 5, "edital_teste.pdf", 1, "Art. 151 CTN", "CONFIRMADA", true
        );
        EditalTopico t2 = new EditalTopico(
                "top-2-" + UUID.randomUUID().toString().substring(0, 8),
                testEditalId, testConcursoId, "Contabilidade Geral", "Balancete de Verificação", null,
                2.5, 3, "edital_teste.pdf", 2, "Estrutura", "CONFIRMADA", true
        );
        EditalTopico t3 = new EditalTopico(
                "top-3-" + UUID.randomUUID().toString().substring(0, 8),
                testEditalId, testConcursoId, "Legislação Tributária", "ICMS", "Incidência",
                2.0, 4, "edital_teste.pdf", 3, "LC 87/96", "CONFIRMADA", true
        );

        editalRepository.saveTopico(t1);
        editalRepository.saveTopico(t2);
        editalRepository.saveTopico(t3);
    }

    @Test
    @DisplayName("G1 — Simulados e Pareto leem do mesmo repositório do Edital Verticalizado e totalTopicosEdital > 0")
    void testSimuladosReadsFromEditalVerticalizado() throws Exception {
        mockMvc.perform(get("/api/v1/simulados/dashboard")
                        .param("concursoId", testConcursoId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTopicosEdital", greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$.topicosPriorizados", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.topicosPriorizados[0].disciplina", notNullValue()))
                .andExpect(jsonPath("$.topicosPriorizados[0].topico", notNullValue()));

        Map<String, Object> dashboard = strategicSimuladoService.getSimuladosDashboard(testConcursoId);
        int totalTopicos = ((Number) dashboard.get("totalTopicosEdital")).intValue();
        assertTrue(totalTopicos >= 3, "Simulados deve reportar pelo menos 3 tópicos do edital cadastrado!");
    }

    @Test
    @DisplayName("G2 — Endpoint centralizado /api/v1/edital/topicos retorna os tópicos do repositório único")
    void testGlobalEditalTopicsEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/edital/topicos")
                        .param("concursoId", testConcursoId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTopicos", greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$.topicos", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$.topicos[0].disciplina", notNullValue()));
    }

    @Test
    @DisplayName("G3 — Ciclo Robin Hood lê disciplinas e tópicos do repositório sem erro de 0 disciplinas")
    void testRobinHoodCycleReadsFromEditalRepository() throws Exception {
        mockMvc.perform(get("/api/v1/cycle/robin-hood")
                        .param("concursoId", testConcursoId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocos", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    @DisplayName("G4 — Fallback de repositório único funciona mesmo sem parâmetro concursoId")
    void testFallbackWhenConcursoIdNotSpecified() throws Exception {
        mockMvc.perform(get("/api/v1/simulados/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTopicosEdital", greaterThan(0)));

        mockMvc.perform(get("/api/v1/cycle/robin-hood"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocos", hasSize(greaterThan(0))));
    }
}
