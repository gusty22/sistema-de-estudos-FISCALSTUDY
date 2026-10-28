package com.fiscalstudy.backend.application;
import com.fiscalstudy.backend.infrastructure.config.SchemaMigration;
import com.fiscalstudy.backend.infrastructure.out.persistence.QuestionRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.in.web.DiagnosticQuarantineController;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class DiagnosticQuarantineIntegrationTest {
 @TempDir Path temp; JdbcTemplate jdbc; DriverManagerDataSource ds;
 @BeforeEach void setup() throws Exception {
  ds=new DriverManagerDataSource("jdbc:sqlite:"+temp.resolve("isolated.db")+"?busy_timeout=10000");
  try(var c=ds.getConnection()){SchemaMigration.migrate(c);}
  jdbc=new JdbcTemplate(ds);
  for(String id:List.of("held","duplicate","open")) jdbc.update(
   "INSERT INTO questions(id,enunciado,options_json,correct_option,disciplina,assunto,status) VALUES(?,?,?,?,?,?,?)",
   id,id.equals("open")?"Open synthetic":"Held synthetic","[\"A yes\",\"B no\",\"C third\",\"D fourth\"]","A","Math","Fractions","VALIDADA");
 }
 void reserve() { append("root","res","held",null,"RESERVED","2026-10-27T00:00:00Z"); }
 void append(String event,String reservation,String question,String previous,String state,String time) {
  jdbc.update("INSERT INTO diagnostic_reservation_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
   event,reservation,question,previous,state,"fixture-protocol","Synthetic leakage test",time,
   "{}","EXTERNAL_EXPOSURE_UNKNOWN","Explicit synthetic test","diagnostic-quarantine-v1");
 }
 @Test void sharedViewHidesExactCopiesAndDirectRepositoryAccess() {
  reserve();
  assertEquals(List.of("open"),jdbc.queryForList("SELECT id FROM study_questions ORDER BY id",String.class));
  assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM questions",Integer.class)); // authorized maintenance retains data
  var repository=new QuestionRepositoryImpl(jdbc);
  assertTrue(repository.findById("held").isEmpty());assertTrue(repository.findById("duplicate").isEmpty());
  assertEquals("open",repository.findNextAvailableQuestion().orElseThrow().getId());
  assertTrue(repository.findQuestionBatch("session",null,null,null,true,20).stream().allMatch(q->q.getId().equals("open")));
  assertTrue(new QuestionClassificationService(jdbc).questions(false,100,0).stream().allMatch(q->q.get("id").equals("open")));
 }
 @Test void bankAndPreviouslyMaterializedNotebooksCannotExposeReservedIdentifiers() {
  reserve();var bank=new QuestionBankService(jdbc);
  var result=bank.searchQuestions(null,null,null,null,null,null,null,null,null,null,false,0,100);
  assertFalse(result.toString().contains("Held synthetic"));
  assertThrows(IllegalArgumentException.class,()->bank.saveNotebook(Map.of("nome","bad","questionIds",List.of("held"))));
  jdbc.update("INSERT INTO study_notebooks(id,nome,questoes_ids_json,filtros_json) VALUES(?,?,?,?)",
   "cached","Cached","[\"held\",\"duplicate\",\"open\"]","{\"questionIds\":[\"held\",\"open\"]}");
  var notebook=bank.getNotebooks(null).stream().filter(n->"cached".equals(n.get("id"))).findFirst().orElseThrow();
  assertEquals(List.of("open"),notebook.get("questionIds"));
  assertEquals(List.of("open"),((Map<?,?>)notebook.get("filtros")).get("questionIds"));
 }
 @Test void directEventsAndClassificationChangesAreRefusedWithoutTouchingHistory() {
  reserve();
  for(String type:List.of("QUESTION_PRESENTED","ANSWER_SUBMITTED","PREDICTION_COMMITTED")) {
   assertThrows(Exception.class,()->jdbc.update("INSERT INTO event_store VALUES(?,?,?,?,?,?,?,?,?,?)",
    UUID.randomUUID().toString(),type,"QUESTION","held","session","2026-10-27T01:00:00Z","2026-10-27T01:00:00Z",1,"v1","{}"));
  }
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM event_store",Integer.class));
  assertThrows(Exception.class,()->jdbc.update("UPDATE questions SET correct_option='B' WHERE id='held'"));
  assertThrows(Exception.class,()->jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES('link','held','topic','CONFIRMED',1,'HUMAN','fixture','fixture','2026-10-27T01:00:00Z')"));
 }
 @Test void transitionsAreAppendOnlyVersionedAndCompromiseDoesNotSilentlyRelease() {
  reserve();
  append("compromised","res","held","root","COMPROMISED","2026-10-27T01:00:00Z");
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM study_questions",Integer.class));
  assertThrows(Exception.class,()->append("fork","res","held","root","RELEASED","2026-10-27T02:00:00Z"));
  assertThrows(Exception.class,()->jdbc.update("DELETE FROM diagnostic_reservation_events"));
  assertThrows(Exception.class,()->jdbc.update("UPDATE diagnostic_reservation_events SET state='RELEASED'"));
  append("released","res","held","compromised","RELEASED","2026-10-27T02:00:00Z");
  assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM study_questions",Integer.class));
  assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM diagnostic_reservation_events",Integer.class));
 }
 @Test void duplicateReservationConcurrencyAndMissingQuestionFailClosed() throws Exception {
  var pool=Executors.newFixedThreadPool(2);
  try {
   var tasks=List.<Callable<Boolean>>of(
    ()->{try{append("one","res1","held",null,"RESERVED","2026-10-27T00:00:00Z");return true;}catch(Exception e){return false;}},
    ()->{try{append("two","res2","held",null,"RESERVED","2026-10-27T00:00:00Z");return true;}catch(Exception e){return false;}});
   int accepted=0;for(var result:pool.invokeAll(tasks)) if(result.get())accepted++;
   assertEquals(1,accepted);
  } finally {pool.shutdownNow();}
  assertThrows(Exception.class,()->append("missing","other","absent",null,"RESERVED","2026-10-27T00:00:00Z"));
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM diagnostic_reservation_events",Integer.class));
 }
 @Test void migrationAndRestartPreservePolicyAndReservationHistory() throws Exception {
  reserve();try(var c=ds.getConnection()){SchemaMigration.migrate(c);}
  var restarted=new JdbcTemplate(new DriverManagerDataSource(ds.getUrl()));
  assertEquals(1,restarted.queryForObject("SELECT COUNT(*) FROM study_questions",Integer.class));
  assertEquals(1,restarted.queryForObject("SELECT COUNT(*) FROM diagnostic_reservation_events",Integer.class));
  assertFalse((Boolean)new DiagnosticQuarantineController().status().get("reservationCreationEnabled"));
 }
 @Test void ankiCopiesWithKnownItemIdentityAreExcludedWithoutNetworkCalls() {
  jdbc.update("INSERT INTO anki_flashcards(id,disciplina,assunto,deck_name,card_type,front_or_text,back_or_extra,source_type,source_id) VALUES('card','Math','Fractions','Fixture','BASIC','Held synthetic','A','QUESTION','held')");
  reserve();
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM study_anki_flashcards",Integer.class));
  var anki=new AnkiIntegrationService(jdbc,org.mockito.Mockito.mock(com.fiscalstudy.backend.domain.EventStoreRepository.class),new ObjectMapper());
  assertFalse(anki.exportToCsv(null).contains("Held synthetic"));
 }
 @Test void observedExposurePreventsRetroactiveReservationAndTransactionRollbackLeavesNoHold() throws Exception {
  jdbc.update("INSERT INTO event_store VALUES('seen','QUESTION_PRESENTED','QUESTION','held','s','2026-10-26T00:00:00Z','2026-10-26T00:00:00Z',1,'v1','{}')");
  assertThrows(Exception.class,()->reserve());
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM diagnostic_reservation_events",Integer.class));
  try(var c=ds.getConnection()) {
   c.setAutoCommit(false);
   try(var statement=c.createStatement()) {
    statement.executeUpdate("INSERT INTO diagnostic_reservation_events VALUES('rolled','other','open',null,'RESERVED','fixture-protocol','Synthetic leakage test','2026-10-27T00:00:00Z','{}','EXTERNAL_EXPOSURE_UNKNOWN','Rollback fixture','diagnostic-quarantine-v1')");
   }
   c.rollback();
  }
  assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM study_questions",Integer.class));
 }
 @Test void strategicSimuladoUsesTheSameCentralPolicy() {
  reserve();
  var result=new StrategicSimuladoService(jdbc).generateStrategicSimulado(Map.of("quantidade",10,"disciplinas",List.of("Math")));
  assertEquals(List.of("open"),result.get("questionIds"));
 }

 @Test void realGlobalAdvicePreservesQuarantine404AndDoesNotWriteEvidence() throws Exception {
  reserve();
  var repository=new QuestionRepositoryImpl(jdbc);
  var events=new com.fiscalstudy.backend.infrastructure.out.persistence.EventStoreRepositoryImpl(jdbc);
  var attempts=new AttemptSubmissionService(repository,events,"REAL_STUDY");
  var memory=new LearningEvidenceService(jdbc);
  var ledger=new ProspectivePredictionService(jdbc,events,repository,attempts,memory,java.time.Clock.systemUTC(),"SYNTHETIC_FIXTURE");
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
   new com.fiscalstudy.backend.infrastructure.in.web.ProspectivePredictionController(ledger),
   new com.fiscalstudy.backend.infrastructure.in.web.QuestionController(new QuestionSelectionService(repository,events),attempts))
   .setControllerAdvice(new com.fiscalstudy.backend.infrastructure.in.web.GlobalExceptionHandler()).build();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/questions/held/predictions")
   .contentType("application/json").content("{\"attemptId\":\""+UUID.randomUUID()+"\",\"sessionId\":\"fixture\"}"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound())
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.error").value("REQUEST_REFUSED"));
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/questions/held/presented")
   .contentType("application/json").content("{\"sessionId\":\"fixture\"}"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound());
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM event_store",Integer.class));
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));
 }

 @Test void classificationCoverageUsesTheSameAvailableQuestionDenominator() {
  jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto) VALUES('topic','edital','contest','Math','Fractions')");
  var classifications=new QuestionClassificationService(jdbc);
  classifications.classify("held",new QuestionClassificationService.Classification("topic","CONFIRMED",1.0,"HUMAN","fixture","Synthetic reviewed link"));
  reserve();
  var coverage=classifications.coverage(null);
  assertEquals(1L,((Number)coverage.get("totalQuestions")).longValue());
  assertEquals(0L,((Number)coverage.get("classifiedQuestions")).longValue());
  assertEquals(0.0,((Number)coverage.get("coverage")).doubleValue());
 }

}
