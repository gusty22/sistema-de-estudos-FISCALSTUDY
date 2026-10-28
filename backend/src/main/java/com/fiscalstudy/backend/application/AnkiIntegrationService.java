package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
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

import org.springframework.scheduling.annotation.Scheduled;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
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

    @Value("${fiscalstudy.anki.network-allowed:true}")
    private boolean networkAllowed = true;

    private final AtomicBoolean autoSyncEnabled = new AtomicBoolean(false);
    private final AtomicReference<String> lastSyncAt = new AtomicReference<>(null);
    private final AtomicInteger lastSyncCount = new AtomicInteger(0);

    // Cache dinâmico de modelos e campos do Anki Desktop (compatibilidade total PT-BR e EN)
    private volatile String detectedBasicModel = "Basic";
    private volatile String detectedBasicFrontField = "Front";
    private volatile String detectedBasicBackField = "Back";

    private volatile String detectedClozeModel = "Cloze";
    private volatile String detectedClozeTextField = "Text";
    private volatile String detectedClozeExtraField = "Back Extra";

    private volatile long lastModelCheckTime = 0;

    public Map<String,Object> getIntegrationPreferences() {
        Map<String,Object> defaults=new LinkedHashMap<>();
        defaults.put("enabled",false);defaults.put("autoSyncEnabled",false);defaults.put("cloudSyncEnabled",false);
        List<String> values=jdbcTemplate.queryForList("SELECT setting_value FROM system_settings WHERE setting_key = ?",String.class,"ankiIntegration");
        if(!values.isEmpty()) try { defaults.putAll(objectMapper.readValue(values.get(0),new TypeReference<Map<String,Object>>(){})); }
        catch(Exception e){throw new IllegalStateException("Invalid persisted Anki consent",e);}
        return defaults;
    }
    public Map<String,Object> updateIntegrationPreferences(Map<String,Object> requested) {
        Map<String,Object> prefs=getIntegrationPreferences();
        for(String key:List.of("enabled","autoSyncEnabled","cloudSyncEnabled")) if(requested.containsKey(key)) {
            if(!(requested.get(key) instanceof Boolean)) throw new IllegalArgumentException(key+" must be boolean");
            prefs.put(key,requested.get(key));
        }
        try { jdbcTemplate.update("INSERT INTO system_settings(setting_key,setting_value,updated_at) VALUES(?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at", "ankiIntegration",objectMapper.writeValueAsString(prefs),java.time.Instant.now().toString()); }
        catch(Exception e){throw new IllegalStateException("Unable to persist Anki consent",e);}
        return prefs;
    }
    private boolean integrationEnabled(){return networkAllowed && Boolean.TRUE.equals(getIntegrationPreferences().get("enabled"));}
    private boolean cloudAllowed(){
        if(!integrationEnabled() || !Boolean.TRUE.equals(getIntegrationPreferences().get("cloudSyncEnabled")))return false;
        List<String> values=jdbcTemplate.queryForList("SELECT setting_value FROM system_settings WHERE setting_key=?",String.class,"privacidade");
        if(values.isEmpty())return false; // strict local is the default
        try{return !objectMapper.readTree(values.get(0)).path("armazenamentoLocalEstrito").asBoolean(true);}
        catch(Exception e){throw new IllegalStateException("Invalid privacy settings",e);}
    }

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
     * Atualiza metadados de modelos e campos do Anki Desktop (compatibilidade pt-BR e en-US)
     */
    public synchronized void refreshAnkiModelMetadata() {
        if (!integrationEnabled()) return;
        long now = System.currentTimeMillis();
        if (now - lastModelCheckTime < 60_000 && lastModelCheckTime > 0) {
            return;
        }

        try {
            Map<String, Object> req = Map.of("action", "modelNames", "version", 6);
            String jsonBody = objectMapper.writeValueAsString(req);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ankiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(2000))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                if (root.path("result").isArray()) {
                    List<String> models = new ArrayList<>();
                    for (JsonNode m : root.path("result")) {
                        models.add(m.asText());
                    }

                    // 1. Resolução do modelo Básico / Basic
                    String basicModelCandidate = null;
                    if (models.contains("Básico")) {
                        basicModelCandidate = "Básico";
                    } else if (models.contains("Basic")) {
                        basicModelCandidate = "Basic";
                    } else {
                        for (String m : models) {
                            if (m.toLowerCase().contains("básic") || m.toLowerCase().contains("basic")) {
                                basicModelCandidate = m;
                                break;
                            }
                        }
                    }

                    if (basicModelCandidate != null) {
                        detectedBasicModel = basicModelCandidate;
                        List<String> fields = fetchModelFields(basicModelCandidate);
                        if (fields.size() >= 2) {
                            detectedBasicFrontField = fields.get(0);
                            detectedBasicBackField = fields.get(1);
                        }
                    }

                    // 2. Resolução do modelo Cloze / Omissão de Palavras
                    String clozeModelCandidate = null;
                    if (models.contains("Cloze")) {
                        clozeModelCandidate = "Cloze";
                    } else if (models.contains("Omissão de Palavras") || models.contains("Omissão de palavras")) {
                        clozeModelCandidate = models.contains("Omissão de Palavras") ? "Omissão de Palavras" : "Omissão de palavras";
                    } else {
                        for (String m : models) {
                            if (m.toLowerCase().contains("cloze") || m.toLowerCase().contains("omissão")) {
                                clozeModelCandidate = m;
                                break;
                            }
                        }
                    }

                    if (clozeModelCandidate != null) {
                        detectedClozeModel = clozeModelCandidate;
                        List<String> fields = fetchModelFields(clozeModelCandidate);
                        if (fields.size() >= 1) {
                            detectedClozeTextField = fields.get(0);
                            detectedClozeExtraField = fields.size() >= 2 ? fields.get(1) : "Extra";
                        }
                    }

                    lastModelCheckTime = now;
                    log.info("Modelos Anki detectados: Basic=[{} (Front='{}', Back='{}')], Cloze=[{} (Text='{}', Extra='{}')]",
                            detectedBasicModel, detectedBasicFrontField, detectedBasicBackField,
                            detectedClozeModel, detectedClozeTextField, detectedClozeExtraField);
                }
            }
        } catch (Exception e) {
            log.debug("AnkiConnect offline ou indisponível ao consultar modelos: {}", e.getMessage());
        }
    }

    private List<String> fetchModelFields(String modelName) {
        if (!integrationEnabled()) return Collections.emptyList();
        try {
            Map<String, Object> req = Map.of(
                    "action", "modelFieldNames",
                    "version", 6,
                    "params", Map.of("modelName", modelName)
            );
            String jsonBody = objectMapper.writeValueAsString(req);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ankiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(2000))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                if (root.path("result").isArray()) {
                    List<String> list = new ArrayList<>();
                    for (JsonNode f : root.path("result")) {
                        list.add(f.asText());
                    }
                    return list;
                }
            }
        } catch (Exception ignored) {}
        return Collections.emptyList();
    }

    /**
     * Verifica se o plugin AnkiConnect está ativo na porta 8765
     */
    public AnkiConnectStatusDTO checkConnection() {
        if (!integrationEnabled()) return new AnkiConnectStatusDTO(false,0,ankiEndpoint,getSyncedCardsCount(),getPendingCardsCount(),"Integração Anki desativada. Nenhuma conexão externa realizada.",false,lastSyncAt.get(),null);
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

                // Atualiza metadados dos modelos em segundo plano se necessário
                refreshAnkiModelMetadata();

                String modelInfo = String.format("Basic: %s (%s/%s), Cloze: %s (%s/%s)",
                        detectedBasicModel, detectedBasicFrontField, detectedBasicBackField,
                        detectedClozeModel, detectedClozeTextField, detectedClozeExtraField);

                return new AnkiConnectStatusDTO(
                        true,
                        version,
                        ankiEndpoint,
                        synced,
                        pending,
                        "🟢 Anki Desktop Conectado (Porta 8765). Sincronização automática ativa.",
                        isAutoSyncEnabled(),
                        lastSyncAt.get(),
                        modelInfo
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
                "🟡 Anki não detectado na porta 8765. Os flashcards gerados automaticamente serão mantidos na fila local e enviados assim que você abrir o Anki Desktop.",
                isAutoSyncEnabled(),
                lastSyncAt.get(),
                null
        );
    }

    /**
     * Dispara sincronização imediata do Anki Desktop com a nuvem AnkiWeb
     */
    public boolean triggerAnkiWebSync() {
        if (!cloudAllowed()) return false;
        try {
            Map<String, Object> req = Map.of(
                    "action", "sync",
                    "version", 6
            );
            String jsonBody = objectMapper.writeValueAsString(req);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ankiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(5000))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("Não foi possível acionar sync no AnkiWeb: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Garante a criação do Deck no Anki (ex: FiscalStudy::Direito Administrativo)
     */
    public boolean ensureDeckExists(String deckName) {
        if (!integrationEnabled()) return false;
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
     * Envia um Flashcard direto para o Anki via AnkiConnect com tolerância a múltiplos idiomas
     */
    public Long sendNoteToAnkiConnect(String deckName, String cardType, String frontOrText, String backOrExtra, List<String> tags) {
        if (!integrationEnabled()) return null;
        try {
            ensureDeckExists(deckName);
            refreshAnkiModelMetadata();

            Map<String, Object> noteMap = new HashMap<>();
            noteMap.put("deckName", deckName);
            noteMap.put("tags", tags != null ? tags : List.of("fiscalstudy"));

            Map<String, Object> options = Map.of(
                    "allowDuplicate", false,
                    "duplicateScope", "deck"
            );
            noteMap.put("options", options);

            if ("CLOZE".equalsIgnoreCase(cardType)) {
                noteMap.put("modelName", detectedClozeModel);
                noteMap.put("fields", Map.of(
                        detectedClozeTextField, frontOrText,
                        detectedClozeExtraField, backOrExtra != null ? backOrExtra : ""
                ));
            } else {
                noteMap.put("modelName", detectedBasicModel);
                noteMap.put("fields", Map.of(
                        detectedBasicFrontField, frontOrText,
                        detectedBasicBackField, backOrExtra != null ? backOrExtra : ""
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
                    .timeout(Duration.ofMillis(3000))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                if (!root.path("error").isNull()) {
                    String err = root.path("error").asText();
                    log.warn("Erro retornado pelo AnkiConnect: {}", err);
                    if (err.toLowerCase().contains("model was not found") || err.toLowerCase().contains("cannot create note because it is empty")) {
                        return tryFallbackModel(deckName, cardType, frontOrText, backOrExtra, tags);
                    }
                    return null;
                }
                return root.path("result").asLong();
            }
        } catch (Exception e) {
            log.debug("AnkiConnect indisponível ao enviar card: {}", e.getMessage());
        }
        return null;
    }

    private Long tryFallbackModel(String deckName, String cardType, String frontOrText, String backOrExtra, List<String> tags) {
        try {
            Map<String, Object> noteMap = new HashMap<>();
            noteMap.put("deckName", deckName);
            noteMap.put("tags", tags != null ? tags : List.of("fiscalstudy"));
            noteMap.put("options", Map.of("allowDuplicate", false, "duplicateScope", "deck"));

            if ("CLOZE".equalsIgnoreCase(cardType)) {
                // Alterna entre Cloze padrão e Omissão de palavras com nomes comuns
                boolean isEnglish = "Cloze".equalsIgnoreCase(detectedClozeModel);
                String altModel = isEnglish ? "Omissão de Palavras" : "Cloze";
                Map<String, String> altFields = isEnglish
                        ? Map.of("Texto", frontOrText, "Extra", backOrExtra != null ? backOrExtra : "")
                        : Map.of("Text", frontOrText, "Back Extra", backOrExtra != null ? backOrExtra : "");

                noteMap.put("modelName", altModel);
                noteMap.put("fields", altFields);
            } else {
                // Alterna entre Basic e Básico
                boolean isEnglish = "Basic".equalsIgnoreCase(detectedBasicModel);
                String altModel = isEnglish ? "Básico" : "Basic";
                Map<String, String> altFields = isEnglish
                        ? Map.of("Frente", frontOrText, "Verso", backOrExtra != null ? backOrExtra : "")
                        : Map.of("Front", frontOrText, "Back", backOrExtra != null ? backOrExtra : "");

                noteMap.put("modelName", altModel);
                noteMap.put("fields", altFields);
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
                    .timeout(Duration.ofMillis(3000))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                if (root.path("error").isNull()) {
                    return root.path("result").asLong();
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    /**
     * Salva o Flashcard no SQLite e envia silenciosamente ao AnkiConnect
     */
    public AnkiFlashcardDTO saveAndPushCard(String sessionId, String concursoId, String disciplina, String assunto,
                                          String cardType, String frontOrText, String backOrExtra,
                                          String sourceType, String sourceId) {
        QuestionAccessPolicy.requireAvailable(jdbcTemplate,sourceId);
        String cardId = "anki-" + UUID.randomUUID().toString().substring(0, 8);
        String deckName = "FiscalStudy::" + (disciplina != null && !disciplina.isBlank() ? disciplina.trim() : "Geral");
        String nowStr = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        List<String> tags = new ArrayList<>(List.of("fiscalstudy", "automatizado"));
        if (disciplina != null) tags.add(slugify(disciplina));
        if (assunto != null) tags.add(slugify(assunto));
        if ("CLOZE".equalsIgnoreCase(cardType)) tags.add("cloze");

        // Tenta envio silencioso via AnkiConnect
        Long ankiNoteId = null; // Save locally first. Explicit queue sync performs network writes.
        String syncStatus = (ankiNoteId != null) ? "SYNCED" : "PENDING_ANKI";
        String syncedAt = (ankiNoteId != null) ? nowStr : null;

        String sql = "INSERT INTO anki_flashcards (id, session_id, concurso_id, disciplina, assunto, card_type, " +
                "front_or_text, back_or_extra, deck_name, anki_note_id, sync_status, source_type, source_id, created_at, synced_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql, cardId, sessionId, concursoId, disciplina, assunto, cardType,
                frontOrText, backOrExtra, deckName, ankiNoteId, syncStatus, sourceType, sourceId, nowStr, syncedAt);

        // Registra evento no event_store imutável
        String eventType = (ankiNoteId != null) ? "FLASHCARD_SENT_TO_ANKI" : "FLASHCARD_QUEUED_FOR_ANKI";
        Map<String,Object> eventDetails=new LinkedHashMap<>();
        eventDetails.put("cardId",cardId);eventDetails.put("deckName",deckName);eventDetails.put("cardType",cardType);
        eventDetails.put("syncStatus",syncStatus);eventDetails.put("ankiNoteId",ankiNoteId);eventDetails.put("disciplina",disciplina);eventDetails.put("assunto",assunto);
        String payloadJson;
        try{payloadJson=objectMapper.writeValueAsString(eventDetails);}catch(Exception e){throw new IllegalStateException("Unable to serialize flashcard event",e);}


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
    /**
     * TRAVA 1: Bloqueio de Tópicos Não-Memorizáveis (Blacklist)
     * Impede categoricamente a poluição do Anki com interpretação de texto, reescrita de crônica,
     * redação e resolução de cálculos extensos.
     */
    public boolean isEligibleForAnki(String disciplina, String assunto, String statement) {
        String combined = ((disciplina != null ? disciplina : "") + " " +
                (assunto != null ? assunto : "") + " " +
                (statement != null ? statement : "")).toLowerCase();

        // 1. Blacklist Estrita de Tópicos de Habilidade Pura / Interpretação
        List<String> blacklist = List.of(
                "interpretação de texto", "interpretacao de texto", "compreensão de texto", "compreensao de texto",
                "interpretação", "interpretacao", "tipologia textual", "gêneros textuais", "generos textuais",
                "crônica", "cronica", "charge", "poema", "poesia", "sentidos do texto", "coesão e coerência",
                "coesao e coerencia", "reescrita de frases", "reordenação de frases", "redação oficial",
                "redacao oficial", "texto narrativo", "texto dissertativo", "figuras de linguagem",
                "compreensão e interpretação"
        );

        for (String b : blacklist) {
            if (combined.contains(b)) {
                return false;
            }
        }

        // 2. Se o enunciado for puramente uma pergunta de interpretação sobre um texto específico
        if (statement != null) {
            String stmtLow = statement.toLowerCase();
            if ((stmtLow.contains("segundo o texto") || stmtLow.contains("de acordo com o texto") ||
                    stmtLow.contains("o autor defende") || stmtLow.contains("infere-se do texto") ||
                    stmtLow.contains("no segundo parágrafo") || stmtLow.contains("no 2º parágrafo") ||
                    stmtLow.contains("no primeiro parágrafo") || stmtLow.contains("o sentido original do texto") ||
                    stmtLow.contains("mantidos os sentidos do") || stmtLow.contains("a expressão destacada no texto")) &&
                    (disciplina == null || disciplina.toLowerCase().contains("portugu") || disciplina.toLowerCase().contains("língua"))) {
                return false;
            }
        }

        return true;
    }

    /**
     * MOTOR DE GERAÇÃO: Gera Flashcard Silencioso a partir de Questão Errada
     * Aplica Trava 1 (Blacklist), Trava 2 (Gatilho real) e Trava 3 (Regra de Ouro em vez de cópia literal).
     */
    public AnkiFlashcardDTO generateFromQuestionError(Question question, String chosenOption, String causaErro, String sessionId) {
        String disciplina = question.getDiscipline() != null ? question.getDiscipline() : "Direito";
        String assunto = question.getTopic() != null ? question.getTopic() : "Geral";
        String statement = question.getStatement() != null ? question.getStatement().trim() : "";
        String correctOpt = question.getCorrectOption() != null ? question.getCorrectOption().trim() : "A";

        // Trava 1: Se o assunto pertencer à blacklist de habilidades/interpretação, descarta do Anki
        if (!isEligibleForAnki(disciplina, assunto, statement)) {
            log.info("Questão {} ignorada para o Anki: tópico não-memorizável ou interpretação de texto [{}] - [{}]",
                    question.getId(), disciplina, assunto);
            return null;
        }

        // Localiza texto da alternativa correta e da escolhida
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

        // Trava 3: Síntese da Regra de Ouro (Princípio e distinção cobrada)
        String frontOrText;
        String backOrExtra;
        String cardType;

        // Se for CPC / Contabilidade
        if (disciplina.toLowerCase().contains("contab") || assunto.toLowerCase().contains("cpc")) {
            cardType = "BASIC";
            frontOrText = String.format("<b>[%s • %s]</b><br>Em relação à regra contábil testada na questão:<br><i>\"%s\"</i><br><br><b>Qual é a regra e o tratamento técnico correto?</b>",
                    disciplina, assunto, truncate(cleanStatementContext(statement), 160));
            backOrExtra = String.format("<b>Regra Técnica (Gabarito: Alt. %s):</b><br>%s<br><br><small style='color: #ef4444;'>Pegadinha evitada: Você marcou a Alt. %s ('%s').</small>",
                    correctOpt, correctText.isBlank() ? "Consulte a norma contábil aplicável." : correctText,
                    chosenOption, truncate(chosenText, 70));
        } else if (statement.length() <= 200 && correctText.length() <= 100 && !correctText.isBlank()) {
            // Regra concisa para omissão focada na regra de ouro
            cardType = "CLOZE";
            String keyword = extractCoreKeyword(correctText);
            String sentence = formatClozeSentence(statement, correctText, keyword);
            frontOrText = String.format("[%s — %s] %s", disciplina, assunto, sentence);
            backOrExtra = String.format(
                    "<b>Gabarito Oficial:</b> Alternativa %s.<br><b>Atenção:</b> A alternativa %s ('%s') era incorreta.",
                    correctOpt, chosenOption, truncate(chosenText, 60)
            );
        } else {
            cardType = "BASIC";
            frontOrText = String.format(
                    "<b>[%s — %s]</b><br>Regra normativa / distinção cobrada:<br><i>\"%s\"</i><br><br><b>Qual é a regra de ouro aplicável segundo a banca?</b>",
                    disciplina, assunto, truncate(cleanStatementContext(statement), 180)
            );
            backOrExtra = String.format(
                    "<b>Regra de Ouro (Alt. %s):</b><br>%s<br><br><small style='color: #ef4444;'>Você marcou a Alt. %s ('%s'), que estava incorreta.</small>",
                    correctOpt, correctText.isBlank() ? "Consulte os dispositivos normativos deste tópico." : correctText,
                    chosenOption, truncate(chosenText, 70)
            );
        }

        log.info("Flashcard de ouro gerado para o Anki a partir do erro na questão {}: [{}]", question.getId(), cardType);
        return saveAndPushCard(sessionId, null, disciplina, assunto, cardType, frontOrText, backOrExtra, "QUESTION_ERROR", question.getId());
    }

    private String cleanStatementContext(String stmt) {
        if (stmt == null) return "";
        // Remove trechos introdutórios longos de enunciados
        return stmt.replaceAll("(?i)^(Considere que|Acerca de|No que concerne a|A respeito de|Julgue o item a seguir|Com base no texto)\\s*", "").trim();
    }

    /**
     * MOTOR DE GERAÇÃO: Gera Flashcard a partir de Parágrafo/Trecho de PDF
     */
    public AnkiFlashcardDTO generateFromPdfParagraph(String textParagraph, String disciplina, String assunto, String sessionId) {
        if (textParagraph == null || textParagraph.isBlank()) {
            throw new IllegalArgumentException("O parágrafo do PDF não pode estar vazio.");
        }

        String disc = (disciplina != null && !disciplina.isBlank()) ? disciplina : "Geral";
        String ass = (assunto != null && !assunto.isBlank()) ? assunto : "Conceitos Fundamentais";

        String cleanText = textParagraph.trim().replaceAll("\\s+", " ");
        String keyword = extractCoreKeyword(cleanText);

        // Gera cartão Cloze
        String clozeText = cleanText.replaceFirst("(?i)" + Pattern.quote(keyword), "{{c1::" + keyword + "}}");
        if (!clozeText.contains("{{c1::")) {
            clozeText = "{{c1::" + truncate(cleanText, 50) + "}} " + cleanText.substring(Math.min(cleanText.length(), 50));
        }

        String front = String.format("[%s — %s] %s", disc, ass, clozeText);
        String backExtra = "<b>Fonte:</b> PDF da sessão de estudos • Regra essencial para revisão ativa amanhã.";

        return saveAndPushCard(sessionId, null, disc, ass, "CLOZE", front, backExtra, "PDF_PARAGRAPH", null);
    }

    /**
     * MOTOR DE GERAÇÃO: Gera o Lote de 15 Flashcards Essenciais da Sessão
     * Restrição Rígida: Flashcards só são gerados a partir do que o aluno REALMENTE VIU E ESTUDOU.
     * Nunca injeta assuntos ou disciplinas não vistas.
     */
    public List<AnkiFlashcardDTO> generateSessionBatch15(String concursoId, String sessionId) {
        List<AnkiFlashcardDTO> generatedCards = new ArrayList<>();

        // 1. Busca questões que o estudante REALMENTE resolveu nesta sessão
        List<Map<String, Object>> resolvedQuestions = jdbcTemplate.queryForList(
                "SELECT DISTINCT q.id, q.enunciado, q.options_json, q.correct_option, q.disciplina, q.assunto, e.payload_json " +
                "FROM study_questions q " +
                "INNER JOIN event_store e ON e.aggregate_id = q.id " +
                "WHERE e.event_type = 'ANSWER_SUBMITTED' AND json_extract(e.payload_json, '$.origin') = 'REAL_STUDY' " +
                (sessionId != null && !sessionId.isBlank() ? "AND e.session_id = ? " : "") +
                "ORDER BY e.recorded_at DESC LIMIT 15",
                (sessionId != null && !sessionId.isBlank() ? new Object[]{sessionId} : new Object[]{})
        );

        // 2. Se a sessão atual ainda tiver poucas questões, busca as questões resolvidas recentemente pelo aluno
        if (resolvedQuestions.isEmpty()) {
            resolvedQuestions = jdbcTemplate.queryForList(
                    "SELECT DISTINCT q.id, q.enunciado, q.options_json, q.correct_option, q.disciplina, q.assunto, e.payload_json " +
                    "FROM study_questions q " +
                    "INNER JOIN event_store e ON e.aggregate_id = q.id " +
                    "WHERE e.event_type = 'ANSWER_SUBMITTED' " +
                    "ORDER BY e.recorded_at DESC LIMIT 15"
            );
        }

        // 3. Gera os flashcards baseados ESTRITAMENTE nas questões e matérias vistas
        for (int i = 0; i < resolvedQuestions.size(); i++) {
            Map<String, Object> row = resolvedQuestions.get(i);
            String qId = (String) row.get("id");
            String enunciado = (String) row.get("enunciado");
            String optionsJson = (String) row.get("options_json");
            String correctOpt = (String) row.get("correct_option");
            String disc = (String) row.get("disciplina");
            String ass = (String) row.get("assunto");
            String payloadJson = (String) row.get("payload_json");

            if (disc == null || disc.isBlank()) disc = "Geral";
            if (ass == null || ass.isBlank()) ass = "Conceitos";

            List<String> options = new ArrayList<>();
            try {
                if (optionsJson != null) {
                    options = objectMapper.readValue(optionsJson, new TypeReference<List<String>>(){});
                }
            } catch (Exception ignored) {}

            String chosenOpt = "A";
            boolean isCorrect = true;
            try {
                if (payloadJson != null) {
                    JsonNode node = objectMapper.readTree(payloadJson);
                    chosenOpt = node.path("selectedOption").asText("A");
                    isCorrect = node.path("isCorrect").asBoolean(true);
                }
            } catch (Exception ignored) {}

            String correctText = "";
            for (String opt : options) {
                if (opt != null && correctOpt != null && opt.toUpperCase().startsWith(correctOpt.toUpperCase())) {
                    correctText = opt.substring(Math.min(opt.length(), 2)).trim();
                    break;
                }
            }

            String cardType = (i % 2 == 0) ? "CLOZE" : "BASIC";
            String front;
            String back;

            if ("CLOZE".equals(cardType) && !correctText.isBlank()) {
                String keyword = extractCoreKeyword(correctText);
                String sentence = formatClozeSentence(enunciado, correctText, keyword);
                front = String.format("[%s — %s] %s", disc, ass, sentence);
                back = String.format("<b>Gabarito Oficial:</b> Alternativa %s (%s).<br><small>Fonte: Questão resolvida em sessão.</small>",
                        correctOpt, correctText);
            } else {
                front = String.format("<b>[%s — %s]</b><br>Regra testada na questão:<br><i>\"%s\"</i><br><br><b>Qual o entendimento correto e gabarito?</b>",
                        disc, ass, truncate(enunciado, 180));
                back = String.format("<b>Alternativa Correta (%s):</b><br>%s<br><br><small>Questão resolvida na sua preparação.</small>",
                        correctOpt, correctText.isBlank() ? "Verifique a fundamentação teórica deste tópico." : correctText);
            }

            AnkiFlashcardDTO card = saveAndPushCard(
                    sessionId, concursoId, disc, ass, cardType, front, back, "QUESTION_RESOLVED", qId
            );
            generatedCards.add(card);
        }

        log.info("Lote de flashcards gerado com base estrita no material estudado. Total: {}", generatedCards.size());
        return generatedCards;
    }

    /**
     * Sincroniza a fila de cards pendentes com o AnkiConnect
     */
    public synchronized int syncPendingQueue() {
        if (!integrationEnabled()) throw new IllegalStateException("Anki integration is disabled");
        List<Map<String, Object>> pendingRows = jdbcTemplate.queryForList(
                "SELECT id, disciplina, assunto, card_type, front_or_text, back_or_extra, deck_name FROM study_anki_flashcards WHERE sync_status = 'PENDING_ANKI'"
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

                try {
                    eventStoreRepository.appendEvent(
                            "FLASHCARD_SENT_TO_ANKI",
                            "FLASHCARD",
                            id,
                            "sync-engine",
                            1,
                            "v1",
                            objectMapper.writeValueAsString(Map.of("cardId",id,"ankiNoteId",noteId,"deckName",deckName))
                    );
                } catch (Exception ignored) {}

                count++;
            }
        }

        if (count > 0) {
            String formattedNow = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
            lastSyncAt.set(formattedNow);
            lastSyncCount.set(count);
            // Sincroniza imediatamente com a nuvem do AnkiWeb
            triggerAnkiWebSync();
            log.info("Sincronização concluída: {} flashcards enviados para o Anki Desktop e AnkiWeb acionado.", count);
        }

        return count;
    }

    /**
     * DAEMON DE AUTO-SYNC: Executa periodicamente em segundo plano.
     * Se houver flashcards gerados automaticamente na fila e o Anki Desktop estiver aberto,
     * sincroniza silenciosamente sem intervenção manual.
     */
    @Scheduled(fixedDelayString = "${fiscalstudy.anki.auto-sync.interval-ms:25000}")
    public void runAutoSyncScheduled() {
        if (!integrationEnabled() || !isAutoSyncEnabled()) {
            return;
        }

        int pending = getPendingCardsCount();
        if (pending == 0) {
            return;
        }

        try {
            AnkiConnectStatusDTO status = checkConnection();
            if (status.isConnected()) {
                log.info("Auto-sync Anki em background detectou {} flashcards pendentes. Iniciando injeção...", pending);
                int synced = syncPendingQueue();
                if (synced > 0) {
                    log.info("Auto-sync concluído com sucesso: {} cards injetados no Anki Desktop.", synced);
                }
            }
        } catch (Exception e) {
            log.debug("Aviso no auto-sync do Anki: {}", e.getMessage());
        }
    }

    public boolean isAutoSyncEnabled() {
        return Boolean.TRUE.equals(getIntegrationPreferences().get("autoSyncEnabled"));
    }

    public void setAutoSyncEnabled(boolean enabled) {
        updateIntegrationPreferences(Map.of("autoSyncEnabled",enabled));
    }

    public boolean toggleAutoSync() {
        boolean next = !isAutoSyncEnabled();
        setAutoSyncEnabled(next);
        return next;
    }

    public String getLastSyncAt() {
        return lastSyncAt.get();
    }

    public int getLastSyncCount() {
        return lastSyncCount.get();
    }

    /**
     * Exporta todos os cards em formato CSV padrão do Anki
     */
    public String exportToCsv(String deckNameFilter) {
        String sql = "SELECT front_or_text, back_or_extra, card_type, disciplina, assunto FROM study_anki_flashcards";
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
        String sql = "SELECT * FROM study_anki_flashcards ORDER BY created_at DESC LIMIT ?";
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

    public int getPendingCardsCount() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM study_anki_flashcards WHERE sync_status = 'PENDING_ANKI'", Integer.class
            );
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    public int getSyncedCardsCount() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM study_anki_flashcards WHERE sync_status = 'SYNCED'", Integer.class
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
}

