package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

/** Provenance gate for personal usage/performance views; not a declaration of conceptual mastery. */
public final class LearningEventEligibility {
 private static final ObjectMapper JSON=new ObjectMapper();
 private static final String PERSONAL_RELATION="(SELECT * FROM event_store WHERE CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.origin') ELSE NULL END='REAL_STUDY')";
 private LearningEventEligibility() {}
 public static boolean isRealStudy(String payload){
  try{return "REAL_STUDY".equals(JSON.readTree(payload).path("origin").asText());}
  catch(Exception e){return false;}
 }
 public static boolean isRealStudy(Map<String,Object> payload){return "REAL_STUDY".equals(payload.get("origin"));}
 public static List<String> personalPayloads(List<String> payloads){return payloads.stream().filter(LearningEventEligibility::isRealStudy).toList();}
 public static List<com.fiscalstudy.backend.domain.EventRecord> personalEvents(List<com.fiscalstudy.backend.domain.EventRecord> events){return events.stream().filter(e->isRealStudy(e.getPayloadJson())).toList();}
 /** Explicit personal-view query: substitute only the event relation, preserving bindings and all other tables. */
 public static List<Map<String,Object>> query(JdbcTemplate jdbc,String sql,Object... args){
  String personalSql=sql.replaceAll("(?i)\\bFROM\\s+event_store\\b",java.util.regex.Matcher.quoteReplacement("FROM "+PERSONAL_RELATION));
  return args.length == 0 ? jdbc.queryForList(personalSql) : jdbc.queryForList(personalSql,args);
 }
}
