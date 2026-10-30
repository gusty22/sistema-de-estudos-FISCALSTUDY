package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Trusted host producer. SELECTs only; no client-supplied evidence, inventory or authority. */
@Service
public class LearningShadowSnapshotService {
    private final JdbcTemplate jdbc;
    private final EditalRepository editais;
    private final QuestionRepository questions;
    private final EventStoreRepository events;
    private final ObjectMapper mapper;
    private final LearningEvidenceService memoryAuthority;
    private final String sourceId;
    private final boolean fixtureInstallation;
    private final Clock clock;
    @org.springframework.beans.factory.annotation.Autowired
    public LearningShadowSnapshotService(JdbcTemplate jdbc, EditalRepository editais,
            QuestionRepository questions, EventStoreRepository events, ObjectMapper mapper, LearningEvidenceService memoryAuthority,
            @Value("${fiscalstudy.learning-shadow.source-id:}") String sourceId) {
        this(jdbc,editais,questions,events,mapper,memoryAuthority,sourceId,false,Clock.systemUTC());
    }
    /** Package-local fixture seam; production wiring cannot enable synthetic evaluation. */
    LearningShadowSnapshotService(JdbcTemplate jdbc, EditalRepository editais,
            QuestionRepository questions, EventStoreRepository events, ObjectMapper mapper, LearningEvidenceService memoryAuthority,
            String sourceId, boolean fixtureInstallation, Clock clock) {
        this.jdbc=jdbc; this.editais=editais; this.questions=questions; this.events=events; this.mapper=mapper;
        this.memoryAuthority=memoryAuthority;
        this.sourceId=sourceId;
        this.fixtureInstallation=fixtureInstallation; this.clock=clock;
    }

