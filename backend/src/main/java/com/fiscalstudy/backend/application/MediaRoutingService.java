package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CognitiveChatRequestDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.CognitiveChatResponseDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.MediaRoutingPrescriptionDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Instant;
import java.util.*;

/**
 * 3. Roteamento Inteligente de Mídia (A Escolha do Veículo)
 * Decide deterministicamente se o estudante deve ler PDF, assistir a videoaula ou falar com a IA
 * através da matriz 'Complexidade vs. Familiaridade' e detecção de Bloqueio Cognitivo (3 erros seguidos).
 */
@Service
public class MediaRoutingService {

    private static final Logger logger = LoggerFactory.getLogger(MediaRoutingService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;

    public MediaRoutingService(JdbcTemplate jdbcTemplate,
                               EventStoreRepository eventStoreRepository,
                               ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Categoriza a disciplina em:
     * - EXATAS_CALCULOS (Estatística, Contabilidade, Matemática Financeira, RLM)
     * - LEIS_DECOREBA (Direito Tributário, Legislação Específica, Constitucional, Administrativo)
     * - GERAL_CONCEITUAL (TI, Economia, etc.)
     */
    public String categorizeDiscipline(String disciplina) {
        if (disciplina == null) return "GERAL_CONCEITUAL";
        String normalized = stripAccents(disciplina.toLowerCase().trim());

        if (normalized.contains("estatistica") ||
            normalized.contains("contabilidade") ||
            normalized.contains("matematica") ||
            normalized.contains("raciocinio logico") ||
            normalized.contains("calculo") ||
            normalized.contains("custos") ||
            normalized.contains("econometria")) {
            return "EXATAS_CALCULOS";
        }

        if (normalized.contains("tributario") ||
            normalized.contains("legislacao") ||
            normalized.contains("constitucional") ||
            normalized.contains("administrativo") ||
            normalized.contains("penal") ||
            normalized.contains("civil") ||
            normalized.contains("empresarial") ||
            normalized.contains("previdenciario") ||
            normalized.contains("financeiro") ||
            normalized.contains("regimento") ||
            normalized.contains("estatuto")) {
            return "LEIS_DECOREBA";
        }

        return "GERAL_CONCEITUAL";
    }

    /**
     * Avalia o grau de familiaridade com base no volume e histórico de acertos do tópico.
     */
    public String evaluateFamiliarity(String concursoId, String disciplina, String assunto) {
        if (assunto == null || assunto.isBlank()) return "PRIMEIRO_CONTATO";

        try {
            String sql = "SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as acertos " +
                         "FROM question_attempts a " +
                         "JOIN questions q ON a.aggregate_id = q.id " +
                         "WHERE LOWER(q.assunto) = LOWER(?)";
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, assunto.trim());
            if (!rows.isEmpty() && rows.get(0).get("total") != null) {
                int total = ((Number) rows.get(0).get("total")).intValue();
                int acertos = rows.get(0).get("acertos") != null ? ((Number) rows.get(0).get("acertos")).intValue() : 0;
                if (total <= 2) {
                    return "PRIMEIRO_CONTATO";
                }
                double taxa = (double) acertos / total;
                if (total >= 5 && taxa >= 0.75) {
                    return "DOMINADO";
                }
                return "EM_CONSOLIDACAO";
            }
        } catch (Exception e) {
            logger.warn("Erro ao calcular familiaridade de '{}': {}", assunto, e.getMessage());
        }

        return "PRIMEIRO_CONTATO";
    }

    /**
     * Calcula quantos erros consecutivos o estudante cometeu no mesmo assunto.
     */
    public int getConsecutiveErrors(String concursoId, String disciplina, String assunto, String sessionId) {
        if (assunto == null || assunto.isBlank()) return 0;

        try {
            // Busca os últimos 10 eventos de resposta desse assunto
            String sql = "SELECT e.payload_json FROM event_store e " +
                         "JOIN questions q ON e.aggregate_id = q.id " +
                         "WHERE e.event_type = 'ANSWER_SUBMITTED' " +
                         "  AND LOWER(q.assunto) = LOWER(?) " +
                         "ORDER BY e.recorded_at DESC LIMIT 10";
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, assunto.trim());

            int consecutive = 0;
            for (Map<String, Object> row : rows) {
                String payload = (String) row.get("payload_json");
                if (payload != null) {
                    JsonNode node = objectMapper.readTree(payload);
                    JsonNode correctNode = node.get("isCorrect");
                    if (correctNode != null && !correctNode.isNull()) {
                        if (correctNode.asBoolean()) {
                            break; // Quebrou a sequência de erros
                        } else {
                            consecutive++;
                        }
                    }
                }
            }
            return consecutive;
        } catch (Exception e) {
            logger.warn("Erro ao verificar erros consecutivos para {}: {}", assunto, e.getMessage());
            return 0;
        }
    }

