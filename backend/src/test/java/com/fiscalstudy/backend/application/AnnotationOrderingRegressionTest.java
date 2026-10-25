package com.fiscalstudy.backend.application;

import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class AnnotationOrderingRegressionTest {
 private SingleConnectionDataSource ds;
 private JdbcTemplate jdbc;
 @BeforeEach void setup(){
  ds=new SingleConnectionDataSource("jdbc:sqlite::memory:",true);
  jdbc=new JdbcTemplate(ds);
  jdbc.execute("CREATE TABLE event_store(event_type TEXT,occurred_at TEXT,payload_json TEXT)");
 }
 @AfterEach void close(){ds.destroy();}
 private void annotation(String time,String cause){
  jdbc.update("INSERT INTO event_store VALUES('ATTEMPT_ANNOTATED',?,?)",time,
   "{\"attemptId\":\"a\",\"causaErro\":\""+cause+"\"}");
 }
 @Test void fractionAfterWholeSecondIsLatest(){
  annotation("2026-01-02T00:00:00Z","E1");
  annotation("2026-01-02T00:00:00.100Z","E3");
  assertEquals("E3",AttemptAnnotationView.latest(jdbc).get("a"));
 }
 @Test void nanosecondsTakePrecedenceOverInsertionOrder(){
  annotation("2026-01-02T00:00:00.123456789Z","E3");
  annotation("2026-01-02T00:00:00.123456788Z","E1");
  assertEquals("E3",AttemptAnnotationView.latest(jdbc).get("a"));
 }
 @Test void equivalentOffsetsUseAppendOrderAsTieBreaker(){
  annotation("2026-01-02T03:00:00+03:00","E1");
  annotation("2026-01-02T00:00:00.000Z","E3");
  assertEquals("E3",AttemptAnnotationView.latest(jdbc).get("a"));
 }
 @Test void identicalTimestampUsesAppendOrder(){
  annotation("2026-01-02T00:00:00Z","E1");
  annotation("2026-01-02T00:00:00Z","E3");
  assertEquals("E3",AttemptAnnotationView.latest(jdbc).get("a"));
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM event_store",Integer.class));
 }
 @Test void invalidTimestampFailsExplicitly(){
  annotation("not-a-timestamp","E1");
  assertThrows(IllegalStateException.class,()->AttemptAnnotationView.latest(jdbc));
 }
 @Test void missingTimestampFailsExplicitly(){
  annotation(null,"E1");
  assertThrows(IllegalStateException.class,()->AttemptAnnotationView.latest(jdbc));
 }
}
