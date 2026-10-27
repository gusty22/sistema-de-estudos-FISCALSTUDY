package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Experimental, append-only forecasts. Never updates FSRS or authorizes activities. */
@Service
public class ProspectivePredictionService {
    public static final String CONTRACT = "prospective-question-v1";
    public static final String MODEL = "PERSONAL_BETA11_PREFIX_V1";
    private final JdbcTemplate jdbc;
    private final EventStoreRepository events;
    private final QuestionRepository questions;
    private final AttemptSubmissionService attempts;
    private final LearningEvidenceService memory;
    private final TransactionTemplate transaction;
    private final ObjectMapper json = new ObjectMapper();
    private final Clock clock;
    private final String sourceKind;

    @org.springframework.beans.factory.annotation.Autowired
    public ProspectivePredictionService(JdbcTemplate jdbc, EventStoreRepository events,
            QuestionRepository questions, AttemptSubmissionService attempts, LearningEvidenceService memory) {
        this(jdbc, events, questions, attempts, memory, Clock.systemUTC(), "LOCAL_EVENT_STORE_UNATTESTED");
    }
    public ProspectivePredictionService(JdbcTemplate jdbc, EventStoreRepository events,
            QuestionRepository questions, AttemptSubmissionService attempts, LearningEvidenceService memory,
            Clock clock, String sourceKind) {
        this.jdbc=jdbc; this.events=events; this.questions=questions; this.attempts=attempts;
        this.memory=memory; this.clock=clock; this.sourceKind=sourceKind;
        transaction=new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource())));
    }
    private ResponseStatusException conflict(String text) { return new ResponseStatusException(HttpStatus.CONFLICT,text); }
    private static String uuid(String value) {
        try {
            if(value==null || !UUID.fromString(value).toString().equals(value)) throw new IllegalArgumentException();
            return value;
        } catch(IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Canonical attempt UUID required"); }
    }
    private JsonNode read(String value) {
        try { return json.readTree(value); }
        catch(Exception e) { throw new IllegalStateException("Invalid stored JSON",e); }
    }
    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch(Exception e) { throw new IllegalStateException("Cannot serialize prospective evidence",e); }
    }
    /** No answer, confidence, response duration or outcome is accepted by this contract. */
    public synchronized JsonNode prepare(String questionId,String sessionId,String attemptId) {
        uuid(attemptId);
        if(sessionId==null || sessionId.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Session required");
        return transaction.execute(tx -> {
            var prior=events.findByEventId("prediction:"+attemptId);
            if(prior.isPresent()) return validateIdentity(prior.get(),questionId,sessionId);
            if(events.findByEventId("attempt:"+attemptId).isPresent()) throw conflict("Cannot backfill a forecast after an answer");
            var question=questions.findById(questionId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Question missing"));
            long cutoff=events.getMaxRowid();
            Instant now=clock.instant();
            int n=0,correct=0,seen=0,excluded=0;
            var evidence=new ArrayList<String>();
            for(var event:events.getEventsUpTo("ANSWER_SUBMITTED",cutoff)) {
                JsonNode node;
                try { node=read(event.getPayloadJson()); }
                catch(IllegalStateException malformed) { excluded++; continue; }
                Instant when;
                try { when=Instant.parse(event.getOccurredAt());
                    if(Instant.parse(event.getRecordedAt()).isAfter(now)) { excluded++; continue; }
                }
                catch(Exception invalid) { excluded++; continue; }
                if(!when.isBefore(now) || !"REAL_STUDY".equals(node.path("origin").asText()) ||
                   !node.path("isCorrect").isBoolean() || !"DEFINITIVO".equals(node.path("gabaritoStatus").asText()) ||
                   !node.path("usedHelp").isBoolean() || node.path("usedHelp").booleanValue()) {
                    excluded++; continue;
                }
                n++; if(node.path("isCorrect").booleanValue()) correct++;
                if(questionId.equals(event.getAggregateId())) seen++;
                evidence.add(event.getEventId());
            }
            var data=new LinkedHashMap<String,Object>();
            data.put("contractVersion",CONTRACT);
            data.put("predictionId",UUID.nameUUIDFromBytes(("prediction:"+attemptId).getBytes(StandardCharsets.UTF_8)).toString());
            data.put("attemptId",attemptId);data.put("questionId",questionId);data.put("studentId","LOCAL_SINGLE_USER");
            data.put("sessionId",sessionId);data.put("createdAt",now.toString());data.put("dataCutoffAt",now.toString());
            data.put("snapshotRowid",cutoff);data.put("target","QUESTION_CORRECTNESS_WITHOUT_DECLARED_HELP");
            data.put("evaluationHorizon","FIRST_SUBMISSION_OF_RESERVED_ATTEMPT_IN_SESSION");
            data.put("modelVersion",MODEL);data.put("probability",(correct+1.0)/(n+2.0));
            data.put("referenceProbability",0.5);data.put("nEvidence",n);data.put("nCorrect",correct);
            data.put("excludedHistoricalEvents",excluded);data.put("evidenceEventIds",evidence);
            data.put("priorRecordedSameQuestionAttempts",seen);
            data.put("noveltyStatus",seen==0?"NO_PRIOR_ELIGIBLE_ATTEMPT_NOT_PROOF_OF_NOVELTY":"REPEATED_RECORDED_QUESTION");
            data.put("origin",attempts.resolveOrigin(null,sessionId).name());
            data.put("disciplineAtCreation",question.getDiscipline());data.put("topicLabelAtCreation",question.getTopic());
            data.put("curriculumLinksAtCreation",jdbc.queryForList("SELECT c.* FROM ("+QuestionClassificationService.CURRENT_LINKS+") c WHERE c.question_id=? AND c.status='CONFIRMED' ORDER BY c.topic_id",questionId));
            data.put("fsrsContextNotCorrectnessForecast",memory.preview(questionId));
            data.put("conditions",List.of("UNVALIDATED_BASELINE_NOT_CONCEPTUAL_MASTERY","NO_RECALL_TARGET",
                    "EXCLUDE_UNKNOWN_OR_DECLARED_HELP","CONFIDENCE_CAPTURE_TIME_UNVERIFIED",
                    "NO_FIXED_RETENTION_HORIZON","NO_CAUSAL_INTERVENTION_EFFECT"));
            data.put("validity",n==0?"PRIOR_ONLY_NO_PERSONAL_EVIDENCE":"EXPLORATORY_UNCALIBRATED_BASELINE");
            data.put("can_apply",false);data.put("can_schedule",false);
            if(!events.appendEventOnce("prediction:"+attemptId,"PREDICTION_COMMITTED","QUESTION",questionId,sessionId,now.toString(),write(data)))
                return validateIdentity(events.findByEventId("prediction:"+attemptId).orElseThrow(),questionId,sessionId);
            return read(write(data));
        });
    }
    private JsonNode validateIdentity(EventRecord event,String question,String session) {
        if(!"PREDICTION_COMMITTED".equals(event.getEventType()) ||
           !question.equals(event.getAggregateId()) || !session.equals(event.getSessionId()))
            throw conflict("Forecast identity conflict");
        var node=read(event.getPayloadJson());
        if(!CONTRACT.equals(node.path("contractVersion").asText())) throw conflict("Unsupported forecast contract");
        return node;
    }
    /** Sidecar export preserves complete raw event payloads without widening the operational CSV. */
    public Map<String,Object> exportSnapshot() {
        return transaction.execute(tx -> {
            long cutoff=events.getMaxRowid();
            var rows=jdbc.queryForList("SELECT rowid AS snapshot_rowid,event_id,event_type,aggregate_id,session_id,occurred_at,recorded_at,payload_json FROM event_store WHERE rowid<=? AND event_type IN ('PREDICTION_COMMITTED','ANSWER_SUBMITTED','ATTEMPT_ANNOTATED') ORDER BY rowid",cutoff);
            var input=new LinkedHashMap<String,Object>();
            input.put("contractVersion",CONTRACT);input.put("snapshotRowid",cutoff);input.put("sourceKind",sourceKind);
            input.put("studentId","LOCAL_SINGLE_USER");input.put("events",rows);
            String content=write(input);
            return Map.<String,Object>of("contractVersion",CONTRACT,"inputJson",content,"inputSha256",sha(content),
                    "snapshotRowid",cutoff,"can_apply",false,"can_schedule",false);
        });
    }
    private static String sha(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
}
