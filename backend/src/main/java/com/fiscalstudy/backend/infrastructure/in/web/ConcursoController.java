package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.domain.Concurso;
import com.fiscalstudy.backend.domain.ConcursoRepository;
import com.fiscalstudy.backend.infrastructure.in.web.dto.ConcursoDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/v1/concursos")
public class ConcursoController {

    private final ConcursoRepository concursoRepository;

    public ConcursoController(ConcursoRepository concursoRepository) {
        this.concursoRepository = concursoRepository;
    }

    @GetMapping
    public ResponseEntity<List<ConcursoDTO>> listConcursos(@RequestParam(value = "status", required = false) String status) {
        List<Concurso> list = concursoRepository.findAll(status);
        List<ConcursoDTO> dtos = list.stream()
                .map(c -> new ConcursoDTO(c, concursoRepository.countAvailableQuestions(c.getId())))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConcursoDTO> getConcurso(@PathVariable String id) {
        return concursoRepository.findById(id)
                .map(c -> ResponseEntity.ok(new ConcursoDTO(c, concursoRepository.countAvailableQuestions(c.getId()))))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ConcursoDTO> createConcurso(@RequestBody Concurso c) {
        if (c.getNome() == null || c.getNome().isBlank()) {
            throw new IllegalArgumentException("O nome do concurso é obrigatório.");
        }
        if (c.getOrgao() == null || c.getOrgao().isBlank()) {
            throw new IllegalArgumentException("O órgão do concurso é obrigatório.");
        }

        if (c.getId() == null || c.getId().isBlank()) {
            String slug = slugify(c.getOrgao() + "-" + (c.getCargo() != null ? c.getCargo() : "concurso") + "-" + (c.getAno() != null ? c.getAno() : ""));
            c.setId(slug.length() > 5 ? slug : UUID.randomUUID().toString());
        }

        if (c.getStatus() == null || c.getStatus().isBlank()) {
            c.setStatus("ACTIVE");
        }

        Concurso saved = concursoRepository.save(c);
        return ResponseEntity.ok(new ConcursoDTO(saved, concursoRepository.countAvailableQuestions(saved.getId())));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ConcursoDTO> updateConcurso(@PathVariable String id, @RequestBody Concurso update) {
        return concursoRepository.findById(id)
                .map(existing -> {
                    if (update.getNome() != null) existing.setNome(update.getNome());
                    if (update.getOrgao() != null) existing.setOrgao(update.getOrgao());
                    if (update.getBanca() != null) existing.setBanca(update.getBanca());
                    if (update.getAno() != null) existing.setAno(update.getAno());
                    if (update.getCargo() != null) existing.setCargo(update.getCargo());
                    if (update.getCargoCodigo() != null) existing.setCargoCodigo(update.getCargoCodigo());
                    if (update.getDescricao() != null) existing.setDescricao(update.getDescricao());
                    if (update.getStatus() != null) existing.setStatus(update.getStatus());

                    Concurso saved = concursoRepository.save(existing);
                    return ResponseEntity.ok(new ConcursoDTO(saved, concursoRepository.countAvailableQuestions(saved.getId())));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ConcursoDTO> archiveConcurso(@PathVariable String id) {
        return concursoRepository.findById(id)
                .map(c -> {
                    concursoRepository.updateStatus(id, "ARCHIVED");
                    c.setStatus("ARCHIVED");
                    return ResponseEntity.ok(new ConcursoDTO(c, concursoRepository.countAvailableQuestions(id)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<ConcursoDTO> activateConcurso(@PathVariable String id) {
        return concursoRepository.findById(id)
                .map(c -> {
                    concursoRepository.updateStatus(id, "ACTIVE");
                    c.setStatus("ACTIVE");
                    return ResponseEntity.ok(new ConcursoDTO(c, concursoRepository.countAvailableQuestions(id)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private String slugify(String input) {
        if (input == null) return "concurso";
        return java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replaceAll("[^a-zA-Z0-9]+", "-")
                .toLowerCase()
                .replaceAll("^-+|-+$", "");
    }
}
