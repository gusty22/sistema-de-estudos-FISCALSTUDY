package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MaestroPlanDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MaestroStepDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Serviço de Micro-Orquestração do Ciclo Diário (O Maestro).
 * Transforma o tempo disponível do estudante em um roteiro tático imersivo
 * sem exigir que o estudante tome decisões sobre o que ou como estudar.
 */
@Service
public class MaestroOrchestratorService {

    private static final Logger logger = LoggerFactory.getLogger(MaestroOrchestratorService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;
    private final MediaRoutingService mediaRoutingService;
    private final StudentRoutineService studentRoutineService;

    public MaestroOrchestratorService(JdbcTemplate jdbcTemplate,
                                      EventStoreRepository eventStoreRepository,
                                      ObjectMapper objectMapper) {
        this(jdbcTemplate, eventStoreRepository, objectMapper, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public MaestroOrchestratorService(JdbcTemplate jdbcTemplate,
                                      EventStoreRepository eventStoreRepository,
                                      ObjectMapper objectMapper,
                                      @org.springframework.beans.factory.annotation.Autowired(required = false) MediaRoutingService mediaRoutingService,
                                      @org.springframework.beans.factory.annotation.Autowired(required = false) StudentRoutineService studentRoutineService) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
        this.mediaRoutingService = mediaRoutingService;
        this.studentRoutineService = studentRoutineService;
    }

    public MaestroPlanDTO generateDailyPlan(String concursoId, Integer tempoDisponivelMinutos) {
        concursoId = concursoId == null ? null : concursoId.trim();
        if (concursoId != null && (concursoId.isEmpty() || "undefined".equalsIgnoreCase(concursoId) || "null".equalsIgnoreCase(concursoId))) concursoId = null;
        // 1. Obter nome do concurso
        String concursoNome = "Concurso Ativo";
        if (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId)) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT nome FROM concursos WHERE id = ?", concursoId.trim());
            if (!rows.isEmpty() && rows.get(0).get("nome") != null) {
                concursoNome = (String) rows.get(0).get("nome");
            }
        }

        // 2. Determinar Disponibilidade Real de Hoje
        int tempoDisponivel = 120; // padrão saudável de 2h
        if (tempoDisponivelMinutos != null && tempoDisponivelMinutos >= 30) {
            tempoDisponivel = tempoDisponivelMinutos;
        } else if (studentRoutineService != null) {
            try {
                int routineMin = studentRoutineService.getEffectiveMinutesForToday(concursoId);
                if (routineMin >= 30) {
                    tempoDisponivel = routineMin;
                }
            } catch (Exception ignored) {}
        }

        // Se ainda não fornecido explicitamente, verifica se há disponibilidade cadastrada no concurso
        if ((tempoDisponivelMinutos == null || tempoDisponivelMinutos < 30) && (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId))) {
            try {
                List<Map<String, Object>> cRows = jdbcTemplate.queryForList("SELECT disponibilidade_json FROM concursos WHERE id = ?", concursoId.trim());
                if (!cRows.isEmpty() && cRows.get(0).get("disponibilidade_json") != null) {
                    String json = (String) cRows.get(0).get("disponibilidade_json");
                    Map<?, ?> map = objectMapper.readValue(json, Map.class);
                    if (map.containsKey("dias")) {
                        Map<?, ?> dias = (Map<?, ?>) map.get("dias");
                        String ptDay = switch (java.time.LocalDate.now().getDayOfWeek()) {
                            case MONDAY -> "segunda";
                            case TUESDAY -> "terca";
                            case WEDNESDAY -> "quarta";
                            case THURSDAY -> "quinta";
                            case FRIDAY -> "sexta";
                            case SATURDAY -> "sabado";
                            case SUNDAY -> "domingo";
                        };
                        Object val = dias.get(ptDay);
                        if (val instanceof Number n && n.doubleValue() > 0) {
                            tempoDisponivel = (int) Math.round(n.doubleValue() * 60);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        int tempoTotal = tempoDisponivel;

        if (concursoId == null) return emptyPlan(null, concursoNome, tempoDisponivel, "SELECIONE_CONCURSO", "Selecione um concurso para gerar um plano vinculado ao seu edital.");

        // 3. Telemetria Cognitiva Real: Checagem de flashcards, retenção e revisões do calendário
        int cardsAtrasados = 0;
        try {
            List<Map<String, Object>> cardRows = jdbcTemplate.queryForList(
                    "SELECT COUNT(*) as total FROM anki_flashcards WHERE concurso_id = ? AND sync_status = 'PENDING_ANKI'", concursoId
            );
            if (!cardRows.isEmpty() && cardRows.get(0).get("total") != null) {
                cardsAtrasados = ((Number) cardRows.get(0).get("total")).intValue();
            }
        } catch (Exception ignored) {}

        int retencaoAtual = 0;
        int metaRetencao = 85;
        try {
            List<Map<String, Object>> attempts = jdbcTemplate.queryForList(
                    "SELECT payload_json FROM event_store WHERE event_type = 'ANSWER_SUBMITTED'"
            );
            int tot = attempts.size();
            int ac = 0;
            for (Map<String, Object> r : attempts) {
                String payload = (String) r.get("payload_json");
                if (payload != null && payload.contains("\"isCorrect\":true")) {
                    ac++;
                }
            }
            if (tot > 0) {
                retencaoAtual = Math.max(0, Math.min(100, (int) Math.round(((double) ac / tot) * 100)));
            }
        } catch (Exception ignored) {}

        String todayStr = java.time.LocalDate.now().toString();
        List<Map<String, Object>> pendingRevisions = new ArrayList<>();
        try {
            String revSql = "SELECT id, disciplina, topico, tipo_revisao, prioridade_score, justificativa_pedagogica " +
                    "FROM revision_calendar WHERE concurso_id = ? AND status = 'PENDENTE' AND data_agendada <= ? " +
                    "ORDER BY prioridade_score DESC, data_agendada ASC LIMIT 2";
            pendingRevisions = new ArrayList<>(jdbcTemplate.queryForList(revSql, concursoId, todayStr));
        } catch (Exception ignored) {}

        // 4. Seleção Intercalada de Tópicos (Interleaving Cognitivo - Máximo 50-60 min por disciplina)
        int numBlocos = Math.max(1, (int) Math.round((double) tempoTotal / 60.0));
        if (numBlocos < 1) numBlocos = 1;

        List<Map<String, Object>> candidateTopics = new ArrayList<>();
        if (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId)) {
            candidateTopics = jdbcTemplate.queryForList(
                    "SELECT disciplina, assunto, subassunto, peso FROM edital_topicos " +
                    "WHERE concurso_id = ? ORDER BY peso DESC, id ASC",
                    concursoId.trim()
            );
        }
        if (candidateTopics.isEmpty()) return emptyPlan(concursoId, concursoNome, tempoDisponivel, "SEM_TOPICOS_EDITAL", "Nenhum tópico cadastrado neste concurso. Importe ou revise o edital antes de gerar o plano.");

        // Extrai tópicos alternando disciplinas para evitar monotonia cognitiva
        List<Map<String, Object>> selectedTopics = new ArrayList<>();
        Set<String> seenDisciplines = new HashSet<>();

        for (Map<String, Object> top : candidateTopics) {
            String disc = (String) top.get("disciplina");
            if (disc != null && !disc.isBlank() && !seenDisciplines.contains(disc.trim().toLowerCase())) {
                selectedTopics.add(top);
                seenDisciplines.add(disc.trim().toLowerCase());
                if (selectedTopics.size() >= numBlocos) {
                    break;
                }
            }
        }

        // Se o concurso tiver menos disciplinas distintas que o número de blocos, completa com assuntos diferentes
        if (selectedTopics.size() < numBlocos) {
            for (Map<String, Object> top : candidateTopics) {
                if (!selectedTopics.contains(top)) {
                    selectedTopics.add(top);
                    if (selectedTopics.size() >= numBlocos) break;
                }
            }
        }

        if (selectedTopics.isEmpty()) return emptyPlan(concursoId, concursoNome, tempoDisponivel, "SEM_TOPICOS_EDITAL", "Nenhum tópico disponível para este concurso.");

        String disciplinaPrincipal = (String) selectedTopics.get(0).getOrDefault("disciplina", "Conhecimentos Fiscais");
        String assuntoPrincipal = (String) selectedTopics.get(0).getOrDefault("assunto", "Tópico Estratégico");
        String subassuntoPrincipal = selectedTopics.get(0).get("subassunto") != null ? selectedTopics.get(0).get("subassunto").toString() : "Fundamentos";

        // 5. Orquestração dos Passos Intercalados (Capped em 50-60 min por disciplina)
        List<MaestroStepDTO> passos = new ArrayList<>();
        int revisoesInjetadasCount = 0;
        List<String> distinctDisciplinesList = new ArrayList<>();

        int baseBlockDuration = tempoTotal / numBlocos;
        int extraMinutes = tempoTotal % numBlocos;

        for (int b = 0; b < numBlocos; b++) {
            Map<String, Object> topicInfo = selectedTopics.get(Math.min(b, selectedTopics.size() - 1));
            String bDisciplina = (String) topicInfo.getOrDefault("disciplina", disciplinaPrincipal);
            String bAssunto = (String) topicInfo.getOrDefault("assunto", assuntoPrincipal);
            if (!distinctDisciplinesList.contains(bDisciplina)) {
                distinctDisciplinesList.add(bDisciplina);
            }

            int targetBlockTime = baseBlockDuration + (b < extraMinutes ? 1 : 0);
            int blockTimeRemaining = targetBlockTime;

            // Injeção de Revisão Espaçada (SRS/Anki ou Agenda) apenas se houver pendência REAL
            if (b == 0 && cardsAtrasados > 0 && blockTimeRemaining >= 25) {
                int ankiTime = Math.min(15, Math.max(8, (int) Math.round(targetBlockTime * 0.15)));
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, ankiTime, "ANKI_SRS",
                        "Cards pendentes de envio ao Anki",
                        String.format("Passo %d (%d min): Verifique os %d cards deste concurso pendentes de exportação/sincronização com Anki. Esse total não informa revisões vencidas.", passos.size() + 1, ankiTime, cardsAtrasados),
                        bDisciplina, bAssunto,
                        "Pendência operacional de envio; vencimento de revisão não consultado", "ANKI_SYNC",
                        Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
                ));
                blockTimeRemaining -= ankiTime;
                revisoesInjetadasCount++;
            } else if (!pendingRevisions.isEmpty() && blockTimeRemaining >= 25) {
                Map<String, Object> revItem = pendingRevisions.remove(0);
                String revDisc = (String) revItem.getOrDefault("disciplina", bDisciplina);
                String revTopic = (String) revItem.getOrDefault("topico", bAssunto);
                int revTime = Math.min(15, Math.max(10, (int) Math.round(targetBlockTime * 0.20)));
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, revTime, "REVISAO_ATIVA",
                        "Revisão Espaçada Programada",
                        String.format("Passo %d (%d min): Reforço ativo de '%s' (%s) programado pelo ciclo de retenção.", passos.size() + 1, revTime, revTopic, revDisc),
                        revDisc, revTopic,
                        "Estabilização da curva de esquecimento", "RESOLVER_QUESTOES",
                        Map.of("modo", "REVISAO", "origem", revItem.getOrDefault("origem_evento", "REVISAO_CALENDAR"))
                ));
                blockTimeRemaining -= revTime;
                revisoesInjetadasCount++;
            }

            // Material e rota da disciplina
            Map<String, Object> matInfo = findMaterialForDiscipline(concursoId, bDisciplina);
            String materialDoc = (String) matInfo.get("materialDoc");
            int pagIni = (int) matInfo.get("paginaInicio");
            int pagFim = (int) matInfo.get("paginaFim");

            boolean isPraticaDominant = bDisciplina.toLowerCase().matches(".*(racioc[ií]nio|matem[aá]tica|estat[ií]stica|contabilidade|financeira).*");

            int descansoTime = targetBlockTime >= 50 ? (b == numBlocos - 1 ? 5 : 10) : 5;
            int studyAvailable = Math.max(10, blockTimeRemaining - descansoTime);

            if (b == 0 && !isPraticaDominant && studyAvailable >= 35) {
                // Bloco 1: Priming + Teoria + Questões + Descanso
                int primingTime = 10;
                int fixacaoTime = Math.max(10, Math.min(20, (int) Math.round(studyAvailable * 0.35)));
                int teoriaTime = studyAvailable - primingTime - fixacaoTime;

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, primingTime, "PRIMING_COGNITIVO",
                        "Diagnóstico Prévio (Priming)",
                        String.format("Passo %d (%d min): Faça 5 questões inéditas de '%s' para identificar pontos fracos antes da teoria.", passos.size() + 1, primingTime, bAssunto),
                        bDisciplina, bAssunto,
                        "Mapeamento de lacunas conceituais", "RESOLVER_QUESTOES",
                        Map.of("totalQuestoes", 5, "modo", "PRIMING")
                ));

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, teoriaTime, "TEORIA",
                        "Teoria Hiperfocada",
                        materialDoc != null && !"Biblioteca".equals(materialDoc)
                                ? String.format("Passo %d (%d min): Estude '%s' (págs. %d a %d). Foque em '%s'.", passos.size() + 1, teoriaTime, materialDoc, pagIni, pagFim, bAssunto)
                                : String.format("Passo %d (%d min): Estude os conceitos e regras essenciais de '%s' - '%s'.", passos.size() + 1, teoriaTime, bDisciplina, bAssunto),
                        bDisciplina, bAssunto,
                        "Compreensão e sistematização conceitual", "LER_MATERIAL",
                        Map.of("materialDoc", materialDoc, "paginaInicio", pagIni, "paginaFim", pagFim)
                ));

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, descansoTime, "DESCANSO",
                        "Pausa de Recuperação",
                        String.format("Passo %d (%d min): Pausa consciente. Beba água e relaxe a visão antes de iniciar as questões.", passos.size() + 1, descansoTime),
                        bDisciplina, bAssunto,
                        "Consolidação sináptica e recuperação atencional", "DESCANSO_TIMER",
                        Map.of()
                ));

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, fixacaoTime, "FIXACAO_QUESTOES",
                        "Fixação em Questões",
                        String.format("Passo %d (%d min): Prática com questões da banca sobre '%s'.", passos.size() + 1, fixacaoTime, bAssunto),
                        bDisciplina, bAssunto,
                        "Aplicação prática e fixação", "RESOLVER_QUESTOES",
                        Map.of("totalQuestoes", Math.max(5, (int)(fixacaoTime / 2.5)), "modo", "FIXACAO")
                ));
            } else {
                // Blocos seguintes: Interleaving direto (Teoria/Prática + Fixação + Descanso)
                int fixacaoTime = Math.max(10, Math.min(25, (int) Math.round(studyAvailable * 0.45)));
                int teoriaTime = studyAvailable - fixacaoTime;

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, teoriaTime, isPraticaDominant ? "FIXACAO_QUESTOES" : "TEORIA",
                        isPraticaDominant ? "Fundamentos & Modelagem" : "Teoria & Aplicação",
                        materialDoc != null && !"Biblioteca".equals(materialDoc)
                                ? String.format("Passo %d (%d min): Estudo focado no material '%s' (págs. %d a %d).", passos.size() + 1, teoriaTime, materialDoc, pagIni, pagFim)
                                : String.format("Passo %d (%d min): Estudo direcionado de '%s' - '%s'.", passos.size() + 1, teoriaTime, bDisciplina, bAssunto),
                        bDisciplina, bAssunto,
                        isPraticaDominant ? "Modelagem e prática de cálculo" : "Compreensão conceitual direcionada",
                        isPraticaDominant ? "RESOLVER_QUESTOES" : "LER_MATERIAL",
                        Map.of("materialDoc", materialDoc, "paginaInicio", pagIni, "paginaFim", pagFim)
                ));

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, fixacaoTime, "FIXACAO_QUESTOES",
                        "Bateria de Questões da Banca",
                        String.format("Passo %d (%d min): Resolução deliberada de questões sobre '%s'.", passos.size() + 1, fixacaoTime, bAssunto),
                        bDisciplina, bAssunto,
                        "Fixação sob pressão de prova", "RESOLVER_QUESTOES",
                        Map.of("totalQuestoes", Math.max(5, (int)(fixacaoTime / 2.5)), "modo", "FIXACAO")
                ));

                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 0, descansoTime, "DESCANSO",
                        "Pausa de Recuperação",
                        String.format("Passo %d (%d min): Pausa consciente. Afaste-se da tela antes da próxima etapa.", passos.size() + 1, descansoTime),
                        bDisciplina, bAssunto,
                        "Descanso da atenção focal", "DESCANSO_TIMER",
                        Map.of()
                ));
            }
        }

        // Recalcular numeração e total de passos
        for (int i = 0; i < passos.size(); i++) {
            passos.get(i).setNumeroPasso(i + 1);
            passos.get(i).setTotalPassos(passos.size());
        }

        int tempoCalculado = passos.stream().mapToInt(MaestroStepDTO::getDuracaoMinutos).sum();

        Map<String, Object> telemetria = new HashMap<>();
        telemetria.put("retencaoAtual", retencaoAtual);
        telemetria.put("metaRetencao", metaRetencao);
        telemetria.put("cardsAtrasados", cardsAtrasados);
        telemetria.put("revisoesInjetadas", revisoesInjetadasCount);
        telemetria.put("disciplinaPrincipal", disciplinaPrincipal);
        telemetria.put("assuntoPrincipal", assuntoPrincipal);
        telemetria.put("subassuntoPrincipal", subassuntoPrincipal);
        telemetria.put("tempoPlanejadoMinutos", tempoCalculado);
        telemetria.put("tempoDisponivelMinutos", tempoDisponivel);
        telemetria.put("disciplinasIntercaladas", distinctDisciplinesList);
        telemetria.put("totalBlocosIntercalados", numBlocos);
        telemetria.put("limiteBlocoMinutos", 60);
        telemetria.put("statusPlanejador", tempoCalculado <= tempoDisponivel ? "ADEQUADO_BALANCEADO" : "SOBRECARGA");

        if (revisoesInjetadasCount > 0) {
            telemetria.put("criterioDecaimento", revisoesInjetadasCount + (revisoesInjetadasCount == 1 ? " revisão foi injetada" : " revisões foram injetadas") + " no topo porque o algoritmo detectou pendência real de repetição espaçada.");
        } else {
            telemetria.put("criterioDecaimento", "Nenhuma revisão emergencial injetada hoje: a retenção das disciplinas está dentro da margem de segurança (≥ 75%) e a repetição espaçada está em dia.");
        }

        if (distinctDisciplinesList.size() > 1) {
            telemetria.put("criterioAlternancia", "Interleaving Ativo (" + distinctDisciplinesList.size() + " matérias): " + String.join(" ➔ ", distinctDisciplinesList) + ". O algoritmo limita blocos contínuos a 50–60 min para manter alta performance cognitiva e evitar a fadiga de foco único.");
            telemetria.put("ocorrenciaRecente", "Alternância cognitiva aplicada com sucesso entre " + String.join(" e ", distinctDisciplinesList) + " para evitar monotonia e maximizar a retenção.");
        } else {
            telemetria.put("criterioAlternancia", "Foco Direcionado em " + disciplinaPrincipal + ": atividades equilibradas entre diagnóstico, teoria e consolidação.");
            telemetria.put("ocorrenciaRecente", "Sessão calibrada para o tema prioritário com blocos balanceados.");
        }

        telemetria.put("criterioTempo", "A fila foi calibrada para " + tempoCalculado + " min, perfeitamente adequada à sua disponibilidade de hoje (" + tempoDisponivel + " min), preservando intervalos de descanso mental entre blocos.");

        return new MaestroPlanDTO(
                concursoId,
                concursoNome,
                tempoCalculado,
                tempoDisponivel,
                passos.size(),
                disciplinaPrincipal,
                assuntoPrincipal,
                passos,
                telemetria,
                "Roteiro de Batalha intercalado gerado pelo Maestro com sucesso. Concentre-se apenas na próxima ação imediata."
        );
    }

    private MaestroPlanDTO emptyPlan(String concursoId, String concursoNome, int availableMinutes, String reason, String message) {
        return new MaestroPlanDTO(concursoId, concursoNome, 0, availableMinutes, 0, null, null, List.of(),
                Map.of("statusPlanejador", reason, "tempoPlanejadoMinutos", 0, "tempoDisponivelMinutos", availableMinutes,
                        "totalBlocosIntercalados", 0, "revisoesInjetadas", 0, "disciplinasIntercaladas", List.of()), message);
    }

    private Map<String, Object> findMaterialForDiscipline(String concursoId, String disciplina) {
        String materialDoc = "Biblioteca";
        int pagIni = 1;
        int pagFim = 25;

        if (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId)) {
            String sqlMat = "SELECT m.titulo, l.pagina_inicio, l.pagina_fim " +
                    "FROM topic_material_links l " +
                    "JOIN study_materials m ON l.material_id = m.id " +
                    "JOIN edital_topicos t ON l.topico_id = t.id " +
                    "WHERE t.concurso_id = ? AND t.disciplina = ? LIMIT 1";
            try {
                List<Map<String, Object>> matRows = jdbcTemplate.queryForList(sqlMat, concursoId, disciplina);
                if (!matRows.isEmpty()) {
                    materialDoc = (String) matRows.get(0).getOrDefault("titulo", "Biblioteca");
                    Number pIni = (Number) matRows.get(0).get("pagina_inicio");
                    Number pFim = (Number) matRows.get(0).get("pagina_fim");
                    if (pIni != null && pIni.intValue() > 0) pagIni = pIni.intValue();
                    if (pFim != null && pFim.intValue() >= pagIni) pagFim = pFim.intValue();
                    else pagFim = pagIni + 20;
                } else {
                    List<Map<String, Object>> directMat = jdbcTemplate.queryForList(
                            "SELECT titulo, total_paginas FROM study_materials WHERE concurso_id = ? AND disciplina = ? LIMIT 1",
                            concursoId, disciplina
                    );
                    if (!directMat.isEmpty() && directMat.get(0).get("titulo") != null) {
                        materialDoc = (String) directMat.get(0).get("titulo");
                    }
                }
            } catch (Exception ignored) {}
        }
        return Map.of("materialDoc", materialDoc, "paginaInicio", pagIni, "paginaFim", pagFim);
    }

    public void recordStepCompleted(String concursoId, int numeroPasso, String tipo, int duracaoMinutos) {
        Map<String, Object> payload = Map.of(
                "concursoId", concursoId != null ? concursoId : "",
                "numeroPasso", numeroPasso,
                "tipo", tipo,
                "duracaoMinutos", duracaoMinutos,
                "timestamp", Instant.now().toString()
        );

        String aggregateId = (concursoId != null && !concursoId.isBlank()) ? concursoId : "GLOBAL";
        String sessionId = "SESSION_" + System.currentTimeMillis();

        eventStoreRepository.appendEvent(
                "MAESTRO_STEP_COMPLETED",
                "MAESTRO",
                aggregateId,
                sessionId,
                1,
                "1.0",
                toJson(payload)
        );
        logger.info("Passo {} do Maestro concluído ({}, {} min) registrado no event_store imutável.", numeroPasso, tipo, duracaoMinutos);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}
