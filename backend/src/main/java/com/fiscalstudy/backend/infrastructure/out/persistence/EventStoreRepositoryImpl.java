package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public class EventStoreRepositoryImpl implements EventStoreRepository {

    private final JdbcTemplate jdbcTemplate;

    public EventStoreRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void appendEvent(String eventType, String aggregateType, String aggregateId, String sessionId, int eventVersion, String schemaVersion, String payloadJson) {
        String eventId = UUID.randomUUID().toString();
        String now = Instant.now().toString();

        String sql = "INSERT INTO event_store (event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                     
        jdbcTemplate.update(sql, eventId, eventType, aggregateType, aggregateId, sessionId, now, now, eventVersion, schemaVersion, payloadJson);
    }

    @Override
    public boolean hasRecentEvent(String eventType, String aggregateId, String sessionId, int minutes) {
        return hasRecentEventSeconds(eventType, aggregateId, sessionId, minutes * 60);
    }

    @Override
    public boolean hasRecentEventSeconds(String eventType, String aggregateId, String sessionId, int seconds) {
        String since = Instant.now().minusSeconds(seconds).toString();
        String sql = "SELECT COUNT(*) FROM event_store " +
                     "WHERE event_type = ? AND aggregate_id = ? AND session_id = ? AND occurred_at >= ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, eventType, aggregateId, sessionId, since);
        return count != null && count > 0;
    }


    @Override
    public boolean hasEvent(String eventType, String aggregateId, String sessionId) {
        String sql = "SELECT COUNT(*) FROM event_store WHERE event_type = ? AND aggregate_id = ? AND session_id = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, eventType, aggregateId, sessionId);
        return count != null && count > 0;
    }

    @Override
    public boolean isSessionEnded(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return false;
        String sql = "SELECT COUNT(*) FROM event_store WHERE event_type = 'STUDY_SESSION_ENDED' AND session_id = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, sessionId);
        return count != null && count > 0;
    }

    @Override
    public java.util.List<String> getEventPayloads(String sessionId, String eventType) {
        String sql = "SELECT payload_json FROM event_store WHERE session_id = ? AND event_type = ?";
        return jdbcTemplate.queryForList(sql, String.class, sessionId, eventType);
    }

    @Override
    public java.util.List<String> getAllEventPayloads(String eventType) {
        String sql = "SELECT payload_json FROM event_store WHERE event_type = ? ORDER BY occurred_at ASC";
        return jdbcTemplate.queryForList(sql, String.class, eventType);
    }

    @Override
    public java.util.List<com.fiscalstudy.backend.domain.EventRecord> getAllEvents(String eventType) {
        String sql = "SELECT event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json " +
                     "FROM event_store WHERE event_type = ? ORDER BY occurred_at ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new com.fiscalstudy.backend.domain.EventRecord(
                rs.getString("event_id"),
                rs.getString("event_type"),
                rs.getString("aggregate_type"),
                rs.getString("aggregate_id"),
                rs.getString("session_id"),
                rs.getString("occurred_at"),
                rs.getString("recorded_at"),
                rs.getInt("event_version"),
                rs.getString("schema_version"),
                rs.getString("payload_json")
        ), eventType);
    }

    @Override
    public java.util.List<com.fiscalstudy.backend.domain.EventRecord> getAllEvents() {
        String sql = "SELECT event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json " +
                     "FROM event_store ORDER BY occurred_at ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new com.fiscalstudy.backend.domain.EventRecord(
                rs.getString("event_id"),
                rs.getString("event_type"),
                rs.getString("aggregate_type"),
                rs.getString("aggregate_id"),
                rs.getString("session_id"),
                rs.getString("occurred_at"),
                rs.getString("recorded_at"),
                rs.getInt("event_version"),
                rs.getString("schema_version"),
                rs.getString("payload_json")
        ));
    }
}
