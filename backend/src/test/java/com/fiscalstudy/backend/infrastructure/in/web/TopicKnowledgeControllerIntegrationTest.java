package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.FiscalStudyApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = FiscalStudyApplication.class)
@AutoConfigureMockMvc
public class TopicKnowledgeControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/v1/knowledge/epistemic-contract deve retornar princípios científicos e limites epistêmicos")
    void testGetEpistemicContract() throws Exception {
        mockMvc.perform(get("/api/v1/knowledge/epistemic-contract")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version", is("2.0-scientific-refinement")))
                .andExpect(jsonPath("$.epistemicPrinciples", hasSize(greaterThanOrEqualTo(5))))
                .andExpect(jsonPath("$.observableIndicators", hasItem("accuracyDenominatorText")))
                .andExpect(jsonPath("$.observableIndicators", hasItem("avgConfidenceOrdinal")))
                .andExpect(jsonPath("$.observableIndicators", hasItem("highConfidenceErrors")));
    }

    @Test
    @DisplayName("POST /api/v1/knowledge/rebuild e GET /api/v1/knowledge/topics devem funcionar deterministicamente")
    void testRebuildAndListTopics() throws Exception {
        mockMvc.perform(post("/api/v1/knowledge/rebuild")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topicsProcessed", greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.completedAt", notNullValue()));

        mockMvc.perform(get("/api/v1/knowledge/topics")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }
}
