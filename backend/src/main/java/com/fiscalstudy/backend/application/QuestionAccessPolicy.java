package com.fiscalstudy.backend.application;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
/** Shared supplementary policy for previously materialized item identifiers. */
public final class QuestionAccessPolicy {
 private QuestionAccessPolicy() {}
 private static final ThreadLocal<Boolean> MAINTENANCE=new ThreadLocal<>();
 public static AutoCloseable authorizedMaintenanceScope() {
  Boolean prior=MAINTENANCE.get(); MAINTENANCE.set(true);
  return ()->{if(prior==null)MAINTENANCE.remove();else MAINTENANCE.set(prior);};
 }
 public static void requireUnmappedSourceRead(JdbcTemplate jdbc) {
  if(!Boolean.TRUE.equals(MAINTENANCE.get()) && jdbc.queryForObject(
    "SELECT COUNT(*) FROM diagnostic_active_reservations",Integer.class)>0)
   throw new org.springframework.web.server.ResponseStatusException(
    org.springframework.http.HttpStatus.CONFLICT,"Unmapped source access requires an audited maintenance exposure");
 }

 public static Set<String> blockedIds(JdbcTemplate jdbc) {
  return new HashSet<>(jdbc.queryForList("SELECT id FROM diagnostic_blocked_questions",String.class));
 }
 public static void requireAvailable(JdbcTemplate jdbc,String questionId) {
  if(questionId!=null && jdbc.queryForObject(
    "SELECT COUNT(*) FROM diagnostic_blocked_questions WHERE id=?",Integer.class,questionId)>0)
   throw new IllegalArgumentException("Diagnostic quarantine prevents operational access");
 }
 public static List<?> availableIds(JdbcTemplate jdbc,List<?> ids) {
  Set<String> blocked=blockedIds(jdbc);
  return ids.stream().filter(id->!blocked.contains(String.valueOf(id))).toList();
 }
}
