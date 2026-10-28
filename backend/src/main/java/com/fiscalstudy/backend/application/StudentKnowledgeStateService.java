package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Modelo Matemático do "Estado Real de Conhecimento" (Student Knowledge State).
 *
 * O Problema:
 * Medir o domínio de um tópico apenas pela média simples de acertos (acertos / total_questoes) é enganoso.
 * Se você acertou 90% há 45 dias, hoje seu domínio real caiu devido à Curva do Esquecimento de Ebbinghaus.
 * Além disso, acertar 10 questões seguidas logo após ler o PDF infla artificialmente a nota.
 *
 * Equação Canônica:
 * P_atual(t) = P_base * e^(- \Delta t / S)
 *
 * Onde:
 * - P_base: Taxa de acerto ponderada (dando peso maior para acertos em simulados e retestes frios
 *           do que para questões feitas no mesmo dia da leitura do PDF).
 * - \Delta t: Número de dias decorridos desde o último contato com o conteúdo.
 * - S: Força da memória (estabilidade sináptica em dias) que aumenta a cada revisão espaçada bem-sucedida.
 */
@Service
public class StudentKnowledgeStateService {

    private static final Logger log = LoggerFactory.getLogger(StudentKnowledgeStateService.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public StudentKnowledgeStateService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
    }

    public static class TopicKnowledgeState {
        private String topicoId;
        private String disciplina;
        private String assunto;
        private double pesoEdital;
        private int totalQuestoes;
        private int totalAcertos;
        private int totalErros;
        private double mediaSimplesPct;       // (acertos / total) * 100
        private double pBasePct;              // P_base ponderada
        private double deltaTDias;            // \Delta t (dias sem contato)
        private double forcaMemoriaDias;      // S (estabilidade sináptica)
        private double pAtualPct;             // P_atual(t) = P_base * e^(- \Delta t / S)
        private double decaimentoPontos;      // mediaSimplesPct - pAtualPct
        private int revisoesEspacadasSucesso;
        private int retestesFriosAcertos;
        private int questoesImediatasLeitura;
        private int simuladosAcertos;
        private String statusDominio;         // CONSOLIDADO, EM_EQUILIBRIO, RISCO_AMNESIA, CRITICO_ESQUECIDO, VIRGEM_NAO_EXPLORADO
        private String ultimoContatoFormatado;
        private String diagnosticoPedagogico;
        private boolean mediaSimplesEnganosa;

        public String getTopicoId() { return topicoId; }
        public void setTopicoId(String topicoId) { this.topicoId = topicoId; }

        public String getDisciplina() { return disciplina; }
        public void setDisciplina(String disciplina) { this.disciplina = disciplina; }

        public String getAssunto() { return assunto; }
        public void setAssunto(String assunto) { this.assunto = assunto; }

        public double getPesoEdital() { return pesoEdital; }
        public void setPesoEdital(double pesoEdital) { this.pesoEdital = pesoEdital; }

        public int getTotalQuestoes() { return totalQuestoes; }
        public void setTotalQuestoes(int totalQuestoes) { this.totalQuestoes = totalQuestoes; }

        public int getTotalAcertos() { return totalAcertos; }
        public void setTotalAcertos(int totalAcertos) { this.totalAcertos = totalAcertos; }

        public int getTotalErros() { return totalErros; }
        public void setTotalErros(int totalErros) { this.totalErros = totalErros; }

        public double getMediaSimplesPct() { return mediaSimplesPct; }
        public void setMediaSimplesPct(double mediaSimplesPct) { this.mediaSimplesPct = mediaSimplesPct; }

        public double getPBasePct() { return pBasePct; }
        public void setPBasePct(double pBasePct) { this.pBasePct = pBasePct; }

        public double getDeltaTDias() { return deltaTDias; }
        public void setDeltaTDias(double deltaTDias) { this.deltaTDias = deltaTDias; }

        public double getForcaMemoriaDias() { return forcaMemoriaDias; }
        public void setForcaMemoriaDias(double forcaMemoriaDias) { this.forcaMemoriaDias = forcaMemoriaDias; }

        public double getPAtualPct() { return pAtualPct; }
        public void setPAtualPct(double pAtualPct) { this.pAtualPct = pAtualPct; }