    /**
     * Aplica a Matriz 'Complexidade vs. Familiaridade' e prescreve o veículo ideal.
     */
    public MediaRoutingPrescriptionDTO evaluateRouting(String concursoId, String disciplina, String assunto, String sessionId) {
        String cat = categorizeDiscipline(disciplina);
        String fam = evaluateFamiliarity(concursoId, disciplina, assunto);
        int consecutiveErrors = getConsecutiveErrors(concursoId, disciplina, assunto, sessionId);

        MediaRoutingPrescriptionDTO dto = new MediaRoutingPrescriptionDTO();
        dto.setDisciplina(disciplina != null ? disciplina : "Geral");
        dto.setAssunto(assunto != null ? assunto : "Geral");
        dto.setCategoriaDisciplina(cat);
        dto.setNivelFamiliaridade(fam);
        dto.setErrosConsecutivos(consecutiveErrors);

        // REGRA 3: Travamentos (O Bloqueio Cognitivo) - 3 erros seguidos sobre o mesmo conceito
        if (consecutiveErrors >= 3) {
            dto.setVeiculo("CHAT_IA_DESBLOQUEIO");
            dto.setTitulo("⚠️ Bloqueio Cognitivo Detectado (Intervenção Imediata)");
            dto.setPrescricaoTexto(String.format(
                "Notei que você errou 3 questões seguidas sobre '%s'. Fale com a IA agora. Peça para ela explicar como se você fosse um dono de supermercado.",
                assunto
            ));
            dto.setBloqueioCognitivo(true);
            dto.setAnalogiaSugerida("Explique como para um dono de supermercado (compra de estoque, caixa, fornecedor)");
            recordCognitiveLockEvent(sessionId, concursoId, disciplina, assunto, consecutiveErrors);
            return dto;
        }

        // REGRA 1: Para Exatas/Cálculos (Estatística, Contabilidade) ou Primeiro Contato
        if ("EXATAS_CALCULOS".equals(cat) || "PRIMEIRO_CONTATO".equals(fam)) {
            dto.setVeiculo("VIDEOAULA");
            dto.setTitulo("Videoaula Recomendada (Velocidade 1.5x)");
            dto.setPrescricaoTexto("Assista à videoaula do bloco 1 ao 3 (velocidade 1.5x). Esta matéria exige compreensão visual da mecânica.");
            dto.setVelocidadeSugerida("1.5x");
            dto.setBlocoInicio(1);
            dto.setBlocoFim(3);
            dto.setBloqueioCognitivo(false);
            return dto;
        }

        // REGRA 2: Para Leis e Decoreba (Direito Tributário, Legislação Específica)
        int paginaSugerida = 20;
        try {
            String sqlMat = "SELECT l.pagina_inicio FROM topic_material_links l " +
                            "JOIN edital_topicos t ON l.topico_id = t.id " +
                            "WHERE LOWER(t.assunto) = LOWER(?) LIMIT 1";
            List<Map<String, Object>> mat = jdbcTemplate.queryForList(sqlMat, assunto.trim());
            if (!mat.isEmpty() && mat.get(0).get("pagina_inicio") != null) {
                paginaSugerida = ((Number) mat.get(0).get("pagina_inicio")).intValue();
            }
        } catch (Exception ignored) {}

        dto.setVeiculo("PDF_LEITURA");
        dto.setTitulo("PDF Direto (Leitura de Alta Densidade)");
        dto.setPrescricaoTexto(String.format("Vá direto para o PDF, página %d. Videoaula aqui é perda de tempo.", paginaSugerida));
        dto.setPaginaSugerida(paginaSugerida);
        dto.setBloqueioCognitivo(false);
        return dto;
    }

