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
        String since = Instant.now().minusSeconds(minutes * 60L).toString();
        String sql = "SELECT COUNT(*) FROM event_store " +
                     "WHERE event_type = ? AND aggregate_id = ? AND session_id = ? AND occurred_at >= ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, eventType, aggregateId, sessionId, since);
        return count != null && count > 0;
    }
}