        public double getDecaimentoPontos() { return decaimentoPontos; }
        public void setDecaimentoPontos(double decaimentoPontos) { this.decaimentoPontos = decaimentoPontos; }

        public int getRevisoesEspacadasSucesso() { return revisoesEspacadasSucesso; }
        public void setRevisoesEspacadasSucesso(int revisoesEspacadasSucesso) { this.revisoesEspacadasSucesso = revisoesEspacadasSucesso; }

        public int getRetestesFriosAcertos() { return retestesFriosAcertos; }
        public void setRetestesFriosAcertos(int retestesFriosAcertos) { this.retestesFriosAcertos = retestesFriosAcertos; }

        public int getQuestoesImediatasLeitura() { return questoesImediatasLeitura; }
        public void setQuestoesImediatasLeitura(int questoesImediatasLeitura) { this.questoesImediatasLeitura = questoesImediatasLeitura; }

        public int getSimuladosAcertos() { return simuladosAcertos; }
        public void setSimuladosAcertos(int simuladosAcertos) { this.simuladosAcertos = simuladosAcertos; }

        public String getStatusDominio() { return statusDominio; }
        public void setStatusDominio(String statusDominio) { this.statusDominio = statusDominio; }

        public String getUltimoContatoFormatado() { return ultimoContatoFormatado; }
        public void setUltimoContatoFormatado(String ultimoContatoFormatado) { this.ultimoContatoFormatado = ultimoContatoFormatado; }

        public String getDiagnosticoPedagogico() { return diagnosticoPedagogico; }
        public void setDiagnosticoPedagogico(String diagnosticoPedagogico) { this.diagnosticoPedagogico = diagnosticoPedagogico; }

        public boolean isMediaSimplesEnganosa() { return mediaSimplesEnganosa; }
        public void setMediaSimplesEnganosa(boolean mediaSimplesEnganosa) { this.mediaSimplesEnganosa = mediaSimplesEnganosa; }
    }

    public Map<String, Object> getKnowledgeStateDashboard(String concursoId) {
        List<TopicKnowledgeState> states = computeKnowledgeStates(concursoId);

        int totalTopicos = states.size();
        int consolidados = 0;
        int equilibrio = 0;
        int riscoAmnesia = 0;
        int criticosEsquecidos = 0;
        int virgens = 0;
        int enganososCount = 0;

        double sumPonderadaPAtual = 0.0;
        double sumPonderadaPBase = 0.0;
        double sumPonderadaMediaSimples = 0.0;
        double sumPesos = 0.0;

        for (TopicKnowledgeState t : states) {
            double p = t.getPesoEdital() > 0 ? t.getPesoEdital() : 1.0;
            sumPesos += p;
            sumPonderadaPAtual += t.getPAtualPct() * p;
            sumPonderadaPBase += t.getPBasePct() * p;
            sumPonderadaMediaSimples += t.getMediaSimplesPct() * p;

            if (t.isMediaSimplesEnganosa()) {
                enganososCount++;
            }

            switch (t.getStatusDominio()) {
                case "CONSOLIDADO" -> consolidados++;
                case "EM_EQUILIBRIO" -> equilibrio++;
                case "RISCO_AMNESIA" -> riscoAmnesia++;
                case "CRITICO_ESQUECIDO" -> criticosEsquecidos++;
                case "VIRGEM_NAO_EXPLORADO" -> virgens++;
            }
        }

        double pAtualGlobal = sumPesos > 0 ? Math.round((sumPonderadaPAtual / sumPesos) * 10.0) / 10.0 : 0.0;
        double pBaseGlobal = sumPesos > 0 ? Math.round((sumPonderadaPBase / sumPesos) * 10.0) / 10.0 : 0.0;
        double mediaSimplesGlobal = sumPesos > 0 ? Math.round((sumPonderadaMediaSimples / sumPesos) * 10.0) / 10.0 : 0.0;
        double gapDecaimentoGlobal = Math.round((mediaSimplesGlobal - pAtualGlobal) * 10.0) / 10.0;

        Map<String, Object> resumoGlobal = new LinkedHashMap<>();
        resumoGlobal.put("pAtualGlobal", pAtualGlobal);
        resumoGlobal.put("estimateType", "OBSERVED_WEIGHTED_PERFORMANCE_NOT_RECALL");
        resumoGlobal.put("memoryAuthority", "LearningEvidenceService/FSRS-6.0");
        resumoGlobal.put("uncertainty", "Repeated item accuracy does not demonstrate transfer or long-term retention");
        resumoGlobal.put("pBaseGlobal", pBaseGlobal);
        resumoGlobal.put("mediaSimplesGlobal", mediaSimplesGlobal);
        resumoGlobal.put("gapDecaimentoGlobal", gapDecaimentoGlobal);
        resumoGlobal.put("totalTopicos", totalTopicos);
        resumoGlobal.put("topicosConsolidados", consolidados);
        resumoGlobal.put("topicosEmEquilibrio", equilibrio);
        resumoGlobal.put("topicosRiscoAmnesia", riscoAmnesia);
        resumoGlobal.put("topicosCriticosEsquecidos", criticosEsquecidos);
        resumoGlobal.put("topicosVirgens", virgens);
        resumoGlobal.put("topicosComMediaEnganosa", enganososCount);

        resumoGlobal.put("alertaMetodologico", "Desempenho observado não mede retenção futura. Estimativas FSRS são calculadas por questão e ainda não calibradas individualmente.");
        Map<String, Object> formula = new LinkedHashMap<>();
        formula.put("expressaoLatex", "");
        formula.put("titulo", "Desempenho observado por tópico");
        formula.put("pBaseDescricao", "Taxa de desempenho ponderada pelas condições registradas da tentativa; não é probabilidade de recuperação futura.");
        formula.put("deltaTDescricao", "Tempo desde a última tentativa, apresentado como contexto.");
        formula.put("sDescricao", "A estabilidade de memória pertence ao modelo FSRS por questão; não é medida sináptica.");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("resumoGlobal", resumoGlobal);
        result.put("formula", formula);
        result.put("topicos", states);

        return result;
    }

