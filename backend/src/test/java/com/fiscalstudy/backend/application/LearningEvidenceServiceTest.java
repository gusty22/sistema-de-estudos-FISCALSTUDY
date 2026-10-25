package com.fiscalstudy.backend.application;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
class LearningEvidenceServiceTest {
 @TempDir Path dir;
 JdbcTemplate jdbc; LearningEvidenceService service;
 @BeforeEach void setup(){var ds=new DriverManagerDataSource("jdbc:sqlite:"+dir.resolve("learning.db")); new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);jdbc=new JdbcTemplate(ds);service=new LearningEvidenceService(jdbc);}
 @Test void separatesUnexpectedResultFromCause(){assertEquals("EXPECTED_FORGETTING_POSSIBLE",LearningEvidenceService.pedagogicalSignal(false,.2));assertEquals("UNEXPECTED_ERROR_INVESTIGATE_CAUSE",LearningEvidenceService.pedagogicalSignal(false,.95));assertEquals("INSUFFICIENT_MEMORY_HISTORY",LearningEvidenceService.pedagogicalSignal(false,null));}
 @Test void eligibilityAndIdempotencyPreserveColdStart(){var t=Instant.parse("2026-01-01T12:00:00Z");service.projectAttempt("test","q",t,true,"AUTOMATED_TEST",5,false,Map.of());assertNull(service.preview("q").get("recallBefore"));service.projectAttempt("a","q",t,true,"REAL_STUDY",5,false,Map.of());service.projectAttempt("a","q",t,true,"REAL_STUDY",5,false,Map.of());assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));assertEquals(1,jdbc.queryForObject("SELECT reps FROM learning_memory_state",Integer.class));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM revision_calendar",Integer.class));}
 @Test void replayOutOfOrderDoesNotMoveMemoryBack(){var t=Instant.parse("2026-01-02T12:00:00Z");service.projectAttempt("a","q",t,true,"REAL_STUDY",5,false,Map.of());assertThrows(IllegalStateException.class,()->service.projectAttempt("old","q",t.minusSeconds(86400),false,"REAL_STUDY",5,false,Map.of()));assertEquals(t.toString(),jdbc.queryForObject("SELECT last_reviewed_at FROM learning_memory_state",String.class));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));}
 @Test void concurrentDistinctAttemptsAreBothProjected() throws Exception {var t=Instant.parse("2026-01-01T12:00:00Z");ExecutorService pool=Executors.newFixedThreadPool(2);try{var a=pool.submit(()->service.projectAttempt("a","q",t,true,"REAL_STUDY",5,false,Map.of()));var b=pool.submit(()->service.projectAttempt("b","q",t,true,"REAL_STUDY",5,false,Map.of()));a.get(10,TimeUnit.SECONDS);b.get(10,TimeUnit.SECONDS);assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));assertEquals(2,jdbc.queryForObject("SELECT reps FROM learning_memory_state",Integer.class));}finally{pool.shutdownNow();}}
 void confirmedTopic() {
  jdbc.update("INSERT INTO questions(id,enunciado) VALUES('q','Fixture')");
  jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto) VALUES('t','e','c','Tributário','Imunidade')");
  jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES('cl','q','t','CONFIRMED',1,'HUMAN','fixture','Verificado','2026-01-01T00:00:00Z')");
 }
 @Test void successfulNewRetrievalReplacesOldItemDueDateAndPriority() {
  confirmedTopic();var first=Instant.parse("2026-01-01T12:00:00Z");
  service.projectAttempt("error","q",first,false,"REAL_STUDY",5,false,Map.of("recallBefore",.95));
  var oldDue=jdbc.queryForObject("SELECT data_agendada FROM revision_calendar",String.class);
  service.projectAttempt("recovery","q",first.plusSeconds(86400),true,"REAL_STUDY",5,false,Map.of("recallBefore",.5));
  var due=jdbc.queryForObject("SELECT due_at FROM learning_memory_state",String.class);
  var expected=Instant.parse(due).atZone(java.time.ZoneId.of("America/Sao_Paulo")).toLocalDate().toString();
  assertEquals(expected,jdbc.queryForObject("SELECT data_agendada FROM revision_calendar",String.class));
  assertTrue(expected.compareTo(oldDue)>0);
  assertEquals(.5,jdbc.queryForObject("SELECT prioridade_score FROM revision_calendar",Double.class));
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM revision_calendar",Integer.class));
  service.projectAttempt("error","q",first,false,"REAL_STUDY",5,false,Map.of("recallBefore",.95));
  assertEquals(expected,jdbc.queryForObject("SELECT data_agendada FROM revision_calendar",String.class));
  assertEquals("UNEXPECTED_ERROR_INVESTIGATE_CAUSE",jdbc.queryForObject("SELECT pedagogical_signal FROM learning_evidence_projection WHERE attempt_id='error'",String.class));
 }
 @Test void freshAttemptReopensCompletedItemWithoutChangingUnrelatedRevision() {
  confirmedTopic();var t=Instant.parse("2026-01-01T12:00:00Z");
  service.projectAttempt("first","q",t,true,"REAL_STUDY",5,false,Map.of());
  jdbc.update("UPDATE revision_calendar SET status='CONCLUIDA'");
  jdbc.update("INSERT INTO revision_calendar(id,concurso_id,disciplina,topico,tipo_revisao,intervalo_dias,data_agendada,origem_evento,status) VALUES('manual','c','Tributário','Imunidade','MANUAL',1,'2026-01-01','MANUAL','PENDENTE')");
  service.projectAttempt("second","q",t.plusSeconds(86400),false,"REAL_STUDY",5,false,Map.of());
  assertEquals("PENDENTE",jdbc.queryForObject("SELECT status FROM revision_calendar WHERE id='fsrs-q-t'",String.class));
  assertEquals("2026-01-01",jdbc.queryForObject("SELECT data_agendada FROM revision_calendar WHERE id='manual'",String.class));
  assertEquals(.9,jdbc.queryForObject("SELECT prioridade_score FROM revision_calendar WHERE id='fsrs-q-t'",Double.class));
 }
 @Test void configuredTimeZoneChangesCalendarDayButNotMemoryInstant() {
  confirmedTopic();
  jdbc.update("INSERT INTO questions(id,enunciado) VALUES('q2','Segunda ocorrência')");
  jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES('cl2','q2','t','CONFIRMED',1,'HUMAN','fixture','Verificado','2026-01-01T00:00:00Z')");
  var instant=Instant.parse("2026-01-01T00:30:00Z");
  service.projectAttempt("sp","q",instant,true,"REAL_STUDY",5,false,Map.of());
  new LearningEvidenceService(jdbc,"UTC").projectAttempt("utc","q2",instant,true,"REAL_STUDY",5,false,Map.of());
  var due=jdbc.queryForObject("SELECT due_at FROM learning_memory_state WHERE question_id='q'",String.class);
  assertEquals(due,jdbc.queryForObject("SELECT due_at FROM learning_memory_state WHERE question_id='q2'",String.class));
  var utcDate=Instant.parse(due).atZone(java.time.ZoneId.of("UTC")).toLocalDate();
  var spDate=Instant.parse(due).atZone(java.time.ZoneId.of("America/Sao_Paulo")).toLocalDate();
  assertNotEquals(utcDate,spDate);
  assertEquals(utcDate.toString(),jdbc.queryForObject("SELECT data_agendada FROM revision_calendar WHERE source_id='q2'",String.class));
  assertEquals(spDate.toString(),jdbc.queryForObject("SELECT data_agendada FROM revision_calendar WHERE source_id='q'",String.class));
 }
 @Test void invalidTimeZoneFailsExplicitly() {
  assertThrows(java.time.DateTimeException.class,()->new LearningEvidenceService(jdbc,"Not/AZone"));
 }
}
