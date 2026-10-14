package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CrossDomainBridgeDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CrossDomainResponseDTO;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CrossDomainBridgeService {

    private static final Logger logger = LoggerFactory.getLogger(CrossDomainBridgeService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;

    public CrossDomainBridgeService(JdbcTemplate jdbcTemplate, EventStoreRepository eventStoreRepository, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void seedDefaultBridges() {
        try {
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM cross_domain_bridges", Integer.class);
            if (count != null && count == 0) {
                logger.info("Populando pontes de colisão de domínios interdisciplinares fiscais...");
                insertBridge("bridge_001", "Direito Tributário", "Decadência Tributária",
                        "Direito Civil", "Prescrição Civil",
                        "Perda do Direito Potestativo vs Perda da Pretensão Exigível",
                        "Escreva em até 140 caracteres a exata fronteira entre a perda do direito de constituir o crédito (Tributário) e a perda da pretensão indenizatória (Civil).",
                        140);

                insertBridge("bridge_002", "Direito Administrativo", "Controle de Legalidade e Autotutela",
                        "Auditoria Governamental", "Testes de Conformidade e Controle Interno",
                        "Súmula 473 STF vs Teste de Observância dos Controles",
                        "Sintetize em 140 caracteres a distinção entre anular um ato ilegal pela autotutela administrativa e apontar deficiência de controle interno na auditoria.",
                        140);

                insertBridge("bridge_003", "Contabilidade Geral", "Princípio da Competência e Fato Contábil",
                        "Direito Tributário", "Hipótese de Incidência e Fato Gerador do IRPJ",
                        "Regime Contábil de Competência (CPC 00) vs Realização da Receita Tributária",
                        "Explique em 140 caracteres por que o reconhecimento de uma receita contábil diferida difere da ocorrência do fato imponível tributário.",
                        140);

                insertBridge("bridge_004", "Direito Constitucional", "Imunidades Tributárias Recíprocas e Subjetivas",
                        "Direito Tributário", "Isenções Heterônomas e Não-Incidência",
                        "Incompetência Constitucional Originária vs Dispensa Legal do Pagamento",
                        "Diferencie em 140 caracteres: por que a imunidade é uma norma de incompetência negativa e a isenção é mera exclusão do crédito tributário?",
                        140);
            }
        } catch (Exception e) {
            logger.warn("Aviso ao verificar ou popular cross_domain_bridges: {}", e.getMessage());
        }
    }

    private void insertBridge(String id, String domA_disc, String domA_top,
                              String domB_disc, String domB_top,
                              String conceito, String prompt, int maxChars) {
        String sql = "INSERT INTO cross_domain_bridges (id, dominio_a_disciplina, dominio_a_topico, " +
                "dominio_b_disciplina, dominio_b_topico, conceito_fronteira, desafio_prompt, max_caracteres) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql, id, domA_disc, domA_top, domB_disc, domB_top, conceito, prompt, maxChars);
    }

    public List<CrossDomainBridgeDTO> listBridges(String disciplina) {
        String sql = "SELECT b.id, b.dominio_a_disciplina, b.dominio_a_topico, b.dominio_b_disciplina, b.dominio_b_topico, " +
                "b.conceito_fronteira, b.desafio_prompt, b.max_caracteres, b.created_at, " +
                "(SELECT COUNT(*) FROM cross_domain_responses r WHERE r.bridge_id = b.id) as total_respostas, " +
                "(SELECT r2.active_output_text FROM cross_domain_responses r2 WHERE r2.bridge_id = b.id ORDER BY r2.created_at DESC LIMIT 1) as ultima_resposta " +
                "FROM cross_domain_bridges b ";

        if (disciplina != null && !disciplina.isBlank()) {
            sql += "WHERE LOWER(b.dominio_a_disciplina) LIKE LOWER(?) OR LOWER(b.dominio_b_disciplina) LIKE LOWER(?) ";
        }
        sql += "ORDER BY b.created_at ASC";

        List<Map<String, Object>> rows = (disciplina != null && !disciplina.isBlank())
                ? jdbcTemplate.queryForList(sql, "%" + disciplina + "%", "%" + disciplina + "%")
                : jdbcTemplate.queryForList(sql);

        List<CrossDomainBridgeDTO> result = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            CrossDomainBridgeDTO dto = new CrossDomainBridgeDTO(
                    (String) r.get("id"),
                    (String) r.get("dominio_a_disciplina"),
                    (String) r.get("dominio_a_topico"),
                    (String) r.get("dominio_b_disciplina"),
                    (String) r.get("dominio_b_topico"),
                    (String) r.get("conceito_fronteira"),
                    (String) r.get("desafio_prompt"),
                    ((Number) r.get("max_caracteres")).intValue()
            );
            dto.setCreatedAt((String) r.get("created_at"));
            Number tot = (Number) r.get("total_respostas");
            dto.setTotalRespostas(tot != null ? tot.intValue() : 0);
            dto.setUltimaResposta((String) r.get("ultima_resposta"));
            result.add(dto);
        }
        return result;
    }

    public CrossDomainResponseDTO submitSynthesis(CrossDomainResponseDTO dto) {
        if (dto.getActiveOutputText() == null || dto.getActiveOutputText().trim().isEmpty()) {
            throw new IllegalArgumentException("O texto da síntese ativa não pode ser vazio");
        }

        String text = dto.getActiveOutputText().trim();
        if (text.length() > 140) {
            throw new IllegalArgumentException("A síntese ativa excede o limite constrangido de 140 caracteres (atual: " + text.length() + ")");
        }

        String id = dto.getId() != null && !dto.getId().isBlank() ? dto.getId() : UUID.randomUUID().toString();
        dto.setId(id);
        dto.setValidado(true);
        dto.setFeedback("Ponte neural consolidada com sucesso via síntese ativa restrita.");

        String sql = "INSERT INTO cross_domain_responses (id, bridge_id, session_id, active_output_text, tempo_resposta_segundos) " +
                "VALUES (?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql, id, dto.getBridgeId(), dto.getSessionId() != null ? dto.getSessionId() : "global",
                text, dto.getTempoRespostaSegundos());

        try {
            String json = objectMapper.writeValueAsString(dto);
            eventStoreRepository.appendEvent(
                    "CROSS_DOMAIN_BRIDGE_SYNTHESIZED",
                    "KNOWLEDGE_BRIDGE",
                    dto.getBridgeId(),
                    dto.getSessionId() != null ? dto.getSessionId() : "global",
                    1,
                    "v1",
                    json
            );
        } catch (Exception e) {
            logger.warn("Erro ao gravar evento CROSS_DOMAIN_BRIDGE_SYNTHESIZED", e);
        }

        return dto;
    }
}
