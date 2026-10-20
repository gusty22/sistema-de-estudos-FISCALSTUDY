package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.cycle.RobinHoodCycleResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class SwotCycleCalibratorServiceTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RobinHoodCycleService robinHoodCycleService;

    private SwotCycleCalibratorService calibratorService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        calibratorService = new SwotCycleCalibratorService(jdbcTemplate, robinHoodCycleService, objectMapper);
    }

    @Test
    @DisplayName("Cenário Canônico: Simulado de Domingo transfere 18% de matéria FORÇA (>80%) para AMEAÇA (Tributário / Crédito Tributário)")
    void testSundaySwotRecalibrationTransfersHours() {
        String concursoId = "concurso_test_swot_" + UUID.randomUUID().toString().substring(0, 6);

        String editalId = "edital_" + UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Direito Tributário', 'Crédito Tributário', 3.0)", UUID.randomUUID().toString(), concursoId, editalId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Direito Tributário', 'Imunidades', 3.0)", UUID.randomUUID().toString(), concursoId, editalId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Direito Administrativo', 'Atos Administrativos', 1.5)", UUID.randomUUID().toString(), concursoId, editalId);
        jdbcTemplate.update("INSERT INTO edital_topicos (id, concurso_id, edital_id, disciplina, assunto, peso) VALUES (?, ?, ?, 'Contabilidade Geral', 'Balancete', 2.0)", UUID.randomUUID().toString(), concursoId, editalId);

        // Dados do Simulado SWOT
        Map<String, Object> desempenhoPorDisciplina = new LinkedHashMap<>();

        // Direito Administrativo: 9 acertos em 10 (90%) -> ZONA DE FORÇA
        desempenhoPorDisciplina.put("Direito Administrativo", Map.of(
                "total", 10,
                "acertos", 9,
                "erros", 1,
                "topicosComErro", List.of()
        ));

        // Direito Tributário: 4 acertos em 10 (40%) -> ZONA DE AMEAÇA (peso 3.0, alto peso)
        desempenhoPorDisciplina.put("Direito Tributário", Map.of(
                "total", 10,
                "acertos", 4,
                "erros", 6,
                "topicosComErro", List.of("Crédito Tributário")
        ));

        // Contabilidade Geral: 7 acertos em 10 (70%) -> ZONA DE OPORTUNIDADE
        desempenhoPorDisciplina.put("Contabilidade Geral", Map.of(
                "total", 10,
                "acertos", 7,
                "erros", 3,
                "topicosComErro", List.of()
        ));

        Map<String, Object> simuladoPayload = new LinkedHashMap<>();
        simuladoPayload.put("id", "simulado_domingo_01");
        simuladoPayload.put("titulo", "Simulado Geral SWOT de Domingo");
        simuladoPayload.put("weeklyHours", 24.0);
        simuladoPayload.put("taxaRouboPct", 18.0);
        simuladoPayload.put("desempenhoPorDisciplina", desempenhoPorDisciplina);

        // Executar a recalibração
        SwotCycleCalibratorService.SwotCalibrationResult result = calibratorService.recalibrateFromSimulado(concursoId, simuladoPayload);

        assertNotNull(result);
        assertEquals(18.0, result.taxaRouboAplicadaPct(), 0.01);
        assertEquals(24.0, result.horasSemanaisTotal(), 0.01);

        // Doadora deve ser Direito Administrativo (>80%)
        assertTrue(result.materiasDoadoras().contains("Direito Administrativo"), "Dir. Administrativo deve ser classificada como doadora");
        // Receptora deve ser Direito Tributário (Ameaça: 40% com peso 3.0)
        assertTrue(result.materiasReceptoras().contains("Direito Tributário"), "Dir. Tributário deve ser receptora");

        // Horas roubadas devem ser estritamente positivas (~18% da carga original de Dir. Administrativo)
        assertTrue(result.totalHorasTransferidas() > 0.0, "Total de horas transferidas deve ser > 0");

        // Verifica relatório da disciplina doadora
        var adminReport = result.disciplinas().stream()
                .filter(d -> "Direito Administrativo".equals(d.disciplina()))
                .findFirst()
                .orElseThrow();

        assertEquals("FORCA", adminReport.zonaSwot());
        assertTrue(adminReport.horasDelta() < 0, "Dir. Administrativo deve ter horasDelta negativo (roubadas)");
        assertEquals(adminReport.horasOriginais() + adminReport.horasDelta(), adminReport.horasRecalibradas(), 0.15);

        // Verifica relatório da disciplina receptora
        var tribReport = result.disciplinas().stream()
                .filter(d -> "Direito Tributário".equals(d.disciplina()))
                .findFirst()
                .orElseThrow();

        assertEquals("AMEACA", tribReport.zonaSwot());
        assertTrue(tribReport.horasDelta() > 0, "Dir. Tributário deve ter horasDelta positivo (injetadas)");
        assertTrue(tribReport.horasRecalibradas() > tribReport.horasOriginais());

        // Conservação de horas: a soma das recalibradas deve ser igual a 24h (+/- tolerância de arredondamento)
        double totalRecalibradas = result.disciplinas().stream().mapToDouble(SwotCycleCalibratorService.SwotDisciplineReport::horasRecalibradas).sum();
        assertEquals(24.0, totalRecalibradas, 0.5);

        // Bloco emergencial para "Crédito Tributário"
        assertFalse(result.blocosEmergenciais().isEmpty(), "Deve conter bloco emergencial para o tópico com erro");
        boolean temCreditoTrib = result.blocosEmergenciais().stream().anyMatch(b -> "Crédito Tributário".equals(b.get("topico")));
        assertTrue(temCreditoTrib, "Deve conter bloco emergencial específico para Crédito Tributário");

        // Verificar que o ciclo no RobinHoodCycleService reflete a calibração
        RobinHoodCycleResult cycle = robinHoodCycleService.getOrGenerateCycle(concursoId, 24.0, 60);
        assertNotNull(cycle);
        assertNotNull(cycle.getBlocos());
        assertFalse(cycle.getBlocos().isEmpty());

        // O primeiro bloco deve ser a emergência de Crédito Tributário
        var primeiroBloco = cycle.getBlocos().get(0);
        assertTrue(primeiroBloco.getDisciplina().startsWith("Direito Tributário"));
        assertTrue(primeiroBloco.getMensagemEuDoPassado().contains("Pós-Simulado SWOT") || primeiroBloco.getMensagemEuDoPassado().contains("Crédito Tributário") || primeiroBloco.getMensagemEuDoPassado().contains("Emergência"));
    }

    @Test
    @DisplayName("Limite e Clamping: Taxa de roubo é estritamente limitada à faixa de 15% a 20%")
    void testStealRateClamping() {
        String concursoId = "concurso_clamp_" + UUID.randomUUID().toString().substring(0, 6);

        Map<String, Object> payload1 = Map.of(
                "weeklyHours", 20.0,
                "taxaRouboPct", 35.0, // Acima de 20%
                "desempenhoPorDisciplina", Map.of(
                        "Direito Civil", Map.of("total", 10, "acertos", 9, "erros", 1)
                )
        );
        var r1 = calibratorService.recalibrateFromSimulado(concursoId, payload1);
        assertEquals(20.0, r1.taxaRouboAplicadaPct(), 0.01, "Taxa máxima deve ser 20%");

        Map<String, Object> payload2 = Map.of(
                "weeklyHours", 20.0,
                "taxaRouboPct", 5.0, // Abaixo de 15%
                "desempenhoPorDisciplina", Map.of(
                        "Direito Civil", Map.of("total", 10, "acertos", 9, "erros", 1)
                )
        );
        var r2 = calibratorService.recalibrateFromSimulado(concursoId, payload2);
        assertEquals(15.0, r2.taxaRouboAplicadaPct(), 0.01, "Taxa mínima deve ser 15%");
    }
}
