package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Serviço de Gestão Estratégica de Simulados Orientados por Editais.
 * Aplica o Princípio de Pareto (80/20), análise de fraquezas reais e
 * mapeamento direto com os conteúdos programáticos oficiais.
 */
@Service
public class StrategicSimuladoService {

    private static final Logger logger = LoggerFactory.getLogger(StrategicSimuladoService.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SwotCycleCalibratorService swotCycleCalibratorService;

    public StrategicSimuladoService(JdbcTemplate jdbcTemplate) {
        this(jdbcTemplate, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public StrategicSimuladoService(JdbcTemplate jdbcTemplate,
                                    @org.springframework.beans.factory.annotation.Autowired(required = false) SwotCycleCalibratorService swotCycleCalibratorService) {
        this.jdbcTemplate = jdbcTemplate;
        this.swotCycleCalibratorService = swotCycleCalibratorService;
        this.objectMapper = new ObjectMapper();
        ensureTables();
    }

    private void ensureTables() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS study_notebooks (
                    id TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    concurso_id TEXT,
                    tipo TEXT NOT NULL,
                    modo_resolucao TEXT DEFAULT 'SIMULADO',
                    quantidade INTEGER DEFAULT 30,
                    tempo_minutos INTEGER DEFAULT 90,
                    filtros_json TEXT,
                    created_at TEXT NOT NULL,
                    last_executed_at TEXT
                )
            """);

            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS simulado_executions (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT,
                    concurso_id TEXT,
                    titulo TEXT NOT NULL,
                    estrategia TEXT NOT NULL,
                    modo TEXT DEFAULT 'SIMULADO',
                    total_questoes INTEGER NOT NULL,
                    acertos INTEGER DEFAULT 0,
                    erros INTEGER DEFAULT 0,
                    nao_respondidas INTEGER DEFAULT 0,
                    nota_liquida REAL DEFAULT 0.0,
                    tempo_gasto_segundos INTEGER DEFAULT 0,
                    disciplinas_json TEXT,
                    finalizado_em TEXT NOT NULL
                )
            """);
        } catch (Exception e) {
            logger.warn("Aviso na criação/verificação de tabelas de simulado: {}", e.getMessage());
        }
    }

