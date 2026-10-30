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
@SpringBootTest(properties={"fiscalstudy.event-origin=REAL_STUDY","fiscalstudy.anki.network-allowed=false"})
@AutoConfigureMockMvc
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class StudySessionTransactionIntegrationTest {
    private static final Path DATA=Path.of("target","session-transaction-"+UUID.randomUUID()).toAbsolutePath();
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

    @Test void eventFailureAndLostAcknowledgmentRecoverThroughHttp() throws Exception {
        jdbc.update("INSERT INTO study_materials(id,titulo,disciplina,total_paginas,pagina_atual) VALUES('m','Synthetic','Math',100,0)");
        var request=java.util.Map.of("sessionId","session-transaction","materialId","m","paginasLidas",5,"durationSeconds",30);
        String body=json.writeValueAsString(request);
        jdbc.execute("CREATE TRIGGER fail_session BEFORE INSERT ON event_store WHEN NEW.event_type='STUDY_SESSION_RECORDED' BEGIN SELECT RAISE(ABORT,'injected'); END");
        mvc.perform(post("/api/v1/study-sessions/record").contentType("application/json").content(body)).andExpect(status().is5xxServerError());
        assertEquals(0,jdbc.queryForObject("SELECT pagina_atual FROM study_materials WHERE id='m'",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM study_session_recordings",Integer.class));
        jdbc.execute("DROP TRIGGER fail_session");
        for(int i=0;i<2;i++) mvc.perform(post("/api/v1/study-sessions/record").contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RECORDED"));
        assertEquals(5,jdbc.queryForObject("SELECT pagina_atual FROM study_materials WHERE id='m'",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM event_store WHERE event_type='STUDY_SESSION_RECORDED'",Integer.class));
    }
}
