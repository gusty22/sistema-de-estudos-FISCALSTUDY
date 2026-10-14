package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.StudyMaterial;
import com.fiscalstudy.backend.domain.StudyMaterialRepository;
import com.fiscalstudy.backend.domain.TopicMaterialLink;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.*;

@Service
public class StudyMaterialService {

    private final StudyMaterialRepository materialRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public StudyMaterialService(StudyMaterialRepository materialRepository,
                                org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.materialRepository = materialRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<StudyMaterial> getMaterialsForConcurso(String concursoId) {
        return materialRepository.findByConcursoIdOrGlobal(concursoId);
    }

    public List<StudyMaterial> getMaterialsByDisciplina(String concursoId, String disciplina) {
        return materialRepository.findByDisciplina(concursoId, disciplina);
    }

    public Optional<StudyMaterial> getMaterialById(String id) {
        return materialRepository.findById(id);
    }

    public StudyMaterial saveMaterial(StudyMaterial material) {
        return materialRepository.save(material);
    }

    public void deleteMaterial(String id) {
        materialRepository.delete(id);
    }

    public List<TopicMaterialLink> getLinksByTopico(String topicoId) {
        return materialRepository.findLinksByTopicoId(topicoId);
    }

    public List<TopicMaterialLink> getLinksByMaterial(String materialId) {
        return materialRepository.findLinksByMaterialId(materialId);
    }

    public List<TopicMaterialLink> getLinksByConcurso(String concursoId) {
        return materialRepository.findLinksByConcursoId(concursoId);
    }

    public TopicMaterialLink saveLink(TopicMaterialLink link) {
        return materialRepository.saveLink(link);
    }

    public void deleteLink(String id) {
        materialRepository.deleteLink(id);
    }

    public TopicMaterialLink updateProgress(String linkId, int paginasLidas, String status) {
        TopicMaterialLink link = new TopicMaterialLink();
        link.setId(linkId);
        link.setPaginasLidas(paginasLidas);
        link.setStatus(status != null ? status : (paginasLidas > 0 ? "EM_ANDAMENTO" : "NAO_INICIADO"));
        return materialRepository.saveLink(link);
    }

    /**
     * Análise inteligente de conteúdo do material didático e vinculação automática com os tópicos do edital.
     * Considera título, disciplina, notas e texto do sumário/conteúdo do PDF.
     */
    public List<TopicMaterialLink> autoLinkMaterialToTopics(String materialId, String concursoId, String contentText) {
        Optional<StudyMaterial> matOpt = materialRepository.findById(materialId);
        if (matOpt.isEmpty()) return List.of();
        StudyMaterial material = matOpt.get();

        String sql = "SELECT id, concurso_id, disciplina, assunto, subassunto, peso FROM edital_topicos WHERE 1=1 ";
        List<Object> params = new java.util.ArrayList<>();
        if (concursoId != null && !concursoId.isBlank()) {
            sql += " AND concurso_id = ?";
            params.add(concursoId.trim());
        }

        List<Map<String, Object>> topics = jdbcTemplate.queryForList(sql, params.toArray());
        if (topics.isEmpty()) return List.of();

        String combinedMaterialText = normalizeText(
                (material.getTitulo() != null ? material.getTitulo() : "") + " " +
                (material.getDisciplina() != null ? material.getDisciplina() : "") + " " +
                (material.getNotas() != null ? material.getNotas() : "") + " " +
                (contentText != null ? contentText : "")
        );

        List<TopicMaterialLink> existingLinks = materialRepository.findLinksByMaterialId(materialId);
        Set<String> alreadyLinkedTopicIds = new HashSet<>();
        for (TopicMaterialLink l : existingLinks) {
            alreadyLinkedTopicIds.add(l.getTopicoId());
        }

        List<TopicMaterialLink> newlyCreatedLinks = new java.util.ArrayList<>();
        int totalPags = material.getTotalPaginas() > 0 ? material.getTotalPaginas() : 100;
        int sliceSize = Math.max(10, totalPags / Math.max(topics.size(), 1));
        int currentPagOffset = 1;

        for (Map<String, Object> tRow : topics) {
            String topicId = (String) tRow.get("id");
            String topicDisc = (String) tRow.get("disciplina");
            String topicAssunto = (String) tRow.get("assunto");
            String topicSubassunto = (String) tRow.get("subassunto");

            if (alreadyLinkedTopicIds.contains(topicId)) continue;

            String normAssunto = normalizeText(topicAssunto);
            String normDisc = normalizeText(topicDisc);
            String normMatDisc = normalizeText(material.getDisciplina());

            boolean discMatches = normDisc.isEmpty() || normMatDisc.isEmpty() || normDisc.contains(normMatDisc) || normMatDisc.contains(normDisc);

            double confidence = 0.0;
            if (combinedMaterialText.contains(normAssunto) && !normAssunto.isBlank()) {
                confidence = discMatches ? 0.95 : 0.75;
            } else if (topicSubassunto != null && !topicSubassunto.isBlank()) {
                String normSub = normalizeText(topicSubassunto);
                if (combinedMaterialText.contains(normSub)) {
                    confidence = discMatches ? 0.90 : 0.70;
                }
            } else if (discMatches) {
                // Checa palavras-chave do assunto
                String[] words = normAssunto.split("\\s+");
                int matchCount = 0;
                int significantWords = 0;
                for (String w : words) {
                    if (w.length() >= 4 && !isStopword(w)) {
                        significantWords++;
                        if (combinedMaterialText.contains(w)) {
                            matchCount++;
                        }
                    }
                }
                if (significantWords > 0 && matchCount >= (significantWords + 1) / 2) {
                    confidence = 0.80;
                } else if (matchCount > 0) {
                    confidence = 0.60;
                }
            }

            if (confidence >= 0.60) {
                TopicMaterialLink link = new TopicMaterialLink();
                link.setId(UUID.randomUUID().toString());
                link.setTopicoId(topicId);
                link.setMaterialId(materialId);
                link.setPaginaInicio(currentPagOffset);
                link.setPaginaFim(Math.min(totalPags, currentPagOffset + sliceSize));
                link.setPaginasLidas(0);
                link.setStatus("NAO_INICIADO");
                link.setConfidenceScore(confidence);
                link.setAnotacoes(confidence < 0.75
                        ? "Vínculo sugerido por correspondência parcial (revisão recomendada)."
                        : "Vínculo de alta precisão identificado pelo conteúdo do edital.");
                link.setCreatedAt(java.time.Instant.now().toString());

                materialRepository.saveLink(link);
                newlyCreatedLinks.add(link);
                alreadyLinkedTopicIds.add(topicId);

                currentPagOffset = Math.min(totalPags, currentPagOffset + sliceSize + 1);
            }
        }

        return newlyCreatedLinks;
    }

    public List<TopicMaterialLink> autoLinkAllMaterials(String concursoId) {
        List<StudyMaterial> materials = materialRepository.findByConcursoIdOrGlobal(concursoId);
        List<TopicMaterialLink> allCreated = new java.util.ArrayList<>();
        for (StudyMaterial m : materials) {
            allCreated.addAll(autoLinkMaterialToTopics(m.getId(), concursoId, null));
        }
        return allCreated;
    }

    private String normalizeText(String input) {
        if (input == null) return "";
        return java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean isStopword(String word) {
        return Set.of("para", "como", "sobre", "entre", "pelo", "pela", "pelas", "pelos",
                "com", "sem", "sob", "tras", "desde", "apos", "geral", "especifico").contains(word);
    }
}
