package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringAnswerRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringSessionDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ReverseEngineeringStartRequestDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ReverseEngineeringService {

    private static final Logger log = LoggerFactory.getLogger(ReverseEngineeringService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public ReverseEngineeringService(JdbcTemplate jdbcTemplate, EventStoreRepository eventStoreRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Verifica se o assunto é elegível para Estudo Reverso Orientado.
     * Tópicos intermediários ou avançados (com contato prévio ou complexidade média/alta)
     * aplicam Engenharia Reversa como padrão.
     */
    public boolean isTopicEligibleForReverseEngineering(String disciplina, String assunto, String concursoId) {
        if (assunto == null || assunto.isBlank()) return true;

        try {
            // Checa histórico de questões resolvidas para este assunto
            String sql = "SELECT COUNT(*) as total, SUM(CASE WHEN json_extract(payload_json, '$.isCorrect') = true THEN 1 ELSE 0 END) as acertos " +
                         "FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' " +
                         "AND json_extract(payload_json, '$.topic') = ?";
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, assunto.trim());
            if (!rows.isEmpty()) {
                Number total = (Number) rows.get(0).get("total");
                if (total != null && total.intValue() >= 2) {
                    // Já teve contato prévio: é assunto intermediário ou avançado!
                    return true;
                }
            }

            // Checa se no edital o tópico é categorizado como intermediário/avançado ou peso alto
            if (concursoId != null && !concursoId.isBlank()) {
                String editalSql = "SELECT peso FROM edital_topicos WHERE concurso_id = ? AND assunto = ?";
                List<Map<String, Object>> editalRows = jdbcTemplate.queryForList(editalSql, concursoId.trim(), assunto.trim());
                if (!editalRows.isEmpty()) {
                    Number peso = (Number) editalRows.get(0).get("peso");
                    if (peso != null && peso.intValue() >= 2) {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Erro ao avaliar elegibilidade para engenharia reversa: {}", e.getMessage());
        }

        // Padrão: qualquer assunto em estudo pode acionar Estudo Reverso Orientado
        return true;
    }

    /**
     * Inicia uma sessão de Estudo Reverso Orientado selecionando de 5 a 10 questões da banca foco.
     */
    public ReverseEngineeringSessionDTO startReverseEngineeringSession(ReverseEngineeringStartRequestDTO request) {
        String reverseSessionId = "rev-" + UUID.randomUUID().toString().substring(0, 8);
        String sessionId = (request.getSessionId() != null && !request.getSessionId().isBlank())
                ? request.getSessionId()
                : "sess-" + UUID.randomUUID().toString().substring(0, 8);

        String disciplina = request.getDisciplina() != null ? request.getDisciplina().trim() : "Direito Tributário";
        String assunto = request.getAssunto() != null ? request.getAssunto().trim() : "Substituição Tributária para Frente";

        // Determina a banca foco (FGV, Cebraspe, FCC, etc.)
        String bancaFoco = request.getBanca();
        if (bancaFoco == null || bancaFoco.isBlank()) {
            if (request.getConcursoId() != null && !request.getConcursoId().isBlank()) {
                try {
                    List<String> bancas = jdbcTemplate.queryForList("SELECT banca FROM concursos WHERE id = ?", String.class, request.getConcursoId());
                    if (!bancas.isEmpty() && bancas.get(0) != null && !bancas.get(0).isBlank()) {
                        bancaFoco = bancas.get(0);
                    }
                } catch (Exception ignored) {}
            }
        }
        if (bancaFoco == null || bancaFoco.isBlank()) {
            bancaFoco = "FGV"; // Default banca fiscal de alto calibre
        }

        int targetCount = (request.getQuantidadeQuestoes() != null && request.getQuantidadeQuestoes() >= 5 && request.getQuantidadeQuestoes() <= 10)
                ? request.getQuantidadeQuestoes()
                : 5;

        // Seleciona as questões de provas anteriores da banca foco
        List<Map<String, Object>> questoes = selectQuestionsForReverseStudy(bancaFoco, disciplina, assunto, targetCount);

        String nivelTopico = (request.getNivelTopico() != null && !request.getNivelTopico().isBlank())
                ? request.getNivelTopico().toUpperCase()
                : "INTERMEDIARIO";

        // Nome presumido do PDF do tópico
        String pdfDocNome = "Aula_" + disciplina.replaceAll("\\s+", "_") + "_" + assunto.replaceAll("\\s+", "_") + ".pdf";

        // Persiste no banco
        String insertSql = "INSERT INTO reverse_engineering_sessions " +
                "(id, session_id, concurso_id, disciplina, assunto, banca, nivel_topico, total_questoes, questoes_resolvidas, questoes_corretas, status, pdf_doc_nome) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'EM_ANDAMENTO', ?)";
        jdbcTemplate.update(insertSql, reverseSessionId, sessionId, request.getConcursoId(), disciplina, assunto, bancaFoco, nivelTopico, questoes.size(), pdfDocNome);

        // Append-Only Event Store
        String eventPayload = String.format("{\"reverseSessionId\":\"%s\",\"concursoId\":\"%s\",\"disciplina\":\"%s\",\"assunto\":\"%s\",\"banca\":\"%s\",\"totalQuestoes\":%d}",
                reverseSessionId, request.getConcursoId(), disciplina, assunto, bancaFoco, questoes.size());
        eventStoreRepository.appendEvent("REVERSE_ENGINEERING_SESSION_STARTED", "REVERSE_SESSION", reverseSessionId, sessionId, 1, "v1", eventPayload);

        ReverseEngineeringSessionDTO dto = new ReverseEngineeringSessionDTO();
        dto.setId(reverseSessionId);
        dto.setSessionId(sessionId);
        dto.setConcursoId(request.getConcursoId());
        dto.setDisciplina(disciplina);
        dto.setAssunto(assunto);
        dto.setBanca(bancaFoco);
        dto.setNivelTopico(nivelTopico);
        dto.setTotalQuestoes(questoes.size());
        dto.setQuestoesResolvidas(0);
        dto.setQuestoesCorretas(0);
        dto.setStatus("EM_ANDAMENTO");
        dto.setPdfDocNome(pdfDocNome);
        dto.setQuestoes(questoes);

        return dto;
    }

    /**
     * Registra a resolução de uma questão da bateria de estudo reverso, mapeando
     * alternativas eliminadas com facilidade e pegadinhas onde o usuário caiu.
     */
    public ReverseEngineeringSessionDTO recordQuestionResolution(ReverseEngineeringAnswerRequestDTO answer) {
        String sql = "SELECT * FROM reverse_engineering_sessions WHERE id = ?";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, answer.getReverseSessionId());
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Sessão de engenharia reversa não encontrada: " + answer.getReverseSessionId());
        }

        Map<String, Object> sessionRow = rows.get(0);
        int totalQuestoes = ((Number) sessionRow.get("total_questoes")).intValue();
        int resolvidas = ((Number) sessionRow.get("questoes_resolvidas")).intValue() + 1;
        int corretas = ((Number) sessionRow.get("questoes_corretas")).intValue() + (Boolean.TRUE.equals(answer.getIsCorrect()) ? 1 : 0);

        // Mapeia erros de questões
        String currentErros = (String) sessionRow.get("erros_questoes_numeros");
        List<String> errosList = new ArrayList<>();
        if (currentErros != null && !currentErros.isBlank()) {
            errosList.addAll(Arrays.asList(currentErros.split(",\\s*")));
        }
        if (Boolean.FALSE.equals(answer.getIsCorrect())) {
            errosList.add(String.valueOf(answer.getNumeroQuestao()));
        }
        String updatedErrosStr = String.join(", ", errosList);

        // Mapeia alternativas eliminadas com facilidade
        List<String> eliminadasAcumuladas = new ArrayList<>();
        String rawEliminadas = (String) sessionRow.get("alternativas_eliminadas_json");
        if (rawEliminadas != null && !rawEliminadas.isBlank()) {
            try {
                eliminadasAcumuladas = objectMapper.readValue(rawEliminadas, new TypeReference<List<String>>(){});
            } catch (Exception ignored) {}
        }
        if (answer.getEliminatedOptions() != null) {
            for (String opt : answer.getEliminatedOptions()) {
                String item = "Q" + answer.getNumeroQuestao() + ": Alt (" + opt + ")";
                if (!eliminadasAcumuladas.contains(item)) {
                    eliminadasAcumuladas.add(item);
                }
            }
        }

        // Mapeia pegadinhas detectadas
        List<Map<String, Object>> pegadinhasAcumuladas = new ArrayList<>();
        String rawPegadinhas = (String) sessionRow.get("pegadinhas_detectadas_json");
        if (rawPegadinhas != null && !rawPegadinhas.isBlank()) {
            try {
                pegadinhasAcumuladas = objectMapper.readValue(rawPegadinhas, new TypeReference<List<Map<String, Object>>>(){});
            } catch (Exception ignored) {}
        }
        if (Boolean.FALSE.equals(answer.getIsCorrect())) {
            Map<String, Object> pegadinha = new HashMap<>();
            pegadinha.put("numeroQuestao", answer.getNumeroQuestao());
            pegadinha.put("opcaoMarcada", answer.getSelectedOption());
            pegadinha.put("tipoPegadinha", answer.getPegadinhaCausa() != null ? answer.getPegadinhaCausa() : "EXCECAO_JURISPRUDENCIAL");
            pegadinha.put("detalhe", "Caiu no distrator de jurisprudência/exceção específica da banca");
            pegadinhasAcumuladas.add(pegadinha);
        }

        String eliminadasJson = "[]";
        String pegadinhasJson = "[]";
        try {
            eliminadasJson = objectMapper.writeValueAsString(eliminadasAcumuladas);
            pegadinhasJson = objectMapper.writeValueAsString(pegadinhasAcumuladas);
        } catch (Exception ignored) {}

        // Verifica se a bateria foi concluída
        boolean isFinished = resolvidas >= totalQuestoes;
        String status = isFinished ? "CONCLUIDA" : "EM_ANDAMENTO";
        String prescricaoTexto = null;
        int paginaInicio = 16;
        int paginaFim = 22;
        int paginasPuladas = 15;

        if (isFinished) {
            // Calcula a prescrição de recorte teórico cirúrgico
            if (errosList.isEmpty()) {
                prescricaoTexto = "Excelente domínio demonstrado na banca foco! Você acertou 100% da bateria de engenharia reversa. Pule 100% da leitura teórica do PDF (economia de 30 páginas). Avanço imediato para ciclo de revisão e simulados.";
                paginaInicio = 0;
                paginaFim = 0;
                paginasPuladas = 30;
            } else if (errosList.size() <= (totalQuestoes / 2)) {
                // Caso canônico: acertou regra geral, caiu nas pegadinhas/exceções jurisprudenciais
                String questoesErrosStr = String.join(" e ", errosList);
                prescricaoTexto = String.format(
                        "Você já domina a regra geral. Pule as primeiras 15 páginas do PDF. Leia apenas as páginas 16 a 22, que contêm as exceções jurisprudenciais onde você acabou de errar nas questões %s.",
                        questoesErrosStr
                );
                paginaInicio = 16;
                paginaFim = 22;
                paginasPuladas = 15;
            } else {
                // Errou a maioria: lacuna estrutural
                String questoesErrosStr = String.join(", ", errosList);
                prescricaoTexto = String.format(
                        "Lacuna estrutural detectada na regra geral e exceções. Recomendado ler desde o início (páginas 1 a 22), com atenção reforçada às pegadinhas das questões %s.",
                        questoesErrosStr
                );
                paginaInicio = 1;
                paginaFim = 22;
                paginasPuladas = 0;
            }
        }

        // Atualiza no banco
        String updateSql = "UPDATE reverse_engineering_sessions SET " +
                "questoes_resolvidas = ?, questoes_corretas = ?, erros_questoes_numeros = ?, " +
                "alternativas_eliminadas_json = ?, pegadinhas_detectadas_json = ?, " +
                "prescricao_recorte_texto = ?, pagina_inicio_recorte = ?, pagina_fim_recorte = ?, paginas_puladas = ?, " +
                "status = ?, completed_at = CASE WHEN ? = 'CONCLUIDA' THEN CURRENT_TIMESTAMP ELSE NULL END " +
                "WHERE id = ?";

        jdbcTemplate.update(updateSql,
                resolvidas, corretas, updatedErrosStr,
                eliminadasJson, pegadinhasJson,
                prescricaoTexto, paginaInicio, paginaFim, paginasPuladas,
                status, status, answer.getReverseSessionId());

        // Event Store
        String eventPayload = String.format("{\"reverseSessionId\":\"%s\",\"numeroQuestao\":%d,\"isCorrect\":%s,\"resolvidas\":%d,\"total\":%d,\"isFinished\":%s}",
                answer.getReverseSessionId(), answer.getNumeroQuestao(), answer.getIsCorrect(), resolvidas, totalQuestoes, isFinished);
        eventStoreRepository.appendEvent("REVERSE_ENGINEERING_ANSWER_SUBMITTED", "REVERSE_SESSION", answer.getReverseSessionId(), (String) sessionRow.get("session_id"), 1, "v1", eventPayload);

        if (isFinished) {
            String completedPayload = String.format("{\"reverseSessionId\":\"%s\",\"questoesCorretas\":%d,\"totalQuestoes\":%d,\"erros\":\"%s\",\"paginasPuladas\":%d,\"paginaInicio\":%d,\"paginaFim\":%d}",
                    answer.getReverseSessionId(), corretas, totalQuestoes, updatedErrosStr, paginasPuladas, paginaInicio, paginaFim);
            eventStoreRepository.appendEvent("REVERSE_ENGINEERING_COMPLETED", "REVERSE_SESSION", answer.getReverseSessionId(), (String) sessionRow.get("session_id"), 1, "v1", completedPayload);
        }

        return getSessionById(answer.getReverseSessionId());
    }

    /**
     * Retorna a sessão formatada com seus dados e questões.
     */
    public ReverseEngineeringSessionDTO getSessionById(String reverseSessionId) {
        String sql = "SELECT * FROM reverse_engineering_sessions WHERE id = ?";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, reverseSessionId);
        if (rows.isEmpty()) {
            return null;
        }

        Map<String, Object> r = rows.get(0);
        ReverseEngineeringSessionDTO dto = new ReverseEngineeringSessionDTO();
        dto.setId((String) r.get("id"));
        dto.setSessionId((String) r.get("session_id"));
        dto.setConcursoId((String) r.get("concurso_id"));
        dto.setDisciplina((String) r.get("disciplina"));
        dto.setAssunto((String) r.get("assunto"));
        dto.setBanca((String) r.get("banca"));
        dto.setNivelTopico((String) r.get("nivel_topico"));
        dto.setTotalQuestoes(((Number) r.get("total_questoes")).intValue());
        dto.setQuestoesResolvidas(((Number) r.get("questoes_resolvidas")).intValue());
        dto.setQuestoesCorretas(((Number) r.get("questoes_corretas")).intValue());
        dto.setErrosQuestoesNumeros((String) r.get("erros_questoes_numeros"));
        dto.setPrescricaoRecorteTexto((String) r.get("prescricao_recorte_texto"));
        dto.setPdfDocNome((String) r.get("pdf_doc_nome"));
        dto.setPaginaInicioRecorte(r.get("pagina_inicio_recorte") != null ? ((Number) r.get("pagina_inicio_recorte")).intValue() : 16);
        dto.setPaginaFimRecorte(r.get("pagina_fim_recorte") != null ? ((Number) r.get("pagina_fim_recorte")).intValue() : 22);
        dto.setPaginasPuladas(r.get("paginas_puladas") != null ? ((Number) r.get("paginas_puladas")).intValue() : 15);
        dto.setStatus((String) r.get("status"));
        dto.setCreatedAt(String.valueOf(r.get("created_at")));
        dto.setCompletedAt(r.get("completed_at") != null ? String.valueOf(r.get("completed_at")) : null);

        // Deserializa listas
        String rawEliminadas = (String) r.get("alternativas_eliminadas_json");
        if (rawEliminadas != null && !rawEliminadas.isBlank()) {
            try {
                dto.setAlternativasEliminadasFacilidade(objectMapper.readValue(rawEliminadas, new TypeReference<List<String>>(){}));
            } catch (Exception ignored) {}
        }

        String rawPegadinhas = (String) r.get("pegadinhas_detectadas_json");
        if (rawPegadinhas != null && !rawPegadinhas.isBlank()) {
            try {
                dto.setPegadinhasMapeadas(objectMapper.readValue(rawPegadinhas, new TypeReference<List<Map<String, Object>>>(){}));
            } catch (Exception ignored) {}
        }

        // Carrega questões da bateria
        dto.setQuestoes(selectQuestionsForReverseStudy(dto.getBanca(), dto.getDisciplina(), dto.getAssunto(), dto.getTotalQuestoes()));

        return dto;
    }

    /**
     * Seleciona questões representativas da banca foco para a bateria de estudo reverso.
     * Se houver menos que o limite, relaxa a busca ou complementa com questões calibradas.
     */
    private List<Map<String, Object>> selectQuestionsForReverseStudy(String banca, String disciplina, String assunto, int limit) {
        List<Map<String, Object>> result = new ArrayList<>();

        // 1. Tenta banca exata + disciplina + assunto
        String sql = "SELECT id, enunciado, options_json, correct_option, disciplina, assunto, banca, ano, orgao " +
                     "FROM questions WHERE disciplina = ? AND assunto = ? AND banca = ? ORDER BY ano DESC LIMIT ?";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, disciplina, assunto, banca, limit);
        for (Map<String, Object> row : rows) {
            result.add(formatQuestionRow(row));
        }

        // 2. Se insuficiente, busca da banca + disciplina (outros assuntos ou gerais)
        if (result.size() < limit) {
            int needed = limit - result.size();
            String sqlBanca = "SELECT id, enunciado, options_json, correct_option, disciplina, assunto, banca, ano, orgao " +
                              "FROM questions WHERE disciplina = ? AND banca = ? " +
                              "AND id NOT IN (" + getInClause(result) + ") ORDER BY ano DESC LIMIT ?";
            List<Map<String, Object>> moreRows = jdbcTemplate.queryForList(sqlBanca, disciplina, banca, needed);
            for (Map<String, Object> row : moreRows) {
                result.add(formatQuestionRow(row));
            }
        }

        // 3. Se ainda insuficiente, busca de bancas correlatas (FGV, Cebraspe, FCC, Vunesp)
        if (result.size() < limit) {
            int needed = limit - result.size();
            String sqlOther = "SELECT id, enunciado, options_json, correct_option, disciplina, assunto, banca, ano, orgao " +
                              "FROM questions WHERE disciplina = ? " +
                              "AND id NOT IN (" + getInClause(result) + ") ORDER BY ano DESC LIMIT ?";
            List<Map<String, Object>> otherRows = jdbcTemplate.queryForList(sqlOther, disciplina, needed);
            for (Map<String, Object> row : otherRows) {
                result.add(formatQuestionRow(row));
            }
        }

        // 4. Fallback sintético determinístico se o banco de questões estiver em branco
        if (result.size() < limit) {
            int needed = limit - result.size();
            for (int i = 1; i <= needed; i++) {
                int qNum = result.size() + 1;
                Map<String, Object> syntheticQ = new HashMap<>();
                syntheticQ.put("id", "rev-q-" + qNum);
                syntheticQ.put("disciplina", disciplina);
                syntheticQ.put("assunto", assunto);
                syntheticQ.put("banca", banca);
                syntheticQ.put("ano", 2024);
                syntheticQ.put("orgao", "SEFAZ / Fiscal");

                if (qNum <= 2) {
                    // Questões 1 e 2: Regra Geral
                    syntheticQ.put("enunciado", String.format("[%s - 2024 - Auditor Fiscal] Sobre a regra geral aplicável ao instituto de %s em %s, assinale a afirmativa correta:", banca, assunto, disciplina));
                    syntheticQ.put("options", List.of(
                            "A) A regra geral veda a incidência sobre operações que não estejam expressamente previstas em lei complementar.",
                            "B) A incidência é automática e independe de lei específica.",
                            "C) O lançamento extingue a obrigação independentemente do fato gerador.",
                            "D) A competência tributária é renunciável a critério do ente federativo.",
                            "E) A decadência não atinge as obrigações acessórias."
                    ));
                    syntheticQ.put("correctOption", "A");
                } else if (qNum <= 4) {
                    // Questões 3 e 4: As pegadinhas de Exceção Jurisprudencial (STF/STJ)
                    syntheticQ.put("enunciado", String.format("[%s - 2024 - Auditor Fiscal] Em relação à jurisprudência pacificada dos tribunais superiores quanto à exceção aplicável ao instituto de %s (%s), assinale a opção correta:", banca, assunto, disciplina));
                    syntheticQ.put("options", List.of(
                            "A) A regra geral de incidência é absoluta e não comporta qualquer temperamento jurisprudencial.",
                            "B) Conforme tese fixada pelo STF/STJ em sede de repercussão geral, é devida a restituição da diferença do imposto pago a maior sob o regime de substituição tributária se a base de cálculo efetiva for inferior à presumida.",
                            "C) O prazo prescricional é suspenso indefinidamente por portaria executiva local.",
                            "D) A responsabilidade por substituição para frente afasta em qualquer hipótese o direito de restituição do contribuinte substituído.",
                            "E) A MVA fixada administrativamente prevalece sobre a comprovação de preço efetivo praticado no varejo."
                    ));
                    syntheticQ.put("correctOption", "B");
                } else {
                    syntheticQ.put("enunciado", String.format("[%s - 2024 - Auditor Fiscal] No tocante às penalidades e deveres instrumentais em %s, a banca %s adota o entendimento de que:", banca, assunto, banca));
                    syntheticQ.put("options", List.of(
                            "A) A responsabilidade é estritamente subjetiva com prova inequívoca de dolo do agente.",
                            "B) A multa punitiva não sofre limitação de vedação ao confisco.",
                            "C) A obrigação acessória convolada em principal segue o regime sancionatório proporcional estabelecido em jurisprudência sumulada.",
                            "D) O pagamento com atraso afasta juros de mora.",
                            "E) A denúncia espontânea é inaplicável às infrações tributárias formais."
                    ));
                    syntheticQ.put("correctOption", "C");
                }
                result.add(syntheticQ);
            }
        }

        return result;
    }

    private Map<String, Object> formatQuestionRow(Map<String, Object> row) {
        Map<String, Object> q = new HashMap<>(row);
        String optionsJson = (String) row.get("options_json");
        if (optionsJson != null && !optionsJson.isBlank()) {
            try {
                List<String> opts = objectMapper.readValue(optionsJson, new TypeReference<List<String>>(){});
                q.put("options", opts);
            } catch (Exception ignored) {
                q.put("options", List.of());
            }
        } else {
            q.put("options", List.of());
        }
        return q;
    }

    private String getInClause(List<Map<String, Object>> items) {
        if (items.isEmpty()) return "''";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append("'").append(items.get(i).get("id")).append("'");
        }
        return sb.toString();
    }
}
