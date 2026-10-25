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
        if (material != null) {
            // Se a disciplina vier vazia ou como Geral/Padrão, infere pelo título ou notas
            String currDisc = material.getDisciplina();
            if (currDisc == null || currDisc.isBlank() || currDisc.equalsIgnoreCase("Geral") || currDisc.equalsIgnoreCase("Outras Disciplinas")) {
                String detected = inferDisciplinaFromText(material.getTitulo(), material.getNotas());
                if (detected != null) {
                    material.setDisciplina(detected);
                }
            }
        }
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

    @org.springframework.transaction.annotation.Transactional
    public TopicMaterialLink updateProgress(String linkId, int paginasLidas, String status) {
        if (paginasLidas < 0) throw new IllegalArgumentException("Progresso não pode ser negativo");
        String resolvedStatus = status != null ? status : (paginasLidas > 0 ? "EM_ANDAMENTO" : "NAO_INICIADO");
        if (!Set.of("NAO_INICIADO","EM_ANDAMENTO","CONCLUIDO").contains(resolvedStatus)) throw new IllegalArgumentException("Status de progresso inválido");
        int changed = jdbcTemplate.update("UPDATE topic_material_links SET paginas_lidas = ?, status = ? WHERE id = ?", paginasLidas, resolvedStatus, linkId);
        if (changed != 1) throw new IllegalArgumentException("Vínculo de material não encontrado");
        return materialRepository.findLinksByTopicoId(jdbcTemplate.queryForObject("SELECT topico_id FROM topic_material_links WHERE id = ?", String.class, linkId)).stream()
                .filter(link -> linkId.equals(link.getId())).findFirst().orElseThrow(() -> new IllegalStateException("Vínculo atualizado não recuperável"));
    }

    public Optional<StudyMaterial> updateMaterialProgress(String id, int paginaAtual) {
        Optional<StudyMaterial> matOpt = materialRepository.findById(id);
        if (matOpt.isEmpty()) return Optional.empty();
        StudyMaterial material = matOpt.get();
        material.setPaginaAtual(Math.max(0, paginaAtual));
        materialRepository.save(material);
        return Optional.of(material);
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

            // Validação estrita de compatibilidade de disciplina:
            // Se ambas as disciplinas estiverem informadas, uma deve coincidir ou conter a outra.
            // Se o material tem disciplina "Português", NUNCA pode vincular com "Auditoria" ou "Direito Tributário".
            boolean hasMatDisc = !normMatDisc.isBlank() && !normMatDisc.equals("geral");
            boolean hasTopicDisc = !normDisc.isBlank();
            boolean discMatches = !hasMatDisc || !hasTopicDisc || normDisc.contains(normMatDisc) || normMatDisc.contains(normDisc);

            if (!discMatches) {
                // Disciplinas incompatíveis -> descarta vínculo
                continue;
            }

            double confidence = 0.0;
            if (combinedMaterialText.contains(normAssunto) && !normAssunto.isBlank()) {
                confidence = hasMatDisc ? 0.95 : 0.85;
            } else if (topicSubassunto != null && !topicSubassunto.isBlank()) {
                String normSub = normalizeText(topicSubassunto);
                if (combinedMaterialText.contains(normSub)) {
                    confidence = hasMatDisc ? 0.90 : 0.80;
                }
            } else {
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
                } else if (significantWords > 0 && matchCount > 0 && hasMatDisc) {
                    confidence = 0.65;
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

    private String inferDisciplinaFromText(String titulo, String notas) {
        String combined = normalizeText((titulo != null ? titulo : "") + " " + (notas != null ? notas : ""));
        if (combined.contains("gramatic") || combined.contains("adverbio") || combined.contains("substantivo") ||
                combined.contains("adjetivo") || combined.contains("crase") || combined.contains("pontuacao") ||
                combined.contains("concordancia") || combined.contains("regencia") || combined.contains("sintaxe") ||
                combined.contains("morfologia") || combined.contains("ortografia") || combined.contains("portugues")) {
            return "Língua Portuguesa";
        }
        if (combined.contains("tribut") || combined.contains("ctn") || combined.contains("imposto") ||
                combined.contains("icms") || combined.contains("iss") || combined.contains("iptu") ||
                combined.contains("itcmd") || combined.contains("ipva") || combined.contains("credito tributario")) {
            return "Direito Tributário";
        }
        if (combined.contains("constituc") || combined.contains("direitos fundamentais") || combined.contains("stf") ||
                combined.contains("reparticao de competencias") || combined.contains("poder executivo")) {
            return "Direito Constitucional";
        }
        if (combined.contains("administrativ") || combined.contains("atos administrativos") || combined.contains("licitac") ||
                combined.contains("lei 14133") || combined.contains("lei 8666") || combined.contains("servidores publicos")) {
            return "Direito Administrativo";
        }
        if (combined.contains("auditoria") || combined.contains("parecer") || combined.contains("relatorio de auditoria") ||
                combined.contains("evidencia de auditoria") || combined.contains("nbc ta")) {
            return "Auditoria";
        }
        if (combined.contains("contabil") || combined.contains("balanco patrimonial") || combined.contains("dre") ||
                combined.contains("ativo circulante") || combined.contains("debito") || combined.contains("credito")) {
            return "Contabilidade Geral";
        }
        return null;
    }
}
