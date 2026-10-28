package com.fiscalstudy.backend.infrastructure.in.web;
import com.fiscalstudy.backend.application.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.util.*;
/** All routes require loopback+admin token through LocalAccessFilter. No reservation creation/release. */
@RestController
@RequestMapping("/api/v1/learning-lab")
public class SourceEvidenceController {
 private final ItemSourceProvenanceService provenance;private final QuarantineSourceExposureService reads;
 public SourceEvidenceController(ItemSourceProvenanceService provenance,QuarantineSourceExposureService reads){this.provenance=provenance;this.reads=reads;}
 public record ExactRequest(String recordId,String stagingQuestionId,String questionId){}
 @PostMapping("/item-provenance/exact")
 public ResponseEntity<?> exact(@RequestBody ExactRequest request)throws Exception{
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
   provenance.registerExact(request.recordId(),request.stagingQuestionId(),request.questionId()));
 }
 @GetMapping("/source-reads")
 public ResponseEntity<?> open(){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
  Map.of("contractVersion","source-read-v1","open",reads.openReads(),"automaticExpiry",false,"reservationCreationEnabled",false));}
 @PostMapping("/source-reads/{id}/uncertain-close")
 public ResponseEntity<?> close(@PathVariable String id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
  Map.of("leaseId",id,"phase",reads.finishRead(id,"UNCERTAIN_CLOSED"),"historyPreserved",true,"cleanNoveltyRestored",false));}
}
