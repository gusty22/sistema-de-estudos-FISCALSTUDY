package com.fiscalstudy.backend.domain;

public interface EventStoreRepository {
    void appendEvent(String eventType, String aggregateType, String aggregateId, String sessionId, int eventVersion, String schemaVersion, String payloadJson);
    boolean hasRecentEvent(String eventType, String aggregateId, String sessionId, int minutes);
    boolean hasRecentEventSeconds(String eventType, String aggregateId, String sessionId, int seconds);
    boolean hasEvent(String eventType, String aggregateId, String sessionId);
    boolean isSessionEnded(String sessionId);
    java.util.List<String> getEventPayloads(String sessionId, String eventType);
    java.util.List<String> getAllEventPayloads(String eventType);
    /** Maior rowid atual do event_store (0 se vazio). Como o log é append-only, delimita um snapshot. */
    long getMaxRowid();
    /** Eventos do tipo informado com rowid <= maxRowid, em ordem determinística (occurred_at, rowid). */
    java.util.List<EventRecord> getEventsUpTo(String eventType, long maxRowid);
    java.util.List<EventRecord> getAllEvents(String eventType);
    java.util.List<EventRecord> getAllEvents();
}
