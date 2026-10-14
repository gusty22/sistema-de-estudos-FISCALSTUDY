package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.StudyMaterialService;
import com.fiscalstudy.backend.domain.StudyMaterial;
import com.fiscalstudy.backend.domain.TopicMaterialLink;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/materials")
public class StudyMaterialController {

    private final StudyMaterialService materialService;

    public StudyMaterialController(StudyMaterialService materialService) {
        this.materialService = materialService;
    }

    @GetMapping
    public ResponseEntity<List<StudyMaterial>> getMaterials(@RequestParam(required = false) String concursoId,
                                                            @RequestParam(required = false) String disciplina) {
        if (disciplina != null && !disciplina.isBlank()) {
            return ResponseEntity.ok(materialService.getMaterialsByDisciplina(concursoId, disciplina));
        }
        return ResponseEntity.ok(materialService.getMaterialsForConcurso(concursoId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudyMaterial> getMaterialById(@PathVariable String id) {
        return materialService.getMaterialById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<StudyMaterial> saveMaterial(@RequestBody StudyMaterial material) {
        return ResponseEntity.ok(materialService.saveMaterial(material));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMaterial(@PathVariable String id) {
        materialService.deleteMaterial(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/links")
    public ResponseEntity<List<TopicMaterialLink>> getLinks(@RequestParam(required = false) String concursoId,
                                                            @RequestParam(required = false) String topicoId,
                                                            @RequestParam(required = false) String materialId) {
        if (topicoId != null && !topicoId.isBlank()) {
            return ResponseEntity.ok(materialService.getLinksByTopico(topicoId));
        }
        if (materialId != null && !materialId.isBlank()) {
            return ResponseEntity.ok(materialService.getLinksByMaterial(materialId));
        }
        return ResponseEntity.ok(materialService.getLinksByConcurso(concursoId));
    }

    @PostMapping("/links")
    public ResponseEntity<TopicMaterialLink> saveLink(@RequestBody TopicMaterialLink link) {
        return ResponseEntity.ok(materialService.saveLink(link));
    }

    @DeleteMapping("/links/{id}")
    public ResponseEntity<Void> deleteLink(@PathVariable String id) {
        materialService.deleteLink(id);
        return ResponseEntity.noContent().build();
    }
}
