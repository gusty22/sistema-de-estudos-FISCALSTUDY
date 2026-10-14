package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.domain.Concurso;
import com.fiscalstudy.backend.domain.ConcursoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ConcursoController.class)
public class ConcursoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ConcursoRepository concursoRepository;

    @MockBean
    private com.fiscalstudy.backend.application.EditalImportService editalImportService;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @Test
    public void testListConcursosReturns200() throws Exception {
        Concurso c = new Concurso("c1", "ISS Araguari", "Prefeitura de Araguari", "IBGP", 2023, "Auditor Fiscal", "503", "ACTIVE", "Desc");
        when(concursoRepository.findAll(any())).thenReturn(List.of(c));
        when(concursoRepository.countAvailableQuestions("c1")).thenReturn(40L);

        mockMvc.perform(get("/api/v1/concursos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("c1"))
                .andExpect(jsonPath("$[0].nome").value("ISS Araguari"))
                .andExpect(jsonPath("$[0].availableQuestionsCount").value(40));
    }

    @Test
    public void testGetConcursoByIdReturns200() throws Exception {
        Concurso c = new Concurso("c1", "ISS Araguari", "Prefeitura de Araguari", "IBGP", 2023, "Auditor Fiscal", "503", "ACTIVE", "Desc");
        when(concursoRepository.findById("c1")).thenReturn(Optional.of(c));
        when(concursoRepository.countAvailableQuestions("c1")).thenReturn(40L);

        mockMvc.perform(get("/api/v1/concursos/c1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("c1"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    public void testCreateConcursoReturns200() throws Exception {
        Concurso c = new Concurso("iss-sefaz-mg", "SEFAZ-MG 2024", "SEFAZ MG", "FGV", 2024, "Auditor Fiscal", "101", "ACTIVE", "Novo");
        when(concursoRepository.save(any())).thenReturn(c);

        mockMvc.perform(post("/api/v1/concursos")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"SEFAZ-MG 2024\",\"orgao\":\"SEFAZ MG\",\"banca\":\"FGV\",\"ano\":2024}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("SEFAZ-MG 2024"));
    }

    @Test
    public void testCreateProgressiveConcursoWithDatesAndDisponibilidadeReturns200() throws Exception {
        Concurso c = new Concurso("iss-sefaz-mg", "SEFAZ-MG 2024", "SEFAZ MG", "FGV", 2024, "Auditor Fiscal", "101", "ACTIVE", "Novo");
        c.setSituacao("COMISSAO_FORMADA");
        c.setLocalidade("Belo Horizonte - MG");
        c.setVagas(150);
        c.setDataProva("2024-11-20");
        c.setDataProvaTipo("PREVISTA");
        c.setDatasImportantesJson("[{\"tipo\":\"PREVISAO_EDITAL\",\"data\":\"2024-08-01\",\"tipoData\":\"PREVISTA\"}]");
        c.setDisponibilidadeJson("{\"horasDiarias\":4,\"diasSemana\":[\"SEG\",\"TER\",\"QUA\",\"QUI\",\"SEX\"]}");
        when(concursoRepository.save(any())).thenReturn(c);

        mockMvc.perform(post("/api/v1/concursos")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"SEFAZ-MG 2024\",\"orgao\":\"SEFAZ MG\",\"situacao\":\"COMISSAO_FORMADA\",\"vagas\":150,\"dataProva\":\"2024-11-20\",\"dataProvaTipo\":\"PREVISTA\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("SEFAZ-MG 2024"))
                .andExpect(jsonPath("$.situacao").value("COMISSAO_FORMADA"))
                .andExpect(jsonPath("$.vagas").value(150))
                .andExpect(jsonPath("$.dataProva").value("2024-11-20"))
                .andExpect(jsonPath("$.dataProvaTipo").value("PREVISTA"));
    }

    @Test
    public void testCreateConcursoWithoutNomeReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/concursos")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"orgao\":\"SEFAZ MG\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"));
    }

    @Test
    public void testArchiveConcursoReturns200() throws Exception {
        Concurso c = new Concurso("c1", "ISS Araguari", "Prefeitura de Araguari", "IBGP", 2023, "Auditor Fiscal", "503", "ACTIVE", "Desc");
        when(concursoRepository.findById("c1")).thenReturn(Optional.of(c));

        mockMvc.perform(post("/api/v1/concursos/c1/archive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }

    @Test
    public void testActivateConcursoReturns200() throws Exception {
        Concurso c = new Concurso("c1", "ISS Araguari", "Prefeitura de Araguari", "IBGP", 2023, "Auditor Fiscal", "503", "ARCHIVED", "Desc");
        when(concursoRepository.findById("c1")).thenReturn(Optional.of(c));

        mockMvc.perform(post("/api/v1/concursos/c1/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }
}
