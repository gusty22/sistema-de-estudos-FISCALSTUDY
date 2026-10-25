package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import java.time.Instant;
import java.time.format.DateTimeParseException;

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
  var annotations=jdbc.query("SELECT rowid,occurred_at,payload_json FROM event_store WHERE event_type='ATTEMPT_ANNOTATED'",
   (row,index)->new TimedAnnotation(row.getLong(1),parseTime(row.getString(2)),row.getString(3)));
  annotations.sort(Comparator.comparing(TimedAnnotation::occurredAt).thenComparingLong(TimedAnnotation::rowId));
  return latest(annotations.stream().map(TimedAnnotation::payload).toList());
 }
 private static Instant parseTime(String value) {
  if(value==null)throw new IllegalStateException("Missing persisted annotation timestamp");
  try{return Instant.parse(value);}
  catch(DateTimeParseException e){throw new IllegalStateException("Invalid persisted annotation timestamp",e);}
 }
 private record TimedAnnotation(long rowId,Instant occurredAt,String payload) {}
}
