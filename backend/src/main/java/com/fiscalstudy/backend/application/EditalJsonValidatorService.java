package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class EditalJsonValidatorService {

    private final ObjectMapper objectMapper;

    public EditalJsonValidatorService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Valida um JSON em formato texto (String), cobrindo análise sintática,
     * estrutural e semântica de integridade.
     */
    public EditalValidationResultDTO validateJsonString(String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) {
            return EditalValidationResultDTO.invalid(List.of("JSON vazio ou não informado."));
        }

        EditalImportPayloadDTO payload;
        try {
            payload = objectMapper.readValue(rawJson, EditalImportPayloadDTO.class);
        } catch (JsonProcessingException e) {
            String location = e.getLocation() != null
                    ? " [Linha " + e.getLocation().getLineNr() + ", Coluna " + e.getLocation().getColumnNr() + "]"
                    : "";
            return EditalValidationResultDTO.invalid(List.of("Erro de sintaxe JSON" + location + ": " + e.getOriginalMessage()));
        } catch (Exception e) {
            return EditalValidationResultDTO.invalid(List.of("Erro ao interpretar estrutura JSON: " + e.getMessage()));
        }

        return validatePayload(payload);
    }

    /**
     * Valida um payload já desserializado, aplicando todas as regras de integridade.
     */
    public EditalValidationResultDTO validatePayload(EditalImportPayloadDTO payload) {
        EditalValidationResultDTO result = new EditalValidationResultDTO();

        if (payload == null || payload.getMaterias() == null || payload.getMaterias().isEmpty()) {
            result.addError("A chave raiz 'materias' é obrigatória e deve conter ao menos uma disciplina.");
            return result;
        }

        Set<String> seenIds = new HashSet<>();
        Set<String> normalizedMateriaNames = new HashSet<>();

        int totalMaterias = 0;
        int totalTopicos = 0;
        int totalSubtopicos = 0;

        List<EditalMateriaImportDTO> normalizedMaterias = new ArrayList<>();

        int materiaIdx = 0;
        for (EditalMateriaImportDTO materia : payload.getMaterias()) {
            materia.setOrdem(materiaIdx);

            // Validação da Matéria
            String matId = materia.getId() != null ? materia.getId().trim() : "";
            String matNome = materia.getNome() != null ? materia.getNome().trim() : "";

            if (matId.isEmpty()) {
                result.addError("Identificador 'id' ausente ou vazio na disciplina na posição " + (materiaIdx + 1) + ".");
            } else if (seenIds.contains(matId)) {
                result.addError("ID duplicado detectado: '" + matId + "'. Todos os IDs de matérias, tópicos e subtópicos devem ser globalmente únicos.");
            } else {
                seenIds.add(matId);
            }

            if (matNome.isEmpty()) {
                result.addError("Nome da disciplina na posição " + (materiaIdx + 1) + " não pode ser vazio.");
            } else {
                String normalizedMatName = matNome.toLowerCase();
                if (normalizedMateriaNames.contains(normalizedMatName)) {
                    result.addWarning("Aviso: Disciplina '" + matNome + "' aparece mais de uma vez na lista de matérias.");
                } else {
                    normalizedMateriaNames.add(normalizedMatName);
                }
            }

            totalMaterias++;

            // Validação dos Tópicos
            List<EditalTopicoImportDTO> topicos = materia.getTopicos();
            if (topicos == null || topicos.isEmpty()) {
                result.addWarning("Aviso: Disciplina '" + (matNome.isEmpty() ? "sem nome" : matNome) + "' não possui tópicos cadastrados.");
            } else {
                Set<String> normalizedTopicoNamesInMateria = new HashSet<>();
                int topicoIdx = 0;

                for (EditalTopicoImportDTO topico : topicos) {
                    topico.setOrdem(topicoIdx);

                    String topId = topico.getId() != null ? topico.getId().trim() : "";
                    String topNome = topico.getNome() != null ? topico.getNome().trim() : "";

                    if (topId.isEmpty()) {
                        result.addError("Identificador 'id' ausente ou vazio no tópico posição " + (topicoIdx + 1) + " da disciplina '" + matNome + "'.");
                    } else if (seenIds.contains(topId)) {
                        result.addError("ID duplicado detectado: '" + topId + "'. Todos os IDs devem ser globalmente únicos.");
                    } else {
                        seenIds.add(topId);
                    }

                    if (topNome.isEmpty()) {
                        result.addError("Nome do tópico na posição " + (topicoIdx + 1) + " da disciplina '" + matNome + "' não pode ser vazio.");
                    } else {
                        String normalizedTopNome = topNome.toLowerCase();
                        if (normalizedTopicoNamesInMateria.contains(normalizedTopNome)) {
                            result.addWarning("Aviso: Tópico '" + topNome + "' aparece duplicado dentro da disciplina '" + matNome + "'.");
                        } else {
                            normalizedTopicoNamesInMateria.add(normalizedTopNome);
                        }
                    }

                    totalTopicos++;

                    // Validação dos Subtópicos
                    List<EditalSubtopicoImportDTO> subtopicos = topico.getSubtopicos();
                    if (subtopicos != null && !subtopicos.isEmpty()) {
                        int subIdx = 0;
                        for (EditalSubtopicoImportDTO sub : subtopicos) {
                            sub.setOrdem(subIdx);

                            String subId = sub.getId() != null ? sub.getId().trim() : "";
                            String subNome = sub.getNome() != null ? sub.getNome().trim() : "";

                            if (subId.isEmpty()) {
                                result.addError("Identificador 'id' ausente ou vazio no subtópico posição " + (subIdx + 1) + " do tópico '" + topNome + "'.");
                            } else if (seenIds.contains(subId)) {
                                result.addError("ID duplicado detectado: '" + subId + "'. Todos os IDs devem ser globalmente únicos.");
                            } else {
                                seenIds.add(subId);
                            }

                            if (subNome.isEmpty()) {
                                result.addError("Nome do subtópico na posição " + (subIdx + 1) + " do tópico '" + topNome + "' não pode ser vazio.");
                            }

                            totalSubtopicos++;
                            subIdx++;
                        }
                    }

                    topicoIdx++;
                }
            }

            normalizedMaterias.add(materia);
            materiaIdx++;
        }

        result.setTotalMaterias(totalMaterias);
        result.setTotalTopicos(totalTopicos);
        result.setTotalSubtopicos(totalSubtopicos);
        result.setNormalizedMaterias(normalizedMaterias);

        // Se houver erros, status é INVALID
        if (!result.getErrors().isEmpty()) {
            result.setValid(false);
            result.setStatus("INVALID");
        } else if (!result.getWarnings().isEmpty()) {
            result.setValid(true);
            result.setStatus("WARNINGS");
        } else {
            result.setValid(true);
            result.setStatus("VALID");
        }

        result.setProcedenciaStatus("JSON_STRUCTURALLY_VALID");
        result.setNotaFidelidade("A validade estrutural do JSON não comprova fidelidade ao edital oficial. Requer revisão e conferência humana.");

        return result;
    }
}
