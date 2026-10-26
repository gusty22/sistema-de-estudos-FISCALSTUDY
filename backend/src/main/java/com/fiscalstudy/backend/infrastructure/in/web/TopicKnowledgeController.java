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
        if (discipline != null && discipline.length() > 200) {
            throw new IllegalArgumentException("Filtro de disciplina excede o tamanho máximo permitido de 200 caracteres.");
        }
        if (status != null && status.length() > 50) {
            throw new IllegalArgumentException("Filtro de status excede o tamanho máximo permitido de 50 caracteres.");
        }

        List<TopicKnowledgeProjection> list;
        if (discipline != null && !discipline.isBlank()) {
            list = topicKnowledgeRepository.findByDisciplineId(discipline.trim());
        } else {
            list = topicKnowledgeRepository.findAll();
        }

        if (status != null && !status.isBlank()) {
            String targetStatus = status.trim();
            list = list.stream()
                    .filter(p -> targetStatus.equalsIgnoreCase(p.getEvidenceStatus()))
                    .toList();
        }

        return ResponseEntity.ok(list);
    }

    /**
     * Retorna a projeção e detalhamento epistêmico de um tópico específico.
     */
    @GetMapping("/topics/{topicId}")
    public ResponseEntity<TopicKnowledgeProjection> getTopicKnowledge(@PathVariable String topicId) {
        if (topicId == null || topicId.isBlank() || topicId.length() > 255) {
            throw new IllegalArgumentException("Identificador de tópico inválido ou excessivo.");
        }
        Optional<TopicKnowledgeProjection> projection = topicKnowledgeRepository.findByTopicId(topicId.trim());
        return projection.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Dispara a reconstrução determinística de todas as projeções a partir do event_store.
     * Protegido contra execuções simultâneas abusivas (HTTP 409 Conflict se em andamento).
     */
    @PostMapping("/rebuild")
    public ResponseEntity<?> triggerRebuild() {
        if (aggregatorService.isRebuilding()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.CONFLICT).body(Map.of(
                    "status", "IN_PROGRESS",
                    "error", "Reconstrução de conhecimento já em andamento. Aguarde a conclusão do processo ativo."
            ));
        }
        TopicKnowledgeAggregatorService.RebuildResult result = aggregatorService.rebuildAll();
        return ResponseEntity.ok(result);
    }

    /**
     * Documentação transparente dos contratos epistêmicos e limites metodológicos.
     */
    @GetMapping("/epistemic-contract")
    public ResponseEntity<Map<String, Object>> getEpistemicContract() {
        Map<String, Object> contract = Map.of(
                "version", "2.1-security-and-scientific-refinement",
                "epistemicPrinciples", List.of(
                        "1. Segregação estrita entre observação (fatos brutos) e inferência pedagógica (hipóteses).",
                        "2. Eliminação categórica de pesos arbitrários (1.5x simulado, 1.2x reteste); contextos registrados puramente como metadados.",
                        "3. Tratamento ordinal da confiança (1-5); Brier Score desativado por ausência de calibração probabilística validada.",
                        "4. Tratamento explícito de insuficiência amostral: SEM_EVIDENCIAS para N=0 e PRELIMINAR com N real para poucas tentativas.",
                        "5. Indicadores com denominador explícito (acertos/tentativas) e rastreabilidade longitudinal.",
                        "6. Desacoplamento da memória (FSRS) em relação a notas de domínio conceitual.",
                        "7. Status SUFICIENTE_OPERACIONAL reflete convenção heurística de amostragem operacional, sem pretensão de prova estatística definitiva de domínio."
                ),
                "observableIndicators", List.of(
                        "totalAttempts", "correctAttempts", "errorAttempts", "accuracyDenominatorText",
                        "avgConfidenceOrdinal", "lowConfidenceSuccesses", "highConfidenceErrors",
                        "uniqueQuestionsCount", "newQuestionsAttempts", "repeatedQuestionsAttempts", "variantQuestionsAttempts",
                        "totalActiveTimeMs", "averageActiveTimeMs", "lastAttemptAt",
                        "confidenceDistributionJson", "contextDistributionJson", "errorCausesDistributionJson"
                ),
                "evidenceStatuses", List.of(
                        "SEM_EVIDENCIAS (N=0) — Convenção operacional: ausência de registros",
                        "PRELIMINAR (N < 10 ou questões únicas < 5) — Convenção operacional: amostra incipiente",
                        "EM_CONSTRUCAO (10 <= N < 25 ou questões únicas < 10) — Convenção operacional: amostra intermediária",
                        "SUFICIENTE_OPERACIONAL (N >= 25 e questões únicas >= 10) — Convenção operacional: suficiência de evidências (não denota domínio conceitual absoluto)"
                )
        );
        return ResponseEntity.ok(contract);
    }
}
