package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.Files;
import java.nio.file.Path;
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
                if(hasMissingSupportMedia(qid)) continue;
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
            "MATERIAL_PREREQUISITES_AND_DURATION_NOT_ESTABLISHED","NO_INTERVENTION_GAIN_MODEL","CURRENT_CURRICULUM_AT_CAPTURE_NOT_HISTORICAL",
            "APPLICATION_AND_TRANSFER_INSTRUMENTS_NOT_ESTABLISHED"));
        return request;
    }

    /**
     * Auditoria abrangente e determinística do inventário pedagógico.
     * Avalia candidatos admitidos, motivos explícitos de rejeição e a matriz epistêmica de 5 estados.
     */
    @Transactional(readOnly=true)
    public InventoryAuditResult auditInventory(String contest, String editalId, Instant cutoff, int minutes, int timebox) throws Exception {
        Instant observedAt = clock.instant();
        if(contest == null || contest.isBlank() || cutoff == null || cutoff.isAfter(observedAt) || minutes < 0 || minutes > 1440 || timebox < 1 || timebox > 120)
            throw new IllegalArgumentException("Invalid host shadow context");
        Edital edital = editais.findEditalById(editalId).orElseThrow(() -> new IllegalArgumentException("Unknown syllabus"));
        if(!contest.equals(edital.getConcursoId()) || edital.getVersao() == null || edital.getVersao().isBlank())
            throw new IllegalArgumentException("Syllabus scope/version mismatch");

        List<PedagogicalCandidate> admitted = new ArrayList<>();
        List<CandidateRejection> rejections = new ArrayList<>();
        Map<PedagogicalActivityType, Map<EpistemicStatus, Integer>> matrix = new EnumMap<>(PedagogicalActivityType.class);
        for(PedagogicalActivityType type : PedagogicalActivityType.values()) {
            Map<EpistemicStatus, Integer> counts = new EnumMap<>(EpistemicStatus.class);
            for(EpistemicStatus st : EpistemicStatus.values()) counts.put(st, 0);
            matrix.put(type, counts);
        }

        List<EditalTopico> allTopics = editais.findTopicosByEditalId(editalId).stream()
            .sorted(Comparator.comparing(EditalTopico::getId)).toList();

        for(EditalTopico topic : allTopics) {
            if(!contest.equals(topic.getConcursoId()) || !editalId.equals(topic.getEditalId())) continue;

            // 1. Audit Question Diagnostic Candidates
            List<Map<String, Object>> topicLinks = jdbc.queryForList(
                "SELECT c.question_id, c.id, c.status, c.confidence, c.origin, c.reviewer, c.evidence, c.created_at " +
                "FROM (" + QuestionClassificationService.CURRENT_LINKS + ") c WHERE c.topic_id = ? ORDER BY c.question_id", topic.getId());

            for(var link : topicLinks) {
                String qid = link.get("question_id").toString();
                String linkStatus = Objects.toString(link.get("status"), "");
                Instant classified = Instant.parse(link.get("created_at").toString());
                String candidateId = "diagnostic:" + topic.getId() + ":" + qid;

                if(!topic.isConfirmadoHumano()) {
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid,
                        EpistemicStatus.PROPOSTO, List.of(PedagogicalRejectionReason.TOPIC_NOT_CONFIRMED_HUMAN),
                        "Tópico " + topic.getId() + " pendente de validação humana"));
                    inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, EpistemicStatus.PROPOSTO);
                    continue;
                }

                if(!"CONFIRMED".equals(linkStatus)) {
                    EpistemicStatus epistemic = "SUGGESTED".equals(linkStatus) ? EpistemicStatus.PROPOSTO : EpistemicStatus.INDISPONIVEL;
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid,
                        epistemic, List.of(PedagogicalRejectionReason.CLASSIFICATION_NOT_CONFIRMED),
                        "Classificação com status " + linkStatus));
                    inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, epistemic);
                    continue;
                }

                if(classified.isAfter(observedAt)) {
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid,
                        EpistemicStatus.NAO_VERIFICADO, List.of(PedagogicalRejectionReason.CLASSIFICATION_AFTER_OBSERVED_AT),
                        "Classificação registrada após cutoff de observação"));
                    inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, EpistemicStatus.NAO_VERIFICADO);
                    continue;
                }

                int inStudyQuestions = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM study_questions WHERE id=? AND status='VALIDADA' AND gabarito_status='DEFINITIVO'",
                    Integer.class, qid);
                if(inStudyQuestions != 1) {
                    List<PedagogicalRejectionReason> reasons = new ArrayList<>();
                    int inBlocked = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM diagnostic_blocked_questions WHERE id=?",
                        Integer.class, qid);
                    if(inBlocked > 0) reasons.add(PedagogicalRejectionReason.QUESTION_QUARANTINED_OR_INVALID);
                    Question rawQ = questions.findById(qid).orElse(null);
                    if(rawQ != null) {
                        if(!"VALIDADA".equals(rawQ.getStatus()) && !reasons.contains(PedagogicalRejectionReason.QUESTION_QUARANTINED_OR_INVALID))
                            reasons.add(PedagogicalRejectionReason.QUESTION_QUARANTINED_OR_INVALID);
                        if(rawQ.getGabaritoStatus() != GabaritoStatus.DEFINITIVO)
                            reasons.add(PedagogicalRejectionReason.GABARITO_NOT_DEFINITIVE);
                    } else {
                        reasons.add(PedagogicalRejectionReason.QUESTION_QUARANTINED_OR_INVALID);
                    }
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid,
                        EpistemicStatus.INDISPONIVEL, reasons, "Questão inacessível em study_questions"));
                    inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, EpistemicStatus.INDISPONIVEL);
                    continue;
                }

                Question q = questions.findById(qid).orElse(null);
                if(q == null || q.getStatement() == null || q.getStatement().isBlank() || q.getOptions() == null || q.getOptions().size() < 2 ||
                   q.getOptions().stream().anyMatch(opt -> opt == null || opt.isBlank())) {
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid,
                        EpistemicStatus.INDISPONIVEL, List.of(PedagogicalRejectionReason.QUESTION_STRUCTURALLY_INVALID),
                        "Questão com estrutura inválida de enunciado/alternativas"));
                    inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, EpistemicStatus.INDISPONIVEL);
                    continue;
                }

                // Check support materials
                if(hasMissingSupportMedia(qid)) {
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid,
                        EpistemicStatus.INDISPONIVEL, List.of(PedagogicalRejectionReason.SUPPORT_MATERIAL_MEDIA_MISSING),
                        "Material de apoio da questão com mídia ausente no disco local"));
                    inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, EpistemicStatus.INDISPONIVEL);
                    continue;
                }

                // Question is valid diagnostic candidate
                admitted.add(new PedagogicalCandidate(
                    candidateId, PedagogicalActivityType.DIAGNOSE_CONCEPT, qid, contest, topic.getId(), qid, null,
                    link.get("id").toString(), "DIAGNOSTIC_GAP", timebox, "HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION",
                    true, true, "NOT_APPLICABLE", "LOW_REVERSIBLE", "", candidateId,
                    "core-shadow-inventory-v1", editalId + ":" + edital.getVersao(), observedAt.toString(),
                    EpistemicStatus.CONFIRMADO, Map.of("classification_origin", link.get("origin"))
                ));
                inc(matrix, PedagogicalActivityType.DIAGNOSE_CONCEPT, EpistemicStatus.CONFIRMADO);

                // Check auxiliary support reading
                int supportCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM question_support_materials WHERE question_id=?", Integer.class, qid);
                if(supportCount > 0) {
                    inc(matrix, PedagogicalActivityType.SUPPORT_READING, EpistemicStatus.CONFIRMADO);
                }

                // 2. Audit Review Candidates for this valid question
                for(var state : jdbc.queryForList("SELECT * FROM learning_memory_state WHERE question_id=?", qid)) {
                    String reviewId = "review:" + topic.getId() + ":" + qid;
                    String modelVer = Objects.toString(state.get("model_version"), "");
                    Instant reviewed = Instant.parse(state.get("last_reviewed_at").toString());
                    Instant due = Instant.parse(state.get("due_at").toString());

                    if(!LearningEvidenceService.MODEL_VERSION.equals(modelVer)) {
                        rejections.add(new CandidateRejection(reviewId, PedagogicalActivityType.REVIEW_ITEM, qid,
                            EpistemicStatus.NAO_VERIFICADO, List.of(PedagogicalRejectionReason.MODEL_VERSION_INCOMPATIBLE),
                            "Modelo FSRS incompatível: " + modelVer));
                        inc(matrix, PedagogicalActivityType.REVIEW_ITEM, EpistemicStatus.NAO_VERIFICADO);
                        continue;
                    }
                    if(reviewed.isAfter(cutoff)) {
                        rejections.add(new CandidateRejection(reviewId, PedagogicalActivityType.REVIEW_ITEM, qid,
                            EpistemicStatus.NAO_VERIFICADO, List.of(PedagogicalRejectionReason.MEMORY_AFTER_CUTOFF),
                            "Revisão após cutoff de evidências: " + reviewed));
                        inc(matrix, PedagogicalActivityType.REVIEW_ITEM, EpistemicStatus.NAO_VERIFICADO);
                        continue;
                    }
                    if(due.isAfter(observedAt)) {
                        rejections.add(new CandidateRejection(reviewId, PedagogicalActivityType.REVIEW_ITEM, qid,
                            EpistemicStatus.EXISTENTE, List.of(PedagogicalRejectionReason.MEMORY_NOT_DUE),
                            "Item agendado para o futuro: " + due));
                        inc(matrix, PedagogicalActivityType.REVIEW_ITEM, EpistemicStatus.EXISTENTE);
                        continue;
                    }

                    // Check historical answer event
                    int eventCount = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM event_store WHERE event_type='ANSWER_SUBMITTED' " +
                        "AND payload_json LIKE ? AND occurred_at <= ?",
                        Integer.class, "%\"questionId\":\"" + qid + "\"%", cutoff.toString());
                    if(eventCount == 0) {
                        rejections.add(new CandidateRejection(reviewId, PedagogicalActivityType.REVIEW_ITEM, qid,
                            EpistemicStatus.NAO_VERIFICADO, List.of(PedagogicalRejectionReason.ABSENT_MEMORY_LINEAGE),
                            "Estado de memória sem evento de submissão correspondente"));
                        inc(matrix, PedagogicalActivityType.REVIEW_ITEM, EpistemicStatus.NAO_VERIFICADO);
                        continue;
                    }

                    admitted.add(new PedagogicalCandidate(
                        reviewId, PedagogicalActivityType.REVIEW_ITEM, qid, contest, topic.getId(), qid, null,
                        link.get("id").toString(), "MAINTENANCE_DUE", timebox, "HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION",
                        true, true, "NOT_APPLICABLE", "LOW_REVERSIBLE", "FSRS_HOST_" + qid, reviewId,
                        "core-shadow-inventory-v1", editalId + ":" + edital.getVersao(), observedAt.toString(),
                        EpistemicStatus.CONFIRMADO, Map.of("due_at", due.toString(), "last_reviewed_at", reviewed.toString())
                    ));
                    inc(matrix, PedagogicalActivityType.REVIEW_ITEM, EpistemicStatus.CONFIRMADO);
                }
            }

            // 3. Audit Study Materials (LEARN_NEW) for this topic
            List<Map<String, Object>> matLinks = jdbc.queryForList(
                "SELECT l.id AS link_id, l.material_id, l.pagina_inicio, l.pagina_fim, l.status AS link_status, " +
                "m.id AS m_id, m.concurso_id, m.disciplina, m.titulo, m.formato, m.total_paginas, m.url_ou_caminho " +
                "FROM topic_material_links l LEFT JOIN study_materials m ON l.material_id = m.id WHERE l.topico_id = ?",
                topic.getId());

            for(var ml : matLinks) {
                String matId = ml.get("material_id").toString();
                Object pIni = ml.get("pagina_inicio");
                Object pFim = ml.get("pagina_fim");
                String pagesTag = (pIni != null && pFim != null) ? pIni + "-" + pFim : "unspecified";
                String candidateId = "learn:" + topic.getId() + ":" + matId + ":" + pagesTag;

                List<PedagogicalRejectionReason> reasons = new ArrayList<>();
                EpistemicStatus status = EpistemicStatus.NAO_VERIFICADO;

                if(!topic.isConfirmadoHumano()) {
                    reasons.add(PedagogicalRejectionReason.TOPIC_NOT_CONFIRMED_HUMAN);
                    status = EpistemicStatus.PROPOSTO;
                }

                if(ml.get("m_id") == null) {
                    reasons.add(PedagogicalRejectionReason.MATERIAL_RECORD_MISSING);
                    status = EpistemicStatus.INDISPONIVEL;
                } else {
                    String url = Objects.toString(ml.get("url_ou_caminho"), "").trim();
                    if(url.isBlank()) {
                        reasons.add(PedagogicalRejectionReason.NO_MATERIAL_LOCATION);
                        status = EpistemicStatus.INDISPONIVEL;
                    } else if(!isUrlOrExistingFile(url)) {
                        reasons.add(PedagogicalRejectionReason.PHYSICAL_FILE_MISSING);
                        status = EpistemicStatus.INDISPONIVEL;
                    }

                    if(pIni == null || pFim == null) {
                        reasons.add(PedagogicalRejectionReason.PAGE_RANGE_UNVERIFIED);
                    } else {
                        int ini = ((Number) pIni).intValue();
                        int fim = ((Number) pFim).intValue();
                        if(ini <= 0 || fim < ini) {
                            reasons.add(PedagogicalRejectionReason.PAGE_RANGE_UNVERIFIED);
                        }
                        int tot = ml.get("total_paginas") instanceof Number n ? n.intValue() : 0;
                        if(tot > 0 && fim > tot) {
                            reasons.add(PedagogicalRejectionReason.PAGES_EXCEED_TOTAL);
                        }
                    }
                }

                // Check canonical prerequisites
                List<Map<String, Object>> concepts = jdbc.queryForList(
                    "SELECT concept_id FROM edital_topico_concept_links WHERE topico_id = ?", topic.getId());
                boolean prereqsSatisfied = false;
                if(!concepts.isEmpty()) {
                    int prereqCount = 0;
                    for(var c : concepts) {
                        prereqCount += jdbc.queryForObject(
                            "SELECT COUNT(*) FROM canonical_concept_prerequisites WHERE concept_id = ?",
                            Integer.class, c.get("concept_id"));
                    }
                    if(prereqCount > 0) {
                        reasons.add(PedagogicalRejectionReason.PREREQUISITES_NOT_ESTABLISHED);
                    } else {
                        prereqsSatisfied = true;
                    }
                } else {
                    reasons.add(PedagogicalRejectionReason.PREREQUISITES_NOT_ESTABLISHED);
                }

                if(!reasons.isEmpty()) {
                    rejections.add(new CandidateRejection(candidateId, PedagogicalActivityType.LEARN_NEW, matId,
                        status, reasons, "Material didático não atende aos contratos estritos de admissão"));
                    inc(matrix, PedagogicalActivityType.LEARN_NEW, status);
                } else {
                    admitted.add(new PedagogicalCandidate(
                        candidateId, PedagogicalActivityType.LEARN_NEW, topic.getId(), contest, topic.getId(), null, matId,
                        ml.get("link_id").toString(), "NEW_CONTENT", timebox, "HOST_CONFIGURED_TIMEBOX_NOT_PREDICTION",
                        true, true, prereqsSatisfied ? "SATISFIED" : "NOT_APPLICABLE", "LOW_REVERSIBLE", "", candidateId,
                        "core-shadow-inventory-v1", editalId + ":" + edital.getVersao(), observedAt.toString(),
                        EpistemicStatus.CONFIRMADO, Map.of("material_title", ml.get("titulo"), "pages", pagesTag)
                    ));
                    inc(matrix, PedagogicalActivityType.LEARN_NEW, EpistemicStatus.CONFIRMADO);
                }
            }
        }

        // 4. Audit Application / Transfer Activities
        rejections.add(new CandidateRejection("application:all", PedagogicalActivityType.DEEPEN_APPLICATION, "CONTEST_SCOPE",
            EpistemicStatus.INDISPONIVEL, List.of(PedagogicalRejectionReason.APPLICATION_INSTRUMENT_UNAVAILABLE),
            "Instrumento operacional para avaliação de aplicação/transferência indisponível no repositório"));
        inc(matrix, PedagogicalActivityType.DEEPEN_APPLICATION, EpistemicStatus.INDISPONIVEL);

        // 5. Simulado Exam
        int simuladoCount = jdbc.queryForObject("SELECT COUNT(*) FROM simulado_executions WHERE concurso_id = ?", Integer.class, contest);
        if(simuladoCount > 0) {
            inc(matrix, PedagogicalActivityType.SIMULADO_EXAM, EpistemicStatus.EXISTENTE);
        }

        List<String> limitations = List.of(
            "PERSONAL_CUSTODY_NOT_ESTABLISHED",
            "HISTORICAL_FREQUENCY_UNKNOWN",
            "MATERIAL_PREREQUISITES_AND_DURATION_NOT_ESTABLISHED",
            "NO_INTERVENTION_GAIN_MODEL",
            "CURRENT_CURRICULUM_AT_CAPTURE_NOT_HISTORICAL",
            "APPLICATION_AND_TRANSFER_INSTRUMENTS_NOT_ESTABLISHED"
        );

        return new InventoryAuditResult(contest, editalId, observedAt.toString(), admitted, rejections, matrix, limitations);
    }

    boolean hasMissingSupportMedia(String qid) {
        List<Map<String, Object>> mats = jdbc.queryForList(
            "SELECT m.media_path, m.conteudo_texto FROM question_support_materials qsm " +
            "JOIN support_materials m ON qsm.material_id = m.id WHERE qsm.question_id = ?", qid);
        for(var m : mats) {
            String mediaPath = Objects.toString(m.get("media_path"), "").trim();
            String text = Objects.toString(m.get("conteudo_texto"), "").trim();
            if(!mediaPath.isBlank()) {
                try {
                    if(!Files.isRegularFile(Path.of(mediaPath))) return true;
                } catch(Exception e) {
                    return true;
                }
            }
            if(mediaPath.isBlank() && text.isBlank()) {
                return true;
            }
        }
        return false;
    }

    static boolean isUrlOrExistingFile(String pathOrUrl) {
        if(pathOrUrl == null || pathOrUrl.isBlank()) return false;
        if(pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
            return true;
        }
        try {
            return Files.isRegularFile(Path.of(pathOrUrl));
        } catch(Exception e) {
            return false;
        }
    }

    private static void inc(Map<PedagogicalActivityType, Map<EpistemicStatus, Integer>> matrix, PedagogicalActivityType act, EpistemicStatus st) {
        matrix.get(act).put(st, matrix.get(act).get(st) + 1);
    }
}
