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

    public enum KnowledgeDomain {
        CONTABILIDADE,
        DIREITO_PENAL,
        DIREITO_TRIBUTARIO,
        DIREITO_ADMINISTRATIVO,
        DIREITO_CONSTITUCIONAL,
        AUDITORIA,
        TI_EXATAS,
        PORTUGUES,
        GERAL
    }

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

            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM strategic_summaries", Integer.class);
            // New installations intentionally contain no demonstration summaries.
        } catch (Exception e) {
            log.error("Erro ao inicializar tabela strategic_summaries: {}", e.getMessage());
        }
    }

    /**
     * Resolve o domínio do conhecimento para assegurar isolamento epistêmico estrito,
     * impedindo categoricamente a contaminação de conceitos jurídicos/penais em contabilidade e exatas.
     */
    /**
     * Resolve o domínio do conhecimento para assegurar isolamento epistêmico estrito,
     * impedindo categoricamente a contaminação de conceitos jurídicos/penais em contabilidade e exatas.
     */
    public KnowledgeDomain resolveDomain(String disciplina) {
        return resolveDomain(disciplina, null);
    }

    public KnowledgeDomain resolveDomain(String disciplina, String topico) {
        String combined = ((disciplina != null ? disciplina : "") + " " +
                (topico != null ? topico : "")).toLowerCase().trim();

        // 1. Contabilidade & CPCs têm precedência máxima para evitar contaminação com penal/tributário
        if (combined.contains("contab") || combined.contains("cpc") || combined.contains("demonstração do fluxo") ||
                combined.contains("demonstracao do fluxo") || combined.contains("balanço") || combined.contains("balanco") ||
                combined.contains("dre") || combined.contains("patrimônio líquido") || combined.contains("ativo imobilizado") ||
                combined.contains("fluxo de caixa")) {
            return KnowledgeDomain.CONTABILIDADE;
        }
        if (combined.contains("auditor")) {
            return KnowledgeDomain.AUDITORIA;
        }
        if (combined.contains("penal") || combined.contains("criminol") || combined.contains("infracional")) {
            return KnowledgeDomain.DIREITO_PENAL;
        }
        if (combined.contains("tribut") || (combined.contains("fiscal") && !combined.contains("auditor"))) {
            return KnowledgeDomain.DIREITO_TRIBUTARIO;
        }
        if (combined.contains("admin") || combined.contains("licita") || combined.contains("estatut") || combined.contains("público") || combined.contains("publico")) {
            return KnowledgeDomain.DIREITO_ADMINISTRATIVO;
        }
        if (combined.contains("constituc")) {
            return KnowledgeDomain.DIREITO_CONSTITUCIONAL;
        }
        if (combined.contains("tecnologia") || combined.contains("informática") || combined.contains("informatica") ||
                combined.contains("dados") || combined.contains("raciocínio") || combined.contains("raciocinio") ||
                combined.contains("estatística") || combined.contains("estatistica") || combined.contains("matemática") || combined.contains("matematica")) {
            return KnowledgeDomain.TI_EXATAS;
        }
        if (combined.contains("português") || combined.contains("portugues") || combined.contains("redação") ||
                combined.contains("redacao") || combined.contains("interpretação") || combined.contains("interpretacao") ||
                combined.contains("língua") || combined.contains("lingua")) {
            return KnowledgeDomain.PORTUGUES;
        }
        return KnowledgeDomain.GERAL;
    }

    /**
     * Lista resumos estratégicos por concurso ou disciplina
     */
    public List<Map<String, Object>> getSummaries(String concursoId, String disciplina, String topico) {
        StringBuilder sql = new StringBuilder("SELECT id, concurso_id, disciplina, topico, subtopico, banca, " +
                "material_origem_nome, material_paginas, nivel_relevancia, justificativa_prioridade, revisado_em, created_at, updated_at " +
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

        List<Map<String,Object>> summaries=jdbcTemplate.queryForList(sql.toString(), params.toArray());
        summaries.forEach(row -> {row.put("contentKind","UNVERIFIED"); row.put("sourceVerified",false);});
        return summaries;
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
            deserializeJsonField(row, "fichas_rapidas_json", "fichasRapidas");
            deserializeJsonField(row, "mapa_mental_json", "mapaMental");
            deserializeJsonField(row, "quadros_comparativos_json", "quadrosComparativos");
            deserializeJsonField(row, "flashcards_json", "flashcards");
            deserializeJsonField(row, "pegadinhas_banca_json", "pegadinhasBanca");
            deserializeJsonField(row, "estatisticas_base_json", "estatisticasBase");

            row.put("contentKind", "LEGACY_UNVERIFIED");
            row.put("sourceVerified", false);
            if(row.get("estatisticasBase") instanceof Map<?,?> stats && stats.containsKey("contentKind")) row.put("contentKind",stats.get("contentKind"));
            row.put("provenanceNotice", "Título e páginas vinculados não comprovam leitura nem validação da fonte.");
            return Optional.of(row);
        } catch (Exception e) {
            log.error("Erro ao buscar resumo {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Localiza automaticamente o material didático vinculado e páginas do PDF do estudante.
     */
    private Map<String, Object> resolveMaterialContext(String concursoId, String disciplina, String topico,
            String materialId, String materialOrigemNome, String materialPaginas, String textoOrigem) {
        Map<String,Object> ctx=new LinkedHashMap<>();
        ctx.put("materialId",null); ctx.put("materialNome", "Fonte não vinculada");
        ctx.put("materialFormato", "DESCONHECIDO");ctx.put("materialAutor", "");
        ctx.put("materialPaginas", "Não verificadas");
        // A title, page range or study note is not evidence that PDF content was retrieved.
        ctx.put("textoOrigem", textoOrigem==null?"":textoOrigem);
        if(materialId!=null && !materialId.isBlank()) {
            List<Map<String,Object>> rows=jdbcTemplate.queryForList("SELECT id,titulo,autor,formato,concurso_id FROM study_materials WHERE id=?",materialId);
            if(rows.isEmpty()) throw new IllegalArgumentException("Material informado não existe");
            Map<String,Object> material=rows.get(0);
            Object scope=material.get("concurso_id");
            if(scope!=null && !"GLOBAL".equals(scope) && !Objects.equals(scope,concursoId)) throw new IllegalArgumentException("Material pertence a outro concurso");
            ctx.put("materialId", materialId);ctx.put("materialNome", material.get("titulo"));
            ctx.put("materialFormato", Objects.toString(material.get("formato"),"DESCONHECIDO"));
            ctx.put("materialAutor", Objects.toString(material.get("autor"),""));
            if(materialPaginas!=null && !materialPaginas.isBlank()) ctx.put("materialPaginas",materialPaginas+" (informadas pelo usuário; não verificadas)");
        }
        return ctx;
    }

    /**
     * Consulta as questões reais da banca examinadora localmente,
     * extraindo padrões de incidência, armadilhas frequentes e enunciados de prova.
     */
    private Map<String, Object> resolveExamContext(String concursoId, String disciplina, String topico, String bancaParam) {
        Map<String, Object> examCtx = new LinkedHashMap<>();
        String bancaAlvo = bancaParam;

        if (bancaAlvo == null || bancaAlvo.isBlank() || "Outra".equalsIgnoreCase(bancaAlvo) || "GLOBAL".equalsIgnoreCase(bancaAlvo)) {
            try {
                if (concursoId != null && !concursoId.isBlank() && !"GLOBAL".equalsIgnoreCase(concursoId)) {
                    List<Map<String, Object>> concRows = jdbcTemplate.queryForList(
                            "SELECT banca FROM concursos WHERE id = ? LIMIT 1", concursoId
                    );
                    if (!concRows.isEmpty() && concRows.get(0).get("banca") != null && !concRows.get(0).get("banca").toString().isBlank()) {
                        bancaAlvo = (String) concRows.get(0).get("banca");
                    }
                }
                if (bancaAlvo == null || bancaAlvo.isBlank() || "Outra".equalsIgnoreCase(bancaAlvo) || "GLOBAL".equalsIgnoreCase(bancaAlvo)) {
                    // Tenta obter do primeiro concurso cadastrado no sistema
                    List<Map<String, Object>> concRows = jdbcTemplate.queryForList(
                            "SELECT banca FROM concursos WHERE banca IS NOT NULL AND banca != '' AND banca != 'Outra' ORDER BY id ASC LIMIT 1"
                    );
                    if (!concRows.isEmpty() && concRows.get(0).get("banca") != null) {
                        bancaAlvo = (String) concRows.get(0).get("banca");
                    }
                }
            } catch (Exception ignored) {}
        }
        if (bancaAlvo == null || bancaAlvo.isBlank() || "Outra".equalsIgnoreCase(bancaAlvo) || "GLOBAL".equalsIgnoreCase(bancaAlvo)) {
            bancaAlvo = "Oficial";
        }

        List<Map<String, Object>> questoesBanca = Collections.emptyList();
        try {
            questoesBanca = jdbcTemplate.queryForList("""
                SELECT id, enunciado, options_json, correct_option, justificativa, ano, banca, orgao
                FROM questions
                WHERE LOWER(disciplina) = LOWER(?)
                  AND (LOWER(assunto) LIKE LOWER(?) OR LOWER(enunciado) LIKE LOWER(?))
                  AND LOWER(banca) = LOWER(?)
                ORDER BY ano DESC LIMIT 15
            """, disciplina, "%" + topico + "%", "%" + topico + "%", bancaAlvo);

            if (questoesBanca.isEmpty()) {
                questoesBanca = jdbcTemplate.queryForList("""
                    SELECT id, enunciado, options_json, correct_option, justificativa, ano, banca, orgao
                    FROM questions
                    WHERE LOWER(disciplina) = LOWER(?)
                      AND (LOWER(assunto) LIKE LOWER(?) OR LOWER(enunciado) LIKE LOWER(?))
                    ORDER BY ano DESC LIMIT 15
                """, disciplina, "%" + topico + "%", "%" + topico + "%");
            }
        } catch (Exception e) {
            log.warn("Aviso ao buscar questões da banca: {}", e.getMessage());
        }

        examCtx.put("bancaAlvo", bancaAlvo);
        examCtx.put("totalQuestoesBanca", questoesBanca.size());
        examCtx.put("questoesAmostra", questoesBanca);
        return examCtx;
    }

    /**
     * Pipeline Híbrido: Gera ou regenera um resumo estratégico inteligente
     * cruzando as páginas vinculadas do PDF do estudante com as questões da banca selecionada.
     */
    public Map<String, Object> generateSummary(Map<String, Object> req) {
        String concursoId = (String) req.getOrDefault("concursoId", "GLOBAL");
        String disciplina = (String) req.getOrDefault("disciplina", "Direito Tributário");
        String topico = (String) req.getOrDefault("topico", "Imunidades e Isenções Tributárias");
        String subtopico = (String) req.getOrDefault("subtopico", "");
        String banca = (String) req.getOrDefault("banca", "Outra");
        String materialId = (String) req.get("materialId");
        String materialOrigemNome = (String) req.getOrDefault("materialOrigemNome", "");
        String materialPaginas = (String) req.getOrDefault("materialPaginas", "");
        String textoOrigem = (String) req.getOrDefault("textoOrigem", "");

        // 1. Isolamento Epistêmico Obrigatório (Considera Disciplina e Tópico)
        KnowledgeDomain domain = resolveDomain(disciplina, topico);

        // 2. Resolução do Contexto do Material Didático (PDF e Páginas Vinculadas)
        Map<String, Object> materialCtx = resolveMaterialContext(
                concursoId, disciplina, topico, materialId, materialOrigemNome, materialPaginas, textoOrigem
        );
        String finalMaterialNome = (String) materialCtx.get("materialNome");
        String finalMaterialPaginas = (String) materialCtx.get("materialPaginas");
        String finalTextoOrigem = (String) materialCtx.get("textoOrigem");
        String finalMaterialId = (String) materialCtx.get("materialId");

        // 3. Resolução do Contexto das Questões da Banca
        Map<String, Object> examCtx = resolveExamContext(concursoId, disciplina, topico, banca);
        String bancaAlvo = (String) examCtx.get("bancaAlvo");
        int totalQuestoesBanca = ((Number) examCtx.getOrDefault("totalQuestoesBanca", 0)).intValue();

        // 4. Coleta dados reais do Edital
        int peso = 2;
        try {
            List<Map<String, Object>> topicoRows = jdbcTemplate.queryForList(
                    "SELECT peso FROM edital_topicos WHERE (concurso_id = ? OR concurso_id IS NULL OR concurso_id = 'GLOBAL') " +
                            "AND LOWER(disciplina) = LOWER(?) AND LOWER(assunto) LIKE LOWER(?) LIMIT 1",
                    concursoId, disciplina, "%" + topico + "%"
            );
            if (!topicoRows.isEmpty() && topicoRows.get(0).get("peso") != null) {
                peso = ((Number) topicoRows.get(0).get("peso")).intValue();
            }
        } catch (Exception ignored) {}

        // 5. Coleta evidências de resolução e métricas do estudante
        int totalQuestoesGerais = 0;
        int errosEstudante = 0;
        int acertosEstudante = 0;

        try {
            Integer qCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM questions WHERE LOWER(disciplina) = LOWER(?) AND LOWER(assunto) LIKE LOWER(?)",
                    Integer.class, disciplina, "%" + topico + "%"
            );
            totalQuestoesGerais = (qCount != null) ? qCount : 0;

            List<Map<String, Object>> studentEvents = jdbcTemplate.queryForList(
                    "SELECT e.payload_json FROM event_store e " +
                            "INNER JOIN questions q ON q.id = e.aggregate_id " +
                            "WHERE e.event_type = 'ANSWER_SUBMITTED' AND e.origin = 'REAL_STUDY' AND LOWER(q.disciplina) = LOWER(?) " +
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

        // 6. Classificação de Relevância
        String nivelRelevancia;
        String justificativa;
        String limitacaoDados = null;

        if (totalResolvidas == 0 && totalQuestoesGerais < 5) {
            limitacaoDados = "Amostra empírica local restrita no banco para este tópico. Classificação fundamentada na estrutura oficial do edital e peso da disciplina.";
        }

        if (peso >= 3 || (totalResolvidas > 0 && taxaAcerto < 0.60)) {
            nivelRelevancia = "ESSENCIAL";
            justificativa = String.format("Alta relevância na prova (Peso %d no Edital) e necessidade de intervenção imediata (%d erros registrados, taxa de acerto: %.0f%%).",
                    peso, errosEstudante, taxaAcerto * 100);
        } else if (peso >= 2 || (errosEstudante > 0)) {
            nivelRelevancia = "ALTA";
            justificativa = String.format("Conteúdo de recorrência expressiva na banca %s com regras e distinções conceituais frequentes cruzadas com o material didático.", bancaAlvo);
        } else if (totalResolvidas >= 10 && taxaAcerto >= 0.80) {
            nivelRelevancia = "MANUTENCAO";
            justificativa = String.format("Conteúdo razoavelmente consolidado pelo estudante (%.0f%% de acertos em %d questões). Requer apenas revisões espaçadas de retenção.",
                    taxaAcerto * 100, totalResolvidas);
        } else {
            nivelRelevancia = "COMPLEMENTAR";
            justificativa = "Conteúdo de fundamentação teórica de apoio, recomendado para consulta orientada sem sobrecarga horária.";
        }

        justificativa = "Prioridade indicativa pelo peso cadastrado e respostas elegíveis; recorrência da banca e domínio não foram demonstrados.";

        // Without a source retrieval pipeline, return an explicit scaffold or verbatim user excerpt.
        boolean hasExcerpt=finalTextoOrigem!=null && !finalTextoOrigem.isBlank();
        String resumoMarkdown="## "+topico+"\n\n"+(hasExcerpt
                ? "**Trecho fornecido pelo usuário — não verificado contra o documento.**\n\n"+finalTextoOrigem
                : "**Roteiro de estudo (template), sem síntese fundamentada em fonte.**\n\nRecupere o conceito sem consulta, registre sua dúvida e vincule um trecho verificável do material antes de elaborar uma síntese.");
        List<Map<String,Object>> fichasRapidas=List.of();
        Map<String,Object> mapaMental=Map.of("topico",topico,"status","AGUARDANDO_FONTE");
        List<Map<String,Object>> quadrosComparativos=List.of();
        List<Map<String,Object>> flashcards=List.of();
        List<Map<String,Object>> pegadinhasBanca=List.of();
        String resumoRetaFinal="Não gerado: exige síntese revisada com referências verificáveis.";

        // 8. Registro de Rastreabilidade e Proveniência do Pipeline Híbrido
        Map<String, Object> estatisticasBase = new LinkedHashMap<>();
        estatisticasBase.put("pipelineHibrido", false);
        estatisticasBase.put("contentKind", hasExcerpt ? "USER_EXCERPT" : "TEMPLATE");
        estatisticasBase.put("sourceVerified", false);
        estatisticasBase.put("sourceText", hasExcerpt ? finalTextoOrigem : "");
        estatisticasBase.put("sourceRetrieval", "NOT_PERFORMED");
        estatisticasBase.put("dominioEpistemico", domain.name());
        estatisticasBase.put("bancaAlvo", bancaAlvo);
        estatisticasBase.put("totalQuestoesBanca", totalQuestoesBanca);
        estatisticasBase.put("totalQuestoesNoBanco", totalQuestoesGerais);
        estatisticasBase.put("materialVinculado", finalMaterialNome);
        estatisticasBase.put("paginasVinculadas", finalMaterialPaginas);
        estatisticasBase.put("materialFormato", materialCtx.get("materialFormato"));
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
                    id, concursoId, disciplina, topico, subtopico, bancaAlvo, finalMaterialId,
                    finalMaterialNome, finalMaterialPaginas, nivelRelevancia, justificativa,
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

            log.info("Resumo estratégico gerado via Pipeline Híbrido [{}]: {} - {}", domain, disciplina, topico);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao persistir resumo; nenhuma criação foi confirmada", e);
        }

        return getSummaryById(id).orElseThrow(() -> new IllegalStateException("Resumo gravado não pôde ser lido"));
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
    // GERADORES ESPECIALIZADOS COM ISOLAMENTO EPISTÊMICO E PIPELINE HÍBRIDO
    // =========================================================================

    private String buildStructuredSummary(KnowledgeDomain domain, String disciplina, String topico,
                                          String banca, String materialNome, String paginas, String textoOrigem) {
        String headerMaterial = String.format("> **Proveniência do Pipeline Híbrido:** Material: *%s* (%s) • Cruzamento: Questões da Banca *%s*.\n\n",
                materialNome, paginas, banca);

        if (textoOrigem != null && !textoOrigem.isBlank()) {
            String excerpt = textoOrigem.substring(0, Math.min(textoOrigem.length(), 600));
            return headerMaterial + String.format("""
                # %s — Síntese Estruturada
                
                ## 1. Conceito Central & Fundamentação Teórica
                %s
                
                ## 2. Regra Geral Aplicável
                A análise técnica do conteúdo fundamenta-se nos preceitos formais e normativos que regem a matéria, observando o regime de aplicabilidade no edital.
                
                ## 3. Exceções e Pontos Críticos de Prova (⚠️ Atenção)
                * As exceções devem ser interpretadas estritamente segundo a literalidade dos dispositivos de regência.
                * Hipóteses limítrofes e casos práticos de diferenciação conceitual.
                
                ## 4. Incidência na Banca %s
                A banca examina com especial ênfase as situações de transição e distinções terminológicas precisas.
                """, topico, excerpt, banca);
        }

        switch (domain) {
            case CONTABILIDADE:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica Contábil
                    
                    ## 1. Conceito Central & Estrutura Conceitual (CPC 00 / Pronunciamentos Técnicos)
                    * **Definição Operacional:** O tópico **%s** fundamenta-se nos Pronunciamentos Técnicos Contábeis (CPCs) e na Lei 6.404/76 (Lei das S.A.).
                    * **Mecânica Contábil:** Toda operação reflete o método das partidas dobradas (Frei Luca Pacioli): para cada aplicação de recursos (Débito) há uma origem correspondente (Crédito).
                    * **Regime de Competência vs Regime de Caixa:** Os efeitos das transações e outros eventos são reconhecidos contabilmente quando ocorrem (e não quando o caixa é recebido ou pago).
                    
                    ## 2. Regras Fundamentais de Mensuração e Reconhecimento
                    1. **Elementos das Demonstrações:**
                       - **Ativo:** Recurso econômico presente controlado pela entidade como resultado de eventos passados.
                       - **Passivo:** Obrigação presente da entidade de transferir um recurso econômico como resultado de eventos passados.
                       - **Patrimônio Líquido:** Participação residual nos ativos da entidade após a dedução de todos os seus passivos.
                    2. **Demonstração do Fluxo de Caixa (CPC 03 / DFC):**
                       - **Fluxo Operacional:** Atividades operacionais principais geradoras de receita e despesas normais da empresa.
                       - **Fluxo de Investimento:** Recursos despendidos na aquisição ou venda de ativos de longo prazo (imobilizado, intangível e investimentos).
                       - **Fluxo de Financiamento:** Atividades que resultam em mudanças no tamanho e na composição do capital próprio e nos empréstimos tomados pela entidade.
                    3. **Provisões vs Passivos Contingentes (CPC 25):**
                       - Provisão é um passivo de prazo ou de valor incerto, reconhecido no balanço quando o desembolso for provável (>50%%) e mensurável confiavelmente.
                       - Passivo contingente NÃO é reconhecido em balanço patrimonial, exigindo apenas divulgação em notas explicativas (quando a saída for possível).
                    
                    ## 3. Padrão de Cobrança e Incidência na Banca %s
                    * A **%s** privilegia enunciados com operações contábeis sucessivas exigindo a conciliação do lucro com o caixa ou cálculo de saldos finais.
                    * Em DFC, a banca cobra a diferença entre o **Método Direto** (recebimentos e pagamentos brutos) e o **Método Indireto** (ajuste do Lucro Líquido pelas despesas/receitas que não afetam o caixa, como depreciação).
                    """, topico, topico, banca, banca);

            case DIREITO_TRIBUTARIO:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica Tributária
                    
                    ## 1. Definições Fundamentais e Distinção Canônica
                    * **Imunidade:** Hipótese de não incidência constitucionalmente qualificada. Norma de incompetência negativa que subtrai do ente o próprio poder de tributar.
                    * **Isenção:** Dispensa legal do pagamento do tributo devido por lei ordinária do ente competente. Há incidência da norma e surgimento da obrigação, mas o crédito é dispensado (causa de exclusão do crédito tributário — art. 175, I, CTN).
                    * **Não Incidência:** Ausência de subsunção do fato concreto à hipótese de incidência legal abstrata.
                    
                    ## 2. Imunidades Constitucionais em Espécie (CF/88, art. 150, VI)
                    * **Alínea 'a' (Imunidade Recíproca):**
                      - Veda a instituição de impostos sobre patrimônio, renda ou serviços entre União, Estados, DF e Municípios.
                      - *Extensão:* Abrange autarquias e fundações públicas vinculadas às suas finalidades essenciais (art. 150, § 2º).
                      - *Empresas Estatais:* Aplica-se a empresas públicas e sociedades de economia mista que prestem serviço público próprio de Estado em regime de monopólio (STF, Tema 508 — Correios e INFRAERO). Não se aplica a estatais em concorrência de mercado (ex: Petrobras, BB).
                    * **Alínea 'd' (Imunidade dos Livros e Papel):**
                      - Aplica-se a livros eletrônicos (e-books) e suportes dedicados (STF, Súmula Vinculante 57). Não alcança encartes publicitários ou maquinário.
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * Foco em pegadinhas sobre imunidade alcançando estritamente **IMPOSTOS** (não abrange taxas nem contribuições de melhoria).
                    * O promitente comprador de imóvel público deve pagar IPTU normalmente (STF, Súmula 583 e Tema 385).
                    """, topico, banca);

            case DIREITO_PENAL:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica de Direito Penal
                    
                    ## 1. Princípios Estruturantes
                    * **Legalidade Estrita e Anterioridade (art. 5º, XXXIX, CF e art. 1º, CP):** Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.
                    * **Taxatividade e Tipicidade Cerrada:** A norma incriminadora deve descrever condutas de modo preciso, vedada a tipicidade aberta em preceitos penais incriminadores.
                    * **Vedação da Analogia *in malam partem*:** É terminantemente proibido o emprego de analogia para criar crimes ou agravar sanções penais (admitida apenas a analogia *in bonam partem*).
                    
                    ## 2. Teoria Tripartida do Delito
                    * **Fato Típico:** Conduta (dolosa ou culposa), resultado naturalístico (nos crimes materiais), nexo causal e tipicidade (formal e material).
                    * **Ilicitude / Antijuridicidade:** Contrariedade à ordem jurídica, afastada pelas excludentes legais (legítima defesa, estado de necessidade, estrito cumprimento de dever legal e exercício regular de direito).
                    * **Culpabilidade:** Juízo de reprovação pessoal (imputabilidade, potencial consciência da ilicitude e exigibilidade de conduta diversa).
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * A banca costuma propor casos práticos para identificação de excludentes de ilicitude versus excludentes de culpabilidade.
                    """, topico, banca);

            case DIREITO_ADMINISTRATIVO:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica de Direito Administrativo
                    
                    ## 1. Princípios Expressos e Implícitos
                    * **Princípios Constitucionais (art. 37, *caput*, CF - LIMPE):** Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência.
                    * **Regime Jurídico-Administrativo:** Bipolariedade entre a **Supremacia do Interesse Público** sobre o privado (prerrogativas) e a **Indisponibilidade do Interesse Público** (sujeições e restrições).
                    
                    ## 2. Atos e Contratos Administrativos
                    * **Elementos/Requisitos do Ato (COMFIFOR):** Competência, Finalidade, Forma, Motivo e Objeto. Apenas competência e forma admitem convalidação se o vício for sanável.
                    * **Atributos do Ato (PATI):** Presunção de Legitimidade, Autoexecutoriedade, Tipicidade e Imperatividade.
                    * **Improbidade Administrativa (Lei 8.429/92 com redação da Lei 14.230/21):** Exigência absoluta de **DOLO ESPECÍFICO** em todas as hipóteses; revogada integralmente a modalidade culposa.
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * Foco em distinção entre nulidade absoluta (revogação por conveniência e oportunidade versus anulação por ilegalidade com efeitos *ex tunc*).
                    """, topico, banca);

            case DIREITO_CONSTITUCIONAL:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica de Direito Constitucional
                    
                    ## 1. Teoria da Constituição e Direitos Fundamentais
                    * **Eficácia das Normas Constitucionais (José Afonso da Silva):** Plena (autoaplicável e irrestrita), Contida (autoaplicável, mas passível de restrição infraconstitucional) e Limitada (depende de integração legislativa para produzir efeitos integrais).
                    * **Remédios Constitucionais:** Habeas Corpus (liberdade de locomoção), Mandado de Segurança (direito líquido e certo não amparado por HC ou HD), Habeas Data (informações e retificação de dados pessoais em bancos governamentais ou públicos).
                    
                    ## 2. Repartição de Competências e Organização do Estado
                    * **Competência Legislativa Privativa da União (art. 22, CF):** Direito civil, comercial, penal, processual, eleitoral, trabalho, trânsito (admite delegação aos Estados por Lei Complementar em questões específicas).
                    * **Competência Concorrente (art. 24, CF):** Direito tributário, financeiro, penitenciário, econômico e urbanístico (União edita normas gerais; Estados e DF exercem competência suplementar).
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * Questões focadas na usurpação de competência privativa da União por leis estaduais ou municipais.
                    """, topico, banca);

            case AUDITORIA:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica de Auditoria Governamental e Fiscal
                    
                    ## 1. Normas Profissionais e Risco de Auditoria (NBC TA)
                    * **Modelo do Risco de Auditoria:** Risco de Auditoria (AR) = Risco de Distorção Relevante (RDR = Risco Inerente x Risco de Controle) x Risco de Detecção (RD).
                    * O auditor não controla o Risco Inerente nem o Risco de Controle (pertencem à entidade auditada). O auditor controla o Risco de Detecção por meio do planejamento da extensão dos procedimentos.
                    
                    ## 2. Procedimentos e Evidências de Auditoria
                    * **Testes de Controle:** Avaliam a efetividade dos controles internos da entidade em prevenir ou detectar distorções relevantes.
                    * **Procedimentos Substantivos:** Testes de detalhes e procedimentos analíticos para detectar distorções relevantes diretamente nos saldos contábeis e transações.
                    * **Tipos de Parecer / Relatório:** Sem Ressalva (Não Modificada), Com Ressalva, Adverso (distorção relevante e generalizada) e Abstenção de Opinião (limitação relevante e generalizada no escopo).
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * Distinção sutil entre parecer adverso e abstenção de opinião nos enunciados.
                    """, topico, banca);

            case TI_EXATAS:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica para Tecnologia e Métodos Quantitativos
                    
                    ## 1. Fundamentos e Modelagem
                    * **Bancos de Dados Relacionais vs Não Relacionais (NoSQL):** Propriedades ACID (Atomicidade, Consistência, Isolamento, Durabilidade) vs Teorema CAP (Consistência, Disponibilidade, Tolerância a Particionamento).
                    * **Modelagem Dimensional:** Esquema Estrela (*Star Schema*) com fatos e dimensões desnormalizadas vs Esquema Floco de Neve (*Snowflake Schema*) com dimensões normalizadas.
                    
                    ## 2. Estatística e Raciocínio Lógico
                    * **Métricas de Posição e Dispersão:** Média, Mediana, Moda; Variância, Desvio Padrão e Coeficiente de Variação (adimensional).
                    * **Probabilidade Condicional e Teorema de Bayes:** Atualização de probabilidades a priori com novas evidências.
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * A banca explora comandos SQL complexos (GROUP BY, HAVING, WINDOW FUNCTIONS: ROW_NUMBER, RANK, DENSE_RANK).
                    """, topico, banca);

            case PORTUGUES:
                return headerMaterial + String.format("""
                    # %s — Síntese Estratégica de Língua Portuguesa
                    
                    ## 1. Sintaxe e Morfologia
                    * **Regência Verbal e Nominal:** Exigência de preposição pelos termos regentes (ex: *assistir* no sentido de ver exige preposição *a*; *visar* no sentido de almejar exige preposição *a*).
                    * **Emprego do Sinal Indicativo de Crase:** Fusão da preposição *a* com o artigo feminino *a(s)* ou pronomes demonstrativos *aquele(s)*, *aquela(s)*, *aquilo*.
                    
                    ## 2. Coesão e Coerência Textual
                    * **Conectivos e Relações de Sentido:** Conjunções adversativas (*mas, porém, contudo*) vs Concessivas (*embora, ainda que, conquanto*).
                    
                    ## 3. Padrão de Cobrança na Banca %s
                    * A banca foca na reescritura de frases mantendo o sentido original e a correção gramatical estrita.
                    """, topico, banca);

            default:
                return headerMaterial + String.format("""
                    # %s — Síntese Estruturada para Concursos
                    
                    ## 1. Conceito Central & Definição Operacional
                    O tópico **%s** engloba os postulados nucleares da disciplina **%s**, sendo cobrado com alta literalidade e resolução de casos concretos na banca **%s**.
                    
                    ## 2. Regra Geral Aplicável
                    1. Aplicação imediata dos princípios norteadores e normas expressas da disciplina.
                    2. Observância das formalidades essenciais, competências privativas e limites regulamentares.
                    3. Efeitos vinculantes de normas de regência e diretrizes consolidadas.
                    
                    ## 3. Exceções e Detalhes Críticos
                    * As hipóteses excepcionais exigem previsão explícita e interpretação restritiva.
                    * Atenção às distinções sutis de termos que alteram o sentido ('sempre', 'apenas', 'salvo se').
                    
                    ## 4. Recomendações Táticas para a Resolução de Questões na Banca %s
                    * Leia atentamente o enunciado verificando se a banca requer a regra geral ou a exceção pontual.
                    * Elimine primeiro as alternativas com generalizações abusivas.
                    """, topico, topico, disciplina, banca, banca);
        }
    }

    private List<Map<String, Object>> buildQuickCards(KnowledgeDomain domain, String disciplina, String topico, String banca) {
        List<Map<String, Object>> cards = new ArrayList<>();

        switch (domain) {
            case CONTABILIDADE:
                cards.add(Map.of(
                        "titulo", "DFC — Método Direto vs Método Indireto (CPC 03)",
                        "conceito", "Demonstração obrigatória pela Lei 6.404/76 e CPC 03 que evidencia as entradas e saídas financeiras de caixa.",
                        "regraGeral", "No Método Direto, discriminam-se os recebimentos e pagamentos brutos operacionais. No Método Indireto, parte-se do Lucro Líquido ajustando despesas/receitas que não afetam caixa (ex: depreciação) e variações no capital de giro.",
                        "excecoes", List.of(
                                "Ambos os métodos chegam EXATAMENTE ao mesmo valor final de Fluxo de Caixa Operacional.",
                                "Apenas o Fluxo Operacional varia de método; os Fluxos de Investimento e Financiamento são idênticos em ambos os métodos."
                        ),
                        "palavrasChave", List.of("CPC 03", "Depreciação Estornada", "Fluxo Operacional", "Capital de Giro"),
                        "erroComum", "Achar que a depreciação entra como saída de caixa (ela é adicionada de volta ao lucro no método indireto pois reduziu o lucro sem saída financeira).",
                        "exemplo", "Venda de mercadoria à vista = Operacional; Compra de máquina para fábrica = Investimento; Empréstimo bancário obtido = Financiamento."
                ));
                cards.add(Map.of(
                        "titulo", "Provisão vs Passivo Contingente (CPC 25)",
                        "conceito", "Tratamento contábil de incertezas futuras com base na probabilidade de saída de recursos.",
                        "regraGeral", "Provável (>50%): Reconhece Provisão no Passivo + Nota Explicativa. Possível: NÃO reconhece no Balanço, apenas divulga em Nota Explicativa. Remoto: NADA faz (nem balanço nem nota).",
                        "excecoes", List.of(
                                "Ativo Contingente: só é reconhecido no balanço quando o ganho for PRATICAMENTE CERTO (100%). Se for apenas provável, divulga em nota.",
                                "Se a provisão não puder ser confiavelmente estimada, é tratada como passivo contingente."
                        ),
                        "palavrasChave", List.of("CPC 25", "Provável (>50%)", "Possível", "Remoto", "Nota Explicativa"),
                        "erroComum", "Registrar contabilmente passivo contingente no balanço patrimonial (ele só vai para notas explicativas).",
                        "exemplo", "Processo trabalhista com perda provável avaliada em R$ 100 mil = Débito em Despesa com Provisão e Crédito em Provisões (Passivo)."
                ));
                break;

            case DIREITO_TRIBUTARIO:
                cards.add(Map.of(
                        "titulo", "Imunidade Recíproca x Empresas Estatais",
                        "conceito", "Proteção do pacto federativo contra tributação de entes e serviços estatais monopolísticos.",
                        "regraGeral", "Estatais prestadoras de serviço público em monopólio têm imunidade de impostos.",
                        "excecoes", List.of(
                                "Estatais exploradoras de atividade econômica em concorrência NÃO têm imunidade.",
                                "Imóveis locados a terceiros com atividade comercial geram IPTU."
                        ),
                        "palavrasChave", List.of("Monopólio", "Serviço Público Próprio", "Finalidades Essenciais", "Tema 508 STF"),
                        "erroComum", "Achar que toda empresa pública tem imunidade (apenas as prestadoras de serviço em monopólio).",
                        "exemplo", "A ECT (Correios) é imune a IPVA e IPTU; a Petrobras não é imune a impostos."
                ));
                cards.add(Map.of(
                        "titulo", "Imunidade dos Livros e E-Books (Alínea 'd')",
                        "conceito", "Garantia à difusão da cultura, do pensamento e da liberdade de expressão.",
                        "regraGeral", "Livros, jornais, periódicos e o papel destinado à sua impressão são imunes a impostos.",
                        "excecoes", List.of(
                                "A imunidade alcança os e-books e leitores de livros dedicados (Súmula Vinculante 57).",
                                "NÃO alcança encartes de peças publicitárias nem maquinário gráfico."
                        ),
                        "palavrasChave", List.of("Papel de Imprensa", "Livro Eletrônico", "Súmula Vinculante 57", "Meio Físico/Digital"),
                        "erroComum", "Achar que tablets de uso geral (iPad) têm imunidade como os e-readers dedicados (Kindle).",
                        "exemplo", "O livro digital em formato PDF é imune; o computador ou tablet que o exibe não é imune."
                ));
                break;

            case DIREITO_PENAL:
                cards.add(Map.of(
                        "titulo", "Legalidade Estrita e Tipicidade Cerrada",
                        "conceito", "Garantia fundamental do cidadão contra o arbítrio punitivo estatal (art. 5º, XXXIX, CF).",
                        "regraGeral", "Apenas lei ordinária em sentido formal e material pode criar tipos penais incriminadores e cominar penas.",
                        "excecoes", List.of(
                                "Medida Provisória JAMAIS pode versar sobre direito penal incriminador (art. 62, § 1º, I, 'b', CF).",
                                "Admite-se analogia apenas *in bonam partem* (em favor do réu)."
                        ),
                        "palavrasChave", List.of("Taxatividade", "Anterioridade", "Analogia in bonam partem", "Reserva Legal"),
                        "erroComum", "Confundir interpretação extensiva permitida com analogia in malam partem proibida.",
                        "exemplo", "Não se pode aplicar punição por analogia para cobrir condutas que a lei esqueceu de tipificar."
                ));
                break;

            case DIREITO_ADMINISTRATIVO:
                cards.add(Map.of(
                        "titulo", "Convalidação de Atos Administrativos",
                        "conceito", "Aproveitamento de ato administrativo com vício sanável, com efeitos retroativos (*ex tunc*).",
                        "regraGeral", "São convalidáveis os atos com vícios de Competência (desde que não privativa) e de Forma (desde que não essencial à validade).",
                        "excecoes", List.of(
                                "Vícios de Motivo, Objeto e Finalidade são INSANÁVEIS (o ato deve ser anulado).",
                                "Não se convalida ato se já houver impugnação expressa ou prejuízo a terceiros."
                        ),
                        "palavrasChave", List.of("Vício Sanável", "Competência Não Exclusiva", "Forma Não Essencial", "Efeito Ex Tunc"),
                        "erroComum", "Achar que vício de finalidade (desvio de poder) pode ser convalidado pela autoridade.",
                        "exemplo", "Portaria assinada por subordinado sem competência exclusiva pode ser convalidada pelo titular do órgão."
                ));
                break;

            case AUDITORIA:
                cards.add(Map.of(
                        "titulo", "Modelo de Risco de Auditoria (NBC TA)",
                        "conceito", "Mensuração probabilística de o auditor expressar opinião inadequada sobre demonstrações com distorção relevante.",
                        "regraGeral", "Risco de Auditoria = Risco de Distorção Relevante (Risco Inerente x Risco de Controle) x Risco de Detecção.",
                        "excecoes", List.of(
                                "Risco Inerente e Risco de Controle são independentes da auditoria (são da entidade).",
                                "O auditor só reduz o Risco de Detecção aumentando o tamanho da amostra e rigor dos testes."
                        ),
                        "palavrasChave", List.of("NBC TA 200", "Risco Inerente", "Risco de Controle", "Risco de Detecção"),
                        "erroComum", "Achar que o auditor pode diminuir o risco de controle da empresa auditada durante seus trabalhos de campo.",
                        "exemplo", "Se o controle interno da empresa é fraco (alto risco de controle), o auditor deve fixar menor risco de detecção aceitável."
                ));
                break;

            default:
                cards.add(Map.of(
                        "titulo", "Conceito Chave de " + topico,
                        "conceito", "Fundamento teórico e dogmático do conteúdo programático.",
                        "regraGeral", "Submissão estrita aos postulados nucleares da disciplina " + disciplina + " e requisitos cumulativos.",
                        "excecoes", List.of("Casos expressamente ressalvados no regulamento do edital.", "Interpretação literal conforme a banca " + banca + "."),
                        "palavrasChave", List.of("Requisitos Cumulativos", "Competência", "Regra Geral", "Prazos"),
                        "erroComum", "Inverter a ordem de prioridade entre regra geral e exceção normativa.",
                        "exemplo", "A regra geral prevalece salvo comprovação cabal da condição de exceção."
                ));
                break;
        }

        return cards;
    }

    private Map<String, Object> buildMindMap(KnowledgeDomain domain, String disciplina, String topico) {
        Map<String, Object> mindMap = new LinkedHashMap<>();
        mindMap.put("raiz", topico);

        List<Map<String, Object>> ramos = new ArrayList<>();
        switch (domain) {
            case CONTABILIDADE:
                ramos.add(Map.of("categoria", "Pronunciamentos & CPCs", "cor", "#059669",
                        "subitens", List.of("CPC 00 (Estrutura)", "CPC 03 (DFC)", "CPC 25 (Provisões)", "Lei 6.404/76")));
                ramos.add(Map.of("categoria", "Mensuração & Reconhecimento", "cor", "#2563eb",
                        "subitens", List.of("Custo Histórico", "Valor Justo", "Regime de Competência", "Partidas Dobradas")));
                ramos.add(Map.of("categoria", "Demonstrações Contábeis", "cor", "#d97706",
                        "subitens", List.of("Balanço Patrimonial", "DRE", "DFC Direta/Indireta", "DMPL/DVA")));
                ramos.add(Map.of("categoria", "Armadilhas da Banca", "cor", "#dc2626",
                        "subitens", List.of("Classificação de Dividendos", "Estorno de Depreciação", "Passivos Contingentes")));
                break;

            case DIREITO_PENAL:
                ramos.add(Map.of("categoria", "Princípios Nucleares", "cor", "#dc2626",
                        "subitens", List.of("Legalidade Estrita", "Taxatividade", "Vedação de Analogia In Malam Partem", "Anterioridade")));
                ramos.add(Map.of("categoria", "Fato Típico", "cor", "#4f46e5",
                        "subitens", List.of("Conduta Dolosa/Culposa", "Resultado Naturalístico", "Nexo Causal", "Tipicidade Formal/Material")));
                ramos.add(Map.of("categoria", "Ilicitude & Excludentes", "cor", "#059669",
                        "subitens", List.of("Legítima Defesa", "Estado de Necessidade", "Estrito Cumprimento do Dever", "Exercício Regular")));
                ramos.add(Map.of("categoria", "Culpabilidade", "cor", "#d97706",
                        "subitens", List.of("Imputabilidade", "Potencial Consciência da Ilicitude", "Exigibilidade de Conduta Diversa")));
                break;

            case DIREITO_TRIBUTARIO:
                ramos.add(Map.of("categoria", "Fontes Constitucionais", "cor", "#4f46e5",
                        "subitens", List.of("Art. 150, VI (Imunidades)", "Pacto Federativo", "Legalidade Estrita", "Anterioridade")));
                ramos.add(Map.of("categoria", "Normas Gerais (CTN)", "cor", "#059669",
                        "subitens", List.of("Hipótese de Incidência", "Fato Gerador", "Lançamento Tributário", "Obrigação Tributária")));
                ramos.add(Map.of("categoria", "Causas de Modificação", "cor", "#d97706",
                        "subitens", List.of("Suspensão (art. 151)", "Extinção (art. 156)", "Exclusão (art. 175 - Isenção e Anistia)")));
                ramos.add(Map.of("categoria", "Jurisprudência Vinculante", "cor", "#dc2626",
                        "subitens", List.of("Tema 508 STF (Estatais)", "Súmula Vinculante 57 (E-books)", "Súmula 583 STF (IPTU)")));
                break;

            default:
                ramos.add(Map.of("categoria", "Fundamentação & Conceitos", "cor", "#4f46e5",
                        "subitens", List.of("Previsão Normativa/Legal", "Conceito Operacional", "Princípios Regentes")));
                ramos.add(Map.of("categoria", "Requisitos & Regras Gerais", "cor", "#059669",
                        "subitens", List.of("Requisitos Cumulativos", "Procedimentos de Aplicação", "Prazos")));
                ramos.add(Map.of("categoria", "Exceções & Vedações", "cor", "#d97706",
                        "subitens", List.of("Casos Ressalvados", "Hipóteses de Nulidade", "Limites Hermenêuticos")));
                ramos.add(Map.of("categoria", "Padrão de Cobrança da Banca", "cor", "#dc2626",
                        "subitens", List.of("Casos Concretos", "Distinção de Termos", "Questões Recorrentes")));
                break;
        }

        mindMap.put("ramos", ramos);
        return mindMap;
    }

    private List<Map<String, Object>> buildComparativeTables(KnowledgeDomain domain, String disciplina, String topico) {
        List<Map<String, Object>> tables = new ArrayList<>();

        switch (domain) {
            case CONTABILIDADE:
                tables.add(Map.of(
                        "titulo", "Demonstração dos Fluxos de Caixa (CPC 03): Método Direto vs Indireto",
                        "descricao", "Diferenças essenciais cobradas nas provas da área fiscal para o Fluxo Operacional.",
                        "colunas", List.of("Critério", "Método Direto", "Método Indireto (da Reconciliação)"),
                        "linhas", List.of(
                                Map.of("Critério", "Ponto de Partida", "Método Direto", "Recebimentos brutos de clientes e pagamentos brutos a fornecedores", "Método Indireto (da Reconciliação)", "Lucro Líquido do Exercício (DRE)"),
                                Map.of("Critério", "Ajustes de Depreciação", "Método Direto", "Não aparecem diretamente (já embutidos no caixa)", "Método Indireto (da Reconciliação)", "Adicionados de volta ao Lucro Líquido (+)"),
                                Map.of("Critério", "Variações no Capital de Giro", "Método Direto", "Refletidas nos pagamentos e recebimentos brutos", "Método Indireto (da Reconciliação)", "Ajustes nas contas a receber, estoques e fornecedores"),
                                Map.of("Critério", "Resultado Final Operacional", "Método Direto", "Exatamente o mesmo valor em ambos", "Método Indireto (da Reconciliação)", "Exatamente o mesmo valor em ambos")
                        ),
                        "pontoDeAtencaoBanca", "Atenção: Apenas o Fluxo de Caixa Operacional tem métodos direto e indireto. Os fluxos de investimento e financiamento são rigorosamente idênticos em ambos os métodos."
                ));
                break;

            case DIREITO_TRIBUTARIO:
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
                break;

            case DIREITO_PENAL:
                tables.add(Map.of(
                        "titulo", "Excludentes de Ilicitude vs Excludentes de Culpabilidade",
                        "descricao", "Diferenciação dogmática fundamental para resolução de questões objetivas.",
                        "colunas", List.of("Critério", "Excludente de Ilicitude (art. 23, CP)", "Excludente de Culpabilidade"),
                        "linhas", List.of(
                                Map.of("Critério", "Conceito", "Excludente de Ilicitude (art. 23, CP)", "O fato é típico, mas deixa de ser antijurídico", "Excludente de Culpabilidade", "O fato é típico e ilícito, mas o autor não é reprovável"),
                                Map.of("Critério", "Hipóteses", "Excludente de Ilicitude (art. 23, CP)", "Legítima defesa, estado de necessidade, estrito cumprimento de dever legal, exercício regular de direito", "Excludente de Culpabilidade", "Inimputabilidade, erro de proibição inevitável, coação moral irresistível, obediência hierárquica"),
                                Map.of("Critério", "Efeito quanto ao Crime", "Excludente de Ilicitude (art. 23, CP)", "Inexiste crime", "Excludente de Culpabilidade", "Inexiste pena (isento de pena)")
                        ),
                        "pontoDeAtencaoBanca", "Cuidado: A coação física irresistível (vis absoluta) exclui a própria conduta (fato típico); a coação moral irresistível (vis compulsiva) exclui a culpabilidade."
                ));
                break;

            default:
                tables.add(Map.of(
                        "titulo", "Comparativo Estratégico de Tópicos Correlatos",
                        "descricao", "Quadro sinóptico de diferenciação entre institutos paralelos cobrados na prova.",
                        "colunas", List.of("Elemento de Análise", "Regra Geral", "Hipótese Especial", "Efeito Prático"),
                        "linhas", List.of(
                                Map.of("Elemento de Análise", "Competência / Atribuição", "Regra Geral", "Ordinária / Vinculada", "Hipótese Especial", "Privativa / Específica", "Efeito Prático", "Nulidade absoluta se usurpada"),
                                Map.of("Elemento de Análise", "Prazos e Condições", "Regra Geral", "Padrão regulamentar", "Hipótese Especial", "Suspensão ou interrupção expressa", "Efeito Prático", "Reinício da contagem temporal"),
                                Map.of("Elemento de Análise", "Interpretação da Banca", "Regra Geral", "Literal e sistemática", "Hipótese Especial", "Restritiva sem extrapolação", "Efeito Prático", "Eliminação de alternativas generalistas")
                        ),
                        "pontoDeAtencaoBanca", "A banca costuma atribuir efeitos da hipótese especial como se fossem aplicáveis à regra geral."
                ));
                break;
        }

        return tables;
    }

    private List<Map<String, Object>> buildIntelligentFlashcards(KnowledgeDomain domain, String disciplina,
                                                                  String topico, String materialOrigem, String paginas) {
        List<Map<String, Object>> cards = new ArrayList<>();
        String ref = materialOrigem + " (" + paginas + ")";

        switch (domain) {
            case CONTABILIDADE:
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Contabilidade Geral • CPC 03] Na Demonstração dos Fluxos de Caixa (DFC), a venda à vista de um veículo do ativo imobilizado é classificada em qual fluxo?",
                        "verso", "Fluxo de Caixa das Atividades de INVESTIMENTO (Entrada de caixa). A alienação de ativos imobilizados ou intangíveis nunca compõe o fluxo operacional.",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • CPC 03 item 16",
                        "dicaRecuperacao", "Imobilizado, intangível e participações societárias = Fluxo de Investimento."
                ));
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Contabilidade Geral • CPC 25] Qual é a diferença fundamental de tratamento entre uma Provisão e um Passivo Contingente?",
                        "verso", "Provisão é reconhecida no Balanço Patrimonial como Passivo (saída provável >50% mensurável). Passivo Contingente NÃO é reconhecido no Balanço, apenas divulgado em Notas Explicativas (saída possível).",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • CPC 25 itens 14 e 27",
                        "dicaRecuperacao", "Provável = Balanço; Possível = Só Notas Explicativas; Remoto = Nada faz."
                ));
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Contabilidade Geral • CPC 03] No Método Indireto da DFC, por que a despesa de depreciação do exercício é SOMADA de volta ao Lucro Líquido?",
                        "verso", "Porque a depreciação reduziu o Lucro Líquido na DRE mas NÃO representou saída financeira de caixa. Logo, deve ser estornada (somada) para encontrar o caixa operacional gerado.",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • CPC 03 item 20",
                        "dicaRecuperacao", "Despesa que não afeta caixa = Soma de volta ao Lucro Líquido."
                ));
                break;

            case DIREITO_TRIBUTARIO:
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Direito Tributário] Qual a diferença fundamental entre Imunidade e Isenção quanto à fonte normativa?",
                        "verso", "A Imunidade decorre sempre da Constituição Federal (norma de incompetência tributária). A Isenção decorre de lei infraconstitucional do ente competente (dispensa legal do pagamento - exclusão do crédito, art. 175, I, CTN).",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • CF/88 art. 150, VI e CTN art. 175, I",
                        "dicaRecuperacao", "Imunidade = CF/88; Isenção = Lei ordinária."
                ));
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Direito Tributário] Empresa pública que explora atividade econômica em concorrência de mercado goza de imunidade tributária recíproca?",
                        "verso", "NÃO. Apenas empresas estatais prestadoras de serviço público em monopólio estrito gozam de imunidade recíproca (art. 150, § 3º, CF e STF Tema 508).",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • STF Tema 508",
                        "dicaRecuperacao", "Petrobras e Banco do Brasil pagam impostos normalmente."
                ));
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Direito Tributário] A imunidade de livros, jornais e periódicos alcança os e-books e aparelhos leitores digitais?",
                        "verso", "SIM. Conforme a Súmula Vinculante 57 do STF, alcança os livros eletrônicos e os suportes dedicados (e-readers como Kindle). Não alcança tablets de uso genérico (iPad).",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • Súmula Vinculante 57 STF",
                        "dicaRecuperacao", "Kindle = Imune; iPad genérico = NÃO imune."
                ));
                break;

            case DIREITO_PENAL:
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", "[Direito Penal] É permitida a utilização de analogia in malam partem no direito penal incriminador brasileiro?",
                        "verso", "NÃO. Pelo princípio da legalidade estrita e tipicidade cerrada, a analogia contra o réu (in malam partem) é terminantemente proibida. É admitida apenas a analogia in bonam partem.",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • CF/88 art. 5º, XXXIX e CP art. 1º",
                        "dicaRecuperacao", "Contra o réu = Proibido; A favor do réu = Permitido."
                ));
                break;

            case TI_EXATAS:
                cards.add(Map.of(
                        "id", "fc_" + UUID.randomUUID().toString().substring(0, 8),
                        "frente", String.format("[%s • %s] Qual é a diferença essencial de modelagem ou comando exigida em prova?", disciplina, topico),
                        "verso", "Distinção estrita entre os operadores de agregação e cláusulas de restrição de integridade referencial.",
                        "tipo", "BASIC",
                        "referenciaOrigem", ref + " • Edital Verticalizado",
                        "dicaRecuperacao", "A banca costuma trocar operadores lógicos ou restrições."
                ));
                break;

            default:
                // Se não houver regra de decoreba especializada, não gera cartão genérico artificial
                break;
        }

        return cards;
    }

    private List<Map<String, Object>> buildExamTraps(KnowledgeDomain domain, String disciplina, String topico, String banca) {
        List<Map<String, Object>> traps = new ArrayList<>();

        switch (domain) {
            case CONTABILIDADE:
                traps.add(Map.of(
                        "padrao", String.format("Pegadinha Clássica da %s na DFC: Juros e Dividendos", banca),
                        "descricao", "A banca tenta induzir o aluno a classificar dividendos pagos e juros sobre capital próprio no fluxo incorreto da DFC.",
                        "comoBancaCobra", "Enunciado diz que dividendos pagos a acionistas compõem obrigatoriamente o Fluxo Operacional.",
                        "exemploQuestao", "No CPC 03, dividendos pagos são incentivados como Fluxo de Financiamento (embora admitido operacional se justificado em nota). A banca considera Financiamento como regra geral predominante.",
                        "pegadinhaAlerta", "🔴 Pegadinha: Dividendos pagos = Fluxo de Financiamento!"
                ));
                traps.add(Map.of(
                        "padrao", "Confusão entre Despesa Antecipada e Despesa do Exercício",
                        "descricao", "Afirmar que a contratação e pagamento de apólice de seguro anual à vista vira despesa imediata na DRE.",
                        "comoBancaCobra", "A banca cobra o lançamento contábil: débito no ativo circulante (Despesas Pagas Antecipadamente) e crédito em caixa/bancos.",
                        "exemploQuestao", "Pelo regime de competência, a despesa só é apropriada para a DRE mensalmente conforme o transcurso do tempo da cobertura.",
                        "pegadinhaAlerta", "🔴 Pegadinha: Pagamento antecipado é ATIVO, não despesa imediata!"
                ));
                break;

            case DIREITO_TRIBUTARIO:
                traps.add(Map.of(
                        "padrao", "Confusão entre Imunidade Tributária e Isenção de Taxas",
                        "descricao", "A banca afirma que uma entidade imune (como um templo ou autarquia) não precisa pagar nenhuma espécie tributária.",
                        "comoBancaCobra", "Afirmação de que o templo religioso está dispensado de taxa de coleta de lixo ou iluminação pública.",
                        "exemploQuestao", "A imunidade do art. 150, VI, 'b' refere-se ESTRITAMENTE a IMPOSTOS. Taxas de polícia ou de serviço divisível são devidas normalmente.",
                        "pegadinhaAlerta", "🔴 Pegadinha Clássica: Entidade imune a impostos PAGA taxas normalmente!"
                ));
                traps.add(Map.of(
                        "padrao", "Extensão Indevida da Imunidade do Papel de Imprensa",
                        "descricao", "A banca inclui maquinário gráfico, tintas especiais ou serviços de encadernação na imunidade do livro.",
                        "comoBancaCobra", "Alternativa diz que equipamentos gráficos importados são imunes por estarem destinados à impressão de livros.",
                        "exemploQuestao", "O STF consolidou que a imunidade da alínea 'd' alcança apenas o papel e materiais que se assimilam a ele, não alcançando peças ou maquinário gráfico.",
                        "pegadinhaAlerta", "🔴 Pegadinha: Máquinas de impressão e tintas gráficas NÃO são imunes."
                ));
                break;

            case DIREITO_PENAL:
                traps.add(Map.of(
                        "padrao", "Confusão entre Coação Física Irresistível e Coação Moral Irresistível",
                        "descricao", "A banca afirma que a coação moral irresistível exclui a tipicidade da conduta.",
                        "comoBancaCobra", "Coloca a coação moral irresistível como causa de exclusão da tipicidade ou ilicitude.",
                        "exemploQuestao", "A coação física (vis absoluta) exclui a própria conduta (fato típico). A coação moral (vis compulsiva) exclui a culpabilidade (inexigibilidade de conduta diversa).",
                        "pegadinhaAlerta", "🔴 Cuidado: Coação moral exclui CULPABILIDADE; Coação física exclui FATO TÍPICO!"
                ));
                break;

            default:
                traps.add(Map.of(
                        "padrao", String.format("Generalização Abusiva da Banca %s", banca),
                        "descricao", "Uso de termos taxativos como 'sempre', 'em qualquer hipótese', 'sem exceções' para falsear a assertiva.",
                        "comoBancaCobra", "Transcreve a literalidade da regra geral, mas extirpa as ressalvas legais expressas.",
                        "exemploQuestao", "A regra geral é válida, porém existem hipóteses taxativas de exceção previstas em lei.",
                        "pegadinhaAlerta", "🔴 Alerta Vermelho: Desconfie de 'sempre', 'nunca' e 'exclusivamente'."
                ));
                break;
        }

        return traps;
    }

    private String buildRetaFinalSummary(KnowledgeDomain domain, String disciplina, String topico, String banca) {
        switch (domain) {
            case CONTABILIDADE:
                return String.format("""
                    ### ⚡ Memorização Rápida de Véspera (Reta Final de Contabilidade)
                    
                    * **Mecânica Básica:** Débito aumenta Ativo e Despesa; Crédito aumenta Passivo, PL e Receita.
                    * **DFC (CPC 03):** 
                      - Venda à vista de imobilizado = **Fluxo de Investimento**.
                      - Empréstimos tomados e dividendos pagos = **Fluxo de Financiamento**.
                      - Depreciação no método indireto = **Soma de volta ao Lucro Líquido**.
                    * **CPC 25 (Provisões):** Provável = Balanço + Nota • Possível = Apenas Nota • Remoto = Nada faz.
                    * **Despesas Antecipadas:** Ficam no Ativo Circulante até a sua competência efetiva.
                    * **Duplicatas Descontadas:** Conta retificadora do Ativo Circulante (ou Passivo Financeiro conforme transferência substancial de riscos do CPC 48).
                    * **Atenção Banca %s:** As duas modalidades de DFC geram exatamente o mesmo valor final no Fluxo Operacional.
                    """, banca);

            case DIREITO_TRIBUTARIO:
                return """
                    ### ⚡ Memorização Rápida de Véspera (Reta Final de Tributário)
                    
                    * **Imunidade:** Na CF/88 • Incompetência • Só alcança IMPOSTOS • Irrevogável por lei ordinária.
                    * **Isenção:** No CTN / Lei • Exclusão do crédito tributário • Revogável a qualquer tempo (salvo prazo certo com encargos - Súmula 544 STF).
                    * **Imunidade Recíproca:** Não beneficia estatais concorrenciais (Petrobras/BB). Beneficia estatais em monopólio estrito de serviço público (Correios/INFRAERO).
                    * **Promitente Comprador:** Paga IPTU mesmo se o imóvel for da União (Súmula 583 STF).
                    * **Livros & E-Books:** Súmula Vinculante 57 (livros digitais e e-readers dedicados são imunes; maquinário e tablets genéricos NÃO são imunes).
                    * **Terceiro Setor:** Art. 14 do CTN (não distribuir lucros, aplicar tudo no país, contabilidade regular).
                    """;

            case DIREITO_PENAL:
                return """
                    ### ⚡ Memorização Rápida de Véspera (Reta Final de Penal)
                    
                    * **Legalidade Estrita:** Anterioridade + Taxatividade (proibida analogia in malam partem).
                    * **Teoria do Crime:** Fato Típico + Ilicitude + Culpabilidade.
                    * **Excludentes de Ilicitude (art. 23):** Estado de necessidade, legítima defesa, estrito cumprimento de dever legal, exercício regular de direito.
                    * **Excludentes de Culpabilidade:** Inimputabilidade (menoridade, doença mental), erro de proibição inevitável, coação moral irresistível, obediência hierárquica.
                    * **Tentativa:** Conatus punível com a pena do crime consumado diminuída de 1 a 2 terços.
                    """;

            default:
                return String.format("""
                    ### ⚡ Memorização Rápida de Véspera (Reta Final)
                    
                    * **Tópico Chave:** %s na disciplina %s.
                    * **Regra Geral:** Aplicação estrita dos requisitos normativos e formais da matéria.
                    * **Padrão da Banca %s:** Atenção à distinção entre a regra geral e as exceções taxativas.
                    * **Critério de Eliminação:** Desconfie de alternativas com generalizações abusivas ('sempre', 'nunca').
                    """, topico, disciplina, banca);
        }
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
            req1.put("banca", "FGV");
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
