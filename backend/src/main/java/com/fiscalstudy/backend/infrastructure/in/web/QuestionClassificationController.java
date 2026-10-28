package com.fiscalstudy.backend.infrastructure.in.web;
import com.fiscalstudy.backend.application.QuestionClassificationService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/v1/question-classification")
public class QuestionClassificationController {
 private final QuestionClassificationService service;
 public QuestionClassificationController(QuestionClassificationService service){this.service=service;}
 @GetMapping("/coverage") public Map<String,Object> coverage(@RequestParam(required=false) String concursoId){return service.coverage(concursoId);}
 @GetMapping("/topics") public List<Map<String,Object>> topics(@RequestParam(required=false) String concursoId){return service.topics(concursoId);}
 @GetMapping("/questions") public List<Map<String,Object>> questions(@RequestParam(defaultValue="true") boolean unclassified,@RequestParam(defaultValue="50") int limit,@RequestParam(defaultValue="0") int offset,@RequestParam(required=false) String topicId){return service.questions(unclassified,limit,offset,topicId);}
 @GetMapping("/questions/{id}") public List<Map<String,Object>> history(@PathVariable String id){return service.history(id);}
 @GetMapping("/questions/{id}/family") public Map<String,Object> family(@PathVariable String id){var identity=service.family(id); return Map.of("questionId",id,"fingerprintVersion",identity.get("fingerprintVersion"),"conceptualEquivalenceVerified",false,"familyIdentifier","INTERNAL_NOT_EXPOSED");}
 @PostMapping("/questions/{id}") public Map<String,Object> classify(@PathVariable String id,@RequestBody QuestionClassificationService.Classification request){return service.classify(id,request);}
}
