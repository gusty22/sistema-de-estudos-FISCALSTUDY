package com.fiscalstudy.backend.application;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
/** Shared supplementary policy for previously materialized item identifiers. */
public final class QuestionAccessPolicy {
 private QuestionAccessPolicy() {}
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
