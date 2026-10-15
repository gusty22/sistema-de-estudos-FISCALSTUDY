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
                    "SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as acertos " +
                            "FROM question_attempts WHERE aggregate_id = ? OR 1=1",
                    concursoId != null ? concursoId : ""
            );
            if (!attempts.isEmpty() && attempts.get(0).get("total") != null) {
                int tot = ((Number) attempts.get(0).get("total")).intValue();
                int ac = attempts.get(0).get("acertos") != null ? ((Number) attempts.get(0).get("acertos")).intValue() : 0;
                if (tot > 0) {
                    retencaoAtual = Math.max(0, Math.min(100, (int) Math.round(((double) ac / tot) * 100)));
                }
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

        if (tempoTotal <= 60) {
            // Sessão Rápida (ex: 30 a 60 min)
            int ankiTime = Math.max(8, (int) Math.round(tempoTotal * 0.20));
            int descansoTime = Math.max(5, (int) Math.round(tempoTotal * 0.15));
            int estudoTime = tempoTotal - ankiTime - descansoTime;

            passos.add(new MaestroStepDTO(
                    1, 3, ankiTime, "ANKI_SRS",
                    "Repetição Espaçada (Anki)",
                    String.format("Passo 1 (%d min): Abra o Anki. Você tem %d cards pendentes de %s. Nível de retenção atual está em %d%%.", ankiTime, cardsAtrasados, disciplina, retencaoAtual),
                    disciplina, assunto,
                    "Reativação rápida de memória antes de novo conteúdo", "ANKI_SYNC",
                    Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
            ));

            String instrTeoria = materialDoc != null
                    ? String.format("Passo 2 (%d min): Estudo focado no material '%s' (págs. %d a %d).", estudoTime, materialDoc, pagDestino, pagFim)
                    : String.format("Passo 2 (%d min): Estudo conceitual direto de '%s' - '%s' (consulte materiais na Biblioteca).", estudoTime, disciplina, assunto);

            passos.add(new MaestroStepDTO(
                    2, 3, estudoTime, "TEORIA",
                    "Teoria Hiperfocada",
                    instrTeoria,
                    disciplina, assunto,
                    "Absorção conceitual direta", "LER_MATERIAL",
                    Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
            ));

            passos.add(new MaestroStepDTO(
                    3, 3, descansoTime, "DESCANSO",
                    "Descanso Absoluto",
                    String.format("Passo 3 (%d min): Descanso absoluto. Afaste-se da tela e beba água.", descansoTime),
                    disciplina, assunto,
                    "Consolidação neural da memória de trabalho", "DESCANSO_TIMER",
                    Map.of()
            ));
        } else if (tempoTotal <= 120) {
            // Sessão Intermediária (ex: 61 a 120 min)
            int ankiTime = Math.max(10, (int) Math.round(tempoTotal * 0.12));
            int primingTime = Math.max(10, (int) Math.round(tempoTotal * 0.10));
            int descansoTime = 10;
            int fixacaoTime = Math.max(15, (int) Math.round(tempoTotal * 0.28));
            int teoriaTime = tempoTotal - ankiTime - primingTime - descansoTime - fixacaoTime;

            passos.add(new MaestroStepDTO(
                    1, 5, ankiTime, "ANKI_SRS",
                    "Repetição Espaçada (Anki)",
                    String.format("Passo 1 (%d min): Abra o Anki. %d cards pendentes de %s. Nível de retenção: %d%%.", ankiTime, cardsAtrasados, disciplina, retencaoAtual),
                    disciplina, assunto,
                    "Combate à curva de esquecimento", "ANKI_SYNC",
                    Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
            ));

            passos.add(new MaestroStepDTO(
                    2, 5, primingTime, "PRIMING_COGNITIVO",
                    "Priming Cognitivo",
                    String.format("Passo 2 (%d min): Priming Cognitivo. Resolva 5 questões de '%s' para ativar curiosidade e lacunas neurológicas.", primingTime, assunto),
                    disciplina, assunto,
                    "Geração de curiosidade e ativação de lacunas prévias", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", 5, "modo", "PRIMING")
            ));

            String instrTeoria = materialDoc != null
                    ? String.format("Passo 3 (%d min): Estude '%s' (págs. %d a %d). Direcionado pelas lacunas do priming.", teoriaTime, materialDoc, pagDestino, pagFim)
                    : String.format("Passo 3 (%d min): Estude a teoria de '%s' - '%s' (consulte materiais na Biblioteca).", teoriaTime, disciplina, assunto);

            passos.add(new MaestroStepDTO(
                    3, 5, teoriaTime, "TEORIA",
                    "Teoria Hiperfocada",
                    instrTeoria,
                    disciplina, assunto,
                    "Estudo ativo direcionado pelas dúvidas do priming", "LER_MATERIAL",
                    Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
            ));

            passos.add(new MaestroStepDTO(
                    4, 5, descansoTime, "DESCANSO",
                    "Descanso Absoluto",
                    String.format("Passo 4 (%d min): Descanso absoluto. Afaste-se da tela.", descansoTime),
                    disciplina, assunto,
                    "Recuperação metabólica cerebral", "DESCANSO_TIMER",
                    Map.of()
            ));

            passos.add(new MaestroStepDTO(
                    5, 5, fixacaoTime, "FIXACAO_QUESTOES",
                    "Fixação e Resolução Ativa",
                    String.format("Passo 5 (%d min): Bateria de Fixação. Resolva questões sobre '%s'. Meta de acerto: >80%%.", fixacaoTime, assunto),
                    disciplina, assunto,
                    "Prática deliberada imediata pós-teoria", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", Math.max(5, (int) (fixacaoTime / 2.5)), "modo", "FIXACAO")
            ));
        } else {
            // Sessão Avançada / Completa (para QUALQUER tempo acima de 120 min, ex: 150, 180, 240, 300 min)
            int ankiTime = Math.min(20, Math.max(10, (int) Math.round(tempoTotal * 0.08)));
            int primingTime = 10;
            int descansoTime = 10;
            int feynmanTime = 15;
            int fixacaoTime = Math.max(30, (int) Math.round(tempoTotal * 0.25));
            int teoriaTime = tempoTotal - ankiTime - primingTime - descansoTime - feynmanTime - fixacaoTime;

            passos.add(new MaestroStepDTO(
                    1, 6, ankiTime, "ANKI_SRS",
                    "Repetição Espaçada (Anki)",
                    String.format("Passo 1 (%d min): Abra o Anki. %d cards pendentes. Retenção atual: %d%%.", ankiTime, cardsAtrasados, retencaoAtual),
                    disciplina, assunto,
                    "Estabilização da curva de esquecimento (SRS)", "ANKI_SYNC",
                    Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
            ));

            passos.add(new MaestroStepDTO(
                    2, 6, primingTime, "PRIMING_COGNITIVO",
                    "Priming Cognitivo",
                    String.format("Passo 2 (%d min): Resolva 5 questões inéditas de '%s'. Objetivo: ancoragem neurológica de lacunas.", primingTime, assunto),
                    disciplina, assunto,
                    "Geração de curiosidade e ancoragem neurológica de lacunas", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", 5, "modo", "PRIMING")
            ));

            String focoTeoria = "requisitos e especificidades de '" + assunto + "'";
            String instrTeoria;
            if (isVideoAula) {
                instrTeoria = String.format("Passo 3 (%d min): Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x) para compreensão visual de '%s'.", teoriaTime, assunto);
            } else if (reverseSession != null && reverseSession.get("prescricao_recorte_texto") != null) {
                instrTeoria = String.format("Passo 3 (%d min): Teoria Recortada (Estudo Reverso). %s", teoriaTime, reverseSession.get("prescricao_recorte_texto"));
            } else if (materialDoc != null) {
                instrTeoria = String.format("Passo 3 (%d min): Teoria Hiperfocada no material '%s', páginas %d a %d. Foque em %s.", teoriaTime, materialDoc, pagDestino, pagFim, focoTeoria);
            } else {
                instrTeoria = String.format("Passo 3 (%d min): Estude a teoria de '%s' - '%s' utilizando seu material de apoio ou a Biblioteca.", teoriaTime, disciplina, assunto);
            }

            passos.add(new MaestroStepDTO(
                    3, 6, teoriaTime, isVideoAula ? "VIDEO_AULA" : (reverseSession != null ? "TEORIA_RECORTADA" : "TEORIA"),
                    isVideoAula ? "Videoaula Recomendada" : "Teoria Hiperfocada",
                    instrTeoria,
                    disciplina, assunto,
                    "Preenchimento das lacunas expostas durante o priming via leitura densa", isVideoAula ? "ASSISTIR_VIDEO" : "LER_MATERIAL",
                    Map.of("materialDoc", materialDoc != null ? materialDoc : "Biblioteca", "paginaInicio", pagDestino, "paginaFim", pagFim)
            ));

            passos.add(new MaestroStepDTO(
                    4, 6, descansoTime, "DESCANSO",
                    "Descanso Absoluto",
                    String.format("Passo 4 (%d min): Descanso absoluto. Afaste-se da tela e beba água.", descansoTime),
                    disciplina, assunto,
                    "Consolidação biológica sináptica sem novas entradas sensoriais", "DESCANSO_TIMER",
                    Map.of()
            ));

            passos.add(new MaestroStepDTO(
                    5, 6, fixacaoTime, "FIXACAO_QUESTOES",
                    "Fixação e Resolução Ativa",
                    String.format("Passo 5 (%d min): Resolução Ativa. Faça questões da banca sobre '%s'.", fixacaoTime, assunto),
                    disciplina, assunto,
                    "Transferência e fluência de resolução sob pressão de tempo", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", Math.max(10, (int) (fixacaoTime / 2.5)), "modo", "FIXACAO")
            ));

            passos.add(new MaestroStepDTO(
                    6, 6, feynmanTime, "FEYNMAN_AUDIT",
                    "Síntese Feynman / Auditoria Ativa",
                    String.format("Passo 6 (%d min): Síntese Ativa. Explique em poucas frases o cerne de '%s' sem usar jargões.", feynmanTime, assunto),
                    disciplina, assunto,
                    "Blindagem definitiva contra ilusão de competência (Dunning-Kruger)", "FEYNMAN",
                    Map.of("topico", assunto)
            ));
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
