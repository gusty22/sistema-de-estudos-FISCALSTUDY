package com.fiscalstudy.backend.application;

import com.fiscalstudy.backend.domain.StudyMaterial;
import com.fiscalstudy.backend.domain.StudyMaterialRepository;
import com.fiscalstudy.backend.domain.TopicMaterialLink;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class StudyMaterialService {

    private final StudyMaterialRepository materialRepository;

    public StudyMaterialService(StudyMaterialRepository materialRepository) {
        this.materialRepository = materialRepository;
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
        List<TopicMaterialLink> allLinks = materialRepository.findLinksByMaterialId(linkId);
        // Ou busca direta pelo id se linkId for o ID do vinculo
        // Atualiza paginas lidas e recalcula status se necessário
        TopicMaterialLink link = new TopicMaterialLink();
        link.setId(linkId);
        link.setPaginasLidas(paginasLidas);
        link.setStatus(status != null ? status : (paginasLidas > 0 ? "EM_ANDAMENTO" : "NAO_INICIADO"));
        return materialRepository.saveLink(link);
    }
}
