package com.fiscalstudy.backend.infrastructure.in.web;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
/** Honest readiness only: no creation/release API until all exposure paths are audited. */
@RestController
@RequestMapping("/api/v1/learning-lab/diagnostic-quarantine")
public class DiagnosticQuarantineController {
 @GetMapping("/status") public Map<String,Object> status() {
  return Map.of("contractVersion","diagnostic-quarantine-v1","reservationCreationEnabled",false,
    "status","BLOCKED_PENDING_COMPLETE_EXPOSURE_AUDIT",
    "operationalReadPolicy","STUDY_QUESTIONS_VIEW_WITH_ARCHITECTURE_GATE",
    "externalNovelty","UNKNOWN","can_apply",false,"can_schedule",false);
 }
}
