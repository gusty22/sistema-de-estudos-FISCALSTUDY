package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Testes do CognitivePedagogyService (Pré-Mortem, Feynman, Pontos-Chave e Método ERA)")
class CognitivePedagogyServiceTest {

    private JdbcTemplate jdbcTemplate;
    private EventStoreRepository eventStoreRepository;
    private ObjectMapper objectMapper;
    private CognitivePedagogyService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        eventStoreRepository = Mockito.mock(EventStoreRepository.class);
        objectMapper = new ObjectMapper();
        service = new CognitivePedagogyService(jdbcTemplate, eventStoreRepository, objectMapper);
    }

    @Test
    @DisplayName("Deve registrar Pré-Mortem de Gary Klein com plano de contingência e evento")
    void testCreatePreMortem() {
        PreMortemDTO dto = new PreMortemDTO();
        dto.setConcursoId("iss-araguari");
        dto.setTitulo("Simulado Geral Pós-Edital");
        dto.setCenarioFracasso("Reprovação em Auditoria e Legislação");
        dto.setCausa1("Excesso de confiança em Direito Tributário");
        dto.setAcao1("Resolver 50 questões de Auditoria por semana");

        PreMortemDTO result = service.createPreMortem(dto);

        assertNotNull(result.getId());
        verify(jdbcTemplate).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(eventStoreRepository).appendEvent(eq("PRE_MORTEM_RECORDED"), eq("PEDAGOGY"), eq(result.getId()), anyString(), eq(1), eq("v1"), anyString());
    }

    @Test
    @DisplayName("Deve registrar Sessão Feynman em Tela Limpa")
    void testRecordFeynmanSession() {
        FeynmanSessionDTO dto = new FeynmanSessionDTO();
        dto.setConcursoId("iss-araguari");
        dto.setDisciplina("Direito Tributário");
        dto.setTopico("Imunidades Tributárias");
        dto.setReconstructionText("Imunidade recíproca proíbe impostos mútuos. ? Extensível a empresas públicas dependentes.");
        dto.setLacunasIdentificadas("Empresas públicas dependentes");
        dto.setTempoMinutos(15);

        FeynmanSessionDTO result = service.recordFeynmanSession(dto);

        assertNotNull(result.getId());
        verify(jdbcTemplate).update(anyString(), any(), any(), any(), any(), any(), any(), any());
        verify(eventStoreRepository).appendEvent(eq("FEYNMAN_SESSION_RECORDED"), eq("PEDAGOGY"), eq(result.getId()), anyString(), eq(1), eq("v1"), anyString());
    }

    @Test
    @DisplayName("Deve criar e revisar cartão de Pontos-Chave com Cloze Deletion")
    void testPontosChaveCloze() {
        PontoChaveDTO dto = new PontoChaveDTO();
        dto.setConcursoId("iss-araguari");
        dto.setDisciplina("Legislação Tributária");
        dto.setTopico("ISSQN - Local de Incidência");
        dto.setCriterio("PEGADINHA_BANCA");
        dto.setClozeText("A regra geral do ISS é o local do {{c1::estabelecimento prestador}}, e não do tomador.");

        PontoChaveDTO result = service.createPontoChave(dto);
        assertNotNull(result.getId());
        verify(jdbcTemplate).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());

        // Revisar acertando
        service.reviewPontoChave(result.getId(), true);
        verify(jdbcTemplate).update(contains("UPDATE ponto_chave_cards"), anyString(), eq(true), eq(result.getId()));
    }

    @Test
    @DisplayName("Deve salvar sessão pelo Método ERA")
    void testSaveMetodoEraSession() {
        MetodoEraDTO dto = new MetodoEraDTO();
        dto.setConcursoId("iss-araguari");
        dto.setDisciplina("Contabilidade Geral");
        dto.setTopico("DRE e Balanço Patrimonial");
        dto.setEtapa("AVALIAR");
        dto.setTempoExplorarSegundos(120);
        dto.setTempoEstudarSegundos(1800);
        dto.setTempoRevisarSegundos(600);
        dto.setQuestoesAvaliarFeitas(15);
        dto.setAnotacoesExcecoes("DRE deduz abatimentos antes da receita líquida.");
        dto.setResumoRaizAbstracao("Receita Bruta -> Deduções -> Receita Líquida");

        MetodoEraDTO result = service.saveMetodoEraSession(dto);
        assertNotNull(result.getId());
        verify(jdbcTemplate).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(eventStoreRepository).appendEvent(eq("METODO_ERA_SESSION_RECORDED"), eq("PEDAGOGY"), eq(result.getId()), anyString(), eq(1), eq("v1"), anyString());
    }
}
