package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StudentRoutineService;
import com.fiscalstudy.backend.domain.RoutineCommitment;
import com.fiscalstudy.backend.domain.RoutineException;
import com.fiscalstudy.backend.domain.StudentRoutine;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/routine")
public class StudentRoutineController {

    private final StudentRoutineService routineService;

    public StudentRoutineController(StudentRoutineService routineService) {
        this.routineService = routineService;
    }

    @GetMapping
    public ResponseEntity<StudentRoutine> getRoutine(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(routineService.getRoutineForConcurso(concursoId));
    }

    @PostMapping
    public ResponseEntity<StudentRoutine> saveRoutine(@RequestBody StudentRoutine routine) {
        return ResponseEntity.ok(routineService.saveRoutine(routine));
    }

    @GetMapping("/effective-hours")
    public ResponseEntity<Map<String, Object>> getEffectiveHours(@RequestParam(required = false) String concursoId,
                                                                 @RequestParam(required = false) String date) {
        LocalDate localDate = (date != null && !date.isBlank()) ? LocalDate.parse(date) : LocalDate.now();
        double hours = routineService.getEffectiveHoursForDate(concursoId, localDate);
        return ResponseEntity.ok(Map.of(
                "date", localDate.toString(),
                "effectiveHours", hours,
                "effectiveMinutes", (int)(hours * 60)
        ));
    }

    @GetMapping("/commitments")
    public ResponseEntity<List<RoutineCommitment>> getCommitments() {
        return ResponseEntity.ok(routineService.getAllCommitments());
    }

    @PostMapping("/commitments")
    public ResponseEntity<RoutineCommitment> saveCommitment(@RequestBody RoutineCommitment commitment) {
        return ResponseEntity.ok(routineService.saveCommitment(commitment));
    }

    @DeleteMapping("/commitments/{id}")
    public ResponseEntity<Void> deleteCommitment(@PathVariable String id) {
        routineService.deleteCommitment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/exceptions")
    public ResponseEntity<List<RoutineException>> getExceptions() {
        return ResponseEntity.ok(routineService.getAllExceptions());
    }

    @PostMapping("/exceptions")
    public ResponseEntity<RoutineException> saveException(@RequestBody RoutineException exception) {
        return ResponseEntity.ok(routineService.saveException(exception));
    }

    @DeleteMapping("/exceptions/{id}")
    public ResponseEntity<Void> deleteException(@PathVariable String id) {
        routineService.deleteException(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import-json")
    public ResponseEntity<Map<String, Object>> importRoutineFromJson(
            @RequestParam(required = false) String concursoId,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(routineService.importRoutineFromJson(concursoId, payload));
    }
}
