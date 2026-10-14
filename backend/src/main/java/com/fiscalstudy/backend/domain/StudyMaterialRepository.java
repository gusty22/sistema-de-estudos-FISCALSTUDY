package com.fiscalstudy.backend.domain;

import java.util.List;
import java.util.Optional;

public interface StudyMaterialRepository {
    List<StudyMaterial> findByConcursoIdOrGlobal(String concursoId);
    List<StudyMaterial> findByDisciplina(String concursoId, String disciplina);
    Optional<StudyMaterial> findById(String id);
    StudyMaterial save(StudyMaterial material);
    void delete(String id);

    List<TopicMaterialLink> findLinksByTopicoId(String topicoId);
    List<TopicMaterialLink> findLinksByMaterialId(String materialId);
    List<TopicMaterialLink> findLinksByConcursoId(String concursoId);
    TopicMaterialLink saveLink(TopicMaterialLink link);
    void deleteLink(String id);
}
