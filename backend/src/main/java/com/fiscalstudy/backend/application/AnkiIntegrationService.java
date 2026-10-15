package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import com.fiscalstudy.backend.domain.Question;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiConnectStatusDTO;
import com.fiscalstudy.backend.infrastructure.in.web.dto.AnkiFlashcardDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AnkiIntegrationService {

    private static final Logger log = LoggerFactory.getLogger(AnkiIntegrationService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EventStoreRepository eventStoreRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${fiscalstudy.anki.endpoint:http://127.0.0.1:8765}")
    private String ankiEndpoint = "http://127.0.0.1:8765";

    public void setAnkiEndpoint(String ankiEndpoint) {
        this.ankiEndpoint = ankiEndpoint;
    }

    public AnkiIntegrationService(JdbcTemplate jdbcTemplate,
                                  EventStoreRepository eventStoreRepository,
                                  ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.eventStoreRepository = eventStoreRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1500))
                .build();
    }

    /**
     * Verifica se o plugin AnkiConnect está ativo na porta 8765
     */
    public AnkiConnectStatusDTO checkConnection() {
        try {
            Map<String, Object> req = Map.of("action", "version", "version", 6);
            String jsonBody = objectMapper.writeValueAsString(req);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ankiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(1500))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                int version = root.path("result").asInt(6);
                int pending = getPendingCardsCount();
                int synced = getSyncedCardsCount();

                return new AnkiConnectStatusDTO(
                        true,
                        version,
                        ankiEndpoint,
                        synced,
                        pending,
                        "🟢 AnkiConnect Conectado (Porta 8765). Integração silenciosa ativa."
                );
            }
        } catch (Exception e) {
            log.debug("AnkiConnect offline em {}: {}", ankiEndpoint, e.getMessage());
        }

        int pending = getPendingCardsCount();
        int synced = getSyncedCardsCount();
        return new AnkiConnectStatusDTO(
                false,
                0,
                ankiEndpoint,
                synced,
                pending,
                "🟡 Anki não detectado na porta 8765. Os cards gerados serão mantidos na fila local e enviados assim que você abrir o Anki."
        );
    }

    /**
     * Garante a criação do Deck no Anki (ex: FiscalStudy::Direito Administrativo)
     */
    public boolean ensureDeckExists(String deckName) {
        try {
            Map<String, Object> req = Map.of(
                    "action", "createDeck",
                    "version", 6,
                    "params", Map.of("deck", deckName)
            );
            String jsonBody = objectMapper.writeValueAsString(req);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ankiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(2000))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.warn("Não foi possível criar deck '{}' no Anki: {}", deckName, e.getMessage());
            return false;
        }
    }

    /**
     * Envia um Flashcard direto para o Anki via AnkiConnect
     */
    public Long sendNoteToAnkiConnect(String deckName, String cardType, String frontOrText, String backOrExtra, List<String> tags) {
        try {
            ensureDeckExists(deckName);

            Map<String, Object> noteMap = new HashMap<>();
            noteMap.put("deckName", deckName);
            noteMap.put("tags", tags != null ? tags : List.of("fiscalstudy"));

            Map<String, Object> options = Map.of(
                    "allowDuplicate", false,
                    "duplicateScope", "deck"
            );
            noteMap.put("options", options);

            if ("CLOZE".equalsIgnoreCase(cardType)) {
                noteMap.put("modelName", "Cloze");
                noteMap.put("fields", Map.of(
                        "Text", frontOrText,
                        "Back Extra", backOrExtra != null ? backOrExtra : ""
                ));
            } else {
                noteMap.put("modelName", "Basic");
                noteMap.put("fields", Map.of(
                        "Front", frontOrText,
                        "Back", backOrExtra != null ? backOrExtra : ""
                ));
            }

            Map<String, Object> req = Map.of(
                    "action", "addNote",
                    "version", 6,
                    "params", Map.of("note", noteMap)
            );

            String jsonBody = objectMapper.writeValueAsString(req);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ankiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(2500))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                if (!root.path("error").isNull()) {
                    log.warn("Erro retornado pelo AnkiConnect: {}", root.path("error").asText());
                    return null;
                }
                return root.path("result").asLong();
            }
        } catch (Exception e) {
            log.debug("AnkiConnect indisponível ao enviar card: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Salva o Flashcard no SQLite e envia silenciosamente ao AnkiConnect
     */
    public AnkiFlashcardDTO saveAndPushCard(String sessionId, String concursoId, String disciplina, String assunto,
                                          String cardType, String frontOrText, String backOrExtra,
                                          String sourceType, String sourceId) {
        String cardId = "anki-" + UUID.randomUUID().toString().substring(0, 8);
        String deckName = "FiscalStudy::" + (disciplina != null && !disciplina.isBlank() ? disciplina.trim() : "Geral");
        String nowStr = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        List<String> tags = new ArrayList<>(List.of("fiscalstudy", "automatizado"));
        if (disciplina != null) tags.add(slugify(disciplina));
        if (assunto != null) tags.add(slugify(assunto));
        if ("CLOZE".equalsIgnoreCase(cardType)) tags.add("cloze");

        // Tenta envio silencioso via AnkiConnect
        Long ankiNoteId = sendNoteToAnkiConnect(deckName, cardType, frontOrText, backOrExtra, tags);
        String syncStatus = (ankiNoteId != null) ? "SYNCED" : "PENDING_ANKI";
        String syncedAt = (ankiNoteId != null) ? nowStr : null;

        String sql = "INSERT INTO anki_flashcards (id, session_id, concurso_id, disciplina, assunto, card_type, " +
                "front_or_text, back_or_extra, deck_name, anki_note_id, sync_status, source_type, source_id, created_at, synced_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql, cardId, sessionId, concursoId, disciplina, assunto, cardType,
                frontOrText, backOrExtra, deckName, ankiNoteId, syncStatus, sourceType, sourceId, nowStr, syncedAt);

        // Registra evento no event_store imutável
        String eventType = (ankiNoteId != null) ? "FLASHCARD_SENT_TO_ANKI" : "FLASHCARD_QUEUED_FOR_ANKI";
        String payloadJson = String.format(Locale.US,
                "{\"cardId\": \"%s\", \"deckName\": \"%s\", \"cardType\": \"%s\", \"syncStatus\": \"%s\", \"ankiNoteId\": %s, \"disciplina\": \"%s\", \"assunto\": \"%s\"}",
                cardId, deckName, cardType, syncStatus, ankiNoteId != null ? ankiNoteId.toString() : "null",
                disciplina != null ? disciplina.replace("\"", "\\\"") : "",
                assunto != null ? assunto.replace("\"", "\\\"") : ""
        );

        eventStoreRepository.appendEvent(
                eventType,
                "FLASHCARD",
                cardId,
                sessionId,
                1,
                "v1",
                payloadJson
        );

        return new AnkiFlashcardDTO(
                cardId, sessionId, concursoId, disciplina, assunto, cardType,
                frontOrText, backOrExtra, deckName, ankiNoteId, syncStatus,
                sourceType, sourceId, nowStr, syncedAt, null
        );
    }

    /**
     * MOTOR DE GERAÇÃO: Gera Flashcard Silencioso a partir de Questão Errada
     */
    public AnkiFlashcardDTO generateFromQuestionError(Question question, String chosenOption, String causaErro, String sessionId) {
        String disciplina = question.getDiscipline() != null ? question.getDiscipline() : "Direito";
        String assunto = question.getTopic() != null ? question.getTopic() : "Geral";
        String statement = question.getStatement() != null ? question.getStatement().trim() : "";
        String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : "A";

        // Localiza texto da alternativa correta
        String correctText = "";
        String chosenText = "";
        if (question.getOptions() != null) {
            for (String opt : question.getOptions()) {
                if (opt != null && opt.toUpperCase().startsWith(correctOpt.toUpperCase())) {
                    correctText = opt.substring(Math.min(opt.length(), 2)).trim();
                }
                if (opt != null && opt.toUpperCase().startsWith(chosenOption.toUpperCase())) {
                    chosenText = opt.substring(Math.min(opt.length(), 2)).trim();
                }
            }
        }

        // Sintetiza regra jurídica em formato Cloze ou Frente e Verso
        boolean useCloze = (statement.length() <= 220 || correctText.length() <= 120);

        String frontOrText;
        String backOrExtra;
        String cardType;

        if (useCloze) {
            cardType = "CLOZE";
            // Extrai palavra-chave da alternativa correta para omissão cloze
            String keyword = extractCoreKeyword(correctText);
            String sentence = formatClozeSentence(statement, correctText, keyword);
            frontOrText = String.format("【%s • %s】 %s", disciplina, assunto, sentence);
            backOrExtra = String.format(
                    "<b>Gabarito:</b> Alternativa %s.<br><b>Pegadinha evitada:</b> A alternativa %s ('%s') induzia ao erro.",
                    correctOpt, chosenOption, truncate(chosenText, 60)
            );
        } else {
            cardType = "BASIC";
            frontOrText = String.format(
                    "<b>[%s — %s]</b><br>Em relação à regra testada na questão:<br><i>\"%s\"</i><br><br><b>Qual é a regra e o entendimento correto?</b>",
                    disciplina, assunto, truncate(statement, 180)
            );
            backOrExtra = String.format(
                    "<b>Regra Correta (Alt. %s):</b><br>%s<br><br><small style='color: #ef4444;'>Atenção: Você marcou a alternativa %s ('%s'), que estava incorreta.</small>",
                    correctOpt, correctText.isBlank() ? "Consulte a fundamentação legal do tópico." : correctText,
                    chosenOption, truncate(chosenText, 60)
            );
        }

        log.info("Flashcard silencioso gerado para o Anki a partir do erro na questão {}: [{}]", question.getId(), cardType);
        return saveAndPushCard(sessionId, null, disciplina, assunto, cardType, frontOrText, backOrExtra, "QUESTION_ERROR", question.getId());
    }

    /**
     * MOTOR DE GERAÇÃO: Gera Flashcard a partir de Parágrafo/Trecho de PDF
     */
    public AnkiFlashcardDTO generateFromPdfParagraph(String textParagraph, String disciplina, String assunto, String sessionId) {
        if (textParagraph == null || textParagraph.isBlank()) {
            throw new IllegalArgumentException("O parágrafo do PDF não pode estar vazio.");
        }

        String disc = (disciplina != null && !disciplina.isBlank()) ? disciplina : "Direito Administrativo";
        String ass = (assunto != null && !assunto.isBlank()) ? assunto : "Conceitos Fundamentais";

        String cleanText = textParagraph.trim().replaceAll("\\s+", " ");
        String keyword = extractCoreKeyword(cleanText);

        // Gera cartão Cloze
        String clozeText = cleanText.replaceFirst("(?i)" + Pattern.quote(keyword), "{{c1::" + keyword + "}}");
        if (!clozeText.contains("{{c1::")) {
            clozeText = "{{c1::" + truncate(cleanText, 50) + "}} " + cleanText.substring(Math.min(cleanText.length(), 50));
        }

        String front = String.format("【%s • %s】 %s", disc, ass, clozeText);
        String backExtra = "<b>Fonte:</b> PDF da sessão de estudos • Regra essencial para revisão ativa amanhã.";

        return saveAndPushCard(sessionId, null, disc, ass, "CLOZE", front, backExtra, "PDF_PARAGRAPH", null);
    }

    /**
     * MOTOR DE GERAÇÃO: Gera o Lote de 15 Flashcards Essenciais da Sessão
     * "Você termina a sessão de estudos, fecha o PDF, abre o Anki e magicamente os 15 flashcards
     * das coisas mais importantes que você acabou de ler (ou errar) já estão lá, com a formatação correta."
     */
    public List<AnkiFlashcardDTO> generateSessionBatch15(String concursoId, String sessionId) {
        List<AnkiFlashcardDTO> generatedCards = new ArrayList<>();

        // 1. Tópicos prioritários do edital
        List<Map<String, Object>> topicos = jdbcTemplate.queryForList(
                "SELECT disciplina, assunto, subassunto FROM edital_topicos " +
                        (concursoId != null && !concursoId.isBlank() ? "WHERE concurso_id = ? " : "") +
                        "ORDER BY peso DESC, questoes_previstas DESC LIMIT 15",
                concursoId != null && !concursoId.isBlank() ? new Object[]{concursoId} : new Object[]{}
        );

        String defaultDisc = "Direito Administrativo";
        String defaultAss = "Atos Administrativos";
        if (!topicos.isEmpty()) {
            defaultDisc = (String) topicos.get(0).getOrDefault("disciplina", defaultDisc);
            defaultAss = (String) topicos.get(0).getOrDefault("assunto", defaultAss);
        }

        // Template dos 15 Flashcards Estratégicos de Alta Frequência (Frente/Verso e Cloze)
        List<Map<String, String>> highYieldBlueprints = getHighYield15Blueprints(defaultDisc, defaultAss);

        for (int i = 0; i < highYieldBlueprints.size(); i++) {
            Map<String, String> bp = highYieldBlueprints.get(i);
            String disc = bp.getOrDefault("disciplina", defaultDisc);
            String ass = bp.getOrDefault("assunto", defaultAss);
            String type = bp.getOrDefault("type", (i % 2 == 0) ? "CLOZE" : "BASIC");
            String front = bp.get("front");
            String back = bp.get("back");

            AnkiFlashcardDTO card = saveAndPushCard(
                    sessionId, concursoId, disc, ass, type, front, back, "SESSION_SYNTHESIS", "step-" + (i + 1)
            );
            generatedCards.add(card);
        }

        log.info("Lote de 15 flashcards da sessão gerado com sucesso para o Anki. Total sincronizado: {}",
                generatedCards.stream().filter(c -> "SYNCED".equals(c.getSyncStatus())).count());

        return generatedCards;
    }

    /**
     * Sincroniza a fila de cards pendentes com o AnkiConnect
     */
    public int syncPendingQueue() {
        List<Map<String, Object>> pendingRows = jdbcTemplate.queryForList(
                "SELECT id, disciplina, assunto, card_type, front_or_text, back_or_extra, deck_name FROM anki_flashcards WHERE sync_status = 'PENDING_ANKI'"
        );

        int count = 0;
        String nowStr = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        for (Map<String, Object> row : pendingRows) {
            String id = (String) row.get("id");
            String deckName = (String) row.get("deck_name");
            String cardType = (String) row.get("card_type");
            String front = (String) row.get("front_or_text");
            String back = (String) row.get("back_or_extra");
            String disc = (String) row.get("disciplina");
            String ass = (String) row.get("assunto");

            List<String> tags = List.of("fiscalstudy", slugify(disc), slugify(ass));
            Long noteId = sendNoteToAnkiConnect(deckName, cardType, front, back, tags);

            if (noteId != null) {
                jdbcTemplate.update(
                        "UPDATE anki_flashcards SET sync_status = 'SYNCED', anki_note_id = ?, synced_at = ? WHERE id = ?",
                        noteId, nowStr, id
                );
                count++;
            }
        }

        return count;
    }

    /**
     * Exporta todos os cards em formato CSV padrão do Anki
     */
    public String exportToCsv(String deckNameFilter) {
        String sql = "SELECT front_or_text, back_or_extra, card_type, disciplina, assunto FROM anki_flashcards";
        if (deckNameFilter != null && !deckNameFilter.isBlank()) {
            sql += " WHERE deck_name = '" + deckNameFilter.replace("'", "''") + "'";
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        StringBuilder sb = new StringBuilder();
        sb.append("#separator:Tab\n");
        sb.append("#html:true\n");
        sb.append("#tags column:3\n");

        for (Map<String, Object> r : rows) {
            String front = (String) r.get("front_or_text");
            String back = (String) r.get("back_or_extra");
            String disc = (String) r.get("disciplina");
            String ass = (String) r.get("assunto");

            front = (front != null ? front.replace("\t", " ").replace("\n", "<br>") : "");
            back = (back != null ? back.replace("\t", " ").replace("\n", "<br>") : "");
            String tags = "fiscalstudy " + slugify(disc) + " " + slugify(ass);

            sb.append(front).append("\t").append(back).append("\t").append(tags).append("\n");
        }

        return sb.toString();
    }

    public List<AnkiFlashcardDTO> getRecentFlashcards(int limit) {
        String sql = "SELECT * FROM anki_flashcards ORDER BY created_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new AnkiFlashcardDTO(
                rs.getString("id"),
                rs.getString("session_id"),
                rs.getString("concurso_id"),
                rs.getString("disciplina"),
                rs.getString("assunto"),
                rs.getString("card_type"),
                rs.getString("front_or_text"),
                rs.getString("back_or_extra"),
                rs.getString("deck_name"),
                rs.getObject("anki_note_id") != null ? rs.getLong("anki_note_id") : null,
                rs.getString("sync_status"),
                rs.getString("source_type"),
                rs.getString("source_id"),
                rs.getString("created_at"),
                rs.getString("synced_at"),
                rs.getString("error_message")
        ), limit);
    }

    private int getPendingCardsCount() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM anki_flashcards WHERE sync_status = 'PENDING_ANKI'", Integer.class
            );
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private int getSyncedCardsCount() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM anki_flashcards WHERE sync_status = 'SYNCED'", Integer.class
            );
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private String extractCoreKeyword(String text) {
        if (text == null || text.isBlank()) return "requisito essencial";
        String[] words = text.split("[\\s,;:.()]+");
        for (String w : words) {
            if (w.length() >= 7 && !w.equalsIgnoreCase("conforme") && !w.equalsIgnoreCase("segundo") && !w.equalsIgnoreCase("portanto")) {
                return w;
            }
        }
        return words.length > 0 ? words[0] : "conceito";
    }

    private String formatClozeSentence(String statement, String correctText, String keyword) {
        if (correctText != null && correctText.contains(keyword)) {
            return correctText.replaceFirst(Pattern.quote(keyword), "{{c1::" + keyword + "}}");
        }
        return "A regra que determina que " + correctText + " tem como elemento central a {{c1::" + keyword + "}}.";
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        if (text.length() <= max) return text;
        return text.substring(0, max) + "...";
    }

    private String slugify(String text) {
        if (text == null) return "geral";
        return text.toLowerCase()
                .replaceAll("[áàãâä]", "a")
                .replaceAll("[éèêë]", "e")
                .replaceAll("[íìîï]", "i")
                .replaceAll("[óòõôö]", "o")
                .replaceAll("[úùûü]", "u")
                .replaceAll("[ç]", "c")
                .replaceAll("[^a-z0-9]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
    }

    private List<Map<String, String>> getHighYield15Blueprints(String disciplina, String assunto) {
        List<Map<String, String>> list = new ArrayList<>();

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "CLOZE",
                "front", "【" + disciplina + " • " + assunto + "】 O atributo do ato administrativo que permite à Administração exigir o cumprimento das obrigações sem prévia autorização judicial é a {{c1::exigibilidade}}.",
                "back", "A exigibilidade atua por meios indiretos de coação (ex: aplicação de multa). Já a autoexecutoriedade atua por meios diretos materiais."
        ));

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "BASIC",
                "front", "<b>[" + disciplina + " — " + assunto + "]</b><br>Quais são os 5 requisitos (elementos) indispensáveis de validade de todo ato administrativo?",
                "back", "Mnemônico <b>COM-FI-FOR-M-OB</b>:<br>1. <b>Competência</b> (sempre vinculado)<br>2. <b>Finalidade</b> (sempre vinculado)<br>3. <b>Forma</b> (regra: vinculado)<br>4. <b>Motivo</b> (pode ser discricionário)<br>5. <b>Objeto</b> (pode ser discricionário)"
        ));

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "CLOZE",
                "front", "【" + disciplina + " • " + assunto + "】 A presunção de legitimidade dos atos administrativos gera a inversão do {{c1::ônus da prova}} em favor da Administração Pública.",
                "back", "O ato é presumido verdadeiro e conforme a lei até prova em contrário (presunção juris tantum)."
        ));

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "BASIC",
                "front", "<b>[" + disciplina + " — " + assunto + "]</b><br>Quais são os efeitos temporais da ANULAÇÃO vs REVOGAÇÃO de um ato administrativo?",
                "back", "• <b>Anulação (ilegalidade):</b> Efeitos <i>ex tunc</i> (retroativos, apagam todos os efeitos desde a origem).<br>• <b>Revogação (conveniência e oportunidade):</b> Efeitos <i>ex nunc</i> (prospectivos, preservam os efeitos passados)."
        ));

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "CLOZE",
                "front", "【" + disciplina + " • " + assunto + "】 São convalidáveis apenas os vícios sanáveis relativos à {{c1::competência em razão da pessoa ou matéria comum}} e à {{c1::forma não essencial}}.",
                "back", "Vícios de finalidade, motivo e objeto ilícito são insanáveis e acarretam nulidade absoluta."
        ));

        list.add(Map.of(
                "disciplina", "Direito Tributário", "assunto", "Obrigação Tributária", "type", "CLOZE",
                "front", "【Direito Tributário • Fato Gerador】 A obrigação tributária principal surge com a ocorrência do fato gerador e tem por objeto o pagamento de {{c1::tributo ou penalidade pecuniária}}.",
                "back", "A obrigação acessória tem por objeto prestações positivas ou negativas no interesse da arrecadação ou fiscalização."
        ));

        list.add(Map.of(
                "disciplina", "Direito Tributário", "assunto", "Lançamento Tributário", "type", "BASIC",
                "front", "<b>[Direito Tributário — Lançamento]</b><br>Quais são as três modalidades de lançamento tributário previstas no CTN (arts. 147 a 150)?",
                "back", "1. <b>De Ofício / Direto:</b> Realizado integralmente pelo Fisco (ex: IPTU, IPVA).<br>2. <b>Por Declaração / Misto:</b> Contribuinte fornece dados e Fisco calcula (ex: ITBI em alguns municípios).<br>3. <b>Por Homologação / Auto-lançamento:</b> Contribuinte calcula e antecipa o pagamento sem prévio exame (ex: ICMS, ISSQN)."
        ));

        list.add(Map.of(
                "disciplina", "Direito Constitucional", "assunto", "Controle de Constitucionalidade", "type", "CLOZE",
                "front", "【Direito Constitucional】 A decisão definitiva de mérito proferida pelo STF nas ações do controle concentrado de constitucionalidade possui eficácia contra todos (erga omnes) e efeito {{c1::vinculante}} relativamente aos demais órgãos do Poder Judiciário e à Administração Pública.",
                "back", "Art. 102, § 2º da CF/88. O Poder Legislativo em sua função típica de legislar não é vinculado."
        ));

        list.add(Map.of(
                "disciplina", "Direito Constitucional", "assunto", "Direitos Fundamentais", "type", "BASIC",
                "front", "<b>[Direito Constitucional — Remédios Constitucionais]</b><br>Qual é a diferença entre Mandado de Segurança e Habeas Data quanto ao direito líquido e certo?",
                "back", "• <b>Habeas Data:</b> Destinado exclusivamente a assegurar o conhecimento/retificação de informações relativas à pessoa do impetrante em registros públicos.<br>• <b>Mandado de Segurança:</b> Remédio residual para proteger direito líquido e certo não amparado por Habeas Corpus nem Habeas Data."
        ));

        list.add(Map.of(
                "disciplina", "Auditoria", "assunto", "Evidências e Procedimentos", "type", "CLOZE",
                "front", "【Auditoria Governamental】 O procedimento de auditoria que consiste na obtenção de declaração formal e independente de terceiros estranhos à entidade auditada é denominado {{c1::circularização ou confirmação externa}}.",
                "back", "Pode ser positiva (exige resposta em qualquer caso) ou negativa (exige resposta apenas se houver discordância)."
        ));

        list.add(Map.of(
                "disciplina", "Contabilidade Geral", "assunto", "DRE e Apuração do Resultado", "type", "BASIC",
                "front", "<b>[Contabilidade Geral — Regime Contábil]</b><br>O que preceitua o Princípio da Competência quanto às receitas e despesas?",
                "back", "As receitas e as despesas devem ser incluídas na apuração do resultado do período em que ocorrerem, <b>independentemente do efetivo recebimento ou pagamento</b>."
        ));

        list.add(Map.of(
                "disciplina", "Legislação Tributária Municipal", "assunto", "ISSQN", "type", "CLOZE",
                "front", "【Legislação Municipal • ISSQN】 A alíquota máxima do ISSQN fixada pela Lei Complementar 116/2003 é de {{c1::5%}}, enquanto a alíquota mínima constitucional é de {{c1::2%}}.",
                "back", "A alíquota mínima de 2% visa combater a guerra fiscal entre municípios."
        ));

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "BASIC",
                "front", "<b>[" + disciplina + " — " + assunto + "]</b><br>O que é a Teoria dos Motivos Determinantes no Direito Administrativo?",
                "back", "A validade do ato administrativo fica vinculada aos motivos indicados pela autoridade como justificativa para sua edição. Se os motivos forem inexistentes ou falsos, o ato é nulo, mesmo que originalmente fosse discricionário."
        ));

        list.add(Map.of(
                "disciplina", "Direito Tributário", "assunto", "Crédito Tributário", "type", "CLOZE",
                "front", "【Direito Tributário • Suspensão vs Extinção】 A concessão de medida liminar em mandado de segurança {{c1::suspende a exigibilidade}} do crédito tributário, enquanto o pagamento e a compensação {{c1::extinguem}} o crédito tributário.",
                "back", "Art. 151 (suspensão) vs Art. 156 (extinção) do Código Tributário Nacional."
        ));

        list.add(Map.of(
                "disciplina", disciplina, "assunto", assunto, "type", "CLOZE",
                "front", "【" + disciplina + " • " + assunto + "】 A revogação do ato administrativo incide exclusivamente sobre atos {{c1::válidos e discricionários}}, tendo fundamento no juízo de conveniência e oportunidade.",
                "back", "Atos vinculados, atos consumados, atos que geraram direitos adquiridos e meros atos administrativos não admitem revogação."
        ));

        return list;
    }
}
