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
            projection.setTotalAttempts(rs.getInt("total_attempts"));
            projection.setCorrectAttempts(rs.getInt("correct_attempts"));
            projection.setAccuracyRate(rs.getDouble("accuracy_rate"));

            double brier = rs.getDouble("brier_score");
            projection.setBrierScore(rs.wasNull() ? null : brier);

            projection.setBrierCalibrationStatus(rs.getString("brier_calibration_status"));

            double stability = rs.getDouble("avg_stability_days");
            projection.setAvgStabilityDays(rs.wasNull() ? null : stability);

            double recall = rs.getDouble("current_retrieval_rate");
            projection.setCurrentRetrievalRate(rs.wasNull() ? null : recall);

            double transfer = rs.getDouble("transfer_index");
            projection.setTransferIndex(rs.wasNull() ? null : transfer);

            projection.setSampleConfidenceLevel(rs.getString("sample_confidence_level"));

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
                topic_id, discipline_id, total_attempts, correct_attempts, accuracy_rate,
                brier_score, brier_calibration_status, avg_stability_days, current_retrieval_rate,
                transfer_index, sample_confidence_level, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topic_id) DO UPDATE SET
                discipline_id = excluded.discipline_id,
                total_attempts = excluded.total_attempts,
                correct_attempts = excluded.correct_attempts,
                accuracy_rate = excluded.accuracy_rate,
                brier_score = excluded.brier_score,
                brier_calibration_status = excluded.brier_calibration_status,
                avg_stability_days = excluded.avg_stability_days,
                current_retrieval_rate = excluded.current_retrieval_rate,
                transfer_index = excluded.transfer_index,
                sample_confidence_level = excluded.sample_confidence_level,
                updated_at = excluded.updated_at
        """;

        Instant now = p.getUpdatedAt() != null ? p.getUpdatedAt() : Instant.now();

        jdbcTemplate.update(
            sql,
            p.getTopicId(),
            p.getDisciplineId(),
            p.getTotalAttempts(),
            p.getCorrectAttempts(),
            p.getAccuracyRate(),
            p.getBrierScore(),
            p.getBrierCalibrationStatus(),
            p.getAvgStabilityDays(),
            p.getCurrentRetrievalRate(),
            p.getTransferIndex(),
            p.getSampleConfidenceLevel(),
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
        String sql = "SELECT * FROM topic_knowledge_projections WHERE discipline_id = ? ORDER BY accuracy_rate ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER, disciplineId);
    }

    @Override
    public List<TopicKnowledgeProjection> findAll() {
        String sql = "SELECT * FROM topic_knowledge_projections ORDER BY updated_at DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }
}
