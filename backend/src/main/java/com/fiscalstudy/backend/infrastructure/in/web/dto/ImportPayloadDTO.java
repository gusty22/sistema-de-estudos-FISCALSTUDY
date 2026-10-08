package com.fiscalstudy.backend.infrastructure.in.web.dto;

import java.util.Map;

public class ImportPayloadDTO {
    private String version;
    private String source;
    private Map<String, Object> data;

    public ImportPayloadDTO() {}

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }

    @Override
    public String toString() {
        return "ImportPayloadDTO{" +
                "version='" + version + '\'' +
                ", source='" + source + '\'' +
                ", data=" + data +
                '}';
    }
}
