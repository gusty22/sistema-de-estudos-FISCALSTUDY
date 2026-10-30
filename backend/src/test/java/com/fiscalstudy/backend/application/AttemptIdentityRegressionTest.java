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
 @org.junit.jupiter.params.ParameterizedTest
 @org.junit.jupiter.params.provider.ValueSource(strings={"helpType","interventionType","causaErro","origin","naCordaBamba","pensouContrario","tempoLeituraMs","tempoHesitacaoMs","trocasOpcaoCount","distanciaCursorPx","friccaoCognitivaScore","chuteEducadoDetectado","fluenciaNeurologica","usedHelp"})
 void httpRetryRejectsChangedEvidence(String field) throws Exception {
  String id=UUID.randomUUID().toString();
  var request=new LinkedHashMap<String,Object>();
  request.put("attemptId",id);request.put("selectedOption","A");request.put("confidenceLevel",4);
  request.put("activeTimeMs",1200);request.put("sessionId","session-1");
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
    new com.fiscalstudy.backend.infrastructure.in.web.QuestionController(mock(QuestionSelectionService.class),service)).build();
  var mapper=new ObjectMapper();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/questions/q1/attempts")
    .contentType("application/json").content(mapper.writeValueAsString(request)))
    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  String persisted=events.findByEventId("attempt:"+id).orElseThrow().getPayloadJson();
  Object changed=switch(field){
   case "origin" -> "DEMONSTRATION";
   case "usedHelp" -> false; // unknown -> explicit no-help is a change of evidence
   case "naCordaBamba","pensouContrario","chuteEducadoDetectado" -> true;
   case "tempoLeituraMs","tempoHesitacaoMs","trocasOpcaoCount" -> 7;
   case "distanciaCursorPx","friccaoCognitivaScore" -> 0.25;
   default -> "CHANGED";
  };
  request.put(field,changed);
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/questions/q1/attempts")
    .contentType("application/json").content(mapper.writeValueAsString(request)))
    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict());
  assertEquals(persisted,events.findByEventId("attempt:"+id).orElseThrow().getPayloadJson());
  assertEquals(1,events.getAllEvents("ANSWER_SUBMITTED").size());
 }
 @Test void equivalentDefaultsAndWhitespaceRemainRetryable(){
  String id=UUID.randomUUID().toString();answer(id,"a","  cause  ");
  assertTrue(service.submitAttempt("q1"," A ",4,1200,"session-1",null,"cause",null,null,
    1200L,0L,0,0.0,0.0,false,"ALTA_FLUENCIA",false," NENHUM "," REGULAR ",id).getIsCorrect());
  assertEquals(1,events.getAllEvents("ANSWER_SUBMITTED").size());
 }
 @Test void conflictingConcurrentEvidenceHasOneWinner() throws Exception {
  String id=UUID.randomUUID().toString();
  events=spy(events);service=new AttemptSubmissionService(questions,events,"REAL_STUDY");
  var barrier=new CyclicBarrier(2);var reads=new java.util.concurrent.atomic.AtomicInteger();
  doAnswer(call->{if(reads.incrementAndGet()<=2){barrier.await(10,TimeUnit.SECONDS);return Optional.empty();}return call.callRealMethod();})
    .when(events).findByEventId("attempt:"+id);
  var pool=Executors.newFixedThreadPool(2);
  try {
   var results=pool.invokeAll(List.<Callable<String>>of(
    ()->{try{answer(id,"A","first");return "OK";}catch(AttemptSubmissionService.AttemptConflictException e){return "CONFLICT";}},
    ()->{try{answer(id,"A","second");return "OK";}catch(AttemptSubmissionService.AttemptConflictException e){return "CONFLICT";}}));
   assertEquals(Set.of("OK","CONFLICT"),Set.of(results.get(0).get(),results.get(1).get()));
  } finally {pool.shutdownNow();}
  assertEquals(1,events.getAllEvents("ANSWER_SUBMITTED").size());
 }
 @Test void legacyMissingHelpFlagRemainsUnknown() throws Exception {
  String sourceId=UUID.randomUUID().toString();
  service.submitAttempt("q1","A",4,1200,"session-1",null,null,false,false,null,null,null,null,null,null,null,null,null,null,sourceId);
  var original=events.findByEventId("attempt:"+sourceId).orElseThrow();
  var payload=(com.fasterxml.jackson.databind.node.ObjectNode)new ObjectMapper().readTree(original.getPayloadJson());
  String id=UUID.randomUUID().toString();payload.put("attemptId",id);payload.remove("helpDeclarationProvided");
  events.appendEventOnce("attempt:"+id,"ANSWER_SUBMITTED","QUESTION","q1","session-1",original.getOccurredAt(),payload.toString());
  assertTrue(service.submitAttempt("q1","A",4,1200,"session-1",null,null,false,false,null,null,null,null,null,null,null,null,null,null,id).getIsCorrect());
  assertThrows(AttemptSubmissionService.AttemptConflictException.class,()->answer(id,"A",null));
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
