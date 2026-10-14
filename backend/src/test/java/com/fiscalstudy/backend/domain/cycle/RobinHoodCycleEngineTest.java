package com.fiscalstudy.backend.domain.cycle;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes do Motor do Ciclo de Estudos com Lei de Robin Hood")
class RobinHoodCycleEngineTest {

    private RobinHoodCycleEngine engine;

    @BeforeEach
    void setUp() {
        engine = new RobinHoodCycleEngine();
    }

    @Test
    @DisplayName("Cálculo do fator inverso de domínio por estrelas (6 - E) / 3")
    void testInverseMasteryFactor() {
        // 0 estrelas: 2.0 (dobro do peso para acelerar matérias fracas)
        assertEquals(2.0, engine.calculateInverseMasteryFactor(0), 0.001);
        // 3 estrelas: 1.0 (neutro)
        assertEquals(1.0, engine.calculateInverseMasteryFactor(3), 0.001);
        // 5 estrelas: 0.33 (reduz tempo para matérias dominadas)
        assertEquals(1.0 / 3.0, engine.calculateInverseMasteryFactor(5), 0.001);
    }

    @Test
    @DisplayName("Lei de Robin Hood: transfere horas de matéria rica (5 estrelas) para matéria pobre (1 estrela)")
    void testRobinHoodTransferBetweenRichAndPoorDisciplines() {
        // Matéria A: Direito Administrativo, 20 questões, peso 2.0 -> 5 estrelas (rica)
        DisciplineProfile rica = new DisciplineProfile("Direito Administrativo", 2.0, 20, 50.0, 5, "JURIDICA");

        // Matéria B: Tecnologia da Informação, 20 questões, peso 2.0 -> 1 estrela (pobre)
        DisciplineProfile pobre = new DisciplineProfile("TI", 2.0, 20, 50.0, 1, "TI");

        RobinHoodCycleResult result = engine.generateCycle("concurso-1", List.of(rica, pobre), 20.0, 60, 0, Map.of());

        assertNotNull(result);
        assertFalse(result.getBlocos().isEmpty());

        // Verificar que TI recebeu mais horas que Direito Administrativo devido à Lei de Robin Hood
        double horasTI = result.getBlocos().stream()
                .filter(b -> b.getDisciplina().equals("TI"))
                .findFirst()
                .orElseThrow()
                .getHorasAlocadasDisciplina();

        double horasDirAdm = result.getBlocos().stream()
                .filter(b -> b.getDisciplina().equals("Direito Administrativo"))
                .findFirst()
                .orElseThrow()
                .getHorasAlocadasDisciplina();

        assertTrue(horasTI > horasDirAdm * 3.0, "TI (1 estrela) deve receber muito mais horas que Direito Administrativo (5 estrelas)");
        assertTrue(result.getResumoRobinHood().get("TI").contains("recebidas via Lei de Robin Hood"));
    }

    @Test
    @DisplayName("Gera blocos de Estudo Livre e Simulado no fechamento do ciclo")
    void testBufferAndSimuladoBlocksIncluded() {
        DisciplineProfile d1 = new DisciplineProfile("Direito Tributário", 2.0, 20, 50.0, 3, "JURIDICA");
        DisciplineProfile d2 = new DisciplineProfile("Contabilidade", 2.0, 20, 50.0, 3, "FISCAL");

        RobinHoodCycleResult result = engine.generateCycle("concurso-1", List.of(d1, d2), 20.0, 60, 0, Map.of());

        boolean hasFreeStudy = result.getBlocos().stream().anyMatch(b -> b.getType() == RobinHoodCycleBlock.BlockType.ESTUDO_LIVRE);
        boolean hasSimulado = result.getBlocos().stream().anyMatch(b -> b.getType() == RobinHoodCycleBlock.BlockType.SIMULADO);

        assertTrue(hasFreeStudy, "Ciclo deve conter bloco de Estudo Livre (Buffer de Atrasos)");
        assertTrue(hasSimulado, "Ciclo deve conter bloco de Simulado ao final do giro");
    }

    @Test
    @DisplayName("Recalibração obrigatória é ativada a cada 4 ciclos completados")
    void testRecalibrationTriggerAt4Cycles() {
        DisciplineProfile d1 = new DisciplineProfile("Português", 1.0, 15, 50.0, 3, "GERAL");

        RobinHoodCycleResult c3 = engine.generateCycle("concurso-1", List.of(d1), 10.0, 60, 3, Map.of());
        assertFalse(c3.isRecalibracaoObrigatoria(), "Com 3 ciclos não deve exigir recalibração");

        RobinHoodCycleResult c4 = engine.generateCycle("concurso-1", List.of(d1), 10.0, 60, 4, Map.of());
        assertTrue(c4.isRecalibracaoObrigatoria(), "A partir de 4 ciclos deve exigir recalibração obrigatória");
    }
}
