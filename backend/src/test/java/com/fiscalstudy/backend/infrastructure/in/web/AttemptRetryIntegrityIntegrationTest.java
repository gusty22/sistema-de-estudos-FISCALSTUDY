package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Full Spring wiring, real repositories and migrations; synthetic instance with external sync disabled. */
@SpringBootTest(properties={"fiscalstudy.event-origin=AUTOMATED_TEST","fiscalstudy.anki.network-allowed=false"})
@AutoConfigureMockMvc
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class AttemptRetryIntegrityIntegrationTest {
    private static final Path DATA=Path.of("target","attempt-retry-"+UUID.randomUUID()).toAbsolutePath();
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",()->"jdbc:sqlite:"+DATA.resolve("main.db"));
        registry.add("fiscalstudy.data-dir",DATA::toString);
        registry.add("fiscalstudy.staging-db",()->DATA.resolve("staging.db").toString());
        registry.add("fiscalstudy.acervo-root",()->DATA.resolve("materials").toString());
        registry.add("fiscalstudy.analytics-dir",()->DATA.resolve("analytics").toString());
    }
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    @Test void acknowledgmentLossReplaysButChangedHelpEvidenceConflicts() throws Exception {
        jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option,gabarito_status,disciplina,status) VALUES(?,?,?,?,?,?,?)",
                "retry-q","Synthetic question","[\"A yes\",\"B no\"]","A","DEFINITIVO","Math","VALIDADA");
        String id=UUID.randomUUID().toString();
        var request=new LinkedHashMap<String,Object>();
        request.put("attemptId",id);request.put("sessionId","test-retry");request.put("selectedOption","A");
        request.put("confidenceLevel",4);request.put("activeTimeMs",1200);
        String body=json.writeValueAsString(request);
        for(int i=0;i<2;i++) mvc.perform(post("/api/v1/questions/retry-q/attempts").contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.attemptId").value(id)).andExpect(jsonPath("$.isCorrect").value(true));
        String payload=jdbc.queryForObject("SELECT payload_json FROM event_store WHERE event_id=?",String.class,"attempt:"+id);
        request.put("usedHelp",false);
        mvc.perform(post("/api/v1/questions/retry-q/attempts").contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isConflict());
        assertEquals(payload,jdbc.queryForObject("SELECT payload_json FROM event_store WHERE event_id=?",String.class,"attempt:"+id));
        assertFalse(json.readTree(payload).path("helpDeclarationProvided").asBoolean());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type='ANSWER_SUBMITTED'",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));
    }
}
