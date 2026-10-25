package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.cognitive.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import java.time.*;
import java.util.*;

/** Rebuildable per-item memory projection. Topic mastery is a distinct estimate. */
@Service
public class LearningEvidenceService {
    public static final String MODEL_VERSION = "FSRS-6.0-default-core-no-fuzz";
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ZoneId studyZone;
    private final FsrsEngine engine = new FsrsEngine();
    public LearningEvidenceService(JdbcTemplate jdbc) { this(jdbc, "America/Sao_Paulo"); }
    @org.springframework.beans.factory.annotation.Autowired
    public LearningEvidenceService(JdbcTemplate jdbc, @org.springframework.beans.factory.annotation.Value("${fiscalstudy.zone:America/Sao_Paulo}") String zone) {
        this.jdbc = jdbc;
        this.studyZone = ZoneId.of(zone);
        this.transaction = new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource())));
    }
    private FsrsCardState state(String questionId) {
        return jdbc.query("SELECT * FROM learning_memory_state WHERE question_id = ?", (r,n) -> FsrsCardState.of(r.getDouble("stability"),r.getDouble("difficulty"),r.getInt("reps"),r.getInt("lapses"),Instant.parse(r.getString("last_reviewed_at")),Instant.parse(r.getString("due_at"))),questionId).stream().findFirst().orElse(null);
    }
    public Map<String,Object> preview(String questionId) {
        Map<String,Object> result = new LinkedHashMap<>();
        FsrsCardState current=state(questionId);
        result.put("modelVersion",MODEL_VERSION);
        result.put("recallBefore",current == null ? null : current.getRetrievability(Instant.now()));
        result.put("evidenceStatus",current == null ? "COLD_START" : "UNCALIBRATED_ITEM_ESTIMATE");
        result.put("scope","QUESTION_OCCURRENCE_NOT_TOPIC_MASTERY");
        result.put("predictedAt",Instant.now().toString());
        return result;
    }
    public static String pedagogicalSignal(Boolean correct, Double recallBefore) {
        if (!Boolean.FALSE.equals(correct)) return "NO_ERROR";
        if (recallBefore == null) return "INSUFFICIENT_MEMORY_HISTORY";
        if (recallBefore >= 0.8) return "UNEXPECTED_ERROR_INVESTIGATE_CAUSE";
        if (recallBefore <= 0.5) return "EXPECTED_FORGETTING_POSSIBLE";
        return "ERROR_CAUSE_UNDETERMINED";
    }
    public synchronized void projectAttempt(String attemptId,String questionId,Instant occurredAt,Boolean correct,String origin,int confidence,boolean usedHelp,Map<String,Object> prediction) {
        transaction.executeWithoutResult(status -> projectInsideTransaction(attemptId,questionId,occurredAt,correct,origin,confidence,usedHelp,prediction));
    }
    private void projectInsideTransaction(String attemptId,String questionId,Instant occurredAt,Boolean correct,String origin,int confidence,boolean usedHelp,Map<String,Object> prediction) {
        if (!"REAL_STUDY".equals(origin) || correct == null || usedHelp || confidence == 1) return;
        if(jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection WHERE attempt_id=?",Integer.class,attemptId)>0)return;
        FsrsCardState previous=state(questionId);
        if(previous != null && occurredAt.isBefore(previous.getLastReviewedAt())) throw new IllegalStateException("OUT_OF_ORDER_PROJECTION: replay requires ordered rebuild; current memory state unchanged");
        Double recall=prediction != null && prediction.get("recallBefore") instanceof Number n ? n.doubleValue() : null;
        String signal=pedagogicalSignal(correct,recall);
        int inserted=jdbc.update("INSERT OR IGNORE INTO learning_evidence_projection(attempt_id,question_id,occurred_at,origin,recall_before,pedagogical_signal,model_version) VALUES(?,?,?,?,?,?,?)",attemptId,questionId,occurredAt.toString(),origin,recall,signal,MODEL_VERSION);
        if(inserted==0)return;
        FsrsRating rating=Boolean.TRUE.equals(correct)?FsrsRating.GOOD:FsrsRating.AGAIN;
        FsrsCardState next=engine.calculateNextState(previous,rating,occurredAt);
        jdbc.update("INSERT INTO learning_memory_state(question_id,stability,difficulty,reps,lapses,last_reviewed_at,due_at,model_version) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(question_id) DO UPDATE SET stability=excluded.stability,difficulty=excluded.difficulty,reps=excluded.reps,lapses=excluded.lapses,last_reviewed_at=excluded.last_reviewed_at,due_at=excluded.due_at,model_version=excluded.model_version",questionId,next.getStability(),next.getDifficulty(),next.getReps(),next.getLapses(),occurredAt.toString(),next.getDue().toString(),MODEL_VERSION);
        // Only confirmed curation links may create topic recommendations. Unclassified items remain item-level evidence.
        List<Map<String,Object>> topics=jdbc.queryForList("SELECT t.* FROM ("+QuestionClassificationService.CURRENT_LINKS+") c JOIN edital_topicos t ON t.id=c.topic_id WHERE c.question_id=? AND c.status='CONFIRMED'",questionId);
        for(Map<String,Object> t:topics) {
            String id="fsrs-"+questionId+"-"+t.get("id");
            String due=next.getDue().atZone(studyZone).toLocalDate().toString();
            String reason=signal+": estimativa FSRS do item, sem diagnóstico automático da causa; verificar recuperação em questão diferente.";
            jdbc.update("INSERT INTO revision_calendar(id,session_id,concurso_id,disciplina,topico,tipo_revisao,intervalo_dias,data_agendada,origem_evento,source_id,status,justificativa_pedagogica,estagio_intervencao,prioridade_score) VALUES(?,NULL,?,?,?,'FSRS_ITEM',?,?, 'ELIGIBLE_ATTEMPT',?,'PENDENTE',?,'RECUPERACAO_ATIVA',?) ON CONFLICT(id) DO UPDATE SET data_agendada=excluded.data_agendada,intervalo_dias=excluded.intervalo_dias,status='PENDENTE',justificativa_pedagogica=excluded.justificativa_pedagogica,prioridade_score=excluded.prioridade_score",id,t.get("concurso_id"),t.get("disciplina"),t.get("assunto"),(int)engine.calculateOptimalInterval(next.getStability(),0.9),due,questionId,reason,Boolean.TRUE.equals(correct)?0.5:0.9);
        }
    }
}
