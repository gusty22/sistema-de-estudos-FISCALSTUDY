package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class ExportManifestDTO {

    @JsonProperty("manifest_version")
    private String manifestVersion;

    @JsonProperty("contract_version")
    private String contractVersion;

    @JsonProperty("export_timestamp")
    private String exportTimestamp;

    @JsonProperty("database_source")
    private String databaseSource;

    @JsonProperty("student_id")
    private String studentId;

    @JsonProperty("is_production_environment")
    private boolean isProductionEnvironment;

    @JsonProperty("declared_origin")
    private String declaredOrigin;

    @JsonProperty("total_records")
    private int totalRecords;

    @JsonProperty("evaluable_records")
    private int evaluableRecords;

    @JsonProperty("non_evaluable_records")
    private int nonEvaluableRecords;

    @JsonProperty("generated_files")
    private List<GeneratedFileDTO> generatedFiles;

    @JsonProperty("checksum")
    private String checksum;

    @JsonProperty("inclusion_criteria")
    private List<String> inclusionCriteria;

    @JsonProperty("exclusion_criteria")
    private List<String> exclusionCriteria;

    @JsonProperty("traceability_limitations")
    private List<String> traceabilityLimitations;

    @JsonProperty("provenance_guarantee")
    private String provenanceGuarantee;

    public ExportManifestDTO() {}

    public ExportManifestDTO(String manifestVersion, String contractVersion, String exportTimestamp,
                             String databaseSource, String studentId, boolean isProductionEnvironment,
                             String declaredOrigin, int totalRecords, int evaluableRecords,
                             int nonEvaluableRecords, List<GeneratedFileDTO> generatedFiles,
                             String checksum, List<String> inclusionCriteria,
                             List<String> exclusionCriteria, List<String> traceabilityLimitations,
                             String provenanceGuarantee) {
        this.manifestVersion = manifestVersion;
        this.contractVersion = contractVersion;
        this.exportTimestamp = exportTimestamp;
        this.databaseSource = databaseSource;
        this.studentId = studentId;
        this.isProductionEnvironment = isProductionEnvironment;
        this.declaredOrigin = declaredOrigin;
        this.totalRecords = totalRecords;
        this.evaluableRecords = evaluableRecords;
        this.nonEvaluableRecords = nonEvaluableRecords;
        this.generatedFiles = generatedFiles;
        this.checksum = checksum;
        this.inclusionCriteria = inclusionCriteria;
        this.exclusionCriteria = exclusionCriteria;
        this.traceabilityLimitations = traceabilityLimitations;
        this.provenanceGuarantee = provenanceGuarantee;
    }

    public String getManifestVersion() { return manifestVersion; }
    public String getContractVersion() { return contractVersion; }
    public String getExportTimestamp() { return exportTimestamp; }
    public String getDatabaseSource() { return databaseSource; }
    public String getStudentId() { return studentId; }
    public boolean isProductionEnvironment() { return isProductionEnvironment; }
    public String getDeclaredOrigin() { return declaredOrigin; }
    public int getTotalRecords() { return totalRecords; }
    public int getEvaluableRecords() { return evaluableRecords; }
    public int getNonEvaluableRecords() { return nonEvaluableRecords; }
    public List<GeneratedFileDTO> getGeneratedFiles() { return generatedFiles; }
    public String getChecksum() { return checksum; }
    public List<String> getInclusionCriteria() { return inclusionCriteria; }
    public List<String> getExclusionCriteria() { return exclusionCriteria; }
    public List<String> getTraceabilityLimitations() { return traceabilityLimitations; }
    public String getProvenanceGuarantee() { return provenanceGuarantee; }

    public static class GeneratedFileDTO {
        @JsonProperty("filename")
        private String filename;

        @JsonProperty("format")
        private String format;

        @JsonProperty("records_count")
        private int recordsCount;

        @JsonProperty("sha256")
        private String sha256;

        @JsonProperty("byte_size")
        private long byteSize;

        public GeneratedFileDTO() {}

        public GeneratedFileDTO(String filename, String format, int recordsCount, String sha256, long byteSize) {
            this.filename = filename;
            this.format = format;
            this.recordsCount = recordsCount;
            this.sha256 = sha256;
            this.byteSize = byteSize;
        }

        public String getFilename() { return filename; }
        public String getFormat() { return format; }
        public int getRecordsCount() { return recordsCount; }
        public String getSha256() { return sha256; }
        public long getByteSize() { return byteSize; }
    }
}