    /**
     * Retorna o Painel Estratégico de Simulados para o concurso especificado.
     */
    public Map<String, Object> getSimuladosDashboard(String concursoId) {
        Map<String, Object> dashboard = new LinkedHashMap<>();

        // 1. Informações do Concurso Ativo
        Map<String, Object> concursoInfo = getConcursoInfo(concursoId);
        dashboard.put("concurso", concursoInfo);

        // 2. Tópicos do Edital Verticalizado
        List<Map<String, Object>> topicosEdital = getTopicosDoEdital(concursoId);
        dashboard.put("totalTopicosEdital", topicosEdital.size());

        // 3. Análise de Desempenho e Histórico de Erros
        Map<String, PerformanceAcc> performancePorTopico = getPerformancePorTopico(concursoId);

        // 4. Motor de Priorização de Pareto aplicado ao Edital
        List<Map<String, Object>> topicosPriorizados = classificarTopicosPareto(topicosEdital, performancePorTopico);
        dashboard.put("topicosPriorizados", topicosPriorizados);

        // Contadores de prioridade
        long maxPrioridade = topicosPriorizados.stream().filter(t -> "MAXIMA".equals(t.get("prioridade"))).count();
        long altaPrioridade = topicosPriorizados.stream().filter(t -> "ALTA".equals(t.get("prioridade"))).count();
        long manutencao = topicosPriorizados.stream().filter(t -> "MANUTENCAO".equals(t.get("prioridade"))).count();
        long baixa = topicosPriorizados.stream().filter(t -> "BAIXA".equals(t.get("prioridade"))).count();

        Map<String, Object> prioridadesCount = new LinkedHashMap<>();
        prioridadesCount.put("maxima", maxPrioridade);
        prioridadesCount.put("alta", altaPrioridade);
        prioridadesCount.put("manutencao", manutencao);
        prioridadesCount.put("baixa", baixa);
        dashboard.put("resumoPrioridades", prioridadesCount);

        // 5. Métricas de Domínio do Edital
        Set<String> topicosPraticados = performancePorTopico.keySet();
        int totalTopicos = topicosEdital.isEmpty() ? Math.max(1, topicosPraticados.size()) : topicosEdital.size();
        double coberturaPraticadaPct = totalTopicos > 0 ? (topicosPraticados.size() * 100.0) / totalTopicos : 0.0;
        coberturaPraticadaPct = Math.min(100.0, Math.round(coberturaPraticadaPct * 10.0) / 10.0);

        int totalQuestoesRespondidas = performancePorTopico.values().stream().mapToInt(p -> p.total).sum();
        int totalAcertos = performancePorTopico.values().stream().mapToInt(p -> p.corretas).sum();
        double aproveitamentoGlobal = totalQuestoesRespondidas > 0 ? (totalAcertos * 100.0) / totalQuestoesRespondidas : 0.0;
        aproveitamentoGlobal = Math.round(aproveitamentoGlobal * 10.0) / 10.0;

        Map<String, Object> metricas = new LinkedHashMap<>();
        metricas.put("coberturaEditalPraticadaPct", coberturaPraticadaPct);
        metricas.put("totalTopicosEdital", totalTopicos);
        metricas.put("topicosPraticadosCount", topicosPraticados.size());
        metricas.put("totalQuestoesRespondidas", totalQuestoesRespondidas);
        metricas.put("aproveitamentoGlobalPct", aproveitamentoGlobal);
        metricas.put("totalSimuladosConcluidos", countSimuladosConcluidos(concursoId));
        dashboard.put("metricas", metricas);

        // 6. Disciplinas com Distribuição de Peso e Desempenho
        List<Map<String, Object>> disciplinasProgresso = agruparDisciplinasProgresso(topicosPriorizados, performancePorTopico);
        dashboard.put("disciplinas", disciplinasProgresso);

        // 7. Próximo Simulado Estratégico Recomendado (1-Clique)
        Map<String, Object> simuladoRecomendado = montarSimuladoRecomendado(concursoInfo, topicosPriorizados, performancePorTopico);
        dashboard.put("simuladoRecomendado", simuladoRecomendado);

        // 8. Histórico de Simulados e Cadernos Recentes
        List<Map<String, Object>> historicoSimulados = getHistoricoSimulados(concursoId);
        dashboard.put("historicoSimulados", historicoSimulados);

        return dashboard;
    }

