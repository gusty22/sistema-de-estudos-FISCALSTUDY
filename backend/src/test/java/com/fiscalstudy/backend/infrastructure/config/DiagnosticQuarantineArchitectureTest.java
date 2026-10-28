package com.fiscalstudy.backend.infrastructure.config;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.util.regex.Pattern;
import static org.junit.jupiter.api.Assertions.*;
/** Prevent accidental raw operational reads. Not a sandbox for hostile code or external SQLite tools. */
class DiagnosticQuarantineArchitectureTest {
 static final Pattern RAW=Pattern.compile("(?i)\\b(?:from|join)\\s+(?:(?:main|temp)\\s*\\.\\s*)?[\\`\\\"\\[]?questions\\b");
 @Test void operationalJavaReadsMustUseTheSharedView() throws Exception {
  try(var files=Files.walk(Path.of("src/main/java"))) {
   for(Path file:files.filter(p->p.toString().endsWith(".java")).toList())
    assertFalse(RAW.matcher(Files.readString(file)).find(),"Unreviewed raw question read: "+file);
  }
 }
 @Test void gateRecognizesCommonQualifiedAndQuotedBypasses() {
  for(String sql:new String[]{"SELECT * FROM questions","SELECT * FROM main.questions","SELECT * FROM main.\"questions\"","JOIN [questions] q"})
   assertTrue(RAW.matcher(sql).find(),sql);
  assertFalse(RAW.matcher("SELECT * FROM study_questions").find());
 }
}
