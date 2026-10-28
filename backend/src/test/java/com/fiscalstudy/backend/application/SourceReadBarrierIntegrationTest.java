package com.fiscalstudy.backend.application;
import com.fiscalstudy.backend.infrastructure.config.SchemaMigration;
import com.fiscalstudy.backend.infrastructure.in.web.QuarantineSourceAccessFilter;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
class SourceReadBarrierIntegrationTest {
 @TempDir Path temp; JdbcTemplate jdbc;QuarantineSourceExposureService reads;
 @BeforeEach void setup()throws Exception{
  var ds=new DriverManagerDataSource("jdbc:sqlite:"+temp.resolve("isolated.db")+"?busy_timeout=10000");
  try(var c=ds.getConnection()){SchemaMigration.migrate(c);}jdbc=new JdbcTemplate(ds);reads=new QuarantineSourceExposureService(jdbc);
  jdbc.update("INSERT INTO questions(id,enunciado,options_json) VALUES('q','Synthetic','[]')");
 }
 void reserve(){jdbc.update("INSERT INTO diagnostic_reservation_events VALUES('root','res','q',null,'RESERVED','fixture','read barrier','2026-10-28T00:00:00Z','{}','EXTERNAL_EXPOSURE_UNKNOWN','synthetic','diagnostic-quarantine-v1')");}
 MockHttpServletRequest request(){var r=new MockHttpServletRequest("GET","/api/v1/materials/fixture/file");r.setRemoteAddr("127.0.0.1");r.setServerName("localhost");return r;}
 @Test void reservationCannotRaceAnInProgressBodyAndTransactionDoesNotSpanTransfer()throws Exception{
  var entered=new CountDownLatch(1);var finish=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try{
   var response=new MockHttpServletResponse();
   var body=pool.submit(()->{try{new QuarantineSourceAccessFilter(reads,"token").doFilter(request(),response,(a,b)->{
    entered.countDown();try{if(!finish.await(10,TimeUnit.SECONDS))throw new java.io.IOException("fixture timeout");}
    catch(InterruptedException e){Thread.currentThread().interrupt();throw new java.io.IOException(e);}b.getWriter().write("synthetic bytes");
   });}catch(Exception e){throw new RuntimeException(e);}});
   assertTrue(entered.await(5,TimeUnit.SECONDS));assertEquals(1,reads.openReads().size());
   // A separate DB writer finishes while the body is paused: no long SQLite read transaction.
   assertTrue(pool.submit(()->{try{reserve();return false;}catch(Exception refused){return true;}}).get(5,TimeUnit.SECONDS));
   assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM diagnostic_reservation_events",Integer.class));
   finish.countDown();body.get(5,TimeUnit.SECONDS);assertEquals("synthetic bytes",response.getContentAsString());
   assertTrue(reads.openReads().isEmpty());reserve();
   assertEquals("COMPROMISED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
  }finally{finish.countDown();pool.shutdownNow();}
 }
 @Test void protectedReservationFirstRefusesNewReadWithoutBytes(){
  reserve();assertThrows(Exception.class,()->reads.beginRead("/api/v1/materials/m/file"));assertTrue(reads.openReads().isEmpty());
 }
 @Test void interruptedReadSurvivesRestartAndDoesNotExpireClean(){
  String id=reads.beginRead("/api/v1/ingestion/unknown-copy");
  var restarted=new QuarantineSourceExposureService(jdbc);
  assertEquals(1,restarted.openReads().size());assertThrows(Exception.class,()->reserve());
  assertEquals("UNCERTAIN_CLOSED",restarted.finishRead(id,"UNCERTAIN_CLOSED"));
  assertEquals("UNCERTAIN_CLOSED",restarted.finishRead(id,"COMPLETED")); // cannot rewrite uncertainty
  reserve();assertEquals("COMPROMISED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
  assertThrows(Exception.class,()->jdbc.update("DELETE FROM diagnostic_source_read_events"));
 }
 @Test void cancellationAndTimeoutRemainPossibleExposure()throws Exception{
  var req=request();req.setAsyncSupported(true);
  new QuarantineSourceAccessFilter(reads,"token").doFilter(req,new MockHttpServletResponse(),(a,b)->req.startAsync(req,b));
  assertEquals(1,reads.openReads().size());
  var context=(MockAsyncContext)req.getAsyncContext();
  for(var listener:context.getListeners())listener.onTimeout(new jakarta.servlet.AsyncEvent(context));
  assertTrue(reads.openReads().isEmpty());reserve();
  assertEquals("COMPROMISED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
 }
 @Test void failedClosureKeepsOpenBarrierRatherThanInventingSuccess()throws Exception{
  jdbc.execute("CREATE TRIGGER fixture_failed_close BEFORE INSERT ON diagnostic_source_read_events WHEN NEW.phase!='OPEN' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  var response=new MockHttpServletResponse();
  new QuarantineSourceAccessFilter(reads,"token").doFilter(request(),response,(a,b)->b.getWriter().write("synthetic"));
  assertEquals("synthetic",response.getContentAsString());assertEquals(1,reads.openReads().size());assertThrows(Exception.class,()->reserve());
 }
 @Test void identitiesAndClosureAreAppendOnlyAndIdempotent(){
  String id=reads.beginRead("/api/v1/materials/m/file");
  assertEquals("ABORTED",reads.finishRead(id,"ABORTED"));assertEquals("ABORTED",reads.finishRead(id,"ABORTED"));
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM diagnostic_source_read_events",Integer.class));
  assertThrows(Exception.class,()->jdbc.update("UPDATE diagnostic_source_read_events SET phase='COMPLETED'"));
  assertThrows(Exception.class,()->reads.finishRead(UUID.randomUUID().toString(),"COMPLETED"));
 }
 @Test void administrativeEvidenceRoutesCannotBypassTokenUsingPathParameters()throws Exception{
  var auth=new com.fiscalstudy.backend.infrastructure.in.web.LocalAccessFilter("http://localhost:5173","fixture-token");
  for(String path:List.of("/api/v1/learning-lab/source-reads","/api/v1/learning-lab/item-provenance/exact",
   "/api/v1/learning-lab;legacy=true/source-reads","/api/v1/learning-lab;legacy=true/item-provenance/exact")){
   var req=new MockHttpServletRequest("GET",path);req.setRemoteAddr("127.0.0.1");req.setServerName("localhost");
   var response=new MockHttpServletResponse();auth.doFilter(req,response,(a,b)->fail("Admin token required"));
   assertEquals(403,response.getStatus());
  }
 }

}
