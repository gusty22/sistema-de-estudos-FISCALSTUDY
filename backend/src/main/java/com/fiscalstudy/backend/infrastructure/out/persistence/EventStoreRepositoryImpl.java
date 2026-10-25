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
    public boolean appendEventOnce(String eventId, String eventType, String aggregateType, String aggregateId, String sessionId, String occurredAt, String payloadJson) {
        return jdbcTemplate.update("INSERT INTO event_store (event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json) VALUES (?,?,?,?,?,?,?,2,'v2',?) ON CONFLICT(event_id) DO NOTHING",
                eventId,eventType,aggregateType,aggregateId,sessionId,occurredAt,Instant.now().toString(),payloadJson)==1;
    }

    @Override
    public java.util.Optional<com.fiscalstudy.backend.domain.EventRecord> findByEventId(String eventId) {
        var rows=jdbcTemplate.query("SELECT * FROM event_store WHERE event_id=?", (rs,n)->new com.fiscalstudy.backend.domain.EventRecord(rs.getString("event_id"),rs.getString("event_type"),rs.getString("aggregate_type"),rs.getString("aggregate_id"),rs.getString("session_id"),rs.getString("occurred_at"),rs.getString("recorded_at"),rs.getInt("event_version"),rs.getString("schema_version"),rs.getString("payload_json")),eventId);
        return rows.stream().findFirst();
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
        String sql = "SELECT payload_json FROM event_store WHERE session_id = ? AND event_type = ? ORDER BY occurred_at,rowid";
        return jdbcTemplate.queryForList(sql, String.class, sessionId, eventType);
    }

    @Override
    public java.util.List<String> getAllEventPayloads(String eventType) {
        String sql = "SELECT payload_json FROM event_store WHERE event_type = ? ORDER BY occurred_at ASC";
        return jdbcTemplate.queryForList(sql, String.class, eventType);
    }

    @Override
    public long getMaxRowid() {
        Long max = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(rowid), 0) FROM event_store", Long.class);
        return max != null ? max : 0L;
    }

    @Override
    public java.util.List<com.fiscalstudy.backend.domain.EventRecord> getEventsUpTo(String eventType, long maxRowid) {
        String sql = "SELECT event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json " +
                     "FROM event_store WHERE event_type = ? AND rowid <= ? ORDER BY occurred_at ASC, rowid ASC";
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
        ), eventType, maxRowid);
    }

    @Override
    public java.util.List<com.fiscalstudy.backend.domain.EventRecord> getAllEvents(String eventType) {
        return getEventsUpTo(eventType, Long.MAX_VALUE);
    }

    @Override
    public java.util.List<com.fiscalstudy.backend.domain.EventRecord> getAllEvents() {
        String sql = "SELECT event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json " +
                     "FROM event_store ORDER BY occurred_at ASC, rowid ASC";
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

    @Override
    public int countPreviousAttempts(String questionId) {
        if (questionId == null || questionId.isBlank()) return 0;
        String sql = "SELECT COUNT(*) FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND aggregate_id = ? AND json_valid(payload_json) AND json_extract(payload_json,'$.origin')='REAL_STUDY'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, questionId);
        return count != null ? count : 0;
    }

    @Override
    public java.util.Optional<com.fiscalstudy.backend.domain.EventRecord> findLatestAttempt(String questionId) {
        if (questionId == null || questionId.isBlank()) return java.util.Optional.empty();
        String sql = "SELECT event_id, event_type, aggregate_type, aggregate_id, session_id, occurred_at, recorded_at, event_version, schema_version, payload_json " +
                     "FROM event_store WHERE event_type = 'ANSWER_SUBMITTED' AND aggregate_id = ? AND json_valid(payload_json) AND json_extract(payload_json,'$.origin')='REAL_STUDY' ORDER BY occurred_at DESC, rowid DESC LIMIT 1";
        java.util.List<com.fiscalstudy.backend.domain.EventRecord> list = jdbcTemplate.query(sql, (rs, rowNum) -> new com.fiscalstudy.backend.domain.EventRecord(
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
        ), questionId);
        return list.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(list.get(0));
    }
}
