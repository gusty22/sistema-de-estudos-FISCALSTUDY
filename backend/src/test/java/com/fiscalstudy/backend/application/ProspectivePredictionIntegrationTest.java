package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.*;
import com.fiscalstudy.backend.infrastructure.out.persistence.EventStoreRepositoryImpl;
import com.fiscalstudy.backend.infrastructure.in.web.ProspectivePredictionController;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ProspectivePredictionIntegrationTest {
    @TempDir Path directory;
    JdbcTemplate jdbc; EventStoreRepositoryImpl events; QuestionRepository questions;
    AttemptSubmissionService attempts; LearningEvidenceService memory; ProspectivePredictionService ledger;
    ObjectMapper json=new ObjectMapper();
    @BeforeEach void setup() {
        var ds=new DriverManagerDataSource("jdbc:sqlite:"+directory.resolve("isolated.db")+"?busy_timeout=10000");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        jdbc=new JdbcTemplate(ds);events=new EventStoreRepositoryImpl(jdbc);questions=mock(QuestionRepository.class);
        when(questions.findById("q1")).thenReturn(Optional.of(new Question("q1","Statement",List.of("A yes","B no"),"A","Math","Fractions","FCC",2026)));
        attempts=new AttemptSubmissionService(questions,events,"REAL_STUDY");
        memory=new LearningEvidenceService(jdbc);
        ReflectionTestUtils.setField(attempts,"learningEvidenceService",memory);
        ledger=new ProspectivePredictionService(jdbc,events,questions,attempts,memory,Clock.systemUTC(),"SYNTHETIC_FIXTURE");
    }
    AttemptResult answer(String id,String option,boolean help,int confidence) {
        return attempts.submitAttempt("q1",option,confidence,12000,"personal-session",null,null,
            false,false,null,null,null,null,null,null,null,help,help?"MATERIAL_APOIO":"NENHUM","REGULAR",id);
    }
    @Test void committedBeforeAnswerAndFsrsUpdatesOnlyAfterward() throws Exception {
        String id=UUID.randomUUID().toString();
        var f=ledger.prepare("q1","personal-session",id);
        assertEquals(0.5,f.path("probability").asDouble());
        assertEquals(0,f.path("nEvidence").asInt());
        assertNull(memory.preview("q1").get("recallBefore"));
        assertEquals(0,events.getAllEvents("ANSWER_SUBMITTED").size());
        String frozen=events.findByEventId("prediction:"+id).orElseThrow().getPayloadJson();
        assertEquals(f,ledger.prepare("q1","personal-session",id)); // Lost preparation acknowledgment.
        assertTrue(answer(id,"A",false,4).getIsCorrect());
        assertTrue(answer(id,"A",false,4).getIsCorrect()); // Lost answer acknowledgment.
        var a=events.findByEventId("attempt:"+id).orElseThrow();
        assertEquals(f.path("predictionId").asText(),json.readTree(a.getPayloadJson()).path("prospectivePredictionId").asText());
        assertFalse(Instant.parse(a.getOccurredAt()).isBefore(Instant.parse(f.path("createdAt").asText())));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));
        assertEquals(frozen,events.findByEventId("prediction:"+id).orElseThrow().getPayloadJson());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->ledger.prepare("q1","other-session",id));
    }
    @Test void delayedResponseDoesNotRefitAfterInterveningResults() throws Exception {
        String delayed=UUID.randomUUID().toString();
        var frozen=ledger.prepare("q1","personal-session",delayed);
        String original=events.findByEventId("prediction:"+delayed).orElseThrow().getPayloadJson();
        answer(UUID.randomUUID().toString(),"A",false,4); // Another result arrives while this forecast waits.
        assertEquals(frozen,ledger.prepare("q1","personal-session",delayed));
        answer(delayed,"B",false,4);
        assertEquals(original,events.findByEventId("prediction:"+delayed).orElseThrow().getPayloadJson());
        assertEquals(0,frozen.path("nEvidence").asInt());
        assertEquals(0.5,frozen.path("probability").asDouble());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM learning_evidence_projection",Integer.class));
        Path output=Path.of("target/prospective-delayed-fixture.json");
        Files.createDirectories(output.getParent());Files.writeString(output,json.writeValueAsString(ledger.exportSnapshot()));
    }
    @Test void recoveryOnlyRevealsAnAlreadyPersistedAnswer() {
        String id=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",id);
        var before=ledger.recover("q1","personal-session",id);
        assertEquals("PENDING_ANSWER",before.get("state"));assertFalse(before.containsKey("feedback"));
        answer(id,"A",false,4);
        var after=ledger.recover("q1","personal-session",id);
        assertEquals("ANSWER_RECORDED",after.get("state"));
        assertEquals(id,((Map<?,?>)after.get("feedback")).get("attemptId").toString().replace("\"",""));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->ledger.recover("q1","wrong-session",id));
        assertEquals(1,events.getAllEvents("PREDICTION_COMMITTED").size());
    }
    @Test void cannotBackfillACompletedAttempt() {
        String id=UUID.randomUUID().toString();answer(id,"A",false,4);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->ledger.prepare("q1","personal-session",id));
        assertEquals(0,events.getAllEvents("PREDICTION_COMMITTED").size());
    }
    @Test void concurrentPreparationRetriesCommitOneForecast() throws Exception {
        String id=UUID.randomUUID().toString();var pool=Executors.newFixedThreadPool(4);
        try {
            var jobs=new ArrayList<Callable<JsonNode>>();
            for(int i=0;i<8;i++) jobs.add(()->ledger.prepare("q1","personal-session",id));
            var result=pool.invokeAll(jobs);var expected=result.get(0).get();
            for(var value:result) assertEquals(expected,value.get());
        } finally { pool.shutdownNow(); }
        assertEquals(1,events.getAllEvents("PREDICTION_COMMITTED").size());
    }
    @Test void helpUnknownAndTestsCannotTrainTheBaselineOrContaminateMemory() {
        String helped=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",helped);answer(helped,"A",true,4);
        String guessed=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",guessed);answer(guessed,"A",false,1);
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM learning_memory_state",Integer.class));
        events.appendEvent("ANSWER_SUBMITTED","QUESTION","q1","test-x",1,"v1","{\"origin\":\"AUTOMATED_TEST\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\",\"usedHelp\":false}");
        events.appendEvent("ANSWER_SUBMITTED","QUESTION","q1","personal-session",1,"v1","{\"origin\":\"REAL_STUDY\",\"isCorrect\":true,\"gabaritoStatus\":\"DEFINITIVO\"}");
        var next=ledger.prepare("q1","personal-session",UUID.randomUUID().toString());
        // Guess correctness remains a valid correctness observation; it is NOT a memory review.
        assertEquals(1,next.path("nEvidence").asInt());
        assertEquals(2.0/3,next.path("probability").asDouble(),1e-12);
        assertEquals(3,next.path("excludedHistoricalEvents").asInt());
    }
    @Test void httpPreparationAndExportUseTheIsolatedEventStore() throws Exception {
        var mvc=MockMvcBuilders.standaloneSetup(new ProspectivePredictionController(ledger)).build();
        String id=UUID.randomUUID().toString();
        mvc.perform(post("/api/v1/questions/q1/predictions").contentType("application/json")
            .content(json.writeValueAsString(Map.of("attemptId",id,"sessionId","personal-session"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.contractVersion").value("prospective-question-v1"))
            .andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(post("/api/v1/questions/q1/predictions").contentType("application/json")
            .content("{\"attemptId\":\"invalid\",\"sessionId\":\"personal-session\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/learning-lab/prospective-export")).andExpect(status().isOk())
            .andExpect(jsonPath("$.can_apply").value(false));
    }
    @Test void exportsAnActualJavaSqliteFixtureForRWithoutChangingHistoricalPayloads() throws Exception {
        String one=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",one);answer(one,"A",false,4);
        String original=events.findByEventId("attempt:"+one).orElseThrow().getPayloadJson();
        attempts.annotateAttempt("q1",one,UUID.randomUUID().toString(),"personal-session","Interpretação");
        String two=UUID.randomUUID().toString();var second=ledger.prepare("q1","personal-session",two);
        assertEquals(2.0/3,second.path("probability").asDouble(),1e-12);
        answer(two,"B",false,4);
        String help=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",help);answer(help,"A",true,4);
        assertEquals(original,events.findByEventId("attempt:"+one).orElseThrow().getPayloadJson());
        var export=ledger.exportSnapshot();
        assertEquals("SYNTHETIC_FIXTURE",json.readTree((String)export.get("inputJson")).path("sourceKind").asText());
        Path output=Path.of("target/prospective-fixture.json");Files.createDirectories(output.getParent());
        Files.writeString(output,json.writeValueAsString(export));
        assertEquals(3,events.getAllEvents("PREDICTION_COMMITTED").size());
        assertEquals(3,events.getAllEvents("ANSWER_SUBMITTED").size());
        assertEquals(1,events.getAllEvents("ATTEMPT_ANNOTATED").size());
    }
    @Test void signedSnapshotTraversesActualPreparationAnswerAndExport() throws Exception {
        // Use the real question repository as well as the real event store in this chain.
        jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option,disciplina,assunto,banca,ano) VALUES('q1','SYNTHETIC item','[\"A yes\",\"B no\",\"C alternative\",\"D alternative\"]','A','Math','Fractions','FCC',2026)");
        questions=new com.fiscalstudy.backend.infrastructure.out.persistence.QuestionRepositoryImpl(jdbc);
        assertEquals("q1",questions.findNextAvailableQuestion().orElseThrow().getId());
        attempts=new AttemptSubmissionService(questions,events,"REAL_STUDY");
        ReflectionTestUtils.setField(attempts,"learningEvidenceService",memory);
        ledger=new ProspectivePredictionService(jdbc,events,questions,attempts,memory,Clock.systemUTC(),"SYNTHETIC_FIXTURE");
        new QuestionSelectionService(questions,events).recordPresentation("q1","personal-session");
        // A fresh ephemeral TEST key. No operational key or personal database is touched.
        var pair=java.security.KeyPairGenerator.getInstance("RSA"); pair.initialize(2048);
        var keys=pair.generateKeyPair();
        Path privateKey=directory.resolve("fixture-private.der");
        Files.write(privateKey,keys.getPrivate().getEncoded());
        var signer=new ProspectiveExportAttestor(privateKey.toString(),"SYNTHETIC-INTEGRATION-INSTALLATION");
        ReflectionTestUtils.setField(ledger,"attestor",signer);
        for(int n=0;n<24;n++) {
            String id=UUID.nameUUIDFromBytes(("synthetic-chain-"+n).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
            var forecast=ledger.prepare("q1","personal-session",id);
            String original=events.findByEventId("prediction:"+id).orElseThrow().getPayloadJson();
            answer(id,n<20?"A":"B",false,4);
            var prediction=events.findByEventId("prediction:"+id).orElseThrow();
            var response=events.findByEventId("attempt:"+id).orElseThrow();
            assertTrue(Instant.parse(prediction.getRecordedAt()).isBefore(Instant.parse(response.getOccurredAt())));
            assertTrue(Instant.parse(prediction.getOccurredAt()).isBefore(Instant.parse(response.getOccurredAt())));
            assertEquals(original,prediction.getPayloadJson());
            assertEquals(n,forecast.path("nEvidence").asInt());
        }
        String helped=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",helped);answer(helped,"A",true,4);
        String unknown=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",unknown);
        attempts.submitAttempt("q1","A",4,12000,"personal-session",null,null,false,false,
            null,null,null,null,null,null,null,null,null,"REGULAR",unknown);
        assertFalse(json.readTree(events.findByEventId("attempt:"+unknown).orElseThrow().getPayloadJson()).path("helpDeclarationProvided").asBoolean());
        String contradiction=UUID.randomUUID().toString();ledger.prepare("q1","personal-session",contradiction);
        attempts.submitAttempt("q1","A",4,12000,"personal-session",null,null,false,false,
            null,null,null,null,null,null,null,false,"MATERIAL_APOIO","REGULAR",contradiction);
        String pending=UUID.randomUUID().toString();
        assertEquals(24,ledger.prepare("q1","personal-session",pending).path("nEvidence").asInt());
        answer(UUID.randomUUID().toString(),"B",false,4); // Deliberately unforecasted; reported in denominator.
        var snapshot=ledger.exportSnapshot();
        var verifier=java.security.Signature.getInstance("SHA256withRSA");verifier.initVerify(keys.getPublic());
        verifier.update(((String)snapshot.get("attestationJson")).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertTrue(verifier.verify(Base64.getDecoder().decode((String)snapshot.get("signatureBase64"))));
        assertFalse(Files.exists(Path.of("target/prospective-private.der")));
        Path output=Path.of("target/prospective-attested-fixture.json");Files.createDirectories(output.getParent());
        Files.writeString(output,json.writeValueAsString(snapshot));
        String pem="-----BEGIN PUBLIC KEY-----\n"+Base64.getMimeEncoder(64,new byte[]{10}).encodeToString(keys.getPublic().getEncoded())+"\n-----END PUBLIC KEY-----\n";
        Files.writeString(Path.of("target/prospective-fixture-public.pem"),pem);
        assertEquals(snapshot,new ProspectiveExportAttestor("","").attest(snapshot,"SYNTHETIC_FIXTURE"));
        assertThrows(IllegalStateException.class,()->new ProspectiveExportAttestor(privateKey.toString(),"").attest(snapshot,"SYNTHETIC_FIXTURE"));
        assertThrows(IllegalStateException.class,()->new ProspectiveExportAttestor(directory.resolve("missing").toString(),"fixture").attest(snapshot,"SYNTHETIC_FIXTURE"));
    }
}
