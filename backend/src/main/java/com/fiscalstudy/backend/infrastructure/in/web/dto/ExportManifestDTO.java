package com.fiscalstudy.backend.infrastructure.in.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.util.List;
import java.util.Map;

/**
 * Manifesto de uma exportação analítica. Descreve exatamente os bytes do CSV gerado
 * para o snapshot {@code snapshot_max_rowid}. Atesta integridade do arquivo e a configuração
 * da instância que gravou os eventos; não é prova de autenticação pessoal.
 */
@JsonPropertyOrder(alphabetic = false)
public record ExportManifestDTO(
        @JsonProperty("manifest_version") String manifestVersion,
        @JsonProperty("contract_version") String contractVersion,
        @JsonProperty("export_timestamp") String exportTimestamp,
        @JsonProperty("database_source") String databaseSource,
        @JsonProperty("student_id") String studentId,
        @JsonProperty("is_production_environment") boolean productionEnvironment,
        @JsonProperty("recording_instance_origin") String recordingInstanceOrigin,
        @JsonProperty("origin_filter") String originFilter,
        @JsonProperty("declared_origin") String declaredOrigin,
        @JsonProperty("snapshot_max_rowid") long snapshotMaxRowid,
        @JsonProperty("total_records") int totalRecords,
        @JsonProperty("evaluable_records") int evaluableRecords,
        @JsonProperty("non_evaluable_records") int nonEvaluableRecords,
        @JsonProperty("records_by_origin") Map<String, Integer> recordsByOrigin,
        @JsonProperty("generated_files") List<GeneratedFileDTO> generatedFiles,
        @JsonProperty("checksum_algorithm") String checksumAlgorithm,
        @JsonProperty("checksum") String checksum,
        @JsonProperty("inclusion_criteria") List<String> inclusionCriteria,
        @JsonProperty("exclusion_criteria") List<String> exclusionCriteria,
        @JsonProperty("traceability_limitations") List<String> traceabilityLimitations,
        @JsonProperty("provenance_guarantee") String provenanceGuarantee
) {
    public String getChecksum() { return checksum; }
    public int getTotalRecords() { return totalRecords; }
    public int getEvaluableRecords() { return evaluableRecords; }
    public int getNonEvaluableRecords() { return nonEvaluableRecords; }
    public String getDeclaredOrigin() { return declaredOrigin; }
    public long getSnapshotMaxRowid() { return snapshotMaxRowid; }
    public boolean isProductionEnvironment() { return productionEnvironment; }
    public List<GeneratedFileDTO> getGeneratedFiles() { return generatedFiles; }

    public record GeneratedFileDTO(
            @JsonProperty("filename") String filename,
            @JsonProperty("format") String format,
            @JsonProperty("records_count") int recordsCount,
            @JsonProperty("sha256") String sha256,
            @JsonProperty("byte_size") long byteSize
    ) {
        public String getFilename() { return filename; }
        public String getFormat() { return format; }
        public int getRecordsCount() { return recordsCount; }
        public String getSha256() { return sha256; }
        public long getByteSize() { return byteSize; }
    }
}
