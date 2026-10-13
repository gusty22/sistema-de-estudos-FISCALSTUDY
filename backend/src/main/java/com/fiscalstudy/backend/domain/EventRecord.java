package com.fiscalstudy.backend.domain;

/**
 * Representação imutável de um registro do event_store.
 */
public class EventRecord {
    private final String eventId;
    private final String eventType;
    private final String aggregateType;
    private final String aggregateId;
    private final String sessionId;
    private final String occurredAt;
    private final String recordedAt;
    private final int eventVersion;
    private final String schemaVersion;
    private final String payloadJson;

    public EventRecord(String eventId, String eventType, String aggregateType, String aggregateId,
                       String sessionId, String occurredAt, String recordedAt,
                       int eventVersion, String schemaVersion, String payloadJson) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.sessionId = sessionId;
        this.occurredAt = occurredAt;
        this.recordedAt = recordedAt;
        this.eventVersion = eventVersion;
        this.schemaVersion = schemaVersion;
        this.payloadJson = payloadJson;
    }

    public String getEventId() { return eventId; }
    public String getEventType() { return eventType; }
    public String getAggregateType() { return aggregateType; }
    public String getAggregateId() { return aggregateId; }
    public String getSessionId() { return sessionId; }
    public String getOccurredAt() { return occurredAt; }
    public String getRecordedAt() { return recordedAt; }
    public int getEventVersion() { return eventVersion; }
    public String getSchemaVersion() { return schemaVersion; }
    public String getPayloadJson() { return payloadJson; }
}