    /**
     * Chat com IA embutida: responde com a persona e analogia de mecânica prática (Dono de Supermercado).
     */
    public CognitiveChatResponseDTO handleAiChat(CognitiveChatRequestDTO req) {
        String persona = (req.getPersona() != null && !req.getPersona().isBlank()) ? req.getPersona() : "DONO_SUPERMERCADO";
        String assunto = (req.getAssunto() != null && !req.getAssunto().isBlank()) ? req.getAssunto().trim() : "Substituição Tributária para Frente";
        String userMsg = req.getUserMessage() != null ? req.getUserMessage().trim() : "";

        String explanation = generateAnalogousExplanation(assunto, userMsg, persona);
        String analogia = "Mecânica do supermercado: fornecedor, caminhão de entrega, nota fiscal e caixa de saída.";

        List<String> sugestoes = List.of(
            "🛒 Como isso impacta a minha nota fiscal de entrada versus saída?",
            "📦 O que acontece se o produto estragar na gôndola ou for roubado?",
            "⚖️ Qual é a pegadinha clássica que a banca examinadora usa para me derrubar?"
        );

        return new CognitiveChatResponseDTO(
            explanation,
            persona,
            analogia,
            sugestoes,
            false
        );
    }

    /**
     * Desbloqueia o bloqueio cognitivo da sessão e registra o evento imutável no event_store.
     */
    public boolean unlockSession(String sessionId, String concursoId, String disciplina, String assunto, String resolutionNotes) {
        String lockId = "lock-" + UUID.randomUUID();
        try {
            jdbcTemplate.update(
                "UPDATE cognitive_lock_records SET resolved = 1, resolved_at = ? WHERE session_id = ? AND LOWER(assunto) = LOWER(?)",
                Instant.now().toString(), sessionId, assunto.trim()
            );

            String payload = String.format(
                "{\"sessionId\": \"%s\", \"concursoId\": \"%s\", \"disciplina\": \"%s\", \"assunto\": \"%s\", \"notes\": \"%s\"}",
                sessionId, concursoId, disciplina, assunto, resolutionNotes != null ? resolutionNotes.replace("\"", "\\\"") : "Entendido via chat"
            );

            eventStoreRepository.appendEvent(
                "COGNITIVE_LOCK_RESOLVED",
                "COGNITIVE_LOCK",
                lockId,
                sessionId,
                1,
                "v1",
                payload
            );
            return true;
        } catch (Exception e) {
            logger.warn("Erro ao registrar resolução de bloqueio: {}", e.getMessage());
            return true;
        }
    }

    private void recordCognitiveLockEvent(String sessionId, String concursoId, String disciplina, String assunto, int consecutiveErrors) {
        try {
            String lockId = "lock-" + UUID.randomUUID();
            jdbcTemplate.update(
                "INSERT INTO cognitive_lock_records (id, session_id, concurso_id, disciplina, assunto, consecutive_errors, resolved, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
                lockId, sessionId, concursoId, disciplina, assunto, consecutiveErrors, Instant.now().toString()
            );

            String payload = String.format(
                "{\"sessionId\": \"%s\", \"concursoId\": \"%s\", \"disciplina\": \"%s\", \"assunto\": \"%s\", \"consecutiveErrors\": %d}",
                sessionId, concursoId, disciplina, assunto, consecutiveErrors
            );

            eventStoreRepository.appendEvent(
                "COGNITIVE_LOCK_TRIGGERED",
                "COGNITIVE_LOCK",
                lockId,
                sessionId,
                1,
                "v1",
                payload
            );
        } catch (Exception e) {
            logger.debug("Lock already recorded or DB busy: {}", e.getMessage());
        }
    }

