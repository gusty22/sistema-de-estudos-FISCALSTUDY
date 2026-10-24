package com.fiscalstudy.backend.application;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
class ErrorTaxonomyRegressionTest {
 SingleConnectionDataSource ds; JdbcTemplate jdbc; RevisionCalendarService service;
 @BeforeEach void setup(){ds=new SingleConnectionDataSource("jdbc:sqlite::memory:",true);jdbc=new JdbcTemplate(ds);jdbc.execute("CREATE TABLE event_store(event_id TEXT PRIMARY KEY,event_type TEXT,aggregate_id TEXT,session_id TEXT,occurred_at TEXT,payload_json TEXT)");service=new RevisionCalendarService(jdbc,mock(com.fiscalstudy.backend.domain.EventStoreRepository.class));}
 @AfterEach void close(){ds.destroy();}
 void event(String json){jdbc.update("INSERT INTO event_store VALUES(?,'ANSWER_SUBMITTED','q','s','2026-01-01T00:00:00Z',?)",UUID.randomUUID().toString(),json);}
 Map<?,?> counts(){return (Map<?,?>)service.getErrorTaxonomyStats(null).get("counts");}
 @Test void absentCauseIsUnknownRatherThanKnowledgeGap(){event("{\"origin\":\"REAL_STUDY\",\"isCorrect\":false}");assertEquals(1,counts().get("NAO_CLASSIFICADO"));assertEquals(0,counts().get("E1"));}
 @Test void personalStatsExcludeOtherOriginsAndUnevaluatedAnswers(){for(String origin:List.of("AUTOMATED_TEST","DEMONSTRATION","UNVERIFIED_HISTORICAL"))event("{\"origin\":\""+origin+"\",\"isCorrect\":false}");event("not json");event("{\"origin\":\"REAL_STUDY\",\"isCorrect\":null}");assertEquals(0,service.getErrorTaxonomyStats(null).get("totalErrors"));}
 @Test void categoryComesOnlyFromCauseField(){event("{\"origin\":\"REAL_STUDY\",\"isCorrect\":false,\"causaErro\":\"E3\",\"notes\":\"NAO_SABIA_MATERIA\"}");assertEquals(1,counts().get("E3"));assertEquals(0,counts().get("E1"));}
 @Test void laterAnnotationOverridesOriginalCauseWithoutChangingAnswer(){
  String answer="{\"origin\":\"REAL_STUDY\",\"attemptId\":\"a\",\"isCorrect\":false,\"causaErro\":\"E1\"}";
  event(answer);
  jdbc.update("INSERT INTO event_store VALUES('annotation','ATTEMPT_ANNOTATED','q','s','2026-01-02T00:00:00Z',?)","{\"attemptId\":\"a\",\"causaErro\":\"E3\"}");
  assertEquals(1,counts().get("E3"));assertEquals(0,counts().get("E1"));
  assertEquals(answer,jdbc.queryForObject("SELECT payload_json FROM event_store WHERE event_type='ANSWER_SUBMITTED'",String.class));
 }
}