    /**
     * Gera um Simulado Estratégico Direcionado e persiste em study_notebooks.
     */
    public Map<String, Object> generateStrategicSimulado(Map<String, Object> req) {
        String concursoId = (String) req.get("concursoId");
        String estrategia = (String) req.getOrDefault("estrategia", "PARETO_80_20");
        String modo = (String) req.getOrDefault("modo", "SIMULADO");
        int quantidade = req.get("quantidade") instanceof Number n ? n.intValue() : 30;
        int tempoMinutos = req.get("tempoMinutos") instanceof Number n ? n.intValue() : 90;
        String titulo = (String) req.get("titulo");

        List<String> disciplinasSelecionadas = extractStringList(req.get("disciplinas"));
        List<String> topicosSelecionados = extractStringList(req.get("topicos"));
        String bancaFiltro = (String) req.get("banca");
        String filtroResolucao = (String) req.getOrDefault("filtroResolucao", "TODAS");

        if (titulo == null || titulo.isBlank()) {
            titulo = switch (estrategia) {
                case "PARETO_80_20" -> "Simulado Estratégico Pareto (80/20) — Foco nos Temas Decisivos";
                case "PONTOS_FRACOS" -> "Simulado de Anti-Fragilidade — Reforço Cirúrgico em Erros";
                case "PROVA_REAL" -> "Simulado Completo — Espelho da Prova Objetiva";
                case "REVISAO" -> "Simulado de Revisão Espaçada e Retenção Ativa";
                case "DISCIPLINA" -> "Simulado Específico por Disciplina";
                default -> "Simulado Estratégico Personalizado";
            };
        }

        // Buscar questões reais no SQLite aderentes aos critérios
        List<String> questionIds = queryQuestionIds(concursoId, estrategia, disciplinasSelecionadas, topicosSelecionados, bancaFiltro, filtroResolucao, quantidade);

        String notebookId = "sim_" + UUID.randomUUID().toString().substring(0, 10);
        String now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        Map<String, Object> filtros = new LinkedHashMap<>();
        filtros.put("estrategia", estrategia);
        filtros.put("disciplinas", disciplinasSelecionadas);
        filtros.put("topicos", topicosSelecionados);
        filtros.put("banca", bancaFiltro);
        filtros.put("filtroResolucao", filtroResolucao);
        filtros.put("questionIds", questionIds);

        try {
            String filtrosJson = objectMapper.writeValueAsString(filtros);
            jdbcTemplate.update("""
                INSERT INTO study_notebooks (id, nome, concurso_id, tipo, modo_resolucao, quantidade, tempo_minutos, filtros_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, notebookId, titulo, concursoId, "SIMULADO_ESTRATEGICO", modo, questionIds.size(), tempoMinutos, filtrosJson, now);
        } catch (Exception e) {
            logger.error("Erro ao salvar notebook de simulado: {}", e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("notebookId", notebookId);
        result.put("titulo", titulo);
        result.put("estrategia", estrategia);
        result.put("modo", modo);
        result.put("quantidade", questionIds.size());
        result.put("tempoMinutos", tempoMinutos);
        result.put("disciplinas", disciplinasSelecionadas);
        result.put("questionIds", questionIds);
        result.put("createdAt", now);

        return result;
    }

    /**
     * Registra a conclusão e o resultado detalhado de um simulado.
     */
    public Map<String, Object> recordSimuladoCompletion(Map<String, Object> payload) {
        String id = "exec_" + UUID.randomUUID().toString().substring(0, 10);
        String notebookId = (String) payload.get("notebookId");
        String concursoId = (String) payload.get("concursoId");
        String titulo = (String) payload.getOrDefault("titulo", "Simulado Executado");
        String estrategia = (String) payload.getOrDefault("estrategia", "GERAL");
        String modo = (String) payload.getOrDefault("modo", "SIMULADO");

        int totalQuestoes = payload.get("totalQuestoes") instanceof Number n ? n.intValue() : 0;
        int acertos = payload.get("acertos") instanceof Number n ? n.intValue() : 0;
        int erros = payload.get("erros") instanceof Number n ? n.intValue() : 0;
        int naoRespondidas = payload.get("naoRespondidas") instanceof Number n ? n.intValue() : 0;
        int tempoGasto = payload.get("tempoGastoSegundos") instanceof Number n ? n.intValue() : 0;
        double notaLiquida = payload.get("notaLiquida") instanceof Number n ? n.doubleValue() : (acertos - erros);

        String now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String disciplinasJson = "{}";
        try {
            if (payload.containsKey("desempenhoPorDisciplina")) {
                disciplinasJson = objectMapper.writeValueAsString(payload.get("desempenhoPorDisciplina"));
            }
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.update("""
                INSERT INTO simulado_executions (
                    id, notebook_id, concurso_id, titulo, estrategia, modo,
                    total_questoes, acertos, erros, nao_respondidas, nota_liquida,
                    tempo_gasto_segundos, disciplinas_json, finalizado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, id, notebookId, concursoId, titulo, estrategia, modo,
                 totalQuestoes, acertos, erros, naoRespondidas, notaLiquida,
                 tempoGasto, disciplinasJson, now);

            if (notebookId != null) {
                jdbcTemplate.update("UPDATE study_notebooks SET last_executed_at = ? WHERE id = ?", now, notebookId);
            }
        } catch (Exception e) {
            logger.error("Erro ao registrar execução de simulado: {}", e.getMessage());
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("executionId", id);
        resp.put("finalizadoEm", now);
        resp.put("notaLiquida", notaLiquida);
        resp.put("aproveitamentoPct", totalQuestoes > 0 ? Math.round((acertos * 100.0 / totalQuestoes) * 10.0) / 10.0 : 0.0);

        // Calibrador Automático de Pesos do Ciclo (Feedback Loop Pós-Simulado)
        if (swotCycleCalibratorService != null) {
            try {
                payload.put("executionId", id);
                var calibResult = swotCycleCalibratorService.recalibrateFromSimulado(concursoId, payload);
                resp.put("recalculoCiclo", calibResult);
            } catch (Exception ex) {
                logger.warn("Falha ao executar feedback loop pós-simulado: {}", ex.getMessage());
            }
        }

        return resp;
    }

    // =========================================================================
    // MÉTODOS AUXILIARES DE CONSULTA E MOTOR DE PARETO
    // =========================================================================

    private Map<String, Object> getConcursoInfo(String concursoId) {
        Map<String, Object> info = new LinkedHashMap<>();
        if (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId) && !"null".equalsIgnoreCase(concursoId)) {
            try {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT id, nome, orgao, cargo, banca, ano, status FROM concursos WHERE id = ?", concursoId.trim()
                );
                if (!rows.isEmpty()) {
                    return rows.get(0);
                }
            } catch (Exception ignored) {}
        }
        try {
            List<Map<String, Object>> defaultRows = jdbcTemplate.queryForList(
                "SELECT id, nome, orgao, cargo, banca, ano, status FROM concursos ORDER BY created_at DESC LIMIT 1"
            );
            if (!defaultRows.isEmpty()) {
                return defaultRows.get(0);
            }
        } catch (Exception ignored) {}

        info.put("id", concursoId);
        info.put("nome", "Concurso Ativo");
        info.put("orgao", "Órgão Fiscal");
        info.put("cargo", "Auditor Fiscal");
        info.put("banca", "Banca Oficial");
        return info;
    }

