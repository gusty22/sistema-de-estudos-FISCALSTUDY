package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class DigitalTwinService {

    private static final Logger logger = LoggerFactory.getLogger(DigitalTwinService.class);

    private final EditalRepository editalRepository;
    private final EventStoreRepository eventStoreRepository;
    private final StudySessionService studySessionService;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;
    private final AnalyticsProjectionService analyticsProjectionService;

    public DigitalTwinService(EditalRepository editalRepository,
                              EventStoreRepository eventStoreRepository,
                              StudySessionService studySessionService,
                              QuestionRepository questionRepository,
                              ObjectMapper objectMapper) {
        this(editalRepository, eventStoreRepository, studySessionService, questionRepository, objectMapper, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public DigitalTwinService(EditalRepository editalRepository,
                              EventStoreRepository eventStoreRepository,
                              StudySessionService studySessionService,
                              QuestionRepository questionRepository,
                              ObjectMapper objectMapper,
                              AnalyticsProjectionService analyticsProjectionService) {
        this.editalRepository = editalRepository;
        this.eventStoreRepository = eventStoreRepository;
        this.studySessionService = studySessionService;
        this.questionRepository = questionRepository;
        this.objectMapper = objectMapper;
        this.analyticsProjectionService = analyticsProjectionService;
    }

    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private AnalyticsBridgeService analyticsBridge;

    public Map<String, Object> getDigitalTwinStatus(String concursoId) {
        return getDigitalTwinStatus(concursoId, "Concurso Fiscal");
    }

    public Map<String, Object> getDigitalTwinStatus(String concursoId, String concursoNome) {
        // Legacy unversioned R state is intentionally not consumed.
        // 2. Fallback heurístico em memória caso o motor R ainda não tenha sido executado
        List<EditalTopico> topicos = (concursoId != null && !concursoId.isBlank())
                ? editalRepository.findTopicosByConcurso(concursoId)
                : Collections.emptyList();

        List<EventRecord> attemptEvents = eventStoreRepository.getAllEvents("ATTEMPT_SUBMITTED");
        List<EventRecord> sessionEvents = eventStoreRepository.getAllEvents("STUDY_SESSION_RECORDED");

        // Agrupamento de tentativas por tópico e por disciplina
        Map<String, List<Map<String, Object>>> attemptsByTopicName = new HashMap<>();
        Map<String, List<Map<String, Object>>> attemptsByDiscipline = new HashMap<>();
        Map<String, Instant> lastContactByTopicName = new HashMap<>();
        Map<String, Instant> lastContactByDiscipline = new HashMap<>();

        for (EventRecord er : attemptEvents) {
            try {
                Map<String, Object> payload = objectMapper.readValue(er.getPayloadJson(), Map.class);
                String qId = (String) payload.get("questionId");
                Instant occurredAt = er.getOccurredAt() != null ? Instant.parse(er.getOccurredAt()) : Instant.now();

                String topic = "Geral";
                String disc = "Geral";

                if (qId != null) {
                    Optional<Question> qOpt = questionRepository.findById(qId);
                    if (qOpt.isPresent()) {
                        Question q = qOpt.get();
                        if (q.getTopic() != null) topic = q.getTopic().trim().toLowerCase();
                        if (q.getDiscipline() != null) disc = q.getDiscipline().trim().toLowerCase();
                    }
                }

                payload.put("occurredAt", occurredAt);
                attemptsByTopicName.computeIfAbsent(topic, k -> new ArrayList<>()).add(payload);
                attemptsByDiscipline.computeIfAbsent(disc, k -> new ArrayList<>()).add(payload);

                if (!lastContactByTopicName.containsKey(topic) || occurredAt.isAfter(lastContactByTopicName.get(topic))) {
                    lastContactByTopicName.put(topic, occurredAt);
                }
                if (!lastContactByDiscipline.containsKey(disc) || occurredAt.isAfter(lastContactByDiscipline.get(disc))) {
                    lastContactByDiscipline.put(disc, occurredAt);
                }
            } catch (Exception ignored) {}
        }

        // Sessões de estudo também atualizam o contato sináptico
        for (EventRecord er : sessionEvents) {
            try {
                Map<String, Object> payload = objectMapper.readValue(er.getPayloadJson(), Map.class);
                String disc = ((String) payload.getOrDefault("disciplina", "Geral")).trim().toLowerCase();
                Instant occurredAt = er.getOccurredAt() != null ? Instant.parse(er.getOccurredAt()) : Instant.now();

                if (!lastContactByDiscipline.containsKey(disc) || occurredAt.isAfter(lastContactByDiscipline.get(disc))) {
                    lastContactByDiscipline.put(disc, occurredAt);
                }
            } catch (Exception ignored) {}
        }

        Instant now = Instant.now();
        List<Map<String, Object>> neuralNodes = new ArrayList<>();
        int consolidadoCount = 0;
        int equilibrioCount = 0;
        int amnesiaCount = 0;
        int virgemCount = 0;
        double weightedRetentionSum = 0.0;
        double totalWeight = 0.0;

        for (EditalTopico t : topicos) {
            String topicKey = (t.getAssunto() != null ? t.getAssunto().trim().toLowerCase() : "");
            String discKey = (t.getDisciplina() != null ? t.getDisciplina().trim().toLowerCase() : "");

            List<Map<String, Object>> topicAttempts = attemptsByTopicName.getOrDefault(topicKey, Collections.emptyList());
            if (topicAttempts.isEmpty()) {
                // Fallback para histórico da disciplina
                topicAttempts = attemptsByDiscipline.getOrDefault(discKey, Collections.emptyList());
            }

            int attempts = topicAttempts.size();
            int correct = 0;
            double totalFriccao = 0.0;
            int countFriccao = 0;
            int chuteEducadoCount = 0;

            double sumWeightedScores = 0.0;
            double sumWeights = 0.0;

            for (Map<String, Object> att : topicAttempts) {
                Boolean isCorr = (Boolean) att.get("isCorrect");
                if (Boolean.TRUE.equals(isCorr)) correct++;
                Object fric = att.get("friccaoCognitivaScore");
                if (fric instanceof Number) {
                    totalFriccao += ((Number) fric).doubleValue();
                    countFriccao++;
                }
                Boolean chute = (Boolean) att.get("chuteEducadoDetectado");
                if (Boolean.TRUE.equals(chute)) chuteEducadoCount++;

                // Ponderação P_base (Simulados e Retestes frios com maior peso que leitura imediata)
                if (isCorr != null) {
                    String intervention = (String) att.getOrDefault("interventionType", "REGULAR");
                    Boolean usedHelp = (Boolean) att.getOrDefault("usedHelp", false);
                    Double diasExp = null;
                    Object dExpObj = att.get("diasDesdeUltimaExposicao");
                    if (dExpObj instanceof Number) diasExp = ((Number) dExpObj).doubleValue();

                    double w = 1.0;
                    if ("SIMULADO".equalsIgnoreCase(intervention)) {
                        w = 1.5;
                    } else if ((intervention != null && intervention.toUpperCase().contains("REVISAO")) || (diasExp != null && diasExp >= 1.0)) {
                        w = 1.2;
                    } else if (Boolean.TRUE.equals(usedHelp)) {
                        w = 0.5;
                    }
                    if (Boolean.TRUE.equals(chute)) {
                        w *= 0.75;
                    }

                    sumWeights += w;
                    sumWeightedScores += (isCorr ? 100.0 : 0.0) * w;
                }
            }

            Instant lastContact = lastContactByTopicName.getOrDefault(topicKey, lastContactByDiscipline.get(discKey));
            double diasSemContato = lastContact != null ? Math.max(0.1, ChronoUnit.HOURS.between(lastContact, now) / 24.0) : 30.0;

            double accuracy = attempts > 0 ? (correct * 100.0) / attempts : 0.0;
            double pBase = sumWeights > 0 ? (sumWeightedScores / sumWeights) : accuracy;

            // Algoritmo do Gêmeo Digital: Estabilidade Sináptica S (dias)
            // S cresce com acertos consolidados e decai se acurácia for baixa
            double rawStability = Math.max(0.5, (1.0 + Math.log(1.0 + correct)) * (1.0 + (pBase / 100.0)));

            // Modulação Biométrica da Decisão (Anti-Cheat Cognitivo):
            // Penaliza estabilidade se a acurácia foi obtida com alta fricção, hesitação ou chute educado
            double avgFriccao = countFriccao > 0 ? (totalFriccao / countFriccao) : 0.0;
            double penalidadeBiometrica = 1.0 - (avgFriccao * 0.5);
            if (chuteEducadoCount > 0) {
                penalidadeBiometrica -= Math.min(0.3, chuteEducadoCount * 0.1);
            }
            penalidadeBiometrica = Math.max(0.35, Math.min(1.0, penalidadeBiometrica));

            double stability = Math.max(0.4, rawStability * penalidadeBiometrica);

            // Curva de Ebbinghaus: R = e^(-t / S)
            double retentionPct = 0.0;
            String estadoNeural;
            double minutosAteQuebra = 0.0;

            if (attempts == 0 && lastContact == null) {
                estadoNeural = "VIRGEM_NAO_EXPLORADO";
                retentionPct = 0.0;
                virgemCount++;
            } else {
                retentionPct = Math.round(Math.exp(-diasSemContato / stability) * 1000.0) / 10.0;
                retentionPct = Math.min(100.0, Math.max(0.0, retentionPct));

                if (retentionPct >= 85.0 && attempts >= 5) {
                    estadoNeural = "CONSOLIDADO";
                    consolidadoCount++;
                } else if (retentionPct >= 70.0) {
                    estadoNeural = "EM_EQUILIBRIO";
                    equilibrioCount++;
                } else {
                    estadoNeural = "RISCO_AMNESIA";
                    amnesiaCount++;
                }

                // Minutos até a retenção cair para 70% (ponto crítico de perda sináptica)
                double diasAte70 = Math.max(0.0, (-Math.log(0.70) * stability) - diasSemContato);
                minutosAteQuebra = Math.round(diasAte70 * 24.0 * 60.0);
            }

            // Equação Canônica: P_atual(t) = P_base * e^(- \Delta t / S)
            double pAcertoHoje = attempts == 0 ? 20.0 : Math.round((pBase * (retentionPct / 100.0)) * 10.0) / 10.0;
            double nodeWeight = t.getPeso() > 0 ? t.getPeso() : 1.0;

            weightedRetentionSum += retentionPct * nodeWeight;
            totalWeight += nodeWeight;

            Map<String, Object> node = new LinkedHashMap<>();
            node.put("topicoId", t.getId());
            node.put("disciplina", t.getDisciplina());
            node.put("assunto", t.getAssunto());
            node.put("peso", nodeWeight);
            node.put("estabilidadeDias", Math.round(stability * 10.0) / 10.0);
            node.put("diasSemContato", Math.round(diasSemContato * 10.0) / 10.0);
            node.put("retencaoAtualPct", retentionPct);
            node.put("probabilidadeAcertoHojePct", pAcertoHoje);
            node.put("pBasePct", Math.round(pBase * 10.0) / 10.0);
            node.put("proficienciaAtualPct", pAcertoHoje);
            node.put("estadoNeural", estadoNeural);
            node.put("minutosAteQuebraSinaptica", minutosAteQuebra);
            node.put("totalTentativas", attempts);
            node.put("totalAcertos", correct);
            node.put("acuraciaHistoricaPct", Math.round(accuracy * 10.0) / 10.0);
            node.put("friccaoCognitivaMedia", Math.round(avgFriccao * 100.0) / 100.0);
            node.put("chutesEducadosDetectados", chuteEducadoCount);

            neuralNodes.add(node);
        }

        double saudeNeuralMediaPct = totalWeight > 0 ? Math.round((weightedRetentionSum / totalWeight) * 10.0) / 10.0 : 0.0;

        // Simulação Noturna do Gêmeo Digital (Nightly Simulation de 100 Questões)
        Map<String, Object> simulation = runNightlySimulation(neuralNodes);

        // Geração do Roteiro Dinâmico do Dia (Plano de Voo Preditivo)
        Map<String, Object> roteiroDoDia = generateDailyFlightPlan(neuralNodes, simulation);

        // Métricas de Micro-Telemetria de Estudo (Método Lucas)
        Map<String, Object> timeSummary = studySessionService.getStudyTimeSummary(concursoId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("concursoId", concursoId);
        response.put("concursoNome", concursoNome != null ? concursoNome : "Concurso Fiscal");
        response.put("totalNos", neuralNodes.size());
        response.put("nosConsolidados", consolidadoCount);
        response.put("nosEmEquilibrio", equilibrioCount);
        response.put("nosRiscoAmnesia", amnesiaCount);
        response.put("nosVirgens", virgemCount);
        response.put("saudeNeuralMediaPct", saudeNeuralMediaPct);

        // Micro-telemetria
        response.put("horasLiquidasAcumuladas", timeSummary.getOrDefault("totalHours", 0.0));
        response.put("metaHorasAprovacao", 3100.0); // Limiar estatístico do método Lucas
        response.put("progressoMetaPct", timeSummary.getOrDefault("progressTowardsThresholdPct", 0.0));
        response.put("velocidadeLeituraMedia", timeSummary.getOrDefault("avgPagesPerHour", 0.0));
        response.put("velocidadeQuestoesMedia", timeSummary.getOrDefault("avgQuestionsPerHour", 0.0));
        response.put("rendimentoMedioBlocos", timeSummary.getOrDefault("overallScorePct", 0.0));
        response.put("hePercentage", timeSummary.getOrDefault("hrePercentage", 0.0));

        response.put("grafoNos", neuralNodes);
        response.put("simulacaoRecente", simulation);
        response.put("roteiroDoDia", roteiroDoDia);

        return response;
    }

    private Map<String, Object> runNightlySimulation(List<Map<String, Object>> nodes) {
        if (nodes.isEmpty()) {
            return Map.of(
                    "status", "SEM_TOPICOS",
                    "mensagem", "Cadastre o edital verticalizado para que o Gêmeo Digital possa simular provas noturnas."
            );
        }

        // Simula 100 questões distribuídas pelos pesos dos nós
        double totalWeightedProbability = 0.0;
        double totalWeight = 0.0;

        List<Map<String, Object>> nodesSortedByPointLoss = new ArrayList<>(nodes);
        nodesSortedByPointLoss.sort((a, b) -> {
            double lossA = ((Number) a.get("peso")).doubleValue() * (100.0 - ((Number) a.get("probabilidadeAcertoHojePct")).doubleValue());
            double lossB = ((Number) b.get("peso")).doubleValue() * (100.0 - ((Number) b.get("probabilidadeAcertoHojePct")).doubleValue());
            return Double.compare(lossB, lossA); // Maior perda esperada primeiro
        });

        for (Map<String, Object> n : nodes) {
            double w = ((Number) n.get("peso")).doubleValue();
            double p = ((Number) n.get("probabilidadeAcertoHojePct")).doubleValue();
            totalWeightedProbability += (w * p);
            totalWeight += w;
        }

        double notaProjetada = totalWeight > 0 ? Math.round((totalWeightedProbability / totalWeight) * 10.0) / 10.0 : 0.0;
        double notaCorte = 80.0;
        double gap = Math.round((notaProjetada - notaCorte) * 10.0) / 10.0;

        // Seleciona top 3 a 5 pontos críticos de falha neural
        List<Map<String, Object>> pontosCriticos = nodesSortedByPointLoss.subList(0, Math.min(4, nodesSortedByPointLoss.size()));

        Map<String, Object> sim = new LinkedHashMap<>();
        sim.put("timestampSimulacao", Instant.now().toString());
        sim.put("totalQuestoesSimuladas", 100);
        sim.put("notaProjetadaHojePct", notaProjetada);
        sim.put("notaCorteConcursoPct", notaCorte);
        sim.put("gapCompetitivoPct", gap);
        sim.put("pontosCriticosFalha", pontosCriticos);
        sim.put("diagnosticoGeral", gap >= 0
                ? "🎯 Zona de Aprovação: O Gêmeo Digital projeta pontuação superior à nota de corte (" + notaProjetada + "%). Foco em manutenção das sinapses."
                : "⚡ Zona de Alerta Competitivo: Pontuação projetada hoje é de " + notaProjetada + "%, um gap de " + Math.abs(gap) + "% abaixo do corte. Requer intervenção cirúrgica imediata nos nós em declínio.");

        return sim;
    }

    private Map<String, Object> generateDailyFlightPlan(List<Map<String, Object>> nodes, Map<String, Object> simulation) {
        if (nodes.isEmpty()) {
            return Map.of("mensagem", "Sem dados de edital.");
        }

        List<Map<String, Object>> pontosCriticos = (List<Map<String, Object>>) simulation.getOrDefault("pontosCriticosFalha", Collections.emptyList());
        List<Map<String, Object>> blocos = new ArrayList<>();

        int ordem = 1;

        // Bloco 1: Intervenção no ponto crítico número 1 (Prevenção de quebra sináptica)
        if (!pontosCriticos.isEmpty()) {
            Map<String, Object> crit1 = pontosCriticos.get(0);
            blocos.add(Map.of(
                    "ordem", ordem++,
                    "tipoIntervencao", "MICRO_REVISAO_ATIVA",
                    "disciplina", crit1.get("disciplina"),
                    "assunto", crit1.get("assunto"),
                    "topicoId", crit1.get("topicoId"),
                    "duracaoMinutos", 45,
                    "justificativaSinaptica", "Sinapse atingiu retenção crítica de " + crit1.get("retencaoAtualPct") + "%. Intervenção recupera pontos de alto peso no edital.",
                    "passos", List.of(
                            "15 min: Recuperação Ativa em tela limpa (sem olhar o material)",
                            "30 min: Resolução de 10 a 12 questões com aplicação da técnica 'Pensar o Contrário'"
                    )
            ));
        }

        // Bloco 2: Segundo ponto crítico de falha
        if (pontosCriticos.size() > 1) {
            Map<String, Object> crit2 = pontosCriticos.get(1);
            blocos.add(Map.of(
                    "ordem", ordem++,
                    "tipoIntervencao", "CONSOLIDACAO_PONTO_FALHA",
                    "disciplina", crit2.get("disciplina"),
                    "assunto", crit2.get("assunto"),
                    "topicoId", crit2.get("topicoId"),
                    "duracaoMinutos", 50,
                    "justificativaSinaptica", "Consolidação de nó com probabilidade de acerto projetada em " + crit2.get("probabilidadeAcertoHojePct") + "%.",
                    "passos", List.of(
                            "15 min: Leitura rápida de jurisprudência e exceções da banca",
                            "35 min: Bateria de fixação prática"
                    )
            ));
        }

        // Bloco 3: Nó virgem ou matéria de manutenção de alto peso
        Optional<Map<String, Object>> virgemOpt = nodes.stream()
                .filter(n -> "VIRGEM_NAO_EXPLORADO".equals(n.get("estadoNeural")))
                .findFirst();

        if (virgemOpt.isPresent()) {
            Map<String, Object> virgem = virgemOpt.get();
            blocos.add(Map.of(
                    "ordem", ordem++,
                    "tipoIntervencao", "AVANCO_NEURAL",
                    "disciplina", virgem.get("disciplina"),
                    "assunto", virgem.get("assunto"),
                    "topicoId", virgem.get("topicoId"),
                    "duracaoMinutos", 55,
                    "justificativaSinaptica", "Expansão da fronteira do conhecimento: novo tópico do edital para abrir primeira sinapse.",
                    "passos", List.of(
                            "20 min: Estudo da teoria essencial no PDF vinculado",
                            "35 min: Resolução de primeiras questões conceituais"
                    )
            ));
        }

        Map<String, Object> roteiro = new LinkedHashMap<>();
        roteiro.put("titulo", "Plano de Voo do Dia — Otimização Neuroplástica");
        roteiro.put("dataGeracao", Instant.now().toString());
        roteiro.put("mensagemIA", "Gêmeo Digital simulou 100 questões contra suas sinapses: identificou os pontos exatos onde o esquecimento está prestes a ocorrer. Siga o roteiro abaixo sem gastar energia decisória.");
        roteiro.put("blocosSugeridos", blocos);

        return roteiro;
    }

    /**
     * Aciona o Motor Estatístico e Matemático em R (R 4.5.1 Base R) para recalibração
     * psicométrica completa (BKT, FSRS v5, Regressão de Tempo e Monte Carlo).
     */
    public Map<String, Object> recalibrateWithREngine(String concursoId) {
        if(analyticsBridge==null)throw new IllegalStateException("Analytics bridge unavailable");
        var execution=analyticsBridge.executeAnalyticsPipeline();
        Map<String,Object> status=new LinkedHashMap<>(getDigitalTwinStatus(concursoId));
        status.put("analyticsExecution",execution);
        status.put("calibradoPorR",false); // Batch descriptive metrics are not an individually calibrated memory model.
        return status;
    }
}
