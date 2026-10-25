package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

/** Read projection only: original answer events remain unchanged. Causes are self reports. */
public final class AttemptAnnotationView {
 private AttemptAnnotationView() {}
 public static Map<String,String> latest(List<String> orderedPayloads) {
  Map<String,String> result=new HashMap<>(); ObjectMapper mapper=new ObjectMapper();
  for(String payload:orderedPayloads) {
   try {var n=mapper.readTree(payload);String id=n.path("attemptId").asText();String cause=n.path("causaErro").asText();
    if(!id.isBlank()&&!cause.isBlank())result.put(id,cause);
   } catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid persisted error annotation",e);}
  }
  return result;
 }
 public static Map<String,String> latest(JdbcTemplate jdbc) {
  return latest(jdbc.queryForList("SELECT payload_json FROM event_store WHERE event_type='ATTEMPT_ANNOTATED' ORDER BY occurred_at,rowid",String.class));
 }
}
