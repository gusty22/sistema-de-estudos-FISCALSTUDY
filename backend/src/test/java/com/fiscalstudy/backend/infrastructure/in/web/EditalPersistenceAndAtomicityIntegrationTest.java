package com.fiscalstudy.backend.infrastructure.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.application.EditalImportService;
import com.fiscalstudy.backend.domain.*;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class EditalPersistenceAndAtomicityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EditalImportService editalImportService;

    @Autowired
    private ConcursoRepository concursoRepository;

    @Autowired
    private EditalRepository editalRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private final String sampleValidJson = "{\n" +
            "  \"versao\": \"1.0\",\n" +
            "  \"docOrigem\": \"edital_auditor_2024.pdf\",\n" +
            "  \"materias\": [\n" +
            "    {\n" +
            "      \"id\": \"mat_01\",\n" +
            "      \"nome\": \"Direito Tributário\",\n" +
            "      \"topicos\": [\n" +
            "        {\n" +
            "          \"id\": \"top_01\",\n" +
            "          \"nome\": \"Sistema Tributário Nacional\",\n" +
            "          \"subtopicos\": [\n" +
            "            { \"id\": \"sub_01\", \"nome\": \"Princípios Tributários\" },\n" +
            "            { \"id\": \"sub_02\", \"nome\": \"Imunidades Tributárias\" }\n" +
            "          ]\n" +
            "        },\n" +
            "        {\n" +
            "          \"id\": \"top_02\",\n" +
            "          \"nome\": \"Crédito Tributário\",\n" +
            "          \"subtopicos\": [\n" +
            "            { \"id\": \"sub_03\", \"nome\": \"Lançamento e Suspensão\" }\n" +
            "          ]\n" +
            "        }\n" +
            "      ]\n" +
            "    },\n" +
            "    {\n" +
            "      \"id\": \"mat_02\",\n" +
            "      \"nome\": \"Direito Constitucional\",\n" +
            "      \"topicos\": [\n" +
            "        {\n" +
            "          \"id\": \"top_03\",\n" +
            "          \"nome\": \"Direitos e Garantias Fundamentais\",\n" +
            "          \"subtopicos\": []\n" +
            "        }\n" +
            "      ]\n" +
            "    }\n" +
            "  ]\n" +
            "}";

    @BeforeEach
    void setUp() {
        // Limpa dados de teste específicos sem tocar no banco de dados operacional
        jdbcTemplate.update("DELETE FROM edital_topicos WHERE concurso_id LIKE 'test-%'");
        jdbcTemplate.update("DELETE FROM editais WHERE concurso_id LIKE 'test-%'");
        jdbcTemplate.update("DELETE FROM concursos WHERE id LIKE 'test-%'");
    }

    @Test
    @DisplayName("A2.1 — Validação independente de concurso: POST /api/v1/edital/validate-json é puramente em memória e não altera o banco")
    void testStandaloneValidationProducesZeroDatabaseChanges() throws Exception {
        int initialConcursos = jdbcTemplate.queryForObject("SELECT count(*) FROM concursos", Integer.class);
        int initialEditais = jdbcTemplate.queryForObject("SELECT count(*) FROM editais", Integer.class);
        int initialTopicos = jdbcTemplate.queryForObject("SELECT count(*) FROM edital_topicos", Integer.class);

        // Validação com sucesso
        mockMvc.perform(post("/api/v1/edital/validate-json")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sampleValidJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.status").value("VALID"))
                .andExpect(jsonPath("$.totalMaterias").value(2))
                .andExpect(jsonPath("$.totalTopicos").value(3))
                .andExpect(jsonPath("$.totalSubtopicos").value(3))
                .andExpect(jsonPath("$.procedenciaStatus").value("JSON_STRUCTURALLY_VALID"));

        // Comprova 0 escritas no banco
        assertEquals(initialConcursos, jdbcTemplate.queryForObject("SELECT count(*) FROM concursos", Integer.class));
        assertEquals(initialEditais, jdbcTemplate.queryForObject("SELECT count(*) FROM editais", Integer.class));
        assertEquals(initialTopicos, jdbcTemplate.queryForObject("SELECT count(*) FROM edital_topicos", Integer.class));

        // Validação com erro de sintaxe
        mockMvc.perform(post("/api/v1/edital/validate-json")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"materias\": [ { \"incompleto\": true "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.status").value("INVALID"))
                .andExpect(jsonPath("$.errors[0]").exists());
    }

    @Test
    @DisplayName("A2.2 — Persistência atômica e preservação da hierarquia: importa tópicos com identidade única e metadados de origem")
    void testAtomicImportPreservesHierarchyAndSequentialOrder() throws Exception {
        String testConcursoId = "test-sefaz-sp-2024";
        Concurso concurso = new Concurso(testConcursoId, "SEFAZ SP 2024", "SEFAZ SP", "FCC", 2024, "Auditor Fiscal", "101", "ACTIVE", "Edital novo");
        concursoRepository.save(concurso);

        EditalImportPayloadDTO payload = objectMapper.readValue(sampleValidJson, EditalImportPayloadDTO.class);
        EditalImportRequestDTO request = new EditalImportRequestDTO(payload, true, "STRUCTURE_HUMAN_REVIEWED");

        mockMvc.perform(post("/api/v1/concursos/" + testConcursoId + "/edital/import-json")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.concursoId").value(testConcursoId))
                .andExpect(jsonPath("$.totalMaterias").value(2))
                .andExpect(jsonPath("$.totalTopicos").value(3))
                .andExpect(jsonPath("$.totalSubtopicos").value(3))
                .andExpect(jsonPath("$.totalRowsPersisted").value(4)) // 2 subtopicos em top1 + 1 subtopico em top2 + 1 topico folha em top3 = 4 folhas
                .andExpect(jsonPath("$.procedenciaStatus").value("STRUCTURE_HUMAN_REVIEWED"))
                .andExpect(jsonPath("$.confirmadoHumano").value(true));

        // Verifica no banco de dados a consistência física
        List<EditalTopico> savedTopicos = editalRepository.findTopicosByEditalId("edital-" + testConcursoId + "-v1_0");
        assertEquals(4, savedTopicos.size());

        // Comprova ordem estrita de leitura
        assertEquals(1, savedTopicos.get(0).getPaginaOrigem());
        assertEquals("Direito Tributário", savedTopicos.get(0).getDisciplina());
        assertEquals("Sistema Tributário Nacional", savedTopicos.get(0).getAssunto());
        assertEquals("Princípios Tributários", savedTopicos.get(0).getSubassunto());

        // Comprova que IDs originais foram salvos em trechoOrigem como metadados
        assertTrue(savedTopicos.get(0).getTrechoOrigem().contains("mat_01"));
        assertTrue(savedTopicos.get(0).getTrechoOrigem().contains("top_01"));
        assertTrue(savedTopicos.get(0).getTrechoOrigem().contains("sub_01"));

        // Comprova que o ID da chave primária do banco é um UUID único (não colide com mat_01/top_01)
        assertNotEquals("sub_01", savedTopicos.get(0).getId());
        assertEquals(36, savedTopicos.get(0).getId().length()); // UUID padrão 36 chars

        // Tópico folha sem subtópicos
        EditalTopico folhaConstitucional = savedTopicos.stream()
                .filter(t -> "Direito Constitucional".equals(t.getDisciplina()))
                .findFirst()
                .orElseThrow();
        assertEquals("Direitos e Garantias Fundamentais", folhaConstitucional.getAssunto());
        assertNull(folhaConstitucional.getSubassunto());
    }

    @Test
    @DisplayName("A2.3 — Prevenção de duplicatas: sobrescrita (re-importação) substitui tópicos antigos sem deixar registros órfãos")
    void testOverwriteReplacesPreviousTopicsCleanly() throws Exception {
        String testConcursoId = "test-iss-recife-2024";
        Concurso concurso = new Concurso(testConcursoId, "ISS Recife", "Prefeitura de Recife", "CESPE", 2024, "Auditor", "501", "ACTIVE", "Desc");
        concursoRepository.save(concurso);

        EditalImportPayloadDTO payload = objectMapper.readValue(sampleValidJson, EditalImportPayloadDTO.class);
        EditalImportRequestDTO request = new EditalImportRequestDTO(payload, true, "STRUCTURE_HUMAN_REVIEWED");

        // Primeira importação (4 nós folhas)
        editalImportService.importEdital(testConcursoId, payload, true, "STRUCTURE_HUMAN_REVIEWED", true, "1.0", "ORIGINAL");
        assertEquals(4, editalRepository.findTopicosByConcurso(testConcursoId).size());

        // Segunda importação com payload reduzido (apenas 1 matéria com 1 tópico folha)
        String smallerJson = "{\n" +
                "  \"versao\": \"1.0\",\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"m_unica\",\n" +
                "      \"nome\": \"Auditoria Fiscal\",\n" +
                "      \"topicos\": [\n" +
                "        { \"id\": \"t_unico\", \"nome\": \"Procedimentos Fiscais\", \"subtopicos\": [] }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";
        EditalImportPayloadDTO smallerPayload = objectMapper.readValue(smallerJson, EditalImportPayloadDTO.class);

        editalImportService.importEdital(testConcursoId, smallerPayload, true, "STRUCTURE_HUMAN_REVIEWED", true, "1.0", "ORIGINAL");

        // Comprova que os 4 tópicos anteriores foram expurgados e apenas 1 existe
        List<EditalTopico> updated = editalRepository.findTopicosByConcurso(testConcursoId);
        assertEquals(1, updated.size());
        assertEquals("Auditoria Fiscal", updated.get(0).getDisciplina());
    }

    @Test
    @DisplayName("A2.4 — Atomicidade comprovada no edital: falha durante gravação de tópicos executa rollback total e não deixa órfãos")
    void testEditalRollbackOnTopicSaveFailureLeavesZeroOrphans() throws Exception {
        String testConcursoId = "test-iss-bh-rollback";
        Concurso concurso = new Concurso(testConcursoId, "ISS BH", "PBH", "RBO", 2024, "Auditor", "501", "ACTIVE", "Desc");
        concursoRepository.save(concurso);

        EditalImportPayloadDTO payload = objectMapper.readValue(sampleValidJson, EditalImportPayloadDTO.class);
        String editalId = "edital-" + testConcursoId + "-v1_0";

        // Simula falha catastrófica após gravar o 2º tópico
        assertThrows(RuntimeException.class, () -> {
            editalImportService.importEditalWithFailureSimulation(
                    testConcursoId,
                    payload,
                    true,
                    "STRUCTURE_HUMAN_REVIEWED",
                    true,
                    "1.0",
                    "ORIGINAL",
                    2 // falha após tópico 2
            );
        });

        // Comprova que o rollback do Spring Boot + SQLite funcionou de forma estrita:
        // ZERO tópicos persistem no banco
        int topicosGravados = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM edital_topicos WHERE concurso_id = ?",
                Integer.class,
                testConcursoId
        );
        assertEquals(0, topicosGravados, "A transação falhou mas deixou registros órfãos em edital_topicos!");

        // ZERO editais gravados
        int editaisGravados = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM editais WHERE id = ?",
                Integer.class,
                editalId
        );
        assertEquals(0, editaisGravados, "O registro de editais permaneceu gravado após falha nos tópicos!");
    }

    @Test
    @DisplayName("A2.5 — Atomicidade comprovada no cadastro combinado: falha no edital reverte também o concurso criado")
    void testCombinedConcursoAndEditalRollbackLeavesZeroOrphanConcurso() throws Exception {
        String testConcursoId = "test-receita-federal-rollback";
        Concurso concurso = new Concurso(testConcursoId, "Receita Federal", "RFB", "FGV", 2024, "Auditor Fiscal", "101", "ACTIVE", "Desc");

        EditalImportPayloadDTO payload = objectMapper.readValue(sampleValidJson, EditalImportPayloadDTO.class);
        ConcursoWithEditalCreateDTO dto = new ConcursoWithEditalCreateDTO(concurso, payload, true, "STRUCTURE_HUMAN_REVIEWED", null);

        // Provoca falha durante a persistência dos tópicos do edital
        assertThrows(RuntimeException.class, () -> {
            editalImportService.createConcursoWithEdital(dto, 2);
        });

        // Comprova que nem o concurso nem o edital nem os tópicos permaneceram no banco!
        int concursosCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM concursos WHERE id = ?",
                Integer.class,
                testConcursoId
        );
        assertEquals(0, concursosCount, "O concurso permaneceu órfão após falha no edital!");

        int topicosCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM edital_topicos WHERE concurso_id = ?",
                Integer.class,
                testConcursoId
        );
        assertEquals(0, topicosCount, "Registros de tópicos permaneceram no banco!");
    }

    @Test
    @DisplayName("A2.6 — Criação combinada com sucesso: POST /api/v1/concursos/with-edital cria concurso e edital de forma consistente")
    void testSuccessfulCombinedConcursoAndEditalCreation() throws Exception {
        String testConcursoId = "test-tcu-auditor-2024";
        Concurso concurso = new Concurso(testConcursoId, "TCU 2024", "TCU", "Cebraspe", 2024, "Auditor Federal", "01", "ACTIVE", "Desc");

        EditalImportPayloadDTO payload = objectMapper.readValue(sampleValidJson, EditalImportPayloadDTO.class);
        ConcursoWithEditalCreateDTO dto = new ConcursoWithEditalCreateDTO(concurso, payload, true, "STRUCTURE_HUMAN_REVIEWED", null);

        mockMvc.perform(post("/api/v1/concursos/with-edital")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.concurso.id").value(testConcursoId))
                .andExpect(jsonPath("$.editalSummary.totalMaterias").value(2))
                .andExpect(jsonPath("$.editalSummary.totalRowsPersisted").value(4));

        // Confirma existência no banco
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM concursos WHERE id = ?", Integer.class, testConcursoId));
        assertEquals(4, jdbcTemplate.queryForObject("SELECT count(*) FROM edital_topicos WHERE concurso_id = ?", Integer.class, testConcursoId));
    }

    @Test
    @DisplayName("A2.7 — Distinção epistemológica de procedência e níveis de evidência de aprendizagem")
    void testEpistemologicalProvenanceAndEvidenceLevels() {
        // Procedência
        assertEquals("JSON_STRUCTURALLY_VALID", ProcedenciaEdital.JSON_STRUCTURALLY_VALID.name());
        assertEquals("STRUCTURE_HUMAN_REVIEWED", ProcedenciaEdital.STRUCTURE_HUMAN_REVIEWED.name());
        assertEquals("SOURCE_VERIFIED", ProcedenciaEdital.SOURCE_VERIFIED.name());

        // Regra de segurança: SOURCE_VERIFIED não pode ser atribuído sem confirmação humana
        EditalImportPayloadDTO payload = new EditalImportPayloadDTO();
        assertThrows(IllegalArgumentException.class, () -> {
            editalImportService.importEdital("iss-araguari-auditor-2023", payload, false, "SOURCE_VERIFIED", true, "1.0", "ORIGINAL");
        });

        // Níveis de evidência (sem limiar arbitrário de 30 questões)
        assertEquals("SELF_REPORTED", EvidenceLevel.SELF_REPORTED.name());
        assertEquals("OBSERVED_PERFORMANCE", EvidenceLevel.OBSERVED_PERFORMANCE.name());
        assertEquals("LONGITUDINAL_EVIDENCE", EvidenceLevel.LONGITUDINAL_EVIDENCE.name());
        assertEquals("INSUFFICIENT_EVIDENCE", EvidenceLevel.INSUFFICIENT_EVIDENCE.name());
    }
}
