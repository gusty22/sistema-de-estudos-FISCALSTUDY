package com.fiscalstudy.backend.domain.cycle;

import java.util.*;

/**
 * Motor Algorítmico do Ciclo de Estudos Ponderado com a Lei de Robin Hood.
 * Transfere horas de matérias dominadas (4-5 estrelas) para matérias
 * de alto peso e baixo domínio (0-2 estrelas), garantindo interleaving,
 * blocos de estudo livre e simulado ao fim do ciclo.
 */
public class RobinHoodCycleEngine {

    public static final int MIN_BLOCK_MINUTES = 50;
    public static final int MAX_BLOCK_MINUTES = 120;
    public static final int DEFAULT_BLOCK_MINUTES = 60;
    public static final int RECALIBRATION_CYCLE_THRESHOLD = 4; // Recalibração a cada 4 ciclos

    /**
     * Fator inverso de domínio por estrelas:
     * 0 estrelas: 2.0 (dobro do peso para acelerar matérias zeradas)
     * 1 estrela:  1.67
     * 2 estrelas: 1.33
     * 3 estrelas: 1.0 (neutro)
     * 4 estrelas: 0.67
     * 5 estrelas: 0.33 (reduz tempo de matérias já dominadas para alimentar as fracas)
     */
    public double calculateInverseMasteryFactor(int stars) {
        int clampedStars = Math.min(Math.max(stars, 0), 5);
        return (6.0 - clampedStars) / 3.0;
    }

    public RobinHoodCycleResult generateCycle(
            String concursoId,
            List<DisciplineProfile> profiles,
            double weeklyHoursAvailable,
            int standardBlockMinutes,
            int completedCyclesCount,
            Map<String, String> lastHandoffPerDiscipline
    ) {
        return generateCycle(concursoId, profiles, weeklyHoursAvailable, standardBlockMinutes, completedCyclesCount, lastHandoffPerDiscipline, null);
    }