    private List<Map<String, Object>> getTopicosDoEdital(String concursoId) {
        String effectiveConcursoId = (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId) && !"null".equalsIgnoreCase(concursoId))
                ? concursoId.trim()
                : null;
        try {
            if (effectiveConcursoId != null) {
                List<Map<String, Object>> list = jdbcTemplate.queryForList("""
                    SELECT id, edital_id, concurso_id, disciplina, assunto, subassunto,
                           assunto AS topico, peso,
                           COALESCE(peso, 1.0) AS relevancia_banca,
                           COALESCE(questoes_previstas, 1) AS incidencia_recente
                    FROM edital_topicos
                    WHERE concurso_id = ?
                    ORDER BY disciplina ASC, CASE WHEN pagina_origem IS NOT NULL THEN pagina_origem ELSE 99999 END ASC, assunto ASC
                """, effectiveConcursoId);
                if (!list.isEmpty()) {
                    return list;
                }
            }
            return jdbcTemplate.queryForList("""
                SELECT id, edital_id, concurso_id, disciplina, assunto, subassunto,
                       assunto AS topico, peso,
                       COALESCE(peso, 1.0) AS relevancia_banca,
                       COALESCE(questoes_previstas, 1) AS incidencia_recente
                FROM edital_topicos
                ORDER BY disciplina ASC, CASE WHEN pagina_origem IS NOT NULL THEN pagina_origem ELSE 99999 END ASC, assunto ASC
            """);
        } catch (Exception e) {
            logger.warn("Falha ao buscar tópicos do edital: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private Map<String, PerformanceAcc> getPerformancePorTopico(String concursoId) {
        Map<String, PerformanceAcc> map = new HashMap<>();
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT e.payload_json, q.disciplina, q.assunto
                FROM event_store e
                JOIN questions q ON e.aggregate_id = q.id
                WHERE e.event_type = 'ANSWER_SUBMITTED'
            """);

            for (Map<String, Object> row : rows) {
                String disc = (String) row.get("disciplina");
                String top = (String) row.get("assunto");
                String payload = (String) row.get("payload_json");

                if (disc == null || disc.isBlank() || top == null || top.isBlank()) continue;

                String key = (disc.trim().toLowerCase() + "||" + top.trim().toLowerCase());
                PerformanceAcc acc = map.computeIfAbsent(key, k -> new PerformanceAcc(disc, top));
                acc.total++;

                if (payload != null) {
                    try {
                        JsonNode node = objectMapper.readTree(payload);
                        if (node.path("isCorrect").asBoolean(false)) {
                            acc.corretas++;
                        } else {
                            acc.erros++;
                        }
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            logger.warn("Falha ao computar performance por tópico: {}", e.getMessage());
        }
        return map;
    }

    private List<Map<String, Object>> classificarTopicosPareto(
            List<Map<String, Object>> topicosEdital,
            Map<String, PerformanceAcc> performancePorTopico
    ) {
        List<Map<String, Object>> result = new ArrayList<>();

        for (Map<String, Object> topicoRow : topicosEdital) {
            String disc = (String) topicoRow.getOrDefault("disciplina", "Geral");
            String top = (String) topicoRow.get("topico");
            if (top == null || top.isBlank()) {
                top = (String) topicoRow.get("assunto");
            }
            if (top == null || top.isBlank()) {
                top = "Tópico Geral";
            }
            double peso = topicoRow.get("peso") instanceof Number n ? n.doubleValue() : 1.0;
            double relevancaBanca = topicoRow.get("relevancia_banca") instanceof Number n
                    ? n.doubleValue()
                    : (topicoRow.get("questoes_previstas") instanceof Number q ? q.doubleValue() : 1.0);

            String key = (disc != null ? disc.trim().toLowerCase() : "") + "||" + (top != null ? top.trim().toLowerCase() : "");
            PerformanceAcc perf = performancePorTopico.get(key);

            int totalFeitas = perf != null ? perf.total : 0;
            int totalAcertos = perf != null ? perf.corretas : 0;
            int totalErros = perf != null ? perf.erros : 0;
            double taxaAcerto = totalFeitas > 0 ? (totalAcertos * 100.0) / totalFeitas : -1.0; // -1 indica não praticado

            // Motor de Pareto: Classificação transparente
            String prioridade;
            String justificativa;
            double scorePrioridade;

            if (totalFeitas == 0) {
                if (peso >= 1.5 || relevancaBanca >= 2.0 || "Auditoria".equalsIgnoreCase(disc) || "Direito Tributário".equalsIgnoreCase(disc) || "Contabilidade Geral".equalsIgnoreCase(disc)) {
                    prioridade = "MAXIMA";
                    justificativa = "Conteúdo estruturante de alto impacto no edital sem histórico de resolução recente.";
                    scorePrioridade = 90.0 + peso * 3;
                } else {
                    prioridade = "ALTA";
                    justificativa = "Tópico constante no edital que necessita de bateria inicial de validação.";
                    scorePrioridade = 70.0 + peso * 2;
                }
            } else if (taxaAcerto < 60.0) {
                prioridade = "MAXIMA";
                justificativa = String.format("Aproveitamento crítico (%.1f%%) com %d erros recentes em conteúdo de peso %.1f.", taxaAcerto, totalErros, peso);
                scorePrioridade = 100.0 - taxaAcerto + (peso * 10);
            } else if (taxaAcerto < 75.0) {
                prioridade = "ALTA";
                justificativa = String.format("Aproveitamento intermediário (%.1f%%). Necessita de prática frequente para consolidação.", taxaAcerto);
                scorePrioridade = 60.0 + (75.0 - taxaAcerto) + (peso * 5);
            } else if (taxaAcerto >= 75.0 && totalFeitas >= 5) {
                prioridade = "MANUTENCAO";
                justificativa = String.format("Domínio consolidado (%.1f%% de acertos em %d questões). Recomenda-se repetição espaçada.", taxaAcerto, totalFeitas);
                scorePrioridade = 30.0 + (peso * 2);
            } else {
                prioridade = "BAIXA";
                justificativa = "Conteúdo de baixa relevância relativa ou impacto residual na nota final.";
                scorePrioridade = 15.0;
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", topicoRow.get("id"));
            item.put("disciplina", disc);
            item.put("topico", top);
            item.put("assunto", top);
            item.put("subassunto", topicoRow.get("subassunto"));
            item.put("peso", peso);
            item.put("prioridade", prioridade);
            item.put("scorePrioridade", Math.round(scorePrioridade * 10.0) / 10.0);
            item.put("taxaAcertoPct", taxaAcerto >= 0 ? Math.round(taxaAcerto * 10.0) / 10.0 : null);
            item.put("questoesFeitas", totalFeitas);
            item.put("erros", totalErros);
            item.put("justificativa", justificativa);

            result.add(item);
        }

        // Ordenar decrescente pelo score de prioridade de Pareto
        result.sort((a, b) -> Double.compare(
                (Double) b.getOrDefault("scorePrioridade", 0.0),
                (Double) a.getOrDefault("scorePrioridade", 0.0)
        ));

        return result;
    }

    private List<Map<String, Object>> agruparDisciplinasProgresso(
            List<Map<String, Object>> topicosPriorizados,
            Map<String, PerformanceAcc> performancePorTopico
    ) {
        Map<String, List<Map<String, Object>>> grouped = topicosPriorizados.stream()
                .collect(Collectors.groupingBy(t -> (String) t.get("disciplina")));

        List<Map<String, Object>> list = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
            String disc = entry.getKey();
            List<Map<String, Object>> tops = entry.getValue();

            int totalFeitas = 0;
            int totalAcertos = 0;
            for (Map<String, Object> t : tops) {
                String key = (disc.trim().toLowerCase() + "||" + ((String) t.get("topico")).trim().toLowerCase());
                PerformanceAcc perf = performancePorTopico.get(key);
                if (perf != null) {
                    totalFeitas += perf.total;
                    totalAcertos += perf.corretas;
                }
            }

            double aproveitamento = totalFeitas > 0 ? (totalAcertos * 100.0) / totalFeitas : 0.0;
            long topicosCriticos = tops.stream().filter(t -> "MAXIMA".equals(t.get("prioridade"))).count();
            double pesoMedio = tops.stream().mapToDouble(t -> ((Number) t.getOrDefault("peso", 1.0)).doubleValue()).average().orElse(1.0);

            Map<String, Object> dMap = new LinkedHashMap<>();
            dMap.put("disciplina", disc);
            dMap.put("totalTopicos", tops.size());
            dMap.put("pesoMedio", Math.round(pesoMedio * 10.0) / 10.0);
            dMap.put("questoesFeitas", totalFeitas);
            dMap.put("aproveitamentoPct", Math.round(aproveitamento * 10.0) / 10.0);
            dMap.put("topicosCriticosCount", topicosCriticos);
            list.add(dMap);
        }

        list.sort((a, b) -> Long.compare((Long) b.get("topicosCriticosCount"), (Long) a.get("topicosCriticosCount")));
        return list;
    }

    private Map<String, Object> montarSimuladoRecomendado(
            Map<String, Object> concursoInfo,
            List<Map<String, Object>> topicosPriorizados,
            Map<String, PerformanceAcc> performancePorTopico
    ) {
        Map<String, Object> rec = new LinkedHashMap<>();

        // Priorizar os tópicos de maior score
        List<Map<String, Object>> selecionados = topicosPriorizados.stream()
                .filter(t -> "MAXIMA".equals(t.get("prioridade")) || "ALTA".equals(t.get("prioridade")))
                .limit(8)
                .toList();

        List<String> disciplinasFoco = selecionados.stream()
                .map(t -> (String) t.get("disciplina"))
                .distinct()
                .toList();

        rec.put("titulo", "Simulado Adaptativo — Foco em Pareto & Reforço de Pontos Fracos");
        rec.put("descricao", "Montado com base na convergência de alta relevância no edital e necessidade de intervenção do estudante.");
        rec.put("estrategia", "PARETO_80_20");
        rec.put("modo", "SIMULADO");
        rec.put("quantidadeSugerida", 30);
        rec.put("tempoMinutosSugerido", 75);
        rec.put("disciplinas", disciplinasFoco.isEmpty() ? List.of("Direito Tributário", "Contabilidade Geral", "Legislação Tributária") : disciplinasFoco);
        rec.put("topicosPrioritariosCount", selecionados.size());
        rec.put("urgenciaNivel", selecionados.stream().anyMatch(t -> "MAXIMA".equals(t.get("prioridade"))) ? "CRITICA" : "MODERADA");

        return rec;
    }

    private List<String> queryQuestionIds(
            String concursoId,
            String estrategia,
            List<String> disciplinas,
            List<String> topicos,
            String banca,
            String filtroResolucao,
            int quantidade
    ) {
        StringBuilder sql = new StringBuilder("SELECT id FROM questions WHERE (status = 'VALIDADA' OR status IS NULL) ");
        List<Object> params = new ArrayList<>();

        if (disciplinas != null && !disciplinas.isEmpty()) {
            String placeholders = String.join(",", Collections.nCopies(disciplinas.size(), "?"));
            sql.append(" AND disciplina IN (").append(placeholders).append(") ");
            params.addAll(disciplinas);
        }

        if (topicos != null && !topicos.isEmpty()) {
            String placeholders = String.join(",", Collections.nCopies(topicos.size(), "?"));
            sql.append(" AND assunto IN (").append(placeholders).append(") ");
            params.addAll(topicos);
        }

        if (banca != null && !banca.isBlank() && !"TODAS".equalsIgnoreCase(banca.trim())) {
            sql.append(" AND LOWER(banca) = LOWER(?) ");
            params.add(banca.trim());
        }

        // Filtro de resolução
        if ("APENAS_ERRADAS".equalsIgnoreCase(filtroResolucao)) {
            sql.append(" AND id IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND payload_json LIKE '%\"isCorrect\":false%') ");
        } else if ("NAO_RESOLVIDAS".equalsIgnoreCase(filtroResolucao)) {
            sql.append(" AND id NOT IN (SELECT aggregate_id FROM event_store WHERE event_type = 'ANSWER_SUBMITTED') ");
        }

        sql.append(" ORDER BY RANDOM() LIMIT ? ");
        params.add(Math.max(1, Math.min(quantidade, 120)));

        try {
            return jdbcTemplate.queryForList(sql.toString(), String.class, params.toArray());
        } catch (Exception e) {
            logger.warn("Erro ao buscar questões para simulado: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private int countSimuladosConcluidos(String concursoId) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM simulado_executions " + (concursoId != null ? "WHERE concurso_id = ?" : ""),
                Integer.class,
                concursoId != null ? new Object[]{concursoId} : new Object[]{}
            );
            return count != null ? count : 0;
        } catch (Exception ignored) {
            return 0;
        }
    }

    private List<Map<String, Object>> getHistoricoSimulados(String concursoId) {
        try {
            String sql = "SELECT * FROM simulado_executions " +
                    (concursoId != null ? "WHERE concurso_id = ? " : "") +
                    "ORDER BY finalizado_em DESC LIMIT 15";
            return jdbcTemplate.queryForList(sql, concursoId != null ? new Object[]{concursoId} : new Object[]{});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> extractStringList(Object obj) {
        if (obj instanceof List<?> l) {
            return l.stream().map(String::valueOf).collect(Collectors.toList());
        }
        return Collections.emptyList();
    }

    private static class PerformanceAcc {
        final String disciplina;
        final String topico;
        int total = 0;
        int corretas = 0;
        int erros = 0;

        PerformanceAcc(String disciplina, String topico) {
            this.disciplina = disciplina;
            this.topico = topico;
        }
    }
}
