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

    public MaestroOrchestratorService(JdbcTemplate jdbcTemplate,
                                      EventStoreRepository eventStoreRepository,
                                      ObjectMapper objectMapper) {
        this(jdbcTemplate, eventStoreRepository, objectMapper, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public MaestroOrchestratorService(JdbcTemplate jdbcTemplate,
                                      EventStoreRepository eventStoreRepository,
                                      ObjectMapper objectMapper,
                                      MediaRoutingService mediaRoutingService) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
        this.mediaRoutingService = mediaRoutingService;
    }

    public MaestroPlanDTO generateDailyPlan(String concursoId, Integer tempoDisponivelMinutos) {
        int tempoTotal = (tempoDisponivelMinutos != null && tempoDisponivelMinutos >= 30) ? tempoDisponivelMinutos : 180; // padrão 3h = 180 min

        // 1. Obter nome do concurso
        String concursoNome = "Concurso Ativo";
        if (concursoId != null && !concursoId.isBlank()) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT nome FROM concursos WHERE id = ?", concursoId);
            if (!rows.isEmpty() && rows.get(0).get("nome") != null) {
                concursoNome = (String) rows.get(0).get("nome");
            }
        }

        // 2. Localizar Disciplina e Assunto Prioritário do Edital
        String disciplina = "Direito Administrativo";
        String assunto = "Atos Administrativos";
        String subassunto = "Conceito, Requisitos e Atributos do Ato Administrativo";

        if (concursoId != null && !concursoId.isBlank()) {
            String sqlTopico = "SELECT disciplina, assunto, subassunto FROM edital_topicos " +
                    "WHERE concurso_id = ? ORDER BY peso DESC, id ASC LIMIT 1";
            List<Map<String, Object>> topRows = jdbcTemplate.queryForList(sqlTopico, concursoId);
            if (!topRows.isEmpty()) {
                disciplina = (String) topRows.get(0).getOrDefault("disciplina", disciplina);
                assunto = (String) topRows.get(0).getOrDefault("assunto", assunto);
                Object sub = topRows.get(0).get("subassunto");
                if (sub != null && !sub.toString().isBlank()) {
                    subassunto = sub.toString();
                }
            }
        }

        // 3. Localizar Material Didático vinculado no banco
        String materialDoc = null;
        int pagIni = 1;
        int pagFim = 25;

        if (concursoId != null && !concursoId.isBlank()) {
            String sqlMat = "SELECT m.titulo, l.pagina_inicio, l.pagina_fim " +
                    "FROM topic_material_links l " +
                    "JOIN study_materials m ON l.material_id = m.id " +
                    "JOIN edital_topicos t ON l.topico_id = t.id " +
                    "WHERE t.concurso_id = ? AND t.disciplina = ? LIMIT 1";
            try {
                List<Map<String, Object>> matRows = jdbcTemplate.queryForList(sqlMat, concursoId, disciplina);
                if (!matRows.isEmpty()) {
                    materialDoc = (String) matRows.get(0).getOrDefault("titulo", null);
                    Number pIni = (Number) matRows.get(0).get("pagina_inicio");
                    Number pFim = (Number) matRows.get(0).get("pagina_fim");
                    if (pIni != null && pIni.intValue() > 0) pagIni = pIni.intValue();
                    if (pFim != null && pFim.intValue() >= pagIni) pagFim = pFim.intValue();
                    else pagFim = pagIni + 20;
                } else {
                    List<Map<String, Object>> directMat = jdbcTemplate.queryForList(
                            "SELECT titulo, total_paginas FROM study_materials WHERE (concurso_id = ? OR concurso_id IS NULL) AND disciplina = ? LIMIT 1",
                            concursoId, disciplina
                    );
                    if (!directMat.isEmpty()) {
                        materialDoc = (String) directMat.get(0).get("titulo");
                    }
                }
            } catch (Exception ignored) {}
        }

        // 4. Calcular Telemetria Cognitiva e Estatísticas Reais do Estudante (sem mocks)
        int cardsAtrasados = 0;
        try {
            List<Map<String, Object>> cardRows = jdbcTemplate.queryForList("SELECT COUNT(*) as total FROM anki_flashcards WHERE status = 'PENDING'");
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

        // 5. Avaliar Matriz 'Complexidade vs. Familiaridade' (Roteamento Inteligente de Mídia)
        com.fiscalstudy.backend.infrastructure.in.web.dto.MediaRoutingPrescriptionDTO mediaRouting = null;
        if (mediaRoutingService != null) {
            try {
                mediaRouting = mediaRoutingService.evaluateRouting(concursoId, disciplina, assunto, null);
            } catch (Exception ignored) {}
        }
        boolean isVideoAula = mediaRouting != null && "VIDEOAULA".equals(mediaRouting.getVeiculo());
        int pagDestino = (mediaRouting != null && mediaRouting.getPaginaSugerida() != null) ? mediaRouting.getPaginaSugerida() : pagIni;

        // Verifica se há prescrição de Estudo Reverso concluída para este assunto
        Map<String, Object> reverseSession = null;
        try {
            List<Map<String, Object>> revRows = jdbcTemplate.queryForList(
                    "SELECT prescricao_recorte_texto, pagina_inicio_recorte, pagina_fim_recorte, paginas_puladas, erros_questoes_numeros " +
                    "FROM reverse_engineering_sessions WHERE disciplina = ? AND assunto = ? AND status = 'CONCLUIDA' " +
                    "ORDER BY created_at DESC LIMIT 1",
                    disciplina, assunto
            );
            if (!revRows.isEmpty()) {
                reverseSession = revRows.get(0);
            }
        } catch (Exception ignored) {}

        // 6. Orquestração Proporcional e Dinâmica dos Passos para QUALQUER tempo total disponível
        List<MaestroStepDTO> passos = new ArrayList<>();
        boolean isPraticaDominant = disciplina.toLowerCase().matches(".*(racioc[ií]nio|matem[aá]tica|estat[ií]stica|contabilidade|financeira).*");
        boolean hasPendingCards = cardsAtrasados > 0;

        if (tempoTotal <= 60) {
            // Sessão Rápida (ex: 30 a 60 min)
            if (hasPendingCards) {
                int ankiTime = Math.max(8, (int) Math.round(tempoTotal * 0.20));
                int descansoTime = Math.max(5, (int) Math.round(tempoTotal * 0.15));
                int estudoTime = tempoTotal - ankiTime - descansoTime;

                passos.add(new MaestroStepDTO(
                        1, 3, ankiTime, "ANKI_SRS",
                        "Repetição Espaçada (Revisão)",
                        String.format("Passo 1 (%d min): Revise os %d cards pendentes de %s no Anki.", ankiTime, cardsAtrasados, disciplina),
                        disciplina, assunto,
                        "Reativação rápida de memória antes de novo conteúdo", "ANKI_SYNC",
                        Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
                ));

                String instrTeoria = materialDoc != null
                        ? String.format("Passo 2 (%d min): Estudo focado no material '%s' (págs. %d a %d).", estudoTime, materialDoc, pagDestino, pagFim)
                        : String.format("Passo 2 (%d min): Estudo conceitual e aplicação de '%s' - '%s'.", estudoTime, disciplina, assunto);

                passos.add(new MaestroStepDTO(
                        2, 3, estudoTime, isPraticaDominant ? "FIXACAO_QUESTOES" : "TEORIA",
                        isPraticaDominant ? "Resolução Prática Intensiva" : "Teoria Hiperfocada",
                        instrTeoria,
                        disciplina, assunto,
                        isPraticaDominant ? "Prática de resolução e modelagem" : "Absorção conceitual direta",
                        isPraticaDominant ? "RESOLVER_QUESTOES" : "LER_MATERIAL",
                        Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
                ));

                passos.add(new MaestroStepDTO(
                        3, 3, descansoTime, "DESCANSO",
                        "Pausa de Recuperação",
                        String.format("Passo 3 (%d min): Pausa consciente. Afaste-se da tela e beba água.", descansoTime),
                        disciplina, assunto,
                        "Consolidação da memória de trabalho", "DESCANSO_TIMER",
                        Map.of()
                ));
            } else {
                // Sem cards pendentes: não força bloco de Anki com 0 cards
                int descansoTime = Math.max(5, (int) Math.round(tempoTotal * 0.15));
                int estudoTime = tempoTotal - descansoTime;

                passos.add(new MaestroStepDTO(
                        1, 2, estudoTime, isPraticaDominant ? "FIXACAO_QUESTOES" : "TEORIA",
                        isPraticaDominant ? "Treino Intensivo de Questões" : "Teoria & Aplicação",
                        materialDoc != null
                                ? String.format("Passo 1 (%d min): Estudo direcionado no material '%s' (págs. %d a %d).", estudoTime, materialDoc, pagDestino, pagFim)
                                : String.format("Passo 1 (%d min): Treino prático e consolidação de '%s' - '%s'.", estudoTime, disciplina, assunto),
                        disciplina, assunto,
                        isPraticaDominant ? "Resolução prática sem ruído" : "Estudo ativo direcionado",
                        isPraticaDominant ? "RESOLVER_QUESTOES" : "LER_MATERIAL",
                        Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
                ));

                passos.add(new MaestroStepDTO(
                        2, 2, descansoTime, "DESCANSO",
                        "Pausa de Recuperação",
                        String.format("Passo 2 (%d min): Pausa rápida antes do próximo compromisso.", descansoTime),
                        disciplina, assunto,
                        "Descanso da atenção focal", "DESCANSO_TIMER",
                        Map.of()
                ));
            }
        } else if (tempoTotal <= 120) {
            // Sessão Intermediária (ex: 61 a 120 min)
            int ankiTime = hasPendingCards ? Math.max(10, (int) Math.round(tempoTotal * 0.12)) : 0;
            int primingTime = isPraticaDominant ? 0 : Math.max(10, (int) Math.round(tempoTotal * 0.10));
            int descansoTime = 10;
            int fixacaoTime = isPraticaDominant
                    ? Math.max(35, (int) Math.round(tempoTotal * 0.55))
                    : Math.max(20, (int) Math.round(tempoTotal * 0.30));
            int teoriaTime = tempoTotal - ankiTime - primingTime - descansoTime - fixacaoTime;

            if (hasPendingCards) {
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 5, ankiTime, "ANKI_SRS",
                        "Repetição Espaçada (Revisão)",
                        String.format("Passo %d (%d min): %d cards pendentes de %s no Anki.", passos.size() + 1, ankiTime, cardsAtrasados, disciplina),
                        disciplina, assunto,
                        "Manutenção da retenção em dia", "ANKI_SYNC",
                        Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
                ));
            }

            if (!isPraticaDominant) {
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 5, primingTime, "PRIMING_COGNITIVO",
                        "Diagnóstico Prévio (Priming)",
                        String.format("Passo %d (%d min): Resolva 5 questões de '%s' para mapear suas dúvidas antes de ler a teoria.", passos.size() + 1, primingTime, assunto),
                        disciplina, assunto,
                        "Mapeamento de dúvidas prévias", "RESOLVER_QUESTOES",
                        Map.of("totalQuestoes", 5, "modo", "PRIMING")
                ));
            }

            String instrTeoria = materialDoc != null
                    ? String.format("Passo %d (%d min): Estude '%s' (págs. %d a %d).", passos.size() + 1, teoriaTime, materialDoc, pagDestino, pagFim)
                    : String.format("Passo %d (%d min): Estudo conceitual de '%s' - '%s'.", passos.size() + 1, teoriaTime, disciplina, assunto);

            passos.add(new MaestroStepDTO(
                    passos.size() + 1, 5, teoriaTime, "TEORIA",
                    isPraticaDominant ? "Fundamentação & Fórmulas" : "Teoria Hiperfocada",
                    instrTeoria,
                    disciplina, assunto,
                    "Compreensão dos fundamentos", "LER_MATERIAL",
                    Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
            ));

            passos.add(new MaestroStepDTO(
                    passos.size() + 1, 5, descansoTime, "DESCANSO",
                    "Pausa de Recuperação",
                    String.format("Passo %d (%d min): Pausa para água e descanso visual.", passos.size() + 1, descansoTime),
                    disciplina, assunto,
                    "Recuperação da atenção sustentada", "DESCANSO_TIMER",
                    Map.of()
            ));

            passos.add(new MaestroStepDTO(
                    passos.size() + 1, 5, fixacaoTime, "FIXACAO_QUESTOES",
                    "Bateria de Questões",
                    String.format("Passo %d (%d min): Treino prático com questões da banca sobre '%s'.", passos.size() + 1, fixacaoTime, assunto),
                    disciplina, assunto,
                    "Aplicação prática e fixação", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", Math.max(5, (int) (fixacaoTime / 2.5)), "modo", "FIXACAO")
            ));
        } else {
            // Sessão Avançada / Completa (tempo > 120 min)
            int ankiTime = hasPendingCards ? Math.min(20, Math.max(10, (int) Math.round(tempoTotal * 0.08))) : 0;
            int primingTime = isPraticaDominant ? 0 : 10;
            int descansoTime = 10;
            int feynmanTime = isPraticaDominant ? 0 : 15;
            int fixacaoTime = isPraticaDominant
                    ? Math.max(50, (int) Math.round(tempoTotal * 0.45))
                    : Math.max(30, (int) Math.round(tempoTotal * 0.25));
            int teoriaTime = tempoTotal - ankiTime - primingTime - descansoTime - feynmanTime - fixacaoTime;

            if (hasPendingCards) {
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 6, ankiTime, "ANKI_SRS",
                        "Repetição Espaçada (Revisão)",
                        String.format("Passo %d (%d min): %d cards pendentes de %s no Anki.", passos.size() + 1, ankiTime, cardsAtrasados, disciplina),
                        disciplina, assunto,
                        "Manutenção ativa de flashcards", "ANKI_SYNC",
                        Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
                ));
            }

            if (!isPraticaDominant) {
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 6, primingTime, "PRIMING_COGNITIVO",
                        "Diagnóstico Prévio (Priming)",
                        String.format("Passo %d (%d min): Faça 5 questões inéditas de '%s' para identificar pontos fracos antes da teoria.", passos.size() + 1, primingTime, assunto),
                        disciplina, assunto,
                        "Mapeamento de lacunas conceituais", "RESOLVER_QUESTOES",
                        Map.of("totalQuestoes", 5, "modo", "PRIMING")
                ));
            }

            String focoTeoria = "pontos principais de '" + assunto + "'";
            String instrTeoria;
            if (isVideoAula) {
                instrTeoria = String.format("Passo %d (%d min): Assista à videoaula indicada para entender visualmente a mecânica de '%s'.", passos.size() + 1, teoriaTime, assunto);
            } else if (reverseSession != null && reverseSession.get("prescricao_recorte_texto") != null) {
                instrTeoria = String.format("Passo %d (%d min): Estudo focado nos trechos recortados dos seus erros em '%s'.", passos.size() + 1, teoriaTime, assunto);
            } else if (materialDoc != null) {
                instrTeoria = String.format("Passo %d (%d min): Estudo no material '%s' (págs. %d a %d). Foque em %s.", passos.size() + 1, teoriaTime, materialDoc, pagDestino, pagFim, focoTeoria);
            } else {
                instrTeoria = String.format("Passo %d (%d min): Estude os conceitos e regras essenciais de '%s' - '%s'.", passos.size() + 1, teoriaTime, disciplina, assunto);
            }

            passos.add(new MaestroStepDTO(
                    passos.size() + 1, 6, teoriaTime, isVideoAula ? "VIDEO_AULA" : "TEORIA",
                    isVideoAula ? "Videoaula de Apoio" : (isPraticaDominant ? "Fundamentos & Modelagem" : "Teoria Hiperfocada"),
                    instrTeoria,
                    disciplina, assunto,
                    "Compreensão e sistematização conceitual", isVideoAula ? "ASSISTIR_VIDEO" : "LER_MATERIAL",
                    Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
            ));

            passos.add(new MaestroStepDTO(
                    passos.size() + 1, 6, descansoTime, "DESCANSO",
                    "Pausa de Recuperação",
                    String.format("Passo %d (%d min): Pausa de 10 minutos. Beba água e estique o corpo.", passos.size() + 1, descansoTime),
                    disciplina, assunto,
                    "Recuperação cognitiva", "DESCANSO_TIMER",
                    Map.of()
            ));

            passos.add(new MaestroStepDTO(
                    passos.size() + 1, 6, fixacaoTime, "FIXACAO_QUESTOES",
                    "Bateria Principal de Questões",
                    String.format("Passo %d (%d min): Prática intensiva com questões da banca sobre '%s'.", passos.size() + 1, fixacaoTime, assunto),
                    disciplina, assunto,
                    "Resolução deliberada sob tempo", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", Math.max(10, (int) (fixacaoTime / 2.5)), "modo", "FIXACAO")
            ));

            if (!isPraticaDominant) {
                passos.add(new MaestroStepDTO(
                        passos.size() + 1, 6, feynmanTime, "FEYNMAN_AUDIT",
                        "Auto-Explicação Ativa",
                        String.format("Passo %d (%d min): Explique em poucas frases o cerne de '%s' com suas próprias palavras para validar seu domínio.", passos.size() + 1, feynmanTime, assunto),
                        disciplina, assunto,
                        "Verificação de retenção sem consulta", "FEYNMAN",
                        Map.of("topico", assunto)
                ));
            }
        }

        // Recalcular numeração e total de passos
        for (int i = 0; i < passos.size(); i++) {
            passos.get(i).setNumeroPasso(i + 1);
            passos.get(i).setTotalPassos(passos.size());
        }

        Map<String, Object> telemetria = new HashMap<>();
        telemetria.put("retencaoAtual", retencaoAtual);
        telemetria.put("metaRetencao", metaRetencao);
        telemetria.put("cardsAtrasados", cardsAtrasados);
        telemetria.put("disciplinaFoco", disciplina);
        telemetria.put("assuntoFoco", assunto);
        telemetria.put("subassuntoFoco", subassunto);
        telemetria.put("tempoPlanejadoMinutos", tempoTotal);

        return new MaestroPlanDTO(
                concursoId,
                concursoNome,
                tempoTotal,
                passos.size(),
                disciplina,
                assunto,
                passos,
                telemetria,
                "Roteiro de Batalha gerado pelo Maestro com sucesso. Concentre-se apenas na próxima ação imediata."
        );
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
