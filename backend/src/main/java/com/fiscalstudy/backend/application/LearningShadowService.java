package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.*;
import com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths;
import com.fiscalstudy.backend.infrastructure.process.BoundedProcess;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.*;
import java.time.*;
import java.util.*;

/** Separate observation-only path. No scheduler, cycle, projection writer or study service. */
@Service
public class LearningShadowService {
    static final List<String> ENGINE_SOURCES=List.of("run_core_shadow.R","R/core_shadow_adapter.R","R/learning_orchestrator.R",
        "R/evidence_specialists.R","R/pedagogical_decision.R","R/provenance.R","R/learning_profile.R","R/analytical_portability.R",
        "R/descriptive_analysis.R","lab/decision_scientific_evaluation.R","lab/prospective_scorecard.R","lab/individual_calibration.R");
    private final LearningShadowSnapshotService snapshots;
    private final AnalyticsPaths paths;
    private final ObjectMapper mapper;
    private final boolean enabled;
    private final String executable;
    private final int timeout;
    public LearningShadowService(LearningShadowSnapshotService snapshots, AnalyticsPaths paths, ObjectMapper mapper,
            @Value("${fiscalstudy.learning-shadow.enabled:false}") boolean enabled,
            @Value("${fiscalstudy.learning-shadow.rscript:Rscript}") String executable,
            @Value("${fiscalstudy.learning-shadow.timeout-seconds:30}") int timeout) {
        this.snapshots=snapshots; this.paths=paths; this.mapper=mapper;
        this.enabled=enabled; this.executable=executable; this.timeout=timeout;
    }
    public record Observation(String status, JsonNode decision, Path artifacts) {}

