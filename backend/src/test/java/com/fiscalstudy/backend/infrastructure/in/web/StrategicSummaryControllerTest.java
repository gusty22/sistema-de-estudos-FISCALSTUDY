package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StrategicSummaryService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StrategicSummaryController.class)
class StrategicSummaryControllerTest {

    @MockBean
    private com.fiscalstudy.backend.application.QuarantineSourceExposureService quarantineSourceExposureService;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StrategicSummaryService strategicSummaryService;

    @Test
    void testGetSummariesEndpoint() throws Exception {
        Mockito.when(strategicSummaryService.getSummaries(any(), any(), any())).thenReturn(List.of(
                Map.of(
                        "id", "sum_123",
                        "disciplina", "Direito Tributário",
                        "topico", "Imunidades e Isenções Tributárias",
                        "nivel_relevancia", "ESSENCIAL"
                )
        ));

        mockMvc.perform(get("/api/v1/summaries")
                        .param("concursoId", "concurso-araguari"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("sum_123"))
                .andExpect(jsonPath("$[0].topico").value("Imunidades e Isenções Tributárias"))
                .andExpect(jsonPath("$[0].nivel_relevancia").value("ESSENCIAL"));
    }

    @Test
    void testGetSummaryByIdEndpoint() throws Exception {
        Mockito.when(strategicSummaryService.getSummaryById("sum_123")).thenReturn(Optional.of(
                Map.of(
                        "id", "sum_123",
                        "disciplina", "Direito Tributário",
                        "topico", "Imunidades e Isenções Tributárias",
                        "nivel_relevancia", "ESSENCIAL",
                        "resumo_markdown", "# Resumo de Imunidades"
                )
        ));

        mockMvc.perform(get("/api/v1/summaries/sum_123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("sum_123"))
                .andExpect(jsonPath("$.resumo_markdown").value("# Resumo de Imunidades"));
    }

    @Test
    void testGenerateSummaryEndpoint() throws Exception {
        Mockito.when(strategicSummaryService.generateSummary(any())).thenReturn(Map.of(
                "id", "sum_gen_456",
                "topico", "CPC 03 - Fluxo de Caixa",
                "nivel_relevancia", "ALTA"
        ));

        mockMvc.perform(post("/api/v1/summaries/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "concursoId": "concurso-araguari",
                                "disciplina": "Contabilidade",
                                "topico": "CPC 03 - Fluxo de Caixa"
                            }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("sum_gen_456"))
                .andExpect(jsonPath("$.nivel_relevancia").value("ALTA"));
    }

    @Test
    void testSendToAnkiEndpoint() throws Exception {
        Mockito.when(strategicSummaryService.sendFlashcardsToAnki("sum_123")).thenReturn(5);

        mockMvc.perform(post("/api/v1/summaries/sum_123/send-to-anki"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.cardsInjected").value(5));
    }
}
