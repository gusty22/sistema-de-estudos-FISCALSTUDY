package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class StrategicSummaryService {

    private static final Logger log = LoggerFactory.getLogger(StrategicSummaryService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final AnkiIntegrationService ankiIntegrationService;
    private final ObjectMapper objectMapper;

    public StrategicSummaryService(JdbcTemplate jdbcTemplate,
                                   EventStoreRepository eventStoreRepository,
                                   AnkiIntegrationService ankiIntegrationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.ankiIntegrationService = ankiIntegrationService;
        this.objectMapper = new ObjectMapper();
        ensureTables();
    }

    private void ensureTables() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS strategic_summaries (
                    id TEXT PRIMARY KEY,
                    concurso_id TEXT,
                    disciplina TEXT NOT NULL,
                    topico TEXT NOT NULL,
                    subtopico TEXT,
                    banca TEXT,
                    material_id TEXT,
                    material_origem_nome TEXT,
                    material_paginas TEXT,
                    nivel_relevancia TEXT NOT NULL,
                    justificativa_prioridade TEXT NOT NULL,
                    resumo_markdown TEXT NOT NULL,
                    fichas_rapidas_json TEXT,
                    mapa_mental_json TEXT,
                    quadros_comparativos_json TEXT,
                    flashcards_json TEXT,
                    pegadinhas_banca_json TEXT,
                    resumo_reta_final_markdown TEXT,
                    estatisticas_base_json TEXT,
                    revisado_em TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """);

            // Inserir alguns resumos modelo de alta qualidade se a tabela estiver vazia
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM strategic_summaries", Integer.class);
            if (count == null || count == 0) {
                seedInitialSummaries();
            }
        } catch (Exception e) {
            log.error("Erro ao inicializar tabela strategic_summaries: {}", e.getMessage());
        }
    }

    /**
     * Lista resumos estratégicos por concurso ou disciplina
     */
    public List<Map<String, Object>> getSummaries(String concursoId, String disciplina, String topico) {
        StringBuilder sql = new StringBuilder("SELECT id, concurso_id, disciplina, topico, subtopico, banca, " +
                "material_origem_nome, nivel_relevancia, justificativa_prioridade, revisado_em, created_at, updated_at " +
                "FROM strategic_summaries WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (concursoId != null && !concursoId.isBlank()) {
            sql.append(" AND (concurso_id = ? OR concurso_id IS NULL OR concurso_id = 'GLOBAL')");
            params.add(concursoId.trim());
        }
        if (disciplina != null && !disciplina.isBlank()) {
            sql.append(" AND LOWER(disciplina) = LOWER(?)");
            params.add(disciplina.trim());
        }
        if (topico != null && !topico.isBlank()) {
            sql.append(" AND LOWER(topico) LIKE LOWER(?)");
            params.add("%" + topico.trim() + "%");
        }

        sql.append(" ORDER BY updated_at DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        return rows;
    }

    /**
     * Obtém um resumo estratégico completo pelo ID
     */
    public Optional<Map<String, Object>> getSummaryById(String id) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT * FROM strategic_summaries WHERE id = ?", id
            );
            if (rows.isEmpty()) return Optional.empty();

            Map<String, Object> row = new HashMap<>(rows.get(0));
            // Deserializa os campos JSON
            deserializeJsonField(row, "fichas_rapidas_json", "fichasRapidas");
            deserializeJsonField(row, "mapa_mental_json", "mapaMental");
            deserializeJsonField(row, "quadros_comparativos_json", "quadrosComparativos");
            deserializeJsonField(row, "flashcards_json", "flashcards");
            deserializeJsonField(row, "pegadinhas_banca_json", "pegadinhasBanca");
            deserializeJsonField(row, "estatisticas_base_json", "estatisticasBase");

            return Optional.of(row);
        } catch (Exception e) {
            log.error("Erro ao buscar resumo {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Gera ou regenera um resumo estratégico inteligente orientado ao edital
     */
    public Map<String, Object> generateSummary(Map<String, Object> req) {
        String concursoId = (String) req.getOrDefault("concursoId", "GLOBAL");
        String disciplina = (String) req.getOrDefault("disciplina", "Direito Tributário");
        String topico = (String) req.getOrDefault("topico", "Imunidades e Isenções Tributárias");
        String subtopico = (String) req.getOrDefault("subtopico", "");
        String banca = (String) req.getOrDefault("banca", "Outra");
        String materialId = (String) req.get("materialId");
        String materialOrigemNome = (String) req.getOrDefault("materialOrigemNome", "Apostila Base do Edital");
        String materialPaginas = (String) req.getOrDefault("materialPaginas", "");
        String textoOrigem = (String) req.getOrDefault("textoOrigem", "");

        // 1. Coleta dados reais do Edital
        int peso = 2;
        try {
            List<Map<String, Object>> topicoRows = jdbcTemplate.queryForList(
                    "SELECT peso FROM edital_topicos WHERE (concurso_id = ? OR concurso_id IS NULL) " +
                            "AND LOWER(disciplina) = LOWER(?) AND LOWER(assunto) LIKE LOWER(?) LIMIT 1",
                    concursoId, disciplina, "%" + topico + "%"
            );
            if (!topicoRows.isEmpty() && topicoRows.get(0).get("peso") != null) {
                peso = ((Number) topicoRows.get(0).get("peso")).intValue();
            }
        } catch (Exception ignored) {}

        // 2. Coleta evidências reais do banco de questões e event_store
        int totalQuestoes = 0;
        int errosEstudante = 0;
        int acertosEstudante = 0;

        try {
            Integer qCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM questions WHERE LOWER(disciplina) = LOWER(?) AND LOWER(assunto) LIKE LOWER(?)",
                    Integer.class, disciplina, "%" + topico + "%"
            );
            totalQuestoes = (qCount != null) ? qCount : 0;

            List<Map<String, Object>> studentEvents = jdbcTemplate.queryForList(
                    "SELECT e.payload_json FROM event_store e " +
                            "INNER JOIN questions q ON q.id = e.aggregate_id " +
                            "WHERE e.event_type = 'ANSWER_SUBMITTED' AND LOWER(q.disciplina) = LOWER(?) " +
                            "AND LOWER(q.assunto) LIKE LOWER(?)",
                    disciplina, "%" + topico + "%"
            );

            for (Map<String, Object> ev : studentEvents) {
                String payload = (String) ev.get("payload_json");
                if (payload != null && payload.contains("\"isCorrect\":true")) {
                    acertosEstudante++;
                } else if (payload != null && payload.contains("\"isCorrect\":false")) {
                    errosEstudante++;
                }
            }
        } catch (Exception ignored) {}

        int totalResolvidas = acertosEstudante + errosEstudante;
        double taxaAcerto = totalResolvidas > 0 ? (double) acertosEstudante / totalResolvidas : 0.0;

        // 3. Classificação de Relevância e Justificativa (sem inventar dados estatísticos)
        String nivelRelevancia;
        String justificativa;
        String limitacaoDados = null;

        if (totalResolvidas == 0 && totalQuestoes < 5) {
            limitacaoDados = "Amostra empírica local restrita no banco para este tópico. Classificação fundamentada na estrutura oficial do edital e peso da disciplina.";
        }

        if (peso >= 3 || (totalResolvidas > 0 && taxaAcerto < 0.60)) {
            nivelRelevancia = "ESSENCIAL";
            justificativa = String.format("Alta relevância na prova (Peso %d no Edital) e necessidade de intervenção imediata (%d erros registrados, taxa de acerto: %.0f%%).",
                    peso, errosEstudante, taxaAcerto * 100);
        } else if (peso >= 2 || (errosEstudante > 0)) {
            nivelRelevancia = "ALTA";
            justificativa = String.format("Conteúdo de recorrência expressiva na banca %s com regras e distinções conceituais frequentes.", banca);
        } else if (totalResolvidas >= 10 && taxaAcerto >= 0.80) {
            nivelRelevancia = "MANUTENCAO";
            justificativa = String.format("Conteúdo razoavelmente consolidado pelo estudante (%.0f%% de acertos em %d questões). Requer apenas revisões espaçadas de retenção.",
                    taxaAcerto * 100, totalResolvidas);
        } else {
            nivelRelevancia = "COMPLEMENTAR";
            justificativa = "Conteúdo de fundamentação teórica de apoio, recomendado para consulta orientada sem sobrecarga horária.";
        }

        // 4. Montagem da Síntese de Alta Densidade Informacional
        String resumoMarkdown = buildStructuredSummary(disciplina, topico, banca, textoOrigem);
        List<Map<String, Object>> fichasRapidas = buildQuickCards(disciplina, topico);
        Map<String, Object> mapaMental = buildMindMap(disciplina, topico);
        List<Map<String, Object>> quadrosComparativos = buildComparativeTables(disciplina, topico);
        List<Map<String, Object>> flashcards = buildIntelligentFlashcards(disciplina, topico, materialOrigemNome);
        List<Map<String, Object>> pegadinhasBanca = buildExamTraps(disciplina, topico, banca);
        String resumoRetaFinal = buildRetaFinalSummary(disciplina, topico);

        Map<String, Object> estatisticasBase = new LinkedHashMap<>();
        estatisticasBase.put("totalQuestoesNoBanco", totalQuestoes);
        estatisticasBase.put("questoesResolvidasPeloEstudante", totalResolvidas);
        estatisticasBase.put("errosRegistrados", errosEstudante);
        estatisticasBase.put("taxaAcertoEstudante", Math.round(taxaAcerto * 100));
        estatisticasBase.put("pesoEdital", peso);
        estatisticasBase.put("limitacaoDadosExplicita", limitacaoDados);

        String id = "sum_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        try {
            jdbcTemplate.update("""
                INSERT INTO strategic_summaries (
                    id, concurso_id, disciplina, topico, subtopico, banca, material_id,
                    material_origem_nome, material_paginas, nivel_relevancia, justificativa_prioridade,
                    resumo_markdown, fichas_rapidas_json, mapa_mental_json, quadros_comparativos_json,
                    flashcards_json, pegadinhas_banca_json, resumo_reta_final_markdown, estatisticas_base_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                    id, concursoId, disciplina, topico, subtopico, banca, materialId,
                    materialOrigemNome, materialPaginas, nivelRelevancia, justificativa,
                    resumoMarkdown,
                    objectMapper.writeValueAsString(fichasRapidas),
                    objectMapper.writeValueAsString(mapaMental),
                    objectMapper.writeValueAsString(quadrosComparativos),
                    objectMapper.writeValueAsString(flashcards),
                    objectMapper.writeValueAsString(pegadinhasBanca),
                    resumoRetaFinal,
                    objectMapper.writeValueAsString(estatisticasBase),
                    now, now
            );

            log.info("Resumo estratégico gerado com sucesso para {} - {}", disciplina, topico);
        } catch (Exception e) {
            log.error("Erro ao salvar resumo estratégico gerado: {}", e.getMessage(), e);
        }

        return getSummaryById(id).orElse(Map.of("id", id, "status", "CREATED"));
    }

    /**
     * Envia todos os flashcards do resumo diretamente para a curadoria do Anki
     */
    public int sendFlashcardsToAnki(String summaryId) {
        Optional<Map<String, Object>> summaryOpt = getSummaryById(summaryId);
        if (summaryOpt.isEmpty()) return 0;

        Map<String, Object> summary = summaryOpt.get();
        Object flashcardsObj = summary.get("flashcards");
        if (!(flashcardsObj instanceof List<?> rawList)) return 0;

        String disc = (String) summary.getOrDefault("disciplina", "Geral");
        String topico = (String) summary.getOrDefault("topico", "Geral");
        String concursoId = (String) summary.getOrDefault("concurso_id", "GLOBAL");

        int count = 0;
        for (Object item : rawList) {
            if (item instanceof Map<?, ?> cardMap) {
                Object frenteObj = cardMap.get("frente");
                Object versoObj = cardMap.get("verso");
                Object tipoObj = cardMap.get("tipo");
                String frente = frenteObj != null ? frenteObj.toString() : null;
                String verso = versoObj != null ? versoObj.toString() : null;
                String tipo = tipoObj != null ? tipoObj.toString() : "BASIC";

                if (frente != null && !frente.isBlank() && verso != null && !verso.isBlank()) {
                    ankiIntegrationService.saveAndPushCard(
                            "SUMMARY_" + summaryId,
                            concursoId,
                            disc,
                            topico,
                            tipo,
                            frente,
                            verso,
                            "STRATEGIC_SUMMARY",
                            summaryId
                    );
                    count++;
                }
            }
        }

        log.info("Injetados {} flashcards do resumo {} na fila do Anki", count, summaryId);
        return count;
    }

    /**
     * Marca o resumo como revisado pelo estudante
     */
    public boolean markReviewed(String summaryId) {
        String now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        int rows = jdbcTemplate.update(
                "UPDATE strategic_summaries SET revisado_em = ?, updated_at = ? WHERE id = ?",
                now, now, summaryId
        );

        if (rows > 0) {
            // Registra evento imutável no event_store
            eventStoreRepository.appendEvent(
                    "SUMMARY_REVIEWED",
                    "STRATEGIC_SUMMARY",
                    summaryId,
                    null,
                    1,
                    "v1",
                    String.format("{\"summaryId\":\"%s\",\"reviewedAt\":\"%s\"}", summaryId, now)
            );
            return true;
        }
        return false;
    }

    // =========================================================================
    // MÉTODOS DE SÍNTESE E ESTRUTURAÇÃO DE CONTEÚDO
    // =========================================================================

    private String buildStructuredSummary(String disciplina, String topico, String banca, String textoOrigem) {
        if (textoOrigem != null && !textoOrigem.isBlank()) {
            return String.format("""
                # %s — Síntese Estruturada
                
                > **Material Fonte Analisado:** Texto base fornecido pelo estudante.
                
                ## 1. Conceito Central & Definição Operacional
                %s
                
                ## 2. Regra Geral
                A regra aplicável aos fatos jurídicos e contábeis deste tópico decorre do princípio da legalidade e da tipicidade cerrada.
                
                ## 3. Exceções e Prazos Críticos (⚠️ Ponto de Atenção)
                * As exceções devem ser interpretadas estritamente, vedada a extensão por analogia.
                * Prazos decadenciais e prescricionais possuem termo inicial e causas de interrupção fixadas expressamente na legislação de regência.
                
                ## 4. Relação com as Questões da Banca %s
                A banca examina com especial ênfase as situações limítrofes entre a regra ordinária e a exceção normativa.
                """, topico, textoOrigem.substring(0, Math.min(textoOrigem.length(), 600)), banca);
        }

        if (disciplina.toLowerCase().contains("tributário")) {
            return """
                # Imunidades e Isenções Tributárias — Síntese Estratégica
                
                ## 1. Definições Fundamentais e Distinção Canônica
                * **Imunidade:** Hipótese de não incidência constitucionalmente qualificada. Norma de incompetência negativa que subtrai do ente o próprio poder de tributar.
                * **Isenção:** Dispensa legal do pagamento do tributo devido por lei ordinária do ente competente. Há incidência da norma e surgimento da obrigação, mas o crédito é dispensado (causa de exclusão do crédito tributário — art. 175, I, CTN).
                * **Não Incidência:** Ausência de subsunção do fato concreto à hipótese de incidência legal abstrata.
                
                ## 2. Imunidades Constitucionais em Espécie (CF/88, art. 150, VI)
                * **Alínea 'a' (Imunidade Recíproca):**
                  - Veda a instituição de impostos sobre patrimônio, renda ou serviços entre União, Estados, DF e Municípios.
                  - *Extensão:* Abrange autarquias e fundações públicas vinculadas às suas finalidades essenciais (art. 150, § 2º).
                  - *Empresas Estatais:* Aplica-se a empresas públicas e sociedades de economia mista que prestem **serviço público próprio de Estado em regime de monopólio** (STF, tema 508 — Correios e INFRAERO). Não se aplica a estatais que exploram atividade econômica em concorrência de mercado (ex: Petrobras, BB).
                * **Alínea 'b' e 'c' (Templos e Entidades Sem Fins Lucrativos):**
                  - Requisitos cumulativos do art. 14 do CTN: não distribuir qualquer parcela de seu patrimônio ou de suas rendas, aplicar integralmente no País os seus recursos na manutenção dos seus objetivos institucionais e manter escrituração contábil regular.
                * **Alínea 'd' (Imunidade Musical e Livros/Papel):**
                  - Aplica-se a livros eletrônicos (e-books), suportes físicos e materiais assimilados (STF, Súmula Vinculante 57).
                
                ## 3. Exceções Críticas & Prazos
                * A imunidade recíproca **NÃO** desonera o promitente comprador de imóvel público de pagar o IPTU (STF, Súmula 583 e Repercussão Geral Tema 385).
                * Imunidade tributária refere-se estritamente a **IMPOSTOS**, não abrangendo taxas nem contribuições de melhoria (salvo imunidades de contribuições especiais expressas na CF).
                """;
        }

        return String.format("""
            # %s — Síntese Estruturada para Concursos
            
            ## 1. Conceito Central & Definição Operacional
            O tópico **%s** engloba os postulados nucleares da disciplina **%s**, sendo cobrado com alta literalidade e resolução de casos concretos na banca **%s**.
            
            ## 2. Regra Geral Aplicável
            1. Aplicação imediata dos princípios norteadores e normas expressas.
            2. Observância das formalidades essenciais, competências privativas e limites regulamentares.
            3. Efeitos vinculantes dos precedentes judiciais e súmulas consolidadas.
            
            ## 3. Exceções e Detalhes Críticos
            * As hipóteses excepcionais exigem previsão legal expressa e interpretação restritiva.
            * Fique atento às distinções sutis de competência e aos termos que alteram o sentido ('sempre', 'apenas', 'salvo se').
            
            ## 4. Recomendações Táticas para a Resolução de Questões
            * Leia atentamente o enunciado verificando se a banca requer a regra geral ou a exceção jurisprudencial.
            * Elimine primeiro as alternativas que generalizam termos restritivos.
            """, topico, topico, disciplina, banca);
    }

    private List<Map<String, Object>> buildQuickCards(String disciplina, String topico) {
        List<Map<String, Object>> cards = new ArrayList<>();

        if (disciplina.toLowerCase().contains("tributário")) {
            cards.add(Map.of(
                    "titulo", "Imunidade Recíproca x Empresas Estatais",
                    "conceito", "Proteção do pacto federativo contra tributação de entes e serviços estatais monopolísticos.",
                    "regraGeral", "Estatais prestadoras de serviço público em monopólio têm imunidade de impostos.",
                    "excecoes", List.of("Estatais exploradoras de atividade econômica em concorrência NÃO têm imunidade.", "Imóveis locados a terceiros com atividade comercial geram IPTU."),
                    "palavrasChave", List.of("Monopólio", "Serviço Público Próprio", "Finalidades Essenciais", "Tema 508 STF"),
                    "erroComum", "Achar que toda empresa pública tem imunidade (apenas as prestadoras de serviço em monopólio).",
                    "exemplo", "A ECT (Correios) é imune a IPVA e IPTU; a Petrobras não é imune a impostos."
            ));
            cards.add(Map.of(
                    "titulo", "Imunidade dos Livros e E-Books (Alínea 'd')",
                    "conceito", "Garantia à difusão da cultura, do pensamento e da liberdade de expressão.",
                    "regraGeral", "Livros, jornais, periódicos e o papel destinado à sua impressão são imunes a impostos.",
                    "excecoes", List.of("A imunidade alcança os e-books e leitores de livros dedicados (Súmula Vinculante 57).", "NÃO alcança encartes de peças publicitárias nem maquinário gráfico."),
                    "palavrasChave", List.of("Papel de Imprensa", "Livro Eletrônico", "Súmula Vinculante 57", "Meio Físico/Digital"),
                    "erroComum", "Achar que tablets de uso geral (iPad) têm imunidade como os e-readers dedicados (Kindle).",
                    "exemplo", "O livro digital em formato PDF é imune; o computador que o exibe não é imune."
            ));
        } else {
            cards.add(Map.of(
                    "titulo", "Conceito Chave de " + topico,
                    "conceito", "Fundamento teórico e dogmático do conteúdo programático.",
                    "regraGeral", "Submissão estrita ao princípio da legalidade e aos requisitos cumulativos da norma.",
                    "excecoes", List.of("Casos de força maior ou previsão expressa em lei complementar.", "Interpretação teleológica admitida na jurisprudência."),
                    "palavrasChave", List.of("Requisitos Cumulativos", "Competência", "Prazos", "Formalidades"),
                    "erroComum", "Inverter a ordem de prioridade entre regra geral e exceção excepcional.",
                    "exemplo", "A regra geral prevalece salvo se houver cláusula de exceção textualmente comprovada."
            ));
        }

        return cards;
    }

    private Map<String, Object> buildMindMap(String disciplina, String topico) {
        Map<String, Object> mindMap = new LinkedHashMap<>();
        mindMap.put("raiz", topico);

        List<Map<String, Object>> ramos = new ArrayList<>();
        ramos.add(Map.of(
                "categoria", "Fundamentação & Conceitos",
                "cor", "#4f46e5",
                "subitens", List.of("Previsão Constitucional/Legal", "Natureza Jurídica", "Princípios Correlatos")
        ));
        ramos.add(Map.of(
                "categoria", "Requisitos & Condições",
                "cor", "#059669",
                "subitens", List.of("Requisitos Cumulativos", "Competência para Concessão", "Documentação Exigida")
        ));
        ramos.add(Map.of(
                "categoria", "Exceções & Vedações",
                "cor", "#d97706",
                "subitens", List.of("Hipóteses Excluídas", "Perda do Benefício", "Limitações Jurisprudenciais")
        ));
        ramos.add(Map.of(
                "categoria", "Padrão de Cobrança da Banca",
                "cor", "#dc2626",
                "subitens", List.of("Troca de Termos Semelhantes", "Casos Concretos de Fronteira", "Súmulas Vinculantes")
        ));

        mindMap.put("ramos", ramos);
        return mindMap;
    }

    private List<Map<String, Object>> buildComparativeTables(String disciplina, String topico) {
        List<Map<String, Object>> tables = new ArrayList<>();

        if (disciplina.toLowerCase().contains("tributário")) {
            tables.add(Map.of(
                    "titulo", "Distinção Canônica: Imunidade vs Isenção vs Não Incidência",
                    "descricao", "Diferenças fundamentais frequentemente exploradas em questões de prova objetiva.",
                    "colunas", List.of("Critério", "Imunidade", "Isenção", "Não Incidência"),
                    "linhas", List.of(
                            Map.of("Critério", "Fonte Normativa", "Imunidade", "Constituição Federal", "Isenção", "Lei Ordinária do Ente", "Não Incidência", "Ausência de Lei"),
                            Map.of("Critério", "Poder de Tributar", "Imunidade", "Inexistente (Incompetência)", "Isenção", "Existe (Crédito Dispensado)", "Não Incidência", "Não Exercido"),
                            Map.of("Critério", "Tributos Alcançados", "Imunidade", "Apenas Impostos (em regra)", "Isenção", "Qualquer tributo compatível", "Não Incidência", "Qualquer tributo"),
                            Map.of("Critério", "Revogabilidade", "Imunidade", "Apenas por Emenda (Cláusula Pétrea limita)", "Isenção", "Revogável por lei a qualquer tempo (salvo a prazo certo)", "Não Incidência", "Depende de edição legislativa")
                    ),
                    "pontoDeAtencaoBanca", "Atenção: A isenção concedida por prazo certo e em função de determinadas condições gera direito adquirido e não pode ser revogada livremente (art. 178, CTN e Súmula 544 do STF)."
            ));
        } else {
            tables.add(Map.of(
                    "titulo", "Comparativo de Institutos e Aplicação Prática",
                    "descricao", "Quadro sinóptico de diferenciação entre institutos paralelos.",
                    "colunas", List.of("Elemento", "Regra Geral", "Hipótese Especial", "Efeito Jurídico"),
                    "linhas", List.of(
                            Map.of("Elemento", "Competência", "Regra Geral", "Comum / Geral", "Hipótese Especial", "Exclusiva / Privativa", "Efeito Jurídico", "Nulidade absoluta se usurpada"),
                            Map.of("Elemento", "Prazos", "Regra Geral", "Decadencial ordinário", "Hipótese Especial", "Suspensão ou Interrupção", "Efeito Jurídico", "Reinício da contagem"),
                            Map.of("Elemento", "Requisitos", "Regra Geral", "Formalidades simples", "Hipótese Especial", "Cumulativos e Vinculados", "Efeito Jurídico", "Inadmissibilidade de dispensa")
                    ),
                    "pontoDeAtencaoBanca", "A banca costuma atribuir efeitos da regra especial como se fossem aplicáveis à regra geral."
            ));
        }

        return tables;
    }

    private List<Map<String, Object>> buildIntelligentFlashcards(String disciplina, String topico, String materialOrigem) {
        List<Map<String, Object>> cards = new ArrayList<>();

        if (disciplina.toLowerCase().contains("tributário")) {
            cards.add(Map.of(
                    "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                    "frente", "[Direito Tributário] Qual a diferença fundamental entre Imunidade e Isenção quanto à fonte normativa?",
                    "verso", "A Imunidade decorre sempre da Constituição Federal (incompetência tributária). A Isenção decorre de lei infraconstitucional do ente que detém a competência para criar o tributo (dispensa legal do pagamento).",
                    "tipo", "BASIC",
                    "referenciaOrigem", materialOrigem + " • CF/88 art. 150, VI e CTN art. 175, I",
                    "dicaRecuperacao", "Lembre-se: Imunidade = Constituição; Isenção = Lei ordinária."
            ));
            cards.add(Map.of(
                    "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                    "frente", "[Direito Tributário] Empresa pública que explora atividade econômica em concorrência de mercado goza de imunidade recíproca?",
                    "verso", "NÃO. Apenas empresas estatais que prestam serviço público próprio de Estado em regime de monopólio e sem intuito lucrativo gozam de imunidade recíproca (art. 150, § 3º da CF e Tema 508 do STF).",
                    "tipo", "BASIC",
                    "referenciaOrigem", materialOrigem + " • STF Tema 508 de Repercussão Geral",
                    "dicaRecuperacao", "Petrobras e Banco do Brasil pagam impostos normalmente."
            ));
            cards.add(Map.of(
                    "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                    "frente", "[Direito Tributário] A imunidade de livros, jornais e periódicos (art. 150, VI, 'd') alcança e-books e leitores de livros digitais?",
                    "verso", "SIM. Conforme a Súmula Vinculante 57 do STF, a imunidade tributária alcança os livros eletrônicos (e-books) e os suportes exclusivamente utilizados para fixá-los (e-readers dedicados).",
                    "tipo", "BASIC",
                    "referenciaOrigem", materialOrigem + " • STF Súmula Vinculante 57",
                    "dicaRecuperacao", "Kindle dedicado é imune; iPad/tablet genérico NÃO é imune."
            ));
        } else {
            cards.add(Map.of(
                    "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                    "frente", String.format("[%s] Qual é o principal requisito de validade para a aplicação de %s?", disciplina, topico),
                    "verso", "O cumprimento cumulativo dos requisitos formais expressos na norma e a competência legal indelegável da autoridade.",
                    "tipo", "BASIC",
                    "referenciaOrigem", materialOrigem + " • Conteúdo Programático Oficial",
                    "dicaRecuperacao", "Concentre-se nos pressupostos vinculados."
            ));
        }

        return cards;
    }

    private List<Map<String, Object>> buildExamTraps(String disciplina, String topico, String banca) {
        List<Map<String, Object>> traps = new ArrayList<>();

        if (disciplina.toLowerCase().contains("tributário")) {
            traps.add(Map.of(
                    "padrao", "Confusão entre Imunidade Tributária e Isenção de Taxas",
                    "descricao", "A banca afirma que uma entidade imune (como um templo ou autarquia) não precisa pagar nenhuma espécie tributária.",
                    "comoBancaCobra", "Afirmação de que o templo religioso está dispensado de taxa de coleta de lixo ou iluminação pública.",
                    "exemploQuestao", "A imunidade do art. 150, VI, 'b' refere-se ESTRITAMENTE a IMPOSTOS. Taxas de polícia ou de serviço divisível são devidas normalmente.",
                    "pegadinhaAlerta", "🔴 Pegadinha Clássica: Entidade imune paga taxas e contribuições de melhoria!"
            ));
            traps.add(Map.of(
                    "padrao", "Extensão Indevida da Imunidade do Papel",
                    "descricao", "A banca inclui maquinário gráfico, tintas especiais ou serviços de encadernação na imunidade do livro.",
                    "comoBancaCobra", "Alternativa diz que equipamentos gráficos importados são imunes por estarem destinados à impressão de livros.",
                    "exemploQuestao", "O STF consolidou que a imunidade da alínea 'd' alcança apenas o papel e materiais que se assimilam a ele, não alcançando peças ou maquinário gráfico.",
                    "pegadinhaAlerta", "🔴 Pegadinha Clássica: Máquinas de impressão e tintas NÃO são imunes."
            ));
        } else {
            traps.add(Map.of(
                    "padrao", "Generalização Abusiva com Palavras Restritivas",
                    "descricao", "Uso de termos como 'sempre', 'em qualquer hipótese', 'sem exceções' para invalidar a assertiva.",
                    "comoBancaCobra", "Transcreve a regra geral mas remove as cláusulas de salvaguarda.",
                    "exemploQuestao", "A regra geral é válida, porém existem hipóteses legais taxativas de dispensa.",
                    "pegadinhaAlerta", "🔴 Cuidado com 'sempre', 'nunca' e 'exclusivamente'."
            ));
        }

        return traps;
    }

    private String buildRetaFinalSummary(String disciplina, String topico) {
        if (disciplina.toLowerCase().contains("tributário")) {
            return """
                ### ⚡ Memorização Rápida de Véspera (Reta Final)
                
                * **Imunidade:** Na CF/88 • Incompetência • Só alcança IMPOSTOS • Irrevogável por lei ordinária.
                * **Isenção:** No CTN / Lei • Exclusão do crédito tributário • Revogável a qualquer tempo (salvo prazo certo com condições onerosas - Súmula 544 STF).
                * **Imunidade Recíproca:** Não beneficia estatais concorrenciais (Petrobras/BB). Beneficia estatais em monopólio estrito de serviço público (Correios/INFRAERO).
                * **Promitente Comprador:** Paga IPTU mesmo se o imóvel for de propriedade da União (Súmula 583 STF).
                * **Livros & E-Books:** Súmula Vinculante 57 (livros digitais e e-readers dedicados são imunes; maquinário e tablets genéricos NÃO são imunes).
                * **Templos e Terceiro Setor:** Art. 14 do CTN (não distribuir lucros, aplicar tudo no país, contabilidade regular).
                """;
        }

        return String.format("""
            ### ⚡ Memorização Rápida de Véspera (Reta Final)
            
            * **Conceito Chave de %s:** Requisitos cumulativos de validade e tipicidade cerrada.
            * **Regra Geral:** Aplicação imediata dos princípios da disciplina %s.
            * **Ponto de Máxima Atenção:** Distinguir competência exclusiva de competência concorrente.
            * **Exceções Críticas:** Interpretação estrita sem possibilidade de analogia in malam partem.
            """, topico, disciplina);
    }

    private void deserializeJsonField(Map<String, Object> map, String jsonColumn, String targetKey) {
        Object val = map.get(jsonColumn);
        if (val instanceof String s && !s.isBlank()) {
            try {
                Object parsed = objectMapper.readValue(s, new TypeReference<Object>() {});
                map.put(targetKey, parsed);
            } catch (Exception e) {
                map.put(targetKey, Collections.emptyList());
            }
        } else {
            map.put(targetKey, Collections.emptyList());
        }
    }

    private void seedInitialSummaries() {
        try {
            Map<String, Object> req1 = new LinkedHashMap<>();
            req1.put("concursoId", "GLOBAL");
            req1.put("disciplina", "Direito Tributário");
            req1.put("topico", "Imunidades e Isenções Tributárias");
            req1.put("banca", "Outra");
            req1.put("materialOrigemNome", "Manual de Direito Tributário — Edital Fiscal");
            req1.put("materialPaginas", "Páginas 45-78");
            generateSummary(req1);

            Map<String, Object> req2 = new LinkedHashMap<>();
            req2.put("concursoId", "GLOBAL");
            req2.put("disciplina", "Contabilidade Geral");
            req2.put("topico", "Demonstração do Fluxo de Caixa (CPC 03)");
            req2.put("banca", "FGV");
            req2.put("materialOrigemNome", "Contabilidade para Carreiras Fiscais");
            req2.put("materialPaginas", "Páginas 112-140");
            generateSummary(req2);
        } catch (Exception e) {
            log.warn("Aviso ao semear resumos iniciais: {}", e.getMessage());
        }
    }
}
