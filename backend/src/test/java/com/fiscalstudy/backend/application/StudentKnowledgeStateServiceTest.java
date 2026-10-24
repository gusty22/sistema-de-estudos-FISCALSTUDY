package com.fiscalstudy.backend.application;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
class StudentKnowledgeStateServiceTest {
 JdbcTemplate jdbc;StudentKnowledgeStateService service;SingleConnectionDataSource ds;
 @BeforeEach void setup(){ds=new SingleConnectionDataSource("jdbc:sqlite::memory:",true);new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);jdbc=new JdbcTemplate(ds);service=new StudentKnowledgeStateService(jdbc);jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto,peso) VALUES('t','e','c','Tributário','Imunidade',1)");jdbc.update("INSERT INTO questions(id,disciplina,assunto) VALUES('q','Tributário','Imunidade')");}
 @AfterEach void close(){ds.destroy();}
 void classify(String status){jdbc.update("INSERT INTO question_topic_classifications(id,question_id,topic_id,status,confidence,origin,evidence,created_at) VALUES('cl','q','t',?,1,'HUMAN','fixture',?)",status,Instant.now().toString());}
 void event(String id,String origin,String date,boolean help){jdbc.update("INSERT INTO event_store(event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json) VALUES(?,'ANSWER_SUBMITTED','QUESTION','q','s',?,?,1,'v1',?)",id,date,date,"{\"isCorrect\":true,\"confidenceLevel\":5,\"origin\":\""+origin+"\",\"usedHelp\":"+help+"}");}
 @Test void virginTopicIsExplicit(){var s=service.computeKnowledgeStates("c").get(0);assertEquals(0,s.getTotalQuestoes());assertEquals("VIRGEM_NAO_EXPLORADO",s.getStatusDominio());}
 @Test void unknownAutomatedAndAssistedEventsAreNotMasteryEvidence(){classify("CONFIRMED");event("a","UNKNOWN",Instant.now().toString(),false);event("b","AUTOMATED_TEST",Instant.now().toString(),false);event("c","REAL_STUDY",Instant.now().toString(),true);assertEquals(0,service.computeKnowledgeStates("c").get(0).getTotalQuestoes());}
 @Test void unconfirmedClassificationDoesNotCreateMastery(){classify("SUGGESTED");event("a","REAL_STUDY",Instant.now().toString(),false);assertEquals(0,service.computeKnowledgeStates("c").get(0).getTotalQuestoes());}
 @Test void demonstratedPerformanceDoesNotInventForgettingCurve(){classify("CONFIRMED");event("a","REAL_STUDY",Instant.now().minusSeconds(45L*86400).toString(),false);var s=service.computeKnowledgeStates("c").get(0);assertEquals(1,s.getTotalQuestoes());assertEquals(s.getPBasePct(),s.getPAtualPct());assertNotEquals("CONSOLIDADO",s.getStatusDominio());}
 @Test void malformedDateAndOtherConcursoStaySeparate(){classify("CONFIRMED");event("a","REAL_STUDY","not-a-date",false);assertEquals(0,service.computeKnowledgeStates("c").get(0).getTotalQuestoes());assertTrue(service.computeKnowledgeStates("other").isEmpty());}
}
