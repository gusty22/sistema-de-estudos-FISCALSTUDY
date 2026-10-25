package com.fiscalstudy.backend.application;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;
class QuestionClassificationServiceTest {
 @TempDir Path temp;
 JdbcTemplate jdbc; QuestionClassificationService service;
 @BeforeEach void setup(){
  var ds=new DriverManagerDataSource("jdbc:sqlite:"+temp.resolve("classification.db"));
  new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
  jdbc=new JdbcTemplate(ds); service=new QuestionClassificationService(jdbc);
  jdbc.update("INSERT INTO questions(id,enunciado,options_json,correct_option) VALUES('q1','Pergunta','[]','A'),('q2','Pergunta','[]','A')");
  jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto) VALUES('t1','e1','c1','Português','Concordância')");
 }
 @Test void suggestionsDoNotCreateCoverageAndHumanRejectionSupersedesConfirmation(){
  service.classify("q1",new QuestionClassificationService.Classification("t1","SUGGESTED",0.8,"AUTOMATED",null,"Candidato para revisão"));
  assertEquals(0L,service.coverage(null).get("classifiedQuestions"));
  assertEquals(2,service.questions(true,10,0).size());
  service.classify("q1",new QuestionClassificationService.Classification("t1","CONFIRMED",1.0,"HUMAN","estudante","Conferido enunciado com edital"));
  assertEquals(1L,service.coverage("c1").get("classifiedQuestions"));
  assertEquals(1,service.questions(true,10,0).size());
  service.classify("q1",new QuestionClassificationService.Classification("t1","REJECTED",1.0,"HUMAN","estudante","Vínculo equivocado"));
  assertEquals(0L,service.coverage(null).get("classifiedQuestions"));
  assertEquals(3,service.history("q1").size());
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM questions",Integer.class));
 }
 @Test void automaticConfirmationAndMissingEvidenceAreRejected(){
  assertThrows(ResponseStatusException.class,()->service.classify("q1",new QuestionClassificationService.Classification("t1","CONFIRMED",0.9,"AUTOMATED","bot","Texto")));
  assertThrows(ResponseStatusException.class,()->service.classify("q1",new QuestionClassificationService.Classification("t1","SUGGESTED",Double.NaN,"AUTOMATED",null,"Texto")));
  assertEquals(0,service.history("q1").size());
 }
 @Test void duplicateOccurrencesHaveSameIdentityAndRemainIntact(){
  assertEquals(service.family("q1").get("familyId"),service.family("q2").get("familyId"));
  assertEquals(false,service.family("q1").get("conceptualEquivalenceVerified"));
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM questions",Integer.class));
 }
 @Test void topicSelectionUsesOnlyLatestConfirmedLinks() {
  assertTrue(service.questions(false,10,0,"t1").isEmpty());
  service.classify("q1",new QuestionClassificationService.Classification("t1","SUGGESTED",.7,"AUTOMATED",null,"Sugestão"));
  assertTrue(service.questions(false,10,0,"t1").isEmpty());
  service.classify("q1",new QuestionClassificationService.Classification("t1","CONFIRMED",1.0,"HUMAN","estudante","Conferido"));
  var selected=service.questions(false,10,0,"t1");
  assertEquals(1,selected.size());assertEquals("q1",selected.get(0).get("id"));
  assertTrue(service.questions(false,10,0,"outro-topico").isEmpty());
  assertThrows(ResponseStatusException.class,()->service.questions(true,10,0,"t1"));
  service.classify("q1",new QuestionClassificationService.Classification("t1","REJECTED",1.0,"HUMAN","estudante","Corrigido"));
  assertTrue(service.questions(false,10,0,"t1").isEmpty());
  assertEquals(2,service.questions(true,10,0).size());
 }
}
