package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.*;
import com.fiscalstudy.backend.infrastructure.out.persistence.EventStoreRepositoryImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AttemptIdentityRegressionTest {
 @TempDir Path dir;
 JdbcTemplate jdbc; EventStoreRepositoryImpl events; AttemptSubmissionService service; QuestionRepository questions;
 @BeforeEach void setup(){
  var ds=new DriverManagerDataSource("jdbc:sqlite:"+dir.resolve("events.db")+"?busy_timeout=10000");
  jdbc=new JdbcTemplate(ds);
  jdbc.execute("CREATE TABLE event_store(event_id TEXT PRIMARY KEY,event_type TEXT,aggregate_type TEXT,aggregate_id TEXT,session_id TEXT,occurred_at TEXT,recorded_at TEXT,event_version INTEGER,schema_version TEXT,payload_json TEXT)");
  events=new EventStoreRepositoryImpl(jdbc); questions=mock(QuestionRepository.class);
  when(questions.findById("q1")).thenReturn(Optional.of(new Question("q1","Question",List.of("A yes","B no"),"A","Math","Fractions","FCC",2026)));
  service=new AttemptSubmissionService(questions,events,"REAL_STUDY");
 }
 AttemptResult answer(String id,String option,String cause){return service.submitAttempt("q1",option,4,1200,"session-1",null,cause,false,false,null,null,null,null,null,null,null,false,"NENHUM","REGULAR",id);}
 @Test void retryIsStableAndNewAttemptIsPreserved(){
  String id=UUID.randomUUID().toString();
  assertTrue(answer(id,"A",null).getIsCorrect());
  assertTrue(answer(id,"A",null).getIsCorrect());
  assertThrows(AttemptSubmissionService.AttemptConflictException.class,()->answer(id,"B",null));
  assertFalse(answer(UUID.randomUUID().toString(),"B",null).getIsCorrect());
  assertEquals(2,events.getAllEvents("ANSWER_SUBMITTED").size());
 }
 @Test void replayUsesPersistedAnswerKey(){
  String id=UUID.randomUUID().toString(); answer(id,"A",null);
  when(questions.findById("q1")).thenReturn(Optional.of(new Question("q1","Changed",List.of("A yes","B no"),"B","Math","Fractions","FCC",2026)));
  assertTrue(answer(id,"A",null).getIsCorrect()); assertEquals("A",answer(id,"A",null).getCorrectOption());
 }
 @Test void arbitraryTextIsValidJsonAndAnnotationIsAppendOnly() throws Exception {
  String id=UUID.randomUUID().toString(); String text="quote \" backslash \\ newline\n tab\t";
  answer(id,"B",text);
  var original=events.findByEventId("attempt:"+id).orElseThrow();
  assertEquals(text.trim(),new ObjectMapper().readTree(original.getPayloadJson()).path("causaErro").asText());
  String aid=UUID.randomUUID().toString();
  service.annotateAttempt("q1",id,aid,"session-1","Interpretação");
  service.annotateAttempt("q1",id,aid,"session-1","Interpretação");
  assertEquals(1,events.getAllEvents("ATTEMPT_ANNOTATED").size());
  assertEquals(original.getPayloadJson(),events.findByEventId("attempt:"+id).orElseThrow().getPayloadJson());
  assertThrows(AttemptSubmissionService.AttemptConflictException.class,()->service.annotateAttempt("q1",id,aid,"session-1","Outra causa"));
 }
 @Test void concurrentRetriesInsertOnlyOnce() throws Exception {
  String id=UUID.randomUUID().toString(); var pool=Executors.newFixedThreadPool(6);
  try {var jobs=new ArrayList<Callable<AttemptResult>>();for(int i=0;i<12;i++)jobs.add(()->answer(id,"A",null));for(var result:pool.invokeAll(jobs))assertTrue(result.get().getIsCorrect());}
  finally {pool.shutdownNow();}
  assertEquals(1,events.getAllEvents("ANSWER_SUBMITTED").size());
 }
 @Test void clientCannotUpgradeAutomatedInstance(){
  var testService=new AttemptSubmissionService(questions,events,"AUTOMATED_TEST");
  assertEquals(EventOrigin.AUTOMATED_TEST,testService.resolveOrigin("REAL_STUDY","session-1"));
  assertEquals(EventOrigin.AUTOMATED_TEST,service.resolveOrigin("REAL_STUDY","test-fixture"));
  assertEquals(EventOrigin.DEMONSTRATION,service.resolveOrigin("DEMONSTRATION","session-1"));
 }
 @Test void projectionFailureKeepsEventAndRetryRecovers(){
  var projector=mock(LearningEvidenceService.class);
  when(projector.preview("q1")).thenReturn(Map.of("evidenceStatus","PRIOR"));
  org.springframework.test.util.ReflectionTestUtils.setField(service,"learningEvidenceService",projector);
  doThrow(new IllegalStateException("projection failed")).doNothing().when(projector).projectAttempt(anyString(),eq("q1"),any(),any(),anyString(),anyInt(),anyBoolean(),anyMap());
  String id=UUID.randomUUID().toString();
  var ex=assertThrows(AttemptSubmissionService.LearningProjectionPendingException.class,()->answer(id,"A",null));
  assertEquals(id,ex.getAttemptId()); assertEquals(1,events.getAllEvents("ANSWER_SUBMITTED").size());
  assertTrue(answer(id,"A",null).getIsCorrect()); assertEquals(1,events.getAllEvents("ANSWER_SUBMITTED").size());
  verify(projector,times(2)).projectAttempt(eq(id),eq("q1"),any(),eq(true),eq("REAL_STUDY"),eq(4),eq(false),anyMap());
 }
 @Test void automatedAttemptCannotTriggerExternalIntegration(){
  var anki=mock(AnkiIntegrationService.class);
  service=new AttemptSubmissionService(questions,events,"AUTOMATED_TEST",anki);
  answer(UUID.randomUUID().toString(),"B",null);
  verifyNoInteractions(anki); assertEquals(0,events.countPreviousAttempts("q1"));
 }
 @Test void laterAnnotationAppearsInSessionSummary(){
  String id=UUID.randomUUID().toString();answer(id,"B",null);
  service.annotateAttempt("q1",id,UUID.randomUUID().toString(),"session-1","E3: confusão");
  var controller=new com.fiscalstudy.backend.infrastructure.in.web.SessionController(events);
  assertEquals(1,controller.getSessionSummary("session-1").getBody().getErrorDistribution().get("E3: confusão"));
 }
 @Test void personalQueryExcludesTestDemoUnknownAndMalformed() {
  events.appendEvent("ANSWER_SUBMITTED","QUESTION","q1","s",1,"v1","{\"origin\":\"AUTOMATED_TEST\"}");
  events.appendEvent("ANSWER_SUBMITTED","QUESTION","q1","s",1,"v1","{\"origin\":\"DEMONSTRATION\"}");
  events.appendEvent("ANSWER_SUBMITTED","QUESTION","q1","s",1,"v1","{}");
  events.appendEvent("ANSWER_SUBMITTED","QUESTION","q1","s",1,"v1","not json");
  answer(UUID.randomUUID().toString(),"A",null);
  var rows=LearningEventEligibility.query(jdbc,"SELECT e.* FROM event_store e WHERE e.event_type=?","ANSWER_SUBMITTED");
  assertEquals(1,rows.size()); assertEquals(5,events.getAllEvents("ANSWER_SUBMITTED").size());
 }
 @Test void rawAttemptHistoryKeepsOriginAndAnnotations(){
  String id=UUID.randomUUID().toString();answer(id,"B",null);
  service.annotateAttempt("q1",id,UUID.randomUUID().toString(),"session-1","E3");
  var history=service.getAttemptHistory("q1",id);
  assertEquals("REAL_STUDY",history.get("origin")); assertEquals(1,((List<?>)history.get("annotations")).size());
 }
}
