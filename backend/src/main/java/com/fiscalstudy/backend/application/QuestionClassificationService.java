package com.fiscalstudy.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Human-reviewed topic links; suggestions never count as confirmed learning evidence. */
@Service
public class QuestionClassificationService {
    private final JdbcTemplate jdbc;
    public QuestionClassificationService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public static final String CURRENT_LINKS = "SELECT c.* FROM question_topic_classifications c WHERE NOT EXISTS (SELECT 1 FROM question_topic_classifications n WHERE n.question_id=c.question_id AND n.topic_id=c.topic_id AND n.rowid>c.rowid)";
    public List<Map<String,Object>> topics(String concursoId) {
        return concursoId==null || concursoId.isBlank() ? jdbc.queryForList("SELECT id,concurso_id,disciplina,assunto,subassunto FROM edital_topicos ORDER BY disciplina,assunto") : jdbc.queryForList("SELECT id,concurso_id,disciplina,assunto,subassunto FROM edital_topicos WHERE concurso_id=? ORDER BY disciplina,assunto",concursoId);
    }
    public List<Map<String,Object>> questions(boolean unclassified,int limit,int offset) {
        return questions(unclassified,limit,offset,null);
    }
    public List<Map<String,Object>> questions(boolean unclassified,int limit,int offset,String topicId) {
        if(limit<1 || limit>100 || offset<0) throw bad("limit deve estar entre 1 e 100; offset >= 0");
        if(topicId != null && !topicId.isBlank()) {
            if(unclassified) throw bad("Filtro topicId exige unclassified=false");
            return jdbc.queryForList("SELECT q.id,q.enunciado,q.disciplina,q.assunto,q.arquivo_origem,q.numero_original FROM study_questions q WHERE EXISTS (SELECT 1 FROM ("+CURRENT_LINKS+") c WHERE c.question_id=q.id AND c.topic_id=? AND c.status='CONFIRMED') ORDER BY q.id LIMIT ? OFFSET ?",topicId,limit,offset);
        }
        String filter=unclassified ? " WHERE NOT EXISTS (SELECT 1 FROM ("+CURRENT_LINKS+") c WHERE c.question_id=q.id AND c.status='CONFIRMED')" : "";
        return jdbc.queryForList("SELECT q.id,q.enunciado,q.disciplina,q.assunto,q.arquivo_origem,q.numero_original FROM study_questions q"+filter+" ORDER BY q.id LIMIT ? OFFSET ?",limit,offset);
    }
    public List<Map<String,Object>> history(String questionId) {
        requireQuestion(questionId);
        return jdbc.queryForList("SELECT c.*,t.concurso_id,t.disciplina,t.assunto,t.subassunto FROM question_topic_classifications c JOIN edital_topicos t ON t.id=c.topic_id WHERE question_id=? ORDER BY c.rowid DESC",questionId);
    }
    public Map<String,Object> coverage(String concursoId) {
        String scope=concursoId==null || concursoId.isBlank()?"":" AND t.concurso_id=?";
        Object[] args=scope.isEmpty()?new Object[]{}:new Object[]{concursoId};
        String links=" FROM ("+CURRENT_LINKS+") c JOIN edital_topicos t ON t.id=c.topic_id WHERE 1=1"+scope;
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM study_questions",Long.class);
        long classified=jdbc.queryForObject("SELECT COUNT(DISTINCT c.question_id)"+links+" AND c.status='CONFIRMED'",Long.class,args);
        long confirmed=jdbc.queryForObject("SELECT COUNT(*)"+links+" AND c.status='CONFIRMED'",Long.class,args);
        long suggested=jdbc.queryForObject("SELECT COUNT(*)"+links+" AND c.status='SUGGESTED'",Long.class,args);
        return Map.of("totalQuestions",total,"classifiedQuestions",classified,"unclassifiedQuestions",total-classified,"confirmedLinks",confirmed,"suggestedLinks",suggested,"coverage",total==0?0.0:(double)classified/total,"scope",concursoId==null?"ALL":concursoId,"qualityValidated",false);
    }
    @Transactional
    public Map<String,Object> classify(String questionId,Classification request) {
        requireQuestion(questionId);
        if(request==null || request.topicId()==null || request.topicId().isBlank()) throw bad("topicId obrigatório");
        if(jdbc.queryForObject("SELECT COUNT(*) FROM edital_topicos WHERE id=?",Integer.class,request.topicId())==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Tópico inexistente");
        if(!Set.of("SUGGESTED","CONFIRMED","REJECTED").contains(Objects.toString(request.status(),""))) throw bad("status inválido");
        if(request.confidence()==null || !Double.isFinite(request.confidence()) || request.confidence()<0 || request.confidence()>1) throw bad("confidence deve estar entre 0 e 1");
        if(!Set.of("HUMAN","AUTOMATED").contains(Objects.toString(request.origin(),""))) throw bad("origin inválida");
        if(request.evidence()==null || request.evidence().isBlank()) throw bad("evidence obrigatória");
        if(!"SUGGESTED".equals(request.status()) && (!"HUMAN".equals(request.origin()) || request.reviewer()==null || request.reviewer().isBlank())) throw bad("Confirmação/rejeição exige revisor humano identificado");
        String id=UUID.randomUUID().toString();
        jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?)",id,questionId,request.topicId(),request.status(),request.confidence(),request.origin(),request.reviewer(),request.evidence(),Instant.now().toString());
        Map<String,Object> identity=family(questionId);
        jdbc.update("INSERT INTO question_families(question_id,family_id,fingerprint_version,created_at) VALUES(?,?,?,?) ON CONFLICT(question_id) DO UPDATE SET family_id=excluded.family_id,fingerprint_version=excluded.fingerprint_version,created_at=excluded.created_at",questionId,identity.get("familyId"),identity.get("fingerprintVersion"),Instant.now().toString());
        return jdbc.queryForMap("SELECT * FROM question_topic_classifications WHERE id=?",id);
    }
    /** Identity of exact content only: never proof of conceptual transfer or reason to delete occurrences. */
    public Map<String,Object> family(String questionId) {
        requireQuestion(questionId);
        Map<String,Object> q=jdbc.queryForMap("SELECT enunciado,options_json,correct_option FROM study_questions WHERE id=?",questionId);
        try {
            String content=Objects.toString(q.get("enunciado"),"")+"\u001e"+Objects.toString(q.get("options_json"),"")+"\u001e"+Objects.toString(q.get("correct_option"),"");
            String fingerprint=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8)));
            return Map.of("questionId",questionId,"familyId",fingerprint,"fingerprintVersion","EXACT_CONTENT_V1","conceptualEquivalenceVerified",false);
        } catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private void requireQuestion(String id) { if(jdbc.queryForObject("SELECT COUNT(*) FROM study_questions WHERE id=?",Integer.class,id)==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Questão inexistente"); }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
    public record Classification(String topicId,String status,Double confidence,String origin,String reviewer,String evidence) {}
}
