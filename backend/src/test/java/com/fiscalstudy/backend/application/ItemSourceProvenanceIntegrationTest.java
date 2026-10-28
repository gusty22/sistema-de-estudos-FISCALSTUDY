package com.fiscalstudy.backend.application;
import com.fiscalstudy.backend.infrastructure.config.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.security.MessageDigest;
import static org.junit.jupiter.api.Assertions.*;
class ItemSourceProvenanceIntegrationTest {
 @TempDir Path temp;JdbcTemplate jdbc;DatabasePaths paths;ItemSourceProvenanceService provenance;Path file;
 @BeforeEach void setup()throws Exception{
  paths=new DatabasePaths(new MockEnvironment().withProperty("spring.datasource.url","jdbc:sqlite:"+temp.resolve("main.db"))
   .withProperty("fiscalstudy.staging-db",temp.resolve("staging.db").toString()).withProperty("fiscalstudy.acervo-root",temp.resolve("sources").toString()));
  paths.createDirectories();Files.createDirectories(paths.acervoRoot());
  var ds=new DriverManagerDataSource("jdbc:sqlite:"+paths.mainDatabase());
  try(var c=ds.getConnection()){SchemaMigration.migrate(c);}jdbc=new JdbcTemplate(ds);
  StagingSchemaMigration.migrate(paths.stagingDatabase());
  file=paths.acervoRoot().resolve("synthetic.pdf");Files.writeString(file,"%PDF-1.4\nSYNTHETIC BYTE FIXTURE");
  String sha=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file)));
  try(var c=DriverManager.getConnection("jdbc:sqlite:"+paths.stagingDatabase());var s=c.createStatement()){
   s.execute("INSERT INTO staging_files(id,rel_path,filename,file_size_bytes,sha256,total_pages) VALUES('f','synthetic.pdf','synthetic.pdf',1,'"+sha+"',2)");
   s.execute("INSERT INTO staging_documents(id,file_id,doc_role,page_start,page_end) VALUES('d','f','PROVA',1,2)");
   s.execute("INSERT INTO staging_questions(id,document_id,numero_original,statement,options_json,pages_json) VALUES('copy','d',1,'Synthetic item','[\"A\",\"B\"]','[1]')");
  }
  jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option) VALUES('canonical','Synthetic item','[\"A\",\"B\"]','A')");
  provenance=new ItemSourceProvenanceService(jdbc,paths);
 }
 @Test void recordsCapturedDocumentOccurrenceAndCanonicalItemWithoutSemanticClaim()throws Exception{
  String id=UUID.randomUUID().toString();var record=provenance.registerExact(id,"copy","canonical");
  assertEquals("EXACT_CONTENT_DUPLICATE",record.get("relation"));assertEquals("f",record.get("staging_file_id"));
  assertEquals("[1]",record.get("pages_json"));assertEquals("VERIFIED_AT_CAPTURE_NOT_RUNTIME_AUTHORIZATION",record.get("verification"));
  assertEquals(record,provenance.registerExact(id,"copy","canonical"));
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM item_source_provenance_events",Integer.class));
  assertThrows(Exception.class,()->jdbc.update("UPDATE item_source_provenance_events SET relation='SAME_CANONICAL_ITEM'"));
 }
 @Test void unknownVariantAndWrongFileHashCannotBecomeVerifiedCopy()throws Exception{
  jdbc.update("UPDATE questions SET enunciado='Different variant' WHERE id='canonical'");
  assertThrows(Exception.class,()->provenance.registerExact(UUID.randomUUID().toString(),"copy","canonical"));
  jdbc.update("UPDATE questions SET enunciado='Synthetic item' WHERE id='canonical'");
  Files.writeString(file,"changed source bytes");
  assertThrows(Exception.class,()->provenance.registerExact(UUID.randomUUID().toString(),"copy","canonical"));
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM item_source_provenance_events",Integer.class));
 }
 @Test void historyRetainsOldObservationAndNeverUsesTheAnswerKeyAsIdentity()throws Exception{
  var first=provenance.registerExact(UUID.randomUUID().toString(),"copy","canonical");
  jdbc.update("UPDATE questions SET correct_option='B' WHERE id='canonical'");
  var second=provenance.registerExact(UUID.randomUUID().toString(),"copy","canonical");
  assertEquals(first.get("statement_options_sha256"),second.get("statement_options_sha256"));
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM item_source_provenance_events",Integer.class));
 }
 @Test void changedOccurrenceOrTraversalCannotReuseAnObservation()throws Exception{
  String id=UUID.randomUUID().toString();provenance.registerExact(id,"copy","canonical");
  try(var c=DriverManager.getConnection("jdbc:sqlite:"+paths.stagingDatabase());var s=c.createStatement()){s.execute("UPDATE staging_questions SET pages_json='[2]'");}
  assertThrows(Exception.class,()->provenance.registerExact(id,"copy","canonical"));
  try(var c=DriverManager.getConnection("jdbc:sqlite:"+paths.stagingDatabase());var s=c.createStatement()){s.execute("UPDATE staging_files SET rel_path='../outside.pdf'");}
  Files.writeString(temp.resolve("outside.pdf"),"%PDF-1.4\nSYNTHETIC BYTE FIXTURE");
  assertThrows(Exception.class,()->provenance.registerExact(UUID.randomUUID().toString(),"copy","canonical"));
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM item_source_provenance_events",Integer.class));
 }
}
