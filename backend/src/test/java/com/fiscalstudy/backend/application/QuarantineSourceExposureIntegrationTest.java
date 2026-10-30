package com.fiscalstudy.backend.application;
import com.fiscalstudy.backend.infrastructure.config.*;
import com.fiscalstudy.backend.infrastructure.in.web.QuarantineSourceAccessFilter;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.*;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
class QuarantineSourceExposureIntegrationTest {
 @TempDir Path temp; JdbcTemplate jdbc; QuarantineSourceExposureService exposures; DatabasePaths paths;
 @BeforeEach void setup()throws Exception {
  var ds=new DriverManagerDataSource("jdbc:sqlite:"+temp.resolve("main.db")+"?busy_timeout=10000");
  try(var c=ds.getConnection()){SchemaMigration.migrate(c);}
  jdbc=new JdbcTemplate(ds);exposures=new QuarantineSourceExposureService(jdbc);
  paths=new DatabasePaths(new MockEnvironment().withProperty("spring.datasource.url","jdbc:sqlite:"+temp.resolve("main.db"))
   .withProperty("fiscalstudy.staging-db",temp.resolve("staging.db").toString()).withProperty("fiscalstudy.acervo-root",temp.resolve("materials").toString()));
  paths.createDirectories();StagingSchemaMigration.migrate(paths.stagingDatabase());
  jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option) VALUES('held','SYNTHETIC_SOURCE_ITEM','[]','A')");
 }
 void reserve(){jdbc.update("INSERT INTO diagnostic_reservation_events VALUES('root','res','held',null,'RESERVED','fixture','source test','2026-10-27T00:00:00Z','{}','EXTERNAL_EXPOSURE_UNKNOWN','synthetic','diagnostic-quarantine-v1')");}
 MockHttpServletRequest request(String path,boolean acknowledged,String id) {
  var r=new MockHttpServletRequest("GET",path);r.setRemoteAddr("127.0.0.1");r.setServerName("localhost");
  if(acknowledged){r.addHeader("X-FiscalStudy-Admin-Token","fixture-token");r.addHeader("X-FiscalStudy-Maintenance-Intent","ACKNOWLEDGE_EXPOSURE");r.addHeader("X-FiscalStudy-Exposure-Id",id);}
  return r;
 }
 int count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class);}
 @Test void ordinaryReadAndTokenAloneCannotExposeUnknownSources()throws Exception {
  reserve();var filter=new QuarantineSourceAccessFilter(exposures,"fixture-token");
  for(String path:List.of("/api/v1/materials/m/file","/api/v1/ingestion/staging-files/f/page-image","/api/v1/ingestion/sessions/s/questions","/api/v1/anki/export-csv","/api/v1/system/search","/api/v1/system/search;legacy=true","/api/v1/%6daterials/m/file","/api/v1/analytics/export/events-v1")) {
   var req=request(path,false,null);req.addHeader("X-FiscalStudy-Admin-Token","fixture-token");
   var response=new MockHttpServletResponse();
   filter.doFilter(req,response,(a,b)->fail("No content may leave"));
   assertEquals(409,response.getStatus());assertTrue(response.getHeader("Cache-Control").contains("no-store"));
  }
  assertEquals(0,count("diagnostic_source_exposures"));
 }
 @Test void authorizedMaintenanceCommitsCompromiseBeforeBodyAndRetriesAreIdempotent()throws Exception {
  reserve();var filter=new QuarantineSourceAccessFilter(exposures,"fixture-token");String id=UUID.randomUUID().toString();
  for(int n=0;n<2;n++) {
   var response=new MockHttpServletResponse();
   filter.doFilter(request("/api/v1/materials/m/file",true,id),response,(a,b)->{
    assertEquals("COMPROMISED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
    assertEquals(1,count("diagnostic_source_exposures"));
    QuestionAccessPolicy.requireUnmappedSourceRead(jdbc);
    b.getWriter().write("SYNTHETIC_SOURCE_ITEM");
   });
   assertEquals(200,response.getStatus());assertEquals("SYNTHETIC_SOURCE_ITEM",response.getContentAsString());
  }
  assertEquals(2,count("diagnostic_reservation_events"));
  assertThrows(ResponseStatusException.class,()->QuestionAccessPolicy.requireUnmappedSourceRead(jdbc)); // no ThreadLocal leak
  assertThrows(Exception.class,()->jdbc.update("DELETE FROM diagnostic_source_exposures"));
  assertThrows(Exception.class,()->jdbc.update("UPDATE diagnostic_source_exposures SET resource_path='changed'"));
 }
 @Test void missingAuthorizationAndFailedPersistenceNeverReleaseBytes()throws Exception {
  reserve();var filter=new QuarantineSourceAccessFilter(exposures,"fixture-token");
  var request=request("/api/v1/materials/m/file",true,UUID.randomUUID().toString());
  request.setRemoteAddr("10.0.0.2");var forbidden=new MockHttpServletResponse();
  filter.doFilter(request,forbidden,(a,b)->fail("Remote maintenance forbidden"));assertEquals(403,forbidden.getStatus());
  jdbc.execute("CREATE TRIGGER fixture_fail BEFORE INSERT ON diagnostic_source_exposures BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  var failed=new MockHttpServletResponse();
  filter.doFilter(request("/api/v1/materials/m/file",true,UUID.randomUUID().toString()),failed,(a,b)->fail("Commit failed"));
  assertEquals(503,failed.getStatus());assertEquals(0,count("diagnostic_source_exposures"));
  assertEquals("RESERVED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
 }
 @Test void stagingWithDifferentIdsAndUnclassifiedVariantsFailsClosedBeforeFileRead()throws Exception {
  reserve();
  try(var c=DriverManager.getConnection("jdbc:sqlite:"+paths.stagingDatabase());var s=c.createStatement()) {
   s.execute("INSERT INTO staging_files(id,rel_path,filename,file_size_bytes,sha256,total_pages) VALUES('f','source.pdf','source.pdf',1,'synthetic-hash',1)");
   s.execute("INSERT INTO staging_documents(id,file_id,doc_role,page_start,page_end) VALUES('d','f','PROVA',1,1)");
   s.execute("INSERT INTO staging_questions(id,document_id,numero_original,statement,options_json,pages_json) VALUES('different-id','d',1,'SYNTHETIC_SOURCE_ITEM','[]','[1]')");
  }
  var staging=new StagingDatabaseService(jdbc,paths);
  assertThrows(ResponseStatusException.class,()->staging.getQuestionsForFile("f"));
  assertThrows(ResponseStatusException.class,()->staging.getPdfPathForStagingFile("f"));
  assertThrows(ResponseStatusException.class,()->staging.renderPageImageForFile("f",1));
  var pipeline=new IngestionPipelineService(jdbc);
  assertThrows(ResponseStatusException.class,()->pipeline.getSessionQuestions("any-id"));
  assertThrows(ResponseStatusException.class,()->pipeline.getEvidenceImage("unknown-variant","source.png"));
  assertEquals(0,count("diagnostic_source_exposures")); // denying is not evidence that a source was seen
 }
 @Test void receiptCannotBeReusedForAnotherResourceOrNewReservation() {
  String id=UUID.randomUUID().toString();
  exposures.commitMaintenanceExposure(id,"/api/v1/materials/m/file");
  reserve();
  assertThrows(ResponseStatusException.class,()->exposures.commitMaintenanceExposure(id,"/api/v1/materials/m/file"));
  assertThrows(ResponseStatusException.class,()->exposures.commitMaintenanceExposure(id,"/api/v1/materials/other/file"));
  assertEquals("RESERVED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
 }
 @Test void concurrentRetriesPreserveSingleReceiptAndSingleCompromise()throws Exception {
  reserve();String id=UUID.randomUUID().toString();var pool=Executors.newFixedThreadPool(2);
  try {
   var task=(Callable<Boolean>)()->{for(int n=0;n<3;n++){try{exposures.commitMaintenanceExposure(id,"/api/v1/materials/m/file");return true;}catch(org.springframework.dao.DataAccessException busy){}}return false;};
   var results=pool.invokeAll(List.of(task,task));
   assertTrue(results.get(0).get()||results.get(1).get());
   exposures.commitMaintenanceExposure(id,"/api/v1/materials/m/file");
   assertEquals(1,count("diagnostic_source_exposures"));assertEquals(2,count("diagnostic_reservation_events"));
  }finally{pool.shutdownNow();}
 }
 @Test void metadataAndNormalNoHoldReadsRemainUsableAndRestartKeepsAudit()throws Exception {
  var filter=new QuarantineSourceAccessFilter(exposures,"fixture-token");
  var response=new MockHttpServletResponse();
  filter.doFilter(request("/api/v1/materials/m/file",false,null),response,(a,b)->b.getWriter().write("allowed"));
  assertEquals("allowed",response.getContentAsString());reserve();
  var metadata=new MockHttpServletResponse();
  filter.doFilter(request("/api/v1/ingestion/staging-files",false,null),metadata,(a,b)->b.getWriter().write("metadata"));
  assertEquals("metadata",metadata.getContentAsString());
  exposures.commitMaintenanceExposure(UUID.randomUUID().toString(),"/api/v1/materials/m/file");
  var restarted=new QuarantineSourceExposureService(jdbc);assertTrue(restarted.hasActiveHolds());
  assertEquals(1,count("diagnostic_source_exposures"));
 }
 @Test void explicitCloudConsentCannotBypassAnActiveHold()throws Exception {
  reserve();
  var requests=new java.util.concurrent.atomic.AtomicInteger();
  var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/",e->{requests.incrementAndGet();e.sendResponseHeaders(200,0);e.close();});server.start();
  try {
   var anki=new AnkiIntegrationService(jdbc,org.mockito.Mockito.mock(com.fiscalstudy.backend.domain.EventStoreRepository.class),new com.fasterxml.jackson.databind.ObjectMapper());
   anki.setAnkiEndpoint("http://127.0.0.1:"+server.getAddress().getPort());
   anki.updateIntegrationPreferences(Map.of("enabled",true,"cloudSyncEnabled",true));
   jdbc.update("INSERT INTO system_settings VALUES('privacidade','{\"armazenamentoLocalEstrito\":false}','2026-10-27T00:00:00Z')");
   assertThrows(ResponseStatusException.class,anki::triggerAnkiWebSync);
   assertThrows(ResponseStatusException.class,()->anki.sendNoteToAnkiConnect("fixture","BASIC","synthetic","synthetic",List.of()));
   assertEquals(0,requests.get());
  }finally{server.stop(0);}
 }

 @Test void failedMigrationPreservesHistoryAndVerifiedBackupThenRecovers()throws Exception {
  reserve();
  // Disposable v5-like baseline plus deliberately incompatible receipt object.
  // No receipts exist; no original/personal database is touched.
  jdbc.execute("DROP TABLE diagnostic_source_exposures");
  jdbc.update("DELETE FROM schema_migrations WHERE version>=6");
  jdbc.execute("CREATE VIEW diagnostic_source_exposures AS SELECT 1 AS incompatible_fixture");
  assertThrows(IllegalStateException.class,()->new SchemaMigration(jdbc.getDataSource(),paths));
  assertEquals(5,count("schema_migrations"));
  assertEquals("RESERVED",jdbc.queryForObject("SELECT state FROM diagnostic_active_reservations",String.class));
  try(var backups=Files.list(paths.backupDirectory())) {
   var backup=backups.filter(file->file.getFileName().toString().startsWith("before_migration_")).findFirst().orElseThrow();
   SqliteRecovery.verify(backup);
  }
  jdbc.execute("DROP VIEW diagnostic_source_exposures");
  new SchemaMigration(jdbc.getDataSource(),paths);
  assertEquals(SchemaMigration.CURRENT_VERSION,count("schema_migrations"));assertEquals(0,count("diagnostic_source_exposures"));
  assertEquals(1,count("diagnostic_reservation_events"));
 }

}
