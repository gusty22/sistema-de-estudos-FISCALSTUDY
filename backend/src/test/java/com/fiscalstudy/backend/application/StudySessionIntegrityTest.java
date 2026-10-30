package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.config.SchemaMigration;
import com.fiscalstudy.backend.infrastructure.out.persistence.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudySessionIntegrityTest {
 @TempDir Path directory;
 Path database; JdbcTemplate jdbc; StudySessionService service; EventStoreRepositoryImpl events;
 ObjectMapper mapper;
 @BeforeEach void setup() throws Exception {
  var folder=java.nio.file.Files.createDirectories(directory.resolve("sessões com espaço"));
  database=folder.resolve("sessions.db");
  var ds=new DriverManagerDataSource("jdbc:sqlite:"+database+"?busy_timeout=10000");
  try(var c=ds.getConnection()){SchemaMigration.migrate(c);}
  jdbc=new JdbcTemplate(ds);events=new EventStoreRepositoryImpl(jdbc);mapper=spy(new ObjectMapper());
  service=new StudySessionService(events,new StudyMaterialRepositoryImpl(jdbc),mapper,"REAL_STUDY",jdbc);
  jdbc.update("INSERT INTO study_materials(id,titulo,disciplina,total_paginas,pagina_atual) VALUES('m','Synthetic material','Math',500,0)");
 }
 Map<String,Object> request(String id,int pages){return new LinkedHashMap<>(Map.of("sessionId",id,"materialId","m","durationSeconds",30,"paginasLidas",pages));}
 int pages(){return jdbc.queryForObject("SELECT pagina_atual FROM study_materials WHERE id='m'",Integer.class);}
 int count(){return events.getAllEvents("STUDY_SESSION_RECORDED").size();}
 @Test void lostAcknowledgmentReplaysWithoutIncrementingProgress(){
  var request=request("s1",5);var first=service.recordStudySession(request);
  assertEquals(first,service.recordStudySession(request));assertEquals(5,pages());assertEquals(1,count());
 }
 @Test void eventFailureRollsBackProgressAndRetryRecovers(){
  jdbc.execute("CREATE TRIGGER fail_event BEFORE INSERT ON event_store WHEN NEW.event_type='STUDY_SESSION_RECORDED' BEGIN SELECT RAISE(ABORT,'injected event failure'); END");
  assertThrows(RuntimeException.class,()->service.recordStudySession(request("s1",5)));
  assertEquals(0,pages());assertEquals(0,count());
  jdbc.execute("DROP TRIGGER fail_event");service.recordStudySession(request("s1",5));assertEquals(5,pages());assertEquals(1,count());
 }
 @Test void progressFailureLeavesNoEventAndRetryRecovers(){
  jdbc.execute("CREATE TRIGGER fail_progress BEFORE UPDATE ON study_materials BEGIN SELECT RAISE(ABORT,'injected progress failure'); END");
  assertThrows(RuntimeException.class,()->service.recordStudySession(request("s1",5)));
  assertEquals(0,pages());assertEquals(0,count());
  jdbc.execute("DROP TRIGGER fail_progress");service.recordStudySession(request("s1",5));assertEquals(5,pages());assertEquals(1,count());
 }
 @Test void conflictingRetryDoesNotChangeEvidence(){
  service.recordStudySession(request("s1",5));String payload=events.getAllEventPayloads("STUDY_SESSION_RECORDED").get(0);
  var ex=assertThrows(ResponseStatusException.class,()->service.recordStudySession(request("s1",7)));
  assertEquals(409,ex.getStatusCode().value());assertEquals(5,pages());assertEquals(List.of(payload),events.getAllEventPayloads("STUDY_SESSION_RECORDED"));
 }
 @Test void serializationFailureCannotCommitEmptyEvidence() throws Exception {
  doThrow(new com.fasterxml.jackson.core.JsonProcessingException("injected serialization failure"){}).when(mapper).writeValueAsString(any());
  assertThrows(RuntimeException.class,()->service.recordStudySession(request("s1",5)));
  assertEquals(0,pages());assertEquals(0,count());
 }
 @Test void receiptFailureRollsBackBothEventAndProgress(){
  jdbc.execute("CREATE TRIGGER fail_receipt BEFORE UPDATE ON study_session_recordings BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END");
  assertThrows(RuntimeException.class,()->service.recordStudySession(request("s1",5)));
  assertEquals(0,pages());assertEquals(0,count());
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM study_session_recordings",Integer.class));
  jdbc.execute("DROP TRIGGER fail_receipt");service.recordStudySession(request("s1",5));assertEquals(5,pages());assertEquals(1,count());
 }
 @Test void committedRetrySurvivesNewServiceAndConnection(){
  var first=service.recordStudySession(request("s1",5));
  var secondJdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:sqlite:"+database+"?busy_timeout=10000"));
  var second=new StudySessionService(new EventStoreRepositoryImpl(secondJdbc),new StudyMaterialRepositoryImpl(secondJdbc),new ObjectMapper(),"REAL_STUDY",secondJdbc);
  assertEquals(first,second.recordStudySession(request("s1",5)));assertEquals(5,pages());assertEquals(1,count());
 }
 @Test void historicalRecordingAndProgressAreNotRewritten() throws Exception {
  var historical=request("legacy",5);historical.put("origin","REAL_STUDY");
  String payload=mapper.writeValueAsString(historical);
  events.appendEvent("STUDY_SESSION_RECORDED","STUDY_SESSION","legacy","legacy",1,"v1",payload);
  jdbc.update("UPDATE study_materials SET pagina_atual=5 WHERE id='m'");
  service.recordStudySession(request("legacy",5));
  assertEquals(5,pages());assertEquals(List.of(payload),events.getAllEventPayloads("STUDY_SESSION_RECORDED"));
  assertThrows(ResponseStatusException.class,()->service.recordStudySession(request("legacy",6)));
 }
 @Test void concurrentIdenticalRequestsHaveOneEffect() throws Exception {concurrent(false);assertEquals(5,pages());assertEquals(1,count());}
 @Test void concurrentDifferentSessionsDoNotLoseProgress() throws Exception {concurrent(true);assertEquals(60,pages());assertEquals(12,count());}
 void concurrent(boolean distinct) throws Exception {
  var pool=Executors.newFixedThreadPool(12);var start=new CountDownLatch(1);var jobs=new ArrayList<Callable<Map<String,Object>>>();
  var other=new StudySessionService(events,new StudyMaterialRepositoryImpl(jdbc),new ObjectMapper(),"REAL_STUDY",jdbc);
  for(int i=0;i<12;i++){var target=i%2==0?service:other;String id=distinct?"s"+i:"same";jobs.add(()->{start.await();return target.recordStudySession(request(id,5));});}
  try {var futures=new ArrayList<Future<Map<String,Object>>>();for(var job:jobs)futures.add(pool.submit(job));start.countDown();for(var f:futures)f.get(20,TimeUnit.SECONDS);}
  finally{pool.shutdownNow();}
 }
}