    public RobinHoodCycleResult generateCycle(
            String concursoId,
            List<DisciplineProfile> profiles,
            double weeklyHoursAvailable,
            int standardBlockMinutes,
            int completedCyclesCount,
            Map<String, String> lastHandoffPerDiscipline,
            com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO injectedWeights
    ) {
        // Keep observations readable, but never use the legacy DTO as decision authority.
        if (injectedWeights != null && !injectedWeights.supportsAutomaticPlanning()) injectedWeights = null;
        if (profiles == null || profiles.isEmpty()) {
            return new RobinHoodCycleResult(
                    concursoId,
                    weeklyHoursAvailable,
                    standardBlockMinutes,
                    Collections.emptyList(),
                    completedCyclesCount,
                    false,
                    Collections.emptyMap()
            );
        }

        int blockMinutes = Math.min(Math.max(standardBlockMinutes, MIN_BLOCK_MINUTES), MAX_BLOCK_MINUTES);
        double totalWeeklyHours = Math.max(weeklyHoursAvailable, 6.0);
        Map<String, String> handoffs = lastHandoffPerDiscipline != null ? lastHandoffPerDiscipline : Collections.emptyMap();

        // 1. Cálculo de pesos brutos e pesos efetivos com Lei de Robin Hood
        double totalRawWeight = 0.0;
        double totalEffectiveWeight = 0.0;

        Map<String, Double> rawWeights = new LinkedHashMap<>();
        Map<String, Double> effectiveWeights = new LinkedHashMap<>();

        for (DisciplineProfile dp : profiles) {
            double raw = dp.getQuantidadeQuestoes() * dp.getPesoProva();
            double factor = calculateInverseMasteryFactor(dp.getNivelDominioEstrelas());

            // Se o motor R calculou pesos de alocação (Robin Hood Weights), ajusta o multiplicador empírico
            if (injectedWeights != null && injectedWeights.weights() != null && injectedWeights.weights().containsKey(dp.getDisciplina())) {
                var dw = injectedWeights.weights().get(dp.getDisciplina());
                if (dw.cycleTimeSharePercent() != null && dw.cycleTimeSharePercent() > 0) {
                    // Modulador de peso baseado no score de prioridade estatística e urgência calculada pelo R
                    factor = Math.max(0.2, (dw.cycleTimeSharePercent() / (100.0 / profiles.size())));
                }
            }

            double effective = raw * factor;

            rawWeights.put(dp.getDisciplina(), raw);
            effectiveWeights.put(dp.getDisciplina(), effective);

            totalRawWeight += raw;
            totalEffectiveWeight += effective;
        }

        // 2. Reserva de tempo para Estudo Livre (amortecer atrasos) e Simulado do Ciclo
        double bufferHours = Math.max(2.0, totalWeeklyHours * 0.15); // ~15% para buffer e simulado
        double regularStudyHours = Math.max(totalWeeklyHours - bufferHours, 4.0);

        // 3. Distribuição de horas e cálculo do delta Robin Hood
        Map<String, Double> allocatedHours = new LinkedHashMap<>();
        Map<String, Double> originalHours = new LinkedHashMap<>();
        Map<String, Double> transferredHours = new LinkedHashMap<>();
        Map<String, String> resumoRobinHood = new LinkedHashMap<>();

        for (DisciplineProfile dp : profiles) {
            String disc = dp.getDisciplina();
            double origH = (totalRawWeight > 0.0)
                    ? regularStudyHours * (rawWeights.get(disc) / totalRawWeight)
                    : regularStudyHours / profiles.size();

            double effH = (totalEffectiveWeight > 0.0)
                    ? regularStudyHours * (effectiveWeights.get(disc) / totalEffectiveWeight)
                    : regularStudyHours / profiles.size();

            double delta = effH - origH;

            allocatedHours.put(disc, effH);
            originalHours.put(disc, origH);
            transferredHours.put(disc, delta);

            if (delta > 0.1) {
                resumoRobinHood.put(disc, String.format("+%.1fh recebidas via Lei de Robin Hood (baixo domínio / alto peso)", delta));
            } else if (delta < -0.1) {
                resumoRobinHood.put(disc, String.format("%.1fh transferidas para matérias prioritárias (alto domínio)", delta));
            } else {
                resumoRobinHood.put(disc, "Equilibrado (peso e domínio compatíveis)");
            }
        }

        // 4. Fatiamento em blocos e intercalação (Interleaving)
        List<RobinHoodCycleBlock> generatedBlocks = new ArrayList<>();
        Map<String, Integer> blocksNeededPerDiscipline = new LinkedHashMap<>();

        for (DisciplineProfile dp : profiles) {
            double h = allocatedHours.get(dp.getDisciplina());
            int blocks = Math.max(1, (int) Math.round((h * 60.0) / blockMinutes));
            blocksNeededPerDiscipline.put(dp.getDisciplina(), blocks);
        }

        // Intercalação por fila circular entre as matérias
        List<String> disciplineNames = new ArrayList<>(blocksNeededPerDiscipline.keySet());
        boolean hasRemaining = true;
        int sequence = 1;

        while (hasRemaining) {
            hasRemaining = false;
            for (String disc : disciplineNames) {
                int remaining = blocksNeededPerDiscipline.get(disc);
                if (remaining > 0) {
                    DisciplineProfile dp = profiles.stream().filter(p -> p.getDisciplina().equals(disc)).findFirst().orElseThrow();
                    String handoff = handoffs.getOrDefault(disc, "Sem anotações do ciclo anterior. Iniciar com leitura investigativa.");

                    RobinHoodCycleBlock block = new RobinHoodCycleBlock(
                            sequence++,
                            RobinHoodCycleBlock.BlockType.ESTUDO_REGULAR,
                            disc,
                            blockMinutes,
                            dp.getNivelDominioEstrelas(),
                            dp.getPesoProva(),
                            allocatedHours.get(disc),
                            originalHours.get(disc),
                            transferredHours.get(disc),
                            handoff
                    );
                    generatedBlocks.add(block);
                    blocksNeededPerDiscipline.put(disc, remaining - 1);
                    hasRemaining = true;
                }
            }
        }

        // 5. Inserir Bloco de Estudo Livre (no meio/três quartos do ciclo)
        int freeStudyInsertIndex = Math.max(1, (int) (generatedBlocks.size() * 0.70));
        RobinHoodCycleBlock freeBlock = RobinHoodCycleBlock.createFreeStudyBlock(sequence++, blockMinutes);
        generatedBlocks.add(freeStudyInsertIndex, freeBlock);

        // 6. Inserir Bloco de Simulado de Fechamento (ao final do ciclo)
        RobinHoodCycleBlock simuladoBlock = RobinHoodCycleBlock.createSimuladoBlock(sequence++, Math.min(blockMinutes * 2, 120));
        generatedBlocks.add(simuladoBlock);

        // 7. Loop de Reinjeção Robin Hood (Pesos calculados pelo R)
        if (injectedWeights != null) {
            String donor = "Matéria Consolidada";
            if (injectedWeights.redistributionPlan() != null && injectedWeights.redistributionPlan().donorDiscipline() != null) {
                donor = injectedWeights.redistributionPlan().donorDiscipline();
            } else if (injectedWeights.hyperConsolidatedDisciplines() != null && !injectedWeights.hyperConsolidatedDisciplines().isEmpty()) {
                donor = injectedWeights.hyperConsolidatedDisciplines().get(0).discipline();
            }

            if (injectedWeights.criticalTopics() != null && !injectedWeights.criticalTopics().isEmpty()) {
                for (int i = injectedWeights.criticalTopics().size() - 1; i >= 0; i--) {
                    var crit = injectedWeights.criticalTopics().get(i);
                    int durMin = crit.emergencyBlockMinutes() != null ? crit.emergencyBlockMinutes() : 15;
                    String rationale = crit.rationale() != null && !crit.rationale().isBlank()
                            ? crit.rationale()
                            : String.format("Limite inferior de Wilson (%.1f%%) abaixo da meta de 85%%.", crit.wilsonLowerBound() != null ? crit.wilsonLowerBound() * 100 : 75.0);
                    
                    if (Boolean.TRUE.equals(crit.metacognitivePenalty())) {
                        rationale += " ⚠️ Alerta Metacognitivo: Erro em questão de Confiança 5 (Falsa Fluência). Prioridade máxima.";
                    }

                    RobinHoodCycleBlock emergency = RobinHoodCycleBlock.createEmergencyBlock(
                            1,
                            crit.discipline(),
                            crit.topic(),
                            durMin,
                            rationale
                    );
                    // Injeta na primeira posição para se tornar a ação imediata!
                    generatedBlocks.add(0, emergency);

                    resumoRobinHood.put("🚨 Emergência Robin Hood: " + crit.topic(),
                            String.format("Alocado bloco de %dmin (tempo roubado de %s). Wilson: %.1f%%",
                                    durMin, donor, crit.wilsonLowerBound() != null ? crit.wilsonLowerBound() * 100 : 75.0));
                }
                resumoRobinHood.put("Doador Robin Hood: " + donor,
                        String.format("Retenção > 90%% projetada no R. Tempo subtraído e transferido para tópico em esquecimento iminente."));
            } else if (injectedWeights.weights() != null && !injectedWeights.weights().isEmpty()) {
                // Se o R gerou pesos com status de urgência crítica ou necessidade exploratória
                for (var entry : injectedWeights.weights().entrySet()) {
                    var dw = entry.getValue();
                    if ("OVERDUE_CRITICAL_INTERVENTION".equals(dw.urgencyStatus()) || "CRITICAL_INTERVENTION".equals(dw.urgencyStatus())) {
                        int durMin = dw.suggestedBlockMinutes() != null ? Math.min(dw.suggestedBlockMinutes(), 30) : 20;
                        String rationale = String.format("Urgência Analítica (%s): Limite inferior de Wilson em %.1f%%.",
                                dw.urgencyStatus(), dw.ciLower() != null ? dw.ciLower() * 100 : 50.0);
                        RobinHoodCycleBlock emergency = RobinHoodCycleBlock.createEmergencyBlock(
                                1,
                                dw.discipline(),
                                "Tópicos Críticos / Micro-Revisão",
                                durMin,
                                rationale
                        );
                        generatedBlocks.add(0, emergency);
                        resumoRobinHood.put("🚨 Urgência R: " + dw.discipline(), rationale);
                        break; // Injeta a principal urgência no topo
                    }
                }
            }
        }

        // 8. Reconstruir lista com numeração de sequência contígua 1..N
        List<RobinHoodCycleBlock> finalizedBlocks = new ArrayList<>();
        for (int i = 0; i < generatedBlocks.size(); i++) {
            RobinHoodCycleBlock b = generatedBlocks.get(i);
            finalizedBlocks.add(new RobinHoodCycleBlock(
                    i + 1,
                    b.getType(),
                    b.getDisciplina(),
                    b.getDuracaoMinutos(),
                    b.getNivelDominioEstrelas(),
                    b.getPesoProva(),
                    b.getHorasAlocadasDisciplina(),
                    b.getHorasOriginais(),
                    b.getHorasTransferidasRobinHood(),
                    b.getMensagemEuDoPassado()
            ));
        }

        boolean recalibrationRequired = completedCyclesCount >= RECALIBRATION_CYCLE_THRESHOLD;

        return new RobinHoodCycleResult(
                concursoId,
                totalWeeklyHours,
                blockMinutes,
                finalizedBlocks,
                completedCyclesCount,
                recalibrationRequired,
                resumoRobinHood
        );
    }
}
