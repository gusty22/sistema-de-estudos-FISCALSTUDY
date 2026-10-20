package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class RevisionCalendarService {

    private static final Logger log = LoggerFactory.getLogger(RevisionCalendarService.class);
    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;

    public RevisionCalendarService(JdbcTemplate jdbcTemplate, EventStoreRepository eventStoreRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
    }

    @PostConstruct
    public void initSchemaMigrations() {
        try {
            jdbcTemplate.execute("ALTER TABLE revision_calendar ADD COLUMN justificativa_pedagogica TEXT;");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE revision_calendar ADD COLUMN estagio_intervencao TEXT DEFAULT 'RECUPERACAO_ATIVA';");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE revision_calendar ADD COLUMN prioridade_score REAL DEFAULT 0.5;");
        } catch (Exception ignored) {}

        // Limpeza proativa de duplicatas legadas em aberto do mesmo tópico (mantém apenas o reforço mais próximo)
        try {
            jdbcTemplate.execute("""
                DELETE FROM revision_calendar
                WHERE status = 'PENDENTE'
                  AND id NOT IN (
                      SELECT id FROM (
                          SELECT id,
                                 ROW_NUMBER() OVER (
                                     PARTITION BY disciplina, topico
                                     ORDER BY data_agendada ASC, prioridade_score DESC
                                 ) as rn
                          FROM revision_calendar
                          WHERE status = 'PENDENTE'
                      ) WHERE rn = 1
                  );
            """);
        } catch (Exception ignored) {}
    }

    /**
     * Retorna a contagem exata e dinâmica de questões no caderno de erros por categoria taxonômica (E1 a E5)
     */
    public Map<String, Object> getErrorTaxonomyStats(String concursoId) {
        Map<String, Object> stats = new HashMap<>();
        Map<String, Integer> counts = new HashMap<>();
        counts.put("E1", 0);
        counts.put("E2", 0);
        counts.put("E3", 0);
        counts.put("E4", 0);
        counts.put("E5", 0);

        // Mapeamento dos códigos canônicos
        counts.put("NAO_SABIA_MATERIA", 0);
        counts.put("NAO_LEMBRAVA", 0);
        counts.put("CONFUSAO_CONCEITUAL", 0);
        counts.put("PEGADINHA_BANCA", 0);
        counts.put("DESATENCAO", 0);

        String sql = "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND (payload_json LIKE '%\"isCorrect\": false%' OR payload_json LIKE '%\"isCorrect\":false%')";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);

        int totalErrors = 0;
        for (Map<String, Object> row : rows) {
            String payload = (String) row.get("payload_json");
            if (payload == null) continue;
            totalErrors++;

            if (payload.contains("NAO_SABIA_MATERIA") || payload.contains("\"causaErro\":\"E1\"")) {
                counts.put("E1", counts.get("E1") + 1);
                counts.put("NAO_SABIA_MATERIA", counts.get("NAO_SABIA_MATERIA") + 1);
            } else if (payload.contains("NAO_LEMBRAVA") || payload.contains("\"causaErro\":\"E2\"")) {
                counts.put("E2", counts.get("E2") + 1);
                counts.put("NAO_LEMBRAVA", counts.get("NAO_LEMBRAVA") + 1);
            } else if (payload.contains("CONFUSAO_CONCEITUAL") || payload.contains("SABIA_MAS_CONFUNDI") || payload.contains("\"causaErro\":\"E3\"")) {
                counts.put("E3", counts.get("E3") + 1);
                counts.put("CONFUSAO_CONCEITUAL", counts.get("CONFUSAO_CONCEITUAL") + 1);
            } else if (payload.contains("PEGADINHA_BANCA") || payload.contains("EXCECAO_REGRA") || payload.contains("\"causaErro\":\"E4\"")) {
                counts.put("E4", counts.get("E4") + 1);
                counts.put("PEGADINHA_BANCA", counts.get("PEGADINHA_BANCA") + 1);
            } else if (payload.contains("DESATENCAO") || payload.contains("FALTA_ATENCAO") || payload.contains("\"causaErro\":\"E5\"")) {
                counts.put("E5", counts.get("E5") + 1);
                counts.put("DESATENCAO", counts.get("DESATENCAO") + 1);
            } else {
                // Erros sem classificação explícita são contabilizados em E1 (Lacuna teórica inicial)
                counts.put("E1", counts.get("E1") + 1);
                counts.put("NAO_SABIA_MATERIA", counts.get("NAO_SABIA_MATERIA") + 1);
            }
        }

        stats.put("counts", counts);
        stats.put("totalErrors", totalErrors);
        return stats;
    }

    /**
     * Agenda reforço adaptativo individualizado baseado em telemetria real (resultado, confiança, causa do erro, hesitação).
     */
    public void scheduleAdaptiveRevision(
            String sessionId,
            String concursoId,
            String disciplina,
            String topico,
            String origemEvento,
            String sourceId,
            Boolean isCorrect,
            Integer confidenceLevel,
            String causaErro,
            Boolean chuteEducado,
            String fluenciaNeurologica,
            Double friccaoCognitiva
    ) {
        if (disciplina == null || disciplina.isBlank() || topico == null || topico.isBlank()) {
            return;
        }

        LocalDate today = LocalDate.now();
        String estagio;
        String tipoRevisao;
        int intervaloDias;
        double prioridadeScore;
        String justificativa;

        boolean errou = Boolean.FALSE.equals(isCorrect);
        boolean chutou = Boolean.TRUE.equals(chuteEducado);
        int confianca = confidenceLevel != null ? confidenceLevel : 2;

        if (errou) {
            // Se errou com alta confiança (falsa fluência / erro cristalizado) ou causa E1/E2
            if (confianca >= 3 || (causaErro != null && (causaErro.contains("E1") || causaErro.contains("E2")))) {
                estagio = "INTERVENCAO_CORRETIVA";
                tipoRevisao = "D1_IMEDIATO";
                intervaloDias = 1;
                prioridadeScore = 0.95;
                justificativa = "Falsa fluência ou equívoco conceitual crítico detectado (" + (causaErro != null ? causaErro : "Incompreensão do conceito") + "). Intervenção corretiva prioritária recomendada para reconstruir a regra antes que o erro se cristalize na memória.";
            } else if (causaErro != null && (causaErro.contains("E3") || causaErro.contains("E4"))) {
                estagio = "TESTE_TRANSFERENCIA";
                tipoRevisao = "D1_IMEDIATO";
                intervaloDias = 1;
                prioridadeScore = 0.85;
                justificativa = "Dificuldade na regra, exceção ou pegadinha da banca (" + causaErro + "). Recomendado teste de transferência com formulação inédita da mesma matéria.";
            } else {
                estagio = "INTERVENCAO_CORRETIVA";
                tipoRevisao = "D1_IMEDIATO";
                intervaloDias = 1;
                prioridadeScore = 0.80;
                justificativa = "Erro observado na resolução. Revisão iminente do tópico para estancar a perda de retenção.";
            }
        } else if (chutou) {
            estagio = "RECUPERACAO_ATIVA";
            tipoRevisao = "D7_CONSOLIDACAO";
            intervaloDias = 2;
            prioridadeScore = 0.75;
            justificativa = "Acerto assinalado por chute/dúvida. A resposta foi correta, mas sem segurança; requer recuperação ativa sem pistas para comprovar retenção real.";
        } else {
            // Acerto legítimo
            if (friccaoCognitiva != null && friccaoCognitiva > 0.45) {
                estagio = "RECUPERACAO_ATIVA";
                tipoRevisao = "D7_CONSOLIDACAO";
                intervaloDias = 3;
                prioridadeScore = 0.60;
                justificativa = "Acerto com alta hesitação durante a deliberação. O conceito consumiu alto esforço cognitivo; reforço adaptativo recomendado para desenvolver fluência.";
            } else {
                estagio = "MANUTENCAO_PREVENTIVA";
                tipoRevisao = "D15_APROFUNDAMENTO";
                intervaloDias = 7;
                prioridadeScore = 0.35;
                justificativa = "Domínio fluente demonstrado com consistência. Reforço preventivo de longo prazo agendado para monitoramento de retenção.";
            }
        }

        LocalDate targetDate = today.plusDays(intervaloDias);
        String dateStr = targetDate.format(DateTimeFormatter.ISO_LOCAL_DATE);

        // Se já existe revisão PENDENTE deste mesmo tópico, atualiza justificativa e prioridade sem poluir com duplicatas
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                "SELECT id, prioridade_score FROM revision_calendar WHERE disciplina = ? AND topico = ? AND status = 'PENDENTE'",
                disciplina, topico
        );

        if (!existing.isEmpty()) {
            String existingId = (String) existing.get(0).get("id");
            jdbcTemplate.update(
                    "UPDATE revision_calendar SET data_agendada = ?, tipo_revisao = ?, intervalo_dias = ?, origem_evento = ?, " +
                            "justificativa_pedagogica = ?, estagio_intervencao = ?, prioridade_score = MAX(prioridade_score, ?) WHERE id = ?",
                    dateStr, tipoRevisao, intervaloDias, origemEvento, justificativa, estagio, prioridadeScore, existingId
            );
            log.info("Reforço adaptativo atualizado para {} • {} (Estágio: {}, Prioridade: {})", disciplina, topico, estagio, prioridadeScore);
            return;
        }

        String id = "rev-" + UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update(
                "INSERT INTO revision_calendar (id, session_id, concurso_id, disciplina, topico, tipo_revisao, intervalo_dias, data_agendada, origem_evento, source_id, status, justificativa_pedagogica, estagio_intervencao, prioridade_score) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?)",
                id, sessionId, concursoId, disciplina, topico, tipoRevisao, intervaloDias, dateStr, origemEvento, sourceId, justificativa, estagio, prioridadeScore
        );

        String payload = String.format(Locale.US,
                "{\"revisionId\":\"%s\",\"disciplina\":\"%s\",\"topico\":\"%s\",\"estagio\":\"%s\",\"prioridade\":%.2f,\"dataAgendada\":\"%s\"}",
                id, disciplina.replace("\"", "\\\""), topico.replace("\"", "\\\""), estagio, prioridadeScore, dateStr
        );

        eventStoreRepository.appendEvent(
                "ADAPTIVE_REVISION_SCHEDULED",
                "REVISION",
                id,
                sessionId != null ? sessionId : "system",
                1,
                "v2",
                payload
        );
        log.info("Reforço adaptativo agendado para {} • {} (Estágio: {}, Intervalo: {} dias)", disciplina, topico, estagio, intervaloDias);
    }

    /**
     * Sobrecarga de compatibilidade para chamadas genéricas
     */
    public void scheduleAutomaticRevision(String sessionId, String concursoId, String disciplina, String topico, String origemEvento, String sourceId) {
        boolean errou = "ERRO_QUESTAO".equals(origemEvento);
        boolean chutou = "CHUTE_EDUCADO".equals(origemEvento);
        scheduleAdaptiveRevision(
                sessionId, concursoId, disciplina, topico, origemEvento, sourceId,
                !errou, errou ? 3 : 2, null, chutou, "ANALITICO", 0.3
        );
    }

    /**
     * Retorna a agenda de revisões estruturada para o frontend com justificativa pedagógica e ordenação por prioridade
     */
    public Map<String, Object> getAgenda(String concursoId) {
        String todayStr = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);

        String baseSql = "SELECT id, session_id, concurso_id, disciplina, topico, tipo_revisao, intervalo_dias, data_agendada, origem_evento, status, taxa_acerto_revisao, created_at, concluida_em, justificativa_pedagogica, estagio_intervencao, prioridade_score FROM revision_calendar ";

        // 1. Revisões de Hoje ou Atrasadas (ordenadas pela maior prioridade/urgência cognitiva)
        List<Map<String, Object>> hojeRaw = jdbcTemplate.queryForList(
                baseSql + "WHERE status = 'PENDENTE' AND data_agendada <= ? ORDER BY prioridade_score DESC, data_agendada ASC",
                todayStr
        );

        // 2. Próximos reforços na fila dinâmica
        List<Map<String, Object>> proximosRaw = jdbcTemplate.queryForList(
                baseSql + "WHERE status = 'PENDENTE' AND data_agendada > ? ORDER BY prioridade_score DESC, data_agendada ASC LIMIT 25",
                todayStr
        );

        // 3. Revisões Concluídas Recentes
        List<Map<String, Object>> concluidasRaw = jdbcTemplate.queryForList(
                baseSql + "WHERE status = 'CONCLUIDA' ORDER BY concluida_em DESC LIMIT 20"
        );

        List<Map<String, Object>> hojeEnriched = hojeRaw.stream().map(this::enrichRevisionItem).toList();
        List<Map<String, Object>> proximosEnriched = proximosRaw.stream().map(this::enrichRevisionItem).toList();
        List<Map<String, Object>> concluidasEnriched = concluidasRaw.stream().map(this::enrichRevisionItem).toList();

        // Conjunto de tópicos já agendados para hoje ou pendentes (garantia adaptativa: 1 único reforço ativo por tópico)
        Set<String> activeTopics = new HashSet<>();

        // Separação em Prioritárias e Programadas (T24)
        List<Map<String, Object>> prioritarias = new ArrayList<>();
        List<Map<String, Object>> programadas = new ArrayList<>();

        for (Map<String, Object> item : hojeEnriched) {
            String key = (item.get("disciplina") + "::" + item.get("topico")).toLowerCase().trim();
            if (activeTopics.contains(key)) continue; // evita duplicata do mesmo tópico hoje
            activeTopics.add(key);

            Number score = (Number) item.get("prioridade_score");
            String tipo = (String) item.get("tipo_revisao");
            if ((score != null && score.doubleValue() >= 0.70) || "CORRECAO".equals(tipo) || Boolean.TRUE.equals(item.get("is_atrasada"))) {
                prioritarias.add(item);
            } else {
                programadas.add(item);
            }
        }

        // Para os próximos reforços futuros: incluir apenas se o tópico ainda não estiver pendente hoje
        // e deduplicar múltiplos agendamentos futuros do mesmo tópico (mantendo o mais próximo)
        List<Map<String, Object>> deduplicatedProximos = new ArrayList<>();
        for (Map<String, Object> item : proximosEnriched) {
            String key = (item.get("disciplina") + "::" + item.get("topico")).toLowerCase().trim();
            if (activeTopics.contains(key)) continue;
            activeTopics.add(key);
            deduplicatedProximos.add(item);
            programadas.add(item);
        }

        // Governança de Acúmulo de Revisões (anti-bola-de-neve)
        boolean excesso = hojeEnriched.size() > 5;
        int limiteRecomendado = Math.min(5, Math.max(3, hojeEnriched.size()));

        Map<String, Object> response = new HashMap<>();
        response.put("todayDate", todayStr);
        response.put("hoje", hojeEnriched);
        response.put("prioritarias", prioritarias);
        response.put("programadas", programadas);
        response.put("totalPendentesHoje", hojeEnriched.size());
        response.put("proximos7Dias", deduplicatedProximos);
        response.put("concluidas", concluidasEnriched);
        response.put("excessoPendencias", excesso);
        response.put("limiteRecomendadoHoje", limiteRecomendado);
        response.put("avisoRegraAtraso", "Uma revisão atrasada não significa automaticamente conhecimento perdido. O atraso aumenta a necessidade de verificação, mas não comprova esquecimento.");
        if (excesso) {
            response.put("recomendacaoSessaoDedicada", "Identificamos excesso de pendências acumuladas. Recomendamos uma sessão concentrada de revisões hoje para estabilizar sua retenção sem abrir novas frentes teóricas.");
        }

        return response;
    }

    private Map<String, Object> enrichRevisionItem(Map<String, Object> raw) {
        Map<String, Object> item = new HashMap<>(raw);
        String tipo = (String) item.get("tipo_revisao");
        String estagio = (String) item.get("estagio_intervencao");
        String dataAgendada = (String) item.get("data_agendada");
        String createdAt = (String) item.get("created_at");
        String todayStr = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);

        // Mapeamento dos 4 tipos canônicos de revisão (T24)
        String tipoCanonico;
        String tipoLabel;
        String tipoDesc;

        if (tipo != null && (tipo.contains("CORRECAO") || tipo.contains("D1"))) {
            tipoCanonico = "CORRECAO";
            tipoLabel = "Correção";
            tipoDesc = "Tratar erro ou concepção equivocada.";
        } else if (tipo != null && tipo.contains("RECUPERACAO")) {
            tipoCanonico = "RECUPERACAO";
            tipoLabel = "Recuperação";
            tipoDesc = "Verificar se consegue lembrar e aplicar.";
        } else if (tipo != null && (tipo.contains("CONSOLIDACAO") || tipo.contains("D7"))) {
            tipoCanonico = "CONSOLIDACAO";
            tipoLabel = "Consolidação";
            tipoDesc = "Praticar conceito ainda instável.";
        } else {
            tipoCanonico = "MANUTENCAO";
            tipoLabel = "Manutenção";
            tipoDesc = "Verificar conhecimento anteriormente demonstrado.";
        }

        item.put("tipo_revisao", tipoCanonico);
        item.put("tipo_revisao_label", tipoLabel);
        item.put("tipo_revisao_desc", tipoDesc);

        // Motivo
        String motivo = (String) item.get("justificativa_pedagogica");
        if (motivo == null || motivo.isBlank()) {
            motivo = tipoDesc;
        }
        item.put("motivo", motivo);

        // Última recuperação & Resultado anterior dinâmicos
        String resultadoAnt = "INTERVENCAO_CORRETIVA".equals(estagio) ? "Erro em questão recente"
                : ("TESTE_TRANSFERENCIA".equals(estagio) ? "Acerto hesitante / pegadinha"
                : ("RECUPERACAO_ATIVA".equals(estagio) ? "Acerto com dúvida" : "Domínio consolidado"));
        item.put("resultado_anterior", resultadoAnt);

        // Cálculo dinâmico do tempo desde o evento gerador
        String ultimaRec = "Há 1 dia";
        if (createdAt != null && createdAt.length() >= 10) {
            try {
                LocalDate createdDate = LocalDate.parse(createdAt.substring(0, 10));
                long days = java.time.temporal.ChronoUnit.DAYS.between(createdDate, LocalDate.now());
                if (days == 0) {
                    ultimaRec = "Hoje";
                } else if (days == 1) {
                    ultimaRec = "Ontem";
                } else if (days > 1) {
                    ultimaRec = "Há " + days + " dias";
                }
            } catch (Exception ignored) {}
        }
        item.put("ultima_recuperacao", ultimaRec);
        item.put("estimativa_duracao", "10 min");

        // Evidência calculada dinamicamente
        Number intervalo = (Number) item.get("intervalo_dias");
        int numInterv = intervalo != null ? intervalo.intValue() : 1;
        String evText = numInterv <= 2 ? "Reforço corretivo imediato • Taxa de retenção em monitoramento"
                : (numInterv <= 7 ? "Fase de consolidação • Curva de retenção ativa"
                : "Manutenção preventiva • Retenção estável comprovada");
        item.put("evidencia_disponivel", evText);

        boolean atrasada = dataAgendada != null && dataAgendada.compareTo(todayStr) < 0;
        item.put("is_atrasada", atrasada);

        return item;
    }

    /**
     * Adia uma revisão mantendo o histórico de auditoria intacto (T24).
     */
    public boolean postponeRevision(String revisionId, int dias, String motivo) {
        if (dias <= 0) dias = 1;
        int updated = jdbcTemplate.update(
                "UPDATE revision_calendar SET data_agendada = DATE(data_agendada, '+' || ? || ' days') WHERE id = ?",
                dias, revisionId
        );
        if (updated > 0) {
            String payload = String.format(Locale.US,
                    "{\"revisionId\":\"%s\",\"diasAdiados\":%d,\"motivo\":\"%s\"}",
                    revisionId, dias, motivo != null ? motivo.replace("\"", "\\\"") : "Adiado pelo estudante"
            );
            eventStoreRepository.appendEvent(
                    "REVISION_POSTPONED",
                    "REVISION",
                    revisionId,
                    "manual",
                    1,
                    "v2",
                    payload
            );
            log.info("Revisão {} adiada em {} dia(s). Motivo: {}", revisionId, dias, motivo);
            return true;
        }
        return false;
    }

    /**
     * Retorna o contexto estruturado para o fluxo de foco de execução de revisão (T25).
     */
    public Map<String, Object> getRevisionExecutionContext(String revisionId, String disciplinaParam, String topicoParam) {
        String disc = disciplinaParam;
        String top = topicoParam;
        String tipoRevisao = "RECUPERACAO";
        String motivo = "Produzir evidência de recuperação ativa sem pistas preliminares.";

        if (revisionId != null && !revisionId.isBlank()) {
            List<Map<String, Object>> rev = jdbcTemplate.queryForList(
                    "SELECT disciplina, topico, tipo_revisao, justificativa_pedagogica FROM revision_calendar WHERE id = ?",
                    revisionId
            );
            if (!rev.isEmpty()) {
                disc = (String) rev.get(0).get("disciplina");
                top = (String) rev.get(0).get("topico");
                tipoRevisao = (String) rev.get(0).get("tipo_revisao");
                motivo = (String) rev.get(0).get("justificativa_pedagogica");
            }
        }

        if (disc == null) disc = "Direito Tributário";
        if (top == null) top = "Suspensão do crédito tributário";

        // Busca questão associada real no SQLite
        List<Map<String, Object>> questions = jdbcTemplate.queryForList(
                "SELECT id, statement, commentary, support_text, board, year FROM questions " +
                        "WHERE discipline = ? AND (topic = ? OR topic LIKE ?) AND status = 'PUBLISHED' LIMIT 2",
                disc, top, "%" + top + "%"
        );

        Map<String, Object> primeiraQuestao = new HashMap<>();
        Map<String, Object> segundaQuestao = new HashMap<>();

        if (!questions.isEmpty()) {
            Map<String, Object> q1 = questions.get(0);
            primeiraQuestao.put("id", q1.get("id"));
            primeiraQuestao.put("statement", q1.get("statement"));
            primeiraQuestao.put("commentary", q1.get("commentary"));
            primeiraQuestao.put("board", q1.get("board"));
            primeiraQuestao.put("year", q1.get("year"));
            primeiraQuestao.put("supportText", q1.get("support_text"));

            if (questions.size() > 1) {
                Map<String, Object> q2 = questions.get(1);
                segundaQuestao.put("id", q2.get("id"));
                segundaQuestao.put("statement", q2.get("statement"));
                segundaQuestao.put("commentary", q2.get("commentary"));
                segundaQuestao.put("board", q2.get("board"));
                segundaQuestao.put("year", q2.get("year"));
            }
        } else {
            primeiraQuestao.put("id", "q-rev-1");
            primeiraQuestao.put("statement", "Em relação a " + top + " no âmbito de " + disc + ", avalie a regra geral e assinale a opção correta conforme a legislação e jurisprudência.");
            primeiraQuestao.put("commentary", "A matéria de " + top + " é informada pelo princípio da estrita legalidade, não comportando interpretação extensiva.");
            primeiraQuestao.put("board", "FGV");
            primeiraQuestao.put("year", 2024);
        }

        Map<String, Object> context = new HashMap<>();
        context.put("revisionId", revisionId);
        context.put("disciplina", disc);
        context.put("topico", top);
        context.put("tipoRevisao", tipoRevisao);
        context.put("objetivoPedagogico", "Produzir evidência de recuperação, não apenas exposição repetida.");
        context.put("motivo", motivo);
        context.put("retrievalPrompt", "Antes de ler o gabarito ou resumo, tente evocar mentalmente a regra principal de " + top + " e os pontos em que você costuma hesitar.");
        context.put("explicacaoCurta", "Síntese Conceitual: " + top + " (" + disc + "). Lembre-se: os requisitos legais são taxativos e as causas de exclusão/suspensão não se presumem.");
        context.put("exemploResolvido", "Caso Prático da Banca: A banca costuma apresentar uma situação hipotética tentando induzir o candidato a confundir os institutos congêneres de " + top + ". A distinção segura reside na verificação dos requisitos do texto legal.");
        context.put("primeiraQuestao", primeiraQuestao);
        if (!segundaQuestao.isEmpty()) {
            context.put("segundaQuestao", segundaQuestao);
        }

        return context;
    }

    /**
     * Registra o resultado de uma sessão de execução de recuperação (T25).
     */
    public Map<String, Object> recordRecoveryAttempt(
            String revisionId,
            boolean recuperouComSucesso,
            int nivelConfianca,
            String respostaEvocacao,
            boolean precisouExemplo,
            int tempoSegundos,
            String sessionId
    ) {
        double taxaAcerto = recuperouComSucesso ? (precisouExemplo ? 0.75 : 1.0) : 0.35;
        Map<String, Object> progression = completeRevisionWithDetails(revisionId, taxaAcerto, sessionId);

        String payload = String.format(Locale.US,
                "{\"revisionId\":\"%s\",\"recuperou\":%b,\"confianca\":%d,\"precisouExemplo\":%b,\"tempoSegundos\":%d}",
                revisionId, recuperouComSucesso, nivelConfianca, precisouExemplo, tempoSegundos
        );
        eventStoreRepository.appendEvent(
                "RECOVERY_ATTEMPT_RECORDED",
                "REVISION",
                revisionId,
                sessionId != null ? sessionId : "manual",
                1,
                "v2",
                payload
        );

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("recuperouComSucesso", recuperouComSucesso);
        result.put("taxaAcertoAtribuida", taxaAcerto);
        result.put("novoStatus", "CONCLUIDA");
        result.put("proximoIntervalo", progression.get("proximoIntervalo"));
        result.put("proximoEstagio", progression.get("proximoEstagio"));
        result.put("dataAgendada", progression.get("dataAgendada"));
        result.put("justificativaPedagogica", progression.get("justificativaPedagogica"));
        result.put("mensagem", recuperouComSucesso
                ? "Evidência de recuperação registrada com sucesso! Próximo ciclo espaçado agendado."
                : "Registro computado. Exemplo resolvido e reforço corretivo priorizado.");
        return result;
    }

    /**
     * Conclui uma revisão e calcula o próximo estágio adaptativo (avança intervalo se acertar, recua se falhar).
     */
    public boolean completeRevision(String revisionId, Double taxaAcerto, String sessionId) {
        Map<String, Object> res = completeRevisionWithDetails(revisionId, taxaAcerto, sessionId);
        return Boolean.TRUE.equals(res.get("success"));
    }

    /**
     * Conclui uma revisão e retorna os dados detalhados da progressão adaptativa calculada.
     */
    public Map<String, Object> completeRevisionWithDetails(String revisionId, Double taxaAcerto, String sessionId) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);

        double acerto = taxaAcerto != null ? taxaAcerto : 1.0;
        int updated = jdbcTemplate.update(
                "UPDATE revision_calendar SET status = 'CONCLUIDA', taxa_acerto_revisao = ?, concluida_em = CURRENT_TIMESTAMP WHERE id = ?",
                acerto, revisionId
        );

        if (updated > 0) {
            result.put("success", true);
            // Consulta dados da revisão concluída para calcular a progressão adaptativa
            List<Map<String, Object>> item = jdbcTemplate.queryForList(
                    "SELECT disciplina, topico, concurso_id, estagio_intervencao, intervalo_dias FROM revision_calendar WHERE id = ?",
                    revisionId
            );

            if (!item.isEmpty()) {
                String disc = (String) item.get(0).get("disciplina");
                String top = (String) item.get(0).get("topico");
                String concId = (String) item.get(0).get("concurso_id");
                String estagioAtual = (String) item.get(0).get("estagio_intervencao");
                Number intervNum = (Number) item.get(0).get("intervalo_dias");
                int intervAnterior = intervNum != null ? intervNum.intValue() : 1;

                // Se acertou a revisão (>= 80%), avança estágio e dilata o intervalo!
                if (acerto >= 0.8) {
                    String proximoEstagio;
                    int proximoIntervalo;
                    String proxJustificativa;
                    double proxPrioridade;

                    if ("INTERVENCAO_CORRETIVA".equals(estagioAtual)) {
                        proximoEstagio = "TESTE_TRANSFERENCIA";
                        proximoIntervalo = Math.max(3, intervAnterior * 2);
                        proxJustificativa = "Intervenção corretiva concluída com sucesso. Próximo passo: teste de transferência para validar aplicação em nova questão.";
                        proxPrioridade = 0.70;
                    } else if ("TESTE_TRANSFERENCIA".equals(estagioAtual)) {
                        proximoEstagio = "RECUPERACAO_ATIVA";
                        proximoIntervalo = Math.max(7, intervAnterior * 2);
                        proxJustificativa = "Transferência demonstrada. Próximo passo: recuperação ativa sem pistas para consolidação de médio prazo.";
                        proxPrioridade = 0.50;
                    } else {
                        proximoEstagio = "MANUTENCAO_PREVENTIVA";
                        proximoIntervalo = Math.max(14, intervAnterior * 2);
                        proxJustificativa = "Retenção estável comprovada. Reforço preventivo de longo prazo agendado.";
                        proxPrioridade = 0.30;
                    }

                    LocalDate nextDate = LocalDate.now().plusDays(proximoIntervalo);
                    String nextDateStr = nextDate.format(DateTimeFormatter.ISO_LOCAL_DATE);
                    String nextId = "rev-" + UUID.randomUUID().toString().substring(0, 8);

                    jdbcTemplate.update(
                            "INSERT INTO revision_calendar (id, session_id, concurso_id, disciplina, topico, tipo_revisao, intervalo_dias, data_agendada, origem_evento, status, justificativa_pedagogica, estagio_intervencao, prioridade_score) " +
                                    "VALUES (?, ?, ?, ?, ?, 'ADAPTATIVA', ?, ?, 'PROGRESSAO_APRENDIZAGEM', 'PENDENTE', ?, ?, ?)",
                            nextId, sessionId, concId, disc, top, proximoIntervalo, nextDateStr, proxJustificativa, proximoEstagio, proxPrioridade
                    );
                    log.info("Progressão adaptativa agendada para {} • {} (Novo Estágio: {}, Intervalo: {} dias)", disc, top, proximoEstagio, proximoIntervalo);

                    result.put("proximoIntervalo", proximoIntervalo);
                    result.put("proximoEstagio", proximoEstagio);
                    result.put("dataAgendada", nextDateStr);
                    result.put("justificativaPedagogica", proxJustificativa);
                } else {
                    // Se falhou ou teve dificuldade na revisão (< 80%), recua para Intervenção Corretiva com prioridade máxima
                    LocalDate nextDate = LocalDate.now().plusDays(1);
                    String nextDateStr = nextDate.format(DateTimeFormatter.ISO_LOCAL_DATE);
                    String nextId = "rev-" + UUID.randomUUID().toString().substring(0, 8);
                    String just = "Dificuldade observada durante a revisão anterior (desempenho " + Math.round(acerto * 100) + "%). Intervalo reajustado para reavaliação corretiva imediata.";

                    jdbcTemplate.update(
                            "INSERT INTO revision_calendar (id, session_id, concurso_id, disciplina, topico, tipo_revisao, intervalo_dias, data_agendada, origem_evento, status, justificativa_pedagogica, estagio_intervencao, prioridade_score) " +
                                    "VALUES (?, ?, ?, ?, ?, 'D1_IMEDIATO', 1, ?, 'DIFICULDADE_EM_REVISAO', 'PENDENTE', ?, 'INTERVENCAO_CORRETIVA', 0.95)",
                            nextId, sessionId, concId, disc, top, nextDateStr,
                            just
                    );
                    log.info("Recuo adaptativo para {} • {} após desempenho insuficiente na revisão", disc, top);

                    result.put("proximoIntervalo", 1);
                    result.put("proximoEstagio", "INTERVENCAO_CORRETIVA");
                    result.put("dataAgendada", nextDateStr);
                    result.put("justificativaPedagogica", just);
                }
            }

            String payload = String.format(Locale.US,
                    "{\"revisionId\":\"%s\",\"taxaAcerto\":%.2f}",
                    revisionId, acerto
            );
            eventStoreRepository.appendEvent(
                    "REVISION_COMPLETED",
                    "REVISION",
                    revisionId,
                    sessionId != null ? sessionId : "manual",
                    1,
                    "v2",
                    payload
            );
        }
        return result;
    }
}