    /** Time is an explicit host-configured diagnostic/retrieval timebox, never predicted duration.
     * Current curriculum/memory cannot reconstruct a historical snapshot: reject future state. */
    @Transactional(readOnly=true)
    public Map<String,Object> capture(String contest, String editalId, Instant cutoff, int minutes, int timebox) throws Exception {
        Instant observedAt=clock.instant();
        if(sourceId.isBlank() || contest==null || contest.isBlank() || cutoff==null || cutoff.isAfter(observedAt) || minutes<0 || minutes>1440 || timebox<1 || timebox>120)
            throw new IllegalArgumentException("Invalid host shadow context");
        Edital edital=editais.findEditalById(editalId).orElseThrow(()->new IllegalArgumentException("Unknown syllabus"));
        if(!contest.equals(edital.getConcursoId()) || edital.getVersao()==null || edital.getVersao().isBlank())
            throw new IllegalArgumentException("Syllabus scope/version mismatch");
        // No implicit fallback to another contest or syllabus, even if repository has one.
        List<Map<String,Object>> candidates=new ArrayList<>(), memory=new ArrayList<>(), evidence=new ArrayList<>(), omissions=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        for(EditalTopico topic:editais.findTopicosByEditalId(editalId).stream().sorted(Comparator.comparing(EditalTopico::getId)).toList()) {
            if(!contest.equals(topic.getConcursoId()) || !editalId.equals(topic.getEditalId()) || !topic.isConfirmadoHumano()) continue;
            for(var link:jdbc.queryForList("SELECT c.question_id,c.id,c.created_at FROM ("+QuestionClassificationService.CURRENT_LINKS+") c WHERE c.topic_id=? AND c.status='CONFIRMED' ORDER BY c.question_id",topic.getId())) {
                Instant classified=Instant.parse(link.get("created_at").toString());
                if(classified.isAfter(observedAt)) throw new IllegalArgumentException("Classification after inventory observation");
                String qid=link.get("question_id").toString();
                // View excludes quarantine; status and usable content are separate admission facts.
                if(jdbc.queryForObject("SELECT COUNT(*) FROM study_questions WHERE id=? AND status='VALIDADA' AND gabarito_status='DEFINITIVO'",Integer.class,qid)!=1) continue;
                Question q=questions.findById(qid).orElseThrow();
                if(q.getGabaritoStatus()!=GabaritoStatus.DEFINITIVO || q.getCorrectOption()==null || q.getCorrectOption().isBlank()) continue;
                if(q.getStatement()==null || q.getStatement().isBlank() || q.getOptions()==null || q.getOptions().size()<2 ||
                    q.getOptions().stream().anyMatch(option->option==null || option.isBlank())) continue;
                String candidateId="diagnostic:"+topic.getId()+":"+qid;
                if(!seen.add(candidateId)) throw new IllegalArgumentException("Duplicate candidate identity");
                var row=new TreeMap<String,Object>();
                row.put("candidate_id",candidateId); row.put("activity_type","DIAGNOSE_CONCEPT");
                row.put("scope_id",qid); row.put("contest_id",contest); row.put("topic_id",topic.getId());
                row.put("question_id",qid); row.put("classification_id",link.get("id"));
                row.put("priority","DIAGNOSTIC_GAP"); row.put("estimated_minutes",timebox);
                row.put("time_basis","HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION");
                row.put("material_available",true); row.put("in_syllabus",true);
                // A diagnostic measures prerequisites; it does not assert prerequisite mastery.
                row.put("prerequisites_status","NOT_APPLICABLE"); row.put("risk","LOW_REVERSIBLE");
                row.put("support_specialist_id",""); row.put("inventory_id",candidateId);
                row.put("inventory_version","core-shadow-inventory-v1");
                row.put("curriculum_source_id",editalId+":"+edital.getVersao());
                row.put("inventory_observed_at",observedAt.toString());
                candidates.add(row);
                for(var state:jdbc.queryForList("SELECT * FROM learning_memory_state WHERE question_id=?",qid)) {
                    if(!LearningEvidenceService.MODEL_VERSION.equals(state.get("model_version"))) continue;
                    Instant reviewed=Instant.parse(state.get("last_reviewed_at").toString());
                    Instant due=Instant.parse(state.get("due_at").toString());
                    if(reviewed.isAfter(cutoff)) throw new IllegalArgumentException("Memory state after cutoff");
                    if(due.isAfter(observedAt)) continue;
                    var review=new TreeMap<>(row);
                    String id="review:"+topic.getId()+":"+qid;
                    review.put("candidate_id",id); review.put("inventory_id",id); review.put("activity_type","REVIEW_ITEM");
                    review.put("priority","MAINTENANCE_DUE"); review.put("support_specialist_id","FSRS_HOST_"+qid);
                    candidates.add(review);
                    // The same item may be linked to multiple topics; memory remains item-level.
                    if(memory.stream().noneMatch(m->qid.equals(m.get("question_id")))) {
                        var m=new TreeMap<String,Object>(); m.put("question_id",qid); m.put("due_at",due.toString());
                        m.put("last_reviewed_at",reviewed.toString()); m.put("model_version",state.get("model_version"));
                        var prediction=memoryAuthority.preview(qid,observedAt);
                        Object recall=prediction.get("recallBefore");
                        m.put("retrievability",recall);
                        // Same 0.9 target used by LearningEvidenceService's canonical FSRS scheduling.
                        // An operational threshold is not a calibrated personal forecast.
                        m.put("memory_risk",recall instanceof Number n && Double.isFinite(n.doubleValue()) && n.doubleValue()<=0.9);
                        memory.add(m);
                    }
                }
            }
        }
        long rowid=events.getMaxRowid();
        for(EventRecord event:events.getEventsUpTo("ANSWER_SUBMITTED",rowid)) {
            if(Instant.parse(event.getOccurredAt()).isAfter(cutoff) || Instant.parse(event.getRecordedAt()).isAfter(cutoff))
                throw new IllegalArgumentException("Event after cutoff");
            var p=mapper.readTree(event.getPayloadJson());
            if(event.getEventVersion()!=2 || !"v2".equals(event.getSchemaVersion())) throw new IllegalArgumentException("Unsupported event version");
            String qid=p.path("questionId").asText();
            if(candidates.stream().noneMatch(c->qid.equals(c.get("question_id")))) continue;
            if(p.has("studentId") && !"LOCAL_SINGLE_USER".equals(p.path("studentId").asText())) throw new IllegalArgumentException("Student mismatch");
            if(p.has("concursoId") && !contest.equals(p.path("concursoId").asText())) throw new IllegalArgumentException("Contest mismatch");
            if(!p.hasNonNull("studentId") || !p.hasNonNull("concursoId")) {
                omissions.add(new TreeMap<>(Map.of("event_id",event.getEventId(),"reason","HISTORICAL_STUDENT_OR_CONTEST_SCOPE_UNKNOWN")));
                continue;
            }
            String origin=p.path("origin").asText("UNKNOWN");
            if(!Set.of("REAL_STUDY","SYNTHETIC_FIXTURE","AUTOMATED_TEST","SYNTHETIC_BENCHMARK").contains(origin)) throw new IllegalArgumentException("Unknown event origin");
            var e=new TreeMap<String,Object>(); e.put("event_id",event.getEventId()); e.put("occurred_at",event.getOccurredAt());
            e.put("origin",origin); e.put("question_id",qid); e.put("student_id","LOCAL_SINGLE_USER"); e.put("contest_id",contest);
            e.put("recorded_at",event.getRecordedAt()); e.put("event_version",event.getEventVersion()); e.put("schema_version",event.getSchemaVersion());
            e.put("is_correct",p.path("isCorrect").isBoolean()?p.path("isCorrect").booleanValue():null);
            e.put("gabarito_status",p.path("gabaritoStatus").asText("UNKNOWN"));
            e.put("confidence_level",p.path("confidenceLevel").isIntegralNumber()?p.path("confidenceLevel").intValue():null);
            e.put("active_time_ms",p.path("activeTimeMs").isNumber()?p.path("activeTimeMs").longValue():null);
            e.put("intervention_type",p.path("interventionType").asText("UNKNOWN"));
            // Absence of assistance/exposure instrumentation stays unknown.
            e.put("assistance_status","UNKNOWN"); e.put("answer_exposed","UNKNOWN");
            evidence.add(e);
        }
        if(evidence.stream().map(e->e.get("event_id")).distinct().count()!=evidence.size()) throw new IllegalArgumentException("Duplicate evidence identity");
        evidence.sort(Comparator.comparing(e->e.get("event_id").toString()));
        omissions.sort(Comparator.comparing(e->e.get("event_id").toString()));
        candidates.sort(Comparator.comparing(c->c.get("candidate_id").toString()));
        memory.sort(Comparator.comparing(m->m.get("question_id").toString()));
        var request=new TreeMap<String,Object>();
        request.put("schema_version","core-learning-shadow-v1"); request.put("student_id","LOCAL_SINGLE_USER");
        request.put("source_id",sourceId); request.put("producer_version","CORE_SHADOW_READ_V1");
        request.put("java_runtime",System.getProperty("java.runtime.version"));
        request.put("cutoff",observedAt.toString()); request.put("evidence_cutoff",cutoff.toString()); request.put("snapshot_rowid",rowid);
        request.put("fixture_installation",fixtureInstallation); request.put("evidence_omissions",omissions);
        request.put("context",Map.of("contest_id",contest,"available_minutes",minutes));
        request.put("candidates",candidates); request.put("events",evidence); request.put("memory",memory);
        request.put("limitations",List.of("PERSONAL_CUSTODY_NOT_ESTABLISHED","HISTORICAL_FREQUENCY_UNKNOWN",
            "MATERIAL_PREREQUISITES_AND_DURATION_NOT_ESTABLISHED","NO_INTERVENTION_GAIN_MODEL","CURRENT_CURRICULUM_AT_CAPTURE_NOT_HISTORICAL"));
        return request;
    }
}
