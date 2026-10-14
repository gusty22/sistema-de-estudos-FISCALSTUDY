package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.in.web.dto.EditalValidationResultDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EditalJsonValidatorTest {

    private EditalJsonValidatorService validator;

    @BeforeEach
    void setUp() {
        validator = new EditalJsonValidatorService(new ObjectMapper());
    }

    @Test
    @DisplayName("Cenário 1: JSON completo no formato Track Concursos é validado com sucesso e preserva contagens e ordem")
    void testValidCompleteTrackConcursosJson() {
        String json = "{\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"mat_trib\",\n" +
                "      \"nome\": \"Direito Tributário\",\n" +
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"top_stn\",\n" +
                "          \"nome\": \"Sistema Tributário Nacional\",\n" +
                "          \"subtopicos\": [\n" +
                "            { \"id\": \"sub_princ\", \"nome\": \"Princípios Tributários\" },\n" +
                "            { \"id\": \"sub_imun\", \"nome\": \"Imunidades Constitucionais\" }\n" +
                "          ]\n" +
                "        },\n" +
                "        {\n" +
                "          \"id\": \"top_comp\",\n" +
                "          \"nome\": \"Competência Tributária\",\n" +
                "          \"subtopicos\": []\n" +
                "        }\n" +
                "      ]\n" +
                "    },\n" +
                "    {\n" +
                "      \"id\": \"mat_cont\",\n" +
                "      \"nome\": \"Contabilidade Geral\",\n" +
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"top_bal\",\n" +
                "          \"nome\": \"Balanço Patrimonial\",\n" +
                "          \"subtopicos\": []\n" +
                "        }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        EditalValidationResultDTO result = validator.validateJsonString(json);

        assertTrue(result.isValid());
        assertEquals("VALID", result.getStatus());
        assertEquals(2, result.getTotalMaterias());
        assertEquals(3, result.getTotalTopicos());
        assertEquals(2, result.getTotalSubtopicos());
        assertTrue(result.getErrors().isEmpty());

        // Verifica preservação de ordem
        assertEquals("Direito Tributário", result.getNormalizedMaterias().get(0).getNome());
        assertEquals(0, result.getNormalizedMaterias().get(0).getOrdem());
        assertEquals("Contabilidade Geral", result.getNormalizedMaterias().get(1).getNome());
        assertEquals(1, result.getNormalizedMaterias().get(1).getOrdem());

        // Verifica preservação fiel dos IDs
        assertEquals("mat_trib", result.getNormalizedMaterias().get(0).getId());
        assertEquals("top_stn", result.getNormalizedMaterias().get(0).getTopicos().get(0).getId());
        assertEquals("sub_princ", result.getNormalizedMaterias().get(0).getTopicos().get(0).getSubtopicos().get(0).getId());

        // Verifica estado epistemológico de procedência
        assertEquals("JSON_STRUCTURALLY_VALID", result.getProcedenciaStatus());
        assertNotEquals("SOURCE_VERIFIED", result.getProcedenciaStatus());
    }

    @Test
    @DisplayName("Cenário 2: JSON com erro de sintaxe é rejeitado com mensagem explicativa e localização")
    void testInvalidSyntaxJson() {
        String malformedJson = "{ \"materias\": [ { \"id\": \"mat_01\", \"nome\": \"Direito\" "; // falta fechar chaves

        EditalValidationResultDTO result = validator.validateJsonString(malformedJson);

        assertFalse(result.isValid());
        assertEquals("INVALID", result.getStatus());
        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().get(0).contains("Erro de sintaxe JSON"));
    }

    @Test
    @DisplayName("Cenário 3: JSON vazio ou sem a chave raiz 'materias' é rejeitado")
    void testMissingMateriasRootOrEmpty() {
        EditalValidationResultDTO res1 = validator.validateJsonString("{}");
        assertFalse(res1.isValid());
        assertTrue(res1.getErrors().get(0).contains("chave raiz 'materias' é obrigatória"));

        EditalValidationResultDTO res2 = validator.validateJsonString("{\"materias\": []}");
        assertFalse(res2.isValid());
        assertTrue(res2.getErrors().get(0).contains("ao menos uma disciplina"));

        EditalValidationResultDTO res3 = validator.validateJsonString("   ");
        assertFalse(res3.isValid());
        assertTrue(res3.getErrors().get(0).contains("JSON vazio ou não informado"));
    }

    @Test
    @DisplayName("Cenário 4: Colisão de IDs em qualquer nível da árvore é detectada e rejeitada")
    void testDuplicateIdsDetected() {
        String json = "{\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"id_conflito\",\n" +
                "      \"nome\": \"Direito Tributário\",\n" +
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"id_conflito\",\n" + // colisão com o ID da matéria!
                "          \"nome\": \"Fato Gerador\"\n" +
                "        }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        EditalValidationResultDTO result = validator.validateJsonString(json);

        assertFalse(result.isValid());
        assertEquals("INVALID", result.getStatus());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("ID duplicado detectado: 'id_conflito'")));
    }

    @Test
    @DisplayName("Cenário 5: Nomes nulos ou em branco em matérias ou tópicos são rejeitados")
    void testBlankOrNullNamesRejected() {
        String json = "{\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"mat_01\",\n" +
                "      \"nome\": \"   \",\n" + // nome em branco!
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"top_01\",\n" +
                "          \"nome\": \"\"\n" + // nome vazio!
                "        }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        EditalValidationResultDTO result = validator.validateJsonString(json);

        assertFalse(result.isValid());
        assertEquals("INVALID", result.getStatus());
        assertTrue(result.getErrors().stream().anyMatch(e -> e.contains("não pode ser vazio")));
    }

    @Test
    @DisplayName("Cenário 6: Subtópicos flexíveis suportam tanto strings quanto objetos sem quebra")
    void testFlexibleSubtopicosAsStringsAndObjects() {
        String json = "{\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"mat_leg\",\n" +
                "      \"nome\": \"Legislação Tributária\",\n" +
                "      \"topicos\": [\n" +
                "        {\n" +
                "          \"id\": \"top_iss\",\n" +
                "          \"nome\": \"ISSQN\",\n" +
                "          \"subtopicos\": [\n" +
                "            \"Local da Prestação\",\n" + // string simples
                "            \"Alíquotas Mínima e Máxima\"\n" + // string simples
                "          ]\n" +
                "        },\n" +
                "        {\n" +
                "          \"id\": \"top_iptu\",\n" +
                "          \"nome\": \"IPTU\",\n" +
                "          \"subtopicos\": [\n" +
                "            { \"id\": \"sub_iptu_1\", \"nome\": \"Fato Gerador e Base de Cálculo\" }\n" + // objeto
                "          ]\n" +
                "        }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        EditalValidationResultDTO result = validator.validateJsonString(json);

        assertTrue(result.isValid());
        assertEquals(1, result.getTotalMaterias());
        assertEquals(2, result.getTotalTopicos());
        assertEquals(3, result.getTotalSubtopicos());

        // Verifica conversão dos subtópicos em string para objetos com IDs gerados
        var subtopicosIss = result.getNormalizedMaterias().get(0).getTopicos().get(0).getSubtopicos();
        assertEquals(2, subtopicosIss.size());
        assertEquals("Local da Prestação", subtopicosIss.get(0).getNome());
        assertNotNull(subtopicosIss.get(0).getId());

        // Verifica objeto explícito
        var subtopicosIptu = result.getNormalizedMaterias().get(0).getTopicos().get(1).getSubtopicos();
        assertEquals(1, subtopicosIptu.size());
        assertEquals("sub_iptu_1", subtopicosIptu.get(0).getId());
        assertEquals("Fato Gerador e Base de Cálculo", subtopicosIptu.get(0).getNome());
    }

    @Test
    @DisplayName("Cenário 7: Duplicidade de nomes de matérias ou tópicos gera WARNING sem descartar ou invalidar")
    void testDuplicateNameProducesWarningNotRejection() {
        String json = "{\n" +
                "  \"materias\": [\n" +
                "    {\n" +
                "      \"id\": \"mat_01\",\n" +
                "      \"nome\": \"Direito Constitucional\",\n" +
                "      \"topicos\": [\n" +
                "        { \"id\": \"top_01\", \"nome\": \"Poder Executivo\" },\n" +
                "        { \"id\": \"top_02\", \"nome\": \"Poder Executivo\" }\n" + // duplicado na mesma matéria
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

        EditalValidationResultDTO result = validator.validateJsonString(json);

        assertTrue(result.isValid()); // Não quebra a validação
        assertEquals("WARNINGS", result.getStatus());
        assertTrue(result.getErrors().isEmpty());
        assertTrue(result.getWarnings().stream().anyMatch(w -> w.contains("Poder Executivo") && w.contains("duplicado")));
    }

    @Test
    @DisplayName("Cenário 8: Preservação estrita da ordem sequencial original dos itens")
    void testStrictOrderPreservation() {
        String json = "{\n" +
                "  \"materias\": [\n" +
                "    { \"id\": \"m3\", \"nome\": \"Português\", \"topicos\": [] },\n" +
                "    { \"id\": \"m1\", \"nome\": \"Raciocínio Lógico\", \"topicos\": [] },\n" +
                "    { \"id\": \"m2\", \"nome\": \"Direito Administrativo\", \"topicos\": [] }\n" +
                "  ]\n" +
                "}";

        EditalValidationResultDTO result = validator.validateJsonString(json);

        assertTrue(result.isValid());
        assertEquals(3, result.getTotalMaterias());

        // Preserva a ordem exata fornecida: m3 (0), m1 (1), m2 (2)
        assertEquals("Português", result.getNormalizedMaterias().get(0).getNome());
        assertEquals(0, result.getNormalizedMaterias().get(0).getOrdem());

        assertEquals("Raciocínio Lógico", result.getNormalizedMaterias().get(1).getNome());
        assertEquals(1, result.getNormalizedMaterias().get(1).getOrdem());

        assertEquals("Direito Administrativo", result.getNormalizedMaterias().get(2).getNome());
        assertEquals(2, result.getNormalizedMaterias().get(2).getOrdem());
    }
}
