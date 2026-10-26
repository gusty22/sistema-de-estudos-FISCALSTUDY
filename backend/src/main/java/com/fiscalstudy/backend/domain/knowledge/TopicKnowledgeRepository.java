package com.fiscalstudy.backend.domain.knowledge;

import java.util.List;
import java.util.Optional;

/**
 * Repositório de persistência do Read-Model de Conhecimento Individual por Tópico.
 */
public interface TopicKnowledgeRepository {

    void saveOrUpdate(TopicKnowledgeProjection projection);

    Optional<TopicKnowledgeProjection> findByTopicId(String topicId);

    List<TopicKnowledgeProjection> findByDisciplineId(String disciplineId);

    List<TopicKnowledgeProjection> findAll();

    void deleteAll();
    void replaceAll(List<TopicKnowledgeProjection> projections);
}
