package com.fiscalstudy.backend.infrastructure.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IngestionController.class)
public class IngestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JdbcTemplate jdbcTemplate;

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
}
