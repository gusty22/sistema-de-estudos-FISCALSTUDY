package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.RobinHoodCycleService;
import com.fiscalstudy.backend.application.SwotCycleCalibratorService;
import com.fiscalstudy.backend.domain.cycle.RobinHoodCycleResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RobinHoodCycleController.class)
class RobinHoodCycleControllerTest {

    @MockBean
    private com.fiscalstudy.backend.application.QuarantineSourceExposureService quarantineSourceExposureService;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RobinHoodCycleService robinHoodCycleService;

    @MockBean
    private SwotCycleCalibratorService swotCycleCalibratorService;

    @Test
    @DisplayName("GET /api/v1/cycle/robin-hood retorna ciclo gerado")
    void testGetRobinHoodCycle() throws Exception {
        Mockito.when(robinHoodCycleService.getOrGenerateCycle(any(), any(), any())).thenReturn(
                new RobinHoodCycleResult("c1", 24.0, 60, Collections.emptyList(), 0, false, Map.of("status", "OK"))
        );

        mockMvc.perform(get("/api/v1/cycle/robin-hood")
                        .param("concursoId", "c1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concursoId").value("c1"))
                .andExpect(jsonPath("$.horasSemanaisDisponiveis").value(24.0));
    }

    @Test
    @DisplayName("POST /api/v1/cycle/recalibrate-swot executa recalibração pós-simulado")
    void testRecalibrateFromSwot() throws Exception {
        SwotCycleCalibratorService.SwotCalibrationResult mockResult = new SwotCycleCalibratorService.SwotCalibrationResult(
                "calib_123",
                "c1",
                "sim_01",
                "2026-10-19T20:00:00",
                18.0,
                24.0,
                1.5,
                List.of("Direito Administrativo"),
                List.of("Direito Tributário"),
                Collections.emptyList(),
                Collections.emptyList(),
                "Transferência de 1.5h executada"
        );

        Mockito.when(swotCycleCalibratorService.recalibrateFromSimulado(eq("c1"), any())).thenReturn(mockResult);

        mockMvc.perform(post("/api/v1/cycle/recalibrate-swot")
                        .param("concursoId", "c1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taxaRouboPct\": 18.0, \"weeklyHours\": 24.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calibrationId").value("calib_123"))
                .andExpect(jsonPath("$.taxaRouboAplicadaPct").value(18.0))
                .andExpect(jsonPath("$.materiasDoadoras[0]").value("Direito Administrativo"))
                .andExpect(jsonPath("$.materiasReceptoras[0]").value("Direito Tributário"));
    }

    @Test
    @DisplayName("GET /api/v1/cycle/latest-swot-calibration retorna status da última calibração")
    void testGetLatestSwotCalibration() throws Exception {
        Mockito.when(swotCycleCalibratorService.getLatestSwotCalibration(eq("c1"))).thenReturn(
                Map.of("id", "calib_123", "horas_roubadas_total", 1.5)
        );

        mockMvc.perform(get("/api/v1/cycle/latest-swot-calibration")
                        .param("concursoId", "c1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("calib_123"))
                .andExpect(jsonPath("$.horas_roubadas_total").value(1.5));
    }
}
