package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StrategicSimuladoService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SimuladoController.class)
class SimuladoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StrategicSimuladoService strategicSimuladoService;

    @Test
    void testGetSimuladosDashboardEndpoint() throws Exception {
        Mockito.when(strategicSimuladoService.getSimuladosDashboard(any())).thenReturn(Map.of(
                "totalTopicosEdital", 42,
                "metricas", Map.of(
                        "coberturaEditalPraticadaPct", 38.5,
                        "aproveitamentoGlobalPct", 74.2,
                        "totalSimuladosConcluidos", 3
                ),
                "simuladoRecomendado", Map.of(
                        "titulo", "Simulado Adaptativo — Foco em Pareto",
                        "estrategia", "PARETO_80_20",
                        "quantidadeSugerida", 30
                )
        ));

        mockMvc.perform(get("/api/v1/simulados/dashboard")
                        .param("concursoId", "concurso-araguari"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTopicosEdital").value(42))
                .andExpect(jsonPath("$.metricas.coberturaEditalPraticadaPct").value(38.5))
                .andExpect(jsonPath("$.simuladoRecomendado.estrategia").value("PARETO_80_20"));
    }

    @Test
    void testGenerateSimuladoEndpoint() throws Exception {
        Mockito.when(strategicSimuladoService.generateStrategicSimulado(any())).thenReturn(Map.of(
                "notebookId", "sim_12345",
                "titulo", "Simulado Estratégico Pareto (80/20)",
                "quantidade", 30,
                "questionIds", List.of("q1", "q2", "q3")
        ));

        mockMvc.perform(post("/api/v1/simulados/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"concursoId\": \"c1\", \"estrategia\": \"PARETO_80_20\", \"quantidade\": 30}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notebookId").value("sim_12345"))
                .andExpect(jsonPath("$.quantidade").value(30));
    }
}
