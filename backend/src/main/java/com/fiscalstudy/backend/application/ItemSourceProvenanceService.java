package com.fiscalstudy.backend.application;
import com.fiscalstudy.backend.infrastructure.config.DatabasePaths;
import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.sql.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.time.Instant;
/** Captured exact correspondence, not document completeness, semantic equivalence or read authorization. */
@Service
public class ItemSourceProvenanceService {
 private final JdbcTemplate jdbc;private final DatabasePaths paths;private final ObjectMapper json=new ObjectMapper();
 public ItemSourceProvenanceService(JdbcTemplate jdbc,DatabasePaths paths){this.jdbc=jdbc;this.paths=paths;}
 private ResponseStatusException conflict(){return new ResponseStatusException(HttpStatus.CONFLICT,"Exact source correspondence not established");}
 private String fingerprint(String statement,String options)throws Exception{
  if(statement==null)throw conflict();
  JsonNode parsed=json.readTree(options);
  if(parsed==null||!parsed.isArray())throw conflict();
  for(JsonNode option:parsed)if(!option.isTextual())throw conflict();
  byte[] bytes=json.createArrayNode().add(statement).add(parsed).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
  return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
 }
 public Map<String,Object> registerExact(String recordId,String stagingQuestionId,String questionId) throws Exception {
  try{if(!UUID.fromString(recordId).toString().equals(recordId))throw new IllegalArgumentException();}
  catch(Exception invalid){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Canonical record UUID required");}
  if(stagingQuestionId==null||stagingQuestionId.isBlank()||questionId==null||questionId.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  QuestionAccessPolicy.requireUnmappedSourceRead(jdbc);
  Map<String,String> source=new HashMap<>();
  // One read-only staging snapshot; no staging/original writes or path supplied by the API caller.
  String url="jdbc:sqlite:file:"+paths.stagingDatabase().toAbsolutePath().toString().replace(java.io.File.separatorChar,'/')+"?mode=ro";
  try(Connection c=DriverManager.getConnection(url);Statement setup=c.createStatement()){
   setup.execute("PRAGMA query_only=ON");c.setAutoCommit(false);
   try(PreparedStatement p=c.prepareStatement("SELECT q.statement,q.options_json,q.pages_json,d.id document_id,f.id file_id,f.rel_path,f.sha256 FROM staging_questions q JOIN staging_documents d ON d.id=q.document_id JOIN staging_files f ON f.id=d.file_id WHERE q.id=?")){
    p.setString(1,stagingQuestionId);
    try(ResultSet r=p.executeQuery()){if(!r.next())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
     for(String key:List.of("statement","options_json","pages_json","document_id","file_id","rel_path","sha256"))source.put(key,r.getString(key));}
   }
   c.rollback();
  }
  Path root=paths.acervoRoot().toRealPath(),file=root.resolve(source.get("rel_path")).normalize().toRealPath();
  if(!file.startsWith(root)||!Files.isRegularFile(file)||Files.size(file)>268435456L)throw conflict(); // project hashing budget, not universal standard
  var before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class);
  MessageDigest digest=MessageDigest.getInstance("SHA-256");
  try(var in=Files.newInputStream(file)){byte[] buffer=new byte[65536];int n;long total=0;
   while((n=in.read(buffer))!=-1){total+=n;if(total>268435456L)throw conflict();digest.update(buffer,0,n);}}
  var after=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class);
  String sha=HexFormat.of().formatHex(digest.digest());
  if(!sha.equals(source.get("sha256"))||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime())||
     !Objects.equals(before.fileKey(),after.fileKey()))throw conflict();
  String exact=fingerprint(source.get("statement"),source.get("options_json"));
  if(source.get("pages_json")!=null){
   JsonNode pages=json.readTree(source.get("pages_json"));if(!pages.isArray())throw conflict();
   for(JsonNode page:pages)if(!page.isIntegralNumber()||page.asLong()<1)throw conflict();
  }
  var tx=new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource())));
  return tx.execute(status->{
   var existing=jdbc.queryForList("SELECT * FROM item_source_provenance_events WHERE record_id=?",recordId);
   if(!existing.isEmpty()){
    var prior=existing.get(0);
    if(!questionId.equals(prior.get("operational_question_id"))||!stagingQuestionId.equals(prior.get("staging_question_id"))||
       !sha.equals(prior.get("source_sha256"))||!exact.equals(prior.get("statement_options_sha256"))||
       !source.get("file_id").equals(prior.get("staging_file_id"))||!source.get("document_id").equals(prior.get("staging_document_id"))||
       !Objects.equals(source.get("pages_json"),prior.get("pages_json")))throw conflict();
    return prior;
   }
   var candidates=jdbc.queryForList("SELECT enunciado,options_json FROM study_questions WHERE id=?",questionId);
   if(candidates.size()!=1)throw conflict();
   try{
    var q=candidates.get(0);
    if(!exact.equals(fingerprint((String)q.get("enunciado"),(String)q.get("options_json"))))throw conflict();
    String links=json.writeValueAsString(jdbc.queryForList("SELECT c.* FROM ("+QuestionClassificationService.CURRENT_LINKS+") c WHERE c.question_id=? ORDER BY c.topic_id",questionId));
    jdbc.update("INSERT INTO item_source_provenance_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
     recordId,source.get("file_id"),source.get("document_id"),sha,stagingQuestionId,questionId,exact,
     source.get("pages_json"),stagingQuestionId.equals(questionId)?"SAME_CANONICAL_ITEM":"EXACT_CONTENT_DUPLICATE",
     "DETERMINISTIC_STAGING_PDF_VERIFY","VERIFIED_AT_CAPTURE_NOT_RUNTIME_AUTHORIZATION",links,
     Instant.now().toString(),"item-source-provenance-v1");
   }catch(ResponseStatusException refused){throw refused;}
    catch(Exception invalid){throw new IllegalStateException("Cannot capture provenance",invalid);}
   return jdbc.queryForMap("SELECT * FROM item_source_provenance_events WHERE record_id=?",recordId);
  });
 }
}
