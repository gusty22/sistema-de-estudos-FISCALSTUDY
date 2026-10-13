package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.IngestionPipelineService;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IngestionController.class)
public class IngestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private IngestionPipelineService pipelineService;

    @Test
    public void testImportDataReturns200() throws Exception {
        String jsonPayload = "{\"version\":\"v1\",\"source\":\"test\",\"data\":{}}";

        mockMvc.perform(post("/api/v1/ingestion/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isOk());
    }

    @Test
    public void testImportDataWithQuestionsReturns200() throws Exception {
        String jsonPayload = "{\"version\":\"v1\",\"source\":\"test\",\"data\":{\"metadata\":{\"banca\":\"IBGP\",\"ano\":2023,\"cargo\":\"Técnico Fiscal\"},\"questions\":[{\"id\":1,\"statement\":\"Qual a capital?\",\"options\":[\"A) BH\",\"B) SP\"],\"correct_option\":\"A\",\"disciplina\":\"Português\"}]}}";

        mockMvc.perform(post("/api/v1/ingestion/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isOk());
    }

    @Test
    public void testCreateSessionReturns200() throws Exception {
        StagingSessionDTO session = new StagingSessionDTO("sess-123", "PENDING", "Criada");
        when(pipelineService.createSession(any())).thenReturn(session);

        mockMvc.perform(post("/api/v1/ingestion/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"banca\":\"IBGP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("sess-123"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    public void testUploadDocumentReturns200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "prova.pdf", "application/pdf", "dummy content".getBytes());
        StagingSessionDTO.StagingDocumentDTO doc = new StagingSessionDTO.StagingDocumentDTO("doc-1", "prova.pdf", "PROVA", 13, "PDF");
        when(pipelineService.uploadFile(eq("sess-123"), any(), eq("PROVA"))).thenReturn(doc);

        mockMvc.perform(multipart("/api/v1/ingestion/sessions/sess-123/upload")
                .file(file)
                .param("role", "PROVA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.originalFilename").value("prova.pdf"))
                .andExpect(jsonPath("$.role").value("PROVA"));
    }

    @Test
    public void testGetSessionQuestionsReturns200() throws Exception {
        StagingQuestionDTO q = new StagingQuestionDTO();
        q.setId("q15");
        q.setNumeroOriginal(15);
        q.setStatement("Quantidade de anagramas de ARAGUARI");
        q.setOptions(List.of("A) 256", "B) 280", "C) 336", "D) 560"));
        q.setStatus("NEEDS_REVIEW");
        q.setFlags(List.of("MATH_DIVERGENCE_SUSPECTED"));

        when(pipelineService.getSessionQuestions("sess-123")).thenReturn(List.of(q));

        mockMvc.perform(get("/api/v1/ingestion/sessions/sess-123/questions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("q15"))
                .andExpect(jsonPath("$[0].numeroOriginal").value(15))
                .andExpect(jsonPath("$[0].status").value("NEEDS_REVIEW"))
                .andExpect(jsonPath("$[0].flags[0]").value("MATH_DIVERGENCE_SUSPECTED"));
    }

    @Test
    public void testUpdateQuestionReturns200() throws Exception {
        StagingQuestionDTO updated = new StagingQuestionDTO();
        updated.setId("q15");
        updated.setStatus("SOURCE_VERIFIED");
        updated.setModifiedByUser(true);

        when(pipelineService.updateQuestion(eq("sess-123"), eq("q15"), any())).thenReturn(updated);

        mockMvc.perform(put("/api/v1/ingestion/sessions/sess-123/questions/q15")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"SOURCE_VERIFIED\",\"statement\":\"Corrigido\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SOURCE_VERIFIED"))
                .andExpect(jsonPath("$.modifiedByUser").value(true));
    }

    @Test
    public void testSimulateImportReturns200() throws Exception {
        ImportSimulationDTO sim = new ImportSimulationDTO();
        sim.setMode("TEST_MODE_DRY_RUN");
        sim.setTotalStagingQuestions(40);
        sim.setVerifiedReadyToImport(35);
        sim.setSafeToImport(true);

        when(pipelineService.simulateImport("sess-123")).thenReturn(sim);

        mockMvc.perform(post("/api/v1/ingestion/sessions/sess-123/simulate-import"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("TEST_MODE_DRY_RUN"))
                .andExpect(jsonPath("$.verifiedReadyToImport").value(35))
                .andExpect(jsonPath("$.safeToImport").value(true));
    }

    @Test
    public void testCancelProcessingReturns200WithCancelledStatus() throws Exception {
        StagingSessionDTO cancelled = new StagingSessionDTO("sess-123", "CANCELLED", "Processamento cancelado pelo usuário.");
        when(pipelineService.cancelSession("sess-123")).thenReturn(cancelled);

        mockMvc.perform(post("/api/v1/ingestion/sessions/sess-123/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.stepDescription").value("Processamento cancelado pelo usuário."));
    }

    @Test
    public void testUploadEmptyFileReturns400WithStructuredJson() throws Exception {
        when(pipelineService.uploadFile(eq("sess-123"), any(), any()))
                .thenThrow(new IllegalArgumentException("Arquivo vazio não é permitido."));

        MockMultipartFile emptyFile = new MockMultipartFile("file", "vazio.pdf", "application/pdf", new byte[0]);

        mockMvc.perform(multipart("/api/v1/ingestion/sessions/sess-123/upload")
                .file(emptyFile)
                .param("role", "PROVA"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Arquivo vazio não é permitido."))
                .andExpect(jsonPath("$.executionId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }
}
