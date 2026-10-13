package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.domain.Edital;
import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/v1/concursos/{concursoId}/edital")
public class EditalController {

    private final EditalRepository editalRepository;

    public EditalController(EditalRepository editalRepository) {
        this.editalRepository = editalRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getEditalVerticalizado(@PathVariable String concursoId) {
        List<Edital> editais = editalRepository.findEditaisByConcurso(concursoId);
        List<EditalTopico> topicos = editalRepository.findTopicosByConcurso(concursoId);

        Map<String, Object> resp = new HashMap<>();
        resp.put("concursoId", concursoId);
        resp.put("editais", editais);
        resp.put("topicos", topicos);
        resp.put("totalTopicos", topicos.size());
        resp.put("totalConfirmados", topicos.stream().filter(EditalTopico::isConfirmadoHumano).count());

        return ResponseEntity.ok(resp);
    }

    @PostMapping("/topics")
    public ResponseEntity<EditalTopico> addTopico(@PathVariable String concursoId, @RequestBody EditalTopico topico) {
        if (topico.getDisciplina() == null || topico.getDisciplina().isBlank()) {
            throw new IllegalArgumentException("A disciplina é obrigatória.");
        }
        if (topico.getAssunto() == null || topico.getAssunto().isBlank()) {
            throw new IllegalArgumentException("O assunto é obrigatório.");
        }

        if (topico.getId() == null || topico.getId().isBlank()) {
            topico.setId(UUID.randomUUID().toString());
        }
        topico.setConcursoId(concursoId);
        if (topico.getEditalId() == null || topico.getEditalId().isBlank()) {
            List<Edital> editais = editalRepository.findEditaisByConcurso(concursoId);
            topico.setEditalId(editais.isEmpty() ? "edital-" + concursoId : editais.get(0).getId());
        }

        EditalTopico saved = editalRepository.saveTopico(topico);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/topics/{topicId}")
    public ResponseEntity<EditalTopico> updateTopico(
            @PathVariable String concursoId,
            @PathVariable String topicId,
            @RequestBody EditalTopico update) {
        return editalRepository.findTopicoById(topicId)
                .map(existing -> {
                    if (update.getDisciplina() != null) existing.setDisciplina(update.getDisciplina());
                    if (update.getAssunto() != null) existing.setAssunto(update.getAssunto());
                    if (update.getSubassunto() != null) existing.setSubassunto(update.getSubassunto());
                    if (update.getPeso() != null) existing.setPeso(update.getPeso());
                    if (update.getQuestoesPrevistas() != null) existing.setQuestoesPrevistas(update.getQuestoesPrevistas());
                    if (update.getDocOrigem() != null) existing.setDocOrigem(update.getDocOrigem());
                    if (update.getPaginaOrigem() != null) existing.setPaginaOrigem(update.getPaginaOrigem());
                    if (update.getTrechoOrigem() != null) existing.setTrechoOrigem(update.getTrechoOrigem());
                    if (update.getTipoClassificacao() != null) existing.setTipoClassificacao(update.getTipoClassificacao());
                    existing.setConfirmadoHumano(update.isConfirmadoHumano());

                    EditalTopico saved = editalRepository.saveTopico(existing);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/topics/{topicId}")
    public ResponseEntity<Void> deleteTopico(@PathVariable String concursoId, @PathVariable String topicId) {
        editalRepository.deleteTopico(topicId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/topics/{topicId}/confirm")
    public ResponseEntity<EditalTopico> confirmTopico(@PathVariable String concursoId, @PathVariable String topicId) {
        editalRepository.confirmTopico(topicId);
        return editalRepository.findTopicoById(topicId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadEditalDocument(
            @PathVariable String concursoId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "tipo", defaultValue = "ORIGINAL") String tipo,
            @RequestParam(value = "versao", defaultValue = "1.0") String versao) {

        if (file.isEmpty()) {
            throw new IllegalArgumentException("Arquivo de edital vazio não é permitido.");
        }

        String editalId = "edital-" + UUID.randomUUID().toString().substring(0, 8);
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "edital.pdf";

        Edital edital = new Edital(editalId, concursoId, "Edital " + filename, versao, tipo, filename);
        editalRepository.saveEdital(edital);

        int extractedCount = 0;
        // Se arquivo for TXT, extrair linhas de disciplinas/assuntos
        if (filename.toLowerCase().endsWith(".txt")) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                String currentDisciplina = "Conhecimentos Gerais";
                int lineNum = 0;

                while ((line = reader.readLine()) != null) {
                    lineNum++;
                    line = line.trim();
                    if (line.isEmpty()) continue;

                    if (line.toUpperCase().startsWith("DISCIPLINA:") || line.toUpperCase().startsWith("MATÉRIA:") || line.toUpperCase().startsWith("CONTEÚDO:")) {
                        currentDisciplina = line.replaceFirst("(?i)^(DISCIPLINA|MATÉRIA|CONTEÚDO):\\s*", "");
                    } else if (line.length() > 5) {
                        String assunto = line;
                        String subassunto = null;
                        if (line.contains(" - ")) {
                            String[] parts = line.split(" - ", 2);
                            assunto = parts[0];
                            subassunto = parts[1];
                        }
                        EditalTopico t = new EditalTopico(
                                UUID.randomUUID().toString(),
                                editalId,
                                concursoId,
                                currentDisciplina,
                                assunto,
                                subassunto,
                                1.0,
                                null,
                                filename,
                                1,
                                "Linha " + lineNum + ": " + line,
                                "INFERIDA",
                                false
                        );
                        editalRepository.saveTopico(t);
                        extractedCount++;
                    }
                }
            } catch (Exception e) {
                // Ignore parse errors, edital still saved
            }
        }

        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "editalId", editalId,
                "concursoId", concursoId,
                "filename", filename,
                "topicosExtraidos", extractedCount
        ));
    }
}
