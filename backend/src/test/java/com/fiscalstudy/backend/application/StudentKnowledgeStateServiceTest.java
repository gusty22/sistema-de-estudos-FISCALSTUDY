package com.fiscalstudy.backend.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class StudentKnowledgeStateServiceTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StudentKnowledgeStateService studentKnowledgeStateService;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM event_store");
        jdbcTemplate.execute("DELETE FROM questions");
        jdbcTemplate.execute("DELETE FROM edital_topicos");
        jdbcTemplate.execute("DELETE FROM revision_calendar");

        // Criar tópicos no edital
        jdbcTemplate.update("""
            INSERT INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto, peso)
            VALUES ('top-trib-1', 'ed-1', 'c-1', 'Direito Tributário', 'Imunidades Tributárias', 3.0)
        """);

        jdbcTemplate.update("""
            INSERT INTO edital_topicos (id, edital_id, concurso_id, disciplina, assunto, peso)
            VALUES ('top-cont-1', 'ed-1', 'c-1', 'Contabilidade Geral', 'Balanço Patrimonial', 2.0)
        """);

        // Criar questões vinculadas
        jdbcTemplate.update("""
            INSERT INTO questions (id, enunciado, options_json, correct_option, disciplina, assunto)
            VALUES ('q-trib-1', 'Imunidade musical', '["A) Sim", "B) Não"]', 'A', 'Direito Tributário', 'Imunidades Tributárias')
        """);

        jdbcTemplate.update("""
            INSERT INTO questions (id, enunciado, options_json, correct_option, disciplina, assunto)
            VALUES ('q-cont-1', 'Ativo circulante', '["A) Sim", "B) Não"]', 'A', 'Contabilidade Geral', 'Balanço Patrimonial')
        """);
    }

    @Test
    void testVirginTopic_ReturnsZeroProficiencyAndColdStart() {
        List<StudentKnowledgeStateService.TopicKnowledgeState> states =
                studentKnowledgeStateService.computeKnowledgeStates("c-1");

        assertFalse(states.isEmpty());
        StudentKnowledgeStateService.TopicKnowledgeState virgin = states.stream()
                .filter(s -> s.getAssunto().equals("Imunidades Tributárias"))
                .findFirst().orElseThrow();

        assertEquals(0.0, virgin.getPAtualPct());
        assertEquals(0.0, virgin.getPBasePct());
        assertEquals(0.0, virgin.getMediaSimplesPct());
        assertEquals("VIRGEM_NAO_EXPLORADO", virgin.getStatusDominio());
        assertFalse(virgin.isMediaSimplesEnganosa());
    }

    @Test
    void testEbbinghausDecay_WhenLastContactWas45DaysAgo_DetectsAmnesiaRiskAndMisleadingAverage() {
        // Aluno acertou 90% das questões há 45 dias
        Instant fortyFiveDaysAgo = Instant.now().minus(45, ChronoUnit.DAYS);

        for (int i = 1; i <= 10; i++) {
            boolean isCorrect = (i <= 9); // 9 acertos em 10 (90%)
            String payload = String.format("""
                {"questionId":"q-trib-1","selectedOption":"A","isCorrect":%b,"gabaritoStatus":"DEFINITIVO","confidenceLevel":4,"activeTimeMs":20000,"interventionType":"REGULAR"}
            """, isCorrect);

            jdbcTemplate.update("""
                INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json)
                VALUES (?, 'ANSWER_SUBMITTED', 'QUESTION', 'q-trib-1', 'sess-old', ?, ?, 1, 'v1', ?)
            """, "evt-old-" + i, fortyFiveDaysAgo.toString(), fortyFiveDaysAgo.toString(), payload);
        }

        List<StudentKnowledgeStateService.TopicKnowledgeState> states =
                studentKnowledgeStateService.computeKnowledgeStates("c-1");

        StudentKnowledgeStateService.TopicKnowledgeState top = states.stream()
                .filter(s -> s.getAssunto().equals("Imunidades Tributárias"))
                .findFirst().orElseThrow();

        assertEquals(90.0, top.getMediaSimplesPct(), "Média simples deve registrar 90.0%");
        assertEquals(90.0, top.getPBasePct(), "P_base regular deve ser 90.0%");
        assertTrue(top.getDeltaTDias() >= 44.0, "Delta t deve ser aproximadamente 45 dias");

        // Devido ao decaimento de 45 dias, P_atual deve ter despencado
        assertTrue(top.getPAtualPct() < 25.0,
                "P_atual deve decair severamente pela Curva de Ebbinghaus (esperado < 25%, observado: " + top.getPAtualPct() + "%)");
        assertTrue(top.isMediaSimplesEnganosa(), "Deve sinalizar que a média simples de 90% é enganosa");
        assertTrue(top.getDiagnosticoPedagogico().contains("enganosa"), "Diagnóstico deve alertar o estudante");
    }

    @Test
    void testImmediateReadingInflation_VersusSimuladoAndColdRetest() {
        // Tópico Tributário com respostas feitas imediatamente no mesmo dia da leitura (usedHelp = true)
        Instant today = Instant.now();
        for (int i = 1; i <= 5; i++) {
            String payload = """
                {"questionId":"q-trib-1","selectedOption":"A","isCorrect":true,"gabaritoStatus":"DEFINITIVO","confidenceLevel":5,"activeTimeMs":8000,"usedHelp":true}
            """;
            jdbcTemplate.update("""
                INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json)
                VALUES (?, 'ANSWER_SUBMITTED', 'QUESTION', 'q-trib-1', 'sess-now', ?, ?, 1, 'v1', ?)
            """, "evt-today-" + i, today.toString(), today.toString(), payload);
        }

        List<StudentKnowledgeStateService.TopicKnowledgeState> states =
                studentKnowledgeStateService.computeKnowledgeStates("c-1");

        StudentKnowledgeStateService.TopicKnowledgeState top = states.stream()
                .filter(s -> s.getAssunto().equals("Imunidades Tributárias"))
                .findFirst().orElseThrow();

        assertEquals(5, top.getQuestoesImediatasLeitura());
        assertEquals(0, top.getRetestesFriosAcertos());
        assertTrue(top.getDeltaTDias() <= 0.1, "Delta t deve ser próximo de 0 (hoje)");
        // Como deltaT é ~0, P_atual = P_base
        assertEquals(top.getPBasePct(), top.getPAtualPct());
        // Diagnóstico nota que falta reteste a frio para consolidação
        assertTrue(top.getDiagnosticoPedagogico().contains("reteste a frio"));
    }

    @Test
    void testMemoryStrengthIncreases_WithSuccessfulSpacedRevisions() {
        Instant twentyDaysAgo = Instant.now().minus(20, ChronoUnit.DAYS);

        // 1 tentativa regular há 20 dias
        jdbcTemplate.update("""
            INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json)
            VALUES ('evt-1', 'ANSWER_SUBMITTED', 'QUESTION', 'q-trib-1', 's1', ?, ?, 1, 'v1',
            '{"questionId":"q-trib-1","selectedOption":"A","isCorrect":true,"gabaritoStatus":"DEFINITIVO","confidenceLevel":4,"activeTimeMs":15000}')
        """, twentyDaysAgo.toString(), twentyDaysAgo.toString());

        // Verificar força inicial
        StudentKnowledgeStateService.TopicKnowledgeState stateBefore =
                studentKnowledgeStateService.computeKnowledgeStates("c-1").stream()
                        .filter(s -> s.getAssunto().equals("Imunidades Tributárias"))
                        .findFirst().orElseThrow();

        double sBefore = stateBefore.getForcaMemoriaDias();

        // Adicionar 2 revisões espaçadas CONCLUÍDAS
        jdbcTemplate.update("""
            INSERT INTO revision_calendar (id, session_id, concurso_id, disciplina, topico, tipo_revisao, intervalo_dias, data_agendada, origem_evento, status, taxa_acerto_revisao)
            VALUES ('rev-1', 's1', 'c-1', 'Direito Tributário', 'Imunidades Tributárias', 'R7', 7, '2026-10-10', 'MANUAL', 'CONCLUIDA', 85.0)
        """);
        jdbcTemplate.update("""
            INSERT INTO revision_calendar (id, session_id, concurso_id, disciplina, topico, tipo_revisao, intervalo_dias, data_agendada, origem_evento, status, taxa_acerto_revisao)
            VALUES ('rev-2', 's1', 'c-1', 'Direito Tributário', 'Imunidades Tributárias', 'R14', 14, '2026-10-17', 'MANUAL', 'CONCLUIDA', 90.0)
        """);

        StudentKnowledgeStateService.TopicKnowledgeState stateAfter =
                studentKnowledgeStateService.computeKnowledgeStates("c-1").stream()
                        .filter(s -> s.getAssunto().equals("Imunidades Tributárias"))
                        .findFirst().orElseThrow();

        double sAfter = stateAfter.getForcaMemoriaDias();

        assertTrue(sAfter > sBefore, "Força da memória S deve aumentar com cada revisão espaçada concluída com sucesso (Antes: " + sBefore + ", Depois: " + sAfter + ")");
        assertEquals(2, stateAfter.getRevisoesEspacadasSucesso());
    }

    @Test
    void testGetKnowledgeStateDashboard_AggregatesAndWarnsCorrectly() {
        Map<String, Object> dashboard = studentKnowledgeStateService.getKnowledgeStateDashboard("c-1");

        assertNotNull(dashboard);
        assertTrue(dashboard.containsKey("resumoGlobal"));
        assertTrue(dashboard.containsKey("formula"));
        assertTrue(dashboard.containsKey("topicos"));

        Map<String, Object> formula = (Map<String, Object>) dashboard.get("formula");
        assertEquals("P_{atual}(t) = P_{base} \\cdot e^{-\\frac{\\Delta t}{S}}", formula.get("expressaoLatex"));
    }
}