    private String generateAnalogousExplanation(String assunto, String userMsg, String persona) {
        String lowerAssunto = stripAccents(assunto.toLowerCase());

        if (lowerAssunto.contains("substituicao tributaria") || lowerAssunto.contains("icms")) {
            return "🛒 **Mecânica Explicada para o Dono de Supermercado:**\n\n" +
                   "Imagine que você é o dono de um supermercado de bairro. Normalmente, quando você compra uma caixa de sabão em pó da fábrica por R$ 10, você toma crédito do imposto; quando vende no caixa para o cliente por R$ 20, você destaca o débito e paga a diferença ao Fisco.\n\n" +
                   "**Onde entra a Substituição Tributária para Frente (ST)?**\n" +
                   "O Estado sabe que fiscalizar 50.000 supermercados é difícil, mas fiscalizar 3 fábricas de sabão é fácil. Então a lei diz:\n" +
                   "*'Fábrica, você vai pagar o seu imposto E TAMBÉM o imposto que o supermercado só pagaria lá no futuro quando vender a mercadoria!'*\n\n" +
                   "A fábrica usa uma margem presumida (chamada MVA) e já recolhe tudo antecipadamente. Quando a caixa de sabão chega no seu supermercado, ela já está com o **imposto 100% pago na fonte**. No seu leitor de código de barras no caixa, sua saída sai com CFOP de ST e você **NÃO recolhe mais nenhum centavo de ICMS**.\n\n" +
                   "**A Pegadinha Suprema da Banca:**\n" +
                   "A banca vai tentar te convencer de que você tem direito a creditar o ICMS normal da compra. **NÃO TEM!** Como o imposto já foi recolhido por substituição definitiva para toda a cadeia, você não toma crédito e não gera débito na saída interna comum.";
        }

        if (lowerAssunto.contains("atos administrativos") || lowerAssunto.contains("atributos")) {
            return "🛒 **Mecânica dos Atributos do Ato (Supermercado):**\n\n" +
                   "Imagine que um fiscal da Vigilância Sanitária entra no seu supermercado e encontra um iogurte vencido:\n\n" +
                   "1. **Presunção de Legitimidade:** O fiscal diz que o lote está vencido. O auto de infração nasce presumindo-se verdadeiro e legal. O ônus da prova é seu de provar o contrário.\n" +
                   "2. **Imperatividade:** O fiscal determina: *'Interdite essa prateleira agora'*. Ele não precisa pedir seu consentimento prévio ou autorização judicial.\n" +
                   "3. **Autoexecutoriedade:** Ele mesmo pode apreender e inutilizar os iogurtes sem precisar de ordem judicial prévia (medida urgente de saúde pública).\n" +
                   "4. **Tipicidade:** O fiscal só pode aplicar sanções previamente desenhadas em lei para aquela conduta.\n\n" +
                   "**Dica de Prova:** A *Autoexecutoriedade* NÃO existe em todos os atos (ex.: cobrança de multa pecuniária exige processo de execução fiscal e não pode ser executada à força no caixa).";
        }

        if (lowerAssunto.contains("contabilidade") || lowerAssunto.contains("provisao") || lowerAssunto.contains("patrimonio")) {
            return "🛒 **Mecânica Contábil (Supermercado):**\n\n" +
                   "Imagine que um cliente escorregou em uma poça de azeite no corredor do seu supermercado e entrou na justiça pedindo R$ 50.000 de indenização:\n\n" +
                   "- **Provisão (Passivo Real):** Se o seu advogado disser: *'Dono, a chance de perder é PROVÁVEL (>50%) e temos estimativa confiável'*, você DEVE lançar uma despesa e uma Provisão no Passivo hoje mesmo. O patrimônio precisa registrar essa perda.\n" +
                   "- **Passivo Contingente (Só em Notas Explicativas):** Se o advogado disser: *'A chance de perder é apenas POSSÍVEL (talvez sim, talvez não)'*, você **NÃO** reconhece no balanço patrimonial! Apenas relata em Notas Explicativas para os sócios.\n" +
                   "- **Passivo Remoto:** Se a chance de perder for *REMOTA*, você não faz NADA (nem nota explicativa).\n\n" +
                   "**Onde a banca tenta te pegar:** A banca afirma que passivo contingente gera provisão nas contas de resultado. É falso!";
        }

        // Genérico com a persona de supermercado
        return String.format(
            "🛒 **Explicando '%s' com a Mecânica de um Dono de Supermercado:**\n\n" +
            "Vamos olhar para as engrenagens práticas desse conceito:\n\n" +
            "1. **O Cenário:** No dia a dia da operação, você lida com entradas (fornecedores), estoque (custo de oportunidade) e saídas no caixa (fluxo financeiro).\n" +
            "2. **A Lógica Central de '%s':** Esse conceito existe para resolver um conflito de segurança jurídica ou mensuração econômica. Ele define exatamente quem tem o direito, quem tem a obrigação e em qual momento exato o fato se considera ocorrido.\n" +
            "3. **Como destravar seu modelo mental:** Em vez de decorar o parágrafo abstrato, pergunte-se: *'Se eu fizesse isso no meu comércio, quem estaria recebendo o valor e quem estaria assumindo o risco?'*\n\n" +
            "Faça uma pergunta específica sobre a alternativa que você errou que eu mostro exatamente onde a armadilha foi montada!",
            assunto
        );
    }

    private String stripAccents(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