    public List<TopicKnowledgeState> computeKnowledgeStates(String concursoId) {
        Instant now = Instant.now();

        // 1. Catálogo de Tópicos
        List<Map<String, Object>> topicosRows = new ArrayList<>();
        try {
            if (concursoId != null && !concursoId.isBlank()) {
                topicosRows = jdbcTemplate.queryForList("""
                    SELECT id, concurso_id, disciplina, assunto, peso
                    FROM edital_topicos
                    WHERE concurso_id = ?
                    ORDER BY peso DESC, disciplina ASC, assunto ASC
                """, concursoId);
            }
            if (topicosRows.isEmpty() && (concursoId == null || concursoId.isBlank())) {
                topicosRows = jdbcTemplate.queryForList("""
                    SELECT id, concurso_id, disciplina, assunto, peso
                    FROM edital_topicos
                    ORDER BY peso DESC, disciplina ASC, assunto ASC
                """);
            }
        } catch (Exception e) {
            log.warn("Falha ao consultar edital_topicos: {}", e.getMessage());
        }

        // Descoberta global somente quando não há concurso solicitado.
        if (topicosRows.isEmpty() && (concursoId == null || concursoId.isBlank())) {
            try {
                topicosRows = jdbcTemplate.queryForList("""
                    SELECT DISTINCT LOWER(disciplina) || '-' || LOWER(assunto) as id,
                           'default' as concurso_id,
                           disciplina, assunto, 2.0 as peso
                    FROM study_questions
                    WHERE disciplina IS NOT NULL AND assunto IS NOT NULL
                    ORDER BY disciplina ASC, assunto ASC
                """);
            } catch (Exception ignored) {}
        }

        // 2. Coletar datas de leitura de materiais (PDF / Teoria) no event_store
        Map<String, Set<String>> readingDatesByTopic = new HashMap<>();
        Map<String, Set<String>> readingDatesByDiscipline = new HashMap<>();
        try {
            List<Map<String, Object>> sessions = jdbcTemplate.queryForList("""
                SELECT occurred_at, payload_json
                FROM event_store
                WHERE event_type = 'STUDY_SESSION_RECORDED'
            """);
            for (Map<String, Object> s : sessions) {
                String occ = (String) s.get("occurred_at");
                String payload = (String) s.get("payload_json");
                if (occ == null || payload == null || occ.length() < 10) continue;
                String dateStr = occ.substring(0, 10);

                try {
                    JsonNode node = objectMapper.readTree(payload);
                    String disc = node.path("disciplina").asText("").trim().toLowerCase();
                    String top = node.path("topico").asText("").trim().toLowerCase();
                    String act = node.path("activityType").asText("").toUpperCase();

                    boolean isLeitura = act.contains("LEITURA") || act.contains("PDF") || act.contains("TEORIA");
                    if (isLeitura) {
                        if (!disc.isEmpty()) {
                            readingDatesByDiscipline.computeIfAbsent(disc, k -> new HashSet<>()).add(dateStr);
                        }
                        if (!disc.isEmpty() && !top.isEmpty()) {
                            readingDatesByTopic.computeIfAbsent(disc + "||" + top, k -> new HashSet<>()).add(dateStr);
                        }
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}

        // 3. Coletar revisões concluídas no revision_calendar
        Map<String, Integer> successfulRevisionsByTopic = new HashMap<>();
        try {
            List<Map<String, Object>> revs = jdbcTemplate.queryForList("""
                SELECT disciplina, topico, taxa_acerto_revisao
                FROM revision_calendar
                WHERE status = 'CONCLUIDA' AND taxa_acerto_revisao >= 0.8
            """);
            for (Map<String, Object> r : revs) {
                String d = ((String) r.getOrDefault("disciplina", "")).trim().toLowerCase();
                String t = ((String) r.getOrDefault("topico", "")).trim().toLowerCase();
                if (!d.isEmpty() && !t.isEmpty()) {
                    successfulRevisionsByTopic.merge(d + "||" + t, 1, Integer::sum);
                }
            }
        } catch (Exception ignored) {}

        // 4. Coletar todas as respostas no event_store
        List<Map<String, Object>> attemptRows = new ArrayList<>();
        try {
            attemptRows = jdbcTemplate.queryForList("""
                SELECT e.aggregate_id AS question_id,e.session_id,e.occurred_at,e.payload_json,t.disciplina,t.assunto
                FROM event_store e JOIN study_questions q ON e.aggregate_id=q.id
                JOIN question_topic_classifications c ON c.question_id=q.id AND c.status='CONFIRMED'
                JOIN edital_topicos t ON t.id=c.topic_id
                WHERE e.event_type='ANSWER_SUBMITTED' AND json_valid(e.payload_json)
                  AND json_extract(e.payload_json,'$.origin')='REAL_STUDY'
                  AND NOT EXISTS(SELECT 1 FROM question_topic_classifications n WHERE n.question_id=c.question_id AND n.topic_id=c.topic_id AND n.rowid>c.rowid)
                  AND (? IS NULL OR t.concurso_id=?)
                ORDER BY e.occurred_at,e.event_id
                """, concursoId,concursoId);
        } catch (Exception e) {
            log.warn("Falha ao consultar ANSWER_SUBMITTED para StudentKnowledgeState: {}", e.getMessage());
        }

        // Agrupar respostas por disciplina||tópico
        Map<String, List<AttemptEvaluation>> attemptsByTopicKey = new LinkedHashMap<>();
        for (Map<String, Object> row : attemptRows) {
            String disc = (String) row.get("disciplina");
            String top = (String) row.get("assunto");
            if (disc == null || disc.isBlank() || top == null || top.isBlank()) continue;

            String key = disc.trim().toLowerCase() + "||" + top.trim().toLowerCase();
            String payloadJson = (String) row.get("payload_json");
            String occurredAt = (String) row.get("occurred_at");
            String sessionId = (String) row.get("session_id");

            Boolean isCorrect = null;
            String gabaritoStatus = "DEFINITIVO";
            int confidence = 3;
            boolean usedHelp = false;
            String interventionType = "REGULAR";
            Double diasDesdeUltimaExposicao = null;
            boolean chuteEducado = false;

            if (payloadJson != null) {
                try {
                    JsonNode node = objectMapper.readTree(payloadJson);
                    if (node.hasNonNull("isCorrect")) {
                        isCorrect = node.path("isCorrect").asBoolean();
                    }
                    if (node.hasNonNull("gabaritoStatus")) {
                        gabaritoStatus = node.path("gabaritoStatus").asText();
                    }
                    confidence = node.path("confidenceLevel").asInt(3);
                    usedHelp = node.path("usedHelp").asBoolean(false);
                    interventionType = node.path("interventionType").asText("REGULAR");
                    if (node.hasNonNull("diasDesdeUltimaExposicao")) {
                        diasDesdeUltimaExposicao = node.path("diasDesdeUltimaExposicao").asDouble();
                    }
                    chuteEducado = node.path("chuteEducadoDetectado").asBoolean(false);
                } catch (Exception ignored) {}
            }

            Instant occInstant = null;
            if (occurredAt != null) {
                try { occInstant = Instant.parse(occurredAt); } catch (Exception ignored) {}
            }
            if (occInstant == null || occInstant.isAfter(now) || isCorrect == null || usedHelp || confidence == 1) continue;

            AttemptEvaluation eval = new AttemptEvaluation(
                    disc, top, isCorrect, gabaritoStatus, confidence,
                    usedHelp, interventionType, diasDesdeUltimaExposicao,
                    chuteEducado, sessionId, occInstant
            );
            attemptsByTopicKey.computeIfAbsent(key, k -> new ArrayList<>()).add(eval);
        }

        List<TopicKnowledgeState> results = new ArrayList<>();

        // 5. Para cada tópico do edital, calcular a equação de P_atual
        for (Map<String, Object> tr : topicosRows) {
            String topId = (String) tr.get("id");
            String disc = (String) tr.get("disciplina");
            String topico = (String) tr.get("assunto");
            Number pesoNum = (Number) tr.get("peso");
            double peso = pesoNum != null ? pesoNum.doubleValue() : 1.0;

            String key = (disc != null ? disc.trim().toLowerCase() : "") + "||" +
                         (topico != null ? topico.trim().toLowerCase() : "");
            String discKey = (disc != null ? disc.trim().toLowerCase() : "");

            List<AttemptEvaluation> topicAttempts = attemptsByTopicKey.getOrDefault(key, Collections.emptyList());

            TopicKnowledgeState state = new TopicKnowledgeState();
            state.setTopicoId(topId != null ? topId : ("top-" + UUID.randomUUID().toString().substring(0, 8)));
            state.setDisciplina(disc != null ? disc : "Geral");
            state.setAssunto(topico != null ? topico : "Tópico");
            state.setPesoEdital(peso);

            if (topicAttempts.isEmpty()) {
                // Tópico Virgem (Cold Start)
                state.setTotalQuestoes(0);
                state.setTotalAcertos(0);
                state.setTotalErros(0);
                state.setMediaSimplesPct(0.0);
                state.setPBasePct(0.0);
                state.setDeltaTDias(30.0);
                state.setForcaMemoriaDias(0.5);
                state.setPAtualPct(0.0);
                state.setDecaimentoPontos(0.0);
                state.setRevisoesEspacadasSucesso(0);
                state.setRetestesFriosAcertos(0);
                state.setQuestoesImediatasLeitura(0);
                state.setSimuladosAcertos(0);
                state.setStatusDominio("VIRGEM_NAO_EXPLORADO");
                state.setUltimoContatoFormatado("Sem contato prévio");
                state.setDiagnosticoPedagogico("Tópico virgem no edital. Inicie com ciclo de estudo teórico seguido de reteste.");
                state.setMediaSimplesEnganosa(false);
                results.add(state);
                continue;
            }

            int totalQ = 0;
            int totalCorr = 0;
            int totalErr = 0;
            double sumWeightedScores = 0.0;
            double sumWeights = 0.0;

            int retestesFrios = 0;
            int retestesFriosAcertos = 0;
            int retestesFriosErros = 0;
            int questoesImediatas = 0;
            int simuladosAcertos = 0;

            Instant lastAttemptAt = null;

            for (AttemptEvaluation att : topicAttempts) {
                if ("ANULADA".equalsIgnoreCase(att.gabaritoStatus) || att.isCorrect == null) {
                    continue;
                }

                totalQ++;
                if (att.isCorrect) totalCorr++;
                else totalErr++;

                if (lastAttemptAt == null || att.occurredAt.isAfter(lastAttemptAt)) {
                    lastAttemptAt = att.occurredAt;
                }

                String attDateStr = att.occurredAt.toString().substring(0, 10);
                boolean isLeituraMesmoDia = false;
                if (readingDatesByTopic.containsKey(key) && readingDatesByTopic.get(key).contains(attDateStr)) {
                    isLeituraMesmoDia = true;
                } else if (readingDatesByDiscipline.containsKey(discKey) && readingDatesByDiscipline.get(discKey).contains(attDateStr)) {
                    isLeituraMesmoDia = true;
                }

                // Cálculo do Peso da Tentativa
                double w = 1.0;
                boolean isSimulado = "SIMULADO".equalsIgnoreCase(att.interventionType) ||
                                     (att.sessionId != null && att.sessionId.toLowerCase().startsWith("sim-"));
                boolean isRetesteFrio = (att.interventionType != null && att.interventionType.toUpperCase().contains("REVISAO")) ||
                                        (att.diasDesdeUltimaExposicao != null && att.diasDesdeUltimaExposicao >= 1.0);

                if (isSimulado) {
                    w = 1.5; // Alta pressão de prova oficial
                    if (att.isCorrect) simuladosAcertos++;
                } else if (isRetesteFrio) {
                    w = 1.2; // Reteste espaçado a frio
                    retestesFrios++;
                    if (att.isCorrect) retestesFriosAcertos++;
                    else retestesFriosErros++;
                } else if (att.usedHelp || isLeituraMesmoDia) {
                    w = 0.5; // Imediatamente após PDF: inflação artificial por memória de trabalho
                    questoesImediatas++;
                } else {
                    w = 1.0; // Prática regular
                }

                // Modulação Biometria/Chute Educado
                if (att.chuteEducado || (att.confidenceLevel <= 2 && att.isCorrect)) {
                    w *= 0.75;
                }

                sumWeights += w;
                sumWeightedScores += (att.isCorrect ? 100.0 : 0.0) * w;
            }

            double mediaSimples = totalQ > 0 ? ((double) totalCorr / totalQ) * 100.0 : 0.0;
            double pBase = (sumWeights > 0) ? (sumWeightedScores / sumWeights) : 0.0;
            pBase = Math.max(0.0, Math.min(100.0, pBase));

            // \Delta t: dias desde o último contato
            double deltaT = 30.0;
            if (lastAttemptAt != null) {
                long hoursAgo = Duration.between(lastAttemptAt, now).toHours();
                deltaT = Math.max(0.0, hoursAgo / 24.0);
            }

            // S: Força da memória (estabilidade em dias)
            int revisoesConcluidas = successfulRevisionsByTopic.getOrDefault(key, 0);

            double sBase = 1.0; // Estabilidade base Ebbinghaus
            sBase += (revisoesConcluidas * 3.5); // Cada revisão espaçada consolida fortemente
            sBase += (retestesFriosAcertos * 1.5);
            sBase += Math.log(1.0 + totalCorr) * 1.2;

            // Penalidade por erro em retestes
            double taxaErroFrio = (retestesFrios > 0) ? (double) retestesFriosErros / retestesFrios : 0.0;
            double penalidadeErro = Math.max(0.40, 1.0 - (taxaErroFrio * 0.50));
            double forcaMemoriaS = Math.max(0.5, sBase * penalidadeErro);

            // Equação Canônica: P_atual(t) = P_base * e^(- \Delta t / S)
            // This legacy API reports demonstrated performance only. Future recall belongs exclusively to LearningEvidenceService/FSRS.
            double pAtual = pBase;
            pAtual = Math.max(0.0, Math.min(100.0, pAtual));

            // Arredondamentos pedagógicos
            mediaSimples = Math.round(mediaSimples * 10.0) / 10.0;
            pBase = Math.round(pBase * 10.0) / 10.0;
            pAtual = Math.round(pAtual * 10.0) / 10.0;
            deltaT = Math.round(deltaT * 10.0) / 10.0;
            forcaMemoriaS = Math.round(forcaMemoriaS * 10.0) / 10.0;
            double decaimento = Math.round((mediaSimples - pAtual) * 10.0) / 10.0;

            String status;
            if (pAtual >= 80.0 && totalQ >= 4) {
                status = "EM_EQUILIBRIO";
            } else if (pAtual >= 65.0) {
                status = "EM_EQUILIBRIO";
            } else if (pAtual >= 45.0) {
                status = "RISCO_AMNESIA";
            } else {
                status = "CRITICO_ESQUECIDO";
            }

            boolean mediaEnganosa = (mediaSimples - pAtual >= 15.0 && totalQ >= 3);

            String diag;
            if (mediaEnganosa) {
                diag = String.format(Locale.ROOT,
                        "⚠️ Média simples de %.1f%% é enganosa: após %.1f dias sem contato, seu domínio real decaiu para %.1f%% (Ebbinghaus). Força S = %.1f dias.",
                        mediaSimples, deltaT, pAtual, forcaMemoriaS);
            } else if (questoesImediatas >= 5 && retestesFrios == 0) {
                diag = String.format(Locale.ROOT,
                        "Nota inflada por estudo recente (P_base ajustada para %.1f%%). Requer reteste a frio para consolidar.",
                        pBase);
            } else if (status.equals("CONSOLIDADO")) {
                diag = String.format(Locale.ROOT,
                        "Domínio consolidado (%.1f%%). Estabilidade sináptica de %.1f dias mantém a retenção alta.",
                        pAtual, forcaMemoriaS);
            } else {
                diag = String.format(Locale.ROOT,
                        "Domínio atual estimado em %.1f%% (P_base: %.1f%%, contato há %.1f dias, S = %.1f dias).",
                        pAtual, pBase, deltaT, forcaMemoriaS);
            }

            String ultContatoTxt;
            if (deltaT < 0.2) ultContatoTxt = "Hoje";
            else if (deltaT < 1.0) ultContatoTxt = "Há 1 dia";
            else ultContatoTxt = String.format(Locale.ROOT, "Há %.0f dias", deltaT);

            state.setTotalQuestoes(totalQ);
            state.setTotalAcertos(totalCorr);
            state.setTotalErros(totalErr);
            state.setMediaSimplesPct(mediaSimples);
            state.setPBasePct(pBase);
            state.setDeltaTDias(deltaT);
            state.setForcaMemoriaDias(forcaMemoriaS);
            state.setPAtualPct(pAtual);
            state.setDecaimentoPontos(decaimento);
            state.setRevisoesEspacadasSucesso(revisoesConcluidas);
            state.setRetestesFriosAcertos(retestesFriosAcertos);
            state.setQuestoesImediatasLeitura(questoesImediatas);
            state.setSimuladosAcertos(simuladosAcertos);
            state.setStatusDominio(status);
            state.setUltimoContatoFormatado(ultContatoTxt);
            state.setDiagnosticoPedagogico(diag);
            state.setMediaSimplesEnganosa(mediaEnganosa);

            results.add(state);
        }

        // Ordenar por prioridade pedagógica: tópicos com maior risco de perda de pontos primeiro
        results.sort((a, b) -> {
            int cmp = Double.compare(b.getDecaimentoPontos() * b.getPesoEdital(),
                                     a.getDecaimentoPontos() * a.getPesoEdital());
            if (cmp != 0) return cmp;
            return Double.compare(b.getPesoEdital(), a.getPesoEdital());
        });

        return results;
    }

    private static class AttemptEvaluation {
        String disciplina;
        String assunto;
        Boolean isCorrect;
        String gabaritoStatus;
        int confidenceLevel;
        boolean usedHelp;
        String interventionType;
        Double diasDesdeUltimaExposicao;
        boolean chuteEducado;
        String sessionId;
        Instant occurredAt;

        AttemptEvaluation(String disciplina, String assunto, Boolean isCorrect, String gabaritoStatus,
                          int confidenceLevel, boolean usedHelp, String interventionType,
                          Double diasDesdeUltimaExposicao, boolean chuteEducado,
                          String sessionId, Instant occurredAt) {
            this.disciplina = disciplina;
            this.assunto = assunto;
            this.isCorrect = isCorrect;
            this.gabaritoStatus = gabaritoStatus;
            this.confidenceLevel = confidenceLevel;
            this.usedHelp = usedHelp;
            this.interventionType = interventionType;
            this.diasDesdeUltimaExposicao = diasDesdeUltimaExposicao;
            this.chuteEducado = chuteEducado;
            this.sessionId = sessionId;
            this.occurredAt = occurredAt;
        }
    }
}
