package com.fiscalstudy.backend.domain;

public interface EventStoreRepository {
    void appendEvent(String eventType, String aggregateType, String aggregateId, String sessionId, int eventVersion, String schemaVersion, String payloadJson);
    boolean hasRecentEvent(String eventType, String aggregateId, String sessionId, int minutes);
    boolean hasRecentEventSeconds(String eventType, String aggregateId, String sessionId, int seconds);
    java.util.List<String> getEventPayloads(String sessionId, String eventType);

}
