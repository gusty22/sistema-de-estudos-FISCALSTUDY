package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Serviço de Metodologias Cognitivas Baseadas nos 3 Cadernos:
 * 1. Pré-Mortem de Gary Klein (Antecipação de falhas catastróficas e plano de contingência)
 * 2. Sessão Feynman em Tela Limpa (Reconstrução da árvore conceitual e exposição de lacunas)
 * 3. Material de Pontos-Chave / Cloze Deletion (Omissão de termos críticos baseada nos 5 critérios)
 * 4. Método ERA (Explorar, Estudar, Revisar, Avaliar)
 */
@Service
public class CognitivePedagogyService {

    private static final Logger logger = LoggerFactory.getLogger(CognitivePedagogyService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;

    public CognitivePedagogyService(JdbcTemplate jdbcTemplate, EventStoreRepository eventStoreRepository, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // 1. PRÉ-MORTEM (Gary Klein)
    // =========================================================================

    public PreMortemDTO createPreMortem(PreMortemDTO dto) {
        String id = dto.getId() != null && !dto.getId().isBlank() ? dto.getId() : UUID.randomUUID().toString();
        dto.setId(id);

        String sql = "INSERT INTO pre_mortems (id, concurso_id, titulo, data_prevista, cenario_fracasso, " +
                "causa_1, acao_1, causa_2, acao_2, causa_3, acao_3, status) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                id,
                dto.getConcursoId(),
                dto.getTitulo(),
                dto.getDataPrevista(),
                dto.getCenarioFracasso(),
                dto.getCausa1(),
                dto.getAcao1(),
                dto.getCausa2(),
                dto.getAcao2(),
                dto.getCausa3(),
                dto.getAcao3(),
                dto.getStatus() != null ? dto.getStatus() : "ATIVO"
        );

        appendDomainEvent("PRE_MORTEM_RECORDED", id, dto.getConcursoId(), dto);
        return dto;
    }

    public List<PreMortemDTO> listPreMortems(String concursoId) {
        String sql = "SELECT id, concurso_id, titulo, data_prevista, cenario_fracasso, " +
                "causa_1, acao_1, causa_2, acao_2, causa_3, acao_3, status, created_at " +
                "FROM pre_mortems " +
                (concursoId != null && !concursoId.isBlank() ? "WHERE concurso_id = ? " : "") +
                "ORDER BY created_at DESC";

        List<Map<String, Object>> rows = (concursoId != null && !concursoId.isBlank())
                ? jdbcTemplate.queryForList(sql, concursoId)
                : jdbcTemplate.queryForList(sql);

        List<PreMortemDTO> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            PreMortemDTO dto = new PreMortemDTO();
            dto.setId((String) r.get("id"));
            dto.setConcursoId((String) r.get("concurso_id"));
            dto.setTitulo((String) r.get("titulo"));
            dto.setDataPrevista((String) r.get("data_prevista"));
            dto.setCenarioFracasso((String) r.get("cenario_fracasso"));
            dto.setCausa1((String) r.get("causa_1"));
            dto.setAcao1((String) r.get("acao_1"));
            dto.setCausa2((String) r.get("causa_2"));
            dto.setAcao2((String) r.get("acao_2"));
            dto.setCausa3((String) r.get("causa_3"));
            dto.setAcao3((String) r.get("acao_3"));
            dto.setStatus((String) r.get("status"));
            dto.setCreatedAt((String) r.get("created_at"));
            list.add(dto);
        }
        return list;
    }

    public void deletePreMortem(String id) {
        jdbcTemplate.update("DELETE FROM pre_mortems WHERE id = ?", id);
    }

    // =========================================================================
    // 2. SESSÕES FEYNMAN EM TELA LIMPA
    // =========================================================================

    public FeynmanSessionDTO recordFeynmanSession(FeynmanSessionDTO dto) {
        String id = dto.getId() != null && !dto.getId().isBlank() ? dto.getId() : UUID.randomUUID().toString();
        dto.setId(id);

        String sql = "INSERT INTO feynman_sessions (id, concurso_id, disciplina, topico, " +
                "reconstruction_text, lacunas_identificadas, tempo_minutos) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                id,
                dto.getConcursoId(),
                dto.getDisciplina(),
                dto.getTopico(),
                dto.getReconstructionText(),
                dto.getLacunasIdentificadas(),
                dto.getTempoMinutos() != null ? dto.getTempoMinutos() : 0
        );

