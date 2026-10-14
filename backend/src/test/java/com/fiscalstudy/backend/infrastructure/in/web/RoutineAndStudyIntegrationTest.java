package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("default")
public class RoutineAndStudyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ConcursoRepository concursoRepository;

    @Autowired
    private EditalRepository editalRepository;

    private String testConcursoId;

    @BeforeEach
    void setUp() {
        testConcursoId = "test-concurso-" + UUID.randomUUID();
        Concurso concurso = new Concurso();
        concurso.setId(testConcursoId);
        concurso.setNome("Auditor Fiscal de Teste");
        concurso.setOrgao("SEFAZ Teste");
        concurso.setStatus("ACTIVE");
        concursoRepository.save(concurso);

        Edital edital = new Edital("edital-" + testConcursoId, testConcursoId, "Edital 01/2026", "1.0", "ORIGINAL", "edital.pdf");
        editalRepository.saveEdital(edital);

        EditalTopico t1 = new EditalTopico(UUID.randomUUID().toString(), edital.getId(), testConcursoId,
                "Direito Tributário", "Competência Tributária", null, 2.0, 10, null, 1, null, "CONFIRMADA", true);
        EditalTopico t2 = new EditalTopico(UUID.randomUUID().toString(), edital.getId(), testConcursoId,
                "Contabilidade Geral", "Balanço Patrimonial", null, 1.5, 8, null, 2, null, "CONFIRMADA", true);
        editalRepository.saveTopico(t1);
        editalRepository.saveTopico(t2);
    }

    @Test
    @DisplayName("Gera e obtém rotina semanal adaptativa com ciclo de estudo proporcional")
    void testGetRoutineAndCycle() throws Exception {
        mockMvc.perform(get("/api/v1/routine")
                        .param("concursoId", testConcursoId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concursoId").value(testConcursoId))
                .andExpect(jsonPath("$.modoPlanejamento").value("SEMANAL"))
                .andExpect(jsonPath("$.horasSegunda").value(3.0))
                .andExpect(jsonPath("$.cicloDisciplinasJson", containsString("Direito Tributário")))
                .andExpect(jsonPath("$.cicloDisciplinasJson", containsString("Contabilidade Geral")));
    }

    @Test
    @DisplayName("Registra compromissos fixos e calcula horas efetivas considerando exceções")
    void testCommitmentsAndExceptions() throws Exception {
        // 1. Cadastra compromisso fixo
        RoutineCommitment commitment = new RoutineCommitment(
                null, "Trabalho Integral", "SEGUNDA", "08:00", "17:00", "TRABALHO", null
        );
        mockMvc.perform(post("/api/v1/routine/commitments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commitment)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.titulo").value("Trabalho Integral"));

        // 2. Cadastra exceção na rotina (ex: médico na próxima segunda)
        String proximaSegunda = "2026-10-19"; // Segunda-feira
        RoutineException exception = new RoutineException(
                null, proximaSegunda, "INDISPONIBILIDADE", 2.0, "Consulta médica", null
        );
        mockMvc.perform(post("/api/v1/routine/exceptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(exception)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(proximaSegunda))
                .andExpect(jsonPath("$.horas").value(2.0));

        // 3. Consulta horas efetivas no dia com exceção (3h base - 2h exceção = 1h efetiva)
        mockMvc.perform(get("/api/v1/routine/effective-hours")
                        .param("concursoId", testConcursoId)
                        .param("date", proximaSegunda))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveHours").value(1.0))
                .andExpect(jsonPath("$.effectiveMinutes").value(60));
    }

    @Test
    @DisplayName("Cadastra material de estudo e vincula a tópico do edital")
    void testStudyMaterialAndTopicLink() throws Exception {
        // 1. Cadastra livro na biblioteca
        StudyMaterial material = new StudyMaterial(
                null, testConcursoId, "Direito Tributário", "Direito Tributário Esquematizado",
                "Ricardo Alexandre", "LIVRO", 850, 0, "caminho/tributario.pdf", "Edição 2026", null
        );

        String matResp = mockMvc.perform(post("/api/v1/materials")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(material)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.titulo").value("Direito Tributário Esquematizado"))
                .andReturn().getResponse().getContentAsString();

        StudyMaterial savedMat = objectMapper.readValue(matResp, StudyMaterial.class);

        // 2. Vincula material ao tópico do edital
        TopicMaterialLink link = new TopicMaterialLink(
                null, "topico-123", savedMat.getId(), 45, 90, 0, "NAO_INICIADO", "Capítulo 3", null
        );

        mockMvc.perform(post("/api/v1/materials/links")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(link)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.materialId").value(savedMat.getId()));
    }

    @Test
    @DisplayName("Registra sessão de estudo ativa na event_store e agrega tempo e páginas")
    void testRecordStudySession() throws Exception {
        String sessionId = "study-session-" + UUID.randomUUID();

        Map<String, Object> sessionPayload = Map.of(
                "sessionId", sessionId,
                "concursoId", testConcursoId,
                "disciplina", "Direito Tributário",
                "durationSeconds", 3600, // 1 hora
                "paginasLidas", 25,
                "questoesFeitas", 15,
                "modo", "POMODORO",
                "notas", "Ciclo focado em princípios constitucionais"
        );

        mockMvc.perform(post("/api/v1/study-sessions/record")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sessionPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECORDED"))
                .andExpect(jsonPath("$.durationSeconds").value(3600));

        // Consulta sumário agregado de tempo de estudo
        mockMvc.perform(get("/api/v1/study-sessions/summary")
                        .param("concursoId", testConcursoId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", greaterThanOrEqualTo(3600)))
                .andExpect(jsonPath("$.totalHours", greaterThanOrEqualTo(1.0)))
                .andExpect(jsonPath("$.totalPaginas", greaterThanOrEqualTo(25)))
                .andExpect(jsonPath("$.totalQuestoes", greaterThanOrEqualTo(15)));
    }
}
