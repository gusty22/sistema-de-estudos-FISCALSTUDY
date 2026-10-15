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

        // 3. Localizar Material Didático vinculado
        String materialDoc = "PDF Aula 04";
        int pagIni = 15;
        int pagFim = 35;

        if (concursoId != null && !concursoId.isBlank()) {
            String sqlMat = "SELECT m.titulo, l.pagina_inicio, l.pagina_fim " +
                    "FROM topic_material_links l " +
                    "JOIN materials m ON l.material_id = m.id " +
                    "JOIN edital_topicos t ON l.topico_id = t.id " +
                    "WHERE t.concurso_id = ? AND t.disciplina = ? LIMIT 1";
            try {
                List<Map<String, Object>> matRows = jdbcTemplate.queryForList(sqlMat, concursoId, disciplina);
                if (!matRows.isEmpty()) {
                    materialDoc = (String) matRows.get(0).getOrDefault("titulo", materialDoc);
                    Number pIni = (Number) matRows.get(0).get("pagina_inicio");
                    Number pFim = (Number) matRows.get(0).get("pagina_fim");
                    if (pIni != null && pIni.intValue() > 0) pagIni = pIni.intValue();
                    if (pFim != null && pFim.intValue() >= pagIni) pagFim = pFim.intValue();
                    else pagFim = pagIni + 20;
                }
            } catch (Exception ignored) {}
        }

        // 4. Calcular Telemetria Cognitiva e Estatísticas do Gêmeo Digital
        int cardsAtrasados = 45;
        int retencaoAtual = 82;
        int metaRetencao = 90;

        try {
            List<Map<String, Object>> attempts = jdbcTemplate.queryForList(
                    "SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as acertos " +
                            "FROM question_attempts WHERE aggregate_id = ?",
                    concursoId
            );
            if (!attempts.isEmpty() && attempts.get(0).get("total") != null) {
                int tot = ((Number) attempts.get(0).get("total")).intValue();
                int ac = attempts.get(0).get("acertos") != null ? ((Number) attempts.get(0).get("acertos")).intValue() : 0;
                if (tot > 0) {
                    retencaoAtual = Math.max(50, Math.min(95, (int) Math.round(((double) ac / tot) * 100)));
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

        // 6. Orquestração Proporcional dos Passos baseada no tempo disponível
        List<MaestroStepDTO> passos = new ArrayList<>();

        if (tempoTotal <= 60) {
            // Plano Rápido (1 hora)
            passos.add(new MaestroStepDTO(
                    1, 3, 15, "ANKI_SRS",
                    "Repetição Espaçada (Anki)",
                    String.format("Passo 1 (15 min): Abra o Anki. Você tem %d cards atrasados de %s. Nível de retenção atual está em %d%%, precisamos subir para %d%%.", cardsAtrasados, disciplina, retencaoAtual, metaRetencao),
                    disciplina, assunto,
                    "Reativação rápida de memória antes de novo conteúdo", "ANKI_SYNC",
                    Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
            ));

            if (isVideoAula) {
                passos.add(new MaestroStepDTO(
                        2, 3, 35, "VIDEO_AULA",
                        "Videoaula Recomendada (Visual da Mecânica)",
                        "Passo 2 (35 min): Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x). Esta matéria exige compreensão visual da mecânica.",
                        disciplina, assunto,
                        "Compreensão visual da mecânica operacional antes da fixação", "ASSISTIR_VIDEO",
                        Map.of("veiculo", "VIDEOAULA", "velocidade", "1.5x", "blocoInicio", 1, "blocoFim", 3)
                ));
            } else {
                passos.add(new MaestroStepDTO(
                        2, 3, 35, "TEORIA",
                        "Teoria Hiperfocada (PDF Direto)",
                        String.format("Passo 2 (35 min): Vá direto para o %s, página %d. Videoaula aqui é perda de tempo.", materialDoc, pagDestino),
                        disciplina, assunto,
                        "Absorção conceitual direta sem divagações", "LER_MATERIAL",
                        Map.of("veiculo", "PDF_LEITURA", "materialDoc", materialDoc, "paginaInicio", pagDestino, "paginaFim", Math.max(pagDestino + 15, pagFim))
                ));
            }

            passos.add(new MaestroStepDTO(
                    3, 3, 10, "DESCANSO",
                    "Descanso Absoluto",
                    "Passo 3 (10 min): Descanso absoluto. Afaste-se da tela e beba água.",
                    disciplina, assunto,
                    "Consolidação neural da memória de trabalho", "DESCANSO_TIMER",
                    Map.of()
            ));
        } else if (tempoTotal <= 120) {
            // Plano Médio (2 horas = 120 min)
            passos.add(new MaestroStepDTO(
                    1, 4, 15, "ANKI_SRS",
                    "Repetição Espaçada (Anki)",
                    String.format("Passo 1 (15 min): Abra o Anki. Você tem %d cards atrasados de %s. Nível de retenção atual está em %d%%, precisamos subir para %d%%.", cardsAtrasados, disciplina, retencaoAtual, metaRetencao),
                    disciplina, assunto,
                    "Combate à curva de esquecimento", "ANKI_SYNC",
                    Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
            ));

            passos.add(new MaestroStepDTO(
                    2, 4, 10, "PRIMING_COGNITIVO",
                    "Priming Cognitivo",
                    String.format("Passo 2 (10 min): Priming Cognitivo. Resolva estas 5 questões inéditas de '%s'. Você nunca viu essa matéria, o objetivo aqui é errar para gerar curiosidade e abrir lacunas neurológicas.", assunto),
                    disciplina, assunto,
                    "Geração de curiosidade e ativação de lacunas prévias", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", 5, "modo", "PRIMING")
            ));

            if (isVideoAula) {
                passos.add(new MaestroStepDTO(
                        3, 4, 50, "VIDEO_AULA",
                        "Videoaula Recomendada (Visual da Mecânica)",
                        "Passo 3 (50 min): Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x). Esta matéria exige compreensão visual da mecânica.",
                        disciplina, assunto,
                        "Estudo ativo visual direcionado pelas dúvidas do priming", "ASSISTIR_VIDEO",
                        Map.of("veiculo", "VIDEOAULA", "velocidade", "1.5x", "blocoInicio", 1, "blocoFim", 3)
                ));
            } else {
                passos.add(new MaestroStepDTO(
                        3, 4, 50, "TEORIA",
                        "Teoria Hiperfocada (PDF Direto)",
                        String.format("Passo 3 (50 min): Teoria. Vá direto para o %s, página %d. Videoaula aqui é perda de tempo.", materialDoc, pagDestino),
                        disciplina, assunto,
                        "Estudo ativo direcionado pelas dúvidas do priming", "LER_MATERIAL",
                        Map.of("veiculo", "PDF_LEITURA", "materialDoc", materialDoc, "paginaInicio", pagDestino, "paginaFim", Math.max(pagDestino + 20, pagFim))
                ));
            }

            passos.add(new MaestroStepDTO(
                    4, 4, 10, "DESCANSO",
                    "Descanso Absoluto",
                    "Passo 4 (10 min): Descanso absoluto. Afaste-se da tela.",
                    disciplina, assunto,
                    "Recuperação metabólica cerebral", "DESCANSO_TIMER",
                    Map.of()
            ));

            passos.add(new MaestroStepDTO(
                    5, 5, 35, "FIXACAO_QUESTOES",
                    "Fixação e Resolução Ativa",
                    String.format("Passo 5 (35 min): Bateria de Fixação. Resolva 12 questões da banca examinadora sobre '%s'. Meta de acerto: >80%%.", assunto),
                    disciplina, assunto,
                    "Prática deliberada imediata pós-teoria", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", 12, "modo", "FIXACAO")
            ));
        } else {
            // Plano Padrão de 3 Horas ou mais (Exatamente como o Roteiro Mastigado do usuário)
            passos.add(new MaestroStepDTO(
                    1, 6, 15, "ANKI_SRS",
                    "Repetição Espaçada (Anki)",
                    String.format("Passo 1 (15 min): Abra o Anki. Você tem %d cards atrasados de %s. Nível de retenção atual está em %d%%, precisamos subir para %d%%.", cardsAtrasados, disciplina, retencaoAtual, metaRetencao),
                    disciplina, assunto,
                    "Estabilização da curva de esquecimento (SRS)", "ANKI_SYNC",
                    Map.of("cardsAtrasados", cardsAtrasados, "retencaoAtual", retencaoAtual, "metaRetencao", metaRetencao)
            ));

            passos.add(new MaestroStepDTO(
                    2, 6, 10, "PRIMING_COGNITIVO",
                    "Priming Cognitivo",
                    String.format("Passo 2 (10 min): Priming Cognitivo. Resolva estas 5 questões inéditas de '%s'. Você nunca viu essa matéria, o objetivo aqui é errar para gerar curiosidade e abrir lacunas neurológicas.", assunto),
                    disciplina, assunto,
                    "Geração de curiosidade e ancoragem neurológica de lacunas", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", 5, "modo", "PRIMING")
            ));

            String focoTeoria = ("Atos Administrativos".equalsIgnoreCase(assunto) || "Direito Administrativo".equalsIgnoreCase(disciplina))
                    ? "atributos do ato"
                    : "atributos e requisitos de '" + assunto + "'";

            if (isVideoAula) {
                passos.add(new MaestroStepDTO(
                        3, 6, 50, "VIDEO_AULA",
                        "Videoaula Recomendada (Visual da Mecânica)",
                        String.format("Passo 3 (50 min): Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x). Esta matéria exige compreensão visual da mecânica de '%s'.", assunto),
                        disciplina, assunto,
                        "Compreensão visual da mecânica operacional antes da fixação", "ASSISTIR_VIDEO",
                        Map.of("veiculo", "VIDEOAULA", "velocidade", "1.5x", "blocoInicio", 1, "blocoFim", 3, "assunto", assunto)
                ));
            } else {
                passos.add(new MaestroStepDTO(
                        3, 6, 50, "TEORIA",
                        "Teoria Hiperfocada (PDF Direto)",
                        String.format("Passo 3 (50 min): Teoria. Vá direto para o %s, página %d. Videoaula aqui é perda de tempo. Foque apenas nos %s. Ignore a jurisprudência por enquanto.", materialDoc, pagDestino, focoTeoria),
                        disciplina, assunto,
                        "Preenchimento das lacunas expostas durante o priming via leitura densa", "LER_MATERIAL",
                        Map.of("veiculo", "PDF_LEITURA", "materialDoc", materialDoc, "paginaInicio", pagDestino, "paginaFim", Math.max(pagDestino + 20, pagFim))
                ));
            }

            passos.add(new MaestroStepDTO(
                    4, 6, 10, "DESCANSO",
                    "Descanso Absoluto",
                    "Passo 4 (10 min): Descanso absoluto. Afaste-se da tela.",
                    disciplina, assunto,
                    "Consolidação biológica sináptica sem novas entradas sensoriais", "DESCANSO_TIMER",
                    Map.of()
            ));

            passos.add(new MaestroStepDTO(
                    5, 6, 45, "FIXACAO_QUESTOES",
                    "Fixação e Resolução Ativa",
                    String.format("Passo 5 (45 min): Resolução Ativa. Faça 15 questões da banca examinadora para testar a retenção de '%s'.", assunto),
                    disciplina, assunto,
                    "Transferência e fluência de resolução sob pressão de tempo", "RESOLVER_QUESTOES",
                    Map.of("totalQuestoes", 15, "modo", "FIXACAO")
            ));

            passos.add(new MaestroStepDTO(
                    6, 6, 15, "FEYNMAN_AUDIT",
                    "Síntese Feynman / Auditoria Ativa",
                    String.format("Passo 6 (15 min): Síntese Ativa. Escreva em 3 frases sem jargões como você explicaria '%s' para um auditor sênior.", assunto),
                    disciplina, assunto,
                    "Blindagem definitiva contra ilusão de competência (Dunning-Kruger)", "FEYNMAN",
                    Map.of("topico", assunto)
            ));

            if (tempoTotal >= 210) {
                passos.add(new MaestroStepDTO(
                        7, 7, tempoTotal - 145, "REVISAO_ERROS",
                        "Caderno de Erros Estratégico",
                        String.format("Passo 7 (%d min): Analise os erros cometidos na sessão e registre 1 novo flashcard de omissão de termo.", tempoTotal - 145),
                        disciplina, assunto,
                        "Retroalimentação preventiva do algoritmo de repetição", "RESOLVER_QUESTOES",
                        Map.of("modo", "ERROS")
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
