package com.fiscalstudy.backend.infrastructure.in.web.dto;

public class AnkiConnectStatusDTO {
    private boolean connected;
    private int version;
    private String endpoint;
    private int totalCardsSynced;
    private int pendingQueueCount;
    private String message;

    public AnkiConnectStatusDTO() {}

    public AnkiConnectStatusDTO(boolean connected, int version, String endpoint, int totalCardsSynced, int pendingQueueCount, String message) {
        this.connected = connected;
        this.version = version;
        this.endpoint = endpoint;
        this.totalCardsSynced = totalCardsSynced;
        this.pendingQueueCount = pendingQueueCount;
        this.message = message;
    }

    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public int getTotalCardsSynced() { return totalCardsSynced; }
    public void setTotalCardsSynced(int totalCardsSynced) { this.totalCardsSynced = totalCardsSynced; }

    public int getPendingQueueCount() { return pendingQueueCount; }
    public void setPendingQueueCount(int pendingQueueCount) { this.pendingQueueCount = pendingQueueCount; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
