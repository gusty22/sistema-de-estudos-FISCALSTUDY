package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.domain.Edital;
import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EditalController.class)
public class EditalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private EditalRepository editalRepository;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @Test
    public void testGetEditalVerticalizadoReturns200() throws Exception {
        Edital edital = new Edital("e1", "iss-araguari", "Edital 01/2023", "1.0", "ORIGINAL", "edital.pdf");
        EditalTopico topico = new EditalTopico("t1", "e1", "iss-araguari", "Direito Tributário", "Competência", "IPTU", 1.5, 10, "Edital", 42, "Item 1", "EXPLICITA", true);

        when(editalRepository.findEditaisByConcurso("iss-araguari")).thenReturn(List.of(edital));
        when(editalRepository.findTopicosByConcurso("iss-araguari")).thenReturn(List.of(topico));

        mockMvc.perform(get("/api/v1/concursos/iss-araguari/edital"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.concursoId").value("iss-araguari"))
                .andExpect(jsonPath("$.totalTopicos").value(1))
                .andExpect(jsonPath("$.topicos[0].disciplina").value("Direito Tributário"))
                .andExpect(jsonPath("$.topicos[0].peso").value(1.5));
    }

    @Test
    public void testAddTopicoReturns200() throws Exception {
        EditalTopico topico = new EditalTopico("t1", "e1", "iss-araguari", "Direito Tributário", "Crédito Tributário", null, 1.0, 5, "Doc", 10, "Trecho", "EXPLICITA", false);
        when(editalRepository.saveTopico(any())).thenReturn(topico);

        mockMvc.perform(post("/api/v1/concursos/iss-araguari/edital/topics")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"disciplina\":\"Direito Tributário\",\"assunto\":\"Crédito Tributário\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disciplina").value("Direito Tributário"));
    }

    @Test
    public void testConfirmTopicoReturns200() throws Exception {
        EditalTopico confirmed = new EditalTopico("t1", "e1", "iss-araguari", "Direito Tributário", "Crédito", null, 1.0, 5, "Doc", 10, "Trecho", "CONFIRMADA", true);
        when(editalRepository.findTopicoById("t1")).thenReturn(Optional.of(confirmed));

        mockMvc.perform(post("/api/v1/concursos/iss-araguari/edital/topics/t1/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tipoClassificacao").value("CONFIRMADA"))
                .andExpect(jsonPath("$.confirmadoHumano").value(true));
    }

    @Test
    public void testUploadEditalTxtReturns200() throws Exception {
        String content = "DISCIPLINA: Direito Tributário\nImunidades - Regras gerais\n";
        MockMultipartFile file = new MockMultipartFile("file", "conteudo.txt", "text/plain", content.getBytes());

        mockMvc.perform(multipart("/api/v1/concursos/iss-araguari/edital/upload")
                .file(file)
                .param("tipo", "ORIGINAL")
                .param("versao", "1.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.filename").value("conteudo.txt"));
    }
}
