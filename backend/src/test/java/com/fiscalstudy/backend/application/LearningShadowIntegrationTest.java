package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiscalstudy.backend.infrastructure.config.*;
import com.fiscalstudy.backend.infrastructure.out.persistence.*;
import com.fiscalstudy.backend.infrastructure.process.BoundedProcess;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real repositories, isolated synthetic SQLite. R tests are mandatory when explicitly selected. */
class LearningShadowIntegrationTest {
    @TempDir Path temp;
    JdbcTemplate jdbc;
    LearningShadowSnapshotService snapshots;
    AnalyticsPaths paths;
    ObjectMapper mapper=new ObjectMapper();
    Instant cutoff=Instant.parse("2026-10-28T12:00:00Z");
    Path db;
    String rscript=System.getProperty("fiscalstudy.shadow.test.rscript","Rscript");
    @BeforeEach void setup() {
        db=temp.resolve("synthetic.db");
        var ds=new DriverManagerDataSource("jdbc:sqlite:"+db);
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        jdbc=new JdbcTemplate(ds);
        var env=new MockEnvironment().withProperty("spring.datasource.url","jdbc:sqlite:"+db)
            .withProperty("fiscalstudy.project-root",Path.of("..").toAbsolutePath().normalize().toString());
        paths=new AnalyticsPaths(new DatabasePaths(env),"",temp.resolve("lab").toString());
        snapshots=new LearningShadowSnapshotService(jdbc,new EditalRepositoryImpl(jdbc),new QuestionRepositoryImpl(jdbc),new EventStoreRepositoryImpl(jdbc),mapper,new LearningEvidenceService(jdbc),"SYNTHETIC_SQLITE_FIXTURE",true,Clock.fixed(cutoff,ZoneOffset.UTC));
        jdbc.update("INSERT INTO editais(id,concurso_id,titulo,versao,tipo,created_at) VALUES('e','c','Fixture','v1','ORIGINAL','2026-01-01T00:00:00Z')");
        jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto,confirmado_humano,created_at) VALUES('t','e','c','Fixture','Topic',1,'2026-01-01T00:00:00Z')");
        jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option,gabarito_status,disciplina,assunto) VALUES('q','Synthetic question','[\"A\",\"B\"]','A','DEFINITIVO','Fixture','Topic')");
        jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,reviewer,evidence,created_at) VALUES('link','q','t','CONFIRMED',1,'MANUAL','fixture','fixture','2026-01-01T00:00:00Z')");
    }
    LearningShadowService service(boolean enabled,String exec,int timeout) {return new LearningShadowService(snapshots,paths,mapper,enabled,exec,timeout);}
    LearningShadowService.Observation observe(int minutes) { return service(true,rscript,30).observe("c","e",cutoff,minutes,5); }
    void fixtureMemory() {
        var payload="{\"questionId\":\"q\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"origin\":\"SYNTHETIC_FIXTURE\",\"studentId\":\"LOCAL_SINGLE_USER\",\"concursoId\":\"c\"}";
        jdbc.update("INSERT INTO event_store VALUES('a','ANSWER_SUBMITTED','QUESTION','q','fixture','2026-10-20T12:00:00Z','2026-10-20T12:00:00Z',2,'v2',?)",payload);
        jdbc.update("INSERT INTO learning_memory_state VALUES('q',2,5,1,0,'2026-10-20T12:00:00Z','2026-10-22T12:00:00Z',?)",LearningEvidenceService.MODEL_VERSION);
    }
    byte[] databaseHash() throws Exception {return MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(db));}
    String diagnostics(LearningShadowService.Observation result) {
        try { return Files.readString(result.artifacts().resolve("failure.txt"))+" "+Files.readString(result.artifacts().resolve("process.log")); }
        catch(Exception e) { return "Inspect "+result.artifacts(); }
    }
    @Test void disabledAndMissingRNeverChangeOperationalState() throws Exception {
        byte[] before=databaseHash();
        assertEquals("DISABLED",service(false,"missing-r",1).observe("c","e",cutoff,15,5).status());
        assertEquals("FAILED",service(true,"missing-r",1).observe("c","e",cutoff,15,5).status());
        assertArrayEquals(before,databaseHash());
    }
    @Test void coldInventoryThroughRealRReplaysInLabWithoutOperationalWrites() throws Exception {
        byte[] before=databaseHash();
        var a=observe(15); assertEquals("SUCCEEDED",a.status(),()->diagnostics(a));
        var b=observe(15); assertEquals("SUCCEEDED",b.status());
        assertEquals(a.decision(),b.decision());
        var result=a.decision().path("result");
        assertEquals("diagnostic:t:q",result.path("proposal").path("candidate_id").asText());
        assertFalse(result.path("proposal").path("personal_inference").asBoolean());
        assertEquals(6,result.path("specialists").size());
        assertEquals(3,result.path("policy_comparison").path("choices").size());
        assertEquals(0,a.decision().path("scientific_report").path("scored_count").asInt());
        assertTrue(a.decision().path("replay_verified").asBoolean());
        assertArrayEquals(before,databaseHash());
        var request=mapper.readTree(Files.readAllBytes(a.artifacts().resolve("request.json")));
        for(String field:List.of("can_apply","can_schedule")) {
            ObjectNode forged=a.decision().deepCopy(); forged.put(field,true);
            assertThrows(IllegalArgumentException.class,()->LearningShadowService.validate(forged,request));
            ObjectNode nested=a.decision().deepCopy(); ((ObjectNode)nested.path("result").path("proposal")).put(field,true);
            assertThrows(IllegalArgumentException.class,()->LearningShadowService.validate(nested,request));
        }
        ObjectNode forged=a.decision().deepCopy(); ((ObjectNode)forged.path("result").path("proposal")).put("candidate_id","fake");
        assertThrows(IllegalArgumentException.class,()->LearningShadowService.validate(forged,request));
    }
    @Test void canonicalDueStateSupportsContextualSelectionAndKeepsSyntheticLabel() throws Exception {
        fixtureMemory(); byte[] before=databaseHash();
        var a=observe(15); assertEquals("SUCCEEDED",a.status(),()->diagnostics(a));
        var result=a.decision().path("result");
        assertEquals("review:t:q",result.path("proposal").path("candidate_id").asText());
        assertEquals("SYNTHETIC_ONLY",result.path("evidence_state").asText());
        assertFalse(result.path("personal_source_verified").asBoolean());
        assertEquals(7,result.path("specialists").size());
        assertArrayEquals(before,databaseHash());
    }
    @Test void timeBudgetAndUnavailableInventoryAbstain() {
        var time=observe(1); assertEquals("SUCCEEDED",time.status(),()->diagnostics(time));
        assertEquals("ABSTAIN",time.decision().path("result").path("proposal").path("status").asText());
        jdbc.update("UPDATE question_topic_classifications SET status='REJECTED'");
        var empty=observe(15); assertEquals("SUCCEEDED",empty.status(),()->diagnostics(empty));
        assertEquals("ABSTAIN",empty.decision().path("result").path("proposal").path("status").asText());
    }
    @Test void hostRejectsForeignScopeAndFutureEvidence() throws Exception {
        assertThrows(IllegalArgumentException.class,()->snapshots.capture("other","e",cutoff,15,5));
        fixtureMemory();
        jdbc.update("UPDATE event_store SET occurred_at='2026-10-29T00:00:00Z'");
        assertThrows(IllegalArgumentException.class,()->snapshots.capture("c","e",cutoff,15,5));
    }
    @Test void rawCliCannotAuthenticateItself() throws Exception {
        Path input=temp.resolve("request.json"),output=temp.resolve("result.json");
        Files.writeString(input,"{\"origin\":\"REAL_STUDY\",\"can_apply\":true,\"authority_registry\":[{}]}");
        var result=BoundedProcess.run(List.of(rscript,"--vanilla",paths.engine().resolve("run_core_shadow.R").toString(),input.toString(),output.toString()),paths.engine(),Duration.ofSeconds(10),Map.of());
        assertNotEquals(0,result.exitCode()); assertFalse(Files.exists(output));
    }
    @Test void timeoutIncompleteAndAdulteratedOutputsAreControlledAndReadOnly() throws Exception {
        byte[] before=databaseHash();
        Path fakeEngine=temp.resolve("fake-engine"); Files.createDirectory(fakeEngine);
        for(String file:LearningShadowService.ENGINE_SOURCES) {
            if(file.equals("run_core_shadow.R")) continue;
            Files.createDirectories(fakeEngine.resolve(file).getParent()); Files.copy(paths.engine().resolve(file),fakeEngine.resolve(file));
        }
        var fakePaths=new AnalyticsPaths(new DatabasePaths(new MockEnvironment().withProperty("spring.datasource.url","jdbc:sqlite:"+db)),fakeEngine.toString(),temp.resolve("failures").toString());
        for(String body:List.of("quit(status=7)","Sys.sleep(5)",
                "args<-commandArgs(TRUE);writeLines('{',args[2])",
                "args<-commandArgs(TRUE);writeLines('{}',args[2]);writeLines(paste(rep('0',64),collapse=''),paste0(args[2],'.mac'))")) {
            Files.writeString(fakeEngine.resolve("run_core_shadow.R"),body);
            var service=new LearningShadowService(snapshots,fakePaths,mapper,true,rscript,1);
            long started=System.nanoTime();
            assertEquals("FAILED",service.observe("c","e",cutoff,15,5).status());
            assertTrue(Duration.ofNanos(System.nanoTime()-started).toSeconds()<12);
            assertArrayEquals(before,databaseHash());
        }
    }
    @Test void foreignStudentsContestsAndUnknownVersionsAreNotLaundered() throws Exception {
        fixtureMemory();
        for(String field:List.of("studentId","concursoId")) {
            String original=jdbc.queryForObject("SELECT payload_json FROM event_store WHERE event_id='a'",String.class);
            ObjectNode p=(ObjectNode)mapper.readTree(original); p.put(field,"other");
            jdbc.update("UPDATE event_store SET payload_json=? WHERE event_id='a'",p.toString());
            assertThrows(IllegalArgumentException.class,()->snapshots.capture("c","e",cutoff,15,5));
            jdbc.update("UPDATE event_store SET payload_json=? WHERE event_id='a'",original);
        }
        jdbc.update("UPDATE event_store SET schema_version='v999'");
        assertThrows(IllegalArgumentException.class,()->snapshots.capture("c","e",cutoff,15,5));
    }
    @Test void unavailableOrUnconfirmedQuestionsNeverBecomePhantomCandidates() throws Exception {
        for(String status:List.of("REJEITADA","RASCUNHO")) {
            jdbc.update("UPDATE questions SET status=?",status);
            assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
        }
        jdbc.update("UPDATE questions SET status='VALIDADA',enunciado=''");
        assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
        jdbc.update("UPDATE questions SET enunciado='Fixture',options_json='[]'");
        assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
        jdbc.update("UPDATE questions SET options_json='[\"A\",\"B\"]'");
        jdbc.update("UPDATE questions SET gabarito_status=NULL");
        assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
        jdbc.update("UPDATE questions SET gabarito_status='DEFINITIVO'");
        jdbc.update("UPDATE edital_topicos SET confirmado_humano=0");
        assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
        jdbc.update("UPDATE edital_topicos SET confirmado_humano=1");
        jdbc.update("UPDATE questions SET gabarito_status='ANULADA'");
        assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
        jdbc.update("DELETE FROM questions");
        assertTrue(((List<?>)snapshots.capture("c","e",cutoff,15,5).get("candidates")).isEmpty());
    }
    @Test void ordinaryHostColdStartNeverFabricatesSyntheticScientificRegistry() throws Exception {
        var ordinary=new LearningShadowSnapshotService(jdbc,new EditalRepositoryImpl(jdbc),new QuestionRepositoryImpl(jdbc),new EventStoreRepositoryImpl(jdbc),mapper,new LearningEvidenceService(jdbc),"ORDINARY_HOST_TEST");
        assertEquals(false,ordinary.capture("c","e",cutoff,15,5).get("fixture_installation"));
        byte[] before=databaseHash();
        var observation=new LearningShadowService(ordinary,paths,mapper,true,rscript,30).observe("c","e",cutoff,15,5);
        assertEquals("SUCCEEDED",observation.status(),()->diagnostics(observation));
        assertTrue(observation.decision().path("scientific_input").isNull());
        assertTrue(observation.decision().path("scientific_report").isNull());
        assertArrayEquals(before,databaseHash());
    }
    @Test void historicalEvidenceCutoffDoesNotBackdateCurrentCurriculumAuthority() throws Exception {
        jdbc.update("UPDATE question_topic_classifications SET created_at='2026-10-27T12:00:00Z'");
        Instant evidenceCutoff=Instant.parse("2026-10-20T12:00:00Z");
        var observation=service(true,rscript,30).observe("c","e",evidenceCutoff,15,5);
        assertEquals("SUCCEEDED",observation.status(),()->diagnostics(observation));
        assertEquals(cutoff.toString(),observation.decision().path("result").path("cutoff").asText());
        assertEquals(evidenceCutoff.toString(),observation.decision().path("host_source").path("evidence_cutoff").asText());
        for(JsonNode authority:observation.decision().path("result").path("authority_registry"))
            assertEquals(cutoff.toString(),authority.path("valid_from").asText());
    }
    @Test void missingHistoricalScopeIsOmittedRatherThanBorrowedFromCurrentInventory() throws Exception {
        fixtureMemory();
        ObjectNode payload=(ObjectNode)mapper.readTree(jdbc.queryForObject("SELECT payload_json FROM event_store WHERE event_id='a'",String.class));
        payload.remove("concursoId"); jdbc.update("UPDATE event_store SET payload_json=?",payload.toString());
        var snapshot=snapshots.capture("c","e",cutoff,15,5);
        assertTrue(((List<?>)snapshot.get("events")).isEmpty());
        assertEquals(1,((List<?>)snapshot.get("evidence_omissions")).size());
    }
    @Test void snapshotIdentityIgnoresNestedMapInsertionOrder() throws Exception {
        var first=new LinkedHashMap<String,Object>(); first.put("contest_id","c"); first.put("available_minutes",15);
        var second=new LinkedHashMap<String,Object>(); second.put("available_minutes",15); second.put("contest_id","c");
        assertArrayEquals(LearningShadowService.canonicalBytes(mapper,Map.of("context",first)),LearningShadowService.canonicalBytes(mapper,Map.of("context",second)));
    }
}
