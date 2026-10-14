package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.Concurso;
import com.fiscalstudy.backend.domain.ConcursoRepository;
import com.fiscalstudy.backend.domain.Edital;
import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class EditalPostEditalAndEditingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ConcursoRepository concursoRepository;

    @Autowired
    private EditalRepository editalRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String testConcursoId;

    @BeforeEach
    public void setup() {
        testConcursoId = "conc-test-edital-" + UUID.randomUUID().toString().substring(0, 8);
        Concurso c = new Concurso();
        c.setId(testConcursoId);
        c.setNome("Auditor Fiscal de Teste");
        c.setOrgao("ISS Teste");
        c.setBanca("FGV");
        c.setAno(2026);
        c.setCargo("Auditor");
        c.setStatus("ACTIVE");
        c.setSituacao("AUTORIZADO");
        concursoRepository.save(c);
    }

    @Test
    @DisplayName("Deve permitir editar metadados do edital existente")
    public void testUpdateEditalMetadata() throws Exception {
        Edital edital = new Edital("edital-test-1", testConcursoId, "Edital Anterior 2018", "1.0", "PRE_EDITAL_ANTERIOR", "edital_2018.pdf");
        editalRepository.saveEdital(edital);

        Edital update = new Edital();
        update.setTitulo("Edital Anterior 2018 (Revisado)");
        update.setVersao("1.1");
        update.setTipo("PRE_EDITAL_ANTERIOR");
        update.setFilename("edital_2018_v1_1.pdf");

        mockMvc.perform(put("/api/v1/concursos/" + testConcursoId + "/edital/" + edital.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.titulo").value("Edital Anterior 2018 (Revisado)"))
                .andExpect(jsonPath("$.versao").value("1.1"));

        Edital persisted = editalRepository.findEditalById(edital.getId()).orElseThrow();
        assertEquals("Edital Anterior 2018 (Revisado)", persisted.getTitulo());
        assertEquals("1.1", persisted.getVersao());
    }

    @Test
    @DisplayName("Deve realizar a transição do Pré-Edital para o Edital Oficial (Pós-Edital) com atualização de situação do concurso")
    public void testTransitionPreEditalToPosEdital() throws Exception {
        // 1. Cadastra tópicos iniciais do pré-edital
        EditalTopico preTopico = new EditalTopico(
                UUID.randomUUID().toString(),
                "edital-" + testConcursoId + "-v1_0",
                testConcursoId,
                "Direito Tributário",
                "Tributos em Espécie (Edital Antigo)",
                null,
                1.0,
                5,
                "edital_antigo.pdf",
                10,
                "Item antigo",
                "EXPLICITA",
                true
        );
        editalRepository.saveTopico(preTopico);
        assertEquals(1, editalRepository.findTopicosByConcurso(testConcursoId).size());

        // 2. Saiu o Edital Oficial! Importa novo JSON oficial com replaceAllPreviousTopics = true
        String posEditalJson = "{\n" +
                "  \"versao\": \"2.0\",\n" +
                "  \"docOrigem\": \"edital_oficial_2026.pdf\",\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"mat_01\",\n" +
                "      \"nome\": \"Direito Tributário Municipal\",\n" +
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"top_01\",\n" +
                "          \"nome\": \"ISSQN e IPTU no Novo Edital\",\n" +
                "          \"subtopicos\": []\n" +
                "        }\n" +
                "      ]\n" +
                "    },\n" +
                "    {\n" +
                "      \"id\": \"mat_02\",\n" +
                "      \"nome\": \"Auditoria Tributária\",\n" +
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"top_02\",\n" +
                "          \"nome\": \"Planejamento de Fiscalização\",\n" +
                "          \"subtopicos\": []\n" +
                "        }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        EditalImportPayloadDTO payload = objectMapper.readValue(posEditalJson, EditalImportPayloadDTO.class);

        EditalImportRequestDTO request = new EditalImportRequestDTO();
        request.setPayload(payload);
        request.setVersao("2.0");
        request.setTipo("EDITAL_OFICIAL_POS_EDITAL");
        request.setTitulo("Edital Oficial nº 01/2026 - Pós-Edital");
        request.setConfirmadoHumano(true);
        request.setReplaceAllPreviousTopics(true); // substitui a grade do pré-edital
        request.setUpdateConcursoSituacao(true);
        request.setNovaSituacaoConcurso("EDITAL_PUBLICADO");
        request.setDataProva("2026-11-15");
        request.setLinkEdital("https://diariooficial.mg.gov.br/edital-01-2026.pdf");

        mockMvc.perform(post("/api/v1/concursos/" + testConcursoId + "/edital/import-json")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versao").value("2.0"))
                .andExpect(jsonPath("$.tipo").value("EDITAL_OFICIAL_POS_EDITAL"))
                .andExpect(jsonPath("$.totalMaterias").value(2))
                .andExpect(jsonPath("$.totalTopicos").value(2));

        // 3. Verifica que os tópicos antigos do pré-edital foram substituídos pelos 2 tópicos do novo edital oficial
        List<EditalTopico> currentTopics = editalRepository.findTopicosByConcurso(testConcursoId);
        assertEquals(2, currentTopics.size());
        assertTrue(currentTopics.stream().anyMatch(t -> t.getDisciplina().equals("Direito Tributário Municipal")));
        assertTrue(currentTopics.stream().anyMatch(t -> t.getDisciplina().equals("Auditoria Tributária")));
        assertFalse(currentTopics.stream().anyMatch(t -> t.getAssunto().equals("Tributos em Espécie (Edital Antigo)")));

        // 4. Verifica que a situação do concurso foi promovida para EDITAL_PUBLICADO com data da prova
        Concurso updatedConcurso = concursoRepository.findById(testConcursoId).orElseThrow();
        assertEquals("EDITAL_PUBLICADO", updatedConcurso.getSituacao());
        assertEquals("2026-11-15", updatedConcurso.getDataProva());
        assertEquals("https://diariooficial.mg.gov.br/edital-01-2026.pdf", updatedConcurso.getLinkEdital());
    }

    @Test
    @DisplayName("Deve renomear disciplina em lote em todos os tópicos do concurso")
    public void testRenameDiscipline() throws Exception {
        EditalTopico t1 = new EditalTopico(UUID.randomUUID().toString(), "edital-1", testConcursoId, "Português", "Sintaxe", null, 1.0, 5, "edital.pdf", 1, null, "EXPLICITA", false);
        EditalTopico t2 = new EditalTopico(UUID.randomUUID().toString(), "edital-1", testConcursoId, "Português", "Morfologia", null, 1.0, 5, "edital.pdf", 1, null, "EXPLICITA", false);
        editalRepository.saveTopico(t1);
        editalRepository.saveTopico(t2);

        mockMvc.perform(put("/api/v1/concursos/" + testConcursoId + "/edital/disciplines/rename")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("oldName", "Português", "newName", "Língua Portuguesa"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.newName").value("Língua Portuguesa"));

        List<EditalTopico> updated = editalRepository.findTopicosByConcurso(testConcursoId);
        assertEquals(2, updated.size());
        assertEquals("Língua Portuguesa", updated.get(0).getDisciplina());
        assertEquals("Língua Portuguesa", updated.get(1).getDisciplina());
    }
}
