package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.DigitalTwinService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DigitalTwinController.class)
class DigitalTwinControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DigitalTwinService digitalTwinService;

    @Test
    void testGetDigitalTwinStatusEndpoint() throws Exception {
        Mockito.when(digitalTwinService.getDigitalTwinStatus(any(), any())).thenReturn(Map.of(
                "concursoId", "c-123",
                "totalNos", 15,
                "metaHorasAprovacao", 3100.0,
                "horasLiquidasAcumuladas", 250.0,
                "progressoMetaPct", 8.1
        ));

        mockMvc.perform(get("/api/v1/digital-twin/status")
                        .param("concursoId", "c-123")
                        .param("concursoNome", "SEFAZ-MG"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concursoId").value("c-123"))
                .andExpect(jsonPath("$.metaHorasAprovacao").value(3100.0))
                .andExpect(jsonPath("$.horasLiquidasAcumuladas").value(250.0))
                .andExpect(jsonPath("$.progressoMetaPct").value(8.1));
    }
}
