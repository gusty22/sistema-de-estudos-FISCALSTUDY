package com.fiscalstudy.backend.infrastructure.in.web;

import com.fiscalstudy.backend.application.EditalImportService;
import com.fiscalstudy.backend.domain.Edital;
import com.fiscalstudy.backend.domain.EditalRepository;
import com.fiscalstudy.backend.domain.EditalTopico;
import com.fiscalstudy.backend.infrastructure.in.web.dto.EditalValidationResultDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping({"/api/v1/edital", "/api/v1/editais"})
public class EditalImportController {

    private final EditalImportService editalImportService;
    private final EditalRepository editalRepository;

    public EditalImportController(EditalImportService editalImportService,
                                  @org.springframework.beans.factory.annotation.Autowired(required = false) EditalRepository editalRepository) {
        this.editalImportService = editalImportService;
        this.editalRepository = editalRepository;
    }

    /**
     * Endpoint de validação puramente em memória, independente de concurso.
     * Permite validar e inspecionar a hierarquia do edital JSON antes da criação do concurso.
     * Zero efeitos colaterais e zero persistência no banco.
     */
    @PostMapping(value = "/validate-json", consumes = {"application/json", "text/plain", "*/*"})
    public ResponseEntity<EditalValidationResultDTO> validateEditalJsonStandalone(@RequestBody String rawJson) {
        EditalValidationResultDTO result = editalImportService.validateJson(rawJson);
        return ResponseEntity.ok(result);
    }

    /**
     * Endpoint centralizado para qualquer módulo consultar o Edital Verticalizado e seus tópicos.
     */
    @GetMapping({"", "/topicos", "/topics", "/current"})
    public ResponseEntity<Map<String, Object>> getEditalGlobal(
            @RequestParam(required = false) String concursoId) {
        if (editalRepository == null) {
            return ResponseEntity.ok(Map.of("topicos", List.of(), "totalTopicos", 0));
        }

        List<EditalTopico> topicos = editalRepository.findTopicosByConcurso(concursoId);
        List<Edital> editais = editalRepository.findEditaisByConcurso(concursoId);

        String effectiveConcursoId = (concursoId != null && !concursoId.isBlank() && !"undefined".equalsIgnoreCase(concursoId))
                ? concursoId
                : (!topicos.isEmpty() ? topicos.get(0).getConcursoId() : (!editais.isEmpty() ? editais.get(0).getConcursoId() : ""));

        Map<String, Object> resp = new HashMap<>();
        resp.put("concursoId", effectiveConcursoId);
        resp.put("editais", editais);
        resp.put("topicos", topicos);
        resp.put("totalTopicos", topicos.size());
        resp.put("totalConfirmados", topicos.stream().filter(EditalTopico::isConfirmadoHumano).count());

        return ResponseEntity.ok(resp);
    }
}
