package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.knowledge.TopicKnowledgeAggregatorService;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeProjection;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Endpoint canônico para o Modelo Individual de Conhecimento (EPIC 02).
 * Exposição transparente de indicadores observáveis, metadados ordinais e governança epistêmica.
 */
@RestController
@RequestMapping("/api/v1/knowledge")
public class TopicKnowledgeController {

    private final TopicKnowledgeRepository topicKnowledgeRepository;
    private final TopicKnowledgeAggregatorService aggregatorService;

    public TopicKnowledgeController(
            TopicKnowledgeRepository topicKnowledgeRepository,
            TopicKnowledgeAggregatorService aggregatorService
    ) {
        this.topicKnowledgeRepository = topicKnowledgeRepository;
        this.aggregatorService = aggregatorService;
    }

    /**
     * Retorna lista de projeções por tópico com filtros opcionais.
     */
    @GetMapping("/topics")
    public ResponseEntity<List<TopicKnowledgeProjection>> listTopics(
            @RequestParam(required = false) String discipline,
            @RequestParam(required = false) String status
    ) {
        List<TopicKnowledgeProjection> list;
        if (discipline != null && !discipline.isBlank()) {
            list = topicKnowledgeRepository.findByDisciplineId(discipline);
        } else {
            list = topicKnowledgeRepository.findAll();
        }

        if (status != null && !status.isBlank()) {
            list = list.stream()
                    .filter(p -> status.equalsIgnoreCase(p.getEvidenceStatus()))
                    .toList();
        }

        return ResponseEntity.ok(list);
    }

    /**
     * Retorna a projeção e detalhamento epistêmico de um tópico específico.
     */
    @GetMapping("/topics/{topicId}")
    public ResponseEntity<TopicKnowledgeProjection> getTopicKnowledge(@PathVariable String topicId) {
        Optional<TopicKnowledgeProjection> projection = topicKnowledgeRepository.findByTopicId(topicId);
        return projection.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Dispara a reconstrução determinística de todas as projeções a partir do event_store.
     */
    @PostMapping("/rebuild")
    public ResponseEntity<TopicKnowledgeAggregatorService.RebuildResult> triggerRebuild() {
        TopicKnowledgeAggregatorService.RebuildResult result = aggregatorService.rebuildAll();
        return ResponseEntity.ok(result);
    }

    /**
     * Documentação transparente dos contratos epistêmicos e limites metodológicos.
     */
    @GetMapping("/epistemic-contract")
    public ResponseEntity<Map<String, Object>> getEpistemicContract() {
        Map<String, Object> contract = Map.of(
                "version", "2.0-scientific-refinement",
                "epistemicPrinciples", List.of(
                        "1. Segregação estrita entre observação (fatos brutos) e inferência pedagógica (hipóteses).",
                        "2. Eliminação categórica de pesos arbitrários (1.5x simulado, 1.2x reteste); contextos registrados puramente como metadados.",
                        "3. Tratamento ordinal da confiança (1-5); Brier Score desativado por ausência de calibração probabilística validada.",
                        "4. Tratamento explícito de insuficiência amostral: SEM_EVIDENCIAS para N=0 e PRELIMINAR com N real para poucas tentativas.",
                        "5. Indicadores com denominador explícito (acertos/tentativas) e rastreabilidade longitudinal.",
                        "6. Desacoplamento da memória (FSRS) em relação a notas de domínio conceitual."
                ),
                "observableIndicators", List.of(
                        "totalAttempts", "correctAttempts", "errorAttempts", "accuracyDenominatorText",
                        "avgConfidenceOrdinal", "lowConfidenceSuccesses", "highConfidenceErrors",
                        "uniqueQuestionsCount", "newQuestionsAttempts", "repeatedQuestionsAttempts", "variantQuestionsAttempts",
                        "totalActiveTimeMs", "averageActiveTimeMs", "lastAttemptAt",
                        "confidenceDistributionJson", "contextDistributionJson", "errorCausesDistributionJson"
                ),
                "evidenceStatuses", List.of(
                        "SEM_EVIDENCIAS (N=0)",
                        "PRELIMINAR (N < 10 ou questões únicas < 5)",
                        "EM_CONSTRUCAO (10 <= N < 25)",
                        "CONSOLIDADA (N >= 25 e questões únicas >= 10)"
                )
        );
        return ResponseEntity.ok(contract);
    }
}