        appendDomainEvent("FEYNMAN_SESSION_RECORDED", id, dto.getConcursoId(), dto);
        return dto;
    }

    public List<FeynmanSessionDTO> listFeynmanSessions(String concursoId, String disciplina) {
        StringBuilder sql = new StringBuilder("SELECT id, concurso_id, disciplina, topico, " +
                "reconstruction_text, lacunas_identificadas, tempo_minutos, created_at " +
                "FROM feynman_sessions WHERE 1=1 ");

        List<Object> params = new ArrayList<>();
        if (concursoId != null && !concursoId.isBlank()) {
            sql.append("AND concurso_id = ? ");
            params.add(concursoId);
        }
        if (disciplina != null && !disciplina.isBlank()) {
            sql.append("AND disciplina = ? ");
            params.add(disciplina);
        }
        sql.append("ORDER BY created_at DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        List<FeynmanSessionDTO> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            FeynmanSessionDTO dto = new FeynmanSessionDTO();
            dto.setId((String) r.get("id"));
            dto.setConcursoId((String) r.get("concurso_id"));
            dto.setDisciplina((String) r.get("disciplina"));
            dto.setTopico((String) r.get("topico"));
            dto.setReconstructionText((String) r.get("reconstruction_text"));
            dto.setLacunasIdentificadas((String) r.get("lacunas_identificadas"));
            Number tm = (Number) r.get("tempo_minutos");
            dto.setTempoMinutos(tm != null ? tm.intValue() : 0);
            dto.setCreatedAt((String) r.get("created_at"));
            list.add(dto);
        }
        return list;
    }

    // =========================================================================
    // 3. MATERIAL DE PONTOS-CHAVE (Cloze Deletion / Omissão de Palavras)
    // =========================================================================

    public PontoChaveDTO createPontoChave(PontoChaveDTO dto) {
        String id = dto.getId() != null && !dto.getId().isBlank() ? dto.getId() : UUID.randomUUID().toString();
        dto.setId(id);

        String sql = "INSERT INTO ponto_chave_cards (id, concurso_id, disciplina, topico, " +
                "criterio, cloze_text, explicacao, artigo_ou_referencia, taxa_acerto, proxima_revisao) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                id,
                dto.getConcursoId(),
                dto.getDisciplina(),
                dto.getTopico(),
                dto.getCriterio() != null ? dto.getCriterio() : "MAIS_CAI",
                dto.getClozeText(),
                dto.getExplicacao(),
                dto.getArtigoOuReferencia(),
                dto.getTaxaAcerto() != null ? dto.getTaxaAcerto() : 0.0,
                dto.getProximaRevisao() != null ? dto.getProximaRevisao() : java.time.LocalDate.now().plusDays(1).toString()
        );

        appendDomainEvent("CLOZE_CARD_CREATED", id, dto.getConcursoId(), dto);
        return dto;
    }

    public List<PontoChaveDTO> listPontosChave(String concursoId, String disciplina, String criterio) {
        StringBuilder sql = new StringBuilder("SELECT id, concurso_id, disciplina, topico, " +
                "criterio, cloze_text, explicacao, artigo_ou_referencia, taxa_acerto, proxima_revisao, created_at " +
                "FROM ponto_chave_cards WHERE 1=1 ");

        List<Object> params = new ArrayList<>();
        if (concursoId != null && !concursoId.isBlank()) {
            sql.append("AND concurso_id = ? ");
            params.add(concursoId);
        }
        if (disciplina != null && !disciplina.isBlank()) {
            sql.append("AND disciplina = ? ");
            params.add(disciplina);
        }
        if (criterio != null && !criterio.isBlank() && !"TODOS".equalsIgnoreCase(criterio)) {
            sql.append("AND criterio = ? ");
            params.add(criterio);
        }
        sql.append("ORDER BY created_at DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        List<PontoChaveDTO> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            PontoChaveDTO dto = new PontoChaveDTO();
            dto.setId((String) r.get("id"));
            dto.setConcursoId((String) r.get("concurso_id"));
            dto.setDisciplina((String) r.get("disciplina"));
            dto.setTopico((String) r.get("topico"));
            dto.setCriterio((String) r.get("criterio"));
            dto.setClozeText((String) r.get("cloze_text"));
            dto.setExplicacao((String) r.get("explicacao"));
            dto.setArtigoOuReferencia((String) r.get("artigo_ou_referencia"));
            Number acc = (Number) r.get("taxa_acerto");
            dto.setTaxaAcerto(acc != null ? acc.doubleValue() : 0.0);
            dto.setProximaRevisao((String) r.get("proxima_revisao"));
            dto.setCreatedAt((String) r.get("created_at"));
            list.add(dto);
        }
        return list;
    }

    public void reviewPontoChave(String id, boolean acertou) {
        String proxima = acertou
                ? java.time.LocalDate.now().plusDays(4).toString()
                : java.time.LocalDate.now().plusDays(1).toString();

        jdbcTemplate.update(
                "UPDATE ponto_chave_cards SET proxima_revisao = ?, " +
                        "taxa_acerto = CASE WHEN ? THEN MIN(100.0, taxa_acerto + 15.0) ELSE MAX(0.0, taxa_acerto - 20.0) END " +
                        "WHERE id = ?",
                proxima, acertou, id
        );

        Map<String, Object> payload = Map.of("cardId", id, "acertou", acertou, "proximaRevisao", proxima);
        appendDomainEvent("CLOZE_CARD_REVIEWED", id, null, payload);
    }

    public void deletePontoChave(String id) {
        jdbcTemplate.update("DELETE FROM ponto_chave_cards WHERE id = ?", id);
    }

    // =========================================================================
    // 4. MÉTODO ERA (Explorar, Estudar, Revisar, Avaliar)
    // =========================================================================

    public MetodoEraDTO saveMetodoEraSession(MetodoEraDTO dto) {
        String id = dto.getId() != null && !dto.getId().isBlank() ? dto.getId() : UUID.randomUUID().toString();
        dto.setId(id);

        String sql = "INSERT OR REPLACE INTO metodo_era_sessions (id, concurso_id, disciplina, topico, " +
                "etapa, tempo_explorar_segundos, tempo_estudar_segundos, tempo_revisar_segundos, " +
                "questoes_avaliar_feitas, anotacoes_excecoes, resumo_raiz_abstracao) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                id,
                dto.getConcursoId(),
                dto.getDisciplina(),
                dto.getTopico(),
                dto.getEtapa() != null ? dto.getEtapa() : "EXPLORAR",
                dto.getTempoExplorarSegundos() != null ? dto.getTempoExplorarSegundos() : 0,
                dto.getTempoEstudarSegundos() != null ? dto.getTempoEstudarSegundos() : 0,
                dto.getTempoRevisarSegundos() != null ? dto.getTempoRevisarSegundos() : 0,
                dto.getQuestoesAvaliarFeitas() != null ? dto.getQuestoesAvaliarFeitas() : 0,
                dto.getAnotacoesExcecoes(),
                dto.getResumoRaizAbstracao()
        );

        appendDomainEvent("METODO_ERA_SESSION_RECORDED", id, dto.getConcursoId(), dto);
        return dto;
    }

    public List<MetodoEraDTO> listMetodoEraSessions(String concursoId) {
        String sql = "SELECT id, concurso_id, disciplina, topico, etapa, " +
                "tempo_explorar_segundos, tempo_estudar_segundos, tempo_revisar_segundos, " +
                "questoes_avaliar_feitas, anotacoes_excecoes, resumo_raiz_abstracao, created_at " +
                "FROM metodo_era_sessions " +
                (concursoId != null && !concursoId.isBlank() ? "WHERE concurso_id = ? " : "") +
                "ORDER BY created_at DESC";

        List<Map<String, Object>> rows = (concursoId != null && !concursoId.isBlank())
                ? jdbcTemplate.queryForList(sql, concursoId)
                : jdbcTemplate.queryForList(sql);

        List<MetodoEraDTO> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            MetodoEraDTO dto = new MetodoEraDTO();
            dto.setId((String) r.get("id"));
            dto.setConcursoId((String) r.get("concurso_id"));
            dto.setDisciplina((String) r.get("disciplina"));
            dto.setTopico((String) r.get("topico"));
            dto.setEtapa((String) r.get("etapa"));
            Number te = (Number) r.get("tempo_explorar_segundos");
            dto.setTempoExplorarSegundos(te != null ? te.intValue() : 0);
            Number tes = (Number) r.get("tempo_estudar_segundos");
            dto.setTempoEstudarSegundos(tes != null ? tes.intValue() : 0);
            Number tr = (Number) r.get("tempo_revisar_segundos");
            dto.setTempoRevisarSegundos(tr != null ? tr.intValue() : 0);
            Number qa = (Number) r.get("questoes_avaliar_feitas");
            dto.setQuestoesAvaliarFeitas(qa != null ? qa.intValue() : 0);
            dto.setAnotacoesExcecoes((String) r.get("anotacoes_excecoes"));
            dto.setResumoRaizAbstracao((String) r.get("resumo_raiz_abstracao"));
            dto.setCreatedAt((String) r.get("created_at"));
            list.add(dto);
        }
        return list;
    }

    // =========================================================================
    // 5. AUDITORIA DE ERROS CRÍTICOS (Feynman Constrangido / Fail-Safe)
    // =========================================================================

    public CriticalErrorFeynmanAuditDTO recordCriticalErrorAudit(CriticalErrorFeynmanAuditDTO dto) {
        String id = dto.getId() != null && !dto.getId().isBlank() ? dto.getId() : UUID.randomUUID().toString();
        dto.setId(id);
        dto.setStatusValidacao("VALIDADO");

        String sql = "INSERT INTO critical_error_feynman_audits (id, question_id, session_id, selected_option, " +
                "pegadinha_explicacao, regra_correta_explicacao, status_validacao) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                id,
                dto.getQuestionId(),
                dto.getSessionId(),
                dto.getSelectedOption(),
                dto.getPegadinhaExplicacao(),
                dto.getRegraCorretaExplicacao(),
                dto.getStatusValidacao()
        );

        appendDomainEvent("CRITICAL_ERROR_FEYNMAN_AUDITED", id, dto.getSessionId(), dto);
        return dto;
    }

    private void appendDomainEvent(String eventType, String aggregateId, String sessionId, Object payloadObj) {
        try {
            String json = objectMapper.writeValueAsString(payloadObj);
            eventStoreRepository.appendEvent(
                    eventType,
                    "PEDAGOGY",
                    aggregateId,
                    sessionId != null ? sessionId : "global",
                    1,
                    "v1",
                    json
            );
        } catch (Exception e) {
            logger.warn("Erro ao gravar evento de pedagogia cognitiva: {}", eventType, e);
        }
    }
}
