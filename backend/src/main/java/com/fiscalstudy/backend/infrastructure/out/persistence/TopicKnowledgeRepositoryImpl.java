package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeProjection;
import com.fiscalstudy.backend.domain.knowledge.TopicKnowledgeRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class TopicKnowledgeRepositoryImpl implements TopicKnowledgeRepository {

    private final JdbcTemplate jdbcTemplate;

    public TopicKnowledgeRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<TopicKnowledgeProjection> ROW_MAPPER = new RowMapper<TopicKnowledgeProjection>() {
        @Override
        public TopicKnowledgeProjection mapRow(ResultSet rs, int rowNum) throws SQLException {
            TopicKnowledgeProjection projection = new TopicKnowledgeProjection();
            projection.setTopicId(rs.getString("topic_id"));
            projection.setDisciplineId(rs.getString("discipline_id"));
            projection.setTopicName(rs.getString("topic_name"));

            projection.setTotalAttempts(rs.getInt("total_attempts"));
            projection.setCorrectAttempts(rs.getInt("correct_attempts"));
            projection.setErrorAttempts(rs.getInt("error_attempts"));
            projection.setAccuracyRate(rs.getDouble("accuracy_rate"));
            projection.setAccuracyDenominatorText(rs.getString("accuracy_denominator_text"));

            projection.setTotalActiveTimeMs(rs.getLong("total_active_time_ms"));
            projection.setAverageActiveTimeMs(rs.getLong("average_active_time_ms"));

            String lastAttempt = rs.getString("last_attempt_at");
            if (lastAttempt != null && !lastAttempt.isBlank()) {
                try {
                    projection.setLastAttemptAt(Instant.parse(lastAttempt));
                } catch (Exception ignored) {}
            }

            projection.setUniqueQuestionsCount(rs.getInt("unique_questions_count"));
            projection.setNewQuestionsAttempts(rs.getInt("new_questions_attempts"));
            projection.setRepeatedQuestionsAttempts(rs.getInt("repeated_questions_attempts"));
            projection.setVariantQuestionsAttempts(rs.getInt("variant_questions_attempts"));

            double avgConf = rs.getDouble("avg_confidence_ordinal");
            projection.setAvgConfidenceOrdinal(rs.wasNull() ? null : avgConf);

            projection.setLowConfidenceSuccesses(rs.getInt("low_confidence_successes"));
            projection.setHighConfidenceErrors(rs.getInt("high_confidence_errors"));

            projection.setConfidenceDistributionJson(rs.getString("confidence_distribution_json"));
            projection.setContextDistributionJson(rs.getString("context_distribution_json"));
            projection.setErrorCausesDistributionJson(rs.getString("error_causes_distribution_json"));

            double stability = rs.getDouble("fsrs_stability_days");
            projection.setFsrsStabilityDays(rs.wasNull() ? null : stability);

            double recall = rs.getDouble("fsrs_retrieval_rate");
            projection.setFsrsRetrievalRate(rs.wasNull() ? null : recall);

            projection.setEvidenceStatus(rs.getString("evidence_status"));
            projection.setEpistemicLimitationsJson(rs.getString("epistemic_limitations_json"));
            projection.setPedagogicalHypothesesJson(rs.getString("pedagogical_hypotheses_json"));

            String updatedStr = rs.getString("updated_at");
            if (updatedStr != null) {
                try {
                    projection.setUpdatedAt(Instant.parse(updatedStr));
                } catch (Exception e) {
                    projection.setUpdatedAt(Instant.now());
                }
            }
            return projection;
        }
    };

    @Override
    public void saveOrUpdate(TopicKnowledgeProjection p) {
        String sql = """
            INSERT INTO topic_knowledge_projections (
                topic_id, discipline_id, topic_name, total_attempts, correct_attempts, error_attempts,
                accuracy_rate, accuracy_denominator_text, total_active_time_ms, average_active_time_ms,
                last_attempt_at, unique_questions_count, new_questions_attempts, repeated_questions_attempts,
                variant_questions_attempts, avg_confidence_ordinal, low_confidence_successes,
                high_confidence_errors, confidence_distribution_json, context_distribution_json,
                error_causes_distribution_json, fsrs_stability_days, fsrs_retrieval_rate, evidence_status,
                epistemic_limitations_json, pedagogical_hypotheses_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topic_id) DO UPDATE SET
                discipline_id = excluded.discipline_id,
                topic_name = excluded.topic_name,
                total_attempts = excluded.total_attempts,
                correct_attempts = excluded.correct_attempts,
                error_attempts = excluded.error_attempts,
                accuracy_rate = excluded.accuracy_rate,
                accuracy_denominator_text = excluded.accuracy_denominator_text,
                total_active_time_ms = excluded.total_active_time_ms,
                average_active_time_ms = excluded.average_active_time_ms,
                last_attempt_at = excluded.last_attempt_at,
                unique_questions_count = excluded.unique_questions_count,
                new_questions_attempts = excluded.new_questions_attempts,
                repeated_questions_attempts = excluded.repeated_questions_attempts,
                variant_questions_attempts = excluded.variant_questions_attempts,
                avg_confidence_ordinal = excluded.avg_confidence_ordinal,
                low_confidence_successes = excluded.low_confidence_successes,
                high_confidence_errors = excluded.high_confidence_errors,
                confidence_distribution_json = excluded.confidence_distribution_json,
                context_distribution_json = excluded.context_distribution_json,
                error_causes_distribution_json = excluded.error_causes_distribution_json,
                fsrs_stability_days = excluded.fsrs_stability_days,
                fsrs_retrieval_rate = excluded.fsrs_retrieval_rate,
                evidence_status = excluded.evidence_status,
                epistemic_limitations_json = excluded.epistemic_limitations_json,
                pedagogical_hypotheses_json = excluded.pedagogical_hypotheses_json,
                updated_at = excluded.updated_at
        """;

        Instant now = p.getUpdatedAt() != null ? p.getUpdatedAt() : Instant.now();
        String lastAttemptStr = p.getLastAttemptAt() != null ? p.getLastAttemptAt().toString() : null;

        jdbcTemplate.update(
            sql,
            p.getTopicId(),
            p.getDisciplineId(),
            p.getTopicName(),
            p.getTotalAttempts(),
            p.getCorrectAttempts(),
            p.getErrorAttempts(),
            p.getAccuracyRate(),
            p.getAccuracyDenominatorText(),
            p.getTotalActiveTimeMs(),
            p.getAverageActiveTimeMs(),
            lastAttemptStr,
            p.getUniqueQuestionsCount(),
            p.getNewQuestionsAttempts(),
            p.getRepeatedQuestionsAttempts(),
            p.getVariantQuestionsAttempts(),
            p.getAvgConfidenceOrdinal(),
            p.getLowConfidenceSuccesses(),
            p.getHighConfidenceErrors(),
            p.getConfidenceDistributionJson(),
            p.getContextDistributionJson(),
            p.getErrorCausesDistributionJson(),
            p.getFsrsStabilityDays(),
            p.getFsrsRetrievalRate(),
            p.getEvidenceStatus(),
            p.getEpistemicLimitationsJson(),
            p.getPedagogicalHypothesesJson(),
            now.toString()
        );
    }

    @Override
    public Optional<TopicKnowledgeProjection> findByTopicId(String topicId) {
        String sql = "SELECT * FROM topic_knowledge_projections WHERE topic_id = ?";
        try {
            TopicKnowledgeProjection proj = jdbcTemplate.queryForObject(sql, ROW_MAPPER, topicId);
            return Optional.ofNullable(proj);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public List<TopicKnowledgeProjection> findByDisciplineId(String disciplineId) {
        String sql = "SELECT * FROM topic_knowledge_projections WHERE discipline_id = ? ORDER BY accuracy_rate ASC, total_attempts DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER, disciplineId);
    }

    @Override
    public List<TopicKnowledgeProjection> findAll() {
        String sql = "SELECT * FROM topic_knowledge_projections ORDER BY total_attempts DESC, topic_name ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    @Override
    public void deleteAll() {
        jdbcTemplate.update("DELETE FROM topic_knowledge_projections");
    }
}