    /** Host API only; deliberately no HTTP endpoint, startup hook or operational consumer. */
    public Observation observe(String contest, String edital, Instant cutoff, int availableMinutes, int timeboxMinutes) {
        if(!enabled) return new Observation("DISABLED",null,null);
        Path run=null;
        try {
            if(timeout<1 || timeout>300) throw new IllegalArgumentException("Invalid shadow timeout");
            var request=snapshots.capture(contest,edital,cutoff,availableMinutes,timeboxMinutes);
            var sources=new TreeMap<String,String>();
            for(String file:ENGINE_SOURCES)
                sources.put(file,HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(paths.engine().resolve(file)))));
            request.put("engine_sources",sources);
            String id=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonicalBytes(mapper,request)));
            request.put("run_id",id);
            byte[] bytes=canonicalBytes(mapper,request);
            if(bytes.length>32*1024*1024) throw new IllegalArgumentException("Snapshot exceeds bound");
            Path root=paths.output().resolve("learning-shadow"); Files.createDirectories(root);
            try { run=Files.createTempDirectory(root,"run-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------"))); }
            catch(UnsupportedOperationException windows) { run=Files.createTempDirectory(root,"run-"); }
            if(Files.getFileAttributeView(run,java.nio.file.attribute.AclFileAttributeView.class)!=null) {
                var acl=Files.getFileAttributeView(run,java.nio.file.attribute.AclFileAttributeView.class);
                acl.setAcl(List.of(java.nio.file.attribute.AclEntry.newBuilder().setType(java.nio.file.attribute.AclEntryType.ALLOW)
                    .setPrincipal(Files.getOwner(run)).setPermissions(EnumSet.allOf(java.nio.file.attribute.AclEntryPermission.class))
                    .setFlags(java.nio.file.attribute.AclEntryFlag.DIRECTORY_INHERIT,java.nio.file.attribute.AclEntryFlag.FILE_INHERIT).build()));
            }
            Path input=run.resolve("request.json"), output=run.resolve("result.json");
            Files.write(input,bytes,StandardOpenOption.CREATE_NEW);
            byte[] random=new byte[32]; new SecureRandom().nextBytes(random);
            String secret=HexFormat.of().formatHex(random);
            var env=Map.of("FISCALSTUDY_SHADOW_SECRET",secret,"FISCALSTUDY_SHADOW_REQUEST_MAC",mac(secret,bytes));
            var process=BoundedProcess.run(List.of(executable,"--vanilla",paths.engine().resolve("run_core_shadow.R").toString(),
                input.toString(),output.toString()),paths.engine(),Duration.ofSeconds(timeout),env);
            Files.writeString(run.resolve("process.log"),process.output(),StandardOpenOption.CREATE_NEW);
            if(process.exitCode()!=0) throw new IllegalStateException("Analytical child failed");
            Path signatureFile=Path.of(output+".mac");
            if(!Files.isRegularFile(output) || Files.size(output)>32*1024*1024 || Files.size(output)<1 ||
                !Files.isRegularFile(signatureFile) || Files.size(signatureFile)>128) throw new IllegalStateException("Incomplete output");
            byte[] response=Files.readAllBytes(output);
            String signature=Files.readString(signatureFile).trim();
            if(!MessageDigest.isEqual(mac(secret,response).getBytes(StandardCharsets.US_ASCII),signature.getBytes(StandardCharsets.US_ASCII)))
                throw new IllegalStateException("Unauthenticated child output");
            JsonNode result=mapper.readTree(response);
            validate(result,mapper.valueToTree(request));
            Files.writeString(run.resolve("validation.json"),mapper.writeValueAsString(Map.of("schema_version","core-shadow-validation-v1",
                "run_id",id,"status","VALIDATED","mode","OBSERVATION_ONLY","can_apply",false,"can_schedule",false)),StandardOpenOption.CREATE_NEW);
            Files.delete(signatureFile); // This ephemeral MAC is not a durable custody signature.
            return new Observation("SUCCEEDED",result,run);
        } catch(Exception failure) {
            if(failure instanceof InterruptedException) Thread.currentThread().interrupt();
            if(run!=null) try { Files.writeString(run.resolve("failure.txt"),failure.getClass().getSimpleName()+": "+failure.getMessage(),StandardOpenOption.CREATE_NEW); } catch(Exception ignored) { /* Analysis failure never enters the operational path. */ }
            return new Observation("FAILED",null,run);
        }
    }
    static String mac(String secret,byte[] data) throws GeneralSecurityException {
        Mac hmac=Mac.getInstance("HmacSHA256"); hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.US_ASCII),"HmacSHA256"));
        return HexFormat.of().formatHex(hmac.doFinal(data));
    }
    static byte[] canonicalBytes(ObjectMapper mapper,Map<String,Object> input) throws java.io.IOException {
        return mapper.writer().with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).writeValueAsBytes(input);
    }
    static void validate(JsonNode response, JsonNode request) {
        require("core-learning-shadow-result-v1".equals(response.path("schema_version").asText()));
        require(response.path("run_id").equals(request.path("run_id")));
        for(String field:List.of("source_id","producer_version","engine_sources","evidence_cutoff","fixture_installation","evidence_omissions","java_runtime"))
            require(response.path("host_source").path(field).equals(request.path(field)));
        require(response.path("host_source").path("snapshot_rowid").isIntegralNumber() &&
            response.path("host_source").path("snapshot_rowid").longValue()==request.path("snapshot_rowid").longValue());
        require("OBSERVATION_ONLY".equals(response.path("mode").asText()) && response.path("replay_verified").isBoolean() && response.path("replay_verified").booleanValue());
        denyCapabilities(response);
        for(String capability:List.of("can_apply","can_schedule")) require(response.path(capability).isBoolean() && !response.path(capability).booleanValue());
        JsonNode result=response.path("result");
        require("1.0.0".equals(result.path("schema_version").asText()) && "OBSERVATION_ONLY".equals(result.path("mode").asText()));
        require(result.path("run_id").equals(request.path("run_id")) && result.path("student_id").equals(request.path("student_id")) && result.path("cutoff").equals(request.path("cutoff")));
        require(result.path("context_used").equals(request.path("context")));
        require("EVIDENCE_CONTEXTUAL_V1".equals(result.path("policy").path("version").asText()));
        require(result.path("decision_trace").path("input_id").isTextual() && result.path("specialists").isArray());
        require(response.path("scientific_record").path("result").equals(result));
        Set<String> supplied=new TreeSet<>(), admitted=new TreeSet<>(), rejected=new TreeSet<>();
        request.path("candidates").forEach(c->require(supplied.add(c.path("candidate_id").asText())));
        for(JsonNode c:result.path("admissible_candidates")) {
            require(supplied.contains(c.path("candidate_id").asText()) && admitted.add(c.path("candidate_id").asText()));
            boolean exact=false;
            for(JsonNode original:request.path("candidates")) if(original.equals(c)) exact=true;
            require(exact);
        }
        for(JsonNode c:result.path("rejected_candidates")) {
            require(supplied.contains(c.path("candidate_id").asText()) && rejected.add(c.path("candidate_id").asText()) && !stringSet(c.path("codes")).isEmpty());
        }
        Set<String> union=new TreeSet<>(admitted); union.addAll(rejected);
        require(Collections.disjoint(admitted,rejected) && union.equals(supplied));
        JsonNode choices=result.path("policy_comparison").path("choices");
        require(choices.isObject() && choices.size()==3);
        for(String policy:List.of("EVIDENCE_CONTEXTUAL_V1","SHORTEST_ADMISSIBLE_V1","CURRICULAR_CONSERVATIVE_V1")) {
            JsonNode choice=choices.path(policy);
            Set<String> evaluated=stringSet(choice.path("evaluated_candidates"));
            require(evaluated.equals(admitted));
            require(choice.has("candidate_id") && (choice.path("candidate_id").isNull() || admitted.contains(choice.path("candidate_id").asText())));
        }
        require(result.path("proposal").path("candidate_id").equals(choices.path("EVIDENCE_CONTEXTUAL_V1").path("candidate_id")));
        require(response.path("evaluation_pending").path("status").asText().equals("PENDING"));
    }
    private static Set<String> stringSet(JsonNode node) {
        Set<String> result=new TreeSet<>();
        if(node.isTextual()) result.add(node.asText());
        else { require(node.isArray()); node.forEach(n->{require(n.isTextual() && result.add(n.asText()));}); }
        return result;
    }
    private static void denyCapabilities(JsonNode node) {
        if(node.isObject()) node.fields().forEachRemaining(e->{
            if(Set.of("can_apply","can_schedule").contains(e.getKey())) require(e.getValue().isBoolean() && !e.getValue().booleanValue());
            denyCapabilities(e.getValue());
        });
        else if(node.isArray()) node.forEach(LearningShadowService::denyCapabilities);
    }
    private static void require(boolean condition) { if(!condition) throw new IllegalArgumentException("Invalid observation-only response"); }
}
