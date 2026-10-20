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

    @DeleteMapping("/links/{linkId}")
    public ResponseEntity<Void> deleteLink(@PathVariable String linkId) {
        materialService.deleteLink(linkId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/auto-link")
    public ResponseEntity<List<TopicMaterialLink>> autoLinkMaterial(
            @PathVariable String id,
            @RequestParam(required = false) String concursoId,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String contentText = body != null ? body.get("contentText") : null;
        return ResponseEntity.ok(materialService.autoLinkMaterialToTopics(id, concursoId, contentText));
    }

    @PostMapping("/auto-link-all")
    public ResponseEntity<List<TopicMaterialLink>> autoLinkAll(@RequestParam(required = false) String concursoId) {
        return ResponseEntity.ok(materialService.autoLinkAllMaterials(concursoId));
    }

    @PatchMapping("/{id}/progress")
    public ResponseEntity<StudyMaterial> updateProgress(
            @PathVariable String id,
            @RequestBody(required = false) java.util.Map<String, Object> payload) {
        int pagina = 0;
        if (payload != null && payload.containsKey("paginaAtual")) {
            pagina = ((Number) payload.get("paginaAtual")).intValue();
        }
        return materialService.updateMaterialProgress(id, pagina)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping(value = {"/{id}/file", "/{id}/stream"})
    public ResponseEntity<org.springframework.core.io.Resource> getMaterialFile(@PathVariable String id) {
        return materialService.getMaterialById(id).map(mat -> {
            String path = mat.getUrlOuCaminho();
            if (path == null || path.isBlank()) {
                return ResponseEntity.notFound().<org.springframework.core.io.Resource>build();
            }
            try {
                java.io.File file = new java.io.File(path);
                if (!file.exists() || !file.isFile()) {
                    return ResponseEntity.notFound().<org.springframework.core.io.Resource>build();
                }
                org.springframework.core.io.Resource resource = new org.springframework.core.io.FileSystemResource(file);
                String contentType = "application/pdf";
                if (path.toLowerCase().endsWith(".txt")) contentType = "text/plain";
                else if (path.toLowerCase().endsWith(".md")) contentType = "text/markdown";
                else if (path.toLowerCase().endsWith(".html") || path.toLowerCase().endsWith(".htm")) contentType = "text/html";

                return ResponseEntity.ok()
                        .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, contentType)
                        .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                        .body(resource);
            } catch (Exception e) {
                return ResponseEntity.internalServerError().<org.springframework.core.io.Resource>build();
            }
        }).orElse(ResponseEntity.notFound().build());
    }
}
